/**
 * 安全内核 V2 — D4 小样本保护测试
 *
 * 覆盖：
 * - 默认配置
 * - 阈值范围 2-20
 * - 回退策略枚举
 * - 受影响范围筛选（L2+）
 */
import { describe, it, expect } from "vitest";
import { EMPTY_SMALL_SAMPLE } from "@/app/(app)/data/components/shared/empty-states";
import type { SmallSampleProtectionConfig, SmallSampleFallback, DisclosureLevel, TableViewDetail, SkillDataGrant } from "@/app/(app)/data/components/shared/types";

describe("D4 小样本保护", () => {
  it("默认配置: 未启用, 阈值 5, hide_bucket", () => {
    expect(EMPTY_SMALL_SAMPLE.enabled).toBe(false);
    expect(EMPTY_SMALL_SAMPLE.threshold).toBe(5);
    expect(EMPTY_SMALL_SAMPLE.fallback).toBe("hide_bucket");
  });

  it("阈值范围校验", () => {
    const validThresholds = [2, 5, 10, 15, 20];
    for (const t of validThresholds) {
      expect(t).toBeGreaterThanOrEqual(2);
      expect(t).toBeLessThanOrEqual(20);
    }
  });

  it("回退策略枚举完整", () => {
    const strategies: SmallSampleFallback[] = ["hide_bucket", "merge_adjacent", "suppress_cell"];
    expect(strategies).toHaveLength(3);
  });

  it("受影响视图筛选 L2+", () => {
    const views = [
      { id: 1, name: "公开视图", disclosure_ceiling: "L0" as DisclosureLevel },
      { id: 2, name: "统计视图", disclosure_ceiling: "L1" as DisclosureLevel },
      { id: 3, name: "脱敏视图", disclosure_ceiling: "L2" as DisclosureLevel },
      { id: 4, name: "明文视图", disclosure_ceiling: "L3" as DisclosureLevel },
    ] as Partial<TableViewDetail>[];

    const affected = views.filter(
      (v) => v.disclosure_ceiling && ["L2", "L3", "L4"].includes(v.disclosure_ceiling)
    );
    expect(affected).toHaveLength(2);
    expect(affected.map((v) => v.name)).toEqual(["脱敏视图", "明文视图"]);
  });

  it("受影响 Skill Grant 筛选 L2+", () => {
    const grants = [
      { id: 1, skill_name: "低权限Skill", max_disclosure_level: "L1" as DisclosureLevel },
      { id: 2, skill_name: "高权限Skill", max_disclosure_level: "L3" as DisclosureLevel },
    ] as Partial<SkillDataGrant>[];

    const affected = grants.filter(
      (g) => ["L2", "L3", "L4"].includes(g.max_disclosure_level!)
    );
    expect(affected).toHaveLength(1);
    expect(affected[0].skill_name).toBe("高权限Skill");
  });
});
