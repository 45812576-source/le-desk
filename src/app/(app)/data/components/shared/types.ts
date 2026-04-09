// ─── 能力分层 ─────────────────────────────────────────────────────────────────
export interface TableCapabilities {
  can_edit_schema: boolean;
  can_edit_rows: boolean;
  can_edit_meta: boolean;
  can_export: boolean;
}

export function getTableCapabilities(sourceType: string): TableCapabilities {
  const isLocal = sourceType === "blank" || sourceType === "imported";
  return {
    can_edit_schema: isLocal,
    can_edit_rows: isLocal,
    can_edit_meta: isLocal,
    can_export: true,
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  comment: string;
}

export type ScopeValue = "all" | "department" | "private";
export type AccessScope = "self" | "users" | "roles" | "departments" | "projects" | "company";

// Forward declaration for validation_rules typing
export interface SkillDataViewBase {
  view_id: string;
  view_name: string;
  skill_id: number;
  skill_name: string;
  allowed_fields: string[];
  row_filters: { field: string; op: string; value: string }[];
}

export type FieldType = "text" | "number" | "select" | "multi_select" | "date" | "person" | "url" | "checkbox" | "email" | "phone";

export interface FieldMeta {
  name: string;
  field_type: FieldType;
  options: string[];
  nullable: boolean;
  comment: string;
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "文本",
  number: "数字",
  select: "单选",
  multi_select: "多选",
  date: "日期",
  person: "人员",
  url: "链接",
  checkbox: "复选框",
  email: "邮箱",
  phone: "电话",
};

export interface BusinessTable {
  id: number;
  table_name: string;
  display_name: string;
  description: string;
  columns: Column[];
  validation_rules: {
    hidden_fields?: string[];
    folder_id?: number;
    sort_order?: number;
    column_scope?: ScopeValue;
    column_department_ids?: number[];
    row_scope?: ScopeValue;
    row_department_ids?: number[];
    bitable_app_token?: string;
    bitable_table_id?: string;
    last_synced_at?: number;
    field_meta?: FieldMeta[];
    // 六级访问权限
    access_scope?: AccessScope;
    access_user_ids?: number[];
    access_role_ids?: string[];
    access_department_ids?: number[];
    access_project_ids?: number[];
    // Skill 数据视图
    skill_data_views?: SkillDataViewBase[];
  };
  referenced_skills?: string[];
  created_at: string;
}

export interface Department {
  id: number;
  name: string;
  parent_id: number | null;
}

export interface ProbeResult {
  table_name: string;
  columns: Column[];
  preview_rows: Record<string, unknown>[];
}

export type Tab = "connect" | "manage";
export type ConnectMode = "db" | "bitable";

// ─── View types ───────────────────────────────────────────────────────────────
export interface ViewFilter {
  field: string;
  op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "starts" | "ends";
  value: string;
}

export interface ViewSort {
  field: string;
  dir: "asc" | "desc";
}

export interface TableViewConfig {
  filters: ViewFilter[];
  sorts: ViewSort[];
  group_by: string;
  hidden_columns: string[];
  column_widths: Record<string, number>;
}

export interface TableView {
  id: number;
  table_id: number;
  name: string;
  view_type: string;
  config: TableViewConfig;
  created_by: number | null;
}

export interface SkillDataView {
  view_id: string;
  view_name: string;
  skill_id: number;
  skill_name: string;
  allowed_fields: string[];
  row_filters: ViewFilter[];
}

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: string;
  department_id: number | null;
}

export const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "sales", label: "商务" },
  { value: "planner", label: "策划" },
  { value: "finance", label: "财务" },
  { value: "hr", label: "HR" },
  { value: "management", label: "管理层" },
];

export interface ProjectGroup {
  id: number;
  name: string;
}

export const OP_LABELS: Record<string, string> = {
  eq: "等于", ne: "不等于", gt: "大于", gte: "大于等于",
  lt: "小于", lte: "小于等于", contains: "包含", starts: "开头是", ends: "结尾是",
};

export const READONLY_COLS = new Set(["id", "created_at", "updated_at", "_record_id", "_synced_at"]);

