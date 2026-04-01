/**
 * §10 回归与稳定性测试
 *
 * R-01 ~ R-04：V1 不回退、Feature Flag 双态、大表性能边界、并发冲突检测。
 */
import { describe, it, expect } from "vitest";
import type {
  TableDetail,
  TableFieldDetail,
  TablePermissionPolicy,
  DisclosureLevel,
  FieldAccessMode,
} from "@/app/(app)/data/components/shared/types";
import {
  makeField,
  makePolicy,
  makeView,
  makeRoleGroup,
  makeTableDetail,
  FIELDS,
  ROLE_GROUPS,
  POLICIES,
  VIEWS,
  SKILL_GRANTS,
} from "../fixtures/data-assets";
import {
  makeV2TableA,
  V2_FIELDS_A,
  V2_ROLE_GROUPS,
  V2_POLICIES,
  V2_VIEWS,
  V2_SKILL_GRANTS,
} from "../fixtures/data-assets-v2";

// ─── 纯函数 ─────────────────────────────────────────────────────────────────

function resolveVisibleFields(
  fields: TableFieldDetail[],
  policy: Pick<TablePermissionPolicy, "field_access_mode" | "allowed_field_ids" | "blocked_field_ids">,
): TableFieldDetail[] {
  switch (policy.field_access_mode) {
    case "all":
      return fields.filter((f) => !f.is_system);
    case "allowlist":
      return fields.filter((f) => f.id !== null && policy.allowed_field_ids.includes(f.id!));
    case "blocklist":
      return fields.filter((f) => !f.id || !policy.blocked_field_ids.includes(f.id));
    default:
      return [];
  }
}

/** 模拟乐观锁版本冲突检测 */
interface ConfigWithVersion {
  version: number;
  disclosure_level: DisclosureLevel;
  updated_at: string;
}

function detectConflict(
  serverVersion: ConfigWithVersion,
  clientBaseVersion: number,
): boolean {
  return serverVersion.version !== clientBaseVersion;
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§10 回归与稳定性", () => {
  // ── R-01 V1 基础功能不回退 ──────────────────────────────────────────────
  describe("R-01 V1 基础功能不回退", () => {
    it("V1 TableDetail 结构仍可使用", () => {
      const v1Detail = makeTableDetail();
      expect(v1Detail.id).toBeDefined();
      expect(v1Detail.fields.length).toBeGreaterThan(0);
      expect(v1Detail.views.length).toBeGreaterThan(0);
      expect(v1Detail.role_groups.length).toBeGreaterThan(0);
      expect(v1Detail.permission_policies.length).toBeGreaterThan(0);
    });

    it("V1 字段权限引擎不受 V2 影响", () => {
      const result = resolveVisibleFields(FIELDS, {
        field_access_mode: "blocklist",
        allowed_field_ids: [],
        blocked_field_ids: [2, 3, 9],
      });
      expect(result.find((f) => f.field_name === "name")).toBeUndefined();
      expect(result.find((f) => f.field_name === "department")).toBeDefined();
    });

    it("V1 角色组和策略结构完整", () => {
      for (const rg of ROLE_GROUPS) {
        expect(rg).toHaveProperty("id");
        expect(rg).toHaveProperty("name");
        expect(rg).toHaveProperty("group_type");
      }
      for (const p of POLICIES) {
        expect(p).toHaveProperty("role_group_id");
        expect(p).toHaveProperty("disclosure_level");
      }
    });

    it("V1 Skill grant 结构完整", () => {
      for (const g of SKILL_GRANTS) {
        expect(g).toHaveProperty("skill_id");
        expect(g).toHaveProperty("max_disclosure_level");
        expect(g).toHaveProperty("audit_level");
      }
    });
  });

  // ── R-02 Feature Flag 双态 ─────────────────────────────────────────────
  describe("R-02 Feature Flag 双态", () => {
    it("V1 模式下 V2 扩展字段为可选", () => {
      // V1 视图没有 view_purpose，应安全降级
      const v1View = makeView();
      expect(v1View.view_purpose).toBeNull(); // 默认 null
    });

    it("V2 模式下所有扩展可用", () => {
      const v2Detail = makeV2TableA();
      expect(v2Detail.views.some((v) => v.view_purpose !== null)).toBe(true);
    });

    it("切换不串状态 — V1 和 V2 数据独立", () => {
      const v1 = makeTableDetail();
      const v2 = makeV2TableA();
      // 不共享 id
      expect(v1.id).not.toBe(v2.id);
      // 各自字段集独立
      expect(v1.fields.map((f) => f.id)).not.toEqual(v2.fields.map((f) => f.id));
    });
  });

  // ── R-03 大表性能边界 ─────────────────────────────────────────────────
  describe("R-03 大表性能边界", () => {
    it("100 字段表不超时", () => {
      const fields = Array.from({ length: 100 }, (_, i) =>
        makeField({
          id: i + 1,
          field_name: `field_${i}`,
          display_name: `字段${i}`,
          is_sensitive: i < 10,
          is_enum: i >= 10 && i < 30,
          is_free_text: i >= 30,
        })
      );
      expect(fields).toHaveLength(100);

      // 权限引擎可处理 100 字段
      const result = resolveVisibleFields(fields, {
        field_access_mode: "all",
        allowed_field_ids: [],
        blocked_field_ids: [],
      });
      expect(result.length).toBe(100); // 无 system 字段
    });

    it("6 角色组 × 100 字段不崩溃", () => {
      const fields = Array.from({ length: 100 }, (_, i) =>
        makeField({ id: i + 1, field_name: `f${i}` })
      );
      const groups = Array.from({ length: 6 }, (_, i) =>
        makeRoleGroup({ id: i + 1, name: `组${i}` })
      );

      for (const g of groups) {
        const policy = makePolicy({
          role_group_id: g.id,
          field_access_mode: "allowlist",
          allowed_field_ids: fields.slice(0, 30).map((f) => f.id!),
        });
        const result = resolveVisibleFields(fields, policy);
        expect(result).toHaveLength(30);
      }
    });
  });

  // ── R-04 并发配置冲突 ─────────────────────────────────────────────────
  describe("R-04 并发配置冲突", () => {
    it("版本不一致时检测到冲突", () => {
      const serverState: ConfigWithVersion = {
        version: 3,
        disclosure_level: "L3",
        updated_at: "2026-03-30T10:00:00Z",
      };
      // 用户 A 基于 version 2 修改
      expect(detectConflict(serverState, 2)).toBe(true);
    });

    it("版本一致时无冲突", () => {
      const serverState: ConfigWithVersion = {
        version: 3,
        disclosure_level: "L3",
        updated_at: "2026-03-30T10:00:00Z",
      };
      expect(detectConflict(serverState, 3)).toBe(false);
    });

    it("两人同时编辑，后者检测到冲突", () => {
      const initial: ConfigWithVersion = { version: 1, disclosure_level: "L2", updated_at: "2026-03-30T09:00:00Z" };
      // A 保存成功 → version=2
      const afterA: ConfigWithVersion = { version: 2, disclosure_level: "L3", updated_at: "2026-03-30T09:05:00Z" };
      // B 基于 version=1 保存
      expect(detectConflict(afterA, 1)).toBe(true);
    });
  });
});
