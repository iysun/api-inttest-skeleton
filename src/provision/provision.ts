import fs from 'node:fs';
import path from 'node:path';
import { createApiClient } from '../client/http.js';
import { loadConfig } from '../config.js';
import { loadScenario, runScenario } from '../runner/runner.js';
import { loadCatalog } from '../catalog/loader.js';
import { printReport } from '../runner/report.js';
import { loadState, saveState, stateFilePath } from '../state.js';
import { loadHooks, invokeHook, type HookContext } from '../hooks.js';

/**
 * 一键铺底（按项目）：跑该项目的 scenarios/<project>/provision.yaml，把场景 exports
 * 声明的上下文变量写入 .state/<project>/provision.json，供后续场景用 ${state.*} 引用。
 * 前后自动调用项目 hooks.ts 的 beforeProvision / afterProvision。
 * 幂等：以固定前缀的业务主键为幂等键，后端遇既有数据返回既有标识（见 docs/notes）。
 */
export async function provision(
  scenarioFile?: string,
  projectName?: string,
  varsOverride?: Record<string, unknown>
): Promise<boolean> {
  const cfg = loadConfig({ project: projectName, requireCreds: true });
  console.error(`项目: ${cfg.project}  ->  ${cfg.baseUrl}${cfg.apiPrefix}`);
  const client = await createApiClient(cfg);

  const file = scenarioFile ?? path.join(cfg.projectDir, 'provision.yaml');
  const hooks = await loadHooks(cfg.projectDir);
  const ctx: HookContext = {
    config: cfg,
    client,
    project: cfg.project,
    projectDir: cfg.projectDir,
    state: loadState(cfg.project),
    log: (m) => console.error(m),
  };

  await invokeHook(hooks, 'beforeProvision', ctx);

  if (!fs.existsSync(file)) {
    console.error(`（该项目无 ${path.relative(cfg.projectDir, file)}，跳过铺底场景）`);
    await invokeHook(hooks, 'afterProvision', ctx);
    return true;
  }

  const scenario = loadScenario(file);
  const catalog = await loadCatalog(cfg.projectDir);
  const report = await runScenario(client, scenario, catalog, cfg.project, varsOverride);
  printReport(report);

  // 收集 exports 到该项目 state
  const exportNames = scenario.exports || [];
  if (exportNames.length) {
    const patch: Record<string, unknown> = {};
    for (const name of exportNames) {
      patch[name] = report.context[name];
    }
    saveState(cfg.project, patch);
    console.log(`已写入铺底状态 -> ${stateFilePath(cfg.project)}`);
    console.log(JSON.stringify(patch, null, 2));
  }

  ctx.state = loadState(cfg.project);
  await invokeHook(hooks, 'afterProvision', ctx);
  return report.ok;
}
