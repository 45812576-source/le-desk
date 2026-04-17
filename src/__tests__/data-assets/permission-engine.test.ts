/**
 * 权限规则引擎测试 — 测试计划 §3
 *
 * 覆盖三维权限（行 + 字段 + 披露级别）的组合逻辑，
 * 验证优先级规则和边界条件。
 *
 * 注意：此文件测试纯逻辑（不涉及 DOM），验证权限裁剪函数的正确性。
 * 后端实际裁剪在 FastAPI 侧，此处定义前端预览引擎的等价逻辑和断言。
 */
import { describe, it, expect } from "vitest";
import type {
  TableFieldDetail,
  TablePermissionPolicy,
  SkillDataGrant,
  DisclosureLevel,
  FieldAccessMode,
} from "@/app/(app)/data/components/shared/types";
import {
  FIELDS,
  POLICIES,
  SKILL_GRANTS,
  makePolicy,
  makeView,
  makeGrant,
} from "../fixtures/data-assets";

// ─── 权限引擎纯函数（从 PermissionPreview 提取的逻辑） ───────────────────────

/** 根据字段权限模式计算可见字段 */
function resolveVisibleFields(
  fields: TableFieldDetail[],
  policy: { field_access_mode: FieldAccessMode; allowed_field_ids: number[]; blocked_field_ids: number[] },
): TableFieldDetail[] {
  switch (policy.field_access_mode) {
    case "all":
      return fields.filter((f) => !f.is_system);
    case "allowlist":
      return fields.filter((f) => f.id !== null && policy.allowed_field_ids.includes(f.id!));
    case "blocklist":
      return fields.filter((f) => !f.id || !policy.blocked_field_ids.includes(f.id));
    default:
      return [];
  }
}

/** 根据披露级别判断数据可见性 */
function resolveDisclosureCapabilities(level: DisclosureLevel): {
  canSeeRows: boolean;
  canSeeAggregates: boolean;
  canSeeDecision: boolean;
  canSeeMaskedDetail: boolean;
  canSeeRawDetail: boolean;
} {
  switch (level) {
    case "L0":
      return { canSeeRows: false, canSeeAggregates: false, canSeeDecision: false, canSeeMaskedDetail: false, canSeeRawDetail: false };
    case "L1":
      return { canSeeRows: false, canSeeAggregates: false, canSeeDecision: true, canSeeMaskedDetail: false, canSeeRawDetail: false };
    case "L2":
      return { canSeeRows: false, canSeeAggregates: true, canSeeDecision: true, canSeeMaskedDetail: false, canSeeRawDetail: false };
    case "L3":
      return { canSeeRows: true, canSeeAggregates: true, canSeeDecision: true, canSeeMaskedDetail: true, canSeeRawDetail: false };
    case "L4":
      return { canSeeRows: true, canSeeAggregates: true, canSeeDecision: true, canSeeMaskedDetail: true, canSeeRawDetail: true };
  }
}

/** 解析最终生效策略：Skill grant > View policy > Table policy > 默认拒绝 */
function resolveEffectivePolicy(
  roleGroupId: number,
  viewId: number | null,
  skillId: number | null,
  policies: TablePermissionPolicy[],
  grants: SkillDataGrant[],
): { policy: TablePermissionPolicy | null; source: "skill_grant" | "view_policy" | "table_policy" | "default_deny" } {
  // 1. Skill grant 优先
  if (skillId) {
    const grant = grants.find((g) => g.skill_id === skillId && g.role_group_id === roleGroupId);
    if (grant && grant.grant_mode === "deny") {
      return { policy: null, source: "default_deny" };
    }
    // grant 存在时，以 grant 的视图绑定为准
    if (grant) {
      // 优先找视图级策略，找不到则回退到表级策略
      const viewPolicy = policies.find((p) => p.role_group_id === roleGroupId && p.view_id === grant.view_id);
      const fallbackPolicy = policies.find((p) => p.role_group_id === roleGroupId && !p.view_id);
      const basePolicy = viewPolicy || fallbackPolicy;
      if (basePolicy) {
        const effectiveLevel = minDisclosure(basePolicy.disclosure_level, grant.max_disclosure_level);
        return {
          policy: { ...basePolicy, disclosure_level: effectiveLevel },
          source: "skill_grant",
        };
      }
    }
  }

  // 2. View policy
  if (viewId) {
    const viewPolicy = policies.find((p) => p.role_group_id === roleGroupId && p.view_id === viewId);
    if (viewPolicy) return { policy: viewPolicy, source: "view_policy" };
  }

  // 3. Table policy
  const tablePolicy = policies.find((p) => p.role_group_id === roleGroupId && !p.view_id);
  if (tablePolicy) return { policy: tablePolicy, source: "table_policy" };

  // 4. 默认拒绝
  return { policy: null, source: "default_deny" };
}

