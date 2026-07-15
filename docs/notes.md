# docs/notes.md — 文档索引

每条一行，描述是 agent 判断"要不要读"的路由信号。新增笔记 = 新建一篇 + 补一行索引，不要把内容直接写进本文件。

## 接口规范（docs/api/）

- [接口目录说明](api/README.md) — 如何在 `src/catalog/` 登记接口、字段约定与后端 DTO 对齐方式（骨架占位，接入项目后按需补真实接口文档）。

## 踩坑与机制（docs/notes/）

- [按项目组织](notes/projects.md) — `scenarios/<project>/` 自包含项目：`config.json`（非密端点/authType，入库）+ `.env`（密钥，gitignore）+ `provision.yaml` + `hooks.ts` 分工、`--project`/`TY_PROJECT`/default/唯一项目 选择优先级、字段覆盖、如何加新项目。
- [鉴权与签名](notes/auth-and-signing.md) — 可插拔鉴权策略 `none`/`bearer`/`hmac`；「对确切发送字节鉴权」不变量、如何换成你的网关口径、`DEBUG_SIGN` 排查法。
- [API_PREFIX 校准](notes/api-prefix-calibration.md) — 首次 provision 返回 404 时如何按环境调整网关前缀，以及按接口用 `ApiDef.prefix` 覆盖多服务前缀。
- [统一响应封装](notes/response-envelope.md) — `{code,message,data}` 与成功码约定、冲突/幂等语义、常用点路径。
- [幂等与铺底状态](notes/idempotency-and-state.md) — 业务主键固定前缀幂等，`.state/<project>/provision.json` 的写入与 `${state.*}` 复用。
- [调用时覆盖 vars](notes/var-overrides.md) — CLI `--var key=value` 与 web 控制台粘贴 YAML 两种方式，临时覆盖场景 `vars` 而不改文件，合并优先级与类型推断规则。
