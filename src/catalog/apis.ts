import type { ApiCatalog } from './types-def.js';

/**
 * 引擎内置【示例/回退基座】接口目录。当某项目没有自己的 catalog.ts（且其上层组目录也没有）时，
 * loader 回退到这里。真实项目应在 scenarios/<project>/catalog.ts 导出自己的 API_CATALOG。
 *
 * ★ 接入你的项目：不要改本文件；在 scenarios/<project>/catalog.ts 里 `export const API_CATALOG`，
 *   从 `../../src/catalog/types-def.js` import `ApiDef` 类型即可（深度按挂载层级调整相对路径）。
 *   可用 /add-endpoint 或 /gen-api-example 流水线自动化。
 */
export const API_CATALOG: ApiCatalog = {
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
};
