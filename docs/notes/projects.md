# 按项目组织（多项目 / 多环境）

## 现象 / 适用
要在多个目标后端（stable / dev / test 等）之间切换，而不改代码、不泄露密钥。本工程**按项目组织**：每个 `scenarios/<project>/` 目录是一个自包含项目 = 一个目标环境。要接几个环境，就并列几个项目目录。

## 一个项目目录的构成
`scenarios/<project>/`：
- **`config.json`（入库，非密）**：该项目的 `baseUrl`、`apiPrefix`、`authType`（`none`/`bearer`/`hmac`）、`default`（布尔，缺省命中该项目）。
  ```json
  {
    "baseUrl": "https://<你的目标环境>",
    "apiPrefix": "",
    "authType": "hmac",
    "default": true
  }
  ```
- **`.env`（gitignore，密钥）**：按 `authType` 放凭据（hmac→`PROJECT_ID`/`PROJECT_SECRET`，bearer→`ACCESS_TOKEN`，none→无），可选覆盖 `AUTH_TYPE` / `BASE_URL` / `API_PREFIX` / `HTTP_TIMEOUT_MS` / `DEBUG_SIGN`。从模板复制：`cp scenarios/<project>/.env.example scenarios/<project>/.env`。
- **`provision.yaml`**：该项目的一键铺底场景，`provision` 命令读它，产物写 `.state/<project>/provision.json`。
- **`hooks.ts`（可选）**：该项目/环境专属的生命周期钩子（见下）。
- **用例 `*.yaml`**：该项目的接口用例。

## 选择哪个项目
优先级：`--project <name>`（CLI，别名 `--env`）> `TY_PROJECT`（环境变量，别名 `TY_ENV`）> 某 `config.json` 里 `default:true` 的项目 > 唯一项目 > 报错并列出可选项目。`run` 省略 `--project` 时，会**从场景路径 `scenarios/<project>/...` 自动推断**（多个场景分属不同项目会报错要求显式指定）。
```bash
pnpm start provision --project example
pnpm start run scenarios/example/xxx.yaml            # 从路径推断项目 example
TY_PROJECT=test pnpm start run scenarios/test/xxx.yaml   # CI 里用环境变量
pnpm start list                                      # 看有哪些项目、缺省是谁、各自凭据/hooks 是否就绪
```
运行时会先打印「项目: <name> -> <baseUrl><prefix>」，确认打对项目。

## 字段优先级
`baseUrl` / `apiPrefix` / `authType`：该项目 `.env` 覆盖 > 该项目 `config.json` > 内置默认。
即端点/鉴权默认走 `config.json`，个人临时调试可在自己的 `.env` 里覆盖，不影响入库配置。

## 加一个新项目
1. 复制 `scenarios/example/` 改名为新项目名（如 `scenarios/pre/`）。
2. 改 `scenarios/pre/config.json` 的 `baseUrl` / `apiPrefix` / `authType`；若要它缺省命中就设 `"default": true`（同时把其它项目的 default 去掉）。
3. `cp scenarios/pre/.env.example scenarios/pre/.env`，按该项目 `authType` 填凭据。
4. 该项目的接口示例放 `scenarios/pre/` 下，跑：`pnpm start run scenarios/pre/<file>.yaml`（或 `--project pre`）。

> Claude Code 下可用 `/create-env` 引导式完成以上步骤并跑通冒烟（Agent 只搭 `config.json` + `.env.example` 模板，密钥由你自填）。

## 接口目录 catalog（按项目）
YAML 用 `api: <apiKey>` 引用，runner 从**当前项目的 catalog** 解析。加载优先级（`src/catalog/loader.ts` 的 `loadCatalog`）：项目目录 `scenarios/<project>/catalog.ts` → 逐级向上到组根 `scenarios/<group>/catalog.ts` → 引擎内置示例基座 `src/catalog/apis.ts`（回退），第一个存在的整体生效。项目 catalog.ts 形如：
```ts
import type { ApiCatalog } from '../../src/catalog/types-def.js'; // 深度按挂载层级调整相对路径
export const API_CATALOG: ApiCatalog = { 'foo.create': { method: 'POST', path: '/v1/foo/create', signed: true, summary: '...' } };
```

## 项目组（depth-2）：一套接口、多个环境
若一个子目录自身没有 `config.json`、但其孙目录各有 `config.json`，它就是**项目组**，孙目录被发现为项目 `<group>/<env>`（如 `tianyin/stable`、`tianyin/dev`、`tianyin/test`）。同组各环境**共享**组根的 `catalog.ts`/`types.ts`/`docs`，各自独立 `config.json`/`.env`/`provision.yaml`/用例。用 `--project tianyin/dev` 或从路径推断。这既适合「同一套接口跑多个目标环境」，也便于把**整个组作为一个独立仓**维护（如放 GitLab），而引擎骨架单独维护（如 GitHub）。

## 项目钩子 hooks.ts
`scenarios/<project>/hooks.ts` 可导出 `beforeProvision/afterProvision/beforeRun/afterRun`，在铺底/跑用例前后做该项目/环境专属定制：bearer 换取令牌（改 `ctx.config.token` 即刻生效）、前置准备数据、收尾清理等。`ctx` 含 `config/client/project/projectDir/state/log`，与后续请求共享同一 `config`/`client`。不需要就删掉该文件——`provision`/`run` 照常运行。

## 实现
`src/config.ts`：`resolveProjectName()` 定项目，`loadConfig({ project })` 加载 `scenarios/<project>/.env` 并合并该目录 `config.json`；`listProjectNames()` / `listProjectsDetailed()` 供 `list` 命令与前端。`src/hooks.ts` 动态加载项目 `hooks.ts`。密钥永不入库（`.gitignore` 里 `**/.env` 除 `**/.env.example`）。为兼容旧用法，`--env`/`TY_ENV`/`resolveEnvName`/`loadConfigForEnv` 保留为别名。
