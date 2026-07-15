import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  ROOT_DIR,
  SCENARIOS_DIR,
  loadConfigForProject,
  listProjectsDetailed,
  listProjectNames,
  resolveProjectName,
} from '../config.js';
import { ApiClient } from '../client/http.js';
import { loadScenario, runScenario, describeScenarioRequests } from '../runner/runner.js';
import { loadCatalog } from '../catalog/loader.js';
import { loadState } from '../state.js';
import { loadHooks, invokeHook, type HookContext } from '../hooks.js';

const HOST = '127.0.0.1';
const WEB_DIR = path.join(ROOT_DIR, 'web');
const SCEN_DIR = SCENARIOS_DIR;

/**
 * 从场景文件绝对路径推断所属项目：对照已发现项目名（支持 depth-2 组 `<group>/<env>`），
 * 取按路径 segment 匹配的最长项目名。scenarios/tianyin/dev/x.yaml → tianyin/dev。
 */
function inferProject(abs: string): string | undefined {
  const rel = path.relative(SCEN_DIR, abs);
  if (rel.startsWith('..')) return undefined;
  const segs = rel.split(path.sep);
  let best: string | undefined;
  for (const name of listProjectNames()) {
    const nsegs = name.split('/');
    if (nsegs.length <= segs.length && nsegs.every((s, i) => s === segs[i])) {
      if (!best || nsegs.length > best.split('/').length) best = name;
    }
  }
  return best;
}

/** 容错读取场景 yaml 的顶层 name（解析失败/无 name 时返回 undefined，不影响整份列表） */
function readScenarioName(abs: string): string | undefined {
  try {
    const doc = yaml.load(fs.readFileSync(abs, 'utf8')) as { name?: unknown } | null;
    return doc && typeof doc.name === 'string' ? doc.name : undefined;
  } catch {
    return undefined;
  }
}

/** 递归收集 scenarios/ 下的 yaml，返回相对 ROOT_DIR 的 posix 路径 + 场景描述(name) + 所属项目 */
function listScenarioFiles(): { file: string; name?: string; project?: string }[] {
  const out: { file: string; name?: string; project?: string }[] = [];
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d).sort()) {
      const full = path.join(d, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.yaml') || name.endsWith('.yml')) {
        out.push({
          file: path.relative(ROOT_DIR, full).split(path.sep).join('/'),
          name: readScenarioName(full),
          project: inferProject(full),
        });
      }
    }
  };
  walk(SCEN_DIR);
  return out;
}

/** 把请求内的相对路径安全解析为 scenarios/ 下的绝对路径；越界/非法返回 null */
function resolveScenario(file: unknown): string | null {
  if (typeof file !== 'string' || !file.trim()) return null;
  const abs = path.resolve(ROOT_DIR, file);
  if (abs !== SCEN_DIR && !abs.startsWith(SCEN_DIR + path.sep)) return null;
  if (!/\.(ya?ml)$/i.test(abs) || !fs.existsSync(abs)) return null;
  return abs;
}

