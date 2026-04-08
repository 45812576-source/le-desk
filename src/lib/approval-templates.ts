/**
 * 审批模板类型定义 — 业务内容由后端 /api/approvals/templates 提供
 * 前端不维护模板内容镜像，只定义 TS 类型
 */

export interface EvidenceItem {
  key: string;
  label: string;
  required: boolean;
  auto: boolean;
}

export interface ApprovalTemplate {
  decision_focus: string;
  required_evidence: EvidenceItem[];
  review_checklist: string[];
  approval_criteria: string;
  rejection_criteria: string;
  post_approve?: string;
  post_reject?: string;
}

// ─── 各类型证据详情（替代 Record<string, any>）─────────────────────────────

export interface SkillEvidenceDetail {
  name?: string;
  description?: string;
  scope?: string;
  version?: number;
  change_note?: string;
  system_prompt?: string;
  prev_system_prompt?: string;
  prev_version?: number;
  source_files?: { filename: string; category: string }[];
  knowledge_tags?: string[];
  data_queries?: { query_name: string; query_type: string; table_name: string }[];
  bound_tools?: { id: number; name: string; display_name: string; tool_type: string }[];
}

export interface ToolEvidenceDetail {
  tool_name?: string;
  name?: string;
  description?: string;
  tool_type?: string;
  scope?: string;
}

export interface WebAppEvidenceDetail {
  name?: string;
  description?: string;
  creator_name?: string;
  html_code?: string;
  preview_url?: string;
}

export interface KnowledgeReviewDetail {
  content?: string;
  review_level?: number;
  review_stage?: string;
  sensitivity_flags?: string[];
  auto_review_note?: string;
  entry_id?: number;
}

export interface KnowledgeEditDetail {
  content?: string;
  title?: string;
  name?: string;
  category?: string;
  entry_id?: number;
}

export type ApprovalEvidenceDetail =
  | SkillEvidenceDetail
  | ToolEvidenceDetail
  | WebAppEvidenceDetail
  | KnowledgeReviewDetail
  | KnowledgeEditDetail
  | Record<string, unknown>;  // fallback for data-security types not yet typed

// 条件类型结构化
export interface ApprovalCondition {
  type: "scope_limit" | "effective_until" | "requires_followup_review" | "allowed_targets" | "custom";
  label: string;
  value: string;
  expires_at?: string;
}
