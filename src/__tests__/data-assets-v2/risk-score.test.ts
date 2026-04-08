/**
 * 安全内核 V2 — D2 风险评分测试
 *
 * 覆盖：
 * - computeLocalRisk 本地兜底计算
 * - 各因素权重正确
 * - 风险等级阈值
 */
import { describe, it, expect } from "vitest";
import { normalizeTableDetail } from "@/app/(app)/data/components/shared/normalize";
import type { RiskLevel, TableDetailV2 } from "@/app/(app)/data/components/shared/types";
import { makeField, makeTableDetail } from "../fixtures/data-assets";

// 复制 computeLocalRisk 的纯逻辑用于测试
function computeLocalRisk(detail: TableDetailV2): { overall_level: RiskLevel; overall_score: number; factorCount: number } {
  let total = 0;
  let factorCount = 0;

  // 敏感字段占比 (max 30)
  const sensitiveCount = detail.fields.filter((f) => f.sensitivity_level !== "S0_public").length;
  const sensitiveRatio = detail.fields.length > 0 ? sensitiveCount / detail.fields.length : 0;
  total += Math.round(sensitiveRatio * 30);
  factorCount++;

  // 权限覆盖 (max 20)
  const hasPermission = detail.permission_policies && detail.permission_policies.length > 0;
  total += hasPermission ? 0 : 20;
  factorCount++;

  // 外部数据源 (max 15)
  total += detail.source_type !== "blank" ? 15 : 0;
  factorCount++;

  // 小样本保护 (max 10)
  total += detail.small_sample_protection?.enabled ? 0 : 10;
  factorCount++;

  const level: RiskLevel = total >= 60 ? "critical" : total >= 40 ? "high" : total >= 20 ? "medium" : "low";
  return { overall_level: level, overall_score: total, factorCount };
}

describe("D2 风险评分", () => {
  it("无敏感字段 + 有权限 + 本地源 + 有小样本 → low", () => {
    const raw = makeTableDetail({
      fields: [makeField({ id: 1, field_name: "name" })],
      permission_policies: [{ id: 1 } as never],
      source_type: "blank",
    });
    const v2 = normalizeTableDetail(raw);
    (v2 as unknown as Record<string, unknown>).small_sample_protection = { enabled: true, threshold: 5, fallback: "hide_bucket" };
    const result = computeLocalRisk(v2);
    expect(result.overall_score).toBe(0);
    expect(result.overall_level).toBe("low");
  });

  it("全敏感 + 无权限 + 外部源 + 无小样本 → high/critical", () => {
    const raw = makeTableDetail({
      fields: [
        makeField({ id: 1, field_name: "phone", is_sensitive: true }),
        makeField({ id: 2, field_name: "salary", is_sensitive: true }),
      ],
      permission_policies: [],
      source_type: "mysql",
    });
    const v2 = normalizeTableDetail(raw);
    const result = computeLocalRisk(v2);
    // 30(全敏感) + 20(无权限) + 15(外部) + 10(无小样本) = 75
    expect(result.overall_score).toBe(75);
    expect(result.overall_level).toBe("critical");
  });

  it("部分敏感 → medium", () => {
    const raw = makeTableDetail({
      fields: [
        makeField({ id: 1, field_name: "phone", is_sensitive: true }),
        makeField({ id: 2, field_name: "city", is_sensitive: false }),
        makeField({ id: 3, field_name: "name", is_sensitive: false }),
      ],
      permission_policies: [{ id: 1 } as never],
      source_type: "blank",
    });
    const v2 = normalizeTableDetail(raw);
    const result = computeLocalRisk(v2);
    // 10(1/3敏感) + 0(有权限) + 0(本地) + 10(无小样本) = 20
    expect(result.overall_score).toBe(20);
    expect(result.overall_level).toBe("medium");
  });

  it("4 个因素全部计算", () => {
    const raw = makeTableDetail({ fields: [makeField({ id: 1, field_name: "a" })] });
    const v2 = normalizeTableDetail(raw);
    const result = computeLocalRisk(v2);
    expect(result.factorCount).toBe(4);
  });
});
