import type { HttpMethod } from '../client/http.js';

/**
 * 接口目录：apiKey -> 定义。YAML 场景用 `api: <apiKey>` 引用接口，runner 据此发请求。
 * 最终请求 URL = baseUrl + (ApiDef.prefix ?? env.apiPrefix) + path。
 *
 * ★ 这是【项目相关】文件：下面是通用示例，接入你的项目时删掉示例、换成真实接口，
 *   并在 src/catalog/types.ts 补对应请求/响应类型。可用 /add-endpoint 或 /gen-api-example 流水线自动化。
 */
export interface ApiDef {
  method: HttpMethod;
  path: string;
  /**
   * 网关服务前缀，覆盖 env 的 apiPrefix。缺省时用当前环境的 apiPrefix。
   * 若接口横跨多个服务前缀（如 /manage、/file 等），非默认前缀的接口在此显式声明（前导 /、无尾 /）。
   */
  prefix?: string;
  /** 是否需要鉴权头（informational；实际鉴权按 env 的 authType 注入，见 src/client/auth.ts） */
  signed: boolean;
  /** 请求体是否为数组（批量接口） */
  bodyIsArray?: boolean;
  summary: string;
}

export const API_CATALOG: Record<string, ApiDef> = {
  // —— 示例：单对象创建 ——
  'resource.create': {
    method: 'POST',
    path: '/v1/resources/create',
    signed: true,
    summary: '【示例】新建资源。请求体 ResourceCreateRequest，返回 data.resourceId。',
  },
  // —— 示例：GET 带 query 参数 ——
  'resource.get': {
    method: 'GET',
    path: '/v1/resources/get',
    signed: true,
    summary: '【示例】查询资源详情。query resourceId，返回 data。',
  },
  // —— 示例：批量创建（数组请求体）——
  'resource.batchCreate': {
    method: 'POST',
    path: '/v1/resources/batchCreate',
    signed: true,
    bodyIsArray: true,
    summary: '【示例】批量新建资源。请求体 ResourceCreateRequest[]，返回 data.successData[].resourceId。',
  },
  // —— 示例：按接口覆盖服务前缀（跨网关服务时用）——
  // 'other.action': {
  //   method: 'POST', path: '/v1/other/action', prefix: '/other-service', signed: true,
  //   summary: '【示例】非默认前缀接口，用 prefix 覆盖 env.apiPrefix。',
  // },
};

export function getApiDef(apiKey: string): ApiDef {
  const def = API_CATALOG[apiKey];
  if (!def) {
    const keys = Object.keys(API_CATALOG).join(', ');
    throw new Error(`未知 apiKey: "${apiKey}"。可用: ${keys}`);
  }
  return def;
}
