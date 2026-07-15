# 多环境配置

## 现象 / 适用
要在 stable / dev / test 等多个环境间切换，而不改代码、不泄露密钥。

## 两类环境（约定）
- **`stable`**：永久稳定环境，url 固定、一直存在，是默认环境（`defaultEnv`）。
- **`dev`**：当前迭代环境，每次迭代重新部署，`baseUrl` 与 `.env.dev` 密钥都会变化——每迭代更新 `environments.json` 里 `dev.baseUrl` + 重填 `.env.dev`。

## 分工
- **`environments.json`（入库，非密）**：每个环境的 `baseUrl`、`apiPrefix` 与 `authType`（`none`/`bearer`/`hmac`）。
  ```json
  {
    "defaultEnv": "stable",
    "environments": {
      "stable": { "baseUrl": "https://<你的稳定环境>", "apiPrefix": "", "authType": "hmac" },
      "dev":    { "baseUrl": "http://<当前迭代部署地址>", "apiPrefix": "", "authType": "hmac" }
    }
  }
  ```
- **`.env.<name>`（gitignore，密钥）**：每个环境一份，按 `authType` 放凭据（hmac→`PROJECT_ID`/`PROJECT_SECRET`，bearer→`ACCESS_TOKEN`，none→无），可选覆盖 `AUTH_TYPE` / `BASE_URL` / `API_PREFIX` / `HTTP_TIMEOUT_MS` / `DEBUG_SIGN`。从 `.env.example` 复制：`cp .env.example .env.stable`。

## 选择哪个环境
优先级：`--env <name>`（CLI）> `TY_ENV`（环境变量）> `environments.json.defaultEnv` > `stable`。
```bash
pnpm start provision --env stable
pnpm start run --env test scenarios/test/xxx.yaml     # 示例按环境分目录 scenarios/<env>/
TY_ENV=test pnpm start run scenarios/test/xxx.yaml    # CI 里用环境变量
pnpm start list                                 # 看有哪些环境、默认是谁、各自凭据文件是否就绪
```
运行时会先打印「环境: <name> -> <baseUrl><prefix>」，确认打对环境。

## 字段优先级
`baseUrl` / `apiPrefix` / `authType`：`.env.<name>` 覆盖 > `environments.json` > 内置默认。
即端点/鉴权默认走 `environments.json`，个人临时调试可在自己的 `.env.<name>` 里覆盖，不影响入库配置。

## 加一个新环境
1. 在 `environments.json` 的 `environments` 加一项（如 `"pre": { "baseUrl": "...", "apiPrefix": "", "authType": "hmac" }`）。
2. `cp .env.example .env.pre`，按该环境 `authType` 填凭据。
3. 该环境的接口示例放 `scenarios/pre/`（与 env 名一致），跑：`pnpm start run --env pre scenarios/pre/<file>.yaml`。

> Claude Code 下可用 `/create-env` 引导式完成以上步骤并跑通冒烟（Agent 只搭 `.env.<name>` 模板，密钥由你自填）。

## 实现
`src/config.ts`：`resolveEnvName()` 定环境，`loadConfig({ env })` 加载 `.env.<name>`（+ 根 `.env` 兜底）并合并 `environments.json`；`listEnvironments()` 供 `list` 命令。密钥永不入库（`.gitignore` 里 `.env.*` 除 `.env.example`）。
