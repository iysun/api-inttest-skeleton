# 接口目录（docs/api/）

本目录放**项目相关**的接口规范：每个（或每组）接口的完整字段、请求/响应结构、必填约束与后端 DTO 路径。骨架里为空占位，接入你的项目后按需补充。

## 约定
- 接口在 `src/catalog/apis.ts` 的 `API_CATALOG` 用 `apiKey`（建议 `<域>.<动作>`，如 `resource.create`）登记：`method` / `path` / 可选 `prefix`（覆盖 env 默认前缀）/ `signed` / 批量接口 `bodyIsArray: true` / `summary`。
- 请求/响应类型在 `src/catalog/types.ts`，对齐后端 DTO；深层可选字段用 `[k: string]: unknown` 兜底。
- 最终请求 URL = `baseUrl + (ApiDef.prefix ?? env.apiPrefix) + path`。
- 新增接口走 `/add-endpoint` 流水线；从 OpenAPI/文档批量接入走 `/gen-api-example`。

## 建议为每个接口记录
- HTTP 方法 / 路径 / 服务前缀。
- 请求体：字段、类型、必填约束、示例。
- 响应：成功码、`data` 结构、关键返回字段的点路径（供 `save`/`assert`）。
- 幂等/冲突语义（若有）。
