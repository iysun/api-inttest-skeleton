# api-inttest — 接口集测工程骨架

一套可复制的**接口集测工程骨架**：一键铺底测试数据 + 用**声明式 YAML** 写接口用例 + 通用 runner 统一处理**可插拔鉴权**并执行/断言。技术栈 **Node ≥18 + TypeScript(ESM) + pnpm + `tsx` 直跑**，无构建产物，`tsc --noEmit` 为唯一静态闸门。运行时依赖仅 `axios` + `dotenv` + `js-yaml`。

**按项目组织**：`scenarios/<project>/` 每个目录是一个自包含项目（= 一个目标环境），自带 `config.json`（非密端点/鉴权）、`.env`（密钥）、`provision.yaml`（铺底）、可选 `hooks.ts`（定制钩子）与用例 yaml。要接多个后端/环境，就并列多个项目目录。

> 想为一个新项目搭集测工程，有两条路线：
> 1. **本骨架（copy-and-adapt）**：拷贝本目录 → 按下方清单适配 → 跑通。最快。
> 2. **元提示词（regenerate）**：把 `tianyin-inttest/提示词.md` 交给 agent 从零重建。两者产物等价。

## 快速开始（在拷贝出的新项目里）

```bash
pnpm install
cp scenarios/example/.env.example scenarios/example/.env   # 该项目一份密钥，按 authType 填凭据
pnpm start list                                            # 查看项目 / 接口目录 / 场景
pnpm start provision --project example                     # 一键铺底 → 写 .state/example/provision.json
pnpm start run scenarios/example/example.yaml              # 省略 --project 时从路径推断项目
pnpm start serve                                           # 可选：本地控制台（只绑 127.0.0.1）
pnpm typecheck
```

## 适配到你的项目（改名/适配清单）

1. **改标识**：`package.json` 的 `name` / `bin`；`AGENTS.md` 标题与简介里的 `<项目>`。
2. **建项目**：复制 `scenarios/example/` 改名为你的目标环境名，填该目录 `config.json` 的 `baseUrl` / `apiPrefix` / `authType`（`none`/`bearer`/`hmac`）；需要多个环境就并列多个目录，给缺省命中的那个设 `"default": true`。
3. **选鉴权**：
   - 内置 `none` / `bearer` / `hmac` 够用 → 只改 `config.json` 的 `authType` 即可；
   - 口径不同（头名/算法/加时间戳 nonce）→ 改 `src/client/auth.ts`（必要时 `src/client/sign.ts`），保持「对确切发送字节鉴权」不变量。详见 `docs/notes/auth-and-signing.md`。
   - 令牌需运行时换取/刷新 → 在项目 `scenarios/<project>/hooks.ts` 的 `beforeRun` 里换取并写 `ctx.config.token`。
4. **换接口**：删掉 `src/catalog/apis.ts`、`src/catalog/types.ts` 里的 `resource.*` 示例，换成你的真实接口（可用 `/add-endpoint` 或 `/gen-api-example`）。
5. **改成功码**：若后端成功码不是 `200`（如 `0`），改 `src/client/http.ts` 的 `SUCCESS_CODE` 与场景断言。
6. **写铺底**：把 `scenarios/<project>/provision.yaml` 换成本项目真正要预建的基础数据（固定前缀主键保幂等，`exports` 声明要复用的产物）。
7. **跑绿**：`pnpm typecheck` → `pnpm start provision --project <name>` → 至少一条 `scenarios/<project>/*.yaml` `run` 全绿。
8. **清理**：删掉本 README 的“骨架”说明、`scenarios/example/` 示例项目（按需保留）。

## 结构

```
src/
  cli.ts               命令入口 provision|run|list|serve（--project，别名 --env）
  config.ts            项目解析 + scenarios/<project>/config.json + .env（含 authType 校验）
  state.ts             .state/<project>/provision.json 读写（按项目隔离）
  hooks.ts             项目生命周期钩子加载/调用（beforeProvision/afterProvision/beforeRun/afterRun）
  client/
    sign.ts            HMAC 签名 + query 串构造（供 hmac 策略与 URL 拼接）
    auth.ts            ★可插拔鉴权策略：none / bearer / hmac
    http.ts            带鉴权的 axios 客户端 + 响应归一（对确切发送字节鉴权）
  catalog/
    apis.ts            API_CATALOG：apiKey → ApiDef（★项目相关，示例待替换）
    types.ts           请求/响应 TS 类型（★项目相关，示例待替换）
  runner/              runner / context(插值) / assert(DSL) / report
  provision/           一键铺底编排（跑 scenarios/<project>/provision.yaml）
  server/serve.ts      本地控制台后端（web/ 前端）
scenarios/
  example/             ★示例项目（一个目录 = 一个项目/目标环境）
    config.json          非密端点 + authType + default（入库）
    .env.example         该项目密钥模板（入库；.env 为实际密钥，gitignore）
    provision.yaml       该项目一键铺底（★示例待替换）
    hooks.ts             可选：该项目定制生命周期钩子
    example.yaml         样例场景
docs/                  notes.md 索引 + notes/ 踩坑 + api/ 接口规范
web/                   serve 用的前端控制台（内联 Bootstrap/Vue/highlight.js）
AGENTS.md              单一事实源；CLAUDE.md 指向它
.claude/ .codex/ .cursor/   各 agent 适配层与工程化技能
```

## 安全

- 真实凭据只放各项目本地 `scenarios/<project>/.env`（已 `.gitignore`，`.env.example` 模板除外），**绝不入库、绝不写进 YAML/源码**。
- 业务主键用固定前缀（如 `IT-`）保证幂等可重跑。
- `serve` 只绑 `127.0.0.1`，签名/密钥留在服务端。

详见 [AGENTS.md](./AGENTS.md) 与 [docs/notes.md](docs/notes.md)。
