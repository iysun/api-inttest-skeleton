import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from './config.js';

const STATE_DIR = path.join(ROOT_DIR, '.state');

/** 每项目铺底状态文件：.state/<project>/provision.json（缺 project 时回落根路径，向后兼容） */
function stateFile(project?: string): string {
  return project
    ? path.join(STATE_DIR, project, 'provision.json')
    : path.join(STATE_DIR, 'provision.json');
}

/** 读取某项目的铺底状态（不存在返回空对象） */
export function loadState(project?: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(stateFile(project), 'utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 合并写入某项目的铺底状态 */
export function saveState(
  project: string | undefined,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const merged = { ...loadState(project), ...patch };
  const f = stateFile(project);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

export function stateFilePath(project?: string): string {
  return stateFile(project);
}
