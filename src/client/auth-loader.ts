import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SCENARIOS_DIR, type AuthType } from '../config.js';
import { type AuthStrategy, getAuthStrategy } from './auth.js';

const cache = new Map<string, AuthStrategy>();

/**
 * 加载某项目的鉴权策略（按项目）。从 `projectDir` 逐级向上 walk 到 `SCENARIOS_DIR`，
 * 第一个存在的 `auth.ts` 生效（导出 `AUTH_STRATEGY` 或 default），整体替换骨架内置策略；
 * 都没有则回退骨架内置策略（按 authType 选 none/bearer/hmac，见 src/client/auth.ts）。
 *
 * 「向上 walk」让项目组（如 scenarios/tianyin/{stable,dev,test}/）共享放在组根
 * scenarios/tianyin/auth.ts 的同一份鉴权口径（组内各环境相同的头名/签名算法）。按 projectDir 缓存。
 */
export async function loadAuthStrategy(
  projectDir: string,
  authType: AuthType
): Promise<AuthStrategy> {
  const cached = cache.get(projectDir);
  if (cached) return cached;

  let strategy: AuthStrategy = getAuthStrategy(authType);
  let dir = projectDir;
  // 逐级向上，直到 SCENARIOS_DIR（含）为止；找到第一个 auth.ts 即止
  while (true) {
    const file = path.join(dir, 'auth.ts');
    if (fs.existsSync(file)) {
      const mod = (await import(pathToFileURL(file).href)) as {
        AUTH_STRATEGY?: AuthStrategy;
        default?: AuthStrategy;
      };
      strategy = mod.AUTH_STRATEGY ?? mod.default ?? strategy;
      break;
    }
    if (path.resolve(dir) === path.resolve(SCENARIOS_DIR)) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  cache.set(projectDir, strategy);
  return strategy;
}
