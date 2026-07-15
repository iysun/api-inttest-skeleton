import { config as loadDotenv, parse as parseDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 工程根目录（src 的上一级） */
export const ROOT_DIR = path.resolve(__dirname, '..');

const ENVIRONMENTS_FILE = path.join(ROOT_DIR, 'environments.json');

/** 鉴权策略类型：none 无鉴权 / bearer 令牌 / hmac 签名（见 src/client/auth.ts） */
export type AuthType = 'none' | 'bearer' | 'hmac';

export interface AppConfig {
  /** 当前生效的环境名 */
  env: string;
  baseUrl: string;
  apiPrefix: string;
  /** 鉴权策略；决定 http 注入哪种鉴权头，以及需要哪些凭据 */
  authType: AuthType;
  /** hmac 用：项目 id（注入头，非签名内容） */
  projectId: string;
  /** hmac 用：签名密钥 */
  projectSecret: string;
  /** bearer 用：访问令牌 */
  token: string;
  timeoutMs: number;
  debugSign: boolean;
}

interface EnvEntry {
  baseUrl?: string;
  apiPrefix?: string;
  /** 该环境的鉴权策略（非密，入库）；可被 .env 的 AUTH_TYPE 覆盖 */
  authType?: AuthType;
}
interface EnvironmentsFile {
  defaultEnv?: string;
  environments?: Record<string, EnvEntry>;
}

export interface LoadConfigOptions {
  /** 环境名；缺省时按 TY_ENV > environments.json.defaultEnv > 'stable' 解析 */
  env?: string;
  /** 是否要求凭据齐全（列目录/校验类命令可传 false 跳过） */
  requireCreds?: boolean;
}

function readEnvironmentsFile(): EnvironmentsFile {
  try {
    return JSON.parse(fs.readFileSync(ENVIRONMENTS_FILE, 'utf8')) as EnvironmentsFile;
  } catch {
    return {};
  }
}

/** 列出可用环境与默认环境（供 list 命令） */
export function listEnvironments(): { defaultEnv: string; names: string[] } {
  const f = readEnvironmentsFile();
  return {
    defaultEnv: f.defaultEnv || 'stable',
    names: Object.keys(f.environments || {}),
  };
}

/** 解析最终环境名：显式入参 > TY_ENV > defaultEnv > 'stable' */
export function resolveEnvName(explicit?: string): string {
  return (
    (explicit && explicit.trim()) ||
    (process.env.TY_ENV && process.env.TY_ENV.trim()) ||
    readEnvironmentsFile().defaultEnv ||
    'stable'
  );
}

/** 每环境密钥文件路径：.env.<name> */
export function envFilePath(envName: string): string {
  return path.join(ROOT_DIR, `.env.${envName}`);
}

/** 归一 authType：非法值回落到 'hmac' */
function normalizeAuthType(raw: string | undefined, fallback: AuthType = 'hmac'): AuthType {
  const t = (raw || '').trim().toLowerCase();
  if (t === 'none' || t === 'bearer' || t === 'hmac') return t;
  return fallback;
}

/** 按 authType 校验凭据齐全，缺失则抛出可诊断错误。none 不需要凭据。 */
function assertCreds(
  cfg: Pick<AppConfig, 'authType' | 'projectId' | 'projectSecret' | 'token'>,
  envName: string
): void {
  const missing: string[] = [];
  if (cfg.authType === 'hmac') {
    if (!cfg.projectId) missing.push('PROJECT_ID');
    if (!cfg.projectSecret) missing.push('PROJECT_SECRET');
  } else if (cfg.authType === 'bearer') {
    if (!cfg.token) missing.push('ACCESS_TOKEN');
  }
  if (missing.length) {
    throw new Error(
      `环境 "${envName}"（authType=${cfg.authType}）缺少必填变量 ${missing.join(' / ')}。` +
        `请在 ${envFilePath(envName)} 中配置（模板：cp .env.example .env.${envName}）。`
    );
  }
}

/**
 * 读取配置。凭据仅来自本地 .env.<name>（不入库），非密端点/鉴权类型来自 environments.json。
 * 字段优先级：.env.<name> 覆盖 > environments.json > 内置默认。
 */
export function loadConfig(opts: LoadConfigOptions = {}): AppConfig {
  const requireCreds = opts.requireCreds ?? true;
  const envName = resolveEnvName(opts.env);

  // 先加载该环境的密钥文件（存在才加载；dotenv 不覆盖已存在的 process.env 键）
  const envFile = envFilePath(envName);
  if (fs.existsSync(envFile)) {
    loadDotenv({ path: envFile });
  }
  // 再以低优先级加载根 .env 作兜底（不覆盖上面已设的键）
  const baseEnvFile = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(baseEnvFile)) {
    loadDotenv({ path: baseEnvFile });
  }

  const envEntry = (readEnvironmentsFile().environments || {})[envName] || {};

  // baseUrl / apiPrefix / authType：.env.<name> 覆盖 > environments.json > 内置默认
  const baseUrlRaw = process.env.BASE_URL || envEntry.baseUrl || '';
  const apiPrefixRaw = process.env.API_PREFIX ?? envEntry.apiPrefix ?? '';
  const authType = normalizeAuthType(process.env.AUTH_TYPE || envEntry.authType);

  const cfg: AppConfig = {
    env: envName,
    baseUrl: baseUrlRaw.replace(/\/+$/, ''),
    apiPrefix: normalizePrefix(apiPrefixRaw),
    authType,
    projectId: (process.env.PROJECT_ID || '').trim(),
    projectSecret: (process.env.PROJECT_SECRET || '').trim(),
    token: (process.env.ACCESS_TOKEN || process.env.TOKEN || '').trim(),
    timeoutMs: Number(process.env.HTTP_TIMEOUT_MS || 30000),
    debugSign: process.env.DEBUG_SIGN === '1',
  };
  if (requireCreds) assertCreds(cfg, envName);
  return cfg;
}

