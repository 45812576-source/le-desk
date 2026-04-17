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

export interface PermissionChangeDetail {
  target_user_id?: number;
  target_user_name?: string;
  domain?: "feature_flag" | "model_grant" | "capability_grant";
  action_key?: string;
  action_label?: string;
  current_value?: unknown;
  target_value?: unknown;
  reason?: string;
  risk_note?: string;
}

export interface OrgMemoryApprovalDetail {
  title?: string;
  summary?: string;
  impact_summary?: string;
  structure_changes?: Array<{
    change_type?: string;
    target_path?: string;
    dept_scope?: string;
    rationale?: string;
    confidence_score?: number;
  }>;
  classification_rules?: Array<{
    target_scope?: string;
    default_folder_path?: string;
    origin_scope?: string;
    allowed_scope?: string;
    usage_purpose?: string;
    redaction_mode?: string;
    rationale?: string;
  }>;
  skill_mounts?: Array<{
    skill_id?: number;
    skill_name?: string;
    target_scope?: string;
    max_allowed_scope?: string;
    required_redaction_mode?: string;
    decision?: string;
    rationale?: string;
  }>;
  approval_impacts?: Array<{
    impact_type?: string;
    target_asset_name?: string;
    risk_reason?: string;
    requires_manual_approval?: boolean;
  }>;
  evidence_refs?: Array<{
    label?: string;
    section?: string;
    excerpt?: string;
  }>;
  applied_config?: {
    id?: number;
    proposal_id?: number;
    approval_request_id?: number;
    status?: string;
    applied_at?: string;
    knowledge_paths?: string[];
    classification_rule_count?: number;
    skill_mount_count?: number;
    conditions?: unknown[];
  } | null;
  config_versions?: Array<{
    id?: number;
    version?: number;
    action?: string;
    status?: string;
    applied_at?: string;
    knowledge_paths?: string[];
    classification_rule_count?: number;
    skill_mount_count?: number;
    note?: string | null;
  }>;
}

export type ApprovalEvidenceDetail =
  | SkillEvidenceDetail
  | ToolEvidenceDetail
  | WebAppEvidenceDetail
  | KnowledgeReviewDetail
  | KnowledgeEditDetail
  | PermissionChangeDetail
  | OrgMemoryApprovalDetail
  | Record<string, unknown>;  // fallback for data-security types not yet typed

// 条件类型结构化
export interface ApprovalCondition {
  type: "scope_limit" | "effective_until" | "requires_followup_review" | "allowed_targets" | "custom";
  label: string;
  value: string;
  expires_at?: string;
}

export const FALLBACK_APPROVAL_TEMPLATES: Record<string, ApprovalTemplate> = {
  org_memory_proposal: {
    decision_focus: "确认组织 Memory 草案是否准确表达组织结构、共享边界与 Skill 挂载建议，并可进入生效流程。",
    required_evidence: [
      { key: "summary", label: "草案摘要", required: true, auto: true },
      { key: "impact_summary", label: "影响范围摘要", required: true, auto: true },
      { key: "evidence_refs", label: "证据链", required: true, auto: true },
    ],
    review_checklist: [
      "结构变化与组织文档证据一致",
      "共享范围扩大项已明确使用意图与匿名化要求",
      "Skill 挂载建议已明确共享上限与内容形态",
    ],
    approval_criteria: "证据充分、边界清晰、建议可执行。",
    rejection_criteria: "证据不足、共享边界不清、或挂载建议与组织事实不符。",
  },
  knowledge_scope_expand: {
    decision_focus: "确认知识共享范围扩张是否有明确业务用途，并采用了最小必要共享形态。",
    required_evidence: [
      { key: "impact_summary", label: "范围扩张说明", required: true, auto: true },
      { key: "classification_rules", label: "共享范围规则", required: true, auto: true },
      { key: "evidence_refs", label: "来源证据", required: true, auto: true },
    ],
    review_checklist: [
      "原始共享范围与目标共享范围均已明确",
      "使用意图与目标范围相匹配",
      "匿名化或摘要化要求已指定",
    ],
    approval_criteria: "共享目标合理，且控制条件完整。",
    rejection_criteria: "范围扩张缺乏必要性，或未定义控制条件。",
  },
  knowledge_redaction_lower: {
    decision_focus: "确认是否允许降低匿名化要求，避免客户、人员或经营信息被不必要地直接暴露。",
    required_evidence: [
      { key: "classification_rules", label: "匿名化策略", required: true, auto: true },
      { key: "approval_impacts", label: "风险影响项", required: true, auto: true },
      { key: "evidence_refs", label: "来源证据", required: true, auto: true },
    ],
    review_checklist: [
      "当前匿名化形态与拟降低后的形态均明确",
      "高敏字段暴露风险已解释",
      "使用场景确有必要读取更低匿名化内容",
    ],
    approval_criteria: "风险说明充分，且存在明确业务必要性与接收范围。",
    rejection_criteria: "匿名化降低后风险过高，且无充分控制条件。",
  },
  skill_mount_org_memory: {
    decision_focus: "确认 Skill 是否可挂载到组织 Memory 推断的知识域，并满足共享上限和匿名化约束。",
    required_evidence: [
      { key: "skill_mounts", label: "Skill 挂载建议", required: true, auto: true },
      { key: "impact_summary", label: "挂载影响摘要", required: true, auto: true },
      { key: "evidence_refs", label: "来源证据", required: true, auto: true },
    ],
    review_checklist: [
      "Skill 服务对象与目标知识域匹配",
      "共享上限与内容形态要求已明确",
      "需审批挂载项已说明风险原因",
    ],
    approval_criteria: "挂载范围、用途和内容形态都清晰，且风险可控。",
    rejection_criteria: "Skill 所需内容超出组织允许边界，或未定义约束条件。",
  },
};
