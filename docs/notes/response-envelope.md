# 统一响应封装与业务码

## 现象 / 适用
写 `assert` / `save` 的点路径时不确定结构；或业务返回非成功码想判断是不是"真失败"。

## 结构
约定接口返回统一封装：

```json
{ "code": 200, "message": "success", "data": { ... } }
```

- **成功码**：骨架默认 `code == 200`（见 `src/client/http.ts` 的 `SUCCESS_CODE`）。**很多网关用 `0`**——按你的后端改 `SUCCESS_CODE` 与场景断言里的成功码。
- 客户端 `http.ts` 把响应解包为 `{ code, message, data, httpStatus, raw }`；断言 DSL 对 `code/message/data/httpStatus` 求值。
- 非标准响应（网关直接 4xx/5xx 或 HTML）时，客户端用 `httpStatus` 兜底填 `code`。

## 冲突 / 幂等语义
- 若接口对同一业务主键遇既有数据，通常返回既有标识或带 `exist*` 字段——这是**幂等命中既有数据**，多数不算错误。断言据业务写，或改用不同前缀主键避免撞车。
- 批量接口通常返回 `data.successCount` / `failureCount` 与 `successData[]` / `failureData[]`，逐条判断。

## 常用点路径
`code`、`message`、`data.<field>`、数组用数字下标如 `data.successData.0.resourceId`、`data.failureData.0.errorMsg`。
