#!/usr/bin/env -S npx tsx
import fs from 'node:fs';
import path from 'node:path';
import {
  loadConfig,
  ROOT_DIR,
  SCENARIOS_DIR,
  listProjectsDetailed,
  listProjectNames,
} from './config.js';
import { createApiClient } from './client/http.js';
import { loadCatalog } from './catalog/loader.js';
import { loadScenario, runScenario } from './runner/runner.js';
import { printReport } from './runner/report.js';
import { provision } from './provision/provision.js';
import { startServer } from './server/serve.js';
import { loadState } from './state.js';
import { loadHooks, invokeHook, type HookContext } from './hooks.js';
import { parseVarValue } from './runner/context.js';

/** 从任意位置抽出 --project/-P（或别名 --env/-e）<name>，返回 { project, rest }（已剥离该选项） */
function extractProject(args: string[]): { project?: string; rest: string[] } {
  const rest: string[] = [];
  let project: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project' || a === '-P' || a === '--env' || a === '-e') {
      project = args[++i];
    } else if (a.startsWith('--project=')) {
      project = a.slice('--project='.length);
    } else if (a.startsWith('--env=')) {
      project = a.slice('--env='.length);
    } else {
      rest.push(a);
    }
  }
  return { project, rest };
}

/** 从任意位置抽出可重复的 --var <k>=<v>（或 --var=<k>=<v>），返回 { vars, rest }（已剥离该选项） */
function extractVars(args: string[]): { vars: Record<string, unknown>; rest: string[] } {
  const rest: string[] = [];
  const vars: Record<string, unknown> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    let kv: string | undefined;
    if (a === '--var') {
      kv = args[++i];
    } else if (a.startsWith('--var=')) {
      kv = a.slice('--var='.length);
    } else {
      rest.push(a);
      continue;
    }
    const eq = kv?.indexOf('=') ?? -1;
    if (!kv || eq < 0) {
      console.error(`非法 --var 用法（需 key=value）: ${kv ?? ''}`);
      process.exit(2);
    }
    vars[kv.slice(0, eq)] = parseVarValue(kv.slice(eq + 1));
  }
  return { vars, rest };
}

/**
 * 从场景文件绝对路径推断所属项目：对照已发现的项目名（支持 depth-2 组 `<group>/<env>`），
 * 取按路径 segment 匹配的最长项目名。scenarios/tianyin/dev/x.yaml → tianyin/dev。
 */
function inferProject(absFile: string): string | undefined {
  const rel = path.relative(SCENARIOS_DIR, absFile);
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { project: projectOpt, rest: argsAfterProject } = extractProject(argv);
  const { vars, rest: args } = extractVars(argsAfterProject);
  const [cmd, ...rest] = args;

  switch (cmd) {
    case 'provision': {
      const file = rest[0]; // 可选：自定义铺底场景
      const ok = await provision(file ? path.resolve(file) : undefined, projectOpt, vars);
      process.exit(ok ? 0 : 1);
      break;
    }
    case 'run': {
      if (!rest[0]) {
        console.error('用法: apiit run [--project <name>] [--var k=v ...] <scenario.yaml> [more.yaml ...]');
        process.exit(2);
      }
      const files = rest.map((f) => path.resolve(f));
      // 项目：显式 --project/--env 优先，否则从场景路径推断（要求同属一个项目）
      let project = projectOpt;
      if (!project) {
        const inferred = new Set(files.map(inferProject).filter(Boolean) as string[]);
        if (inferred.size === 1) project = [...inferred][0];
        else if (inferred.size > 1) {
          console.error(`多个场景分属不同项目(${[...inferred].join(', ')})，请用 --project 指定或分开跑。`);
          process.exit(2);
        }
      }
      const cfg = loadConfig({ project, requireCreds: true });
      console.error(`项目: ${cfg.project}  ->  ${cfg.baseUrl}${cfg.apiPrefix}`);
      const client = await createApiClient(cfg);
      const catalog = await loadCatalog(cfg.projectDir);

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

      let allOk = true;
      for (const f of files) {
        const scenario = loadScenario(f);
        const report = await runScenario(client, scenario, catalog, cfg.project, vars);
        printReport(report);
        allOk = allOk && report.ok;
      }

      ctx.state = loadState(cfg.project);
      await invokeHook(hooks, 'afterRun', ctx);
      process.exit(allOk ? 0 : 1);
      break;
    }
    case 'list': {
      await list();
      break;
    }
    case 'serve': {
      // 解析 --port <n>（默认 8787）
      let port = 8787;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '--port' || rest[i] === '-p') port = Number(rest[++i]);
        else if (rest[i].startsWith('--port=')) port = Number(rest[i].slice('--port='.length));
      }
      if (!Number.isInteger(port) || port <= 0) {
        console.error(`非法端口: ${port}`);
        process.exit(2);
      }
      await startServer({ port, project: projectOpt });
      break; // 服务常驻，不 exit
    }
    case undefined:
    case 'help':
    case '-h':
    case '--help':
      usage();
      break;
    default:
      console.error(`未知命令: ${cmd}`);
      usage();
      process.exit(2);
  }
}

