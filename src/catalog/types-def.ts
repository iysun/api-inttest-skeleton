import type { HttpMethod } from '../client/http.js';

export type { HttpMethod };

/**
 * 接口定义：apiKey -> 一个后端接口。YAML 场景用 `api: <apiKey>` 引用，runner 据此发请求。
 * 最终请求 URL = baseUrl + (ApiDef.prefix ?? 项目 apiPrefix) + path。
 */
export interface ApiDef {
  method: HttpMethod;
  path: string;
  /**
   * 网关服务前缀，覆盖项目的 apiPrefix。缺省时用当前项目的 apiPrefix。
   * 若接口横跨多个服务前缀（如 /manage、/file 等），非默认前缀的接口在此显式声明（前导 /、无尾 /）。
   */
  prefix?: string;
  /** 是否需要鉴权头（informational；实际鉴权按项目的 authType 注入，见 src/client/auth.ts） */
  signed: boolean;
  /** 请求体是否为数组（批量接口） */
  bodyIsArray?: boolean;
  summary: string;
}

/** 一个项目的接口目录：apiKey -> ApiDef。项目在 scenarios/<project>/catalog.ts 导出同名 API_CATALOG。 */
export type ApiCatalog = Record<string, ApiDef>;
