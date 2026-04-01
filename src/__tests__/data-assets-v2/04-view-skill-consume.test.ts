/**
 * §4 视图与 Skill 消费面测试
 *
 * V-01 ~ V-05：视图画像、绑定限制、整表绑定逻辑视图、敏感字段审查、导出规则。
 */
import { describe, it, expect } from "vitest";
import type {
  TableViewDetail,
  SkillDataGrant,
  SkillBindingDetail,
  DisclosureLevel,
} from "@/app/(app)/data/components/shared/types";
import { makeView, makeGrant } from "../fixtures/data-assets";
import {
  V2_VIEWS,
  V2_SKILL_GRANTS,
  V2_BINDINGS,
  V2_POLICIES,
  V2_FIELDS_A,
  makeV2TableA,
} from "../fixtures/data-assets-v2";

// ─── 纯函数 ─────────────────────────────────────────────────────────────────

/** 逻辑视图运行记录 */
interface LogicViewRecord {
  skill_id: number;
  used_fields: string[];
  row_filter_summary: string;
  disclosure_level: DisclosureLevel;
  hit_sensitive: boolean;
}

/** 判断视图是否可绑定 Skill */
function canBindSkill(view: TableViewDetail): boolean {
  // 仅 skill_runtime 类型视图或允许了 skill_ids 的视图可绑定
  return view.view_purpose === "skill_runtime" || view.allowed_skill_ids.length > 0;
}

/** 生成逻辑视图记录 */
function generateLogicViewRecord(
  skillId: number,
  requestedFields: string[],
  policy: { disclosure_level: DisclosureLevel },
  sensitiveFieldNames: string[],
): LogicViewRecord {
  const hitSensitive = requestedFields.some((f) => sensitiveFieldNames.includes(f));
  return {
    skill_id: skillId,
    used_fields: requestedFields,
    row_filter_summary: "all",
    disclosure_level: policy.disclosure_level,
    hit_sensitive: hitSensitive,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§4 视图与 Skill 消费面", () => {
  // ── V-01 视图画像完整性 ──────────────────────────────────────────────────
  describe("V-01 视图画像完整性", () => {
    it("运营明细视图包含完整画像信息", () => {
      const view = V2_VIEWS.find((v) => v.id === 50)!;
      expect(view.name).toBe("运营明细视图");
      expect(view.view_kind).toBe("list");
      expect(view.visible_field_ids.length).toBeGreaterThan(0);
      expect(view.disclosure_ceiling).toBe("L3");
      expect(view.allowed_role_group_ids.length).toBeGreaterThan(0);
    });

    it("每个视图都有 view_kind", () => {
      for (const view of V2_VIEWS) {
        expect(view.view_kind).toBeDefined();
        expect(["list", "board", "metric", "pivot", "review_queue"]).toContain(view.view_kind);
      }
    });

    it("每个视图的 visible_field_ids 非空", () => {
      for (const view of V2_VIEWS) {
        expect(view.visible_field_ids.length).toBeGreaterThan(0);
      }
    });

    it("Skill 绑定关系可追溯", () => {
      const detail = makeV2TableA();
      for (const binding of detail.bindings) {
        if (binding.status === "healthy") {
          expect(binding.view_id).not.toBeNull();
          expect(binding.binding_type).toBe("data_query");
        }
      }
    });
  });

  // ── V-02 Skill 只能绑定允许的视图 ───────────────────────────────────────
  describe("V-02 Skill 只能绑定允许的视图", () => {
    it("explore 类型视图不可绑定 Skill", () => {
      const exploreView = makeView({
        id: 99,
        view_purpose: "explore",
        allowed_skill_ids: [],
      });
      expect(canBindSkill(exploreView)).toBe(false);
    });

    it("skill_runtime 视图可绑定 Skill", () => {
      const runtimeView = V2_VIEWS.find((v) => v.id === 52)!;
      expect(canBindSkill(runtimeView)).toBe(true);
    });

    it("含 allowed_skill_ids 的视图可绑定对应 Skill", () => {
      const view = V2_VIEWS.find((v) => v.id === 51)!;
      expect(view.allowed_skill_ids).toContain(402);
      expect(canBindSkill(view)).toBe(true);
    });
  });

  // ── V-03 整表绑定生成逻辑视图 ───────────────────────────────────────────
  describe("V-03 整表绑定生成逻辑视图", () => {
    it("整表授权查询生成逻辑视图运行记录", () => {
      const record = generateLogicViewRecord(
        404,
        ["customer_id", "customer_name", "risk_status"],
        { disclosure_level: "L4" },
        ["customer_name", "mobile"],
      );
      expect(record.skill_id).toBe(404);
      expect(record.used_fields).toHaveLength(3);
      expect(record.disclosure_level).toBe("L4");
    });

    it("逻辑视图记录包含 hit_sensitive 标记", () => {
      const record = generateLogicViewRecord(
        404,
        ["customer_name", "risk_status"],
        { disclosure_level: "L4" },
        ["customer_name", "mobile"],
      );
      expect(record.hit_sensitive).toBe(true);
    });

    it("未命中敏感字段时 hit_sensitive=false", () => {
      const record = generateLogicViewRecord(
        402,
        ["department_id", "project_id"],
        { disclosure_level: "L2" },
        ["customer_name", "mobile"],
      );
      expect(record.hit_sensitive).toBe(false);
    });
  });

  // ── V-04 逻辑视图命中敏感字段被审查 ─────────────────────────────────────
  describe("V-04 逻辑视图命中敏感字段被审查", () => {
    it("整表绑定请求手机号原值触发审查", () => {
      const sensitiveFields = V2_FIELDS_A.filter((f) => f.is_sensitive).map((f) => f.field_name);
      const record = generateLogicViewRecord(
        404,
        ["mobile"],
        { disclosure_level: "L4" },
        sensitiveFields,
      );
      expect(record.hit_sensitive).toBe(true);
    });
  });

  // ── V-05 导出规则独立生效 ────────────────────────────────────────────────
  describe("V-05 导出规则独立生效", () => {
    it("部门负责人组可查看汇总但禁止导出", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 11)!;
      expect(policy.disclosure_level).toBe("L2");
      expect(policy.export_permission).toBe(false);
    });

    it("高管组可查看也可导出", () => {
      const policy = V2_POLICIES.find((p) => p.role_group_id === 12)!;
      expect(policy.disclosure_level).toBe("L4");
      expect(policy.export_permission).toBe(true);
    });

    it("视图可见不意味着可导出", () => {
      // 销售运营组 L3，可见明细但不可导出
      const policy = V2_POLICIES.find((p) => p.role_group_id === 10)!;
      expect(policy.disclosure_level).toBe("L3");
      expect(policy.export_permission).toBe(false);
    });
  });
});
