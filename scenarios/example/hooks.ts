// 本项目的生命周期钩子（可选）：provision / run 前后做「针对本项目/本环境」的定制操作。
// —— 每个 scenarios/<project>/ 目录都可以有自己的 hooks.ts，互不影响。
//
// 典型用途：
//   • bearer 鉴权：在 beforeProvision/beforeRun 里换取/刷新令牌，写回 ctx.config.token
//     （config 与后续请求共享同一对象，改了即刻生效）；
//   • 铺底前置：调用一些本工程 catalog 之外的接口准备数据；
//   • 收尾清理：afterRun 里清理本次产生的临时数据。
//
// 不需要定制时可整份删除本文件——provision/run 会照常运行。

import type { ProjectHooks } from '../../src/hooks.js';

const hooks: ProjectHooks = {
  // 例：bearer 项目在跑用例前换取令牌
  // async beforeRun({ config, client, log }) {
  //   const r = await client.call({ method: 'POST', path: '/oauth/token', body: { /* ... */ } });
  //   config.token = String((r.data as any)?.accessToken ?? '');
  //   log(`已换取令牌，长度=${config.token.length}`);
  // },
  //
  // 例：铺底后打印一下写入的 state
  // async afterProvision({ state, log }) {
  //   log(`铺底完成，state=${JSON.stringify(state)}`);
  // },
};

export default hooks;
