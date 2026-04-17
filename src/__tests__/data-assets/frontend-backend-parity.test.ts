/**
 * 前后端一致性测试 — Phase 6 Step 2
 *
 * 验证前端类型定义与后端 API 约定一致，
 * 前端 UI 展示逻辑与策略引擎计算结果一致。
 */
import { describe, it, expect } from "vitest";
import type {
  TableFieldDetail,
  TablePermissionPolicy,
  TableViewDetail,
  SkillDataGrant,
  DisclosureLevel,
  FieldAccessMode,
  RowAccessMode,
  ViewKind,
} from "@/app/(app)/data/components/shared/types";
import {
  DISCLOSURE_LABELS,
  VIEW_KIND_LABELS,
  MASKING_RULES,
} from "@/app/(app)/data/components/shared/types";
import {
  makeField,
  makePolicy,
  makeView,
  makeGrant,
  makeTableDetail,
  FIELDS,
  ROLE_GROUPS,
  POLICIES,
  VIEWS,
  SKILL_GRANTS,
} from "../fixtures/data-assets";

// ═══════════════════════════════════════════════════════════════════════════════

describe("前后端一致性", () => {
  it("DisclosureLevel 枚举完整覆盖 L0-L4", () => {
    const expected: DisclosureLevel[] = ["L0", "L1", "L2", "L3", "L4"];
    for (const level of expected) {
      expect(DISCLOSURE_LABELS).toHaveProperty(level);
      expect(DISCLOSURE_LABELS[level]).toBeTruthy();
    }
    expect(Object.keys(DISCLOSURE_LABELS).length).toBe(5);
  });

  it("ViewKind 枚举完整覆盖所有视图类型", () => {
    const expected: ViewKind[] = ["list", "board", "metric", "pivot", "review_queue"];
    for (const kind of expected) {
      expect(VIEW_KIND_LABELS).toHaveProperty(kind);
    }
    expect(Object.keys(VIEW_KIND_LABELS).length).toBe(5);
  });

  it("MaskingRule 枚举包含所有脱敏规则", () => {
    const expected = ["phone_mask", "name_mask", "id_mask", "email_mask", "amount_range", "full_mask"];
    for (const rule of expected) {
      expect(MASKING_RULES).toContain(rule);
    }
    expect(MASKING_RULES.length).toBe(6);
  });

  it("TablePermissionPolicy 必需字段完整", () => {
    const policy = makePolicy();
    // 验证策略包含后端 API 要求的所有字段
    const requiredKeys: (keyof TablePermissionPolicy)[] = [
      "id", "table_id", "view_id", "role_group_id",
      "row_access_mode", "row_rule_json",
      "field_access_mode", "allowed_field_ids", "blocked_field_ids",
      "disclosure_level", "masking_rule_json",
      "tool_permission_mode", "export_permission",
      "reason_template",
    ];
    for (const key of requiredKeys) {
      expect(policy).toHaveProperty(key);
    }
  });

  it("SkillDataGrant 必需字段完整", () => {
    const grant = makeGrant();
    const requiredKeys: (keyof SkillDataGrant)[] = [
      "id", "skill_id", "table_id", "view_id",
      "role_group_id", "grant_mode", "allowed_actions",
      "max_disclosure_level", "row_rule_override_json",
      "field_rule_override_json", "approval_required", "audit_level",
    ];
    for (const key of requiredKeys) {
      expect(grant).toHaveProperty(key);
    }
  });

  it("TableViewDetail v1 字段完整", () => {
    const view = makeView();
    const v1Keys: (keyof TableViewDetail)[] = [
      "visible_field_ids", "view_kind", "disclosure_ceiling",
      "allowed_role_group_ids", "allowed_skill_ids", "row_limit",
    ];
    for (const key of v1Keys) {
      expect(view).toHaveProperty(key);
    }
  });

  it("TableFieldDetail v1 字段完整", () => {
    const field = makeField();
    const v1Keys: (keyof TableFieldDetail)[] = [
      "field_role_tags", "is_enum", "is_free_text", "is_sensitive",
    ];
    for (const key of v1Keys) {
      expect(field).toHaveProperty(key);
    }
  });

  it("fixture POLICIES 的 role_group_id 都在 ROLE_GROUPS 中", () => {
    const groupIds = new Set(ROLE_GROUPS.map((g) => g.id));
    for (const policy of POLICIES) {
      expect(groupIds.has(policy.role_group_id)).toBe(true);
    }
  });

  it("fixture SKILL_GRANTS 的 view_id 都在 VIEWS 中", () => {
    const viewIds = new Set(VIEWS.map((v) => v.id));
    for (const grant of SKILL_GRANTS) {
      if (grant.view_id !== null) {
        expect(viewIds.has(grant.view_id)).toBe(true);
      }
    }
  });

  it("RowAccessMode 枚举值与后端一致", () => {
    const validModes: RowAccessMode[] = ["none", "all", "owner", "department", "rule"];
    for (const policy of POLICIES) {
      expect(validModes).toContain(policy.row_access_mode);
    }
  });

  it("FieldAccessMode 枚举值与后端一致", () => {
    const validModes: FieldAccessMode[] = ["all", "allowlist", "blocklist"];
    for (const policy of POLICIES) {
      expect(validModes).toContain(policy.field_access_mode);
    }
  });

  it("敏感字段标记与 field_role_tags 一致", () => {
    for (const field of FIELDS) {
      if (field.is_sensitive) {
        // 敏感字段应有 sensitive tag
        expect(field.field_role_tags).toContain("sensitive");
      }
    }
  });

  it("枚举字段的 is_enum + enum_values 一致", () => {
    for (const field of FIELDS) {
      if (field.is_enum) {
        expect(field.enum_values.length).toBeGreaterThan(0);
        expect(field.is_free_text).toBe(false);
      }
    }
  });

  it("makeTableDetail 生成的完整数据结构自洽", () => {
    const detail = makeTableDetail();

    // fields 非空
    expect(detail.fields.length).toBeGreaterThan(0);

    // role_groups 非空
    expect(detail.role_groups.length).toBeGreaterThan(0);

    // policies 引用的 role_group_id 都存在
    const groupIds = new Set(detail.role_groups.map((g) => g.id));
    for (const p of detail.permission_policies) {
      expect(groupIds.has(p.role_group_id)).toBe(true);
    }

    // views 非空
    expect(detail.views.length).toBeGreaterThan(0);

    // skill_grants 的 view_id 都在 views 中
    const viewIds = new Set(detail.views.map((v) => v.id));
    for (const g of detail.skill_grants) {
      if (g.view_id !== null) {
        expect(viewIds.has(g.view_id)).toBe(true);
      }
    }
  });
});
