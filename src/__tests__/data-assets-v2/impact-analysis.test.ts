/**
 * 安全内核 V2 — D6 影响分析测试
 *
 * 覆盖：
 * - 前端影响计算
 * - 审批检查逻辑
 * - 空影响列表
 */
import { describe, it, expect } from "vitest";
import { normalizeTableDetail } from "@/app/(app)/data/components/shared/normalize";
import type { TableDetailV2, SensitivityLevel } from "@/app/(app)/data/components/shared/types";
import { makeField, makeTableDetail } from "../fixtures/data-assets";

// 复制 checkApprovalRequired 纯逻辑
function checkApprovalRequired(detail: TableDetailV2, action: string): boolean {
  const hasSensitive = detail.fields.some((f) => f.sensitivity_level >= "S2_sensitive");
  if (hasSensitive && ["policy_change", "export_sensitive", "elevate_disclosure"].includes(action)) {
    return true;
  }
  const hasApprovalGrant = detail.skill_grants?.some((g) => g.approval_required);
  if (hasApprovalGrant && action === "grant_access") {
    return true;
  }
  return false;
}

// 复制 computeImpacts 纯逻辑
function computeImpacts(detail: TableDetailV2): { type: string; name: string }[] {
  const items: { type: string; name: string }[] = [];
  for (const v of detail.views) {
    if (v.allowed_role_group_ids?.length > 0 || v.disclosure_ceiling) {
      items.push({ type: "view", name: v.name });
    }
  }
  for (const b of detail.bindings) {
    items.push({ type: "skill", name: b.skill_name });
  }
  for (const g of detail.skill_grants || []) {
    items.push({ type: "grant", name: g.skill_name || `Skill #${g.skill_id}` });
  }
  return items;
}

describe("D6 影响分析", () => {
  it("无敏感字段时 policy_change 不需审批", () => {
    const raw = makeTableDetail({
      fields: [makeField({ id: 1, field_name: "city", is_sensitive: false })],
    });
    const v2 = normalizeTableDetail(raw);
    expect(checkApprovalRequired(v2, "policy_change")).toBe(false);
  });

  it("有敏感字段时 policy_change 需审批", () => {
    const raw = makeTableDetail({
      fields: [makeField({ id: 1, field_name: "phone", is_sensitive: true })],
    });
    const v2 = normalizeTableDetail(raw);
    expect(checkApprovalRequired(v2, "policy_change")).toBe(true);
  });

  it("grant_access 需 approval_required 的 grant", () => {
    const raw = makeTableDetail({
      fields: [makeField({ id: 1, field_name: "a" })],
      skill_grants: [
        { id: 1, skill_id: 100, table_id: 1, view_id: null, role_group_id: null, grant_mode: "allow", allowed_actions: [], max_disclosure_level: "L2", row_rule_override_json: {}, field_rule_override_json: {}, approval_required: true, audit_level: "full", created_at: null, updated_at: null },
      ],
    });
    const v2 = normalizeTableDetail(raw);
    expect(checkApprovalRequired(v2, "grant_access")).toBe(true);
  });

  it("空影响列表", () => {
    const raw = makeTableDetail({
      fields: [],
      views: [],
      bindings: [],
      skill_grants: [],
    });
    const v2 = normalizeTableDetail(raw);
    const impacts = computeImpacts(v2);
    expect(impacts).toHaveLength(0);
  });

  it("有 binding 和 grant 时计算影响", () => {
    const raw = makeTableDetail({
      fields: [makeField({ id: 1, field_name: "a" })],
      bindings: [
        { skill_id: 1, skill_name: "TestSkill", binding_id: 1, view_id: null, view_name: null, binding_type: null, alias: null, status: "healthy" },
      ],
      skill_grants: [
        { id: 1, skill_id: 1, skill_name: "TestSkill", table_id: 1, view_id: null, role_group_id: null, grant_mode: "allow", allowed_actions: [], max_disclosure_level: "L2", row_rule_override_json: {}, field_rule_override_json: {}, approval_required: false, audit_level: "basic", created_at: null, updated_at: null },
      ],
    });
    const v2 = normalizeTableDetail(raw);
    const impacts = computeImpacts(v2);
    expect(impacts.length).toBeGreaterThanOrEqual(2);
    expect(impacts.some((i) => i.type === "skill")).toBe(true);
    expect(impacts.some((i) => i.type === "grant")).toBe(true);
  });
});
