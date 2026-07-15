import crypto from 'node:crypto';

/**
 * OpenAPI 签名：HMAC-SHA256(projectSecret, content) -> 小写 hex。
 * 对齐网关 Esign6GatewayAuthPlugin / HmacSha256.java 的校验逻辑：
 *   - POST/PUT JSON：content = 原始请求体字符串
 *   - GET/DELETE   ：content = 原始 query string（不含前导 '?'）
 * 关键：必须对“实际发送出去的确切字节”签名，因此调用方应先确定字符串，再签名，再发送同一字符串。
 */
export function signContent(secret: string, content: string): string {
  return crypto.createHmac('sha256', secret).update(content, 'utf8').digest('hex');
}

/**
 * 由参数对象构造 query string（保持插入顺序，逐项 encode）。
 * 返回的字符串既用于签名，也用于拼接 URL，保证两者一致。
 */
export function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join('&');
}

/** 日志脱敏：只保留签名前 8 位 */
export function redactSignature(sig: string): string {
  if (!sig) return '';
  return `${sig.slice(0, 8)}…(${sig.length})`;
}
