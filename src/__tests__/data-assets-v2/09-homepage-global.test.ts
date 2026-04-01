/**
 * §9 首页与全局运营测试
 *
 * H-01 ~ H-03：KPI 数据准确、风险摘要联动、快捷筛选正确性。
 */
import { describe, it, expect } from "vitest";
import { makeTableDetail } from "../fixtures/data-assets";
import {
  makeV2TableA,
  makeV2TableB,
  makeV2TableC,
  makeRiskAssessment,
  makeApprovalRequest,
  type RiskAssessment,
  type ApprovalRequest,
} from "../fixtures/data-assets-v2";
import type { TableDetail } from "@/app/(app)/data/components/shared/types";

// ─── 纯函数 ─────────────────────────────────────────────────────────────────

interface KPIData {
  unfiledCount: number;
  highRiskCount: number;
  pendingApprovalCount: number;
  syncFailCount: number;
}

function computeKPI(
  tables: TableDetail[],
  riskAssessments: Map<number, RiskAssessment>,
  approvals: ApprovalRequest[],
): KPIData {
  return {
    unfiledCount: tables.filter((t) => t.folder_id === null).length,
    highRiskCount: Array.from(riskAssessments.values()).filter(
      (r) => r.risk_level === "high" || r.risk_level === "critical"
    ).length,
    pendingApprovalCount: approvals.filter((a) => a.status === "pending").length,
    syncFailCount: tables.filter((t) => t.sync_status === "error").length,
  };
}

type QuickFilter = "high_risk" | "pending_approval" | "skill_bound" | "external_source";

function applyQuickFilter(
  tables: TableDetail[],
  filter: QuickFilter,
  riskAssessments: Map<number, RiskAssessment>,
): TableDetail[] {
  switch (filter) {
    case "high_risk":
      return tables.filter((t) => {
        const r = riskAssessments.get(t.id);
        return r && (r.risk_level === "high" || r.risk_level === "critical");
      });
    case "pending_approval":
      // 需要外部审批数据，此处简化
      return [];
    case "skill_bound":
      return tables.filter((t) => t.bindings.length > 0);
    case "external_source":
      return tables.filter((t) => t.source_type !== "bitable");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§9 首页与全局运营", () => {
  const tableA = makeV2TableA();
  const tableB = makeV2TableB({ folder_id: null }); // 未归档
  const tableC = makeV2TableC({ sync_status: "error" }); // 同步失败
  const allTables = [tableA, tableB, tableC];

  const riskMap = new Map<number, RiskAssessment>([
    [1000, makeRiskAssessment({ risk_level: "medium", total_score: 65 })],
    [1001, makeRiskAssessment({ risk_level: "low", total_score: 20 })],
    [1002, makeRiskAssessment({ risk_level: "high", total_score: 85 })],
  ]);

  const pendingApprovals = [
    makeApprovalRequest({ id: 1, status: "pending" }),
    makeApprovalRequest({ id: 2, status: "approved" }),
    makeApprovalRequest({ id: 3, status: "pending" }),
  ];

  // ── H-01 KPI 数据准确 ───────────────────────────────────────────────────
  describe("H-01 KPI 数据准确", () => {
    it("未归档数量正确", () => {
      const kpi = computeKPI(allTables, riskMap, pendingApprovals);
      expect(kpi.unfiledCount).toBe(1); // tableB
    });

    it("高风险数量正确", () => {
      const kpi = computeKPI(allTables, riskMap, pendingApprovals);
      expect(kpi.highRiskCount).toBe(1); // tableC
    });

    it("待审批数量正确", () => {
      const kpi = computeKPI(allTables, riskMap, pendingApprovals);
      expect(kpi.pendingApprovalCount).toBe(2);
    });

    it("同步失败数量正确", () => {
      const kpi = computeKPI(allTables, riskMap, pendingApprovals);
      expect(kpi.syncFailCount).toBe(1); // tableC
    });
  });

  // ── H-02 风险摘要面板联动 ───────────────────────────────────────────────
  describe("H-02 风险摘要面板联动", () => {
    it("高风险表可按风险等级排序", () => {
      const sorted = Array.from(riskMap.entries())
        .sort((a, b) => b[1].total_score - a[1].total_score);
      expect(sorted[0][0]).toBe(1002); // 最高风险
      expect(sorted[0][1].total_score).toBe(85);
    });

    it("风险摘要包含 TOP 表信息", () => {
      const top = Array.from(riskMap.entries())
        .filter(([, r]) => r.risk_level === "high" || r.risk_level === "critical");
      expect(top.length).toBeGreaterThan(0);
    });
  });

  // ── H-03 快捷筛选正确性 ────────────────────────────────────────────────
  describe("H-03 快捷筛选正确性", () => {
    it("高风险筛选返回正确表", () => {
      const filtered = applyQuickFilter(allTables, "high_risk", riskMap);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1002);
    });

    it("Skill 绑定筛选返回有绑定的表", () => {
      const filtered = applyQuickFilter(allTables, "skill_bound", riskMap);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1000); // 只有 tableA 有 bindings
    });

    it("外部源筛选返回非 bitable 表", () => {
      const filtered = applyQuickFilter(allTables, "external_source", riskMap);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].source_type).toBe("postgresql");
    });
  });
});
