import { describe, it, expect } from "vitest";
import { buildDataAssetSummary, collectRelatedDepartmentIds, resolveRelatedDepartmentNames } from "../data-asset-summary";
import { makeTableDetail } from "@/__tests__/fixtures/data-assets";

describe("data-asset-summary", () => {
  it("从真实部门 id 集合解析部门名称", () => {
    const detail = makeTableDetail();
    const departments = [
      { id: 10, name: "销售部", parent_id: null },
      { id: 20, name: "市场部", parent_id: null },
    ];

    expect(collectRelatedDepartmentIds(detail)).toContain(10);
    expect(resolveRelatedDepartmentNames(detail, departments)).toEqual(["销售部"]);
  });

  it("生成真实资产摘要、Skill 列表和边界说明", () => {
    const detail = makeTableDetail();
    const departments = [{ id: 10, name: "销售部", parent_id: null }];

    const summary = buildDataAssetSummary(detail, departments);

    expect(summary.related_departments).toEqual(["销售部"]);
    expect(summary.suitable_skills).toContain("内部分析 Skill");
    expect(summary.suitable_skills).toContain("外部汇总 Skill");
    expect(summary.limitation_summary).toContain("SkillStudio");
    expect(summary.summary).toContain("销售部");
  });

  it("在没有绑定 Skill 时给出真实 use case 类型", () => {
    const detail = makeTableDetail({ bindings: [], skill_grants: [] });

    const summary = buildDataAssetSummary(detail, []);

    expect(summary.suitable_skills).toEqual([]);
    expect(summary.suitable_skill_types.length).toBeGreaterThan(0);
    expect(summary.capability_summary).toContain("Skill");
  });
});
