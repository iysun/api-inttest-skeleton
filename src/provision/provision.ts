import path from 'node:path';
import { ApiClient } from '../client/http.js';
import { loadConfig, ROOT_DIR } from '../config.js';
import { loadScenario, runScenario } from '../runner/runner.js';
import { printReport } from '../runner/report.js';
import { saveState, stateFilePath } from '../state.js';

const PROVISION_FIXTURE = path.join(ROOT_DIR, 'scenarios', '_fixtures', 'provision.yaml');

/**
 * 一键铺底：跑 provision 场景，把场景 exports 声明的上下文变量写入
 * .state/provision.json，供后续场景用 ${state.*} 引用。
 * 幂等：以固定前缀的业务主键为幂等键，后端遇既有数据返回既有标识（见 docs/notes）。
 */
export async function provision(
  scenarioFile = PROVISION_FIXTURE,
  envName?: string
): Promise<boolean> {
  const cfg = loadConfig({ env: envName, requireCreds: true });
  console.error(`环境: ${cfg.env}  ->  ${cfg.baseUrl}${cfg.apiPrefix}`);
  const client = new ApiClient(cfg);
  const scenario = loadScenario(scenarioFile);

  const report = await runScenario(client, scenario);
  printReport(report);

  // 收集 exports 到 state
  const exportNames = scenario.exports || [];
  if (exportNames.length) {
    const patch: Record<string, unknown> = {};
    for (const name of exportNames) {
      patch[name] = report.context[name];
    }
    saveState(patch);
    console.log(`已写入铺底状态 -> ${stateFilePath()}`);
    console.log(JSON.stringify(patch, null, 2));
  }

  return report.ok;
}
