"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

export type GovernanceStatus =
  | "draft"
  | "suggested"
  | "confirmed"
  | "edited"
  | "generated"
  | "reviewed"
  | "materialized"
  | "executed"
  | "stale";

export type ServiceRoleItem = {
  id: number;
  org_path: string;
  position_name: string;
  position_level?: string | null;
  role_label: string;
  goal_summary?: string | null;
  goal_refs?: string[];
  status: string;
};

export type BoundAssetItem = {
  id: number;
  asset_type: "data_table" | "knowledge_base" | "tool" | string;
  asset_ref_type: string;
  asset_ref_id: number;
  asset_name: string;
  binding_mode: string;
  binding_scope?: Record<string, unknown>;
  sensitivity_summary?: Record<string, unknown>;
  risk_flags?: string[];
  status: string;
};

export type GranularRuleItem = {
  id: number;
  granularity_type: "field" | "chunk" | string;
  target_ref: string;
  target_class?: string | null;
  target_summary?: string | null;
  suggested_policy: string;
  mask_style?: string | null;
  confidence: number;
  confidence_score?: number;
  risk_level?: string | null;
  confirmed: boolean;
  reason_basis?: string[];
  author_override_reason?: string | null;
};

export type RoleAssetPolicyItem = {
  id: number;
  role: {
    id: number;
    label: string;
    position_name: string;
    position_level?: string | null;
    org_path: string;
  };
  asset: {
    id: number;
    asset_type: string;
    name: string;
    risk_flags?: string[];
  };
  allowed: boolean;
  default_output_style: string;
  insufficient_evidence_behavior: string;
  allowed_question_types?: string[];
  forbidden_question_types?: string[];
  policy_source: string;
  review_status: GovernanceStatus | string;
  risk_level?: string | null;
  granular_rules?: GranularRuleItem[];
};

export type RolePolicyBundle = {
  id: number;
  bundle_version: number;
  skill_content_version?: number;
  governance_version: number;
  status: GovernanceStatus | string;
  service_role_count: number;
  bound_asset_count: number;
  deprecated?: boolean;
  read_only?: boolean;
};

export type PermissionDeclaration = {
  id: number;
  version?: number;
  declaration_version?: number;
  bundle_id?: number | null;
  role_policy_bundle_version: number;
  governance_version: number;
  text: string;
  generated_text: string;
  edited_text?: string | null;
  status: GovernanceStatus | string;
  stale_reason_codes?: string[];
  mounted_skill_version?: number | null;
  mounted_at?: string | null;
  mounted?: boolean;
  mount_target?: string | null;
  mount_mode?: string | null;
};

export type GovernanceSummary = {
  skill_id: number;
  governance_version: number;
  bundle: RolePolicyBundle | null;
  declaration: PermissionDeclaration | null;
  summary: {
    service_role_count: number;
    bound_asset_count: number;
    blocking_issues: string[];
    stale: boolean;
  };
};

export type MountContext = {
  skill_id: number;
  workspace_id: number;
  source_mode: string;
  projection_version: number;
  skill_content_version: number;
  roles: ServiceRoleItem[];
  assets: BoundAssetItem[];
  permission_summary: {
    table_count: number;
    knowledge_count: number;
    tool_count: number;
    high_risk_count: number;
    blocking_issues: string[];
  };
  source_refs: Array<Record<string, unknown>>;
  deprecated_bundle?: RolePolicyBundle | null;
};

export type MountedTablePermission = {
  asset_id: number;
  asset_name: string;
  asset_ref: string;
  table_id?: number | null;
  table_name: string;
  view_id?: number | null;
  view_name?: string | null;
  role_group_id?: number | null;
  role_group_name?: string | null;
  grant_id?: number | null;
  grant_mode?: string | null;
  allowed_actions: string[];
  max_disclosure_level?: string | null;
  approval_required: boolean;
  audit_level?: string | null;
  row_access_mode?: string | null;
  field_access_mode?: string | null;
  disclosure_level?: string | null;
  allowed_fields: string[];
  blocked_fields: string[];
  sensitive_fields: string[];
  masked_fields: string[];
  masking_rule_json?: Record<string, unknown>;
  risk_flags?: string[];
  blocking_issues: string[];
  source_refs: Array<Record<string, unknown>>;
};

export type MountedKnowledgePermission = {
  asset_id: number;
  asset_name: string;
  asset_ref: string;
  knowledge_id: number;
  title: string;
  folder_id?: number | null;
  folder_path?: string | null;
  publish_version?: number | null;
  snapshot_desensitization_level?: string | null;
  snapshot_data_type_hits: string[];
  snapshot_mask_rules: Array<Record<string, unknown>>;
  manager_scope_ok: boolean;
  grant_actions: string[];
  risk_flags?: string[];
  blocking_issues: string[];
  source_refs: Array<Record<string, unknown>>;
};

export type MountedToolPermission = {
  asset_id: number;
  asset_name: string;
  asset_ref: string;
  tool_id: number;
  tool_name: string;
  tool_type?: string | null;
  permission_count: number;
  write_capable: boolean;
  risk_flags?: string[];
  blocking_issues: string[];
  source_refs: Array<Record<string, unknown>>;
};

export type MountedRiskControl = {
  type: string;
  severity: string;
  asset_type: string;
  asset_name: string;
  detail: string;
  source_ref?: Record<string, unknown> | null;
};

export type MountedPermissions = {
  skill_id: number;
  source_mode: string;
  projection_version: number;
  table_permissions: MountedTablePermission[];
  knowledge_permissions: MountedKnowledgePermission[];
  tool_permissions: MountedToolPermission[];
  risk_controls: MountedRiskControl[];
  blocking_issues: string[];
  deprecated_bundle?: RolePolicyBundle | null;
};

export type GovernanceReadiness = {
  ready: boolean;
  skill_content_version: number;
  governance_version: number;
  permission_declaration_version?: number | null;
  blocking_issues: string[];
};

export type TestCaseDraftItem = {
  id: number;
  plan_id: number;
  target_role_ref?: number;
  role_label: string;
  asset_ref?: string;
  asset_name: string;
  asset_type: string;
  case_type: string;
  risk_tags: string[];
  prompt: string;
  expected_behavior: string;
  source_refs: Array<Record<string, unknown>>;
  source_verification_status: string;
  data_source_policy?: string;
  status: string;
  granular_refs?: string[];
  controlled_fields: string[];
  edited_by_user?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type PermissionCasePlan = {
  id: number;
  skill_id: number;
  bundle_id?: number | null;
  declaration_id?: number | null;
  plan_version: number;
  skill_content_version: number;
  governance_version: number;
  permission_declaration_version?: number | null;
  status: string;
  focus_mode: string;
  max_cases: number;
  case_count: number;
  blocking_issues: string[];
  cases: TestCaseDraftItem[];
  materialization?: {
    sandbox_session_id: number;
    status: string;
    case_count: number;
    created_at?: string | null;
  } | null;
};

export type PermissionContractReview = {
  status: string;
  plan_id?: number;
  sandbox_session_id?: number;
  report_id?: number;
  policy_vs_declaration: {
    status: string;
    message?: string;
    governance_version?: number;
    permission_declaration_version?: number | null;
    case_count?: number;
    source_unreviewed_count?: number;
    case_type_breakdown?: Record<string, number>;
  };
  declaration_vs_behavior: {
    status: string;
    message?: string;
    passed?: number;
    failed?: number;
    error?: number;
    skipped?: number;
    executed_case_count?: number | null;
    failed_case_count?: number;
    pending_case_count?: number;
    case_type_breakdown?: Record<string, number>;
    issue_type_breakdown?: Record<string, number>;
  };
  overall_permission_contract_health: {
    status: string;
    label: string;
    score?: number;
    level?: string;
    failed_case_count?: number;
    pending_case_count?: number;
    source_unreviewed_count?: number;
  };
  issues: string[];
  case_drilldown?: PermissionContractCaseDrilldown[];
};

export type PermissionContractCaseDrilldown = {
  case_draft_id: number;
  target_role_ref?: number;
  sandbox_case_id?: number | null;
  case_index?: number | null;
  layer: "policy_vs_declaration" | "declaration_vs_behavior" | string;
  issue_type: string;
  role_label: string;
  asset_ref?: string;
  asset_name: string;
  asset_type: string;
  case_type: string;
  draft_status: string;
  prompt: string;
  expected_behavior: string;
  granular_refs?: string[];
  controlled_fields: string[];
  source_refs: Array<Record<string, unknown>>;
  source_verification_status: string;
  data_source_policy?: string;
  sandbox_verdict?: string | null;
  verdict_reason?: string | null;
  verdict_detail?: Record<string, unknown>;
  llm_response_preview?: string;
};

export type GovernanceJobProgress = {
  label: string;
  status: "running" | "refreshing" | "done" | "failed";
  jobId?: string | null;
  detail?: string;
};

type RoleForm = {
  org_path: string;
  position_name: string;
  position_level: string;
};

const emptyRoleForm: RoleForm = {
  org_path: "",
  position_name: "",
  position_level: "",
};

function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    draft: "草稿",
    suggested: "已建议",
    confirmed: "已确认",
    generated: "已生成",
    edited: "已编辑",
    stale: "需重审",
  };
  return status ? labels[status] || status : "未生成";
}

