# api-inttest — AI Agent 指引

> 这是**接口集测工程骨架**。接入具体项目时，把本文件里的 `<项目>`、示例接口（`resource.*`）、示例数据替换为你的项目内容，并按需调整成功码/鉴权口径。骨架的搭建/适配清单见 [README.md](./README.md)。

接口集测工程：一键铺底测试数据，用**声明式 YAML** 写接口用例，通过**可插拔鉴权**统一处理签名/令牌鉴权并执行 + 断言。技术栈 **Node + TypeScript（ESM）+ pnpm**，用 `tsx` 直跑，无编译产物。

**按项目组织**：`scenarios/<project>/` 下每个目录是一个自包含项目（= 一个目标环境），自带 `config.json`（非密端点/鉴权）、`.env`（密钥）、`provision.yaml`（铺底）、`hooks.ts`（可选定制钩子）与若干用例 yaml。

你的任务通常是：**按规范新增/修改 `scenarios/<project>/*.yaml` 或向 `src/catalog/` 增接口，然后用 CLI 跑通。**

## AI 工具（harness 入口）

本仓库已配好项目级流程，优先用它们而非临场拼命令：

| 入口 | 用途 |
|------|------|
| `/typecheck` | 类型检查-修复循环：`pnpm typecheck` → 读 tsc 报错修复 → 重跑，直到全绿 |
| `/run` | 跑用例-验证循环：`provision` / `run` 场景 → 读断言失败与请求/响应摘要 → 修 body/断言/代码 → 重跑 |
| `/add-endpoint` | 新增接口-写用例：向 `src/catalog/` 加 apiKey + 类型 → 写 `scenarios/<project>/*.yaml` → run 至绿 |
| `/create-env` | 建项目-端到端：交互收集非密信息 → 写 `scenarios/<name>/config.json` + `.env.example` 模板（密钥由用户自填）→ 复用/写场景 → `provision` / `run` 验证打通 |
| `/gen-api-example` | 选接口-生示例：从你的 OpenAPI/后端 DTO 选一个接口 + 选/建项目 → 接入 catalog（识别服务前缀）+ 补类型 → 生成 `scenarios/<project>/*.yaml` → `run` 至绿 |

Claude Code 下用 `/typecheck`、`/run`、`/add-endpoint`、`/create-env`、`/gen-api-example`；Codex 下对应 `.codex/skills/add-endpoint`；其余按本文件流程手动执行。

## 铁律

- **绝不**把真实凭据 / 手机号 / 证件号等敏感值写进 YAML 或源码。凭据只放各项目的本地 `scenarios/<project>/.env`（已 `.gitignore`，模板 `scenarios/<project>/.env.example` 入库）。YAML 里如需引用配置，用 `${env.XXX}`。
- 不读取、不入库 `config/`、`deploy/config/`、`.env`、密钥或凭据文件内容。
- 铺底与用例的业务主键用固定前缀（如 `IT-`），保证幂等、可重复执行。

## 构建 / 运行 / 开发

### 项目准备
```bash
pnpm install                                              # Node >= 18
cp scenarios/example/.env.example scenarios/example/.env  # 每项目一份密钥文件，按 authType 填凭据
```
每个 `scenarios/<name>/` 是一个项目：非密端点（baseUrl / apiPrefix / authType）写在该目录 `config.json`（入库）；密钥放同目录 `.env`（gitignore）。项目选择优先级：`--project <name>`（别名 `--env`） > `TY_PROJECT`（别名 `TY_ENV`） > 某 `config.json` 里 `default:true` 的项目 > 唯一项目 > 报错并列出可选。**新增一个目标环境 = 新增一个项目**：复制 `scenarios/example/` 改名，改 `config.json`，`cp .env.example .env` 填凭据。

