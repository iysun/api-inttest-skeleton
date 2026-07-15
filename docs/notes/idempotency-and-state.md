# 幂等与铺底状态

## 现象 / 适用
想让铺底/用例可重复跑；想在用例里复用铺底建好的数据，不重复创建。

## 幂等
铺底与用例全程用**固定前缀的业务主键**（示例用 `IT-`）。若后端对同一业务主键返回既有数据（见 [response-envelope.md](response-envelope.md)），同一套主键**可重复执行**而不产生重复数据。换一批数据只需改 `vars` 里的主键前缀。

## 铺底状态文件（按项目隔离）
`pnpm start provision --project <name>` 执行该项目的 `scenarios/<project>/provision.yaml`，把场景 `exports` 声明的上下文变量写入 `.state/<project>/provision.json`（`.state/` 已 gitignore）。例如：

```json
{ "seedResourceId": "..." }
```

## 在用例里复用
同项目内任意场景用 `${state.<name>}` 读取，如 `${state.seedResourceId}`。实现：`runner.ts` 启动时 `loadState(project)` 注入上下文 `state`（按项目取 `.state/<project>/provision.json`）。

## 维护
- 新增铺底产物：在该项目 `scenarios/<project>/provision.yaml` 加 `step` + `save`，并在顶层 `exports` 列出要持久化的变量名。
- `provision.ts` 只持久化 `exports` 里列出的变量；普通 `run` 不写 `.state`。
