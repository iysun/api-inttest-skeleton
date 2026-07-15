import { getPath } from './context.js';

export interface AssertResult {
  expr: string;
  ok: boolean;
  detail?: string;
}

/**
 * 轻量断言 DSL，针对单个响应 scope（含 code/message/data/httpStatus）求值：
 *   "code == 200"
 *   "data.resourceId != null"
 *   "data.successCount == 1"
 *   "message contains 成功"
 *   "data.resourceId"          （单独路径 -> 真值判断）
 * 支持操作符：==、!=、contains、!contains
 */
export function evalAssert(expr: string, scope: unknown): AssertResult {
  const raw = expr.trim();

  const ops: Array<{ token: string; kind: 'eq' | 'ne' | 'contains' | 'ncontains' }> = [
    { token: '!contains', kind: 'ncontains' },
    { token: 'contains', kind: 'contains' },
    { token: '==', kind: 'eq' },
    { token: '!=', kind: 'ne' },
  ];

  for (const op of ops) {
    const idx = findOp(raw, op.token);
    if (idx >= 0) {
      const lhsPath = raw.slice(0, idx).trim();
      const rhsRaw = raw.slice(idx + op.token.length).trim();
      const actual = getPath(scope, lhsPath);
      const expected = parseLiteral(rhsRaw);
      return applyOp(raw, op.kind, actual, expected);
    }
  }

  // 无操作符：真值判断
  const actual = getPath(scope, raw);
  const ok = Boolean(actual) && actual !== 'false';
  return { expr: raw, ok, detail: ok ? undefined : `期望真值，实际=${fmt(actual)}` };
}

function applyOp(
  expr: string,
  kind: 'eq' | 'ne' | 'contains' | 'ncontains',
  actual: unknown,
  expected: unknown
): AssertResult {
  switch (kind) {
    case 'eq': {
      const ok = looseEq(actual, expected);
      return { expr, ok, detail: ok ? undefined : `期望 ${fmt(expected)}，实际 ${fmt(actual)}` };
    }
    case 'ne': {
      const ok = !looseEq(actual, expected);
      return { expr, ok, detail: ok ? undefined : `期望 != ${fmt(expected)}，实际 ${fmt(actual)}` };
    }
    case 'contains': {
      const ok = containsVal(actual, expected);
      return { expr, ok, detail: ok ? undefined : `${fmt(actual)} 不包含 ${fmt(expected)}` };
    }
    case 'ncontains': {
      const ok = !containsVal(actual, expected);
      return { expr, ok, detail: ok ? undefined : `${fmt(actual)} 不应包含 ${fmt(expected)}` };
    }
  }
}

/** 找到操作符位置（前后需有空白或位于边界，避免误匹配路径里的字符） */
function findOp(s: string, token: string): number {
  let from = 0;
  while (true) {
    const idx = s.indexOf(token, from);
    if (idx < 0) return -1;
    const before = s[idx - 1];
    const after = s[idx + token.length];
    const beforeOk = idx === 0 || before === ' ';
    const afterOk = idx + token.length === s.length || after === ' ';
    // == / != 允许紧贴（如 code==200），contains 需要空格边界
    if (token === 'contains' || token === '!contains') {
      if (beforeOk && afterOk) return idx;
    } else {
      return idx;
    }
    from = idx + token.length;
  }
}

function parseLiteral(s: string): unknown {
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s; // 裸字符串
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  return String(a) === String(b);
}

function containsVal(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) return actual.some((x) => looseEq(x, expected));
  if (actual == null) return false;
  return String(actual).includes(String(expected));
}

function fmt(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