### 运行
```bash
pnpm start list                                           # 查看项目、接口目录 + 现有场景
pnpm start provision [--project <name>]                   # 跑该项目 provision.yaml 一键铺底 -> 写 .state/<project>/provision.json
pnpm start run [--project <name>] [--var k=v ...] scenarios/<project>/xxx.yaml [more...]  # 执行用例（省略 --project 时从场景路径推断项目）
pnpm start serve [--port 8787]                           # 前端控制台：浏览器选场景跑用例（项目按场景路径自动推断，只绑 127.0.0.1）
pnpm typecheck                                            # 类型检查
```
> 首次 `provision` 若 404，是网关前缀问题，见 [docs/notes/api-prefix-calibration.md](docs/notes/api-prefix-calibration.md)。鉴权失败见 [docs/notes/auth-and-signing.md](docs/notes/auth-and-signing.md)。多项目/多环境细节见 [docs/notes/projects.md](docs/notes/projects.md)。临时换个值跑一次不想改 YAML，见 [docs/notes/var-overrides.md](docs/notes/var-overrides.md)（CLI `--var k=v`，web 控制台可直接粘贴 YAML）。

### 添加接口
接口目录**按项目**：在 `scenarios/<project>/catalog.ts` 导出 `API_CATALOG`（apiKey→ApiDef，`ApiDef` 类型从 `../../src/catalog/types-def.js` import），同目录 `types.ts` 补请求/响应类型（对齐后端 DTO），再写场景验证。项目无 `catalog.ts` 时回退引擎内置示例基座（`src/catalog/apis.ts`）。完整步骤走 `/add-endpoint`；从 OpenAPI/文档批量生成走 `/gen-api-example`。
> **多服务前缀**：若接口横跨多个网关服务前缀，`ApiDef.prefix` 可按接口覆盖项目的 `apiPrefix`（缺省走项目默认）。非默认前缀的接口必须显式声明 `prefix`，详见 [docs/notes/api-prefix-calibration.md](docs/notes/api-prefix-calibration.md)。

## 接口目录（apiKey → 后端接口，按项目）

YAML 用 `api: <apiKey>` 引用，runner 从**当前项目的 catalog** 解析（`scenarios/<project>/catalog.ts` 的 `API_CATALOG`；项目组多环境共享则放组根 `scenarios/<group>/catalog.ts`，各环境子项目自动继承）。字段类型见 `src/catalog/types-def.ts`。下表为引擎内置示例基座（`src/catalog/apis.ts`，项目无 catalog.ts 时回退），接入项目后在项目 catalog.ts 里换成真实接口：

| apiKey | 方法/路径 | 请求体 | 关键返回 |
| --- | --- | --- | --- |
| `resource.create` | POST `/v1/resources/create` | 对象（必填 `bizNo,name`） | `data.resourceId` |
| `resource.get` | GET `/v1/resources/get` | query `resourceId` | `data` |
| `resource.batchCreate` | POST `/v1/resources/batchCreate` | **数组** | `data.successData[].resourceId` |

鉴权由客户端按项目的 `authType` 自动处理，YAML 无需关心（原理见 [docs/notes/auth-and-signing.md](docs/notes/auth-and-signing.md)）。骨架内置 `none`/`bearer`/`hmac`（中性头名 `x-project-id`/`x-signature`），**具体网关的头名/口径不写进骨架**：在 `scenarios/<项目|组>/auth.ts` 导出 `AUTH_STRATEGY` 覆盖（加载机制同 `catalog.ts`，逐级向上 walk、组内共享；如天印头名落在 `scenarios/tianyin/auth.ts`）。响应统一 `{ code, message, data }`，成功码见 [docs/notes/response-envelope.md](docs/notes/response-envelope.md)（骨架默认 `code == 200`，按项目改）。

## YAML 场景规范

### 目录约定（按项目分目录，支持项目组）
每个 `scenarios/<project>/` 是一个项目，其下放该项目的用例 yaml。目录内的 `config.json` 决定它是一个项目。跑用例时传完整路径 `scenarios/<project>/<file>.yaml`（省略 `--project` 时从该路径推断项目）。
- **一键铺底** `scenarios/<project>/provision.yaml` 是该项目专属的铺底场景，`provision` 命令读它。
- **项目组（depth-2）**：若一个子目录自身没有 `config.json`、但其下的孙目录各有 `config.json`，则它是「项目组」，孙目录被发现为项目 `<group>/<env>`（如 `tianyin/stable`、`tianyin/dev`）。同组各环境**共享**组根的 `catalog.ts`/`types.ts`，各自独立 `config.json`/`.env`/`provision.yaml`/用例。这用于「同一套接口、多个目标环境」，也便于把整个组作为一个独立仓维护。
- 新增/生成示例时落到对应项目目录下，不要堆在 `scenarios/` 根。

