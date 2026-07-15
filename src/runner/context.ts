/** 上下文求值与 ${...} 插值 */

/** 按点路径从对象取值，如 getPath(obj, 'data.successData.0.userCode') */
export function getPath(scope: unknown, dotPath: string): unknown {
  const parts = dotPath.split('.').map((p) => p.trim()).filter(Boolean);
  let cur: unknown = scope;
  for (const p of parts) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(p);
      cur = Number.isInteger(idx) ? cur[idx] : undefined;
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}

const FULL_EXPR = /^\$\{([^}]+)\}$/;
const EMBED_EXPR = /\$\{([^}]+)\}/g;

/**
 * 递归插值。
 * - 若字符串整体是 "${path}"，替换为解析出的原始值（可为对象/数组/数字/字符串）。
 * - 否则对字符串内嵌的 ${path} 做文本替换。
 * - 数组/对象递归处理；其它类型原样返回。
 */
export function interpolate(value: unknown, scope: Record<string, unknown>): unknown {
  if (typeof value === 'string') {
    const full = value.match(FULL_EXPR);
    if (full) {
      const resolved = getPath(scope, full[1].trim());
      return resolved === undefined ? '' : resolved;
    }
    return value.replace(EMBED_EXPR, (_m, expr) => {
      const r = getPath(scope, String(expr).trim());
      return r === undefined || r === null ? '' : String(r);
    });
  }
  if (Array.isArray(value)) {
    return value.map((v) => interpolate(v, scope));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = interpolate(v, scope);
    }
    return out;
  }
  return value;
}
