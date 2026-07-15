---
description: 类型检查-修复循环：pnpm typecheck → 读 tsc 报错修复 → 重跑，直到全绿
allowed-tools: Bash, PowerShell, Read, Edit, Grep, Glob
---

# /typecheck — 类型检查-修复 Loop

## 步骤
1. 运行 `pnpm typecheck`（等价 `tsc --noEmit`）。
2. 全绿 → 结束，报告通过。
3. 有报错 → 完整读取每条 `error TSxxxx`，定位文件:行。

## 修复循环（核心）
1. 逐条读 tsc 报错，理解真实类型不匹配（勿用 `any`/`as` 草草压掉——那会掩盖用例里真实的字段错误）。
2. 常见来源：
   - `src/catalog/types.ts` 与后端 DTO 字段不一致 → 以后端 DTO 为准修类型（接口规范见 `docs/api/`）。
   - runner/client 里 `unknown` 未收窄 → 补类型守卫或点路径取值。
3. 改完回到第 1 步重跑，直到全绿。
4. 若报错来自依赖类型声明缺失，装 `@types/*` 而非改业务代码。

> 本项目用 tsx 直跑、不产出 dist；typecheck 是唯一的静态门禁，提交前值得跑一遍。
