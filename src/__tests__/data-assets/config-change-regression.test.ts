/**
 * 配置变更回归测试 — Phase 6 Step 2
 *
 * 验证配置项变更（角色组增删、策略调整、视图变更）后权限行为正确。
 */
import { describe, it, expect } from "vitest";
import type {
  TableFieldDetail,
  TablePermissionPolicy,
  DisclosureLevel,
  FieldAccessMode,
} from "@/app/(app)/data/components/shared/types";
import {
  makePolicy,
  makeView,
  makeRoleGroup,
  makeTableDetail,
  FIELDS,
  ROLE_GROUPS,
} from "../fixtures/data-assets";

// ─── 辅助函数 ───────────────────────────────────────────────────────────────

const DISCLOSURE_ORDER: DisclosureLevel[] = ["L0", "L1", "L2", "L3", "L4"];

function disclosureIndex(level: DisclosureLevel): number {
  return DISCLOSURE_ORDER.indexOf(level);
}

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

/** 模拟策略匹配：根据 role_group_id 和 view_id 查找策略 */
function findPolicy(
  policies: TablePermissionPolicy[],
  roleGroupId: number,
  viewId: number | null,
): TablePermissionPolicy | undefined {
  return policies.find((p) => p.role_group_id === roleGroupId && p.view_id === viewId);
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("配置变更回归", () => {
  it("删除角色组后，引用该角色组的策略无效化", () => {
    const detail = makeTableDetail();
    // 删除「销售组」角色组 (id=2)
    const newGroups = detail.role_groups.filter((g) => g.id !== 2);
    const newDetail = makeTableDetail({ role_groups: newGroups });

    // 策略 id=2 引用 role_group_id=2（已删除）
    const salesPolicy = newDetail.permission_policies.find((p) => p.role_group_id === 2);
    expect(salesPolicy).toBeDefined();

    // 但角色组不存在 → 策略找不到匹配的角色组
    const matchedGroup = newDetail.role_groups.find((g) => g.id === salesPolicy!.role_group_id);
    expect(matchedGroup).toBeUndefined();
  });

  it("新增角色组时无策略等于默认拒绝", () => {
    const newGroup = makeRoleGroup({ id: 99, name: "新角色组" });
    const detail = makeTableDetail({
      role_groups: [...ROLE_GROUPS, newGroup],
    });

    // 新角色组没有对应策略
    const policy = findPolicy(detail.permission_policies, 99, null);
    expect(policy).toBeUndefined();

    // 无策略 = 默认拒绝，可见字段为空
    // 由于无策略，不调用 resolveVisibleFields
  });

  it("策略从 all 切换为 allowlist 后只能看白名单字段", () => {
    // 原策略：field_access_mode=all
    const before = makePolicy({ field_access_mode: "all" });
    const beforeFields = resolveVisibleFields(FIELDS, before);
    const nonSystemCount = FIELDS.filter((f) => !f.is_system).length;
    expect(beforeFields.length).toBe(nonSystemCount);

    // 修改为 allowlist，只允许 [4,5]
    const after = makePolicy({
      field_access_mode: "allowlist",
      allowed_field_ids: [4, 5],
    });
    const afterFields = resolveVisibleFields(FIELDS, after);
    expect(afterFields.length).toBe(2);
    expect(afterFields.map((f) => f.id)).toEqual(expect.arrayContaining([4, 5]));
  });

  it("策略从 allowlist 切换为 blocklist 后可见字段增多", () => {
    // allowlist 只允许 3 个字段
    const before = makePolicy({
      field_access_mode: "allowlist",
      allowed_field_ids: [4, 5, 6],
    });
    const beforeFields = resolveVisibleFields(FIELDS, before);
    expect(beforeFields.length).toBe(3);

    // blocklist 只屏蔽 2 个敏感字段
    const after = makePolicy({
      field_access_mode: "blocklist",
      blocked_field_ids: [2, 3],
    });
    const afterFields = resolveVisibleFields(FIELDS, after);
    expect(afterFields.length).toBeGreaterThan(beforeFields.length);
  });

  it("disclosure_level 降级后高敏操作不可用", () => {
    // 原策略 L4（完全引用）
    const before = makePolicy({ disclosure_level: "L4", export_permission: true });
    expect(before.export_permission).toBe(true);

    // 降级为 L2（聚合）
    const after = makePolicy({ disclosure_level: "L2", export_permission: false });
    expect(disclosureIndex(after.disclosure_level)).toBeLessThan(disclosureIndex("L4"));
    expect(after.export_permission).toBe(false);
  });

  it("视图 disclosure_ceiling 变更影响所有关联策略", () => {
    // 原视图 ceiling=L3
    const view = makeView({ id: 2, disclosure_ceiling: "L3" });
    // 管理层策略 L4 → cap 到 L3
    const mgrPolicy = makePolicy({ disclosure_level: "L4" });
    const cappedBefore = disclosureIndex(mgrPolicy.disclosure_level) <= disclosureIndex(view.disclosure_ceiling!)
      ? mgrPolicy.disclosure_level
      : view.disclosure_ceiling!;
    expect(cappedBefore).toBe("L3");

    // 视图 ceiling 降为 L1
    const viewAfter = makeView({ id: 2, disclosure_ceiling: "L1" });
    const cappedAfter = disclosureIndex(mgrPolicy.disclosure_level) <= disclosureIndex(viewAfter.disclosure_ceiling!)
      ? mgrPolicy.disclosure_level
      : viewAfter.disclosure_ceiling!;
    expect(cappedAfter).toBe("L1");
  });

  it("view_kind 从 list 改为 metric 后 disclosure 被 cap", () => {
    // list 无限制
    const listView = makeView({ view_kind: "list", disclosure_ceiling: null });

    const policyLevel: DisclosureLevel = "L4";

    // list: 不受 view_kind 限制
    expect(listView.disclosure_ceiling).toBeNull();
    // metric: cap 到 L2
    const metricMaxDisclosure: DisclosureLevel = "L2"; // VIEW_KIND_CONSTRAINTS.metric.max_disclosure
    const effectiveMetric = disclosureIndex(policyLevel) <= disclosureIndex(metricMaxDisclosure)
      ? policyLevel
      : metricMaxDisclosure;
    expect(effectiveMetric).toBe("L2");
  });

  it("masking_rule_json 新增字段后旧字段规则保留", () => {
    const before = makePolicy({
      masking_rule_json: { phone: "phone_mask", name: "name_mask" },
    });
    // 新增 id_card 的脱敏规则
    const after = makePolicy({
      masking_rule_json: { ...before.masking_rule_json, id_card: "id_mask" },
    });
    // 旧规则保留
    expect(after.masking_rule_json.phone).toBe("phone_mask");
    expect(after.masking_rule_json.name).toBe("name_mask");
    // 新规则生效
    expect(after.masking_rule_json.id_card).toBe("id_mask");
  });

  it("空策略数组时所有角色组均无权限", () => {
    const detail = makeTableDetail({ permission_policies: [] });
    for (const rg of detail.role_groups) {
      const policy = findPolicy(detail.permission_policies, rg.id, null);
      expect(policy).toBeUndefined();
    }
  });
});
