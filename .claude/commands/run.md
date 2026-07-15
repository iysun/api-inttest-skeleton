---
description: 跑用例-验证循环：provision / run 场景 → 读断言失败与请求/响应摘要 → 修正 → 重跑，直到通过
allowed-tools: Bash, PowerShell, Read, Edit, Grep, Glob
---

# /run — 跑用例-验证 Loop

## 前置校验
- 先确定环境：命令带 `--env <name>` 或默认（`environments.json.defaultEnv`，通常 `stable`）。确认该环境的 `.env.<name>` 存在且按 `authType` 填好凭据（hmac→`PROJECT_ID`/`PROJECT_SECRET`，bearer→`ACCESS_TOKEN`，none→无）。缺失则**停下**提示用户 `cp .env.example .env.<name>` 配置，不要硬编造凭据。
- `pnpm start list` 可查各环境凭据文件是否就绪、当前默认环境。
- 需要既有铺底数据的场景，先确认 `.state/provision.json` 存在；没有就先 `pnpm start provision --env <name>`。

## 运行
- 铺底：`pnpm start provision --env <name>`
- 单/多用例：`pnpm start run --env <name> scenarios/<env>/<file>.yaml [more.yaml ...]`（省略 `--env` 用默认环境；示例按环境分目录）
- 排查鉴权：在该环境的 `.env.<name>` 设 `DEBUG_SIGN=1`，会打印每个请求的鉴权摘要与内容（脱敏）。

## 修复循环（核心）
1. 读输出：运行前会打印「环境: <name> -> <baseUrl><prefix>」，先确认打到了预期环境；失败步骤为红色，会打印 `assert` 失败详情 + `request` / `response` 摘要。
2. 按现象分流：
   - `code == <成功码>` 断言挂、response 是 `signature mismatch`/401 → 鉴权或凭据问题，见 `docs/notes/auth-and-signing.md`；先确认该环境 `.env.<name>` 凭据、`authType` 与签名口径。
   - HTTP 404 / 路由错 → `apiPrefix` 或接口 `prefix` 未校准，见 `docs/notes/api-prefix-calibration.md`。
   - 业务码非成功（如主键冲突）→ 见 `docs/notes/response-envelope.md`，多为主键重复，换固定前缀或视为幂等既有数据。
   - 断言/字段路径写错 → 对照 response 实际结构修 `assert` 或 `save` 的点路径。
3. 改 YAML 或代码后回到运行步重跑，直到断言全绿（退出码 0）。
4. 判定为环境/权限问题（如账号/租户未开接口权限）时停止空转，给出人工处置指引。
