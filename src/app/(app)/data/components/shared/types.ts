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
}
