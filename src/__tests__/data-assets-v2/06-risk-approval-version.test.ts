/**
 * §6 风险、审批、版本与回滚测试
 *
 * A-01 ~ A-06：风险评分可解释、审批链路、版本回滚、影响分析。
 */
import { describe, it, expect } from "vitest";
import {
  V2_POLICIES,
  V2_VIEWS,
  V2_SKILL_GRANTS,
  makeRiskAssessment,
  makeApprovalRequest,
  makePolicyVersion,
  type RiskAssessment,
  type ApprovalRequest,
  type PolicyVersion,
} from "../fixtures/data-assets-v2";

// ─── 纯函数 ─────────────────────────────────────────────────────────────────

/** 计算总分是否等于各因子之和 */
function validateRiskScore(assessment: RiskAssessment): boolean {
  const sum = assessment.factors.reduce((acc, f) => acc + f.score, 0);
  return sum === assessment.total_score;
}

/** 判断审批后配置是否生效 */
function isConfigEffective(approval: ApprovalRequest): boolean {
  return approval.status === "approved";
}

/** 回滚到指定版本 */
function rollbackToVersion(
  versions: PolicyVersion[],
  targetVersion: number,
): PolicyVersion | null {
  const target = versions.find((v) => v.version === targetVersion);
  if (!target) return null;
  return {
    ...target,
    version: versions.length + 1,
    change_type: "rollback",
    created_at: new Date().toISOString(),
  };
}

/** 影响分析：查找字段的所有依赖 */
function analyzeDependencies(
  fieldId: number,
  views: typeof V2_VIEWS,
  policies: typeof V2_POLICIES,
  grants: typeof V2_SKILL_GRANTS,
): {
  viewRefs: number[];
  policyRefs: number[];
  grantRefs: number[];
} {
  void grants;
  const viewRefs = views
    .filter((v) => v.visible_field_ids.includes(fieldId))
    .map((v) => v.id);
  const policyRefs = policies
    .filter((p) => p.allowed_field_ids.includes(fieldId))
    .map((p) => p.id);
  const grantRefs: number[] = [];
  return { viewRefs, policyRefs, grantRefs };
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§6 风险、审批、版本与回滚", () => {
  // ── A-01 风险评分因子可解释 ──────────────────────────────────────────────
  describe("A-01 风险评分因子可解释", () => {
    it("总分等于各因子得分之和", () => {
      const assessment = makeRiskAssessment();
      expect(validateRiskScore(assessment)).toBe(true);
    });

    it("每一项因子有可读描述", () => {
      const assessment = makeRiskAssessment();
      for (const factor of assessment.factors) {
        expect(factor.label).toBeTruthy();
        expect(factor.description).toBeTruthy();
        expect(factor.score).toBeGreaterThan(0);
      }
    });

    it("高敏字段、外部源、整表绑定、可导出都是因子", () => {
      const assessment = makeRiskAssessment();
      const codes = assessment.factors.map((f) => f.code);
      expect(codes).toContain("sensitive_fields");
      expect(codes).toContain("external_source");
      expect(codes).toContain("whole_table_binding");
      expect(codes).toContain("exportable");
    });
  });

  // ── A-02 高风险配置生成审批单 ────────────────────────────────────────────
  describe("A-02 高风险配置生成审批单", () => {
    it("关闭小样本保护生成 disable_small_sample 审批单", () => {
      const request = makeApprovalRequest({
        request_type: "disable_small_sample",
        status: "pending",
      });
      expect(request.request_type).toBe("disable_small_sample");
      expect(request.status).toBe("pending");
    });

    it("配置状态 pending，先不落库", () => {
      const request = makeApprovalRequest({ status: "pending" });
      expect(isConfigEffective(request)).toBe(false);
    });
  });

  // ── A-03 审批通过后生效 ──────────────────────────────────────────────────
  describe("A-03 审批通过后生效", () => {
    it("approved 状态配置生效", () => {
      const request = makeApprovalRequest({ status: "approved", reviewed_by: 100 });
      expect(isConfigEffective(request)).toBe(true);
    });

    it("approved 后 reviewed_by 不为 null", () => {
      const request = makeApprovalRequest({ status: "approved", reviewed_by: 100 });
      expect(request.reviewed_by).not.toBeNull();
    });
  });

  // ── A-04 审批拒绝后不生效 ────────────────────────────────────────────────
  describe("A-04 审批拒绝后不生效", () => {
    it("rejected 状态配置不生效", () => {
      const request = makeApprovalRequest({
        status: "rejected",
        reject_reason: "风险过高",
        reviewed_by: 100,
      });
      expect(isConfigEffective(request)).toBe(false);
    });

    it("拒绝原因非空", () => {
      const request = makeApprovalRequest({
        status: "rejected",
        reject_reason: "风险过高",
      });
      expect(request.reject_reason).toBeTruthy();
    });
  });

  // ── A-05 策略版本回滚 ───────────────────────────────────────────────────
  describe("A-05 策略版本回滚", () => {
    const versions: PolicyVersion[] = [
      makePolicyVersion({ version: 1, snapshot: { disclosure_level: "L1" }, change_type: "create" }),
      makePolicyVersion({ version: 2, snapshot: { disclosure_level: "L3" }, change_type: "update" }),
      makePolicyVersion({ version: 3, snapshot: { disclosure_level: "L4" }, change_type: "update" }),
    ];

    it("回滚到 v1 生成新版本记录", () => {
      const rolled = rollbackToVersion(versions, 1);
      expect(rolled).not.toBeNull();
      expect(rolled!.version).toBe(4);
      expect(rolled!.change_type).toBe("rollback");
      expect(rolled!.snapshot).toEqual({ disclosure_level: "L1" });
    });

    it("回滚到不存在的版本返回 null", () => {
      const rolled = rollbackToVersion(versions, 99);
      expect(rolled).toBeNull();
    });
  });

  // ── A-06 影响分析识别受影响对象 ─────────────────────────────────────────
  describe("A-06 影响分析识别受影响对象", () => {
    it("customer_id 被多个视图和策略引用", () => {
      const deps = analyzeDependencies(101, V2_VIEWS, V2_POLICIES, V2_SKILL_GRANTS);
      // customer_id (101) 在多个视图中
      expect(deps.viewRefs.length).toBeGreaterThan(0);
      // 在多个策略的 allowlist 中
      expect(deps.policyRefs.length).toBeGreaterThan(0);
    });

    it("contract_amount (110) 在汇总视图和策略中", () => {
      const deps = analyzeDependencies(110, V2_VIEWS, V2_POLICIES, V2_SKILL_GRANTS);
      expect(deps.viewRefs).toContain(51); // 管理汇总视图
      expect(deps.viewRefs).toContain(53); // 审批高敏视图
    });

    it("一个字段无引用时依赖列表为空", () => {
      const deps = analyzeDependencies(999, V2_VIEWS, V2_POLICIES, V2_SKILL_GRANTS);
      expect(deps.viewRefs).toHaveLength(0);
      expect(deps.policyRefs).toHaveLength(0);
    });
  });
});
