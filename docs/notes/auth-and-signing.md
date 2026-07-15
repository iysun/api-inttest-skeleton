# 鉴权与签名（可插拔）

## 现象 / 适用
接口返回 401 / `signature mismatch` / 鉴权失败；或要把骨架接到一个鉴权口径不同的网关。

## 可插拔鉴权策略
鉴权抽象在 `src/client/auth.ts`，由每环境的 `authType` 选择（`environments.json` 配置，可被 `.env` 的 `AUTH_TYPE` 覆盖）：

| authType | 注入的头 | 需要的凭据（放 `.env.<name>`） |
|----------|----------|------------------------------|
| `none`   | 无 | 无 |
| `bearer` | `Authorization: Bearer <token>` | `ACCESS_TOKEN` |
| `hmac`   | `x-timevale-project-id` + `x-timevale-signature` | `PROJECT_ID` / `PROJECT_SECRET` |

`hmac` 默认实现：`x-timevale-signature = HMAC-SHA256(PROJECT_SECRET, 实际发送字节)` → 小写 hex（`src/client/sign.ts` 的 `signContent`）。

## 核心不变量：对「确切发送字节」鉴权
`src/client/http.ts` 的 `describeRequest` 先确定要发送的确切字节 `content`，再交给鉴权策略生成头，再原样发送同一份字节：
- **POST/PUT**：`content = JSON.stringify(body)`（body 为空时为 `''`）。
- **GET/DELETE**：`content = buildQueryString(params)`，且**同一份 query 串既用于签名也用于拼 URL**。
- 传给 axios 的 `data` 是**预序列化字符串**，axios 不会二次 `JSON.stringify`，保证「签名的字节」==「发出的字节」。破坏这一点是签名不一致最常见的根因。

## 换成你的网关口径
在 `src/client/auth.ts`：
- 若是 Bearer/无鉴权：把该环境 `authType` 设为 `bearer`/`none` 即可，通常无需改代码。
- 若是 HMAC 但头名/算法不同：改 `hmacAuth` 里的头名，或改 `sign.ts` 的算法（如 base64 输出、加时间戳/nonce）。
- 若口径完全不同（对 `method+path+body` 拼接签名、双向加密等）：在 `auth.ts` 新增一个 `AuthStrategy` 并在 `getAuthStrategy` 登记；必要时调整 `http.ts` 里 `content` 的构造，但**务必守住「对确切发送字节鉴权」不变量**。

## 排查
在 `.env.<name>` 设 `DEBUG_SIGN=1`，每个请求会打印 `authType`、注入的鉴权头名、脱敏签名摘要与 `content`（截断）。对照网关侧校验口径核对 `content` 是否一致、`finalUrl` 是否命中正确的服务前缀。
