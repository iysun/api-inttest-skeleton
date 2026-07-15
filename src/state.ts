import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR } from './config.js';

const STATE_DIR = path.join(ROOT_DIR, '.state');
const STATE_FILE = path.join(STATE_DIR, 'provision.json');

/** 读取铺底状态（不存在返回空对象） */
export function loadState(): Record<string, unknown> {
  try {
    const txt = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(txt) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** 合并写入铺底状态 */
export function saveState(patch: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...loadState(), ...patch };
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

export function stateFilePath(): string {
  return STATE_FILE;
}