// ─── Bitable types ───────────────────────────────────────────────────────────
export interface BitableProbeResult {
  app_token: string;
  table_id: string;
  columns: { name: string; type: number; nullable: boolean; comment: string }[];
  preview_rows: Record<string, unknown>[];
}

export interface WikiTable {
  table_id: string;
  name: string;
}

// ─── Virtual folder (legacy) ─────────────────────────────────────────────────
export interface VirtualFolder {
  id: number;       // positive = from validation_rules.folder_id convention; we use local map
  name: string;
  parent_id: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Data Assets API types (enriched layer)
// ═══════════════════════════════════════════════════════════════════════════════

export interface DataAssetFolder {
  id: number;
  name: string;
  parent_id: number | null;
  workspace_scope: string;
  sort_order: number;
  is_archived: boolean;
  children: DataAssetFolder[];
}

export interface RiskWarning {
  code: string;
  message: string;
}

export interface BoundSkill {
  skill_id: number;
  skill_name: string;
  view_id?: number | null;
  view_name?: string | null;
  source: "legacy" | "binding";
}

export interface DataAssetTable {
  id: number;
  table_name: string;
  display_name: string;
  description: string;
  folder_id: number | null;
  source_type: string;
  sync_status: string;
  last_synced_at: string | null;
  record_count: number | null;
  field_count: number;
  bound_skills: BoundSkill[];
  risk_warnings: RiskWarning[];
  is_archived: boolean;
  created_at: string | null;
  role_group_count?: number;
  view_count?: number;
  governance_objective_id?: number | null;
  resource_library_id?: number | null;
  object_type_id?: number | null;
  governance_status?: "ungoverned" | "suggested" | "aligned" | "needs_review" | null;
  governance_note?: string | null;
}

export interface TableFieldDetail {
  id: number | null;
  field_name: string;
  display_name: string | null;
  physical_column_name: string | null;
  field_type: string;
  source_field_type: string | null;
  is_nullable: boolean;
  is_system: boolean;
  is_filterable: boolean;
  is_groupable: boolean;
  is_sortable: boolean;
  enum_values: string[];
  enum_source: string | null;
  sample_values: string[];
  distinct_count: number | null;
  null_ratio: number | null;
  description: string;
  // v1: 数据字典扩展
  field_role_tags: FieldRoleTag[];
  is_enum: boolean;
  is_free_text: boolean;
  is_sensitive: boolean;
}

export interface AccessPolicy {
  access_scope: string;
  access_user_ids: number[];
  access_role_ids: string[];
  access_department_ids: number[];
  access_project_ids: number[];
  row_scope: string;
  row_department_ids: number[];
  column_scope: string;
  column_department_ids: number[];
  hidden_fields: string[];
}

export interface TableViewDetail {
  id: number;
  name: string;
  view_type: string;
  view_purpose: string | null;
  visibility_scope: string;
  is_default: boolean;
  is_system: boolean;
  config: TableViewConfig;
  created_by: number | null;
  // v1: 视图能力升级
  visible_field_ids: number[];
  view_kind: ViewKind;
  disclosure_ceiling: DisclosureLevel | null;
  allowed_role_group_ids: number[];
  allowed_skill_ids: number[];
  row_limit: number | null;
}

export interface SkillBindingDetail {
  skill_id: number;
  skill_name: string;
  binding_id: number | null;
  view_id: number | null;
  view_name: string | null;
  binding_type: string | null;
  alias: string | null;
  status: "healthy" | "legacy_unbound";
}

export interface SyncJobDetail {
  id: number;
  job_type: string;
  status: string;
  error_type: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  trigger_source: string | null;
  stats: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// v1: 数据资产权限模型类型
// ═══════════════════════════════════════════════════════════════════════════════

export type FieldRoleTag = "dimension" | "metric" | "identifier" | "sensitive" | "derived" | "system";
export type DisclosureLevel = "L0" | "L1" | "L2" | "L3" | "L4";
export type RowAccessMode = "none" | "all" | "owner" | "department" | "rule";
export type FieldAccessMode = "all" | "allowlist" | "blocklist";
export type ViewKind = "list" | "board" | "metric" | "pivot" | "review_queue";

export const DISCLOSURE_LABELS: Record<DisclosureLevel, string> = {
  L0: "L0 禁止",
  L1: "L1 统计",
  L2: "L2 脱敏",
  L3: "L3 明文",
  L4: "L4 引用",
};

export const VIEW_KIND_LABELS: Record<ViewKind, string> = {
  list: "列表",
  board: "看板",
  metric: "指标",
  pivot: "透视",
  review_queue: "审批队列",
};

export const MASKING_RULES = ["phone_mask", "name_mask", "id_mask", "email_mask", "amount_range", "full_mask"] as const;
export type MaskingRule = typeof MASKING_RULES[number];

export interface TableRoleGroup {
  id: number;
  table_id: number;
  name: string;
  group_type: "human_role" | "skill_role" | "mixed";
  subject_scope: string;
  user_ids: number[];
  department_ids: number[];
  role_keys: string[];
  skill_ids: number[];
  description: string | null;
  is_system: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface TablePermissionPolicy {
  id: number;
  table_id: number;
  view_id: number | null;
  role_group_id: number;
  row_access_mode: RowAccessMode;
  row_rule_json: Record<string, unknown>;
  field_access_mode: FieldAccessMode;
  allowed_field_ids: number[];
  blocked_field_ids: number[];
  disclosure_level: DisclosureLevel;
  masking_rule_json: Record<string, unknown>;
  tool_permission_mode: string;
  export_permission: boolean;
  reason_template: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FieldValueDictionary {
  id: number;
  field_id: number;
  value: string;
  label: string | null;
  is_active: boolean;
  source: "manual" | "inferred" | "synced";
  sort_order: number;
  hit_count: number;
  last_seen_at: string | null;
}

export interface SkillDataGrant {
  id: number;
  skill_id: number;
  skill_name?: string;
  table_id: number;
  view_id: number | null;
  view_name?: string | null;
  role_group_id: number | null;
  grant_mode: "deny" | "allow";
  allowed_actions: string[];
  max_disclosure_level: DisclosureLevel;
  row_rule_override_json: Record<string, unknown>;
  field_rule_override_json: Record<string, unknown>;
  approval_required: boolean;
  audit_level: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface PermissionPreview {
  role_group_id: number;
  role_group_name: string;
  visible_fields: string[];
  masked_fields: string[];
  row_access: string;
  disclosure_level: DisclosureLevel;
  can_export: boolean;
  can_use_tools: boolean;
}

export interface TableDetail {
  id: number;
  table_name: string;
  display_name: string;
  description: string;
  folder_id: number | null;
  source_type: string;
  source_ref: Record<string, string>;
  sync_status: string;
  sync_error: string | null;
  last_synced_at: string | null;
  field_profile_status: string;
  field_profile_error: string | null;
  record_count: number | null;
  is_archived: boolean;
  owner_id: number | null;
  department_id: number | null;
  created_at: string | null;
  updated_at: string | null;
  fields: TableFieldDetail[];
  access_policy: AccessPolicy;
  views: TableViewDetail[];
  bindings: SkillBindingDetail[];
  recent_sync_jobs: SyncJobDetail[];
  risk_warnings: RiskWarning[];
  // v1: 权限模型
  role_groups: TableRoleGroup[];
  permission_policies: TablePermissionPolicy[];
  skill_grants: SkillDataGrant[];
  // v2: 安全扩展
  risk_assessment: RiskAssessment | null;
  source_profile: SourceProfile | null;
  small_sample_protection: SmallSampleProtectionConfig;
  governance_objective_id?: number | null;
  resource_library_id?: number | null;
  object_type_id?: number | null;
  governance_status?: "ungoverned" | "suggested" | "aligned" | "needs_review" | null;
  governance_note?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// v2: 数据资产扩展类型
// ═══════════════════════════════════════════════════════════════════════════════

// ── 敏感分级 ──
export type SensitivityLevel = "S0_public" | "S1_internal" | "S2_sensitive" | "S3_confidential" | "S4_restricted";
export const SENSITIVITY_LABELS: Record<SensitivityLevel, string> = {
  S0_public: "S0 公开",
  S1_internal: "S1 内部",
  S2_sensitive: "S2 敏感",
  S3_confidential: "S3 机密",
  S4_restricted: "S4 受限",
};
export const SENSITIVITY_COLORS: Record<SensitivityLevel, string> = {
  S0_public: "",
  S1_internal: "bg-blue-50 text-blue-500 border-blue-200",
  S2_sensitive: "bg-yellow-50 text-yellow-600 border-yellow-200",
  S3_confidential: "bg-orange-50 text-orange-600 border-orange-200",
  S4_restricted: "bg-red-50 text-red-600 border-red-200",
};

// ── 字段生命周期 ──
export type FieldLifecycleStatus = "draft" | "inferred" | "confirmed" | "deprecated" | "archived";
export const LIFECYCLE_LABELS: Record<FieldLifecycleStatus, string> = {
  draft: "草稿",
  inferred: "推断",
  confirmed: "已确认",
  deprecated: "已弃用",
  archived: "已归档",
};
export const LIFECYCLE_STYLES: Record<FieldLifecycleStatus, string> = {
  draft: "border-dashed border-gray-300 text-gray-400",
  inferred: "border-dashed border-blue-300 text-blue-500",
  confirmed: "border-solid border-green-400 text-green-600",
  deprecated: "border-solid border-orange-300 text-orange-500 line-through",
  archived: "border-solid border-gray-300 text-gray-400 line-through",
};

// ── V2 字段扩展 ──
export interface TableFieldDetailV2 extends TableFieldDetail {
  sensitivity_level: SensitivityLevel;
  lifecycle_status: FieldLifecycleStatus;
}

// ── V2 资产列表扩展 ──
export type RiskLevel = "low" | "medium" | "high" | "critical";
export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "严重",
};
export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  low: "bg-green-50 text-green-600",
  medium: "bg-yellow-50 text-yellow-600",
  high: "bg-orange-50 text-orange-600",
  critical: "bg-red-50 text-red-600",
};

export interface DataAssetTableV2 extends DataAssetTable {
  risk_level: RiskLevel | null;
}

// ── 风险评估 ──
export interface RiskFactor {
  name: string;
  score: number;
  max_score: number;
  description: string;
}

export interface RiskAssessment {
  table_id: number;
  overall_level: RiskLevel;
  overall_score: number;
  factors: RiskFactor[];
  assessed_at: string;
}

// ── 数据源画像 ──
export interface SourceProfile {
  source_type: string;
  connection_status: "healthy" | "degraded" | "failed";
  last_check_at: string;
  latency_ms: number | null;
  error_rate: number;
  metadata: Record<string, unknown>;
}

// ── 小样本保护 ──
export type SmallSampleFallback = "hide_bucket" | "merge_adjacent" | "suppress_cell";
export interface SmallSampleProtectionConfig {
  enabled: boolean;
  threshold: number;
  fallback: SmallSampleFallback;
}

// ── V2 表详情扩展（通过 normalizer 注入，不改原接口 shape）──
export interface TableDetailV2 extends Omit<TableDetail, "fields"> {
  fields: TableFieldDetailV2[];
  risk_assessment: RiskAssessment | null;
  source_profile: SourceProfile | null;
  small_sample_protection: SmallSampleProtectionConfig;
}

// ── 访问模拟 ──
export interface AccessSimulationRequest {
  subject_type: "user" | "role" | "skill";
  subject_id: number;
  resource_table_id: number;
  resource_view_id?: number;
  question?: string;
}

export interface InterceptedItem {
  field_name: string;
  reason: string;
  action: "blocked" | "masked" | "aggregated";
}

export interface AccessSimulationResult {
  accessible_fields: string[];
  blocked_fields: string[];
  disclosure_level: DisclosureLevel;
  row_access_summary: string;
  intercepted_items: InterceptedItem[];
}

// ── 输出审查 ──
export type OutputReviewAction = "passed" | "blocked" | "masked" | "flagged";
export interface OutputReviewLog {
  id: number;
  skill_id: number;
  skill_name: string;
  table_id: number;
  action: OutputReviewAction;
  reason: string;
  fields_involved: string[];
  created_at: string;
}

// ── 逻辑视图 ──
export interface LogicalViewRun {
  id: number;
  view_id: number;
  view_name: string;
  triggered_by: string;
  status: "success" | "failed" | "running";
  row_count: number | null;
  duration_ms: number | null;
  created_at: string;
}

// ── 策略版本 ──
export interface PolicyVersion {
  id: number;
  policy_id: number;
  version: number;
  snapshot: TablePermissionPolicy;
  changed_by: number | null;
  changed_by_name: string | null;
  change_reason: string | null;
  created_at: string;
}

// ── 审批 ──
export type DataApprovalType = "export_sensitive" | "elevate_disclosure" | "grant_access" | "policy_change";
export type DataApprovalStatus = "pending" | "approved" | "rejected";
export interface DataApproval {
  id: number;
  approval_type: DataApprovalType;
  status: DataApprovalStatus;
  requester_id: number;
  requester_name: string;
  table_id: number;
  table_name: string;
  payload: Record<string, unknown>;
  reviewer_id: number | null;
  reviewer_name: string | null;
  review_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// ── 字段影响 ──
export interface FieldImpact {
  field_id: number;
  field_name: string;
  used_by_views: { id: number; name: string }[];
  used_by_policies: { id: number; role_group_name: string }[];
  used_by_skills: { id: number; skill_name: string }[];
  used_by_sync_rules: string[];
}

// ── 治理缺失项 ──
export type UnfiledTaskType =
  | "no_folder"
  | "no_sensitivity"
  | "no_permission"
  | "no_description"
  | "no_field_confirm"
  | "stale_sync";
export interface UnfiledTask {
  type: UnfiledTaskType;
  label: string;
  severity: "info" | "warning" | "error";
  fix_hint: string;
}

// ── 首页 KPI ──
export interface DashboardStats {
  unfiled_count: number;
  high_risk_count: number;
  pending_approval_count: number;
  sync_failed_count: number;
}

// ── 导出规则 ──
export type ExportFormat = "csv" | "excel" | "json";
export interface ExportRule {
  id: number;
  table_id: number;
  role_group_id: number;
  role_group_name: string;
  allowed_formats: ExportFormat[];
  max_rows: number | null;
  requires_approval: boolean;
  watermark: boolean;
  strip_sensitive: boolean;
}

export interface GovernanceObjectiveLite {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  level: string;
}

export interface GovernanceResourceLibraryLite {
  id: number;
  objective_id: number;
  name: string;
  code: string;
  description?: string | null;
  object_type: string;
  default_update_cycle?: string | null;
}

export interface GovernanceSuggestionTaskLite {
  id: number;
  subject_type: string;
  subject_id: number;
  task_type: string;
  status: string;
  objective_id?: number | null;
  resource_library_id?: number | null;
  object_type_id?: number | null;
  suggested_payload?: Record<string, unknown>;
  reason?: string | null;
  confidence?: number;
  created_at?: string | null;
  subject_title?: string;
}

export interface GovernanceReinforcementMeta {
  strategy_key: string;
  strategy_group: string;
  base_confidence: number;
  boost: number;
  success_rate?: number | null;
  samples: number;
}

export interface GovernanceGapAction {
  action: string;
  label: string;
  target_object_id: number;
  description: string;
}

export interface GovernanceObjectGap {
  object_id: number;
  display_name: string;
  gap_type: string;
  reason: string;
  recommended_actions: GovernanceGapAction[];
}

export interface GovernanceGapOverview {
  pending_suggestions: number;
  object_gaps: GovernanceObjectGap[];
  conflict_count: number;
}

export interface GovernanceStrategyStatLite {
  id: number;
  strategy_key: string;
  strategy_group: string;
  subject_type?: string | null;
  objective_code?: string | null;
  library_code?: string | null;
  department_id?: number | null;
  business_line?: string | null;
  is_frozen?: boolean;
  manual_bias?: number;
  total_count: number;
  success_count: number;
  reject_count: number;
  cumulative_reward: number;
  last_reward: number;
  success_rate: number;
  last_event_at?: string | null;
}

export interface GovernanceFeedbackEventLite {
  id: number;
  suggestion_id?: number | null;
  subject_type: string;
  subject_id: number;
  strategy_key: string;
  event_type: string;
  reward_score: number;
  note?: string | null;
  created_by?: number | null;
  created_at?: string | null;
}

export interface GovernanceBlueprintLite {
  seed_blueprint: Array<Record<string, unknown>>;
  objectives: GovernanceObjectiveLite[];
  resource_libraries: GovernanceResourceLibraryLite[];
  object_types: Array<{
    id: number;
    code: string;
    name: string;
    description?: string | null;
    baseline_fields?: string[];
    default_consumption_modes?: string[];
  }>;
  field_templates?: Array<{
    id: number;
    object_type_id: number;
    field_key: string;
    field_label: string;
    field_type: string;
    is_required: boolean;
    is_editable: boolean;
    visibility_mode: string;
    update_cycle?: string | null;
    consumer_modes?: string[];
    description?: string | null;
    example_values?: string[];
    sort_order?: number;
  }>;
  department_missions?: Array<{
    id: number;
    department_id: number;
    objective_id?: number | null;
    name: string;
    code: string;
    core_role?: string | null;
    mission_statement?: string | null;
    upstream_dependencies?: string[];
    downstream_deliverables?: string[];
  }>;
  krs?: Array<{
    id: number;
    mission_id: number;
    objective_id?: number | null;
    name: string;
    code: string;
    description?: string | null;
    metric_definition?: string | null;
    target_value?: string | null;
    time_horizon?: string | null;
    owner_role?: string | null;
    sort_order?: number;
  }>;
  required_elements?: Array<{
    id: number;
    kr_id: number;
    name: string;
    code: string;
    element_type: string;
    description?: string | null;
    required_library_codes?: string[];
    required_object_types?: string[];
    suggested_update_cycle?: string | null;
    sort_order?: number;
  }>;
}

// ─── Phase 2: 治理自动化类型 ─────────────────────────────────────────────────

export interface GovernanceCandidate {
  rank: number;
  objective_code: string | null;
  library_code: string | null;
  object_type_code: string | null;
  confidence: number;
  reason: string;
  evidence: string[];
}

export interface GovernanceSimilarDecision {
  id: number;
  subject_type: string;
  subject_id: number;
  confidence: number;
  reason: string | null;
  resolved_at: string | null;
}

export interface GovernanceReviewStats {
  reviewed_this_month: number;
  ai_learned_this_month: number;
  last_month_reviewed: number;
  estimated_reduction_next_month: number;
}

export interface ThresholdSimulationResult {
  current: { auto_pass_rate: number; human_review_volume: number; error_rate: number };
  candidate: { auto_pass_rate: number; human_review_volume: number; error_rate: number };
  total_samples: number;
}

export interface GovernanceExperiment {
  id: number;
  name: string;
  department_ids: number[];
  threshold: number;
  baseline_threshold: number;
  duration_days: number;
  status: "running" | "completed" | "applied" | "cancelled";
  started_at: string | null;
  ended_at: string | null;
  result_payload: Record<string, unknown> | null;
  live_metrics?: {
    experiment_group: { total: number; auto_pass_rate: number; human_review: number; rejected: number };
    control_group: { total: number; auto_pass_rate: number; human_review: number; rejected: number };
    days_elapsed: number;
  };
  created_by: number | null;
  created_at: string | null;
}

export interface StrategyImpact {
  strategy_id: number;
  strategy_key: string;
  is_frozen: boolean;
  affected_pending_count: number;
  total_historical: number;
  reject_rate: number;
  alternatives: Array<{
    id: number;
    strategy_key: string;
    success_rate: number;
    total_count: number;
    library_code: string | null;
  }>;
}

export interface MigrationMatchedItem {
  library_code: string;
  match_status: "directly_reusable" | "needs_adaptation" | "missing";
  reason: string;
  adaptation_notes?: string;
}

export interface MigrationImportStats {
  reusable: number;
  adaptation: number;
  missing: number;
  created_objectives: string[];
  created_libraries: string[];
}

export interface MigrationStatus {
  pending_adaptations: number;
  pending_gaps: number;
  total_pending: number;
}

export interface GovernanceDomainGap {
  stat_id: number;
  strategy_key: string;
  strategy_group: string;
  library_code: string | null;
  reject_rate: number;
  total_count: number;
  reject_count: number;
  gap_type: string;
  severity: string;
}

export interface GovernanceCoverageGap {
  library_id: number;
  library_code: string;
  library_name: string;
  total_entries: number;
  aligned_entries: number;
  coverage_rate: number;
  gap_type: string;
  severity: string;
  reason: string;
}

export interface GovernanceDetectedGaps {
  domain_gaps: GovernanceDomainGap[];
  coverage_gaps: GovernanceCoverageGap[];
}

export interface GovernanceBaselineVersion {
  id: number;
  version: string | null;
  version_type: string | null;
  change_type: string;
  snapshot_data: Record<string, unknown> | null;
  stats_data: {
    total_entries?: number;
    aligned?: number;
    suggested?: number;
    ungoverned?: number;
    coverage_rate?: number;
    confidence_distribution?: { high: number; mid: number; low: number };
    pending_suggestions?: number;
  } | null;
  is_active: boolean;
  confirmed_by: number | null;
  confirmed_at: string | null;
  changed_by: number | null;
  created_at: string | null;
}

export interface GovernanceBaselineDiff {
  current_version: string | null;
  previous_version: string | null;
  added_libraries: string[];
  removed_libraries: string[];
  stats_diff: {
    coverage_rate: { current: number; previous: number; delta: number };
    aligned: { current: number; previous: number };
    pending_suggestions: { current: number; previous: number };
  } | null;
}

export interface GovernanceObjectLite {
  id: number;
  object_type_id: number;
  canonical_key: string;
  display_name: string;
  business_line?: string | null;
  department_id?: number | null;
  owner_id?: number | null;
  lifecycle_status: string;
  object_payload?: Record<string, unknown>;
  score?: number;
  matched_business_line?: boolean;
  feedback_score?: number;
}

// ─── 协同基线 ──────────────────────────────────────────────────────────────────

export interface CollaborationBaselineFieldTemplate {
  field_key: string;
  field_label: string;
  is_required: boolean;
  visibility_mode: string;
  update_cycle?: string | null;
}

export interface CollaborationBaselineLibrary {
  library_id: number;
  library_code: string;
  library_name: string;
  objective_id: number;
  object_type: string;
  doc_count: number;
  table_count: number;
  field_coverage: number;
  required_field_count: number;
  filled_field_count: number;
  consumer_departments: number[];
  dependency_library_codes: string[];
  default_update_cycle?: string | null;
  last_updated?: string | null;
  update_compliance?: number | null;
  field_templates: CollaborationBaselineFieldTemplate[];
}

export interface CollaborationBaselineObjectType {
  object_type_id: number;
  object_type_code: string;
  object_type_name: string;
  dimension_count: number;
  dimension_schema: string[];
  facet_count: number;
  active_object_count: number;
}

export interface CollaborationBaselineSummary {
  total_libraries: number;
  avg_field_coverage: number;
  update_compliance_rate: number;
  total_cross_dept_objects: number;
}

export interface CollaborationBaselineResponse {
  summary: CollaborationBaselineSummary;
  libraries: CollaborationBaselineLibrary[];
  object_types: CollaborationBaselineObjectType[];
}

export interface GovernanceObjectDetail extends GovernanceObjectLite {
  facets: Array<{
    id: number;
    resource_library_id: number;
    facet_key: string;
    facet_name: string;
    field_values: Record<string, unknown>;
    consumer_scenarios: string[];
    visibility_mode: string;
    is_editable: boolean;
    update_cycle?: string | null;
    source_subjects: Array<{ type: string; id: number }>;
  }>;
  collaboration_baseline?: {
    knowledge_entries: Array<{ id: number; title: string; updated_at?: string | null }>;
    business_tables: Array<{ id: number; display_name: string; table_name: string; updated_at?: string | null }>;
    projects: Array<{ id: number; name: string; updated_at?: string | null }>;
    tasks: Array<{ id: number; title: string; status?: string | null; updated_at?: string | null }>;
  };
}
