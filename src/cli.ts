#!/usr/bin/env -S npx tsx
import fs from 'node:fs';
import path from 'node:path';
import {
  loadConfig,
  ROOT_DIR,
  listEnvironments,
  resolveEnvName,
  envFilePath,
} from './config.js';
import { ApiClient } from './client/http.js';
import { API_CATALOG } from './catalog/apis.js';
import { loadScenario, runScenario } from './runner/runner.js';
import { printReport } from './runner/report.js';
import { provision } from './provision/provision.js';
import { startServer } from './server/serve.js';

/** 从任意位置抽出 --env <name> / -e <name>，返回 { env, rest }（已剥离该选项） */
function extractEnv(args: string[]): { env?: string; rest: string[] } {
  const rest: string[] = [];
  let env: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--env' || a === '-e') {
      env = args[++i];
    } else if (a.startsWith('--env=')) {
      env = a.slice('--env='.length);
    } else {
      rest.push(a);
    }
  }
  return { env, rest };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const { env, rest: args } = extractEnv(argv);
  const [cmd, ...rest] = args;

  switch (cmd) {
    case 'provision': {
      const file = rest[0]; // 可选：自定义铺底场景
      const ok = await provision(file ? path.resolve(file) : undefined, env);
      process.exit(ok ? 0 : 1);
      break;
    }
    case 'run': {
      if (!rest[0]) {
        console.error('用法: tyit run [--env <name>] <scenario.yaml> [more.yaml ...]');
        process.exit(2);
      }
      const cfg = loadConfig({ env, requireCreds: true });
      console.error(`环境: ${cfg.env}  ->  ${cfg.baseUrl}${cfg.apiPrefix}`);
      const client = new ApiClient(cfg);
      let allOk = true;
      for (const f of rest) {
        const scenario = loadScenario(path.resolve(f));
        const report = await runScenario(client, scenario);
        printReport(report);
        allOk = allOk && report.ok;
      }
      process.exit(allOk ? 0 : 1);
      break;
    }
    case 'list': {
      list();
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
      await startServer({ port, env });
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

function list(): void {
  const { defaultEnv, names } = listEnvironments();
  const current = resolveEnvName();
  console.log('\n可用环境 (environments.json):');
  for (const name of names) {
    const isDefault = name === defaultEnv ? ' (default)' : '';
    const isCurrent = name === current ? ' ←当前' : '';
    const hasCreds = fs.existsSync(envFilePath(name)) ? '凭据✔' : `凭据✘ (需 .env.${name})`;
    console.log(`  ${name.padEnd(12)}${isDefault}${isCurrent}  ${hasCreds}`);
  }
  console.log('  用 --env <name> 切换，或设 TY_ENV。');

  console.log('\n可用接口 (apiKey):');
  for (const [key, def] of Object.entries(API_CATALOG)) {
    console.log(`  ${key.padEnd(28)} ${def.method.padEnd(4)} ${def.path}`);
    console.log(`  ${''.padEnd(28)} ${def.summary}`);
  }
  const scenDir = path.join(ROOT_DIR, 'scenarios');
  const files = collectYaml(scenDir);
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
接口集测工程 CLI

用法:
  pnpm start provision [--env <name>] [scenario.yaml]   一键铺底（默认 scenarios/_fixtures/provision.yaml），写入 .state
  pnpm start run [--env <name>] <scenario.yaml> [...]   执行一个或多个 YAML 场景用例
  pnpm start list                                       列出可用环境、接口目录与场景
  pnpm start serve [--env <name>] [--port 8787]         启动本地前端控制台（浏览器选环境+场景跑用例）
  pnpm start help                                       显示本帮助

环境: 端点/鉴权类型在 environments.json（入库），密钥在各自 .env.<name>（gitignore）。
      选择优先级 --env > TY_ENV > environments.json.defaultEnv > stable。
      stable=永久稳定环境(默认); dev=当前迭代环境(url/密钥每迭代变)。
      首次: cp .env.example .env.stable 并按 authType 填凭据（hmac→PROJECT_ID/SECRET，bearer→ACCESS_TOKEN，none→无）。
`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.stack || e.message : String(e));
  process.exit(1);
});
