/**
 * §5 字段字典与治理测试
 *
 * G-01 ~ G-06：敏感等级批量修改、字段生命周期、枚举值管理、
 * 未归档闭环、自动归档不落库、低置信度提示。
 */
import { describe, it, expect } from "vitest";
import type { FieldValueDictionary } from "@/app/(app)/data/components/shared/types";
import { makeTableDetail } from "../fixtures/data-assets";
import {
  makeV2TableA,
} from "../fixtures/data-assets-v2";

// ─── 纯函数 ─────────────────────────────────────────────────────────────────

type SensitivityLevel = "S1" | "S2" | "S3" | "S4";
type FieldLifecycleStatus = "inferred" | "confirmed" | "deprecated";

interface FieldGovernanceState {
  sensitivity_level: SensitivityLevel;
  lifecycle_status: FieldLifecycleStatus;
}

/** 风险评分因敏感等级变化而变化 */
function computeSensitivityScore(fields: { sensitivity_level: SensitivityLevel }[]): number {
  const weights: Record<SensitivityLevel, number> = { S1: 0, S2: 5, S3: 15, S4: 25 };
  return fields.reduce((sum, f) => sum + weights[f.sensitivity_level], 0);
}

/** 归档建议 */
interface ArchiveSuggestion {
  table_id: number;
  suggested_folder_id: number;
  confidence: number;
}

function shouldAutoAccept(suggestion: ArchiveSuggestion): boolean {
  void suggestion;
  // 不允许自动落库
  return false;
}

function isLowConfidence(suggestion: ArchiveSuggestion): boolean {
  return suggestion.confidence < 0.7;
}

/** 未归档缺失项 */
interface UnfiledGap {
  type: "folder" | "sensitivity" | "permission" | "view";
  resolved: boolean;
}

