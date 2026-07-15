import axios, { AxiosInstance } from 'axios';
import type { AppConfig } from '../config.js';
import { buildQueryString, redactSignature } from './sign.js';
import { getAuthStrategy, type AuthStrategy } from './auth.js';
import { loadAuthStrategy } from './auth-loader.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiCallInput {
  method: HttpMethod;
  /** 相对路径，如 /v1/resources/create（catalog 提供，前面会拼 baseUrl + prefix） */
  path: string;
  /** 网关服务前缀，覆盖 env 的 apiPrefix；缺省用 cfg.apiPrefix */
  prefix?: string;
  /** POST/PUT 请求体（对象或数组） */
  body?: unknown;
  /** GET/DELETE query 参数 */
  params?: Record<string, unknown>;
  /** 额外请求头（会与鉴权头合并） */
  headers?: Record<string, string>;
}

/** 统一响应封装：{ code, message, data }。成功码按项目而定（默认 200，见 SUCCESS_CODE）。 */
export interface UnifiedResult<T = unknown> {
  code: number;
  message: string;
  data: T;
  /** HTTP 状态码 */
  httpStatus: number;
  /** 原始响应体（调试用） */
  raw: unknown;
}

/** 业务成功码。很多网关用 200，也有用 0 的——按你的后端统一封装改这里。 */
export const SUCCESS_CODE = 200;

/**
 * 构造带「已加载鉴权策略」的客户端：按 cfg.projectDir 逐级向上找 auth.ts（组/项目可覆盖），
 * 否则回退骨架内置策略。凡有 projectDir 的调用方都应经此工厂创建 ApiClient。
 */
export async function createApiClient(cfg: AppConfig): Promise<ApiClient> {
  const auth = await loadAuthStrategy(cfg.projectDir, cfg.authType);
  return new ApiClient(cfg, auth);
}

export class ApiClient {
  private readonly axios: AxiosInstance;
  constructor(
    private readonly cfg: AppConfig,
    // 鉴权策略；默认用骨架内置（按 authType）。有项目 auth.ts 时经 createApiClient 注入。
    private readonly auth: AuthStrategy = getAuthStrategy(cfg.authType)
  ) {
    this.axios = axios.create({
      timeout: cfg.timeoutMs,
      // 手动校验 http 状态，业务错误也要拿到响应体
      validateStatus: () => true,
    });
  }

  /**
   * 解析一次请求的最终形态（不发网络）：完整 URL（GET/DELETE 含 query）、鉴权内容、
   * 注入鉴权头后的请求头、以及要发送的 body 串。call() 与「记录/复制为 curl」共用同一口径。
   */
  describeRequest(input: ApiCallInput): {
    method: HttpMethod;
    url: string;
    headers: Record<string, string>;
    data?: string;
    content: string;
    /** 本次注入的鉴权头名（供调试日志脱敏打印，骨架不认识具体头名） */
    authHeaderKeys: string[];
  } {
    const { method } = input;
    // 前缀优先用接口自带的（覆盖 env），否则用当前环境的 apiPrefix
    const prefix = input.prefix ?? this.cfg.apiPrefix;
    const url = `${this.cfg.baseUrl}${prefix}${input.path}`;

    // 计算鉴权/签名内容：写请求走 body 字符串，读请求走 query string
    let content: string;
    let finalUrl = url;
    let dataToSend: string | undefined;

    if (method === 'GET' || method === 'DELETE') {
      const qs = buildQueryString(input.params);
      content = qs;
      finalUrl = qs ? `${url}?${qs}` : url;
    } else {
      dataToSend = input.body === undefined ? '' : JSON.stringify(input.body);
      content = dataToSend;
    }

    // 可插拔鉴权：对「实际发送字节」content 生成鉴权头（策略经 auth-loader 按项目加载）
    const authHeaders = this.auth.headers(content, this.cfg);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(input.headers || {}),
    };

    return {
      method,
      url: finalUrl,
      headers,
      data: dataToSend,
      content,
      authHeaderKeys: Object.keys(authHeaders),
    };
  }

  async call<T = unknown>(input: ApiCallInput): Promise<UnifiedResult<T>> {
    const { method, url, headers, data, content, authHeaderKeys } = this.describeRequest(input);

    if (this.cfg.debugSign) {
      // 通用打印：遍历策略注入的鉴权头，逐个脱敏——骨架不认识任何具体头名
      const redacted = authHeaderKeys
        .map((k) => `${k}=${redactSignature(String(headers[k] ?? ''))}`)
        .join('\n  ');
      console.error(
        `[auth] ${method} ${url}\n  authType=${this.cfg.authType}` +
          `\n  authHeaders=${authHeaderKeys.join(', ') || '(none)'}` +
          (redacted ? `\n  ${redacted}` : '') +
          `\n  content=${truncate(content, 300)}`
      );
    }

    // 传字符串 data 时 axios 不会二次序列化，保证鉴权内容与发送字节一致
    const resp = await this.axios.request({
      method,
      url,
      headers,
      data: method === 'GET' || method === 'DELETE' ? undefined : data,
    });

    const body = resp.data;
    const result = normalize<T>(body, resp.status);
    return result;
  }
}

function normalize<T>(body: unknown, httpStatus: number): UnifiedResult<T> {
  if (body && typeof body === 'object' && 'code' in (body as Record<string, unknown>)) {
    const b = body as Record<string, unknown>;
    return {
      code: Number(b.code),
      message: String(b.message ?? ''),
      data: b.data as T,
      httpStatus,
      raw: body,
    };
  }
  // 非标准响应（如网关直接 4xx/5xx 或 HTML）：用 httpStatus 兜底为 code
  return {
    code: httpStatus,
    message: typeof body === 'string' ? body : JSON.stringify(body),
    data: body as T,
    httpStatus,
    raw: body,
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
