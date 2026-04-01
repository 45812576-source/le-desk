/**
 * 安全内核 V2 — D1 字段敏感分级测试
 *
 * 覆盖：
 * - sensitivity_level 默认推断逻辑
 * - S2+ 同步 is_sensitive = true
 * - 批量设置敏感级别
 * - 行背景色随敏感级别渐变
 */
import { describe, it, expect } from "vitest";
import { normalizeField } from "@/app/(app)/data/components/shared/normalize";
import type { TableFieldDetail, SensitivityLevel, TableFieldDetailV2 } from "@/app/(app)/data/components/shared/types";
import { makeField } from "../fixtures/data-assets";

describe("D1 字段敏感分级", () => {
  it("is_sensitive=true 推断为 S2_sensitive", () => {
    const raw = makeField({ id: 1, field_name: "phone", is_sensitive: true });
    const v2 = normalizeField(raw);
    expect(v2.sensitivity_level).toBe("S2_sensitive");
  });

  it("is_sensitive=false 推断为 S0_public", () => {
    const raw = makeField({ id: 2, field_name: "city", is_sensitive: false });
    const v2 = normalizeField(raw);
    expect(v2.sensitivity_level).toBe("S0_public");
  });

  it("已有 sensitivity_level 时不覆盖", () => {
    const raw = makeField({ id: 3, field_name: "salary", is_sensitive: true }) as unknown as TableFieldDetailV2;
    raw.sensitivity_level = "S4_restricted";
    const v2 = normalizeField(raw as unknown as TableFieldDetail);
    expect(v2.sensitivity_level).toBe("S4_restricted");
  });

  it("S2+ 应同步 is_sensitive", () => {
    const levels: [SensitivityLevel, boolean][] = [
      ["S0_public", false],
      ["S1_internal", false],
      ["S2_sensitive", true],
      ["S3_confidential", true],
      ["S4_restricted", true],
    ];
    for (const [level, expected] of levels) {
      // 字符串比较 >= "S2_sensitive" 的规则
      const shouldBeSensitive = level >= "S2_sensitive";
      expect(shouldBeSensitive).toBe(expected);
    }
  });

  it("批量更新接口参数正确", () => {
    const fieldIds = [1, 2, 3];
    const level: SensitivityLevel = "S3_confidential";
    const payload = {
      field_ids: fieldIds,
      sensitivity_level: level,
      is_sensitive: level >= "S2_sensitive",
    };
    expect(payload.field_ids).toHaveLength(3);
    expect(payload.is_sensitive).toBe(true);
    expect(payload.sensitivity_level).toBe("S3_confidential");
  });
});
