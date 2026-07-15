import { config as loadDotenv, parse as parseDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 工程根目录（src 的上一级） */
export const ROOT_DIR = path.resolve(__dirname, '..');
/** 项目根目录：scenarios/ 下每个子目录（含 config.json）是一个自包含项目 */
export const SCENARIOS_DIR = path.join(ROOT_DIR, 'scenarios');

/** 鉴权策略类型：none 无鉴权 / bearer 令牌 / hmac 签名（见 src/client/auth.ts） */
export type AuthType = 'none' | 'bearer' | 'hmac';

export interface AppConfig {
  /** 当前生效的项目名（= scenarios/<project>/） */
  project: string;
  /** 该项目目录绝对路径 */
  projectDir: string;
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

/** 每项目非密配置 scenarios/<project>/config.json（入库） */
interface ProjectConfigFile {
  baseUrl?: string;
  apiPrefix?: string;
  authType?: AuthType;
  /** 是否为默认项目（缺省选择时命中） */
  default?: boolean;
}

export interface LoadConfigOptions {
  /** 项目名；缺省时按 TY_PROJECT/TY_ENV > default 项目 > 唯一项目 解析 */
  project?: string;
  /** project 的别名（向后兼容 --env） */
  env?: string;
  /** 是否要求凭据齐全（列目录/校验类命令可传 false 跳过） */
  requireCreds?: boolean;
}

function projectDirPath(name: string): string {
  return path.join(SCENARIOS_DIR, name);
}
function projectConfigPath(name: string): string {
  return path.join(projectDirPath(name), 'config.json');
}
/** 每项目密钥文件：scenarios/<project>/.env */
export function projectEnvFile(name: string): string {
  return path.join(projectDirPath(name), '.env');
}

function readProjectConfig(name: string): ProjectConfigFile {
  try {
    return JSON.parse(fs.readFileSync(projectConfigPath(name), 'utf8')) as ProjectConfigFile;
  } catch {
    return {};
  }
}

/** 扫描 scenarios 下每个含 config.json 的子目录，得到项目名列表 */
export function listProjectNames(): string[] {
  try {
    return fs
      .readdirSync(SCENARIOS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(projectConfigPath(d.name)))
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}

/** 解析项目名：显式 > TY_PROJECT/TY_ENV > default:true > 唯一项目 > 报错并列出可选 */
export function resolveProjectName(explicit?: string): string {
  const ex =
    (explicit && explicit.trim()) ||
    (process.env.TY_PROJECT && process.env.TY_PROJECT.trim()) ||
    (process.env.TY_ENV && process.env.TY_ENV.trim());
  if (ex) return ex;
  const names = listProjectNames();
  const def = names.find((n) => readProjectConfig(n).default);
  if (def) return def;
  if (names.length === 1) return names[0];
  throw new Error(
    `未指定项目，且无默认项目。可用项目：${names.join(', ') || '(无)'}。` +
      `用 --project <name>（或 --env）指定，或在某项目 config.json 设 "default": true。`
  );
}
/** 向后兼容别名 */
export const resolveEnvName = resolveProjectName;

/** 归一 authType：非法值回落到 'hmac' */
export function normalizeAuthType(raw: string | undefined, fallback: AuthType = 'hmac'): AuthType {
  const t = (raw || '').trim().toLowerCase();
  if (t === 'none' || t === 'bearer' || t === 'hmac') return t;
  return fallback;
}

/** 按 authType 校验凭据齐全，缺失则抛出可诊断错误。none 不需要凭据。 */
function assertCreds(
  cfg: Pick<AppConfig, 'authType' | 'projectId' | 'projectSecret' | 'token' | 'project'>
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
      `项目 "${cfg.project}"（authType=${cfg.authType}）缺少必填变量 ${missing.join(' / ')}。` +
        `请在 ${projectEnvFile(cfg.project)} 中配置（模板：cp scenarios/${cfg.project}/.env.example scenarios/${cfg.project}/.env）。`
    );
  }
}

/** 由「取值函数」构建配置。字段优先级：.env 覆盖 > config.json > 内置默认。 */
function buildConfig(
  project: string,
  get: (k: string) => string | undefined,
  requireCreds: boolean
): AppConfig {
  const pc = readProjectConfig(project);
  const baseUrlRaw = get('BASE_URL') || pc.baseUrl || '';
  const apiPrefixRaw = get('API_PREFIX') ?? pc.apiPrefix ?? '';
  const authType = normalizeAuthType(get('AUTH_TYPE') || pc.authType);

  const cfg: AppConfig = {
    project,
    projectDir: projectDirPath(project),
    baseUrl: baseUrlRaw.replace(/\/+$/, ''),
    apiPrefix: normalizePrefix(apiPrefixRaw),
    authType,
    projectId: (get('PROJECT_ID') || '').trim(),
    projectSecret: (get('PROJECT_SECRET') || '').trim(),
    token: (get('ACCESS_TOKEN') || get('TOKEN') || '').trim(),
    timeoutMs: Number(get('HTTP_TIMEOUT_MS') || 30000),
    debugSign: get('DEBUG_SIGN') === '1',
  };
  if (requireCreds) assertCreds(cfg);
  return cfg;
}

/**
 * 读取配置。凭据仅来自项目本地 scenarios/<project>/.env（不入库），
 * 非密端点/鉴权类型来自 scenarios/<project>/config.json。
 */
export function loadConfig(opts: LoadConfigOptions = {}): AppConfig {
  const requireCreds = opts.requireCreds ?? true;
  const project = resolveProjectName(opts.project ?? opts.env);
  const envFile = projectEnvFile(project);
  if (fs.existsSync(envFile)) loadDotenv({ path: envFile });
  return buildConfig(project, (k) => process.env[k], requireCreds);
}

/**
 * 按项目构建配置，**不读写全局 process.env**（供常驻服务多项目切换用）。
 * 直接 dotenv.parse 项目 `.env` 到局部对象，避免上一个项目凭据残留。
 */
export function loadConfigForProject(
  name: string,
  opts: { requireCreds?: boolean } = {}
): AppConfig {
  const requireCreds = opts.requireCreds ?? true;
  const project = resolveProjectName(name);
  const merged: Record<string, string> = {};
  const envFile = projectEnvFile(project);
  if (fs.existsSync(envFile)) Object.assign(merged, parseDotenv(fs.readFileSync(envFile)));
  return buildConfig(project, (k) => merged[k], requireCreds);
}
/** 向后兼容别名 */
export const loadConfigForEnv = loadConfigForProject;

export interface ProjectDetail {
  name: string;
  baseUrl: string;
  apiPrefix: string;
  authType: AuthType;
  /** 该项目 .env 是否存在（仅看文件在不在，不读内容、不含密钥） */
  hasCreds: boolean;
  /** 该项目是否有 hooks.ts */
  hasHooks: boolean;
  isDefault: boolean;
}

/** 供前端/list 用：列出各项目的非密端点与凭据文件是否就绪（绝不返回密钥值） */
export function listProjectsDetailed(): {
  defaultProject: string | null;
  current: string | null;
  projects: ProjectDetail[];
} {
  const names = listProjectNames();
  const projects: ProjectDetail[] = names.map((name) => {
    const pc = readProjectConfig(name);
    return {
      name,
      baseUrl: pc.baseUrl || '',
      apiPrefix: pc.apiPrefix ?? '',
      authType: normalizeAuthType(pc.authType),
      hasCreds: fs.existsSync(projectEnvFile(name)),
      hasHooks: fs.existsSync(path.join(projectDirPath(name), 'hooks.ts')),
      isDefault: !!pc.default,
    };
  });
  const defaultProject =
    projects.find((p) => p.isDefault)?.name || (names.length === 1 ? names[0] : null);
  let current: string | null = null;
  try {
    current = resolveProjectName();
  } catch {
    current = null;
  }
  return { defaultProject, current, projects };
}

/** 前缀规整：空 -> ''；否则确保以 / 开头、不以 / 结尾 */
function normalizePrefix(p: string): string {
  const t = p.trim();
  if (!t || t === '/') return '';
  const withLead = t.startsWith('/') ? t : `/${t}`;
  return withLead.replace(/\/+$/, '');
}