/**
 * 按环境构建配置，**不读写全局 process.env**（供常驻服务多环境切换用）。
 * 与 loadConfig 的差异：直接 dotenv.parse 指定 `.env.<name>`（高优先）+ 根 `.env`（兜底）到局部对象，
 * 避免 dotenv 不覆盖已存在键导致的“上一个环境凭据残留”。字段优先级同 loadConfig。
 */
export function loadConfigForEnv(
  envName: string,
  opts: { requireCreds?: boolean } = {}
): AppConfig {
  const requireCreds = opts.requireCreds ?? true;

  // 根 .env 兜底（低优先），再用 .env.<name> 覆盖（高优先）
  const merged: Record<string, string> = {};
  const baseEnvFile = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(baseEnvFile)) {
    Object.assign(merged, parseDotenv(fs.readFileSync(baseEnvFile)));
  }
  const envFile = envFilePath(envName);
  if (fs.existsSync(envFile)) {
    Object.assign(merged, parseDotenv(fs.readFileSync(envFile)));
  }

  const envEntry = (readEnvironmentsFile().environments || {})[envName] || {};
  const baseUrlRaw = merged.BASE_URL || envEntry.baseUrl || '';
  const apiPrefixRaw = merged.API_PREFIX ?? envEntry.apiPrefix ?? '';
  const authType = normalizeAuthType(merged.AUTH_TYPE || envEntry.authType);

  const cfg: AppConfig = {
    env: envName,
    baseUrl: baseUrlRaw.replace(/\/+$/, ''),
    apiPrefix: normalizePrefix(apiPrefixRaw),
    authType,
    projectId: (merged.PROJECT_ID || '').trim(),
    projectSecret: (merged.PROJECT_SECRET || '').trim(),
    token: (merged.ACCESS_TOKEN || merged.TOKEN || '').trim(),
    timeoutMs: Number(merged.HTTP_TIMEOUT_MS || 30000),
    debugSign: merged.DEBUG_SIGN === '1',
  };
  if (requireCreds) assertCreds(cfg, envName);
  return cfg;
}

export interface EnvDetail {
  name: string;
  baseUrl: string;
  apiPrefix: string;
  authType: AuthType;
  /** 该环境的 .env.<name> 是否存在（仅看文件在不在，不读内容、不含密钥） */
  hasCreds: boolean;
}

/** 供前端/list 用：列出各环境的非密端点与凭据文件是否就绪（绝不返回密钥值） */
export function listEnvironmentsDetailed(): {
  defaultEnv: string;
  current: string;
  envs: EnvDetail[];
} {
  const f = readEnvironmentsFile();
  const entries = f.environments || {};
  const envs: EnvDetail[] = Object.entries(entries).map(([name, e]) => ({
    name,
    baseUrl: e.baseUrl || '',
    apiPrefix: e.apiPrefix ?? '',
    authType: normalizeAuthType(e.authType),
    hasCreds: fs.existsSync(envFilePath(name)),
  }));
  return { defaultEnv: f.defaultEnv || 'stable', current: resolveEnvName(), envs };
}

/** 前缀规整：空 -> ''；否则确保以 / 开头、不以 / 结尾 */
function normalizePrefix(p: string): string {
  const t = p.trim();
  if (!t || t === '/') return '';
  const withLead = t.startsWith('/') ? t : `/${t}`;
  return withLead.replace(/\/+$/, '');
}
