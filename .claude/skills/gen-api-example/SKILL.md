---
name: gen-api-example
description: 从你的接口来源（OpenAPI 规范 / 后端 DTO / 文档站）选一个接口 + 一个项目，生成可跑通的调用示例场景。当用户要"生成某接口的调用示例/用例"、"把某个接口接进来测一测"、"在某项目/环境调用某接口"时使用；选接口 → 接入 catalog（识别服务前缀）+ 补类型 → 生成 scenarios/<project>/*.yaml → run 至绿。
allowed-tools: Bash, PowerShell, Read, Edit, Write, Grep, Glob
---

# gen-api-example — 选「接口 + 项目」生成可跑调用示例

目标：给定一个接口和一个项目，产出一个**项目原生、可 `pnpm start run` 跑通**的 YAML 场景（工具按项目的 authType 自动鉴权）。

前提：先读项目根 `AGENTS.md`（单一事实源）。接口元数据来自**只读**的接口来源；不读 `config/`、`deploy/config/`、`.env*`。

## 接口来源（reference-only，按项目而定）
本骨架不绑定特定文档站。接口定义可能来自：
- 项目的 **OpenAPI/Swagger 规范**（`method`/`path`/请求响应 schema/是否数组）；
- 后端 **DTO 源码**（字段、必填约束 `@NotBlank/@NotNull` 等）；
- 内部**接口文档**。
若来源是大 JSON（如 OpenAPI），用 `node -e '...'` 局部读取，勿整篇 Read。字段最终以后端实现为准。

## 铁律
- 绝不把真实凭据/手机号/证件号写进 YAML 或源码。项目/环境特定值用 `vars`（由用户填）、`${env.*}`、`${state.*}`；业务主键用固定前缀（如 `IT-`）。
- 接口来源只读、不改。

## 步骤

### 1. 选接口（交互）
从接口来源定位到唯一接口，拿到 `method`、完整 `path`（含服务前缀）、请求/响应结构。

### 2. 选项目（交互）
`pnpm start list` 列出可用项目（`scenarios/*/config.json`）。确认该项目 `scenarios/<project>/.env` 凭据是否就绪（缺则提示 `cp scenarios/<project>/.env.example scenarios/<project>/.env` 按 authType 填，或用 `/create-env` 新建一个项目）。

### 3. 拆前缀 / 路径
若接口路径含服务前缀，把首段作为 `prefix`、其余为 `path`。
例：`/some-service/v1/foo/create` → `prefix: '/some-service'`、`path: '/v1/foo/create'`。默认前缀的接口可省略 `prefix`。

### 4. 接入 catalog（缺则加，沿用 /add-endpoint 约定）
- `src/catalog/apis.ts` 的 `API_CATALOG` 加一条 apiKey（建议 `<域>.<动作>`）：
  `method` / `path` / `prefix`（**非默认前缀必填**）/ `signed: true` / 顶层为 array 时 `bodyIsArray: true` / `summary`。
- `src/catalog/types.ts` 依接口来源**递归**补请求类型：必填决定字段可选性，嵌套生成子 interface / `T[]`，字段说明作 JSDoc。响应类型可先宽松，跑通后按真实响应校准。
- 跑 `/typecheck` 至全绿。

### 5. 生成场景 `scenarios/<project>/<apiKey>.yaml`
> 落到 step 2 选定项目的目录（`<project>` = `--project` 名，与该目录 `config.json` / `.env` 一致）。该项目的铺底在同目录 `provision.yaml`。
- 依请求 schema **递归拼 body**：只填必填字段 + 关键可选字段；类型给占位（string→`""`、number→`0`、boolean→`false`、array→`[]`/单元素、object→嵌套）。
- **项目/环境特定 ID 提为 `vars` 让用户填**，能对应铺底的用 `${state.*}`；新造数据用固定前缀。
- `assert: ["code == <成功码>"]`；返回有明显主键再加 `data.xxx != null` 与 `save`。
- 顶层 body 是数组的接口，`body` 写成 `- { ... }`。

### 6. 跑通（复用 /run 分流）
`pnpm start run scenarios/<project>/<apiKey>.yaml`（省略 `--project` 时从路径推断）。按现象分流：
- **404 / nginx** → `prefix`/`path` 写错（核对来源路径首段）。
- **401 / `signature mismatch`** → 凭据/鉴权，见 `docs/notes/auth-and-signing.md`；`scenarios/<project>/.env` 设 `DEBUG_SIGN=1` 会打印内容与命中的服务前缀。
- **业务码非成功** → 按 response 改 body：多为 `vars` 里的项目/环境特定值无效或字段/主键重复；提示用户补有效值，不硬编造。
- 断言/字段路径错 → 对照 response 实际结构修 `assert`/`save`。
改后重跑至断言全绿；判定为环境/权限问题则停下给人工处置指引，不空转。

### 7. 收尾
- 报告：接入的 apiKey、`prefix/path`、生成的场景文件、跑通结果（或需用户补哪些 `vars`）。
- 判断补文档：常用接口在 `AGENTS.md` 接口表补一行；新踩坑记 `docs/notes/` 并补 `docs/notes.md` 索引。
