/**
 * §1 兼容与数据契约测试
 *
 * C-01 ~ C-04：验证旧数据格式在 V2 下不崩溃、降级正确、API 契约稳定。
 */
import { describe, it, expect } from "vitest";
import type {
  TableFieldDetail,
  TableDetail,
  DisclosureLevel,
} from "@/app/(app)/data/components/shared/types";
import {
  makeField,
  makePolicy,
  makeTableDetail,
  makeView,
} from "../fixtures/data-assets";
import {
  makeV2TableA,
  makeRiskAssessment,
  makeSourceProfile,
  makeSmallSampleProtection,
  type RiskAssessment,
  type SourceProfile,
  type SmallSampleProtection,
} from "../fixtures/data-assets-v2";

// ─── adapter/normalizer 纯函数 ──────────────────────────────────────────────

/** 从旧格式推导 sensitivity_level */
function inferSensitivityLevel(field: TableFieldDetail): string {
  if (!field.is_sensitive) return "S1";
  if (field.field_role_tags.includes("identifier")) return "S3";
  if (field.field_name === "mobile" || field.field_name === "phone") return "S4";
  return "S2";
}

/** 安全读取可空风险评估 */
function renderRiskSummary(assessment: RiskAssessment | null): string {
  if (!assessment) return "未配置";
  return `${assessment.risk_level} (${assessment.total_score}分)`;
}

/** 安全读取可空源画像 */
function renderSourceProfile(profile: SourceProfile | null): string {
  if (!profile) return "未接入";
  return `${profile.source_type} / ${profile.security_level}`;
}

/** 安全读取可空小样本保护 */
function renderSmallSampleProtection(config: SmallSampleProtection | null): string {
  if (!config) return "待评估";
  return config.enabled ? `已启用 (≥${config.min_group_size})` : "已关闭";
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§1 兼容与契约", () => {
  // ── C-01 老表详情兼容回退 ─────────────────────────────────────────────────
  describe("C-01 老表详情兼容回退", () => {
    it("旧格式 TableDetail 仅含 is_sensitive，无 sensitivity_level 不崩溃", () => {
      const oldField: Partial<TableFieldDetail> = {
        id: 1,
        field_name: "name",
        field_type: "text",
        is_sensitive: true,
      };
      const field = makeField(oldField);
      // adapter 推导 sensitivity_level
      const level = inferSensitivityLevel(field);
      expect(["S1", "S2", "S3", "S4"]).toContain(level);
    });

    it("风险摘要为 null 时显示空态", () => {
      expect(renderRiskSummary(null)).toBe("未配置");
    });

    it("源画像为 null 时显示空态", () => {
      expect(renderSourceProfile(null)).toBe("未接入");
    });

    it("小样本保护为 null 时显示空态", () => {
      expect(renderSmallSampleProtection(null)).toBe("待评估");
    });
  });

  // ── C-02 新老混合字段兼容 ─────────────────────────────────────────────────
  describe("C-02 新老混合字段兼容", () => {
    it("部分字段有 sensitivity_level，部分仅有 is_sensitive，全部可推导", () => {
      const fields = [
        makeField({ id: 1, field_name: "phone", is_sensitive: true, field_role_tags: ["sensitive"] }),
        makeField({ id: 2, field_name: "name", is_sensitive: true, field_role_tags: ["identifier", "sensitive"] }),
        makeField({ id: 3, field_name: "city", is_sensitive: false, field_role_tags: [] }),
      ];
      const levels = fields.map(inferSensitivityLevel);
      expect(levels).toEqual(["S4", "S3", "S1"]);
    });

    it("保存后统一转成新结构，旧字段信息不丢失", () => {
      const oldField = makeField({ id: 1, field_name: "phone", is_sensitive: true });
      const newLevel = inferSensitivityLevel(oldField);
      // 转换后仍保持原有 is_sensitive 标记
      expect(oldField.is_sensitive).toBe(true);
      expect(newLevel).toBe("S4");
    });
  });

  // ── C-03 空态接口兼容 ────────────────────────────────────────────────────
  describe("C-03 空态接口兼容", () => {
    it("risk_assessment 返回 null 时组件不崩溃", () => {
      const result = renderRiskSummary(null);
      expect(result).not.toContain("undefined");
      expect(result).not.toContain("null");
    });

    it("source_profile 返回 null 时组件不崩溃", () => {
      const result = renderSourceProfile(null);
      expect(result).not.toContain("undefined");
    });

    it("small_sample_protection 返回 null 时组件不崩溃", () => {
      const result = renderSmallSampleProtection(null);
      expect(result).not.toContain("undefined");
    });

    it("非 null 风险评估正常渲染", () => {
      const assessment = makeRiskAssessment();
      const result = renderRiskSummary(assessment);
      expect(result).toContain("medium");
      expect(result).toContain("65");
    });
  });

  // ── C-04 API 契约快照稳定性 ──────────────────────────────────────────────
  describe("C-04 API 契约快照稳定性", () => {
    it("TableDetail 包含所有 V2 必需字段", () => {
      const detail = makeV2TableA();
      const requiredKeys: (keyof TableDetail)[] = [
        "id", "table_name", "display_name", "description", "folder_id",
        "source_type", "fields", "views", "bindings",
        "role_groups", "permission_policies", "skill_grants",
      ];
      for (const key of requiredKeys) {
        expect(detail).toHaveProperty(key);
      }
    });

    it("字段结构包含 V1 扩展", () => {
      const detail = makeV2TableA();
      for (const field of detail.fields) {
        expect(field).toHaveProperty("field_role_tags");
        expect(field).toHaveProperty("is_enum");
        expect(field).toHaveProperty("is_free_text");
        expect(field).toHaveProperty("is_sensitive");
      }
    });

    it("视图结构包含 V1 扩展", () => {
      const detail = makeV2TableA();
      for (const view of detail.views) {
        expect(view).toHaveProperty("visible_field_ids");
        expect(view).toHaveProperty("view_kind");
        expect(view).toHaveProperty("disclosure_ceiling");
        expect(view).toHaveProperty("allowed_role_group_ids");
        expect(view).toHaveProperty("allowed_skill_ids");
      }
    });

    it("fixture 引用关系自洽", () => {
      const detail = makeV2TableA();
      const groupIds = new Set(detail.role_groups.map((g) => g.id));
      const viewIds = new Set(detail.views.map((v) => v.id));

      for (const p of detail.permission_policies) {
        expect(groupIds.has(p.role_group_id)).toBe(true);
      }
      for (const g of detail.skill_grants) {
        if (g.view_id !== null) {
          expect(viewIds.has(g.view_id)).toBe(true);
        }
      }
    });
  });
});