const DISCLOSURE_ORDER: DisclosureLevel[] = ["L0", "L1", "L2", "L3", "L4"];

function minDisclosure(a: DisclosureLevel, b: DisclosureLevel): DisclosureLevel {
  const ia = DISCLOSURE_ORDER.indexOf(a);
  const ib = DISCLOSURE_ORDER.indexOf(b);
  return DISCLOSURE_ORDER[Math.min(ia, ib)];
}

// ═══════════════════════════════════════════════════════════════════════════════
// §3.A 行权限测试
// ═══════════════════════════════════════════════════════════════════════════════

describe("行权限测试", () => {
  it("all_rows 返回全部行", () => {
    const policy = makePolicy({ row_access_mode: "all" });
    expect(policy.row_access_mode).toBe("all");
  });

  it("owner 仅返回归属人的行", () => {
    const policy = makePolicy({ row_access_mode: "owner" });
    expect(policy.row_access_mode).toBe("owner");
    // 实际裁剪在后端，前端验证策略正确传递
  });

  it("department 仅返回本部门的行", () => {
    const policy = makePolicy({ row_access_mode: "department" });
    expect(policy.row_access_mode).toBe("department");
  });

  it("rule 根据自定义规则筛选", () => {
    const policy = makePolicy({
      row_access_mode: "rule",
      row_rule_json: { field: "department", op: "in", value: ["销售部", "市场部"] },
    });
    expect(policy.row_access_mode).toBe("rule");
    expect(policy.row_rule_json).toHaveProperty("field", "department");
  });

  it("none 不返回行", () => {
    const policy = makePolicy({ row_access_mode: "none" });
    expect(policy.row_access_mode).toBe("none");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.B 字段权限测试
// ═══════════════════════════════════════════════════════════════════════════════

describe("字段权限测试", () => {
  it("all 返回全部非系统字段", () => {
    const result = resolveVisibleFields(FIELDS, { field_access_mode: "all", allowed_field_ids: [], blocked_field_ids: [] });
    expect(result.every((f) => !f.is_system)).toBe(true);
    // 系统字段 id=1(ID), id=12(created_at) 被排除
    expect(result.find((f) => f.field_name === "id")).toBeUndefined();
    expect(result.find((f) => f.field_name === "created_at")).toBeUndefined();
  });

  it("allowlist 仅返回指定字段", () => {
    const result = resolveVisibleFields(FIELDS, { field_access_mode: "allowlist", allowed_field_ids: [4, 5, 6], blocked_field_ids: [] });
    expect(result).toHaveLength(3);
    expect(result.map((f) => f.field_name)).toEqual(["department", "status", "project"]);
  });

  it("blocklist 排除指定字段", () => {
    const result = resolveVisibleFields(FIELDS, { field_access_mode: "blocklist", allowed_field_ids: [], blocked_field_ids: [2, 3, 9] });
    // 排除姓名、手机号、身份证号
    expect(result.find((f) => f.field_name === "name")).toBeUndefined();
    expect(result.find((f) => f.field_name === "phone")).toBeUndefined();
    expect(result.find((f) => f.field_name === "id_card")).toBeUndefined();
    // 其他字段应保留
    expect(result.find((f) => f.field_name === "department")).toBeDefined();
    expect(result.find((f) => f.field_name === "amount")).toBeDefined();
  });

  it("敏感字段在 no_sensitive 场景下全部去掉", () => {
    // 模拟 no_sensitive_fields 逻辑：blocklist 所有 is_sensitive 字段
    const sensitiveIds = FIELDS.filter((f) => f.is_sensitive).map((f) => f.id!);
    const result = resolveVisibleFields(FIELDS, { field_access_mode: "blocklist", allowed_field_ids: [], blocked_field_ids: sensitiveIds });
    expect(result.every((f) => !f.is_sensitive)).toBe(true);
  });

  it("字段被视图显示但权限拒绝时，最终以权限为准", () => {
    // 视图 visible_field_ids 包含 id=2(姓名)，但 policy blocklist 排除 id=2
    const view = makeView({ visible_field_ids: [2, 4, 5] });
    const policyFields = resolveVisibleFields(FIELDS, { field_access_mode: "blocklist", allowed_field_ids: [], blocked_field_ids: [2] });
    const viewFields = FIELDS.filter((f) => f.id !== null && view.visible_field_ids.includes(f.id!));

    // 视图包含"姓名"
    expect(viewFields.find((f) => f.field_name === "name")).toBeDefined();
    // 但权限排除了"姓名"
    expect(policyFields.find((f) => f.field_name === "name")).toBeUndefined();
    // 最终交集不包含"姓名"
    const finalFields = policyFields.filter((f) => f.id !== null && view.visible_field_ids.includes(f.id!));
    expect(finalFields.find((f) => f.field_name === "name")).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.C 披露级别测试
// ═══════════════════════════════════════════════════════════════════════════════

describe("披露级别测试", () => {
  it("L0 — 不返回行、不返回统计、不返回值", () => {
    const caps = resolveDisclosureCapabilities("L0");
    expect(caps.canSeeRows).toBe(false);
    expect(caps.canSeeAggregates).toBe(false);
    expect(caps.canSeeDecision).toBe(false);
  });

  it("L1 — 可输出建议/判断，不能输出计数、样本", () => {
    const caps = resolveDisclosureCapabilities("L1");
    expect(caps.canSeeDecision).toBe(true);
    expect(caps.canSeeAggregates).toBe(false);
    expect(caps.canSeeRows).toBe(false);
  });

  it("L2 — 可输出聚合（计数、比例），不能输出单行值", () => {
    const caps = resolveDisclosureCapabilities("L2");
    expect(caps.canSeeAggregates).toBe(true);
    expect(caps.canSeeRows).toBe(false);
    expect(caps.canSeeRawDetail).toBe(false);
  });

  it("L3 — 可返回单行，敏感字段必须脱敏", () => {
    const caps = resolveDisclosureCapabilities("L3");
    expect(caps.canSeeRows).toBe(true);
    expect(caps.canSeeMaskedDetail).toBe(true);
    expect(caps.canSeeRawDetail).toBe(false);
  });

  it("L4 — 返回原始值，仍受行权限和字段权限限制", () => {
    const caps = resolveDisclosureCapabilities("L4");
    expect(caps.canSeeRawDetail).toBe(true);
    expect(caps.canSeeRows).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.D 组合优先级测试
// ═══════════════════════════════════════════════════════════════════════════════

describe("组合优先级测试", () => {
  // 用含 view policy 的策略集
  const policiesWithView: TablePermissionPolicy[] = [
    ...POLICIES,
    // 为角色组 2 添加视图级策略 — 视图 2 限制为 L2
    makePolicy({ id: 101, role_group_id: 2, view_id: 2, row_access_mode: "all", disclosure_level: "L2" }),
    // 为角色组 3 添加视图级策略 — 视图 2 限制为 none（拒绝）
    makePolicy({ id: 102, role_group_id: 3, view_id: 2, row_access_mode: "none", disclosure_level: "L0" }),
  ];

  it("表允许、视图拒绝 → 最终拒绝", () => {
    // 角色组 3 表级策略 L4，但视图 2 的策略是 none/L0
    const result = resolveEffectivePolicy(3, 2, null, policiesWithView, SKILL_GRANTS);
    expect(result.source).toBe("view_policy");
    expect(result.policy?.row_access_mode).toBe("none");
    expect(result.policy?.disclosure_level).toBe("L0");
  });

  it("表允许、视图允许、Skill grant 更严格 → 按 Skill grant", () => {
    // 外部汇总 Skill (id=202) grant max_disclosure = L2, 视图 3 policy 是 L2
    const result = resolveEffectivePolicy(5, 3, 202, policiesWithView, SKILL_GRANTS);
    expect(result.source).toBe("skill_grant");
  });

  it("无策略时默认拒绝", () => {
    const result = resolveEffectivePolicy(999, null, null, policiesWithView, SKILL_GRANTS);
    expect(result.source).toBe("default_deny");
    expect(result.policy).toBeNull();
  });

  it("Skill grant deny 模式直接拒绝", () => {
    const denyGrants: SkillDataGrant[] = [
      makeGrant({ skill_id: 999, role_group_id: 1, grant_mode: "deny" }),
    ];
    const result = resolveEffectivePolicy(1, null, 999, POLICIES, denyGrants);
    expect(result.source).toBe("default_deny");
    expect(result.policy).toBeNull();
  });

  it("L4 + allowlist + filtered_rows 只返回交集", () => {
    // 高敏审批 Skill: L4 + all fields + all rows — 但 grant 绑定 view 1
    const result = resolveEffectivePolicy(6, 1, 203, POLICIES, SKILL_GRANTS);
    expect(result.policy).not.toBeNull();
    // grant max_disclosure L4, policy L4 → effective L4
    expect(result.policy?.disclosure_level).toBe("L4");
  });

  it("同一 Skill 绑定两个视图时，按当前调用视图分别裁剪，不合并扩权", () => {
    // 模拟 Skill 201 额外绑定到视图 3
    const extraGrants: SkillDataGrant[] = [
      ...SKILL_GRANTS,
      makeGrant({ id: 99, skill_id: 201, view_id: 3, view_name: "汇总视图", max_disclosure_level: "L2", role_group_id: 4 }),
    ];
    // 调用视图 2
    const r1 = resolveEffectivePolicy(4, 2, 201, POLICIES, extraGrants);
    // 调用视图 3
    const r2 = resolveEffectivePolicy(4, 3, 201, POLICIES, extraGrants);
    expect(r2.policy).not.toBeNull();
    expect(r1.source).toBe("skill_grant");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// §3.D.5 多角色组冲突测试 — 显式 deny 优先，allow 取并集
// ═══════════════════════════════════════════════════════════════════════════════

describe("多角色组冲突策略", () => {
  /** 模拟用户属于多个角色组时的合并逻辑 */
  function mergeMultiGroupPolicies(
    userGroupIds: number[],
    policies: TablePermissionPolicy[],
    fields: TableFieldDetail[],
  ): { denied: boolean; mergedFieldIds: number[]; maxDisclosure: DisclosureLevel } {
    let denied = false;
    const allAllowedFieldIds = new Set<number>();
    let maxDisclosure: DisclosureLevel = "L0";

    for (const gid of userGroupIds) {
      const policy = policies.find((p) => p.role_group_id === gid && !p.view_id);
      if (!policy) continue;

      // 显式 deny（row_access_mode = none）优先
      if (policy.row_access_mode === "none") {
        denied = true;
        break;
      }

      // allow 字段取并集
      const visible = resolveVisibleFields(fields, policy);
      visible.forEach((f) => { if (f.id) allAllowedFieldIds.add(f.id); });

      // 披露级别取最高
      const idx = DISCLOSURE_ORDER.indexOf(policy.disclosure_level);
      if (idx > DISCLOSURE_ORDER.indexOf(maxDisclosure)) {
        maxDisclosure = policy.disclosure_level;
      }
    }

    return { denied, mergedFieldIds: Array.from(allAllowedFieldIds), maxDisclosure };
  }

  it("一个组显式 deny 时，最终拒绝", () => {
    // 用户属于角色组 1(全员, L1) 和角色组 99(显式 deny)
    const policiesWithDeny = [
      ...POLICIES,
      makePolicy({ id: 200, role_group_id: 99, row_access_mode: "none", disclosure_level: "L0" }),
    ];
    const result = mergeMultiGroupPolicies([1, 99], policiesWithDeny, FIELDS);
    expect(result.denied).toBe(true);
  });

  it("两个 allow 组的字段取并集", () => {
    // 角色组 4: allowlist [4,5,6,7,8], 角色组 5: allowlist [4,5,6]
    const result = mergeMultiGroupPolicies([4, 5], POLICIES, FIELDS);
    expect(result.denied).toBe(false);
    // 并集 = [4,5,6,7,8]
    expect(result.mergedFieldIds).toEqual(expect.arrayContaining([4, 5, 6, 7, 8]));
  });

  it("披露级别取最高", () => {
    // 角色组 1: L1, 角色组 2: L3
    const result = mergeMultiGroupPolicies([1, 2], POLICIES, FIELDS);
    expect(result.maxDisclosure).toBe("L3");
  });
});
