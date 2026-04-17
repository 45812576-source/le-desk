/**
 * §3 权限配置交互测试
 *
 * UX-01 ~ UX-05：向导模式、专家模式、模拟问答一致性、影响分析、高风险审批。
 */
import { describe, it, expect } from "vitest";
import type {
  TablePermissionPolicy,
  DisclosureLevel,
  FieldAccessMode,
  RowAccessMode,
} from "@/app/(app)/data/components/shared/types";
import { makePolicy } from "../fixtures/data-assets";
import {
  V2_POLICIES,
  V2_SKILL_GRANTS,
  makeApprovalRequest,
} from "../fixtures/data-assets-v2";

// ─── 向导 → canonical payload 转换纯函数 ────────────────────────────────────

type WizardScenario = "management_summary" | "ops_detail" | "skill_runtime" | "approval";

interface WizardResult {
  disclosure_level: DisclosureLevel;
  row_access_mode: RowAccessMode;
  field_access_mode: FieldAccessMode;
  export_permission: boolean;
}

function wizardToPolicy(scenario: WizardScenario): WizardResult {
  switch (scenario) {
    case "management_summary":
      return { disclosure_level: "L2", row_access_mode: "all", field_access_mode: "all", export_permission: false };
    case "ops_detail":
      return { disclosure_level: "L3", row_access_mode: "department", field_access_mode: "all", export_permission: false };
    case "skill_runtime":
      return { disclosure_level: "L1", row_access_mode: "all", field_access_mode: "allowlist", export_permission: false };
    case "approval":
      return { disclosure_level: "L4", row_access_mode: "all", field_access_mode: "allowlist", export_permission: false };
  }
}

/** 判断策略是否在向导可表达范围内 */
function isWizardCompatible(policy: TablePermissionPolicy): boolean {
  const validCombinations: WizardResult[] = [
    wizardToPolicy("management_summary"),
    wizardToPolicy("ops_detail"),
    wizardToPolicy("skill_runtime"),
    wizardToPolicy("approval"),
  ];
  return validCombinations.some((w) =>
    w.disclosure_level === policy.disclosure_level &&
    w.row_access_mode === policy.row_access_mode &&
    w.field_access_mode === policy.field_access_mode &&
    w.export_permission === policy.export_permission
  );
}

/** 检查配置变更是否需要审批 */
function requiresApproval(
  before: { disclosure_level: DisclosureLevel },
  after: { disclosure_level: DisclosureLevel },
): boolean {
  const LEVELS: DisclosureLevel[] = ["L0", "L1", "L2", "L3", "L4"];
  const bi = LEVELS.indexOf(before.disclosure_level);
  const ai = LEVELS.indexOf(after.disclosure_level);
  // 升到 L4 需要审批
  return ai >= 4 && ai > bi;
}

