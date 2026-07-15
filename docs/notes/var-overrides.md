# 调用时覆盖 vars

## 现象 / 适用
同一份场景 YAML，跑之前想临时换一个 `bizNo`/金额/证书号之类的值再跑一次，不想改文件或复制一份。

## CLI：`--var key=value`
`run`、`provision` 两个命令都支持，可重复传多个：
```bash
pnpm start run scenarios/example/example.yaml --var bizNo=IT-001 --var count=3
pnpm start provision --project <name> --var someVar=xxx
```
每个 value 先按 `JSON.parse` 尝试解析，成功则用解析结果（`"3"` → 数字 3、`"true"` → 布尔、
`'{"a":1}'` → 对象），解析失败则按原始字符串处理，因此数字/布尔不需要额外加引号。

## Web 控制台：直接粘贴 YAML
`pnpm start serve` 页面上，场景卡片上方有一个默认收起的「覆盖变量」折叠区，textarea 按 **YAML** 解析
（而不是 `key=value`），可以直接从场景文件里复制粘贴，两种写法都支持：
```yaml
# 连 vars: 一起复制也行
vars:
  signFlowId: "xxxxx"
```
```yaml
# 只复制缩进的键值行也行（YAML 顶层缩进只是相对基准）
  signFlowId: "xxxxx"
```
留空则不覆盖任何值；粘贴的内容不是合法 YAML、或解析出来不是一个映射（比如粘贴了数组/纯数字），
接口返回 400 并把错误原因显示在页面上。

## 合并顺序
覆盖值优先级高于 YAML 里的 `vars`，但仍在 `env`/`state`/`steps` 这些保留命名空间之下（这些本来就不
是 `vars` 能覆盖的）：
```
context = { ...scenario.vars, ...varsOverride, env, state, steps }
```
`step.save` 在运行时写入的顶层变量不受影响，逻辑不变。

## 实现
- 覆盖值解析统一走 `src/runner/context.ts` 的 `parseVarValue`（CLI 用）与 `src/server/serve.ts` 的
  `parseVarsYaml`（web 用，走 `js-yaml`，天然带类型不需要再猜）。
- `runScenario`/`provision` 都多了一个可选末位参数 `varsOverride?: Record<string, unknown>`，向下透传即可，`describeScenarioRequests`（curl 预览）不涉及。
- 只有 web 端要拼装 YAML 文本时注意：**不要对整段文本先 `.trim()` 再传给 `yaml.load`**——`.trim()`
  只会削掉第一行的前导空格，把首行和后续行的相对缩进搞乱，导致明明合法的缩进块被误判成 YAML 语法错误。
  只用 `.trim()` 判断是否为空文本，解析仍传原始文本。
