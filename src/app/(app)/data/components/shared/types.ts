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

// ─── Virtual folder ──────────────────────────────────────────────────────────
export interface VirtualFolder {
  id: number;       // positive = from validation_rules.folder_id convention; we use local map
  name: string;
  parent_id: number | null;
}
