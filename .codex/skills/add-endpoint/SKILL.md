---
name: add-endpoint
description: 接口集测工程：把一个后端接口纳入 catalog 并写出可跑通的 YAML 用例。当需要新增接口目录项、补请求/响应类型、写场景用例并执行验证时使用。
---

# add-endpoint — 新增接口-写用例流水线

前提：先读项目根 `AGENTS.md`（单一事实源）与 `docs/api/`。

## 步骤
1. **定位后端接口**：确认 HTTP 方法、路径、服务前缀、请求/响应 DTO。从后端源码/OpenAPI 追溯字段，不读 `config/`、`deploy/config/`、`.env` 等敏感文件。
2. **注册目录**：`src/catalog/apis.ts` 的 `API_CATALOG` 加一条（`method`/`path`/非默认前缀加 `prefix`/`signed: true`/批量加 `bodyIsArray: true`/`summary`）。
3. **补类型**：`src/catalog/types.ts` 加请求/响应 interface，字段对齐后端 DTO 约束；深层可选项用 `[k: string]: unknown` 兜底。
4. **类型门禁**：`pnpm typecheck` 至全绿。
5. **写场景**：在目标项目目录 `scenarios/<project>/` 新建 `*.yaml`（`<project>` = 要跑的 `--project` 名；可复制 `scenarios/example/example.yaml`），用 `${state.*}` 复用铺底、固定前缀造新数据、写 `assert`。
6. **验证**：`pnpm start run scenarios/<project>/<file>.yaml`（省略 `--project` 时从路径推断），断言全绿。失败按 response 摘要分流修正（鉴权/前缀/业务码/路径）。
7. **判断补文档**：常用接口补 `AGENTS.md` 接口表 + `docs/api/`；新踩坑记 `docs/notes/` 并补索引。

## 约束
绝不把真实凭据/手机号/证件号写进 YAML 或类型示例，用固定前缀假数据或 `${env.*}`。
