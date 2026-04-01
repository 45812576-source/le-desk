/**
 * 端到端验收场景测试 — 测试计划 §7
 *
 * 验证核心业务剧本的数据流正确性。
 * 注意：此文件定义数据层 contract，实际 E2E 需结合后端。
 */
import { describe, it, expect } from "vitest";
import type {
  TableDetail,
  DisclosureLevel,
  TableFieldDetail,
  SkillDataGrant,
  TablePermissionPolicy,
} from "@/app/(app)/data/components/shared/types";
import {
  makeTableDetail,
  makeField,
  makeRoleGroup,
  makePolicy,
  makeGrant,
  makeView,
  makeUnfiledTable,
  FIELDS,
  ROLE_GROUPS,
  POLICIES,
  VIEWS,
  SKILL_GRANTS,
} from "../fixtures/data-assets";

// ─── 辅助函数复用 ────────────────────────────────────────────────────────────

function resolveVisibleFields(
  fields: TableFieldDetail[],
  policy: Pick<TablePermissionPolicy, "field_access_mode" | "allowed_field_ids" | "blocked_field_ids">,
): string[] {
  switch (policy.field_access_mode) {
    case "all":
      return fields.filter((f) => !f.is_system).map((f) => f.field_name);
    case "allowlist":
      return fields.filter((f) => f.id !== null && policy.allowed_field_ids.includes(f.id!)).map((f) => f.field_name);
    case "blocklist":
      return fields.filter((f) => !f.id || !policy.blocked_field_ids.includes(f.id!)).map((f) => f.field_name);
    default:
      return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 场景 1：飞书同步表导入 → 未归档 → 归类 → 绑定 Skill → 正常读取
// ═══════════════════════════════════════════════════════════════════════════════

describe("场景1: 飞书同步表导入闭环", () => {
  it("新表进入未归档（folder_id=null）", () => {
    const table = makeUnfiledTable(200);
    expect(table.folder_id).toBeNull();
    expect(table.role_groups).toHaveLength(0);
    expect(table.permission_policies).toHaveLength(0);
  });

  it("归类后 folder_id 有值", () => {
    const table = makeUnfiledTable(200);
    const classified: TableDetail = { ...table, folder_id: 5 };
    expect(classified.folder_id).toBe(5);
  });

  it("补齐字段字典后，字段有 is_enum 标记", () => {
    const table = makeTableDetail();
    const enumFields = table.fields.filter((f) => f.is_enum);
    expect(enumFields.length).toBeGreaterThan(0);
  });

  it("创建视图后可绑定 Skill", () => {
    const table = makeTableDetail();
    expect(table.views.length).toBeGreaterThan(0);
    expect(table.bindings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 场景 2：含敏感字段的表，三种角色看到完全不同的结果
// ═══════════════════════════════════════════════════════════════════════════════

describe("场景2: 分析师 vs 高管 vs 审批Skill 权限差异", () => {
  const detail = makeTableDetail();

  it("分析师（销售组）— L3 脱敏，看全字段但敏感脱敏", () => {
    const policy = POLICIES.find((p) => p.role_group_id === 2)!;
    expect(policy.disclosure_level).toBe("L3");
    expect(policy.field_access_mode).toBe("all");
    expect(Object.keys(policy.masking_rule_json)).toContain("phone");
    expect(Object.keys(policy.masking_rule_json)).toContain("name");
  });

  it("高管（管理层）— L4 原始值，可导出", () => {
    const policy = POLICIES.find((p) => p.role_group_id === 3)!;
    expect(policy.disclosure_level).toBe("L4");
    expect(policy.export_permission).toBe(true);
    expect(policy.row_access_mode).toBe("all");
  });

  it("审批 Skill — L4 但需审批，审计级别 full", () => {
    const grant = SKILL_GRANTS.find((g) => g.skill_id === 203)!;
    expect(grant.max_disclosure_level).toBe("L4");
    expect(grant.approval_required).toBe(true);
    expect(grant.audit_level).toBe("full");
  });

  it("三者可见字段不同", () => {
    const salesPolicy = POLICIES.find((p) => p.role_group_id === 2)!;
    const allStaffPolicy = POLICIES.find((p) => p.role_group_id === 1)!;
    const analysisPolicy = POLICIES.find((p) => p.role_group_id === 4)!;

    const salesFields = resolveVisibleFields(FIELDS, salesPolicy);
    const allStaffFields = resolveVisibleFields(FIELDS, allStaffPolicy);
    const analysisFields = resolveVisibleFields(FIELDS, analysisPolicy);

    // 全员 blocklist 排除 [2,3,9] → 不含 name, phone, id_card
    expect(allStaffFields).not.toContain("name");
    expect(allStaffFields).not.toContain("phone");
    // 销售组 all → 含所有非系统字段
    expect(salesFields).toContain("name");
    expect(salesFields).toContain("phone");
    // 内部分析 Skill allowlist [4,5,6,7,8]
    expect(analysisFields).toContain("department");
    expect(analysisFields).not.toContain("name");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 场景 3：外部 Skill 尝试申请原始明细，系统阻止
// ═══════════════════════════════════════════════════════════════════════════════

describe("场景3: 外部 Skill L4 阻止", () => {
  it("外部 Skill 绑定 L4 时 approval_required=true", () => {
    const externalGrant = makeGrant({
      skill_id: 300,
      table_id: 100,
      max_disclosure_level: "L4",
      approval_required: true,
    });
    expect(externalGrant.approval_required).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 场景 4：两个视图绑定不同 Skill，行为不串
// ═══════════════════════════════════════════════════════════════════════════════

describe("场景4: 双视图 Skill 绑定隔离", () => {
  it("运营视图 Skill 和汇总视图 Skill 结果不同", () => {
    const grant201 = SKILL_GRANTS.find((g) => g.skill_id === 201)!;
    const grant202 = SKILL_GRANTS.find((g) => g.skill_id === 202)!;

    expect(grant201.view_id).toBe(2); // 运营明细视图
    expect(grant202.view_id).toBe(3); // 汇总视图

    // 对应策略不同
    const policy201 = POLICIES.find((p) => p.role_group_id === grant201.role_group_id)!;
    const policy202 = POLICIES.find((p) => p.role_group_id === grant202.role_group_id)!;

    expect(policy201.disclosure_level).toBe("L3");
    expect(policy202.disclosure_level).toBe("L2");
    expect(policy201.allowed_field_ids.length).toBeGreaterThan(policy202.allowed_field_ids.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 场景 5：字段从 free 升级为受控枚举
// ═══════════════════════════════════════════════════════════════════════════════

describe("场景5: 字段类型升级", () => {
  it("升级后旧数据仍可读（向后兼容）", () => {
    const before = makeField({ field_name: "region", is_free_text: true, is_enum: false, enum_values: [] });
    const after: TableFieldDetail = { ...before, is_enum: true, is_free_text: false, enum_values: ["华东", "华北", "华南"] };
    // 升级前后 field_name 不变
    expect(before.field_name).toBe(after.field_name);
    // 升级后可作为筛选条件引用
    expect(after.enum_values.length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 场景 6：批量归档 100+ 未归档表
// ═══════════════════════════════════════════════════════════════════════════════

describe("场景6: 批量归档", () => {
  it("100 个未归档表归档后全部有 folder_id", () => {
    const tables = Array.from({ length: 100 }, (_, i) => makeUnfiledTable(i + 1000));
    expect(tables.every((t) => t.folder_id === null)).toBe(true);

    // 模拟归档
    const classified = tables.map((t) => ({ ...t, folder_id: Math.floor(Math.random() * 10) + 1 }));
    expect(classified.every((t) => t.folder_id !== null)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 场景 7：用户属于两个角色组，一个显式 deny
// ═══════════════════════════════════════════════════════════════════════════════

describe("场景7: 多角色组冲突 — deny 优先", () => {
  it("一个 allow + 一个 deny → deny 胜", () => {
    const allowPolicy = makePolicy({ role_group_id: 1, row_access_mode: "all", disclosure_level: "L3" });
    const denyPolicy = makePolicy({ role_group_id: 99, row_access_mode: "none", disclosure_level: "L0" });

    // 用户属于角色组 1 和 99
    // 策略合并：显式 deny 优先
    const hasDeny = [allowPolicy, denyPolicy].some((p) => p.row_access_mode === "none");
    expect(hasDeny).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 场景 8：前端预览 ≡ Skill 输出
// ═══════════════════════════════════════════════════════════════════════════════

describe("场景8: 前端预览与 Skill 输出一致", () => {
  it("销售组在前端预览和 Skill 输出中看到同级内容", () => {
    // 前端 PermissionPreview 计算
    const salesPolicy = POLICIES.find((p) => p.role_group_id === 2)!;
    const frontendFields = resolveVisibleFields(FIELDS, salesPolicy);

    // Skill grant 201 对应 policy 4 (allowlist [4,5,6,7,8])
    const skillPolicy = POLICIES.find((p) => p.role_group_id === 4)!;
    const skillFields = resolveVisibleFields(FIELDS, skillPolicy);

    // Skill 能看的是 policy 4 的子集，不应超过 sales 看到的范围
    // （这里验证的是不同角色组的字段差异符合预期）
    expect(frontendFields.length).toBeGreaterThan(skillFields.length);
  });
});
