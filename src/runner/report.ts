import type { ScenarioReport } from './runner.js';

const c = {
  reset: '\x1b[0m',
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

/** 打印场景执行结果。verbose=true 时打印失败步骤的请求/响应摘要。 */
export function printReport(report: ScenarioReport, verbose = true): void {
  console.log('');
  console.log(c.bold(`▶ 场景: ${report.name}`));
  for (const s of report.steps) {
    const mark = s.ok ? c.green('✔') : c.red('✘');
    const head = `  ${mark} ${s.id} [${s.api}] code=${s.code} http=${s.httpStatus}`;
    console.log(s.ok ? head : c.red(head));
    for (const a of s.asserts) {
      if (a.ok) {
        console.log(c.gray(`      · ${a.expr}`));
      } else {
        console.log(c.red(`      ✘ ${a.expr}  ${a.detail ?? ''}`));
      }
    }
    if (s.error) console.log(c.red(`      ! ${s.error}`));
    // 失败时额外打印请求体，便于排查
    if (!s.ok && verbose) {
      console.log(c.yellow('      request:'), summarize(s.request));
    }
    // 默认展示接口响应（成功/失败都打印，完整不截断）
    if (verbose && s.response !== undefined) {
      console.log(c.yellow('      response:'), formatResponse(s.response));
    }
  }
  const summary = report.ok
    ? c.green(`✔ 通过 (${report.steps.length} 步)`)
    : c.red(`✘ 失败 (${report.steps.filter((s) => s.ok).length}/${report.steps.length} 步通过)`);
  console.log(`  ${summary}\n`);
}

function summarize(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s.length > 600 ? `${s.slice(0, 600)}…` : s;
  } catch {
    return String(v);
  }
}

/** 完整展示响应：多行 JSON 缩进，每行对齐缩进，便于阅读返回值 */
function formatResponse(v: unknown): string {
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
    return s.replace(/\n/g, '\n      ');
  } catch {
    return String(v);
  }
}
