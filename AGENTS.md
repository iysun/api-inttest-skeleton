# api-inttest — AI Agent 指引

> 这是**接口集测工程骨架**。接入具体项目时，把本文件里的 `<项目>`、示例接口（`resource.*`）、示例数据替换为你的项目内容，并按需调整成功码/鉴权口径。骨架的搭建/适配清单见 [README.md](./README.md)。

接口集测工程：一键铺底测试数据，用**声明式 YAML** 写接口用例，通过**可插拔鉴权**统一处理签名/令牌鉴权并执行 + 断言。技术栈 **Node + TypeScript（ESM）+ pnpm**，用 `tsx` 直跑，无编译产物。

你的任务通常是：**按规范新增/修改 `scenarios/<env>/*.yaml` 或向 `src/catalog/` 增接口，然后用 CLI 跑通。**

## AI 工具（harness 入口）

本仓库已配好项目级流程，优先用它们而非临场拼命令：

| 入口 | 用途 |
|------|------|
| `/typecheck` | 类型检查-修复循环：`pnpm typecheck` → 读 tsc 报错修复 → 重跑，直到全绿 |
| `/run` | 跑用例-验证循环：`provision` / `run` 场景 → 读断言失败与请求/响应摘要 → 修 body/断言/代码 → 重跑 |
| `/add-endpoint` | 新增接口-写用例：向 `src/catalog/` 加 apiKey + 类型 → 写 `scenarios/<env>/*.yaml` → run 至绿 |
| `/create-env` | 建环境-端到端：交互收集环境信息 → 写 `environments.json` + `.env.<name>` 模板（密钥由用户自填）→ 复用/写场景 → `provision` / `run` 验证打通 |
| `/gen-api-example` | 选接口-生示例：从你的 OpenAPI/后端 DTO 选一个接口 + 选环境 → 接入 catalog（识别服务前缀）+ 补类型 → 生成 `scenarios/<env>/*.yaml` → `run` 至绿 |

Claude Code 下用 `/typecheck`、`/run`、`/add-endpoint`、`/create-env`、`/gen-api-example`；Codex 下对应 `.codex/skills/add-endpoint`；其余按本文件流程手动执行。

## 铁律

- **绝不**把真实凭据 / 手机号 / 证件号等敏感值写进 YAML 或源码。凭据只放各环境的本地 `.env.<name>`（如 `.env.stable`、`.env.dev`，均已 `.gitignore`）。YAML 里如需引用配置，用 `${env.XXX}`。
- 不读取、不入库 `config/`、`deploy/config/`、`.env*`、密钥或凭据文件内容。
- 铺底与用例的业务主键用固定前缀（如 `IT-`），保证幂等、可重复执行。

## 构建 / 运行 / 开发

### 环境准备
```bash
pnpm install                              # Node >= 18
cp .env.example .env.stable               # 每环境一份密钥文件，按 authType 填凭据
```
非密端点（baseUrl / apiPrefix / authType）按环境写在 `environments.json`（入库）；密钥按环境放 `.env.<name>`（gitignore）。环境选择优先级：`--env <name>` > `TY_ENV` > `environments.json.defaultEnv` > `stable`。`stable`=永久稳定环境（url 固定、默认命中）；`dev`=当前迭代环境（每迭代重新部署，url/密钥都会变）。

### 运行
```bash
pnpm start list                                        # 查看环境、接口目录 + 现有场景
pnpm start provision --env stable                      # 按 stable 环境一键铺底 -> 写 .state/provision.json
pnpm start run --env dev scenarios/dev/xxx.yaml [more...] # 按 dev 环境执行用例（省略 --env 用默认环境）
pnpm start serve [--env <name>] [--port 8787]          # 前端控制台：浏览器选环境+场景跑用例（只绑 127.0.0.1）
pnpm typecheck                                         # 类型检查
```
> 首次 `provision` 若 404，是网关前缀问题，见 [docs/notes/api-prefix-calibration.md](docs/notes/api-prefix-calibration.md)。鉴权失败见 [docs/notes/auth-and-signing.md](docs/notes/auth-and-signing.md)。多环境细节见 [docs/notes/environments.md](docs/notes/environments.md)。

