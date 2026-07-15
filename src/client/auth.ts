import type { AppConfig } from '../config.js';
import { signContent } from './sign.js';

/**
 * 可插拔鉴权策略。给定「实际要发送的字节」content（POST/PUT 为 body 字符串，
 * GET/DELETE 为 query 字符串），返回要注入的鉴权头。
 *
 * ★ 迁移到新项目时，通常只需在这里：
 *   - 若已有内置策略满足，改 environments.json 的 authType 即可；
 *   - 否则新增一个策略并在 getAuthStrategy 里登记（如自定义签名口径 / 加时间戳、nonce 头）。
 * 不变量：http.ts 已保证 content 就是最终发送的确切字节，务必对 content 本身鉴权。
 */
export interface AuthStrategy {
  headers(content: string, cfg: AppConfig): Record<string, string>;
}

/** 无鉴权：不注入任何鉴权头（如内网直连、或鉴权走网关旁路） */
export const noneAuth: AuthStrategy = {
  headers: () => ({}),
};

/** Bearer 令牌：Authorization: Bearer <token>（令牌放 .env.<name> 的 ACCESS_TOKEN） */
export const bearerAuth: AuthStrategy = {
  headers: (_content, cfg) => {
    const h: Record<string, string> = {};
    if (cfg.token) h.Authorization = `Bearer ${cfg.token}`;
    return h;
  },
};

/**
 * HMAC 家族默认实现：对确切发送字节做 HMAC-SHA256 → hex，随 projectId 一并注入头。
 * ↓ 用中性头名 x-project-id / x-signature 作为骨架默认（不绑定任何具体网关）。
 * 具体网关在 scenarios/<项目|组>/auth.ts 里导出自己的 AUTH_STRATEGY 覆盖本默认
 * （由 src/client/auth-loader.ts 逐级向上加载）。
 */
export const hmacAuth: AuthStrategy = {
  headers: (content, cfg) => ({
    'x-project-id': cfg.projectId,
    'x-signature': signContent(cfg.projectSecret, content),
  }),
};

export function getAuthStrategy(t: AppConfig['authType']): AuthStrategy {
  switch (t) {
    case 'none':
      return noneAuth;
    case 'bearer':
      return bearerAuth;
    case 'hmac':
    default:
      return hmacAuth;
  }
}