```yaml
name: 场景名称
vars:                      # 可选，场景级变量，顶层可直接 ${varName}
  bizNo: "IT-RES-100"
exports:                   # 可选，仅 provision 用：把这些上下文变量写入 .state
  - seedResourceId
steps:
  - id: createResource     # 可选，缺省 step1/step2...；后续可 ${steps.createResource.data.x}
    api: resource.create   # 必填，引用接口目录
    body:                  # 对象或数组（批量接口用数组），支持 ${...} 插值
      bizNo: "${bizNo}"
      name: "集测资源"
    params: {}             # 可选，GET/DELETE 的 query 参数
    headers: {}            # 可选，额外请求头
    save:                  # 可选，把响应里的值提取到上下文顶层变量
      resourceId: "data.resourceId"
    assert:                # 可选，缺省时默认断言 "code == 200"
      - "code == 200"
      - "data.resourceId != null"
    allowFailure: false    # 可选，true 则该步失败不中断后续步骤
```

### 变量与插值 `${...}`
按点路径解析，可用：`${varName}`（vars 或 `save` 的顶层变量）、`${state.xxx}`（`.state/<project>/provision.json` 的铺底结果）、`${steps.<id>.data.xxx}`（同场景已执行步骤响应）、`${env.XXX}`（环境变量 + **当前项目 `scenarios/<project>/.env` 的键**，项目 `.env` 优先；CLI 与 web 控制台行为一致）。敏感值（凭据、手机号、证件号）只放 `.env`、用 `${env.XXX}` 引用，勿写进 YAML。字符串整体是 `"${path}"` 时替换为解析出的**原始值**（可为对象/数组/数字）。调用时可临时覆盖 `vars`（不改文件）：CLI 用 `--var k=v`，web 控制台直接粘贴 YAML，见 [docs/notes/var-overrides.md](docs/notes/var-overrides.md)。

### 断言 DSL（对响应 `{code,message,data,httpStatus}` 求值）
`code == 200`、`data.successCount == 1`、`data.resourceId != null`、`message contains 成功`、`data.x !contains 失败`；单独路径 `data.resourceId` 即真值判断。点路径示例 `data.successData.0.resourceId`。

## 铺底状态与项目钩子
`/run` 或 `pnpm start provision` 执行该项目的 `scenarios/<project>/provision.yaml`，把 `exports` 变量写入 `.state/<project>/provision.json`（按项目隔离）。其它场景用 `${state.<name>}` 复用这些铺底产物，无需重复创建。详见 [docs/notes/idempotency-and-state.md](docs/notes/idempotency-and-state.md)。

项目可在 `scenarios/<project>/hooks.ts` 导出生命周期钩子 `beforeProvision/afterProvision/beforeRun/afterRun` 做**该项目/环境专属**的定制操作（如 bearer 换取令牌：在 `beforeRun` 里改 `ctx.config.token` 即刻生效；前置准备、收尾清理）。钩子拿到的 `ctx` 含 `config/client/project/projectDir/state/log`，与后续请求共享同一 `config`/`client`。不需要就删掉该文件。

## 维护约定（判断式）

- 改动引入**新踩坑 / 限制 / 项目差异**（如鉴权口径、网关前缀）→ 判断是否值得沉淀 → 记入 `docs/notes/` 并在 `docs/notes.md` 补一行索引。
- **新增/改动接口** → 更新接口目录（本文件表格 + `docs/api/`）。
- **是否更新文档由你按改动性质自行判断**：纯重构 / 小修 / 不影响行为的改动无需更新；文档与代码可同次提交。

## 文档索引

详细设计、接口规范与踩坑见 [docs/notes.md](docs/notes.md)（渐进式索引，按需读取细粒度文件）。