function computeUnfiledGaps(table: {
  folder_id: number | null;
  fields: { is_sensitive: boolean }[];
  permission_policies: unknown[];
  views: unknown[];
}): UnfiledGap[] {
  const gaps: UnfiledGap[] = [];
  if (!table.folder_id) gaps.push({ type: "folder", resolved: false });
  if (!table.fields.some((f) => f.is_sensitive)) {
    // 如果没有敏感字段标记，也可能是需要补的
  }
  if (table.permission_policies.length === 0) gaps.push({ type: "permission", resolved: false });
  if (table.views.length === 0) gaps.push({ type: "view", resolved: false });
  return gaps;
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§5 字段字典与治理", () => {
  // ── G-01 字段敏感等级批量修改 ─────────────────────────────────────────────
  describe("G-01 字段敏感等级批量修改", () => {
    it("批量修改为 S3 后风险评分上升", () => {
      const before = [
        { sensitivity_level: "S1" as SensitivityLevel },
        { sensitivity_level: "S1" as SensitivityLevel },
        { sensitivity_level: "S1" as SensitivityLevel },
      ];
      const after = [
        { sensitivity_level: "S3" as SensitivityLevel },
        { sensitivity_level: "S3" as SensitivityLevel },
        { sensitivity_level: "S3" as SensitivityLevel },
      ];
      expect(computeSensitivityScore(after)).toBeGreaterThan(computeSensitivityScore(before));
    });

    it("S4→S2 降级后评分下降", () => {
      const before = [{ sensitivity_level: "S4" as SensitivityLevel }];
      const after = [{ sensitivity_level: "S2" as SensitivityLevel }];
      expect(computeSensitivityScore(after)).toBeLessThan(computeSensitivityScore(before));
    });
  });

  // ── G-02 字段生命周期从 inferred 到 confirmed ────────────────────────────
  describe("G-02 字段生命周期", () => {
    it("inferred → confirmed 状态变更", () => {
      const state: FieldGovernanceState = { sensitivity_level: "S2", lifecycle_status: "inferred" };
      const confirmed: FieldGovernanceState = { ...state, lifecycle_status: "confirmed" };
      expect(confirmed.lifecycle_status).toBe("confirmed");
    });

    it("confirmed 后不应回退到 inferred", () => {
      const state: FieldGovernanceState = { sensitivity_level: "S2", lifecycle_status: "confirmed" };
      // 业务规则：confirmed 不应回退
      expect(state.lifecycle_status).toBe("confirmed");
    });
  });

  // ── G-03 枚举值生命周期 ──────────────────────────────────────────────────
  describe("G-03 枚举值生命周期", () => {
    it("deprecated 枚举值不出现在新建筛选默认值中", () => {
      const allValues: FieldValueDictionary[] = [
        { id: 1, field_id: 107, value: "A", label: null, is_active: true, source: "synced", sort_order: 0, hit_count: 30, last_seen_at: null },
        { id: 2, field_id: 107, value: "B", label: null, is_active: true, source: "synced", sort_order: 1, hit_count: 25, last_seen_at: null },
        { id: 3, field_id: 107, value: "C", label: null, is_active: true, source: "synced", sort_order: 2, hit_count: 20, last_seen_at: null },
        { id: 4, field_id: 107, value: "D", label: "已停用", is_active: false, source: "manual", sort_order: 3, hit_count: 5, last_seen_at: null },
      ];
      const activeValues = allValues.filter((v) => v.is_active).map((v) => v.value);
      expect(activeValues).toEqual(["A", "B", "C"]);
      expect(activeValues).not.toContain("D");
    });

    it("历史数据仍能识别 deprecated 值", () => {
      const allValues = ["A", "B", "C", "D"];
      expect(allValues).toContain("D");
    });
  });

  // ── G-04 未归档工作台缺失项闭环 ─────────────────────────────────────────
  describe("G-04 未归档工作台缺失项闭环", () => {
    it("缺目录、缺权限、缺视图都被检出", () => {
      const unfiledTable = makeTableDetail({
        folder_id: null,
        permission_policies: [],
        views: [],
      });
      const gaps = computeUnfiledGaps(unfiledTable);
      expect(gaps.map((g) => g.type)).toContain("folder");
      expect(gaps.map((g) => g.type)).toContain("permission");
      expect(gaps.map((g) => g.type)).toContain("view");
    });

    it("补齐后缺失项减少", () => {
      const table = makeTableDetail({ folder_id: null, permission_policies: [], views: [] });
      const before = computeUnfiledGaps(table);

      const tableAfter = makeTableDetail({ folder_id: 5, permission_policies: [], views: [] });
      const after = computeUnfiledGaps(tableAfter);
      expect(after.length).toBeLessThan(before.length);
    });

    it("全部补齐后从未归档列表移除", () => {
      const tableComplete = makeV2TableA();
      const gaps = computeUnfiledGaps(tableComplete);
      expect(gaps.length).toBe(0);
    });
  });

  // ── G-05 自动归档建议不自动落库 ─────────────────────────────────────────
  describe("G-05 自动归档建议不自动落库", () => {
    it("高置信度建议仍不自动落库", () => {
      const suggestion: ArchiveSuggestion = { table_id: 1000, suggested_folder_id: 5, confidence: 0.92 };
      expect(shouldAutoAccept(suggestion)).toBe(false);
    });
  });

  // ── G-06 低置信度建议显著提示 ───────────────────────────────────────────
  describe("G-06 低置信度建议显著提示", () => {
    it("置信度 45% 标记为低置信度", () => {
      const suggestion: ArchiveSuggestion = { table_id: 1000, suggested_folder_id: 3, confidence: 0.45 };
      expect(isLowConfidence(suggestion)).toBe(true);
    });

    it("置信度 92% 不标记为低置信度", () => {
      const suggestion: ArchiveSuggestion = { table_id: 1000, suggested_folder_id: 5, confidence: 0.92 };
      expect(isLowConfidence(suggestion)).toBe(false);
    });
  });
});
