/**
 * 数据资产测试 fixtures
 * 提供标准化的 mock 数据，供所有测试文件复用
 */
import type {
  TableDetail,
  TableFieldDetail,
  TableRoleGroup,
  TablePermissionPolicy,
  SkillDataGrant,
  TableViewDetail,
  FieldValueDictionary,
  SkillBindingDetail,
  DisclosureLevel,
} from "@/app/(app)/data/components/shared/types";

// ─── 字段 fixtures ────────────────────────────────────────────────────────────

export function makeField(overrides: Partial<TableFieldDetail> = {}): TableFieldDetail {
  return {
    id: 1,
    field_name: "name",
    display_name: "姓名",
    physical_column_name: "name",
    field_type: "text",
    source_field_type: "text",
    is_nullable: false,
    is_system: false,
    is_filterable: true,
    is_groupable: false,
    is_sortable: true,
    enum_values: [],
    enum_source: null,
    sample_values: [],
    distinct_count: null,
    null_ratio: null,
    description: "",
    field_role_tags: [],
    is_enum: false,
    is_free_text: true,
    is_sensitive: false,
    ...overrides,
  };
}

/** 100 字段数据集中的核心字段 */
export const FIELDS: TableFieldDetail[] = [
  makeField({ id: 1, field_name: "id", display_name: "ID", field_type: "number", is_system: true, field_role_tags: ["system"] }),
  makeField({ id: 2, field_name: "name", display_name: "姓名", is_sensitive: true, field_role_tags: ["identifier", "sensitive"] }),
  makeField({ id: 3, field_name: "phone", display_name: "手机号", field_type: "phone", is_sensitive: true, field_role_tags: ["sensitive"] }),
  makeField({ id: 4, field_name: "department", display_name: "部门", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["销售部", "市场部", "技术部"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
  makeField({ id: 5, field_name: "status", display_name: "状态", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["待处理", "进行中", "已完成", "已取消"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
  makeField({ id: 6, field_name: "project", display_name: "项目", field_type: "text", is_enum: true, is_free_text: false, enum_values: ["项目A", "项目B", "项目C"], field_role_tags: ["dimension"] }),
  makeField({ id: 7, field_name: "amount", display_name: "金额", field_type: "number", field_role_tags: ["metric"] }),
  makeField({ id: 8, field_name: "owner_id", display_name: "负责人", field_type: "person", field_role_tags: ["dimension"] }),
  makeField({ id: 9, field_name: "id_card", display_name: "身份证号", field_type: "text", is_sensitive: true, field_role_tags: ["identifier", "sensitive"] }),
  makeField({ id: 10, field_name: "email", display_name: "邮箱", field_type: "email", is_sensitive: false }),
  makeField({ id: 11, field_name: "notes", display_name: "备注", field_type: "text", is_free_text: true }),
  makeField({ id: 12, field_name: "created_at", display_name: "创建时间", field_type: "datetime", is_system: true, field_role_tags: ["system"] }),
];

// ─── 角色组 fixtures ──────────────────────────────────────────────────────────

export function makeRoleGroup(overrides: Partial<TableRoleGroup> = {}): TableRoleGroup {
  return {
    id: 1,
    table_id: 100,
    name: "默认角色组",
    group_type: "human_role",
    subject_scope: "all",
    user_ids: [],
    department_ids: [],
    role_keys: [],
    skill_ids: [],
    description: null,
    is_system: false,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

export const ROLE_GROUPS: TableRoleGroup[] = [
  makeRoleGroup({ id: 1, name: "全员", group_type: "human_role", is_system: true, user_ids: [] }),
  makeRoleGroup({ id: 2, name: "销售组", group_type: "human_role", department_ids: [10], role_keys: ["sales"] }),
  makeRoleGroup({ id: 3, name: "管理层", group_type: "human_role", role_keys: ["management"] }),
  makeRoleGroup({ id: 4, name: "内部分析 Skill", group_type: "skill_role", skill_ids: [201] }),
  makeRoleGroup({ id: 5, name: "外部汇总 Skill", group_type: "skill_role", skill_ids: [202] }),
  makeRoleGroup({ id: 6, name: "高敏审批 Skill", group_type: "skill_role", skill_ids: [203] }),
];

// ─── 权限策略 fixtures ────────────────────────────────────────────────────────

export function makePolicy(overrides: Partial<TablePermissionPolicy> = {}): TablePermissionPolicy {
  return {
    id: 1,
    table_id: 100,
    view_id: null,
    role_group_id: 1,
    row_access_mode: "all",
    row_rule_json: {},
    field_access_mode: "all",
    allowed_field_ids: [],
    blocked_field_ids: [],
    disclosure_level: "L2",
    masking_rule_json: {},
    tool_permission_mode: "readonly",
    export_permission: false,
    reason_template: null,
    created_at: "2026-03-01T00:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

export const POLICIES: TablePermissionPolicy[] = [
  // 全员 — 表级：L1 统计, 全行可读, 排除敏感字段
  makePolicy({ id: 1, role_group_id: 1, row_access_mode: "all", field_access_mode: "blocklist", blocked_field_ids: [2, 3, 9], disclosure_level: "L1", export_permission: false }),
  // 销售组 — 表级：L3 脱敏, 仅本部门, 全字段
  makePolicy({ id: 2, role_group_id: 2, row_access_mode: "department", field_access_mode: "all", disclosure_level: "L3", masking_rule_json: { phone: "phone_mask", name: "name_mask", id_card: "id_mask" } }),
  // 管理层 — 表级：L4 引用, 全部行, 全字段, 可导出
  makePolicy({ id: 3, role_group_id: 3, row_access_mode: "all", field_access_mode: "all", disclosure_level: "L4", export_permission: true, tool_permission_mode: "readwrite" }),
  // 内部分析 Skill — 表级：L3 脱敏, 白名单字段
  makePolicy({ id: 4, role_group_id: 4, row_access_mode: "all", field_access_mode: "allowlist", allowed_field_ids: [4, 5, 6, 7, 8], disclosure_level: "L3", masking_rule_json: {} }),
  // 外部汇总 Skill — 表级：L2 聚合, 仅维度字段
  makePolicy({ id: 5, role_group_id: 5, row_access_mode: "all", field_access_mode: "allowlist", allowed_field_ids: [4, 5, 6], disclosure_level: "L2" }),
  // 高敏审批 Skill — 表级：L4 引用, 全字段
  makePolicy({ id: 6, role_group_id: 6, row_access_mode: "all", field_access_mode: "all", disclosure_level: "L4", tool_permission_mode: "readonly" }),
];

// ─── 视图 fixtures ────────────────────────────────────────────────────────────

export function makeView(overrides: Partial<TableViewDetail> = {}): TableViewDetail {
  return {
    id: 1,
    name: "默认视图",
    view_type: "grid",
    view_purpose: null,
    visibility_scope: "all",
    is_default: true,
    is_system: false,
    config: { filters: [], sorts: [], group_by: "", hidden_columns: [], column_widths: {} },
    created_by: null,
    visible_field_ids: [],
    view_kind: "list",
    disclosure_ceiling: null,
    allowed_role_group_ids: [],
    allowed_skill_ids: [],
    row_limit: null,
    ...overrides,
  };
}

export const VIEWS: TableViewDetail[] = [
  makeView({ id: 1, name: "全量视图", visible_field_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], disclosure_ceiling: null }),
  makeView({ id: 2, name: "运营明细视图", view_kind: "list", visible_field_ids: [2, 4, 5, 6, 7, 8, 10], disclosure_ceiling: "L3", allowed_role_group_ids: [2, 3] }),
  makeView({ id: 3, name: "汇总视图", view_kind: "metric", visible_field_ids: [4, 5, 6, 7], disclosure_ceiling: "L2", allowed_role_group_ids: [1, 5] }),
];

// ─── Skill grant fixtures ─────────────────────────────────────────────────────

export function makeGrant(overrides: Partial<SkillDataGrant> = {}): SkillDataGrant {
  return {
    id: 1,
    skill_id: 201,
    skill_name: "内部分析 Skill",
    table_id: 100,
    view_id: null,
    view_name: null,
    role_group_id: null,
    grant_mode: "allow",
    allowed_actions: ["read"],
    max_disclosure_level: "L2",
    row_rule_override_json: {},
    field_rule_override_json: {},
    approval_required: false,
    audit_level: "standard",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: null,
    ...overrides,
  };
}

export const SKILL_GRANTS: SkillDataGrant[] = [
  makeGrant({ id: 1, skill_id: 201, skill_name: "内部分析 Skill", view_id: 2, view_name: "运营明细视图", max_disclosure_level: "L3", role_group_id: 4 }),
  makeGrant({ id: 2, skill_id: 202, skill_name: "外部汇总 Skill", view_id: 3, view_name: "汇总视图", max_disclosure_level: "L2", role_group_id: 5 }),
  makeGrant({ id: 3, skill_id: 203, skill_name: "高敏审批 Skill", view_id: 1, view_name: "全量视图", max_disclosure_level: "L4", role_group_id: 6, approval_required: true, audit_level: "full" }),
];

// ─── Binding fixtures ─────────────────────────────────────────────────────────

export const BINDINGS: SkillBindingDetail[] = [
  { skill_id: 201, skill_name: "内部分析 Skill", binding_id: 1, view_id: 2, view_name: "运营明细视图", binding_type: "data_query", alias: null, status: "healthy" },
  { skill_id: 202, skill_name: "外部汇总 Skill", binding_id: 2, view_id: 3, view_name: "汇总视图", binding_type: "data_query", alias: null, status: "healthy" },
  { skill_id: 203, skill_name: "高敏审批 Skill", binding_id: 3, view_id: 1, view_name: "全量视图", binding_type: "data_query", alias: null, status: "healthy" },
  { skill_id: 999, skill_name: "旧 Skill", binding_id: null, view_id: null, view_name: null, binding_type: null, alias: null, status: "legacy_unbound" },
];

// ─── 字段字典 fixtures ────────────────────────────────────────────────────────

export const ENUM_DICTIONARY: FieldValueDictionary[] = [
  { id: 1, field_id: 4, value: "销售部", label: null, is_active: true, source: "synced", sort_order: 0, hit_count: 45, last_seen_at: "2026-03-30T10:00:00Z" },
  { id: 2, field_id: 4, value: "市场部", label: null, is_active: true, source: "synced", sort_order: 1, hit_count: 30, last_seen_at: "2026-03-30T10:00:00Z" },
  { id: 3, field_id: 4, value: "技术部", label: null, is_active: true, source: "synced", sort_order: 2, hit_count: 25, last_seen_at: "2026-03-30T10:00:00Z" },
  { id: 4, field_id: 4, value: "已撤销部门", label: "已停用", is_active: false, source: "manual", sort_order: 3, hit_count: 5, last_seen_at: "2025-12-01T10:00:00Z" },
];

// ─── 完整 TableDetail fixture ─────────────────────────────────────────────────

export function makeTableDetail(overrides: Partial<TableDetail> = {}): TableDetail {
  return {
    id: 100,
    table_name: "test_customers",
    display_name: "测试客户表",
    description: "含敏感字段的测试表",
    folder_id: 1,
    source_type: "bitable",
    source_ref: { app_token: "app_xxx", table_id: "tbl_yyy" },
    sync_status: "ok",
    sync_error: null,
    last_synced_at: "2026-03-30T08:00:00Z",
    field_profile_status: "completed",
    field_profile_error: null,
    record_count: 100,
    is_archived: false,
    owner_id: 1,
    department_id: 10,
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-03-30T08:00:00Z",
    fields: FIELDS,
    access_policy: {
      access_scope: "company",
      access_user_ids: [],
      access_role_ids: [],
      access_department_ids: [],
      access_project_ids: [],
      row_scope: "all",
      row_department_ids: [],
      column_scope: "all",
      column_department_ids: [],
      hidden_fields: [],
    },
    views: VIEWS,
    bindings: BINDINGS,
    recent_sync_jobs: [],
    risk_warnings: [],
    role_groups: ROLE_GROUPS,
    permission_policies: POLICIES,
    skill_grants: SKILL_GRANTS,
    ...overrides,
  };
}

// ─── 未归档表 fixture ─────────────────────────────────────────────────────────

export function makeUnfiledTable(id: number): TableDetail {
  return makeTableDetail({
    id,
    table_name: `unfiled_table_${id}`,
    display_name: `未归档表 ${id}`,
    folder_id: null,
    role_groups: [],
    permission_policies: [],
    skill_grants: [],
  });
}