function sendJson(res: http.ServerResponse, code: number, obj: unknown): void {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c) => {
      buf += c;
      if (buf.length > 5_000_000) reject(new Error('请求体过大'));
    });
    req.on('end', () => {
      if (!buf.trim()) return resolve({});
      try {
        resolve(JSON.parse(buf));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/** 托管 web/ 下静态文件（带路径穿越守卫；'/' 归一到 index.html） */
function serveStatic(res: http.ServerResponse, pathname: string): void {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const abs = path.join(WEB_DIR, rel);
  if (abs !== WEB_DIR && !abs.startsWith(WEB_DIR + path.sep)) {
    sendJson(res, 404, { error: `未找到: ${pathname}` });
    return;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    sendJson(res, 404, { error: `未找到: ${pathname}` });
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream' });
  res.end(fs.readFileSync(abs));
}

/** 选定要跑的项目：显式优先，否则从场景路径推断，再否则解析默认项目 */
function pickProject(explicit: string | undefined, abs: string): string {
  return (explicit && explicit.trim()) || inferProject(abs) || resolveProjectName();
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${HOST}`);
  const p = url.pathname;
  const method = req.method || 'GET';

  if (method === 'GET' && p === '/api/projects') {
    sendJson(res, 200, listProjectsDetailed());
    return;
  }

  if (method === 'GET' && p === '/api/scenarios') {
    sendJson(res, 200, { files: listScenarioFiles() });
    return;
  }

  // 预览场景原文（只读文本，路径穿越守卫同 /api/run）
  if (method === 'GET' && p === '/api/scenario') {
    const file = url.searchParams.get('file');
    const abs = resolveScenario(file);
    if (!abs) {
      sendJson(res, 400, { error: `非法或不存在的场景文件: ${file ?? ''}` });
      return;
    }
    sendJson(res, 200, { file, content: fs.readFileSync(abs, 'utf8') });
    return;
  }

  // 生成场景每步的可运行 curl 所需元数据（干跑：签名但不发请求）
  if (method === 'GET' && p === '/api/curl') {
    const file = url.searchParams.get('file');
    const abs = resolveScenario(file);
    if (!abs) {
      sendJson(res, 400, { error: `非法或不存在的场景文件: ${file ?? ''}` });
      return;
    }
    let cfg;
    try {
      cfg = loadConfigForProject(pickProject(url.searchParams.get('project') || undefined, abs), {
        requireCreds: true,
      });
    } catch (e) {
      sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) });
      return;
    }
    const catalog = await loadCatalog(cfg.projectDir);
    const steps = describeScenarioRequests(new ApiClient(cfg), loadScenario(abs), catalog, cfg.project);
    sendJson(res, 200, { project: cfg.project, file, steps });
    return;
  }

  if (method === 'POST' && p === '/api/run') {
    try {
      const body = (await readJsonBody(req)) as { project?: string; env?: string; file?: string };
      const abs = resolveScenario(body.file);
      if (!abs) {
        sendJson(res, 400, { error: `非法或不存在的场景文件: ${body.file ?? ''}` });
        return;
      }
      let cfg;
      try {
        cfg = loadConfigForProject(pickProject(body.project || body.env, abs), { requireCreds: true });
      } catch (e) {
        // 缺凭据等配置错误：400 + 中文提示（不泄密钥）
        sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) });
        return;
      }
      const client = new ApiClient(cfg);
      const hooks = await loadHooks(cfg.projectDir);
      const ctx: HookContext = {
        config: cfg,
        client,
        project: cfg.project,
        projectDir: cfg.projectDir,
        state: loadState(cfg.project),
        log: (m) => console.error(m),
      };
      await invokeHook(hooks, 'beforeRun', ctx);
      const catalog = await loadCatalog(cfg.projectDir);
      const scenario = loadScenario(abs);
      const report = await runScenario(client, scenario, catalog, cfg.project);
      ctx.state = loadState(cfg.project);
      await invokeHook(hooks, 'afterRun', ctx);
      sendJson(res, 200, {
        project: cfg.project,
        baseUrl: cfg.baseUrl,
        apiPrefix: cfg.apiPrefix,
        file: body.file,
        report,
      });
    } catch (e) {
      sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
    }
    return;
  }

  // 其余 GET 交给静态托管（页面 + web/vendor 资源）
  if (method === 'GET') {
    serveStatic(res, p);
    return;
  }

  sendJson(res, 404, { error: `未找到: ${method} ${p}` });
}

/** 启动本地场景运行控制台（仅监听 127.0.0.1，密钥/签名不出网） */
export async function startServer(opts: { port?: number; project?: string } = {}): Promise<void> {
  const port = opts.port ?? 8787;
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => {
      try {
        sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
      } catch {
        /* 已发送响应头则忽略 */
      }
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, HOST, resolve);
  });
  let current: string | null = opts.project || null;
  if (!current) {
    try {
      current = resolveProjectName();
    } catch {
      current = null;
    }
  }
  console.log(`场景运行控制台已启动:  http://${HOST}:${port}`);
  console.log(`默认项目: ${current ?? '(无)'}；页面按所选场景路径自动推断项目。Ctrl+C 停止。`);
}
