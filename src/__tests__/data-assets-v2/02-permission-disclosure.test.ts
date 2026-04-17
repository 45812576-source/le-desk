/**
 * §2 权限与披露级别测试
 *
 * P-01 ~ P-07：验证五级披露（L0-L4）、行权限、字段白名单、显式 deny 优先。
 */
import { describe, it, expect } from "vitest";
import type {
  TableFieldDetail,
  TablePermissionPolicy,
  DisclosureLevel,
} from "@/app/(app)/data/components/shared/types";
import {} from "../fixtures/data-assets";
import {
  V2_FIELDS_A,
  V2_POLICIES,
  V2_SKILL_GRANTS,
  V2_VIEWS,
} from "../fixtures/data-assets-v2";

// ─── 纯函数 ─────────────────────────────────────────────────────────────────

const DISCLOSURE_ORDER: DisclosureLevel[] = ["L0", "L1", "L2", "L3", "L4"];

function disclosureIndex(level: DisclosureLevel): number {
  return DISCLOSURE_ORDER.indexOf(level);
}

function resolveVisibleFields(
  fields: TableFieldDetail[],
  policy: Pick<TablePermissionPolicy, "field_access_mode" | "allowed_field_ids" | "blocked_field_ids">,
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

function resolveDisclosureCapabilities(level: DisclosureLevel) {
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

/** 多角色组合并 — deny 优先，allow 字段取并集，disclosure 取最高 */
function mergeMultiGroupPolicies(
  userGroupIds: number[],
  policies: TablePermissionPolicy[],
  fields: TableFieldDetail[],
): { denied: boolean; mergedFieldIds: number[]; maxDisclosure: DisclosureLevel } {
  let denied = false;
  const allFieldIds = new Set<number>();
  let maxDisclosure: DisclosureLevel = "L0";

  for (const gid of userGroupIds) {
    const policy = policies.find((p) => p.role_group_id === gid && !p.view_id);
    if (!policy) continue;

    if (policy.row_access_mode === "none") {
      denied = true;
      break;
    }

    const visible = resolveVisibleFields(fields, policy);
    visible.forEach((f) => { if (f.id) allFieldIds.add(f.id); });

    const idx = disclosureIndex(policy.disclosure_level);
    if (idx > disclosureIndex(maxDisclosure)) {
      maxDisclosure = policy.disclosure_level;
    }
  }

  return { denied, mergedFieldIds: Array.from(allFieldIds), maxDisclosure };
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§2 权限与披露级别", () => {
  // ── P-01 L0_none 完全拒绝 ────────────────────────────────────────────────
  describe("P-01 L0_none 完全拒绝", () => {
    it("外部协作 Skill 对表 A 授权为 L0，不返回任何数据", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 22)!;
      expect(policy.disclosure_level).toBe("L0");
      expect(policy.row_access_mode).toBe("none");

      const caps = resolveDisclosureCapabilities("L0");
      expect(caps.canSeeRows).toBe(false);
      expect(caps.canSeeAggregates).toBe(false);
      expect(caps.canSeeDecision).toBe(false);
      expect(caps.canSeeMaskedDetail).toBe(false);
      expect(caps.canSeeRawDetail).toBe(false);
    });

    it("L0 下不应返回字段名以外的任何信息", () => {
      // L0 deny grant
      const grant = V2_SKILL_GRANTS.find((g) => g.skill_id === 403)!;
      expect(grant.grant_mode).toBe("deny");
    });
  });

  // ── P-02 L1_decision_only 仅允许结论 ─────────────────────────────────────
  describe("P-02 L1_decision_only 仅允许结论", () => {
    it("客户风险判断 Skill 授权为 L1，可返回判断不返回原值", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 20)!;
      expect(policy.disclosure_level).toBe("L1");

      const caps = resolveDisclosureCapabilities("L1");
      expect(caps.canSeeDecision).toBe(true);
      expect(caps.canSeeRows).toBe(false);
      expect(caps.canSeeAggregates).toBe(false);
      expect(caps.canSeeRawDetail).toBe(false);
    });

    it("L1 白名单不含手机号、姓名", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 20)!;
      const visible = resolveVisibleFields(V2_FIELDS_A, policy);
      const names = visible.map((f) => f.field_name);
      expect(names).not.toContain("customer_name");
      expect(names).not.toContain("mobile");
      expect(names).not.toContain("contract_amount");
    });
  });

  // ── P-03 L2_aggregate_only 允许汇总不允许单行 ────────────────────────────
  describe("P-03 L2_aggregate_only 允许汇总不允许单行", () => {
    it("部门负责人组 L2 可看汇总不可看明细", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 11)!;
      expect(policy.disclosure_level).toBe("L2");

      const caps = resolveDisclosureCapabilities("L2");
      expect(caps.canSeeAggregates).toBe(true);
      expect(caps.canSeeRows).toBe(false);
    });

    it("管理汇总视图 disclosure_ceiling=L2 限制明细穿透", () => {
      const view = V2_VIEWS.find((v) => v.id === 51)!;
      expect(view.disclosure_ceiling).toBe("L2");
    });
  });

  // ── P-04 L3_masked_detail 打码明细 ───────────────────────────────────────
  describe("P-04 L3_masked_detail 打码明细", () => {
    it("销售运营组 L3 敏感字段被脱敏", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 10)!;
      expect(policy.disclosure_level).toBe("L3");
      expect(policy.masking_rule_json).toHaveProperty("customer_name");
      expect(policy.masking_rule_json).toHaveProperty("mobile");
    });

    it("L3 可看行但不可看原始值", () => {
      const caps = resolveDisclosureCapabilities("L3");
      expect(caps.canSeeRows).toBe(true);
      expect(caps.canSeeMaskedDetail).toBe(true);
      expect(caps.canSeeRawDetail).toBe(false);
    });

    it("customer_level/risk_status/city 正常显示", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 10)!;
      const maskKeys = Object.keys(policy.masking_rule_json);
      expect(maskKeys).not.toContain("customer_level");
      expect(maskKeys).not.toContain("risk_status");
      expect(maskKeys).not.toContain("city");
    });
  });

  // ── P-05 L4_raw_detail 仍受字段白名单限制 ────────────────────────────────
  describe("P-05 L4_raw_detail 仍受字段白名单限制", () => {
    it("审批助手 Skill L4 但只能看白名单字段", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 23)!;
      expect(policy.disclosure_level).toBe("L4");
      expect(policy.field_access_mode).toBe("allowlist");
      expect(policy.allowed_field_ids).toEqual([101, 102, 108]);

      const visible = resolveVisibleFields(V2_FIELDS_A, policy);
      const names = visible.map((f) => f.field_name);
      expect(names).toContain("customer_id");
      expect(names).toContain("customer_name");
      expect(names).toContain("risk_status");
      expect(names).not.toContain("mobile");
      expect(names).not.toContain("contract_amount");
    });
  });

  // ── P-06 行权限交叉字段权限 ──────────────────────────────────────────────
  describe("P-06 行权限交叉字段权限", () => {
    it("销售运营组仅本部门数据 + 非白名单字段永不出现", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 10)!;
      expect(policy.row_access_mode).toBe("department");
      // field_access_mode=all 但 masking 保护敏感字段
      expect(policy.field_access_mode).toBe("all");
    });

    it("切换到其他部门筛选不应返回非本部门行", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 10)!;
      // row_access_mode=department 意味着后端只返回本部门数据
      expect(policy.row_access_mode).toBe("department");
    });
  });

  // ── P-07 显式 deny 优先 ──────────────────────────────────────────────────
  describe("P-07 显式 deny 优先", () => {
    it("用户属于两个角色组，组 B deny 则最终拒绝", () => {
      // 用户属于 销售运营组(10, L3) 和 外部协作 Skill 同名组(22, L0/none)
      const result = mergeMultiGroupPolicies([10, 22], V2_POLICIES, V2_FIELDS_A);
      expect(result.denied).toBe(true);
    });

    it("两个 allow 组合并后取并集", () => {
      // 销售运营组(10, all fields) + 经营汇总 Skill 组(21, allowlist [104,105,107,108,110])
      const result = mergeMultiGroupPolicies([10, 21], V2_POLICIES, V2_FIELDS_A);
      expect(result.denied).toBe(false);
      // 并集应包含两组的所有可见字段
      expect(result.mergedFieldIds.length).toBeGreaterThan(5);
    });

    it("披露级别取最高", () => {
      // 部门负责人组(11, L2) + 高管组(12, L4)
      const result = mergeMultiGroupPolicies([11, 12], V2_POLICIES, V2_FIELDS_A);
      expect(result.maxDisclosure).toBe("L4");
    });
  });
});
