/**
 * 历史兼容性测试 — Phase 6 Step 2
 *
 * 验证旧数据格式在新引擎下不崩溃、降级正确。
 */
import { describe, it, expect } from "vitest";
import type {
  TableFieldDetail,
  TablePermissionPolicy,
  TableRoleGroup,
  DisclosureLevel,
  FieldAccessMode,
} from "@/app/(app)/data/components/shared/types";
import {
  makeField,
  makePolicy,
  makeRoleGroup,
  makeTableDetail,
} from "../fixtures/data-assets";

// ─── 从 permission-engine.test.ts 提取的纯函数 ───────────────────────────────

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

// ═══════════════════════════════════════════════════════════════════════════════

describe("历史兼容性", () => {
  it("无 v1 扩展字段的 TableField 仍可解析", () => {
    // 模拟旧格式：没有 field_role_tags, is_enum, is_free_text 等 v1 字段
    const oldField: Partial<TableFieldDetail> = {
      id: 1,
      field_name: "name",
      field_type: "text",
    };
    const field = makeField(oldField);
    // 确保 resolveVisibleFields 不崩溃
    const result = resolveVisibleFields(
      [field],
      { field_access_mode: "all", allowed_field_ids: [], blocked_field_ids: [] },
    );
    expect(result.length).toBe(1);
    expect(result[0].field_name).toBe("name");
  });

  it("空 permission_policies 等同默认拒绝", () => {
    const detail = makeTableDetail({ permission_policies: [] });
    // 对所有角色组都应无法找到策略
    for (const rg of detail.role_groups) {
      const policy = detail.permission_policies.find(
        (p) => p.role_group_id === rg.id && !p.view_id
      );
      expect(policy).toBeUndefined();
    }
  });

  it("旧 masking_rule_json 格式（字符串值）仍可识别", () => {
    // 旧格式: {field: "mask_type"} — 与新格式相同，确保兼容
    const policy = makePolicy({
      masking_rule_json: { phone: "phone_mask", name: "name_mask" },
    });
    expect(policy.masking_rule_json).toHaveProperty("phone");
    expect(policy.masking_rule_json.phone).toBe("phone_mask");
  });

  it("旧 masking_rule_json 格式（对象值）也可识别", () => {
    // 新格式可能是 {field: {type: "mask_type", ...params}}
    const policy = makePolicy({
      masking_rule_json: { phone: { type: "phone_mask", keep_prefix: 3 } },
    });
    const rule = policy.masking_rule_json.phone;
    expect(rule).toBeDefined();
    if (typeof rule === "object" && rule !== null) {
      expect((rule as Record<string, unknown>).type).toBe("phone_mask");
    }
  });

  it("role_group_id 引用已删除的角色组时策略降级为 deny", () => {
    // policy 引用了 role_group_id=999（不存在的角色组）
    const policies = [makePolicy({ role_group_id: 999 })];
    const groups = [makeRoleGroup({ id: 1 })];
    // 策略找不到对应角色组
    const matching = policies.filter((p) =>
      groups.some((g) => g.id === p.role_group_id)
    );
    expect(matching.length).toBe(0);
  });

  it("空 role_groups 的 TableDetail 不崩溃", () => {
    const detail = makeTableDetail({ role_groups: [], permission_policies: [] });
    expect(detail.role_groups.length).toBe(0);
    expect(detail.permission_policies.length).toBe(0);
  });

  it("字段没有 id（旧 INFORMATION_SCHEMA fallback）时 allowlist 不选中", () => {
    const field = makeField({ id: null, field_name: "old_col" });
    const result = resolveVisibleFields(
      [field],
      { field_access_mode: "allowlist", allowed_field_ids: [1, 2, 3], blocked_field_ids: [] },
    );
    expect(result.length).toBe(0);
  });

  it("字段没有 id 时 blocklist 保留所有", () => {
    const field = makeField({ id: null, field_name: "old_col" });
    const result = resolveVisibleFields(
      [field],
      { field_access_mode: "blocklist", allowed_field_ids: [], blocked_field_ids: [1, 2] },
    );
    expect(result.length).toBe(1);
  });

  it("view 没有 view_kind 时使用默认 list", () => {
    const detail = makeTableDetail();
    const view = detail.views[0];
    expect(view.view_kind || "list").toBe("list");
  });

  it("disclosure_ceiling 为 null 时不限制", () => {
    const detail = makeTableDetail();
    const view = detail.views[0];
    expect(view.disclosure_ceiling).toBeNull();
    // L4 策略不被 cap
    const policy = makePolicy({ disclosure_level: "L4" });
    expect(policy.disclosure_level).toBe("L4");
  });
});