### 添加接口
向 `src/catalog/apis.ts`（`API_CATALOG`）加一条 apiKey，`src/catalog/types.ts` 补请求/响应类型（对齐后端 DTO），再写场景验证。完整步骤走 `/add-endpoint`；从 OpenAPI/文档批量生成走 `/gen-api-example`。
> **多服务前缀**：若接口横跨多个网关服务前缀，`ApiDef.prefix` 可按接口覆盖 env 的 `apiPrefix`（缺省走 env 默认）。非默认前缀的接口必须显式声明 `prefix`，详见 [docs/notes/api-prefix-calibration.md](docs/notes/api-prefix-calibration.md)。

## 接口目录（apiKey → 后端接口）

YAML 用 `api: <apiKey>` 引用。字段见 `src/catalog/types.ts`。下表为骨架示例，接入项目后替换为真实接口：

| apiKey | 方法/路径 | 请求体 | 关键返回 |
| --- | --- | --- | --- |
| `resource.create` | POST `/v1/resources/create` | 对象（必填 `bizNo,name`） | `data.resourceId` |
| `resource.get` | GET `/v1/resources/get` | query `resourceId` | `data` |
| `resource.batchCreate` | POST `/v1/resources/batchCreate` | **数组** | `data.successData[].resourceId` |

鉴权由客户端按 env 的 `authType` 自动处理，YAML 无需关心（原理见 [docs/notes/auth-and-signing.md](docs/notes/auth-and-signing.md)）。响应统一 `{ code, message, data }`，成功码见 [docs/notes/response-envelope.md](docs/notes/response-envelope.md)（骨架默认 `code == 200`，按项目改）。

## YAML 场景规范

### 目录约定（按环境分目录）
环境特定的接口示例放 `scenarios/<env>/`，`<env>` = `--env` 名，与 `environments.json` 的 key、`.env.<name>` 一一对应（如 `scenarios/stable/`、`scenarios/dev/`）。跑用例时传完整路径 `scenarios/<env>/<file>.yaml`。
- **共享铺底** `scenarios/_fixtures/provision.yaml` 与环境无关，原地不动（`provision` 命令硬编码此路径）。
- 新增/生成示例时按目标环境落到对应 `scenarios/<env>/` 下，不要堆在 `scenarios/` 根。

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
按点路径解析，可用：`${varName}`（vars 或 `save` 的顶层变量）、`${state.xxx}`（`.state/provision.json` 的铺底结果）、`${steps.<id>.data.xxx}`（同场景已执行步骤响应）、`${env.XXX}`（环境变量，勿写死密钥）。字符串整体是 `"${path}"` 时替换为解析出的**原始值**（可为对象/数组/数字）。

### 断言 DSL（对响应 `{code,message,data,httpStatus}` 求值）
`code == 200`、`data.successCount == 1`、`data.resourceId != null`、`message contains 成功`、`data.x !contains 失败`；单独路径 `data.resourceId` 即真值判断。点路径示例 `data.successData.0.resourceId`。

## 铺底状态
`/run` 或 `pnpm start provision` 执行 `scenarios/_fixtures/provision.yaml`，把 `exports` 变量写入 `.state/provision.json`。其它场景用 `${state.<name>}` 复用这些铺底产物，无需重复创建。详见 [docs/notes/idempotency-and-state.md](docs/notes/idempotency-and-state.md)。

## 维护约定（判断式）

- 改动引入**新踩坑 / 限制 / 环境差异**（如鉴权口径、网关前缀）→ 判断是否值得沉淀 → 记入 `docs/notes/` 并在 `docs/notes.md` 补一行索引。
- **新增/改动接口** → 更新接口目录（本文件表格 + `docs/api/`）。
- **是否更新文档由你按改动性质自行判断**：纯重构 / 小修 / 不影响行为的改动无需更新；文档与代码可同次提交。

## 文档索引

详细设计、接口规范与踩坑见 [docs/notes.md](docs/notes.md)（渐进式索引，按需读取细粒度文件）。
