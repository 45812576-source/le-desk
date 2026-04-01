/**
 * 字段字典与枚举值测试 — 测试计划 §4
 *
 * 验证字段类型区分（enum vs free text）、字典完整性、
 * 敏感字段保护、历史枚举值可见性等。
 */
import { describe, it, expect } from "vitest";
import {
  FIELDS,
  ENUM_DICTIONARY,
  makeField,
} from "../fixtures/data-assets";
import type { TableFieldDetail, FieldValueDictionary } from "@/app/(app)/data/components/shared/types";

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/** 判断字段是否为枚举类型 */
function isEnumField(field: TableFieldDetail): boolean {
  return field.is_enum && !field.is_free_text;
}

/** 获取字段的活跃枚举值（用于筛选器） */
function getActiveEnumValues(dictionary: FieldValueDictionary[]): string[] {
  return dictionary
    .filter((d) => d.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => d.value);
}

/** 获取字段的全部枚举值（含停用，用于历史记录展示） */
function getAllEnumValues(dictionary: FieldValueDictionary[]): string[] {
  return dictionary
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => d.value);
}

/** 限制样本值数量 */
function getSampleValues(field: TableFieldDetail, maxSamples: number = 5): string[] {
  return field.sample_values.slice(0, maxSamples);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 测试用例
// ═══════════════════════════════════════════════════════════════════════════════

describe("字段类型区分", () => {
  it("单选枚举字段正确标记为 is_enum", () => {
    const dept = FIELDS.find((f) => f.field_name === "department")!;
    expect(isEnumField(dept)).toBe(true);
    expect(dept.enum_values).toEqual(["销售部", "市场部", "技术部"]);
  });

  it("多选枚举字段正确标记", () => {
    const multiSelect = makeField({
      field_name: "tags",
      field_type: "multi_select",
      is_enum: true,
      is_free_text: false,
      enum_values: ["标签A", "标签B", "标签C"],
    });
    expect(isEnumField(multiSelect)).toBe(true);
    expect(multiSelect.enum_values).toHaveLength(3);
  });

  it("free text 字段不会被误标为 enum", () => {
    const notes = FIELDS.find((f) => f.field_name === "notes")!;
    expect(isEnumField(notes)).toBe(false);
    expect(notes.is_free_text).toBe(true);
  });

  it("系统字段不参与枚举/free 分类", () => {
    const sys = FIELDS.find((f) => f.field_name === "id")!;
    expect(sys.is_system).toBe(true);
    expect(sys.is_enum).toBe(false);
  });
});

describe("枚举值字典完整性", () => {
  it("单选枚举字段返回完整值集合", () => {
    const activeValues = getActiveEnumValues(ENUM_DICTIONARY);
    expect(activeValues).toEqual(["销售部", "市场部", "技术部"]);
  });

  it("被停用的枚举值仍能在全集中识别", () => {
    const allValues = getAllEnumValues(ENUM_DICTIONARY);
    expect(allValues).toContain("已撤销部门");
  });

  it("活跃枚举值不包含停用项", () => {
    const activeValues = getActiveEnumValues(ENUM_DICTIONARY);
    expect(activeValues).not.toContain("已撤销部门");
  });

  it("枚举值按 sort_order 排序", () => {
    const sorted = [...ENUM_DICTIONARY].sort((a, b) => a.sort_order - b.sort_order);
    expect(sorted.map((d) => d.value)).toEqual(["销售部", "市场部", "技术部", "已撤销部门"]);
  });

  it("枚举值来源可追溯（synced/manual/inferred）", () => {
    const synced = ENUM_DICTIONARY.filter((d) => d.source === "synced");
    const manual = ENUM_DICTIONARY.filter((d) => d.source === "manual");
    expect(synced.length).toBeGreaterThan(0);
    expect(manual.length).toBeGreaterThan(0);
  });
});

describe("字段从 free 升级为受控枚举", () => {
  it("升级后 is_enum=true, is_free_text=false", () => {
    const before = makeField({ field_name: "city", is_enum: false, is_free_text: true, enum_values: [] });
    // 模拟升级
    const after: TableFieldDetail = { ...before, is_enum: true, is_free_text: false, enum_values: ["北京", "上海", "广州"] };
    expect(isEnumField(before)).toBe(false);
    expect(isEnumField(after)).toBe(true);
    expect(after.enum_values).toHaveLength(3);
  });
});

describe("样本值与敏感字段保护", () => {
  it("样本值最多返回约定数量", () => {
    const field = makeField({ sample_values: ["a", "b", "c", "d", "e", "f", "g", "h"] });
    const samples = getSampleValues(field, 5);
    expect(samples).toHaveLength(5);
  });

  it("敏感字段即使有样本值，也必须标记 is_sensitive", () => {
    const phone = FIELDS.find((f) => f.field_name === "phone")!;
    expect(phone.is_sensitive).toBe(true);
    // 业务逻辑：前端应根据 is_sensitive + disclosure_level 决定是否展示 sample_values
  });

  it("敏感字段带有 sensitive 角色标签", () => {
    const phone = FIELDS.find((f) => f.field_name === "phone")!;
    expect(phone.field_role_tags).toContain("sensitive");
  });
});

describe("枚举值与 field.enum_values 一致性", () => {
  it("字段的 enum_values 与字典活跃值一致", () => {
    const dept = FIELDS.find((f) => f.field_name === "department")!;
    const dictValues = getActiveEnumValues(ENUM_DICTIONARY.filter((d) => d.field_id === dept.id));
    expect(dept.enum_values).toEqual(dictValues);
  });
});
