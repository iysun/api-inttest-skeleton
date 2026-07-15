import fs from 'node:fs';
import yaml from 'js-yaml';
import { ApiClient, type UnifiedResult, SUCCESS_CODE } from '../client/http.js';
import { getApiDef } from '../catalog/loader.js';
import type { ApiCatalog } from '../catalog/types-def.js';
import { interpolate, getPath } from './context.js';
import { evalAssert, type AssertResult } from './assert.js';
import { loadState } from '../state.js';

export interface ScenarioStep {
  id?: string;
  api: string;
  body?: unknown;
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
  /** varName -> 响应 scope 的点路径（如 data.resourceId） */
  save?: Record<string, string>;
  assert?: string[];
  /** 断言/业务失败时是否继续后续步骤（默认 false，失败即停） */
  allowFailure?: boolean;
}

export interface Scenario {
  name: string;
  vars?: Record<string, unknown>;
  /** provision 命令据此把上下文变量写入 .state */
  exports?: string[];
  steps: ScenarioStep[];
}

export interface StepReport {
  id: string;
  api: string;
  ok: boolean;
  code: number;
  message: string;
  httpStatus: number;
  asserts: AssertResult[];
  error?: string;
  request: {
    method: string;
    path: string;
    body?: unknown;
    params?: unknown;
    /** 解析后的完整 URL（GET/DELETE 含 query），供 UI 展示与「复制为 curl」 */
    url?: string;
    /** 实际发送的请求头（含签名），供「复制为 curl」 */
    headers?: Record<string, string>;
  };
  response: unknown;
}

export interface ScenarioReport {
  name: string;
  ok: boolean;
  steps: StepReport[];
  context: Record<string, unknown>;
}

export function loadScenario(filePath: string): Scenario {
  const txt = fs.readFileSync(filePath, 'utf8');
  const doc = yaml.load(txt) as Scenario;
  if (!doc || typeof doc !== 'object') throw new Error(`场景文件为空或非法: ${filePath}`);
  if (!Array.isArray(doc.steps) || doc.steps.length === 0) {
    throw new Error(`场景 ${filePath} 缺少 steps`);
  }
  doc.name = doc.name || filePath;
  return doc;
}

export interface ScenarioRequest {
  id: string;
  api: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
    params?: unknown;
  };
}

/**
 * 「干跑」描述场景每一步的最终请求（完整 URL + 签名头 + body），不发任何网络请求。
 * 用于「复制为 curl」。上下文与 runScenario 一致，但链式步骤依赖的 ${steps.x...} 无实际响应，
 * 会被 interpolate 解析为空串（尽力而为，不抛错）。
 */
export function describeScenarioRequests(
  client: ApiClient,
  scenario: Scenario,
  catalog: ApiCatalog,
  project?: string
): ScenarioRequest[] {
  const context: Record<string, unknown> = {
    ...(scenario.vars || {}),
    env: { ...process.env },
    state: loadState(project),
    steps: {} as Record<string, unknown>,
  };

  return scenario.steps.map((step, i) => {
    const id = step.id || `step${i + 1}`;
    const def = getApiDef(catalog, step.api);
    const body = step.body === undefined ? undefined : interpolate(step.body, context);
    const params = step.params
      ? (interpolate(step.params, context) as Record<string, unknown>)
      : undefined;
    const headers = step.headers
      ? (interpolate(step.headers, context) as Record<string, string>)
      : undefined;
    const meta = client.describeRequest({
      method: def.method,
      path: def.path,
      prefix: def.prefix,
      body,
      params,
      headers,
    });
    return {
      id,
      api: step.api,
      request: { method: meta.method, url: meta.url, headers: meta.headers, body, params },
    };
  });
}

export async function runScenario(
  client: ApiClient,
  scenario: Scenario,
  catalog: ApiCatalog,
  project?: string
): Promise<ScenarioReport> {
  // 上下文：vars 顶层展开 + env + state + steps
  const context: Record<string, unknown> = {
    ...(scenario.vars || {}),
    env: { ...process.env },
    state: loadState(project),
    steps: {} as Record<string, unknown>,
  };

  const steps: StepReport[] = [];
  let scenarioOk = true;

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    const id = step.id || `step${i + 1}`;
    const def = getApiDef(catalog, step.api);

    const body = step.body === undefined ? undefined : interpolate(step.body, context);
    const params = step.params
      ? (interpolate(step.params, context) as Record<string, unknown>)
      : undefined;
    const headers = step.headers
      ? (interpolate(step.headers, context) as Record<string, string>)
      : undefined;

    const meta = client.describeRequest({
      method: def.method,
      path: def.path,
      prefix: def.prefix,
      body,
      params,
      headers,
    });
    const request = {
      method: def.method,
      path: `${def.prefix ?? ''}${def.path}`,
      body,
      params,
      url: meta.url,
      headers: meta.headers,
    };
    let result: UnifiedResult;
    const asserts: AssertResult[] = [];
    let error: string | undefined;
    let ok = true;

    try {
      result = await client.call({
        method: def.method,
        path: def.path,
        prefix: def.prefix,
        body,
        params,
        headers,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      const rep: StepReport = {
        id,
        api: step.api,
        ok: false,
        code: 0,
        message: error,
        httpStatus: 0,
        asserts,
        error,
        request,
        response: undefined,
      };
      steps.push(rep);
      scenarioOk = false;
      if (!step.allowFailure) break;
      continue;
    }

    // 记录步骤响应，供后续步骤引用 ${steps.<id>.data...}
    (context.steps as Record<string, unknown>)[id] = {
      code: result.code,
      message: result.message,
      data: result.data,
      httpStatus: result.httpStatus,
    };

    // 断言：默认无断言时校验 code == 成功码
    const assertExprs = step.assert && step.assert.length ? step.assert : [`code == ${SUCCESS_CODE}`];
    for (const expr of assertExprs) {
      const r = evalAssert(expr, result);
      asserts.push(r);
      if (!r.ok) ok = false;
    }

    // save：把响应中的值提取到上下文顶层
    if (step.save) {
      for (const [varName, dotPath] of Object.entries(step.save)) {
        context[varName] = getPath(result, dotPath);
      }
    }

    steps.push({
      id,
      api: step.api,
      ok,
      code: result.code,
      message: result.message,
      httpStatus: result.httpStatus,
      asserts,
      request,
      response: result.raw,
    });

    if (!ok) {
      scenarioOk = false;
      if (!step.allowFailure) break;
    }
  }

  return { name: scenario.name, ok: scenarioOk, steps, context };
}