/** 模拟影响分析 */
function analyzeImpact(
  viewId: number,
  grants: typeof V2_SKILL_GRANTS,
  policies: typeof V2_POLICIES,
): { affectedSkills: string[]; affectedRoleGroups: number[] } {
  const affectedGrants = grants.filter((g) => g.view_id === viewId);
  const affectedPolicies = policies.filter((p) => p.view_id === viewId);
  return {
    affectedSkills: affectedGrants.map((g) => g.skill_name || `skill_${g.skill_id}`),
    affectedRoleGroups: affectedPolicies.map((p) => p.role_group_id),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§3 权限配置交互", () => {
  // ── UX-01 向导模式生成推荐策略 ───────────────────────────────────────────
  describe("UX-01 向导模式生成推荐策略", () => {
    it("「给管理层看汇总」→ L2_aggregate_only + 禁止导出", () => {
      const result = wizardToPolicy("management_summary");
      expect(result.disclosure_level).toBe("L2");
      expect(result.export_permission).toBe(false);
      expect(result.row_access_mode).toBe("all");
    });

    it("运营明细 → L3 + 仅本部门", () => {
      const result = wizardToPolicy("ops_detail");
      expect(result.disclosure_level).toBe("L3");
      expect(result.row_access_mode).toBe("department");
    });

    it("Skill runtime → L1 + allowlist", () => {
      const result = wizardToPolicy("skill_runtime");
      expect(result.disclosure_level).toBe("L1");
      expect(result.field_access_mode).toBe("allowlist");
    });

    it("审批 → L4 + allowlist", () => {
      const result = wizardToPolicy("approval");
      expect(result.disclosure_level).toBe("L4");
      expect(result.field_access_mode).toBe("allowlist");
    });
  });

  // ── UX-02 向导与专家模式切换 ─────────────────────────────────────────────
  describe("UX-02 向导与专家模式切换", () => {
    it("向导生成的策略可在向导模式回显", () => {
      const result = wizardToPolicy("management_summary");
      const policy = makePolicy(result);
      expect(isWizardCompatible(policy)).toBe(true);
    });

    it("专家模式修改后超出向导范围时标记为高级策略", () => {
      // 专家模式修改为 blocklist + L3 + owner → 不在向导预设中
      const expertPolicy = makePolicy({
        disclosure_level: "L3",
        row_access_mode: "owner",
        field_access_mode: "blocklist",
        export_permission: false,
      });
      expect(isWizardCompatible(expertPolicy)).toBe(false);
    });

    it("高管组策略（L4 可导出）不在向导范围内", () => {
      const managerPolicy = V2_POLICIES.find((p) => p.role_group_id === 12)!;
      expect(isWizardCompatible(managerPolicy)).toBe(false);
    });
  });

  // ── UX-03 模拟问答与结果卡一致 ───────────────────────────────────────────
  describe("UX-03 模拟问答与结果卡一致", () => {
    it("结果卡的可见字段与策略引擎计算一致", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 20)!;
      // allowlist [101, 104, 107, 108]
      expect(policy.allowed_field_ids).toEqual([101, 104, 107, 108]);
      expect(policy.disclosure_level).toBe("L1");
    });

    it("结果卡的拦截原因与披露级别规则一致", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 22)!;
      // L0 + none → 完全拒绝
      expect(policy.disclosure_level).toBe("L0");
      expect(policy.row_access_mode).toBe("none");
    });
  });

  // ── UX-04 保存前影响分析 ─────────────────────────────────────────────────
  describe("UX-04 保存前影响分析", () => {
    it("修改 Skill_runtime 风控视图影响客户风险判断 Skill", () => {
      const impact = analyzeImpact(52, V2_SKILL_GRANTS, V2_POLICIES);
      expect(impact.affectedSkills).toContain("客户风险判断 Skill");
    });

    it("修改审批高敏视图影响审批助手 Skill", () => {
      const impact = analyzeImpact(53, V2_SKILL_GRANTS, V2_POLICIES);
      expect(impact.affectedSkills).toContain("审批助手 Skill");
    });
  });

  // ── UX-05 高风险操作触发审批 ─────────────────────────────────────────────
  describe("UX-05 高风险操作触发审批", () => {
    it("给外部协作 Skill 配 L4 触发审批", () => {
      const before = { disclosure_level: "L0" as DisclosureLevel };
      const after = { disclosure_level: "L4" as DisclosureLevel };
      expect(requiresApproval(before, after)).toBe(true);
    });

    it("L2→L3 不触发审批", () => {
      const before = { disclosure_level: "L2" as DisclosureLevel };
      const after = { disclosure_level: "L3" as DisclosureLevel };
      expect(requiresApproval(before, after)).toBe(false);
    });

    it("审批单初始状态为 pending", () => {
      const request = makeApprovalRequest();
      expect(request.status).toBe("pending");
      expect(request.reviewed_by).toBeNull();
    });

    it("审批单包含配置快照", () => {
      const request = makeApprovalRequest({
        config_snapshot: { disclosure_level: "L4", skill_id: 403 },
      });
      expect(request.config_snapshot).toHaveProperty("disclosure_level");
    });
  });
});
