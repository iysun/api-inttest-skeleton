/**
 * 请求/响应 TS 类型，对齐后端 DTO。
 *
 * ★ 这是【项目相关】文件：下面是配合 apis.ts 示例接口的通用类型，接入你的项目时替换为真实 DTO。
 *   建模必填 + 常用字段即可，深层可选项用 `[k: string]: unknown` 兜底（runner 实际发送 YAML 产出的 body，
 *   这些类型主要作为编写辅助与 `pnpm typecheck` 门禁）。
 */

/* ------------------------- 请求 ------------------------- */

/** 新建资源请求 —— POST /v1/resources/create（也用于 batchCreate 的数组元素） */
export interface ResourceCreateRequest {
  /** 必填：业务主键（客户系统唯一标识，幂等主键；建议用固定前缀如 IT-） */
  bizNo: string;
  /** 必填：名称 */
  name: string;
  /** 可选：类型 */
  type?: string;
  /** 可选：备注 */
  remark?: string;
  [k: string]: unknown;
}

/* ------------------------- 响应 ------------------------- */

export interface ResourceCreateResponse {
  resourceId?: string;
  bizNo?: string;
  /** 幂等命中既有数据时可能返回既有标识（按后端语义调整） */
  existResourceId?: string;
  [k: string]: unknown;
}

export interface ResourceBatchItem {
  bizNo: string;
  resourceId: string;
}

export interface ResourceBatchResponse {
  successCount: number;
  failureCount: number;
  successData?: ResourceBatchItem[];
  failureData?: Array<{ bizNo?: string; errorMsg?: string; [k: string]: unknown }>;
}