function assetTypeLabel(type: string) {
  const labels: Record<string, string> = {
    data_table: "数据表 / View",
    knowledge_base: "知识库",
    tool: "Tool",
  };
  return labels[type] || type;
}

function sourceVerificationStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    linked: "已关联",
    reviewed: "已复核",
    pending: "待复核",
    missing: "缺来源",
  };
  return status ? labels[status] || status : "未标注";
}

function caseTypeLabel(caseType?: string | null) {
  const labels: Record<string, string> = {
    allow: "允许场景",
    deny: "拒绝场景",
    overreach: "越权诱导",
    insufficient_evidence: "缺证据拒答",
    granular_override: "细则边界",
    boundary_check: "边界检查",
  };
  return caseType ? labels[caseType] || caseType : "未分类";
}

function caseTypeClass(caseType?: string | null) {
  if (caseType === "allow") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (caseType === "deny") return "border-red-300 bg-red-50 text-red-700";
  if (caseType === "overreach") return "border-orange-300 bg-orange-50 text-orange-700";
  if (caseType === "insufficient_evidence") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-blue-300 bg-blue-50 text-blue-700";
}

function contractIssueTypeLabel(issueType: string) {
  const labels: Record<string, string> = {
    passed: "行为符合",
    behavior_overrun: "行为越界",
    execution_error: "执行错误",
    pending_execution: "待执行",
    not_materialized: "未落地",
    sandbox_case_missing: "Sandbox Case 缺失",
    skipped: "已跳过",
  };
  return labels[issueType] || issueType;
}

