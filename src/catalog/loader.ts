import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENARIOS_DIR } from '../config.js';
import { API_CATALOG as BASE_CATALOG } from './apis.js';
import type { ApiCatalog, ApiDef } from './types-def.js';

const cache = new Map<string, ApiCatalog>();

/**
 * 加载某项目的接口目录（按项目）。从 `projectDir` 逐级向上 walk 到 `SCENARIOS_DIR`，
 * 第一个存在的 `catalog.ts` 生效（导出 `API_CATALOG` 或 default），整体替换基座；
 * 都没有则回退引擎内置基座（src/catalog/apis.ts 的示例 catalog）。
 *
 * 「向上 walk」让项目组（如 scenarios/tianyin/{stable,dev,test}/）共享放在组根
 * scenarios/tianyin/catalog.ts 的同一份接口目录。按 projectDir 缓存。
 */
export async function loadCatalog(projectDir: string): Promise<ApiCatalog> {
  const cached = cache.get(projectDir);
  if (cached) return cached;

  let cat: ApiCatalog = BASE_CATALOG;
  let dir = projectDir;
  // 逐级向上，直到 SCENARIOS_DIR（含）为止；找到第一个 catalog.ts 即止
  while (true) {
    const file = path.join(dir, 'catalog.ts');
    if (fs.existsSync(file)) {
      const mod = (await import(pathToFileURL(file).href)) as {
        API_CATALOG?: ApiCatalog;
        default?: ApiCatalog;
      };
      cat = mod.API_CATALOG ?? mod.default ?? BASE_CATALOG;
      break;
    }
    if (path.resolve(dir) === path.resolve(SCENARIOS_DIR)) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  cache.set(projectDir, cat);
  return cat;
}

/** 从已加载的项目 catalog 取一个接口定义；缺则抛出可用列表 */
export function getApiDef(catalog: ApiCatalog, apiKey: string): ApiDef {
  const def = catalog[apiKey];
  if (!def) {
    throw new Error(`未知 apiKey: "${apiKey}"。可用: ${Object.keys(catalog).join(', ')}`);
  }
  return def;
}