async function list(): Promise<void> {
  const { current, projects } = listProjectsDetailed();
  console.log('\n可用项目 (scenarios/<project>/config.json；支持项目组 <group>/<env>):');
  if (!projects.length) console.log('  (无。在 scenarios/<name>/ 放 config.json 即成为一个项目)');
  for (const p of projects) {
    const flags = [p.isDefault ? '(default)' : '', p.name === current ? '←当前' : '']
      .filter(Boolean)
      .join(' ');
    const creds = p.hasCreds ? '凭据✔' : `凭据✘ (需 scenarios/${p.name}/.env)`;
    const hooks = p.hasHooks ? ' hooks✔' : '';
    console.log(
      `  ${p.name.padEnd(16)} ${p.authType.padEnd(6)} ${p.baseUrl || '(未配 baseUrl)'}  ${creds}${hooks}${flags ? '  ' + flags : ''}`
    );
  }
  console.log('  用 --project <name>（或 --env）切换，或设 TY_PROJECT。');

  console.log('\n可用接口 (按项目 catalog；项目无 catalog.ts 时回退引擎示例基座):');
  for (const p of projects) {
    const catalog = await loadCatalog(path.join(SCENARIOS_DIR, p.name));
    console.log(`  [${p.name}]`);
    for (const [key, def] of Object.entries(catalog)) {
      console.log(`    ${key.padEnd(26)} ${def.method.padEnd(4)} ${(def.prefix ?? '') + def.path}`);
      console.log(`    ${''.padEnd(26)} ${def.summary}`);
    }
  }

  const files = collectYaml(SCENARIOS_DIR);
  console.log('\n可用场景 (scenarios/):');
  for (const f of files) console.log(`  ${path.relative(ROOT_DIR, f)}`);
  console.log('');
}

function collectYaml(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const name of fs.readdirSync(d)) {
      const full = path.join(d, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name.endsWith('.yaml') || name.endsWith('.yml')) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function usage(): void {
  console.log(`
接口集测工程 CLI（按项目组织：scenarios/<project>/ 各自带 config.json + .env + provision.yaml + hooks.ts）

用法:
  pnpm start provision [--project <name>] [--var k=v ...] [scenario.yaml]  跑该项目 provision.yaml 铺底，写入 .state/<project>
  pnpm start run [--project <name>] [--var k=v ...] <scenario.yaml> [...] 执行用例（省略 --project 时从场景路径推断项目）
  pnpm start list                                           列出项目、接口目录与场景
  pnpm start serve [--project <name>] [--port 8787]         启动本地控制台（浏览器选项目+场景跑用例）
  pnpm start help                                           显示本帮助

项目: 每个 scenarios/<name>/ 是一个项目(=一个环境/目标)，非密端点/鉴权在 config.json（入库），
      密钥在 scenarios/<name>/.env（gitignore）。选择优先级 --project/--env > TY_PROJECT/TY_ENV >
      config.json 里 default:true 的项目 > 唯一项目。首次: cp scenarios/<name>/.env.example scenarios/<name>/.env 填凭据。

变量覆盖: --var k=v 可重复传，调用时覆盖场景 YAML 里的 vars（不改文件）。value 先按 JSON 尝试解析
      （"3"→数字、"true"→布尔、'{"a":1}'→对象），解析失败则按原始字符串处理，例如：
      pnpm start run scenarios/example/example.yaml --var bizNo=IT-001 --var count=3
`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
