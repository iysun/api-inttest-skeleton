# 鉴权与签名（可插拔）

## 现象 / 适用
接口返回 401 / `signature mismatch` / 鉴权失败；或要把骨架接到一个鉴权口径不同的网关。

## 可插拔鉴权策略
鉴权抽象在 `src/client/auth.ts`，由每项目的 `authType` 选择（`scenarios/<project>/config.json` 配置，可被该项目 `.env` 的 `AUTH_TYPE` 覆盖）：

| authType | 注入的头 | 需要的凭据（放 `scenarios/<project>/.env`） |
|----------|----------|------------------------------|
| `none`   | 无 | 无 |
| `bearer` | `Authorization: Bearer <token>` | `ACCESS_TOKEN` |
| `hmac`   | `x-project-id` + `x-signature`（骨架中性默认头名） | `PROJECT_ID` / `PROJECT_SECRET` |

`hmac` 骨架默认实现：`x-signature = HMAC-SHA256(PROJECT_SECRET, 实际发送字节)` → 小写 hex（`src/client/sign.ts` 的 `signContent`）。头名是**中性默认**，不绑定任何具体网关。

## 项目/组级鉴权覆盖（可插拔）
具体网关的头名/口径**不写进骨架**，由项目或项目组在 `scenarios/<项目|组>/auth.ts` 里导出 `AUTH_STRATEGY`（一个 `AuthStrategy`）覆盖。加载机制与 `catalog.ts` 一致：`src/client/auth-loader.ts` 从 `projectDir` 逐级向上 walk 到 `scenarios/`，第一个 `auth.ts` 生效，整体替换骨架内置策略；没有则回退骨架内置（按 `authType`）。因此项目组可把同一份口径放组根共享。

例：天印网关口径在 `scenarios/tianyin/auth.ts`，注入 `x-timevale-project-id` + `x-timevale-signature`，被 `tianyin/{stable,dev,test}` 各环境共享：
```ts
import type { AuthStrategy } from '../../src/client/auth.js';
import { signContent } from '../../src/client/sign.js';
export const AUTH_STRATEGY: AuthStrategy = {
  headers: (content, cfg) => ({
    'x-timevale-project-id': cfg.projectId,
    'x-timevale-signature': signContent(cfg.projectSecret, content),
  }),
};
```

## 核心不变量：对「确切发送字节」鉴权
`src/client/http.ts` 的 `describeRequest` 先确定要发送的确切字节 `content`，再交给鉴权策略生成头，再原样发送同一份字节：
- **POST/PUT**：`content = JSON.stringify(body)`（body 为空时为 `''`）。
- **GET/DELETE**：`content = buildQueryString(params)`，且**同一份 query 串既用于签名也用于拼 URL**。
- 传给 axios 的 `data` 是**预序列化字符串**，axios 不会二次 `JSON.stringify`，保证「签名的字节」==「发出的字节」。破坏这一点是签名不一致最常见的根因。

## 换成你的网关口径
**不要改骨架 `src/`**，在项目/组目录下定制：
- 若是 Bearer/无鉴权：把该项目 `authType` 设为 `bearer`/`none` 即可，通常无需写 `auth.ts`。令牌需运行时换取/刷新时，在 `scenarios/<project>/hooks.ts` 的 `beforeRun`/`beforeProvision` 里换取并写 `ctx.config.token`（与后续请求共享同一 config，改了即刻生效）。
- 若是 HMAC 但头名/算法不同：在 `scenarios/<项目|组>/auth.ts` 导出 `AUTH_STRATEGY`，用你的头名，或改 `signContent` 的口径（如 base64 输出、加时间戳/nonce——可在 `auth.ts` 里自实现签名）。
- 若口径完全不同（对 `method+path+body` 拼接签名、双向加密等）：同样在 `scenarios/<项目|组>/auth.ts` 的 `AUTH_STRATEGY.headers()` 里实现；必要时调整 `http.ts` 里 `content` 的构造，但**务必守住「对确切发送字节鉴权」不变量**。
- 骨架内置 `none`/`bearer`/`hmac`（中性头名）见 `src/client/auth.ts`，仅作未提供 `auth.ts` 时的回退，一般无需改动。

## 排查
在 `scenarios/<project>/.env` 设 `DEBUG_SIGN=1`，每个请求会打印 `authType`、策略注入的鉴权头名及其脱敏值与 `content`（截断）。日志遍历策略实际注入的头（骨架不认识具体头名），故换成你的 `auth.ts` 后也照常脱敏打印。对照网关侧校验口径核对 `content` 是否一致、`finalUrl` 是否命中正确的服务前缀。
