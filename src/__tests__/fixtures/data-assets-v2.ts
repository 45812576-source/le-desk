/**
 * 数据资产 V2 测试 fixtures
 *
 * 基于 V2 测试计划的标准测试资产基线。
 * 三张表 × 四视图 × 四角色组 × 四 Skill。
 */
import type {
  TableDetail,
  TableFieldDetail,
  TableRoleGroup,
  TablePermissionPolicy,
  SkillDataGrant,
  TableViewDetail,
  SkillBindingDetail,
} from "@/app/(app)/data/components/shared/types";
import { makeField, makePolicy, makeRoleGroup, makeView, makeGrant, makeTableDetail } from "./data-assets";

// ═══════════════════════════════════════════════════════════════════════════════
// 表 A：客户主表 customers_master
// ═══════════════════════════════════════════════════════════════════════════════

export const V2_FIELDS_A: TableFieldDetail[] = [
  makeField({ id: 101, field_name: "customer_id", display_name: "客户ID", field_type: "text", is_system: false, is_sensitive: true, field_role_tags: ["identifier", "sensitive"] }),
  makeField({ id: 102, field_name: "customer_name", display_name: "客户名称", field_type: "text", is_sensitive: true, field_role_tags: ["identifier", "sensitive"] }),
  makeField({ id: 103, field_name: "mobile", display_name: "手机号", field_type: "phone", is_sensitive: true, field_role_tags: ["sensitive"] }),
  makeField({ id: 104, field_name: "department_id", display_name: "所属部门", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["部门A", "部门B", "部门C"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
  makeField({ id: 105, field_name: "project_id", display_name: "项目", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["项目1", "项目2", "项目3", "项目4", "项目5"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
  makeField({ id: 106, field_name: "owner_user_id", display_name: "负责人", field_type: "person", is_enum: true, is_free_text: false, enum_values: ["U1", "U2", "U3", "U4", "U5", "U6", "U7", "U8"], field_role_tags: ["dimension"] }),
  makeField({ id: 107, field_name: "customer_level", display_name: "客户等级", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["A", "B", "C", "D"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
  makeField({ id: 108, field_name: "risk_status", display_name: "风险状态", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["normal", "warn", "high"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
  makeField({ id: 109, field_name: "city", display_name: "城市", field_type: "text", is_free_text: true, field_role_tags: [] }),
  makeField({ id: 110, field_name: "contract_amount", display_name: "合同金额", field_type: "number", field_role_tags: ["metric"] }),
  makeField({ id: 111, field_name: "created_at", display_name: "创建时间", field_type: "datetime", is_system: true, field_role_tags: ["system"] }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 表 B：销售流水 sales_orders
// ═══════════════════════════════════════════════════════════════════════════════

export const V2_FIELDS_B: TableFieldDetail[] = [
  makeField({ id: 201, field_name: "order_id", display_name: "订单号", field_type: "text", is_system: false, is_sensitive: false, field_role_tags: ["identifier"] }),
  makeField({ id: 202, field_name: "customer_id", display_name: "客户ID", field_type: "text", is_sensitive: true, field_role_tags: ["identifier", "sensitive"] }),
  makeField({ id: 203, field_name: "sales_name", display_name: "销售姓名", field_type: "text", is_sensitive: true, field_role_tags: ["identifier", "sensitive"] }),
  makeField({ id: 204, field_name: "region", display_name: "区域", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["east", "south", "west", "north"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
  makeField({ id: 205, field_name: "order_status", display_name: "订单状态", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["draft", "paid", "refund", "closed"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
  makeField({ id: 206, field_name: "amount", display_name: "金额", field_type: "number", field_role_tags: ["metric"] }),
  makeField({ id: 207, field_name: "paid_at", display_name: "付款时间", field_type: "datetime", field_role_tags: [] }),
  makeField({ id: 208, field_name: "channel", display_name: "渠道", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["online", "offline", "partner"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// 表 C：外部 PostgreSQL 员工表 employee_comp
// ═══════════════════════════════════════════════════════════════════════════════

export const V2_FIELDS_C: TableFieldDetail[] = [
  makeField({ id: 301, field_name: "employee_id", display_name: "员工ID", field_type: "text", is_sensitive: true, field_role_tags: ["identifier", "sensitive"] }),
  makeField({ id: 302, field_name: "employee_name", display_name: "员工姓名", field_type: "text", is_sensitive: true, field_role_tags: ["identifier", "sensitive"] }),
  makeField({ id: 303, field_name: "phone", display_name: "电话", field_type: "phone", is_sensitive: true, field_role_tags: ["sensitive"] }),
  makeField({ id: 304, field_name: "dept_code", display_name: "部门编码", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["D01", "D02", "D03"], enum_source: "synced", field_role_tags: ["dimension"], is_filterable: true, is_groupable: true }),
  makeField({ id: 305, field_name: "salary_band", display_name: "薪资带", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["L1", "L2", "L3", "L4", "L5"], enum_source: "manual", field_role_tags: ["dimension", "sensitive"], is_sensitive: true }),
  makeField({ id: 306, field_name: "performance_level", display_name: "绩效等级", field_type: "single_select", is_enum: true, is_free_text: false, enum_values: ["S", "A", "B", "C", "D"], enum_source: "synced", field_role_tags: ["dimension"] }),
  makeField({ id: 307, field_name: "last_review", display_name: "最近评审", field_type: "text", is_free_text: true, field_role_tags: [] }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// V2 角色组 — 四个主体基线
// ═══════════════════════════════════════════════════════════════════════════════

export const V2_ROLE_GROUPS: TableRoleGroup[] = [
  makeRoleGroup({ id: 10, name: "销售运营组", group_type: "human_role", department_ids: [10], role_keys: ["sales_ops"] }),
  makeRoleGroup({ id: 11, name: "部门负责人组", group_type: "human_role", role_keys: ["dept_head"] }),
  makeRoleGroup({ id: 12, name: "高管组", group_type: "human_role", role_keys: ["management"] }),
  makeRoleGroup({ id: 13, name: "数据管理员组", group_type: "human_role", role_keys: ["data_admin"] }),
  // Skill 角色组
  makeRoleGroup({ id: 20, name: "客户风险判断 Skill", group_type: "skill_role", skill_ids: [401] }),
  makeRoleGroup({ id: 21, name: "经营汇总 Skill", group_type: "skill_role", skill_ids: [402] }),
  makeRoleGroup({ id: 22, name: "外部协作 Skill", group_type: "skill_role", skill_ids: [403] }),
  makeRoleGroup({ id: 23, name: "审批助手 Skill", group_type: "skill_role", skill_ids: [404] }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// V2 视图基线 — 四个视图
// ═══════════════════════════════════════════════════════════════════════════════

export const V2_VIEWS: TableViewDetail[] = [
  makeView({
    id: 50,
    name: "运营明细视图",
    view_kind: "list",
    visible_field_ids: [101, 102, 104, 105, 107, 108, 109, 110],
    disclosure_ceiling: "L3",
    allowed_role_group_ids: [10, 11],
    allowed_skill_ids: [],
  }),
  makeView({
    id: 51,
    name: "管理汇总视图",
    view_kind: "metric",
    visible_field_ids: [104, 105, 107, 108, 110],
    disclosure_ceiling: "L2",
    allowed_role_group_ids: [11, 12],
    allowed_skill_ids: [402],
  }),
  makeView({
    id: 52,
    name: "Skill_runtime_风控视图",
    view_kind: "list",
    view_purpose: "skill_runtime",
    visible_field_ids: [101, 104, 107, 108],
    disclosure_ceiling: "L1",
    allowed_role_group_ids: [],
    allowed_skill_ids: [401],
  }),
  makeView({
    id: 53,
    name: "审批高敏视图",
    view_kind: "review_queue",
    visible_field_ids: [101, 102, 103, 104, 105, 106, 107, 108, 109, 110],
    disclosure_ceiling: "L4",
    allowed_role_group_ids: [12, 13],
    allowed_skill_ids: [404],
  }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// V2 权限策略基线
// ═══════════════════════════════════════════════════════════════════════════════

export const V2_POLICIES: TablePermissionPolicy[] = [
  // 销售运营组 — L3 脱敏，仅本部门行
  makePolicy({
    id: 501,
    table_id: 1000,
    role_group_id: 10,
    row_access_mode: "department",
    field_access_mode: "all",
    disclosure_level: "L3",
    masking_rule_json: { customer_name: "name_mask", mobile: "phone_mask" },
    export_permission: false,
  }),
  // 部门负责人组 — L2 汇总，全部行，禁止导出
  makePolicy({
    id: 502,
    table_id: 1000,
    role_group_id: 11,
    row_access_mode: "all",
    field_access_mode: "all",
    disclosure_level: "L2",
    export_permission: false,
  }),
  // 高管组 — L4 原始值，全部行，可导出
  makePolicy({
    id: 503,
    table_id: 1000,
    role_group_id: 12,
    row_access_mode: "all",
    field_access_mode: "all",
    disclosure_level: "L4",
    export_permission: true,
    tool_permission_mode: "readwrite",
  }),
  // 数据管理员组 — L4 全权
  makePolicy({
    id: 504,
    table_id: 1000,
    role_group_id: 13,
    row_access_mode: "all",
    field_access_mode: "all",
    disclosure_level: "L4",
    export_permission: true,
    tool_permission_mode: "readwrite",
  }),
  // 客户风险判断 Skill — L1 仅决策，allowlist 仅风控相关字段
  makePolicy({
    id: 505,
    table_id: 1000,
    role_group_id: 20,
    row_access_mode: "all",
    field_access_mode: "allowlist",
    allowed_field_ids: [101, 104, 107, 108],
    disclosure_level: "L1",
  }),
  // 经营汇总 Skill — L2 聚合，allowlist 维度+指标
  makePolicy({
    id: 506,
    table_id: 1000,
    role_group_id: 21,
    row_access_mode: "all",
    field_access_mode: "allowlist",
    allowed_field_ids: [104, 105, 107, 108, 110],
    disclosure_level: "L2",
  }),
  // 外部协作 Skill — L0 禁止
  makePolicy({
    id: 507,
    table_id: 1000,
    role_group_id: 22,
    row_access_mode: "none",
    field_access_mode: "all",
    disclosure_level: "L0",
  }),
  // 审批助手 Skill — L4 全字段，需审批
  makePolicy({
    id: 508,
    table_id: 1000,
    role_group_id: 23,
    row_access_mode: "all",
    field_access_mode: "allowlist",
    allowed_field_ids: [101, 102, 108],
    disclosure_level: "L4",
    tool_permission_mode: "readonly",
  }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// V2 Skill grant 基线
// ═══════════════════════════════════════════════════════════════════════════════

export const V2_SKILL_GRANTS: SkillDataGrant[] = [
  makeGrant({
    id: 601,
    skill_id: 401,
    skill_name: "客户风险判断 Skill",
    table_id: 1000,
    view_id: 52,
    view_name: "Skill_runtime_风控视图",
    max_disclosure_level: "L1",
    role_group_id: 20,
    approval_required: false,
    audit_level: "standard",
  }),
  makeGrant({
    id: 602,
    skill_id: 402,
    skill_name: "经营汇总 Skill",
    table_id: 1000,
    view_id: 51,
    view_name: "管理汇总视图",
    max_disclosure_level: "L2",
    role_group_id: 21,
    approval_required: false,
    audit_level: "standard",
  }),
  makeGrant({
    id: 603,
    skill_id: 403,
    skill_name: "外部协作 Skill",
    table_id: 1000,
    view_id: null,
    view_name: null,
    max_disclosure_level: "L0",
    role_group_id: 22,
    grant_mode: "deny",
    approval_required: false,
    audit_level: "full",
  }),
  makeGrant({
    id: 604,
    skill_id: 404,
    skill_name: "审批助手 Skill",
    table_id: 1000,
    view_id: 53,
    view_name: "审批高敏视图",
    max_disclosure_level: "L4",
    role_group_id: 23,
    approval_required: true,
    audit_level: "full",
  }),
];

// ═══════════════════════════════════════════════════════════════════════════════
// V2 Skill bindings
// ═══════════════════════════════════════════════════════════════════════════════

export const V2_BINDINGS: SkillBindingDetail[] = [
  { skill_id: 401, skill_name: "客户风险判断 Skill", binding_id: 1, view_id: 52, view_name: "Skill_runtime_风控视图", binding_type: "data_query", alias: null, status: "healthy" },
  { skill_id: 402, skill_name: "经营汇总 Skill", binding_id: 2, view_id: 51, view_name: "管理汇总视图", binding_type: "data_query", alias: null, status: "healthy" },
  { skill_id: 403, skill_name: "外部协作 Skill", binding_id: null, view_id: null, view_name: null, binding_type: null, alias: null, status: "legacy_unbound" },
  { skill_id: 404, skill_name: "审批助手 Skill", binding_id: 3, view_id: 53, view_name: "审批高敏视图", binding_type: "data_query", alias: null, status: "healthy" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// V2 完整 TableDetail
// ═══════════════════════════════════════════════════════════════════════════════

export function makeV2TableA(overrides: Partial<TableDetail> = {}): TableDetail {
  return makeTableDetail({
    id: 1000,
    table_name: "customers_master",
    display_name: "客户主表",
    description: "含高敏字段的客户主数据表",
    folder_id: 1,
    source_type: "bitable",
    record_count: 120,
    fields: V2_FIELDS_A,
    views: V2_VIEWS,
    bindings: V2_BINDINGS,
    role_groups: V2_ROLE_GROUPS,
    permission_policies: V2_POLICIES,
    skill_grants: V2_SKILL_GRANTS,
    ...overrides,
  });
}

export function makeV2TableB(overrides: Partial<TableDetail> = {}): TableDetail {
  return makeTableDetail({
    id: 1001,
    table_name: "sales_orders",
    display_name: "销售流水",
    description: "销售订单流水表",
    folder_id: 1,
    source_type: "bitable",
    record_count: 300,
    fields: V2_FIELDS_B,
    views: [],
    bindings: [],
    role_groups: [],
    permission_policies: [],
    skill_grants: [],
    ...overrides,
  });
}

export function makeV2TableC(overrides: Partial<TableDetail> = {}): TableDetail {
  return makeTableDetail({
    id: 1002,
    table_name: "employee_comp",
    display_name: "员工薪酬表",
    description: "外部 PostgreSQL 员工薪酬数据",
    folder_id: 2,
    source_type: "postgresql",
    record_count: 500,
    fields: V2_FIELDS_C,
    views: [],
    bindings: [],
    role_groups: [],
    permission_policies: [],
    skill_grants: [],
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// V2 辅助类型（风险评估、输出审查等 V2 新增概念）
// ═══════════════════════════════════════════════════════════════════════════════

/** V2 风险评分因子 */
export interface RiskFactor {
  code: string;
  label: string;
  score: number;
  description: string;
}

/** V2 风险评估结果 */
export interface RiskAssessment {
  total_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  factors: RiskFactor[];
}

/** V2 输出审查动作 */
export type OutputReviewAction = "pass" | "redact_and_continue" | "block_response";

/** V2 输出审查日志 */
export interface OutputReviewLog {
  id: number;
  skill_id: number;
  table_id: number;
  action: OutputReviewAction;
  original_snippet: string;
  processed_snippet: string;
  reason: string;
  triggered_at: string;
}

/** V2 审批单 */
export interface ApprovalRequest {
  id: number;
  table_id: number;
  request_type: string;
  status: "pending" | "approved" | "rejected";
  requested_by: number;
  reviewed_by: number | null;
  config_snapshot: Record<string, unknown>;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** V2 策略版本 */
export interface PolicyVersion {
  version: number;
  table_id: number;
  snapshot: Record<string, unknown>;
  changed_by: number;
  change_type: "create" | "update" | "rollback";
  created_at: string;
}

/** V2 外部源画像 */
export interface SourceProfile {
  source_type: string;
  supports_row_pushdown: boolean;
  supports_column_pruning: boolean;
  supports_native_masking: boolean;
  pushdown_ratio: number;
  security_level: "high" | "medium" | "low";
}

/** V2 小样本保护配置 */
export interface SmallSampleProtection {
  enabled: boolean;
  min_group_size: number;
  action: "suppress" | "generalize";
}

// ─── V2 mock 工厂 ────────────────────────────────────────────────────────────

export function makeRiskAssessment(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return {
    total_score: 65,
    risk_level: "medium",
    factors: [
      { code: "sensitive_fields", label: "高敏字段数", score: 20, description: "3 个 S3+ 字段" },
      { code: "external_source", label: "外部数据源", score: 15, description: "PostgreSQL 外部源" },
      { code: "whole_table_binding", label: "整表绑定", score: 15, description: "1 个 Skill 整表绑定" },
      { code: "exportable", label: "可导出", score: 15, description: "2 个角色组可导出" },
    ],
    ...overrides,
  };
}

export function makeOutputReviewLog(overrides: Partial<OutputReviewLog> = {}): OutputReviewLog {
  return {
    id: 1,
    skill_id: 401,
    table_id: 1000,
    action: "pass",
    original_snippet: "",
    processed_snippet: "",
    reason: "",
    triggered_at: "2026-03-30T10:00:00Z",
    ...overrides,
  };
}

export function makeApprovalRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    id: 1,
    table_id: 1000,
    request_type: "disclosure_upgrade",
    status: "pending",
    requested_by: 1,
    reviewed_by: null,
    config_snapshot: {},
    reject_reason: null,
    created_at: "2026-03-30T10:00:00Z",
    reviewed_at: null,
    ...overrides,
  };
}

export function makePolicyVersion(overrides: Partial<PolicyVersion> = {}): PolicyVersion {
  return {
    version: 1,
    table_id: 1000,
    snapshot: {},
    changed_by: 1,
    change_type: "create",
    created_at: "2026-03-30T10:00:00Z",
    ...overrides,
  };
}

export function makeSourceProfile(overrides: Partial<SourceProfile> = {}): SourceProfile {
  return {
    source_type: "postgresql",
    supports_row_pushdown: true,
    supports_column_pruning: true,
    supports_native_masking: false,
    pushdown_ratio: 0.85,
    security_level: "medium",
    ...overrides,
  };
}

export function makeSmallSampleProtection(overrides: Partial<SmallSampleProtection> = {}): SmallSampleProtection {
  return {
    enabled: true,
    min_group_size: 5,
    action: "suppress",
    ...overrides,
  };
}
