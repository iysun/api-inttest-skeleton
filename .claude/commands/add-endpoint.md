---
description: 新增接口-写用例流水线：向 catalog 加 apiKey + 类型 → 写场景 → run 至绿 → 判断补文档
allowed-tools: Bash, PowerShell, Read, Edit, Write, Grep, Glob
---

# /add-endpoint — 新增接口-写用例流水线

目标：把一个后端接口纳入集测目录并写出可跑通的用例。

## 步骤
1. **定位后端接口**：确认 HTTP 方法、路径、服务前缀、请求/响应 DTO。从本项目后端源码/OpenAPI 文档追溯字段。
   > 只读源码/文档追溯字段，**不读** `config/`、`deploy/config/`、`.env` 等敏感文件。
2. **注册到目录**：在 `src/catalog/apis.ts` 的 `API_CATALOG` 加一条：
   `method` / `path` / 非默认前缀接口加 `prefix` / `signed: true` / 批量接口 `bodyIsArray: true` / `summary`。
3. **补类型**：在 `src/catalog/types.ts` 加请求/响应 interface，字段与后端 DTO 约束一致；深层可选项用 `[k: string]: unknown` 兜底。
4. **类型门禁**：跑 `/typecheck` 至全绿。
5. **写场景**：在目标项目目录 `scenarios/<project>/` 新建 `*.yaml`（`<project>` = 要跑的 `--project` 名；可复制 `scenarios/example/example.yaml`），用 `${state.*}` 复用铺底数据、固定前缀（如 `IT-`）造新数据，写 `assert`。
6. **验证**：走 `/run` 跑通该场景，断言全绿。
7. **判断补文档**：接口进入常用目录 → 在 `AGENTS.md` 接口表 + `docs/api/` 补一条；有新踩坑 → 记 `docs/notes/` 并补索引。纯试验性、一次性的可不补。

## 约束
- 绝不把真实凭据/手机号/证件号写进 YAML 或类型示例，用固定前缀假数据或 `${env.*}`。
