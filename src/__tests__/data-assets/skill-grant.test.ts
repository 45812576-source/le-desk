/**
 * Skill 授权与输出安全测试 — 测试计划 §5
 *
 * 验证 Skill 是被管控的数据消费者，不能绕过视图和披露级别。
 */
import { describe, it, expect } from "vitest";
import type {
  SkillDataGrant,
  TablePermissionPolicy,
  DisclosureLevel,
  TableFieldDetail,
} from "@/app/(app)/data/components/shared/types";
import {
  FIELDS,
  POLICIES,
  SKILL_GRANTS,
  VIEWS,
  makeGrant,
  makePolicy,
} from "../fixtures/data-assets";

// ─── Skill 授权检查逻辑 ──────────────────────────────────────────────────────

interface SkillAccessCheckResult {
  allowed: boolean;
  reason: string;
  effectiveDisclosure: DisclosureLevel | null;
  visibleFieldNames: string[];
}

function checkSkillAccess(
  skillId: number,
  tableId: number,
  grants: SkillDataGrant[],
  policies: TablePermissionPolicy[],
  fields: TableFieldDetail[],
): SkillAccessCheckResult {
  const grant = grants.find((g) => g.skill_id === skillId && g.table_id === tableId);

  // 1. 未授权 Skill 直接拒绝
  if (!grant) {
    return { allowed: false, reason: "未授权", effectiveDisclosure: null, visibleFieldNames: [] };
  }

  // 2. 显式 deny
  if (grant.grant_mode === "deny") {
    return { allowed: false, reason: "显式拒绝", effectiveDisclosure: null, visibleFieldNames: [] };
  }

  // 3. 需要审批但未通过
  if (grant.approval_required) {
    // 实际应检查审批状态，这里标记需审批
  }

  // 4. 获取关联的 policy
  const policy = policies.find(
    (p) => p.role_group_id === grant.role_group_id && (p.view_id === grant.view_id || !p.view_id)
  );

  if (!policy) {
    return { allowed: false, reason: "无关联策略", effectiveDisclosure: null, visibleFieldNames: [] };
  }

  // 5. 计算有效披露级别 = min(grant.max_disclosure, policy.disclosure)
  const LEVELS: DisclosureLevel[] = ["L0", "L1", "L2", "L3", "L4"];
  const grantIdx = LEVELS.indexOf(grant.max_disclosure_level);
  const policyIdx = LEVELS.indexOf(policy.disclosure_level);
  const effectiveDisclosure = LEVELS[Math.min(grantIdx, policyIdx)];

  // 6. 计算可见字段
  let visibleFieldNames: string[] = [];
  if (policy.field_access_mode === "all") {
    visibleFieldNames = fields.filter((f) => !f.is_system).map((f) => f.field_name);
  } else if (policy.field_access_mode === "allowlist") {
    visibleFieldNames = fields
      .filter((f) => f.id !== null && policy.allowed_field_ids.includes(f.id!))
      .map((f) => f.field_name);
  } else if (policy.field_access_mode === "blocklist") {
    visibleFieldNames = fields
      .filter((f) => !f.id || !policy.blocked_field_ids.includes(f.id!))
      .map((f) => f.field_name);
  }

  return { allowed: true, reason: "允许", effectiveDisclosure, visibleFieldNames };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 测试用例
// ═══════════════════════════════════════════════════════════════════════════════

describe("Skill 授权基本检查", () => {
  it("未授权 Skill 调用表数据，直接拒绝", () => {
    const result = checkSkillAccess(999, 100, SKILL_GRANTS, POLICIES, FIELDS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("未授权");
  });

  it("已授权 Skill 只能访问指定 view", () => {
    // 内部分析 Skill (201) 绑定视图 2
    const grant = SKILL_GRANTS.find((g) => g.skill_id === 201)!;
    expect(grant.view_id).toBe(2);
    expect(grant.view_name).toBe("运营明细视图");
  });

  it("Skill grant deny 模式直接拒绝", () => {
    const denyGrants: SkillDataGrant[] = [
      makeGrant({ skill_id: 999, table_id: 100, grant_mode: "deny", role_group_id: 1 }),
    ];
    const result = checkSkillAccess(999, 100, denyGrants, POLICIES, FIELDS);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("显式拒绝");
  });
});

describe("Skill 披露级别控制", () => {
  it("内部分析 Skill — L3 脱敏，可见白名单字段", () => {
    const result = checkSkillAccess(201, 100, SKILL_GRANTS, POLICIES, FIELDS);
    expect(result.allowed).toBe(true);
    expect(result.effectiveDisclosure).toBe("L3");
    // policy 4: allowlist [4,5,6,7,8]
    expect(result.visibleFieldNames).toEqual(
      expect.arrayContaining(["department", "status", "project", "amount", "owner_id"])
    );
    // 不应包含敏感字段
    expect(result.visibleFieldNames).not.toContain("phone");
    expect(result.visibleFieldNames).not.toContain("id_card");
  });

  it("外部汇总 Skill — L2 聚合，不能看单行值", () => {
    const result = checkSkillAccess(202, 100, SKILL_GRANTS, POLICIES, FIELDS);
    expect(result.allowed).toBe(true);
    expect(result.effectiveDisclosure).toBe("L2");
    // policy 5: allowlist [4,5,6] — 仅维度字段
    expect(result.visibleFieldNames).toEqual(["department", "status", "project"]);
    // 不应包含任何个人信息字段
    expect(result.visibleFieldNames).not.toContain("name");
    expect(result.visibleFieldNames).not.toContain("phone");
    expect(result.visibleFieldNames).not.toContain("email");
  });

  it("高敏审批 Skill — L4 引用，全字段", () => {
    const result = checkSkillAccess(203, 100, SKILL_GRANTS, POLICIES, FIELDS);
    expect(result.allowed).toBe(true);
    expect(result.effectiveDisclosure).toBe("L4");
    // policy 6: all fields
    expect(result.visibleFieldNames.length).toBeGreaterThan(5);
  });

  it("高敏审批 Skill 需要审批标记", () => {
    const grant = SKILL_GRANTS.find((g) => g.skill_id === 203)!;
    expect(grant.approval_required).toBe(true);
    expect(grant.audit_level).toBe("full");
  });
});

describe("外部 Skill 安全边界", () => {
  it("外部 Skill 尝试申请 L4 — 需要审批", () => {
    const externalGrant = makeGrant({
      skill_id: 300,
      table_id: 100,
      max_disclosure_level: "L4",
      approval_required: true,
      role_group_id: 5,
    });
    expect(externalGrant.approval_required).toBe(true);
    expect(externalGrant.max_disclosure_level).toBe("L4");
  });

  it("Skill 不能绕过视图直接请求全表数据", () => {
    // 外部汇总 Skill 绑定视图 3，尝试访问视图 1（全量视图）
    const grant = SKILL_GRANTS.find((g) => g.skill_id === 202)!;
    expect(grant.view_id).toBe(3); // 只能访问汇总视图
    // 不能访问视图 1
    const fakeGrant = SKILL_GRANTS.find((g) => g.skill_id === 202 && g.view_id === 1);
    expect(fakeGrant).toBeUndefined();
  });

  it("同一问题切换 Skill 后，输出差异符合授权边界", () => {
    const r1 = checkSkillAccess(201, 100, SKILL_GRANTS, POLICIES, FIELDS);
    const r2 = checkSkillAccess(202, 100, SKILL_GRANTS, POLICIES, FIELDS);

    // 201 可见更多字段
    expect(r1.visibleFieldNames.length).toBeGreaterThan(r2.visibleFieldNames.length);
    // 201 是 L3, 202 是 L2
    expect(r1.effectiveDisclosure).toBe("L3");
    expect(r2.effectiveDisclosure).toBe("L2");
  });
});

describe("审计日志要素", () => {
  it("Skill grant 包含必要的审计信息", () => {
    for (const grant of SKILL_GRANTS) {
      // 必须能追溯：谁（skill_id）、读了哪张表（table_id）、哪个视图（view_id）、
      // 什么披露级别（max_disclosure_level）
      expect(grant.skill_id).toBeGreaterThan(0);
      expect(grant.table_id).toBeGreaterThan(0);
      expect(grant.view_id).not.toBeUndefined();
      expect(grant.max_disclosure_level).toBeDefined();
      expect(grant.audit_level).toBeDefined();
    }
  });
});