function contractIssueClass(issueType: string) {
  if (["behavior_overrun", "execution_error", "sandbox_case_missing"].includes(issueType)) {
    return "border-red-300 bg-red-50 text-red-700";
  }
  if (["pending_execution", "not_materialized", "skipped"].includes(issueType)) {
    return "border-amber-300 bg-amber-50 text-amber-700";
  }
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

function jobStatusLabel(status: GovernanceJobProgress["status"]) {
  const labels: Record<GovernanceJobProgress["status"], string> = {
    running: "运行中",
    refreshing: "刷新中",
    done: "已完成",
    failed: "失败",
  };
  return labels[status];
}

function jobProgressPercent(status: GovernanceJobProgress["status"]) {
  if (status === "running") return 45;
  if (status === "refreshing") return 75;
  if (status === "done") return 100;
  return 100;
}

export function GovernanceJobProgressStrip({ job }: { job: GovernanceJobProgress | null }) {
  if (!job) return null;
  const failed = job.status === "failed";
  const done = job.status === "done";
  const percent = jobProgressPercent(job.status);
  return (
    <div className={`border px-3 py-2 space-y-1 ${failed ? "border-red-300 bg-red-50" : done ? "border-emerald-300 bg-emerald-50" : "border-[#00A3C4]/30 bg-[#EBF4F7]"}`}>
      <div className="flex items-center gap-1 flex-wrap">
        {tinyBadge(failed ? "border-red-300 bg-red-50 text-red-700" : done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-[#00A3C4]/40 bg-white text-[#00A3C4]", jobStatusLabel(job.status))}
        <span className={`text-[9px] font-bold ${failed ? "text-red-700" : done ? "text-emerald-700" : "text-[#00A3C4]"}`}>{job.label}</span>
        {job.jobId && <span className="ml-auto text-[8px] text-slate-500 font-mono">{job.jobId}</span>}
      </div>
      {job.detail && <div className={`text-[8px] ${failed ? "text-red-600" : done ? "text-emerald-700" : "text-slate-600"}`}>{job.detail}</div>}
      <div className="h-1.5 bg-white border border-slate-200">
        <div
          className={`h-full transition-all ${failed ? "bg-red-400" : done ? "bg-emerald-400" : "bg-[#00A3C4]"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function outputStyleLabel(style: string) {
  const labels: Record<string, string> = {
    masked_detail: "脱敏明细",
    aggregate: "聚合输出",
    summary: "摘要使用",
    quote_with_source: "带来源引用",
    operation_result: "操作结果",
  };
  return labels[style] || style;
}

function granularPolicyLabel(policy: string) {
  const labels: Record<string, string> = {
    deny: "禁止",
    mask: "脱敏",
    raw: "原值",
    summary_only: "仅摘要",
    masked_quote: "脱敏引用",
    raw_quote: "原文引用",
  };
  return labels[policy] || policy;
}

function maskStyleLabel(maskStyle?: string | null) {
  if (!maskStyle) return "未指定";
  const labels: Record<string, string> = {
    partial: "部分脱敏",
    hash: "哈希",
    summary: "摘要输出",
    masked: "脱敏片段",
    raw: "原样输出",
  };
  return labels[maskStyle] || maskStyle;
}

function blockingIssueLabel(code: string) {
  const labels: Record<string, string> = {
    missing_service_roles: "缺少服务岗位",
    missing_bound_assets: "缺少绑定资产",
    missing_role_asset_policies: "缺少岗位 × 资产策略",
    missing_confirmed_declaration: "缺少可用权限声明",
    stale_governance_bundle: "治理策略已过期",
  };
  return labels[code] || code;
}

function staleReasonLabel(code: string) {
  const labels: Record<string, string> = {
    service_roles_changed: "服务岗位已变更，需重新生成权限声明。",
    bound_assets_changed: "绑定资产已变更，需重新生成权限声明。",
    role_asset_policies_changed: "岗位 × 资产默认策略已变更，需重新生成权限声明。",
    high_risk_rules_changed: "高风险字段 / Chunk 规则已变更，需重新生成权限声明。",
    role_package_changed: "角色 package 已变更，需重新生成权限声明与测试计划。",
    skill_declaration_section_modified: "Skill 中权限声明段落已被手动修改，需重新生成权限声明。",
  };
  return labels[code] || code;
}

function riskClass(risk?: string | null) {
  if (risk === "high") return "border-red-300 bg-red-50 text-red-700";
  if (risk === "medium") return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

export function isHighRiskGranularRule(rule: GranularRuleItem) {
  const targetClass = (rule.target_class || "").toLowerCase();
  return targetClass.includes("sensitive") || targetClass.includes("high_risk") || rule.confidence < 80;
}

function isLowConfidenceRule(rule: GranularRuleItem) {
  return rule.confidence < 80;
}

function granularRuleNeedsOverride(rule: GranularRuleItem, suggestedPolicy: string, maskStyle?: string | null) {
  if (!isHighRiskGranularRule(rule)) return false;
  return ["raw", "raw_quote"].includes(suggestedPolicy) || maskStyle === "raw";
}

export function buildDeclarationStaleReasons(
  declaration: PermissionDeclaration | null,
): string[] {
  if (!declaration || declaration.status !== "stale") return [];
  const backendReasonCodes = declaration.stale_reason_codes || [];
  return backendReasonCodes.map(staleReasonLabel);
}

function tinyBadge(className: string, text: string) {
  return (
    <span className={`text-[7px] font-bold uppercase tracking-widest px-1 py-0.5 border ${className}`}>
      {text}
    </span>
  );
}

type DiffMatrixView = "policy" | "granular";

type DiffMatrixCell = {
  label: string;
  className: string;
};

type DiffMatrixRow = {
  key: string;
  primary: string;
  secondary: string;
  granularityType?: string | null;
  cells: Record<number, DiffMatrixCell>;
};

function diffCellClass(label: string) {
  if (label === "拒绝") return "border-red-300 bg-red-50 text-red-700";
  if (label === "摘要") return "border-blue-300 bg-blue-50 text-blue-700";
  if (label === "聚合") return "border-violet-300 bg-violet-50 text-violet-700";
  if (label === "脱敏") return "border-amber-300 bg-amber-50 text-amber-700";
  if (label === "原值") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  return "border-slate-300 bg-slate-50 text-slate-600";
}

function policyDiffLabel(policy: RoleAssetPolicyItem): string {
  if (!policy.allowed) return "拒绝";
  const style = (policy.default_output_style || "").toLowerCase();
  if (style.includes("aggregate")) return "聚合";
  if (style.includes("mask")) return "脱敏";
  if (style.includes("summary") || style.includes("quote")) return "摘要";
  if (style.includes("raw")) return "原值";
  return "原值";
}

function granularDiffLabel(rule: GranularRuleItem): string {
  const policy = (rule.suggested_policy || "").toLowerCase();
  const maskStyle = (rule.mask_style || "").toLowerCase();
  if (policy === "deny") return "拒绝";
  if (policy === "summary_only" || maskStyle === "summary") return "摘要";
  if (policy === "aggregate") return "聚合";
  if (policy === "mask" || policy === "masked_quote" || ["partial", "hash", "masked"].includes(maskStyle)) return "脱敏";
  if (policy === "raw" || policy === "raw_quote" || maskStyle === "raw") return "原值";
  return "摘要";
}

function buildPolicyDiffRows(policies: RoleAssetPolicyItem[]): DiffMatrixRow[] {
  const grouped = new Map<string, DiffMatrixRow>();
  for (const policy of policies) {
    const key = `asset:${policy.asset.id}`;
    const row = grouped.get(key) || {
      key,
      primary: policy.asset.name,
      secondary: assetTypeLabel(policy.asset.asset_type),
      cells: {},
    };
    const label = policyDiffLabel(policy);
    row.cells[policy.role.id] = {
      label,
      className: diffCellClass(label),
    };
    grouped.set(key, row);
  }
  return Array.from(grouped.values()).sort((left, right) =>
    left.primary.localeCompare(right.primary, "zh-CN"),
  );
}

function buildGranularDiffRows(policies: RoleAssetPolicyItem[]): DiffMatrixRow[] {
  const grouped = new Map<string, DiffMatrixRow>();
  for (const policy of policies) {
    for (const rule of policy.granular_rules || []) {
      const key = `rule:${policy.asset.id}:${rule.granularity_type}:${rule.target_ref}`;
      const row = grouped.get(key) || {
        key,
        primary: rule.target_summary || rule.target_ref,
        secondary: `${policy.asset.name} · ${rule.target_ref}`,
        granularityType: rule.granularity_type,
        cells: {},
      };
      const label = granularDiffLabel(rule);
      row.cells[policy.role.id] = {
        label,
        className: diffCellClass(label),
      };
      grouped.set(key, row);
    }
  }
  return Array.from(grouped.values()).sort((left, right) =>
    `${left.secondary} ${left.primary}`.localeCompare(`${right.secondary} ${right.primary}`, "zh-CN"),
  );
}

function RolePolicyDiffDrawer({
  open,
  onClose,
  policies,
  initialView,
}: {
  open: boolean;
  onClose: () => void;
  policies: RoleAssetPolicyItem[];
  initialView: DiffMatrixView;
}) {
  const [view, setView] = useState<DiffMatrixView>(initialView);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setView(initialView);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialView, open]);

  const roles = useMemo(() => {
    const grouped = new Map<number, RoleAssetPolicyItem["role"]>();
    for (const policy of policies) {
      if (!grouped.has(policy.role.id)) {
        grouped.set(policy.role.id, policy.role);
      }
    }
    return Array.from(grouped.values()).sort((left, right) => left.label.localeCompare(right.label, "zh-CN"));
  }, [policies]);

  const policyRows = useMemo(() => buildPolicyDiffRows(policies), [policies]);
  const granularRows = useMemo(() => buildGranularDiffRows(policies), [policies]);
  const rows = view === "policy" ? policyRows : granularRows;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
      <div
        className="absolute inset-y-0 right-0 w-[min(92vw,1100px)] bg-white border-l border-slate-200 shadow-2xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-200 bg-[#F8FBFD] flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-700">多岗位差异矩阵</div>
            <div className="text-[9px] text-slate-500 mt-1">
              同一对象横向对比不同岗位的默认策略与字段 / Chunk 细则。
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭差异矩阵"
            className="text-[10px] font-bold border border-slate-300 text-slate-500 px-2 py-1"
          >
            关闭
          </button>
        </div>
        <div className="px-4 py-2 border-b border-slate-200 flex items-center gap-1 flex-wrap">
          {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `${roles.length} 个岗位`)}
          {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `${policyRows.length} 条资产默认策略`)}
          {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `${granularRows.length} 条字段 / Chunk 行`)}
          <button
            type="button"
            onClick={() => setView("policy")}
            className={`ml-auto text-[8px] font-bold px-2 py-0.5 border ${view === "policy" ? "border-[#00A3C4]/40 bg-[#EBF4F7] text-[#00A3C4]" : "border-slate-200 text-slate-500"}`}
          >
            资产默认策略
          </button>
          <button
            type="button"
            onClick={() => setView("granular")}
            className={`text-[8px] font-bold px-2 py-0.5 border ${view === "granular" ? "border-[#00A3C4]/40 bg-[#EBF4F7] text-[#00A3C4]" : "border-slate-200 text-slate-500"}`}
          >
            字段 / Chunk 细则
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {rows.length === 0 ? (
            <div className="text-[9px] text-slate-400">当前视图下暂无可对比的差异行。</div>
          ) : (
            <div className="border border-slate-200 overflow-auto">
              <table className="min-w-full border-collapse text-[9px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[240px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-bold text-slate-700">
                      {view === "policy" ? "资产 / 对象" : "字段 / Chunk / 对象"}
                    </th>
                    {roles.map((role) => (
                      <th key={role.id} className="min-w-[140px] border-b border-slate-200 px-3 py-2 text-left font-bold text-slate-700">
                        <div className="truncate">{role.label}</div>
                        <div className="mt-1 text-[8px] font-normal text-slate-400 truncate">{role.org_path}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="align-top">
                      <td className="sticky left-0 z-10 border-r border-b border-slate-200 bg-white px-3 py-2">
                        <div className="font-bold text-slate-800">{row.primary}</div>
                        <div className="mt-1 text-[8px] text-slate-500">{row.secondary}</div>
                        {row.granularityType && (
                          <div className="mt-1">{tinyBadge("border-slate-300 bg-slate-50 text-slate-600", row.granularityType)}</div>
                        )}
                      </td>
                      {roles.map((role) => {
                        const cell = row.cells[role.id];
                        return (
                          <td key={role.id} className="border-b border-slate-200 px-3 py-2">
                            {cell ? tinyBadge(cell.className, cell.label) : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function GovernanceStatusBadge({ summary }: { summary: GovernanceSummary | null }) {
  const declarationStatus = summary?.declaration?.status;
  const stale = summary?.summary.stale || declarationStatus === "stale";
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tinyBadge("border-[#00A3C4]/30 bg-white text-[#00A3C4]", `GOV v${summary?.governance_version ?? 0}`)}
      {tinyBadge(
        stale ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-300 bg-white text-slate-600",
        stale ? "需重审" : statusLabel(declarationStatus),
      )}
      {summary?.summary.blocking_issues.length
        ? tinyBadge("border-red-300 bg-red-50 text-red-700", `${summary.summary.blocking_issues.length} 个门禁`)
        : tinyBadge("border-emerald-300 bg-emerald-50 text-emerald-700", "可测试")}
    </div>
  );
}

function AssetRiskBadge({ flag }: { flag: string }) {
  const isHigh = flag.includes("high") || flag.includes("write") || flag.includes("unresolved");
  return tinyBadge(
    isHigh ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700",
    flag,
  );
}

function mountedIssueLabel(code: string) {
  const mapping: Record<string, string> = {
    missing_skill_data_grant: "缺少 Skill 数据授权",
    skill_data_grant_denied: "Skill 数据授权被拒绝",
    grant_missing_view_binding: "授权缺少视图绑定",
    missing_role_group_binding: "授权未绑定角色组",
    missing_table_permission_policy: "缺少表权限策略",
    missing_skill_knowledge_reference: "缺少知识引用快照",
    manager_scope_not_confirmed: "知识 manager scope 未确认",
    missing_mask_snapshot: "缺少知识脱敏快照",
  };
  return mapping[code] || code;
}

function sourceModeLabel(sourceMode?: string | null) {
  if (sourceMode === "domain_projection") return "源域投影";
  return sourceMode || "未知";
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="border border-slate-200 bg-white">
      <div className="px-3 py-2 border-b border-slate-200 bg-[#F8FBFD] flex items-center gap-2">
        <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-700">{title}</h3>
        <div className="ml-auto">{action}</div>
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function ServiceRolesCard({
  roles,
  loading,
  onSave,
}: {
  roles: ServiceRoleItem[];
  loading: boolean;
  onSave: (roles: ServiceRoleItem[]) => Promise<void>;
}) {
  const [draftRoles, setDraftRoles] = useState<ServiceRoleItem[]>([]);
  const [form, setForm] = useState<RoleForm>(emptyRoleForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftRoles(roles);
  }, [roles]);

  const dirty = JSON.stringify(draftRoles) !== JSON.stringify(roles);

  function addRole() {
    if (!form.org_path.trim() || !form.position_name.trim()) return;
    const positionLevel = form.position_level.trim();
    const role: ServiceRoleItem = {
      id: -Date.now(),
      org_path: form.org_path.trim(),
      position_name: form.position_name.trim(),
      position_level: positionLevel,
      role_label: `${form.position_name.trim()}${positionLevel ? `（${positionLevel}）` : ""}`,
      status: "active",
    };
    setDraftRoles((prev) => {
      const exists = prev.some((item) =>
        item.org_path === role.org_path
        && item.position_name === role.position_name
        && (item.position_level || "") === (role.position_level || ""),
      );
      return exists ? prev : [...prev, role];
    });
    setForm(emptyRoleForm);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(draftRoles);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="服务岗位"
      action={
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="text-[8px] font-bold text-[#00A3C4] border border-[#00A3C4]/40 px-2 py-0.5 disabled:opacity-40"
        >
          {saving ? "保存中" : dirty ? "保存岗位" : "已同步"}
        </button>
      }
    >
      <div className="space-y-2">
        {loading && <p className="text-[9px] text-slate-400">加载岗位中...</p>}
        {!loading && draftRoles.length === 0 && <p className="text-[9px] text-slate-400">还没有选择服务岗位。</p>}
        {draftRoles.map((role) => (
          <div key={`${role.id}:${role.org_path}:${role.position_name}`} className="border border-slate-200 bg-slate-50 p-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold text-slate-800 truncate">{role.role_label}</div>
                <div className="text-[8px] text-slate-500 truncate">{role.org_path}</div>
                {role.goal_summary && (
                  <div className="mt-1 text-[8px] text-slate-600 line-clamp-2">{role.goal_summary}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDraftRoles((prev) => prev.filter((item) => item !== role))}
                className="text-[8px] text-red-500 border border-red-200 px-1 py-0.5"
              >
                删除
              </button>
            </div>
          </div>
        ))}
        <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-slate-100">
          <input
            value={form.org_path}
            onChange={(event) => setForm((prev) => ({ ...prev, org_path: event.target.value }))}
            placeholder="组织路径，如 公司经营发展中心/人力资源部"
            className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4]"
          />
          <div className="grid grid-cols-[1fr_72px_auto] gap-1.5">
            <input
              value={form.position_name}
              onChange={(event) => setForm((prev) => ({ ...prev, position_name: event.target.value }))}
              placeholder="岗位名"
              className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4]"
            />
            <input
              value={form.position_level}
              onChange={(event) => setForm((prev) => ({ ...prev, position_level: event.target.value }))}
              placeholder="职级"
              className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4]"
            />
            <button
              type="button"
              onClick={addRole}
              className="text-[8px] font-bold text-white bg-[#00A3C4] px-2"
            >
              添加
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function BoundAssetsCard({ assets, loading }: { assets: BoundAssetItem[]; loading: boolean }) {
  const groups = useMemo(() => {
    return assets.reduce<Record<string, BoundAssetItem[]>>((acc, asset) => {
      const key = asset.asset_type;
      acc[key] = [...(acc[key] || []), asset];
      return acc;
    }, {});
  }, [assets]);

  return (
    <Card title="绑定资产快照">
      {loading && <p className="text-[9px] text-slate-400">加载资产中...</p>}
      {!loading && assets.length === 0 && <p className="text-[9px] text-slate-400">还没有绑定数据表、知识库或 Tool。</p>}
      <div className="space-y-3">
        {Object.entries(groups).map(([type, group]) => (
          <div key={type} className="space-y-1.5">
            <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">{assetTypeLabel(type)}</div>
            {group.map((asset) => (
              <div key={asset.id} className="border border-slate-200 p-2">
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-bold text-slate-800 truncate">{asset.asset_name}</div>
                  <span className="ml-auto text-[7px] font-bold text-slate-400">{asset.binding_mode}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(asset.risk_flags || []).length === 0
                    ? tinyBadge("border-emerald-300 bg-emerald-50 text-emerald-700", "low risk")
                    : (asset.risk_flags || []).map((flag) => <AssetRiskBadge key={flag} flag={flag} />)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function MountContextCard({
  context,
  loading,
}: {
  context: MountContext | null;
  loading: boolean;
}) {
  const summary = context?.permission_summary;
  return (
    <Card title="源域挂载上下文">
      {loading && <p className="text-[9px] text-slate-400">加载源域上下文中...</p>}
      {!loading && !context && <p className="text-[9px] text-slate-400">尚未生成源域挂载上下文。</p>}
      {context && (
        <div className="space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            {tinyBadge("border-[#00A3C4]/30 bg-white text-[#00A3C4]", sourceModeLabel(context.source_mode))}
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Projection v${context.projection_version}`)}
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Skill v${context.skill_content_version}`)}
            {context.deprecated_bundle && tinyBadge("border-amber-300 bg-amber-50 text-amber-700", `兼容 Bundle v${context.deprecated_bundle.bundle_version}`)}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <div className="border border-slate-200 bg-slate-50 p-2">
              <div className="text-[8px] text-slate-400">岗位</div>
              <div className="text-[11px] font-bold text-slate-800">{context.roles.length}</div>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-2">
              <div className="text-[8px] text-slate-400">表权限</div>
              <div className="text-[11px] font-bold text-slate-800">{summary?.table_count ?? 0}</div>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-2">
              <div className="text-[8px] text-slate-400">知识权限</div>
              <div className="text-[11px] font-bold text-slate-800">{summary?.knowledge_count ?? 0}</div>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-2">
              <div className="text-[8px] text-slate-400">高风险</div>
              <div className="text-[11px] font-bold text-slate-800">{summary?.high_risk_count ?? 0}</div>
            </div>
          </div>
          {summary?.blocking_issues.length ? (
            <div className="space-y-1">
              {summary.blocking_issues.map((issue) => (
                <div key={issue} className="text-[9px] text-amber-700">
                  - {mountedIssueLabel(issue)}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[9px] text-emerald-700">当前上下文已从表权限、知识权限和工具权限域完成投影。</p>
          )}
        </div>
      )}
    </Card>
  );
}

export function MountedPermissionsCard({
  permissions,
  loading,
}: {
  permissions: MountedPermissions | null;
  loading: boolean;
}) {
  return (
    <Card title="已挂载权限摘要">
      {loading && <p className="text-[9px] text-slate-400">加载权限投影中...</p>}
      {!loading && !permissions && <p className="text-[9px] text-slate-400">尚未拿到已挂载权限投影。</p>}
      {permissions && (
        <div className="space-y-3">
          <div className="flex items-center gap-1 flex-wrap">
            {tinyBadge("border-[#00A3C4]/30 bg-white text-[#00A3C4]", sourceModeLabel(permissions.source_mode))}
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `${permissions.table_permissions.length} 张表`)}
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `${permissions.knowledge_permissions.length} 条知识`)}
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `${permissions.tool_permissions.length} 个 Tool`)}
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `${permissions.risk_controls.length} 个控制项`)}
          </div>

          {permissions.blocking_issues.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 p-2 space-y-1">
              <div className="text-[8px] font-bold uppercase tracking-widest text-amber-700">Blocking Issues</div>
              {permissions.blocking_issues.map((issue) => (
                <div key={issue} className="text-[9px] text-amber-700">
                  - {mountedIssueLabel(issue)}
                </div>
              ))}
            </div>
          )}

          {permissions.table_permissions.map((item) => (
            <div key={`table-${item.asset_id}`} className="border border-slate-200 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-slate-800 truncate">{item.table_name}</div>
                  <div className="text-[8px] text-slate-500 truncate">{item.view_name ? `视图：${item.view_name}` : "未绑定视图"}</div>
                </div>
                {tinyBadge(item.grant_mode === "deny" ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-700", item.grant_mode || "unbound")}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {item.max_disclosure_level && tinyBadge("border-blue-300 bg-blue-50 text-blue-700", `Grant ${item.max_disclosure_level}`)}
                {item.disclosure_level && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Policy ${item.disclosure_level}`)}
                {item.row_access_mode && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", item.row_access_mode)}
                {item.field_access_mode && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", item.field_access_mode)}
              </div>
              {item.masked_fields.length > 0 && (
                <div className="text-[8px] text-slate-600">受控字段：{item.masked_fields.join("、")}</div>
              )}
              {item.blocking_issues.length > 0 && (
                <div className="space-y-1">
                  {item.blocking_issues.map((issue) => (
                    <div key={issue} className="text-[8px] text-amber-700">
                      - {mountedIssueLabel(issue)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {permissions.knowledge_permissions.map((item) => (
            <div key={`knowledge-${item.asset_id}`} className="border border-slate-200 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-slate-800 truncate">{item.title}</div>
                  <div className="text-[8px] text-slate-500 truncate">{item.folder_path || "未记录目录路径"}</div>
                </div>
                {tinyBadge(item.manager_scope_ok ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700", item.manager_scope_ok ? "scope ok" : "scope pending")}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {item.snapshot_desensitization_level && tinyBadge("border-blue-300 bg-blue-50 text-blue-700", item.snapshot_desensitization_level)}
                {item.snapshot_data_type_hits.map((hit) => tinyBadge("border-slate-300 bg-slate-50 text-slate-600", String(hit)))}
              </div>
              {item.blocking_issues.length > 0 && (
                <div className="space-y-1">
                  {item.blocking_issues.map((issue) => (
                    <div key={issue} className="text-[8px] text-amber-700">
                      - {mountedIssueLabel(issue)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {permissions.tool_permissions.map((item) => (
            <div key={`tool-${item.asset_id}`} className="border border-slate-200 p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-slate-800 truncate">{item.tool_name}</div>
                  <div className="text-[8px] text-slate-500 truncate">{item.tool_type || "unknown tool type"}</div>
                </div>
                {tinyBadge(item.write_capable ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-700", item.write_capable ? "write-capable" : "read-only")}
              </div>
              <div className="text-[8px] text-slate-600">权限项：{item.permission_count}</div>
            </div>
          ))}

          {permissions.risk_controls.length > 0 && (
            <div className="border border-red-200 bg-red-50 p-2 space-y-1">
              <div className="text-[8px] font-bold uppercase tracking-widest text-red-700">Risk Controls</div>
              {permissions.risk_controls.slice(0, 6).map((item, index) => (
                <div key={`${item.type}-${item.asset_name}-${index}`} className="text-[8px] text-red-700">
                  - {item.asset_name}：{item.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function RoleAssetPolicyCard({
  bundle,
  policies,
  loading,
  running,
  readOnly = false,
  onGenerate,
  onConfirm,
}: {
  bundle: RolePolicyBundle | null;
  policies: RoleAssetPolicyItem[];
  loading: boolean;
  running: boolean;
  readOnly?: boolean;
  onGenerate: () => Promise<void>;
  onConfirm: (policy: RoleAssetPolicyItem) => Promise<void>;
}) {
  const lowRiskSuggested = policies.filter((item) => item.risk_level !== "high" && item.review_status !== "confirmed");
  const [bulkRunning, setBulkRunning] = useState(false);
  const [diffDrawerOpen, setDiffDrawerOpen] = useState(false);

  async function bulkConfirmLowRisk() {
    setBulkRunning(true);
    try {
      for (const policy of lowRiskSuggested) {
        await onConfirm(policy);
      }
    } finally {
      setBulkRunning(false);
    }
  }

  return (
    <Card
      title={readOnly ? "历史岗位 × 资产策略" : "岗位 × 资产默认策略"}
      action={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDiffDrawerOpen(true)}
            disabled={policies.length === 0}
            className="text-[8px] font-bold border border-slate-300 text-slate-600 px-2 py-0.5 disabled:opacity-40"
          >
            查看差异矩阵
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={running}
              className="text-[8px] font-bold text-white bg-[#00A3C4] px-2 py-0.5 disabled:opacity-50"
            >
              {running ? "生成中" : policies.length ? "重新生成" : "生成建议"}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center gap-1 flex-wrap">
          {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Bundle v${bundle?.bundle_version ?? 0}`)}
          {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", statusLabel(bundle?.status))}
          {readOnly && tinyBadge("border-amber-300 bg-amber-50 text-amber-700", "历史兼容 / 只读")}
          {!readOnly && lowRiskSuggested.length > 0 && (
            <button
              type="button"
              onClick={bulkConfirmLowRisk}
              disabled={bulkRunning}
              className="text-[8px] font-bold border border-emerald-300 text-emerald-700 px-2 py-0.5 ml-auto disabled:opacity-50"
            >
              {bulkRunning ? "采纳中" : `批量采纳低风险 ${lowRiskSuggested.length}`}
            </button>
          )}
        </div>
        {loading && <p className="text-[9px] text-slate-400">加载策略中...</p>}
        {!loading && policies.length === 0 && (
          <p className="text-[9px] text-slate-400">
            {readOnly ? "当前没有可展示的历史策略。新的权限边界请以上方源域投影为准。" : "选择岗位并确认资产后，生成默认策略建议。"}
          </p>
        )}
        {policies.map((policy) => (
          <div key={policy.id} className="border border-slate-200 p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-bold text-slate-800 truncate">{policy.role.label}</div>
                <div className="text-[8px] text-slate-500 truncate">{policy.asset.name}</div>
              </div>
              {tinyBadge(riskClass(policy.risk_level), policy.risk_level || "low")}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {tinyBadge(policy.allowed ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-700", policy.allowed ? "允许" : "拒绝")}
              {tinyBadge("border-blue-300 bg-blue-50 text-blue-700", outputStyleLabel(policy.default_output_style))}
              {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", statusLabel(policy.review_status))}
              {(policy.granular_rules?.length || 0) > 0 && tinyBadge("border-amber-300 bg-amber-50 text-amber-700", `${policy.granular_rules?.length} 条细则`)}
              {readOnly ? (
                <span className="ml-auto text-[8px] font-bold text-amber-700">只读历史</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onConfirm(policy)}
                  disabled={policy.review_status === "confirmed"}
                  className="ml-auto text-[8px] font-bold border border-[#00A3C4]/40 text-[#00A3C4] px-2 py-0.5 disabled:opacity-40"
                >
                  {policy.review_status === "confirmed" ? "已确认" : "确认"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <RolePolicyDiffDrawer
        open={diffDrawerOpen}
        onClose={() => setDiffDrawerOpen(false)}
        policies={policies}
        initialView="policy"
      />
    </Card>
  );
}

type GranularRuleViewItem = GranularRuleItem & {
  policyId: number;
  roleLabel: string;
  assetName: string;
  assetType: string;
  policyRiskLevel?: string | null;
};

export function GranularRulesCard({
  policies,
  loading,
  readOnly = false,
  onSaveRule,
}: {
  policies: RoleAssetPolicyItem[];
  loading: boolean;
  readOnly?: boolean;
  onSaveRule: (
    policyId: number,
    ruleId: number,
    payload: {
      suggested_policy?: string;
      mask_style?: string | null;
      confirmed?: boolean;
      author_override_reason?: string | null;
    },
  ) => Promise<void>;
}) {
  const [tab, setTab] = useState<"field" | "chunk">("field");
  const [highRiskOnly, setHighRiskOnly] = useState(true);
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(true);
  const [diffDrawerOpen, setDiffDrawerOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, {
    suggested_policy: string;
    mask_style: string;
    confirmed: boolean;
    author_override_reason: string;
  }>>({});
  const [savingRuleId, setSavingRuleId] = useState<number | null>(null);

  const items = useMemo<GranularRuleViewItem[]>(() => {
    return policies.flatMap((policy) =>
      (policy.granular_rules || []).map((rule) => ({
        ...rule,
        policyId: policy.id,
        roleLabel: policy.role.label,
        assetName: policy.asset.name,
        assetType: policy.asset.asset_type,
        policyRiskLevel: policy.risk_level,
      })),
    );
  }, [policies]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (item.granularity_type !== tab) return false;
      const matchesHighRisk = isHighRiskGranularRule(item);
      const matchesLowConfidence = isLowConfidenceRule(item);
      if (highRiskOnly && lowConfidenceOnly) {
        return matchesHighRisk || matchesLowConfidence;
      }
      if (highRiskOnly) return matchesHighRisk;
      if (lowConfidenceOnly) return matchesLowConfidence;
      return true;
    });
  }, [highRiskOnly, items, lowConfidenceOnly, tab]);

  const groupedItems = useMemo(() => {
    return filtered.reduce<Array<{
      policyId: number;
      roleLabel: string;
      assetName: string;
      assetType: string;
      riskLevel?: string | null;
      rules: GranularRuleViewItem[];
    }>>((acc, item) => {
      const existing = acc.find((group) => group.policyId === item.policyId);
      if (existing) {
        existing.rules.push(item);
        return acc;
      }
      acc.push({
        policyId: item.policyId,
        roleLabel: item.roleLabel,
        assetName: item.assetName,
        assetType: item.assetType,
        riskLevel: item.policyRiskLevel,
        rules: [item],
      });
      return acc;
    }, []);
  }, [filtered]);

  function getDraft(rule: GranularRuleItem) {
    return drafts[rule.id] || {
      suggested_policy: rule.suggested_policy,
      mask_style: rule.mask_style || "",
      confirmed: rule.confirmed,
      author_override_reason: rule.author_override_reason || "",
    };
  }

  function updateDraft(rule: GranularRuleItem, patch: Partial<ReturnType<typeof getDraft>>) {
    setDrafts((prev) => ({
      ...prev,
      [rule.id]: {
        ...(prev[rule.id] || {
          suggested_policy: rule.suggested_policy,
          mask_style: rule.mask_style || "",
          confirmed: rule.confirmed,
          author_override_reason: rule.author_override_reason || "",
        }),
        ...patch,
      },
    }));
  }

  async function saveRule(item: GranularRuleViewItem) {
    const draft = getDraft(item);
    const payload = {
      suggested_policy: draft.suggested_policy,
      mask_style: draft.mask_style || null,
      confirmed: draft.confirmed,
      author_override_reason: draft.author_override_reason.trim() || null,
    };
    setSavingRuleId(item.id);
    try {
      await onSaveRule(item.policyId, item.id, payload);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } finally {
      setSavingRuleId(null);
    }
  }

  return (
    <Card
      title={readOnly ? "历史字段 / Chunk 细则" : "高风险字段 / Chunk 规则"}
      action={
        <button
          type="button"
          onClick={() => setDiffDrawerOpen(true)}
          disabled={policies.every((policy) => (policy.granular_rules || []).length === 0)}
          className="text-[8px] font-bold border border-slate-300 text-slate-600 px-2 py-0.5 disabled:opacity-40"
        >
          查看差异矩阵
        </button>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center gap-1 flex-wrap">
          {readOnly && tinyBadge("border-amber-300 bg-amber-50 text-amber-700", "历史兼容 / 只读")}
          <button
            type="button"
            onClick={() => setTab("field")}
            className={`text-[8px] font-bold px-2 py-0.5 border ${tab === "field" ? "border-[#00A3C4]/40 bg-[#EBF4F7] text-[#00A3C4]" : "border-slate-200 text-slate-500"}`}
          >
            字段规则
          </button>
          <button
            type="button"
            onClick={() => setTab("chunk")}
            className={`text-[8px] font-bold px-2 py-0.5 border ${tab === "chunk" ? "border-[#00A3C4]/40 bg-[#EBF4F7] text-[#00A3C4]" : "border-slate-200 text-slate-500"}`}
          >
            Chunk 规则
          </button>
          <button
            type="button"
            onClick={() => setHighRiskOnly((prev) => !prev)}
            className={`text-[8px] font-bold px-2 py-0.5 border ${highRiskOnly ? "border-red-300 bg-red-50 text-red-700" : "border-slate-200 text-slate-500"}`}
          >
            高风险
          </button>
          <button
            type="button"
            onClick={() => setLowConfidenceOnly((prev) => !prev)}
            className={`text-[8px] font-bold px-2 py-0.5 border ${lowConfidenceOnly ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500"}`}
          >
            低置信度
          </button>
        </div>
        {loading && <p className="text-[9px] text-slate-400">加载细则中...</p>}
        {!loading && readOnly && (
          <p className="text-[9px] text-slate-500">
            旧 granular 细则仅保留历史查看；新的高风险边界请以上方 mounted permissions 与声明 / case plan 为准。
          </p>
        )}
        {!loading && groupedItems.length === 0 && (
          <p className="text-[9px] text-slate-400">当前筛选下没有需要处理的字段 / Chunk 细则。</p>
        )}
        {groupedItems.map((group) => (
          <div key={group.policyId} className="border border-slate-200 bg-slate-50/60">
            <div className="px-2 py-1.5 border-b border-slate-200 flex items-center gap-1 flex-wrap bg-white">
              {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", group.roleLabel)}
              {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", group.assetName)}
              {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", assetTypeLabel(group.assetType))}
              {tinyBadge(riskClass(group.riskLevel), group.riskLevel || "low")}
            </div>
            <div className="divide-y divide-slate-200">
              {group.rules.map((item) => {
                const draft = getDraft(item);
                const options = item.granularity_type === "field"
                  ? [
                      { value: "deny", label: "禁止" },
                      { value: "mask", label: "脱敏" },
                      { value: "raw", label: "原值" },
                    ]
                  : [
                      { value: "deny", label: "禁止" },
                      { value: "summary_only", label: "仅摘要" },
                      { value: "masked_quote", label: "脱敏引用" },
                      { value: "raw_quote", label: "原文引用" },
                    ];
                const maskOptions = item.granularity_type === "field"
                  ? [
                      { value: "", label: "未指定" },
                      { value: "partial", label: "部分脱敏" },
                      { value: "hash", label: "哈希" },
                      { value: "raw", label: "原样输出" },
                    ]
                  : [
                      { value: "", label: "未指定" },
                      { value: "summary", label: "摘要输出" },
                      { value: "masked", label: "脱敏片段" },
                      { value: "raw", label: "原文片段" },
                    ];
                const needsOverride = granularRuleNeedsOverride(item, draft.suggested_policy, draft.mask_style || null);
                const dirty = draft.suggested_policy !== item.suggested_policy
                  || draft.mask_style !== (item.mask_style || "")
                  || draft.confirmed !== item.confirmed
                  || draft.author_override_reason !== (item.author_override_reason || "");
                return (
                  <div key={item.id} className="p-2 space-y-2 bg-white">
                    <div className="flex items-center gap-1 flex-wrap">
                      {isHighRiskGranularRule(item) && tinyBadge("border-red-300 bg-red-50 text-red-700", "高风险")}
                      {isLowConfidenceRule(item) && tinyBadge("border-amber-300 bg-amber-50 text-amber-700", `置信度 ${item.confidence}`)}
                      {item.confirmed && tinyBadge("border-emerald-300 bg-emerald-50 text-emerald-700", "已确认")}
                      {item.target_class && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", item.target_class)}
                    </div>
                    <div className="space-y-1">
                      <div className="text-[9px] font-bold text-slate-800">{item.target_summary || item.target_ref}</div>
                      <div className="text-[8px] text-slate-500 break-all">{item.target_ref}</div>
                      <div className="flex gap-1 flex-wrap">
                        <span className="text-[8px] text-slate-500">当前：{granularPolicyLabel(item.suggested_policy)}</span>
                        <span className="text-[8px] text-slate-400">/</span>
                        <span className="text-[8px] text-slate-500">{maskStyleLabel(item.mask_style)}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 md:grid-cols-[110px_110px_auto]">
                      <select
                        value={draft.suggested_policy}
                        disabled={readOnly}
                        onChange={(event) => updateDraft(item, { suggested_policy: event.target.value })}
                        className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4] bg-white"
                      >
                        {options.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <select
                        value={draft.mask_style}
                        disabled={readOnly}
                        onChange={(event) => updateDraft(item, { mask_style: event.target.value })}
                        className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4] bg-white"
                      >
                        {maskOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-[8px] text-slate-600 border border-slate-200 px-2 py-1">
                        <input
                          type="checkbox"
                          checked={draft.confirmed}
                          disabled={readOnly}
                          onChange={(event) => updateDraft(item, { confirmed: event.target.checked })}
                        />
                        确认此细则
                      </label>
                    </div>
                    {needsOverride && (
                      <textarea
                        value={draft.author_override_reason}
                        disabled={readOnly}
                        onChange={(event) => updateDraft(item, { author_override_reason: event.target.value })}
                        placeholder="高风险放开需填写原因"
                        className="w-full h-20 text-[9px] leading-relaxed border border-amber-300 p-2 outline-none focus:border-[#00A3C4]"
                      />
                    )}
                    {item.reason_basis?.length ? (
                      <div className="text-[8px] text-slate-500">
                        依据：{item.reason_basis.join("；")}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-1">
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => saveRule(item)}
                          disabled={savingRuleId === item.id || !dirty || (needsOverride && !draft.author_override_reason.trim())}
                          className="text-[8px] font-bold text-white bg-[#00A3C4] px-2 py-1 disabled:opacity-40"
                        >
                          {savingRuleId === item.id ? "保存中" : "保存细则"}
                        </button>
                      )}
                      {readOnly && <span className="text-[8px] font-bold text-amber-700">只读历史</span>}
                      <span className="text-[8px] text-slate-400">
                        {granularPolicyLabel(draft.suggested_policy)} / {maskStyleLabel(draft.mask_style || null)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <RolePolicyDiffDrawer
        open={diffDrawerOpen}
        onClose={() => setDiffDrawerOpen(false)}
        policies={policies}
        initialView="granular"
      />
    </Card>
  );
}

export function PermissionDeclarationCard({
  declaration,
  running,
  mounting,
  staleReasons,
  canGenerate,
  onGenerate,
  onMount,
  onSaveText,
}: {
  declaration: PermissionDeclaration | null;
  running: boolean;
  mounting: boolean;
  staleReasons: string[];
  canGenerate: boolean;
  onGenerate: () => Promise<void>;
  onMount: () => Promise<void>;
  onSaveText: (declarationId: number, text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(declaration?.text || "");
    setEditing(false);
  }, [declaration?.id, declaration?.text]);

  async function save() {
    if (!declaration) return;
    setSaving(true);
    try {
      await onSaveText(declaration.id, text);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const isMounted = Boolean(declaration?.mounted_skill_version && declaration?.status === "confirmed");

  return (
    <Card
      title="权限声明"
      action={
        <button
          type="button"
          onClick={onGenerate}
          disabled={running || !canGenerate}
          className="text-[8px] font-bold text-white bg-[#00A3C4] px-2 py-0.5 disabled:opacity-40"
        >
          {running ? "生成中" : declaration ? "重新生成" : "生成声明"}
        </button>
      }
    >
      <div className="space-y-2">
        {!canGenerate && <p className="text-[9px] text-amber-600">需先配置服务岗位并绑定至少一个源域资产。</p>}
        {declaration && (
          <div className="flex items-center gap-1">
            {tinyBadge(declaration.status === "stale" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-emerald-300 bg-emerald-50 text-emerald-700", statusLabel(declaration.status))}
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `策略 v${declaration.role_policy_bundle_version}`)}
            {declaration.mounted_skill_version && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Skill v${declaration.mounted_skill_version}`)}
            <button
              type="button"
              onClick={onMount}
              disabled={mounting || declaration.status === "stale" || isMounted}
              className="text-[8px] font-bold border border-emerald-300 text-emerald-700 px-2 py-0.5 disabled:opacity-40"
            >
              {mounting ? "挂载中" : isMounted ? "已挂载" : "采纳并挂载"}
            </button>
            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="ml-auto text-[8px] font-bold border border-slate-300 text-slate-600 px-2 py-0.5"
            >
              {editing ? "预览" : "轻微编辑"}
            </button>
          </div>
        )}
        {staleReasons.length > 0 && (
          <div className="border border-amber-300 bg-amber-50 p-2 space-y-1">
            <div className="text-[8px] font-bold uppercase tracking-widest text-amber-700">需重审</div>
            {staleReasons.map((reason) => (
              <div key={reason} className="text-[9px] text-amber-700">
                - {reason}
              </div>
            ))}
          </div>
        )}
        {!declaration && <p className="text-[9px] text-slate-400">声明会基于结构化策略生成，并作为 Sandbox 权限测试前置契约。</p>}
        {declaration && editing && (
          <>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="w-full h-48 text-[9px] leading-relaxed border border-slate-200 p-2 outline-none focus:border-[#00A3C4]"
            />
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="text-[8px] font-bold text-white bg-[#00A3C4] px-2 py-1 disabled:opacity-50"
            >
              {saving ? "保存中" : "保存编辑"}
            </button>
          </>
        )}
        {declaration && !editing && (
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-[9px] leading-relaxed bg-slate-50 border border-slate-200 p-2 text-slate-700">
            {declaration.text}
          </pre>
        )}
      </div>
    </Card>
  );
}

export function CasePlanReadinessCard({
  readiness,
  declaration,
  plan,
  generating,
  staleReasons,
  onGenerate,
}: {
  readiness: GovernanceReadiness | null;
  declaration: PermissionDeclaration | null;
  plan: PermissionCasePlan | null;
  generating: boolean;
  staleReasons: string[];
  onGenerate: () => Promise<void>;
}) {
  const blockingIssues = readiness?.blocking_issues || [];
  const ready = Boolean(readiness?.ready);

  return (
    <Card title="Sandbox 权限测试 readiness" action={<Sparkles size={12} className="text-amber-500" />}>
      <div className="space-y-2">
        <div className="flex items-center gap-1 flex-wrap">
          {tinyBadge(ready ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700", ready ? "ready" : "blocked")}
          {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Skill v${readiness?.skill_content_version ?? 1}`)}
          {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Gov v${readiness?.governance_version ?? 0}`)}
          {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Decl v${readiness?.permission_declaration_version ?? declaration?.version ?? 0}`)}
        </div>
        {staleReasons.length > 0 && (
          <div className="space-y-1">
            {staleReasons.map((reason) => (
              <div key={reason} className="text-[9px] text-amber-700">
                - {reason}
              </div>
            ))}
          </div>
        )}
        {blockingIssues.length > 0 ? (
          <div className="space-y-1">
            {blockingIssues.map((issue) => (
              <div key={issue} className="text-[9px] text-amber-700">
                - {blockingIssueLabel(issue)}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[9px] text-emerald-700">
            权限声明已就绪，可以生成风险聚焦测试集。
          </p>
        )}
        <button
          type="button"
          onClick={onGenerate}
          disabled={!ready || generating}
          className="text-[8px] font-bold border border-[#00A3C4]/40 text-[#00A3C4] px-2 py-1 disabled:opacity-40"
        >
          {generating ? "生成中" : plan ? `重新生成测试集 v${plan.plan_version}` : "生成权限测试集"}
        </button>
      </div>
    </Card>
  );
}

export function CaseDraftListCard({
  plan,
  loading,
  onUpdateStatus,
  onSaveDraft,
  onMaterialize,
  materializing,
}: {
  plan: PermissionCasePlan | null;
  loading: boolean;
  onUpdateStatus: (caseId: number, status: string) => Promise<void>;
  onSaveDraft: (
    caseId: number,
    payload: {
      prompt?: string;
      expected_behavior?: string;
      status?: string;
    },
  ) => Promise<void>;
  onMaterialize: () => Promise<void>;
  materializing: boolean;
}) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [sourceDialogCase, setSourceDialogCase] = useState<TestCaseDraftItem | null>(null);
  const [editingCase, setEditingCase] = useState<TestCaseDraftItem | null>(null);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [draftExpectedBehavior, setDraftExpectedBehavior] = useState("");
  const hasMaterializableCases = Boolean((plan?.cases || []).some((item) => item.status !== "discarded"));

  async function update(caseId: number, status: string) {
    setUpdatingId(caseId);
    try {
      await onUpdateStatus(caseId, status);
    } finally {
      setUpdatingId(null);
    }
  }

  function openEditDialog(item: TestCaseDraftItem) {
    setEditingCase(item);
    setDraftPrompt(item.prompt);
    setDraftExpectedBehavior(item.expected_behavior);
  }

  async function saveDraft() {
    if (!editingCase) return;
    setUpdatingId(editingCase.id);
    try {
      await onSaveDraft(editingCase.id, {
        prompt: draftPrompt,
        expected_behavior: draftExpectedBehavior,
      });
      setEditingCase(null);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Card title="权限测试草案列表">
      <div className="space-y-2">
        {loading && <p className="text-[9px] text-slate-400">加载测试草案中...</p>}
        {!loading && !plan && <p className="text-[9px] text-slate-400">生成权限测试集后，这里会出现岗位 × 资产测试草案。</p>}
        {plan && (
          <div className="flex items-center gap-1 flex-wrap">
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Plan v${plan.plan_version}`)}
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `${plan.case_count} cases`)}
            {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", plan.focus_mode)}
            {plan.materialization && tinyBadge("border-emerald-300 bg-emerald-50 text-emerald-700", `Session #${plan.materialization.sandbox_session_id}`)}
            <button
              type="button"
              onClick={onMaterialize}
              disabled={materializing || !hasMaterializableCases}
              className="ml-auto text-[8px] font-bold border border-[#00A3C4]/40 text-[#00A3C4] px-2 py-0.5 disabled:opacity-40"
            >
              {materializing ? "Materialize 中" : "Materialize 到 Sandbox"}
            </button>
          </div>
        )}
        {(plan?.cases || []).map((item) => (
          <div key={item.id} className="border border-slate-200 p-2 space-y-1.5">
            <div className="flex items-center gap-1 flex-wrap">
              {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", item.role_label)}
              {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", item.asset_name)}
              {tinyBadge(caseTypeClass(item.case_type), caseTypeLabel(item.case_type))}
              {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", sourceVerificationStatusLabel(item.source_verification_status))}
              {tinyBadge(item.status === "adopted" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : item.status === "discarded" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700", item.status)}
            </div>
            {item.risk_tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {item.risk_tags.map((tag) => (
                  <span key={tag} className="text-[8px] text-red-600">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="text-[9px] text-slate-700">{item.prompt}</div>
            <div className="text-[8px] text-slate-500">预期行为：{item.expected_behavior}</div>
            {item.controlled_fields.length > 0 && (
              <div className="text-[8px] text-slate-500">受控字段：{item.controlled_fields.join("、")}</div>
            )}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSourceDialogCase(item)}
                className="text-[8px] font-bold border border-slate-300 text-slate-600 px-2 py-0.5"
              >
                查看来源
              </button>
              <button
                type="button"
                onClick={() => openEditDialog(item)}
                className="text-[8px] font-bold border border-slate-300 text-slate-600 px-2 py-0.5"
              >
                编辑草案
              </button>
              <button
                type="button"
                onClick={() => update(item.id, "adopted")}
                disabled={updatingId === item.id || item.status === "adopted"}
                className="text-[8px] font-bold border border-emerald-300 text-emerald-700 px-2 py-0.5 disabled:opacity-40"
              >
                采纳
              </button>
              <button
                type="button"
                onClick={() => update(item.id, "discarded")}
                disabled={updatingId === item.id || item.status === "discarded"}
                className="text-[8px] font-bold border border-red-300 text-red-700 px-2 py-0.5 disabled:opacity-40"
              >
                丢弃
              </button>
            </div>
          </div>
        ))}
      </div>
      {sourceDialogCase && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setSourceDialogCase(null)}>
          <div
            className="absolute inset-y-0 right-0 w-[min(92vw,560px)] bg-white border-l border-slate-200 shadow-2xl flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 bg-[#F8FBFD] flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-700">Source Refs</div>
                <div className="text-[9px] text-slate-500 truncate">{sourceDialogCase.asset_name} · {sourceDialogCase.role_label}</div>
              </div>
              <button
                type="button"
                onClick={() => setSourceDialogCase(null)}
                className="text-[8px] font-bold border border-slate-300 text-slate-600 px-2 py-1"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <div className="flex items-center gap-1 flex-wrap">
                {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", sourceVerificationStatusLabel(sourceDialogCase.source_verification_status))}
                {sourceDialogCase.updated_at && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `更新 ${sourceDialogCase.updated_at.slice(0, 16)}`)}
              </div>
              {sourceDialogCase.source_refs.length === 0 ? (
                <div className="text-[9px] text-slate-400">当前草案还没有来源引用。</div>
              ) : (
                sourceDialogCase.source_refs.map((ref, index) => (
                  <div key={`${String(ref.type || "ref")}-${index}`} className="border border-slate-200 p-3 space-y-1.5">
                    {Object.entries(ref).map(([key, value]) => (
                      <div key={key} className="text-[9px]">
                        <span className="font-bold text-slate-700">{key}：</span>
                        <span className="text-slate-600 break-all">{Array.isArray(value) ? value.join("、") : String(value)}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {editingCase && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setEditingCase(null)}>
          <div
            className="absolute inset-y-0 right-0 w-[min(92vw,620px)] bg-white border-l border-slate-200 shadow-2xl flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 bg-[#F8FBFD] flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-700">编辑测试草案</div>
                <div className="text-[9px] text-slate-500 truncate">{editingCase.asset_name} · {editingCase.role_label}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="text-[8px] font-bold border border-slate-300 text-slate-600 px-2 py-1"
              >
                关闭
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3">
              <div className="space-y-1">
                <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Prompt</div>
                <textarea
                  value={draftPrompt}
                  onChange={(event) => setDraftPrompt(event.target.value)}
                  className="w-full h-32 text-[9px] leading-relaxed border border-slate-200 p-2 outline-none focus:border-[#00A3C4]"
                />
              </div>
              <div className="space-y-1">
                <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Expected Behavior</div>
                <textarea
                  value={draftExpectedBehavior}
                  onChange={(event) => setDraftExpectedBehavior(event.target.value)}
                  className="w-full h-24 text-[9px] leading-relaxed border border-slate-200 p-2 outline-none focus:border-[#00A3C4]"
                />
              </div>
              <div className="border border-amber-300 bg-amber-50 p-3 space-y-1">
                <div className="text-[8px] font-bold uppercase tracking-widest text-amber-700">受控字段只读</div>
                <div className="text-[9px] text-amber-700">
                  {editingCase.controlled_fields.length > 0 ? editingCase.controlled_fields.join("、") : "无受控字段"}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex items-center gap-2">
              <button
                type="button"
                onClick={saveDraft}
                disabled={
                  updatingId === editingCase.id
                  || !draftPrompt.trim()
                  || !draftExpectedBehavior.trim()
                }
                className="text-[8px] font-bold text-white bg-[#00A3C4] px-3 py-1 disabled:opacity-40"
              >
                {updatingId === editingCase.id ? "保存中" : "保存草案"}
              </button>
              <div className="text-[8px] text-slate-400">不允许修改受控字段或来源校验，仅可调整 prompt / 预期行为。</div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

export function PermissionContractReviewCard({
  review,
  loading,
}: {
  review: PermissionContractReview | null;
  loading: boolean;
}) {
  const healthStatus = review?.overall_permission_contract_health.status;
  const drilldown = review?.case_drilldown || [];
  const behaviorIssues = drilldown.filter((item) =>
    ["behavior_overrun", "execution_error", "sandbox_case_missing"].includes(item.issue_type),
  );
  const pendingCases = drilldown.filter((item) =>
    ["pending_execution", "not_materialized", "skipped"].includes(item.issue_type),
  );
  const passedCases = drilldown.filter((item) => item.issue_type === "passed");
  const healthClass = healthStatus === "healthy"
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : healthStatus === "needs_fix" || healthStatus === "error"
      ? "border-red-300 bg-red-50 text-red-700"
      : "border-amber-300 bg-amber-50 text-amber-700";

  return (
    <Card title="Part 2 权限契约复核">
      <div className="space-y-2">
        {loading && <p className="text-[9px] text-slate-400">加载复核结果中...</p>}
        {!loading && !review && <p className="text-[9px] text-slate-400">Materialize 到 Sandbox 后，这里会展示权限契约健康状态。</p>}
        {review && (
          <>
            <div className="flex items-center gap-1 flex-wrap">
              {tinyBadge(healthClass, review.overall_permission_contract_health.label)}
              {typeof review.overall_permission_contract_health.score === "number" && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Score ${review.overall_permission_contract_health.score}`)}
              {review.sandbox_session_id && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Session #${review.sandbox_session_id}`)}
              {review.report_id && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Report #${review.report_id}`)}
              {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", review.status)}
            </div>
            <div className="border border-slate-200 p-2 space-y-1">
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Policy vs Declaration</div>
              <div className="text-[9px] text-slate-700">
                {review.policy_vs_declaration.message || review.policy_vs_declaration.status}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `${review.policy_vs_declaration.case_count ?? drilldown.length} cases`)}
                {typeof review.policy_vs_declaration.source_unreviewed_count === "number" && review.policy_vs_declaration.source_unreviewed_count > 0 && (
                  tinyBadge("border-amber-300 bg-amber-50 text-amber-700", `${review.policy_vs_declaration.source_unreviewed_count} 个来源待复核`)
                )}
                {Object.entries(review.policy_vs_declaration.case_type_breakdown || {}).map(([caseType, count]) => (
                  tinyBadge(caseTypeClass(caseType), `${caseTypeLabel(caseType)} ${count}`)
                ))}
              </div>
            </div>
            <div className="border border-slate-200 p-2 space-y-1">
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Declaration vs Behavior</div>
              {review.declaration_vs_behavior.message ? (
                <div className="text-[9px] text-slate-700">{review.declaration_vs_behavior.message}</div>
              ) : (
                <div className="flex items-center gap-2 text-[8px] text-slate-600">
                  <span className="text-emerald-700">通过 {review.declaration_vs_behavior.passed ?? 0}</span>
                  <span className="text-red-700">失败 {review.declaration_vs_behavior.failed ?? 0}</span>
                  <span className="text-amber-700">错误 {review.declaration_vs_behavior.error ?? 0}</span>
                  <span className="text-slate-400">跳过 {review.declaration_vs_behavior.skipped ?? 0}</span>
                </div>
              )}
              <div className="flex items-center gap-1 flex-wrap">
                {tinyBadge("border-red-300 bg-red-50 text-red-700", `行为越界 ${review.declaration_vs_behavior.failed_case_count ?? behaviorIssues.length}`)}
                {tinyBadge("border-amber-300 bg-amber-50 text-amber-700", `待执行 ${review.declaration_vs_behavior.pending_case_count ?? pendingCases.length}`)}
                {tinyBadge("border-emerald-300 bg-emerald-50 text-emerald-700", `通过 ${passedCases.length}`)}
                {Object.entries(review.declaration_vs_behavior.case_type_breakdown || {}).map(([caseType, count]) => (
                  tinyBadge(caseTypeClass(caseType), `${caseTypeLabel(caseType)} ${count}`)
                ))}
              </div>
            </div>
            {drilldown.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Case Drill-down</div>
                {drilldown.map((item) => (
                  <details key={`${item.case_draft_id}:${item.sandbox_case_id || "draft"}`} className="border border-slate-200 bg-white">
                    <summary className="cursor-pointer px-2 py-1.5 flex items-center gap-1 flex-wrap">
                      {tinyBadge(contractIssueClass(item.issue_type), contractIssueTypeLabel(item.issue_type))}
                      {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", item.role_label)}
                      {tinyBadge("border-slate-300 bg-slate-50 text-slate-600", item.asset_name)}
                      {tinyBadge(caseTypeClass(item.case_type), caseTypeLabel(item.case_type))}
                      {item.case_index != null && tinyBadge("border-slate-300 bg-slate-50 text-slate-600", `Case #${item.case_index}`)}
                    </summary>
                    <div className="px-2 pb-2 space-y-1.5 text-[8px] text-slate-600">
                      <div>
                        <span className="font-bold text-slate-700">预期：</span>
                        {item.expected_behavior}
                      </div>
                      <div>
                        <span className="font-bold text-slate-700">输入：</span>
                        {item.prompt}
                      </div>
                      {item.controlled_fields.length > 0 && (
                        <div>
                          <span className="font-bold text-slate-700">受控字段：</span>
                          {item.controlled_fields.join("、")}
                        </div>
                      )}
                      {Boolean(item.verdict_detail?.main_issue) && (
                        <div className="text-red-700">
                          <span className="font-bold">主要问题：</span>
                          {String(item.verdict_detail?.main_issue)}
                        </div>
                      )}
                      {item.llm_response_preview && (
                        <div className="border border-slate-100 bg-slate-50 p-2 whitespace-pre-wrap">
                          {item.llm_response_preview}
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
            {review.issues.length > 0 && (
              <div className="text-[8px] text-amber-700">
                问题：{review.issues.join("、")}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
