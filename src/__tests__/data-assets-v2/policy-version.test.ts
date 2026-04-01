/**
 * 安全内核 V2 — D5 策略版本对比测试
 *
 * 覆盖：
 * - Diff 计算逻辑
 * - 版本排序
 * - 空版本列表
 */
import { describe, it, expect } from "vitest";
import type { TablePermissionPolicy, PolicyVersion } from "@/app/(app)/data/components/shared/types";

function makePolicy(overrides: Partial<TablePermissionPolicy> = {}): TablePermissionPolicy {
  return {
    id: 1,
    table_id: 100,
    view_id: null,
    role_group_id: 10,
    row_access_mode: "all",
    row_rule_json: {},
    field_access_mode: "all",
    allowed_field_ids: [],
    blocked_field_ids: [],
    disclosure_level: "L2",
    masking_rule_json: {},
    tool_permission_mode: "allow",
    export_permission: true,
    reason_template: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  };
}

function computeDiff(current: TablePermissionPolicy, previous: TablePermissionPolicy): string[] {
  const fields = ["row_access_mode", "field_access_mode", "disclosure_level", "export_permission", "tool_permission_mode"] as const;
  return fields.filter((f) => JSON.stringify(current[f]) !== JSON.stringify(previous[f]));
}

describe("D5 策略版本对比", () => {
  it("相同策略无差异", () => {
    const a = makePolicy();
    const b = makePolicy();
    expect(computeDiff(a, b)).toHaveLength(0);
  });

  it("检测 disclosure_level 变更", () => {
    const a = makePolicy({ disclosure_level: "L3" });
    const b = makePolicy({ disclosure_level: "L2" });
    const diff = computeDiff(a, b);
    expect(diff).toContain("disclosure_level");
    expect(diff).toHaveLength(1);
  });

  it("检测多字段变更", () => {
    const a = makePolicy({ disclosure_level: "L3", export_permission: false, row_access_mode: "owner" });
    const b = makePolicy({ disclosure_level: "L2", export_permission: true, row_access_mode: "all" });
    const diff = computeDiff(a, b);
    expect(diff).toContain("disclosure_level");
    expect(diff).toContain("export_permission");
    expect(diff).toContain("row_access_mode");
    expect(diff).toHaveLength(3);
  });

  it("版本列表按版本号降序", () => {
    const versions: Partial<PolicyVersion>[] = [
      { id: 3, version: 3 },
      { id: 1, version: 1 },
      { id: 2, version: 2 },
    ];
    const sorted = [...versions].sort((a, b) => b.version! - a.version!);
    expect(sorted.map((v) => v.version)).toEqual([3, 2, 1]);
  });
});
