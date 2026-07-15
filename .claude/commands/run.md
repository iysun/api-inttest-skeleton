---
description: 跑用例-验证循环：provision / run 场景 → 读断言失败与请求/响应摘要 → 修正 → 重跑，直到通过
allowed-tools: Bash, PowerShell, Read, Edit, Grep, Glob
---

# /run — 跑用例-验证 Loop

## 前置校验
- 先确定项目：命令带 `--project <name>`（别名 `--env`），或从场景路径 `scenarios/<project>/...` 推断，或用缺省项目（`config.json` 里 `default:true`，唯一项目则即它）。确认该项目的 `scenarios/<project>/.env` 存在且按 `authType` 填好凭据（hmac→`PROJECT_ID`/`PROJECT_SECRET`，bearer→`ACCESS_TOKEN`，none→无）。缺失则**停下**提示用户 `cp scenarios/<project>/.env.example scenarios/<project>/.env` 配置，不要硬编造凭据。
- `pnpm start list` 可查各项目凭据/hooks 是否就绪、当前缺省项目。
- 需要既有铺底数据的场景，先确认 `.state/<project>/provision.json` 存在；没有就先 `pnpm start provision --project <name>`。

## 运行
- 铺底：`pnpm start provision --project <name>`（跑该项目 `scenarios/<project>/provision.yaml`）
- 单/多用例：`pnpm start run [--project <name>] scenarios/<project>/<file>.yaml [more.yaml ...]`（省略 `--project` 时从场景路径推断项目）
- 临时换个值跑一次、不想改 YAML：加 `--var k=v`（可重复），如 `pnpm start run scenarios/<project>/<file>.yaml --var bizNo=IT-001`，覆盖优先级高于 YAML 里的 `vars`，详见 [docs/notes/var-overrides.md](../../docs/notes/var-overrides.md)
- 排查鉴权：在该项目的 `scenarios/<project>/.env` 设 `DEBUG_SIGN=1`，会打印每个请求的鉴权摘要与内容（脱敏）。

## 修复循环（核心）
1. 读输出：运行前会打印「项目: <name> -> <baseUrl><prefix>」，先确认打到了预期项目；失败步骤为红色，会打印 `assert` 失败详情 + `request` / `response` 摘要。
2. 按现象分流：
   - `code == <成功码>` 断言挂、response 是 `signature mismatch`/401 → 鉴权或凭据问题，见 `docs/notes/auth-and-signing.md`；先确认该项目 `scenarios/<project>/.env` 凭据、`authType` 与签名口径。
   - HTTP 404 / 路由错 → `apiPrefix` 或接口 `prefix` 未校准，见 `docs/notes/api-prefix-calibration.md`。
   - 业务码非成功（如主键冲突）→ 见 `docs/notes/response-envelope.md`，多为主键重复，换固定前缀或视为幂等既有数据。
   - 断言/字段路径写错 → 对照 response 实际结构修 `assert` 或 `save` 的点路径。
3. 改 YAML 或代码后回到运行步重跑，直到断言全绿（退出码 0）。
4. 判定为项目/环境/权限问题（如账号/租户未开接口权限）时停止空转，给出人工处置指引。
