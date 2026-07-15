# API_PREFIX 校准

## 现象 / 适用
首次 `pnpm start provision` 或 `run` 返回 HTTP 404 / 路由找不到，但凭据看起来没问题。

## 原因
接口的控制器相对路径是 `/v1/...`，但公网/网关侧可能需要一个前缀把请求路由到目标服务。最终请求 URL = `baseUrl + (ApiDef.prefix ?? apiPrefix) + path`。

`apiPrefix` 按环境取自 `environments.json`（骨架默认空 `''`），可被该环境 `.env.<name>` 的 `API_PREFIX` 覆盖（临时调试用）。

## 多服务前缀（按接口覆盖）
若接口横跨多个网关服务前缀，env 的 `apiPrefix` 只是**默认前缀**，非默认前缀的接口在 catalog 里用 **`ApiDef.prefix`** 显式覆盖：
```ts
'other.action': {
  method: 'POST', path: '/v1/other/action', prefix: '/other-service', signed: true, summary: '...',
}
```
`src/client/http.ts` 用 `input.prefix ?? cfg.apiPrefix` 拼 URL；有 `prefix` 的接口不受 env `apiPrefix` 影响。

## 正确做法
1. 若 404，先按你所在环境的网关路由 / Swagger 确认目标服务的真实前缀。
2. 改 `environments.json` 里该环境的 `apiPrefix`（持久、入库）；或临时在 `.env.<name>` 设 `API_PREFIX=` 覆盖。可能为空或某个如 `/manage` 的值。
3. `config.ts` 会规整前缀（去尾斜杠、补前导斜杠、空值转 `''`）。
4. 换环境时，该环境的 `baseUrl` 与 `apiPrefix` 一起在 `environments.json` 校准（见 [environments.md](environments.md)）。
