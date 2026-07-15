---
name: create-env
description: 端到端创建一个集测项目(=一个目标环境)并跑通接口。当用户要新增/配置一个环境（dev/test/pre/本地等）、准备一套凭据、或想"建好后写 YAML 调接口测一测"时使用；交互收集非密信息 → 建 scenarios/<name>/（config.json + .env.example 模板）→ 复用/写场景 → provision/run 验证打通。
allowed-tools: Bash, PowerShell, Read, Edit, Write, Grep, Glob
---

# create-env — 建项目(=一个目标环境)-端到端 Loop

目标：把"新增一个集测项目 → 写 YAML 用例 → 调接口跑通"收敛成一次引导式流程。本工程**按项目组织**：每个 `scenarios/<name>/` 目录是一个自包含项目 = 一个目标环境。

前提：先读项目根 `AGENTS.md`（单一事实源）与 `docs/notes/projects.md`（项目分工与选择优先级）。

## 铁律（先明确边界）

- **绝不**把真实凭据 / 手机号 / 证件号写进对话、YAML、源码或任何入库文件。密钥由**用户自己**填进该项目本地 `scenarios/<name>/.env`（已 gitignore）。
- **不询问、不写入、不回读**任何真实密钥值：你只负责生成空模板，`.env` 的内容一律不 Read。
- 非密端点（`baseUrl` / `apiPrefix` / `authType`）才入库到 `scenarios/<name>/config.json`。
- 业务主键用固定前缀（如 `IT-`），保证幂等、可重复执行。

## 步骤

### 1. 收集非密信息（交互）
向用户确认这些**非密**信息，逐项给默认值：
- 项目名 `<name>`（如 `pre`、`local`；将用于目录 `scenarios/<name>/` 与 `--project <name>`）。
- `baseUrl`（该项目对应环境的接口根地址）。
- `apiPrefix`（**默认留空 = 无前缀**；仅特定网关才需要。首次 provision 若 404 再按 `docs/notes/api-prefix-calibration.md` 校准）。
- `authType`（`none` / `bearer` / `hmac`；决定该项目需要哪种凭据，见 `docs/notes/auth-and-signing.md`）。
- 是否设为缺省命中项目（`default:true`；若设，记得把其它项目的 default 去掉）。

只收集非密项。**不要**在这步索取或接收任何密钥值。

### 2. 建 `scenarios/<name>/config.json`
最省事的做法是**复制 `scenarios/example/` 整个目录**改名为 `scenarios/<name>/`，再改 `config.json`：
```json
{
  "baseUrl": "<baseUrl>",
  "apiPrefix": "<apiPrefix>",
  "authType": "<none|bearer|hmac>",
  "default": false
}
```
不复制则用 Write 直接创建该目录与 `config.json`。

### 3. 搭 `scenarios/<name>/.env.example` + `.env` 模板（不含密钥）
- 确保该目录有 `.env.example`（从 `scenarios/example/.env.example` 复制）。
- 若 `scenarios/<name>/.env` **不存在**：用 Write 依 `.env.example` 生成，凭据项**留空**。
- 若**已存在**：不覆盖，只提示用户确认其中凭据是否就绪。
- 确认 `**/.env` 已被 `.gitignore`（`.env.example` 除外）。
- 明确提示用户：**请自行在 `scenarios/<name>/.env` 按 `authType` 填入凭据**（hmac→`PROJECT_ID`/`PROJECT_SECRET`，bearer→`ACCESS_TOKEN`，none→无）。你不代填、不回读。

### 4. 就绪校验
`pnpm start list` 确认新项目出现在列表（含 baseUrl / authType / 凭据是否就绪）。
> 注意：`list` 只检查 `.env` **文件是否存在**（空文件也标 `凭据✔`），是否真的可用以第 6 步冒烟为准。

### 5. 写 / 复用 YAML 并调接口测试
- **冒烟（推荐先跑）**：`pnpm start provision --project <name>` —— 跑该项目 `scenarios/<name>/provision.yaml`，一次性验证"可达性 + 鉴权 + 业务码 + 铺底"，结果写入 `.state/<name>/provision.json`。（新建项目若还没写铺底场景，可先复制 `scenarios/example/provision.yaml` 改造。）
- **按需写用例**：参考 `scenarios/example/example.yaml`，用固定前缀造新数据、`${state.*}` 复用铺底，在**该项目目录** `scenarios/<name>/` 新建最小 `*.yaml`，再 `pnpm start run scenarios/<name>/<file>.yaml`（省略 `--project` 时从路径推断）。YAML 规范与接口目录见 `AGENTS.md`。
- **需要运行时换取令牌等定制** → 在 `scenarios/<name>/hooks.ts` 写 `beforeProvision`/`beforeRun`（可复制 `scenarios/example/hooks.ts`）。

### 6. 修复循环（复用 `/run` 分流口径）
运行会先打印「项目: <name> -> <baseUrl><prefix>」，先确认打到了预期项目；再按失败现象分流：
- 报 **"缺少必填变量 ..."** → 提示用户去 `scenarios/<name>/.env` 填凭据，**不要**硬编造。
- **HTTP 404 / 路由错** → `apiPrefix` 未校准，见 `docs/notes/api-prefix-calibration.md`。
- **401 / `signature mismatch`** → 凭据或鉴权口径问题，见 `docs/notes/auth-and-signing.md`；可在 `scenarios/<name>/.env` 设 `DEBUG_SIGN=1` 打印脱敏鉴权摘要。
- **业务码非成功** → 见 `docs/notes/response-envelope.md`，多为主键重复，换前缀或视为幂等既有数据。
- 断言/字段路径写错 → 对照 response 实际结构修 `assert` 或 `save` 的点路径。

改 YAML / `config.json` 后回到第 5 步重跑，直到断言全绿（退出码 0）。判定为项目/权限问题时停下，给出人工处置指引，不空转。

## 收尾
- 报告：新增项目名、`scenarios/<name>/config.json` 的内容、`.env` 模板已生成（待用户填密钥）、冒烟/用例结果。
- 若沉淀了新踩坑（如该项目特有的前缀/权限差异），按 `AGENTS.md` 维护约定记入 `docs/notes/` 并补 `docs/notes.md` 索引。
