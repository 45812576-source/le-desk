/**
 * §7 外部源与降级安全测试
 *
 * E-01 ~ E-04：源画像展示、下推失败降级、高风险阻断、外部源风险纳入总分。
 */
import { describe, it, expect } from "vitest";
import {
  makeSourceProfile,
  type SourceProfile,
} from "../fixtures/data-assets-v2";

// ─── 纯函数 ─────────────────────────────────────────────────────────────────

/** 判断是否可以下推 */
function canPushdown(profile: SourceProfile, ruleComplexity: "simple" | "complex"): boolean {
  if (!profile.supports_row_pushdown) return false;
  if (ruleComplexity === "complex" && profile.pushdown_ratio < 0.5) return false;
  return true;
}

/** 下推失败后降级策略 */
type FallbackAction = "platform_pruning" | "block_query";

function determineFallback(
  profile: SourceProfile,
  involvesSensitiveLevel: number, // S1=1, S4=4
): FallbackAction {
  // S4 字段 + 非原生脱敏能力 → 阻断
  if (involvesSensitiveLevel >= 4 && !profile.supports_native_masking) {
    return "block_query";
  }
  return "platform_pruning";
}

/** 外部源能力不足对风险的贡献 */
function externalSourceRiskScore(profile: SourceProfile): number {
  let score = 0;
  if (!profile.supports_row_pushdown) score += 10;
  if (!profile.supports_column_pruning) score += 10;
  if (!profile.supports_native_masking) score += 15;
  if (profile.security_level === "low") score += 20;
  else if (profile.security_level === "medium") score += 10;
  return score;
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§7 外部源与降级安全", () => {
  // ── E-01 外部源画像展示 ──────────────────────────────────────────────────
  describe("E-01 外部源画像展示", () => {
    it("PostgreSQL 源画像包含所有能力字段", () => {
      const profile = makeSourceProfile({ source_type: "postgresql" });
      expect(profile).toHaveProperty("supports_row_pushdown");
      expect(profile).toHaveProperty("supports_column_pruning");
      expect(profile).toHaveProperty("supports_native_masking");
      expect(profile).toHaveProperty("pushdown_ratio");
      expect(profile).toHaveProperty("security_level");
    });

    it("画像字段值与真实能力一致", () => {
      const profile = makeSourceProfile({
        supports_row_pushdown: true,
        supports_column_pruning: true,
        supports_native_masking: false,
        pushdown_ratio: 0.85,
        security_level: "medium",
      });
      expect(profile.supports_row_pushdown).toBe(true);
      expect(profile.supports_native_masking).toBe(false);
    });
  });

  // ── E-02 下推失败降级到平台裁剪 ─────────────────────────────────────────
  describe("E-02 下推失败降级到平台裁剪", () => {
    it("不支持下推时回退到平台裁剪", () => {
      const profile = makeSourceProfile({ supports_row_pushdown: false });
      expect(canPushdown(profile, "simple")).toBe(false);

      const fallback = determineFallback(profile, 2);
      expect(fallback).toBe("platform_pruning");
    });

    it("支持下推但规则复杂时判断 pushdown_ratio", () => {
      const lowRatio = makeSourceProfile({ supports_row_pushdown: true, pushdown_ratio: 0.3 });
      expect(canPushdown(lowRatio, "complex")).toBe(false);

      const highRatio = makeSourceProfile({ supports_row_pushdown: true, pushdown_ratio: 0.8 });
      expect(canPushdown(highRatio, "complex")).toBe(true);
    });
  });

  // ── E-03 降级高风险时阻断查询 ───────────────────────────────────────────
  describe("E-03 降级高风险时阻断查询", () => {
    it("涉及 S4 字段且无原生脱敏时阻断", () => {
      const profile = makeSourceProfile({ supports_native_masking: false });
      const action = determineFallback(profile, 4);
      expect(action).toBe("block_query");
    });

    it("涉及 S4 字段但有原生脱敏时允许平台裁剪", () => {
      const profile = makeSourceProfile({ supports_native_masking: true });
      const action = determineFallback(profile, 4);
      expect(action).toBe("platform_pruning");
    });

    it("S2 字段无原生脱敏仍可平台裁剪", () => {
      const profile = makeSourceProfile({ supports_native_masking: false });
      const action = determineFallback(profile, 2);
      expect(action).toBe("platform_pruning");
    });
  });

  // ── E-04 外部源风险纳入总分 ─────────────────────────────────────────────
  describe("E-04 外部源风险纳入总分", () => {
    it("能力不足的外部源贡献更高风险分", () => {
      const weakProfile = makeSourceProfile({
        supports_row_pushdown: false,
        supports_column_pruning: false,
        supports_native_masking: false,
        security_level: "low",
      });
      const strongProfile = makeSourceProfile({
        supports_row_pushdown: true,
        supports_column_pruning: true,
        supports_native_masking: true,
        security_level: "high",
      });
      expect(externalSourceRiskScore(weakProfile)).toBeGreaterThan(externalSourceRiskScore(strongProfile));
    });

    it("security_level=low 额外加 20 分", () => {
      const lowSec = makeSourceProfile({ security_level: "low" });
      const medSec = makeSourceProfile({ security_level: "medium" });
      expect(externalSourceRiskScore(lowSec)).toBeGreaterThan(externalSourceRiskScore(medSec));
    });

    it("外部 PostgreSQL 源应有非零风险贡献", () => {
      const profile = makeSourceProfile(); // 默认中等安全级别，无原生脱敏
      const score = externalSourceRiskScore(profile);
      expect(score).toBeGreaterThan(0);
    });
  });
});
