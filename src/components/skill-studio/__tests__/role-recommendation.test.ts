import { describe, expect, it } from "vitest";
import type { Department, OrgMemorySnapshot, SkillDetail, User } from "@/lib/types";
import { recommendRoleList } from "../role-recommendation";

const departments: Department[] = [
  { id: 1, name: "销售管理部", parent_id: null, category: null, business_unit: null },
  { id: 2, name: "商务一部", parent_id: 1, category: null, business_unit: null },
  { id: 3, name: "人力资源部", parent_id: null, category: null, business_unit: null },
];

const snapshots: OrgMemorySnapshot[] = [
  {
    id: 1,
    source_id: 1,
    source_title: "销售组织治理文档",
    snapshot_version: "snapshot-1",
    parse_status: "ready",
    confidence_score: 0.92,
    created_at: "2026-04-17T00:00:00+08:00",
    summary: "销售组织解析完成",
    entity_counts: { units: 2, roles: 2, people: 0, okrs: 1, processes: 1 },
    units: [
      {
        id: 1,
        name: "商务一部",
        unit_type: "department",
        parent_name: "销售中心",
        leader_name: "王璐",
        responsibilities: ["客户推进", "案例复盘", "SOP 沉淀"],
        evidence_refs: [],
      },
      {
        id: 2,
        name: "人力资源部",
        unit_type: "department",
        parent_name: "公司经营发展中心",
        leader_name: "李冉",
        responsibilities: ["招聘", "绩效考核", "面试流程"],
        evidence_refs: [],
      },
    ],
    roles: [
      {
        id: 11,
        name: "商务顾问",
        department_name: "商务一部",
        responsibilities: ["客户跟进", "案例复盘", "商机判断"],
        evidence_refs: [],
      },
      {
        id: 12,
        name: "招聘主管",
        department_name: "人力资源部",
        responsibilities: ["招聘", "面试安排", "绩效复盘"],
        evidence_refs: [],
      },
    ],
    people: [],
    okrs: [
      {
        id: 21,
        owner_name: "商务一部",
        period: "2026Q2",
        objective: "沉淀客户案例复盘方法",
        key_results: ["输出 30 份案例卡", "形成统一 SOP"],
        evidence_refs: [],
      },
    ],
    processes: [
      {
        id: 31,
        owner_name: "商务一部",
        name: "客户案例复盘流程",
        participants: ["商务顾问", "销售经理"],
        outputs: ["案例卡", "复盘摘要"],
        risk_points: ["客户身份暴露"],
        evidence_refs: [],
      },
    ],
    low_confidence_items: [],
  },
];

const user: User = {
  id: 7,
  username: "zhaoan",
  display_name: "赵安",
  role: "employee",
  department_id: 2,
  position_id: 101,
  report_to_id: null,
  report_to_name: null,
  is_active: true,
  created_at: "2026-04-17T00:00:00+08:00",
};

const positions = [
  { id: 101, name: "商务顾问", department_id: 2 },
  { id: 102, name: "招聘主管", department_id: 3 },
];

describe("recommendRoleList", () => {
  it("prefers roles supported by both skill content and org memory", () => {
    const skill: SkillDetail = {
      id: 1,
      name: "商务案例复盘助手",
      description: "帮助商务团队做客户案例复盘、输出 SOP 与案例卡",
      scope: "company",
      department_id: 2,
      created_by: 7,
      is_active: true,
      created_at: "2026-04-17T00:00:00+08:00",
      mode: "hybrid",
      status: "draft",
      knowledge_tags: ["案例复盘", "SOP"],
      auto_inject: true,
      current_version: 1,
      system_prompt: "你要协助商务顾问沉淀客户案例复盘方法论。",
      data_queries: [],
    };

    const result = recommendRoleList({
      skill,
      assets: [{ asset_name: "客户案例库", asset_type: "knowledge_base", risk_flags: [] }],
      snapshots,
      departments,
      positions,
      user,
    });

    expect(result.mode).toBe("recommended");
    expect(result.items[0].position_name).toBe("商务顾问");
    expect(result.items[0].confidence).toBe("high");
  });

  it("falls back to editor department role when evidence is weak", () => {
    const skill: SkillDetail = {
      id: 2,
      name: "通用草稿助手",
      description: "帮助整理零散内容",
      scope: "company",
      department_id: null,
      created_by: 7,
      is_active: true,
      created_at: "2026-04-17T00:00:00+08:00",
      mode: "hybrid",
      status: "draft",
      knowledge_tags: [],
      auto_inject: false,
      current_version: 1,
      system_prompt: "输出通用总结。",
      data_queries: [],
    };

    const result = recommendRoleList({
      skill,
      assets: [],
      snapshots,
      departments,
      positions,
      user,
    });

    expect(result.mode).toBe("fallback");
    expect(result.overall_confidence).toBe("low");
    expect(result.items[0].position_name).toBe("商务顾问");
  });
});
