import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AppConfig } from './config.js';
import type { ApiClient } from './client/http.js';

/**
 * 生命周期钩子上下文。钩子拿到的 `config` 与 `client` 与后续请求**共享同一对象**——
 * 在 beforeProvision/beforeRun 里改 `config.token`（bearer）即可让之后的请求带上新令牌。
 */
export interface HookContext {
  config: AppConfig;
  client: ApiClient;
  project: string;
  projectDir: string;
  /** 该项目的铺底状态（.state/<project>/provision.json） */
  state: Record<string, unknown>;
  log(msg: string): void;
}

export type Hook = (ctx: HookContext) => void | Promise<void>;

/** 项目可在 scenarios/<project>/hooks.ts 里导出这些函数做定制操作 */
export interface ProjectHooks {
  /** provision 铺底前（如换取令牌、准备前置数据） */
  beforeProvision?: Hook;
  /** provision 铺底后 */
  afterProvision?: Hook;
  /** run 用例前（如换取令牌、准备数据） */
  beforeRun?: Hook;
  /** run 用例后（如清理数据） */
  afterRun?: Hook;
}

/** 动态加载项目的 hooks.ts（不存在或无导出则返回空对象） */
export async function loadHooks(projectDir: string): Promise<ProjectHooks> {
  const file = path.join(projectDir, 'hooks.ts');
  if (!fs.existsSync(file)) return {};
  const mod = (await import(pathToFileURL(file).href)) as Partial<ProjectHooks> & {
    default?: ProjectHooks;
  };
  const hooks = mod.default ?? mod;
  return {
    beforeProvision: hooks.beforeProvision,
    afterProvision: hooks.afterProvision,
    beforeRun: hooks.beforeRun,
    afterRun: hooks.afterRun,
  };
}

/** 调用一个钩子（存在才调），带日志前缀 */
export async function invokeHook(
  hooks: ProjectHooks,
  name: keyof ProjectHooks,
  ctx: HookContext
): Promise<void> {
  const fn = hooks[name];
  if (typeof fn !== 'function') return;
  ctx.log(`[hook] ${name} ...`);
  await fn(ctx);
}
