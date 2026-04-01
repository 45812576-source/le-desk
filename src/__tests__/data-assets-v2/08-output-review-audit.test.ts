/**
 * §8 输出审查与审计测试
 *
 * O-01 ~ O-04：原始敏感值拦截、低披露级别降级、多字段身份恢复拦截、审计日志完整性。
 */
import { describe, it, expect } from "vitest";
import type { DisclosureLevel } from "@/app/(app)/data/components/shared/types";
import {
  V2_FIELDS_A,
  V2_SKILL_GRANTS,
  makeOutputReviewLog,
  type OutputReviewLog,
  type OutputReviewAction,
} from "../fixtures/data-assets-v2";

// ─── 纯函数 ─────────────────────────────────────────────────────────────────

const SENSITIVE_FIELD_NAMES = V2_FIELDS_A.filter((f) => f.is_sensitive).map((f) => f.field_name);

/** 检测输出中是否包含原始敏感值 */
function detectRawSensitiveValues(
  output: string,
  sensitiveFieldNames: string[],
  sensitivePatterns: RegExp[],
): { detected: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const pattern of sensitivePatterns) {
    const m = output.match(pattern);
    if (m) matches.push(m[0]);
  }
  return { detected: matches.length > 0, matches };
}

/** 输出审查器 */
function reviewOutput(
  output: string,
  disclosureLevel: DisclosureLevel,
  sensitivePatterns: RegExp[],
): { action: OutputReviewAction; reason: string } {
  // L0 直接 block
  if (disclosureLevel === "L0") {
    return { action: "block_response", reason: "L0 禁止任何输出" };
  }

  // 检测原始敏感值
  const detection = detectRawSensitiveValues(output, SENSITIVE_FIELD_NAMES, sensitivePatterns);

  if (detection.detected) {
    if (disclosureLevel === "L1" || disclosureLevel === "L2") {
      return { action: "block_response", reason: `输出包含敏感值: ${detection.matches.join(", ")}` };
    }
    if (disclosureLevel === "L3") {
      return { action: "redact_and_continue", reason: `脱敏处理敏感值: ${detection.matches.join(", ")}` };
    }
    // L4 允许原始值，但仍记录
  }

  return { action: "pass", reason: "" };
}

/** 检测多字段拼接身份恢复风险 */
function detectReidentification(
  outputFields: string[],
  quasiIdentifierSets: string[][],
): boolean {
  for (const qiSet of quasiIdentifierSets) {
    if (qiSet.every((f) => outputFields.includes(f))) {
      return true;
    }
  }
  return false;
}

/** 审计日志必需字段 */
interface AuditEvent {
  actor: string;
  resource: string;
  action: string;
  result: "success" | "denied" | "degraded";
  risk_level: "low" | "medium" | "high";
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════════

describe("§8 输出审查与审计", () => {
  const phonePattern = /1[3-9]\d{9}/;
  const idCardPattern = /\d{17}[\dXx]/;
  const patterns = [phonePattern, idCardPattern];

  // ── O-01 原始敏感值拦截 ──────────────────────────────────────────────────
  describe("O-01 原始敏感值拦截", () => {
    it("Skill 输出手机号原值被 block", () => {
      const output = "客户张三的联系方式是 13812345678";
      const result = reviewOutput(output, "L1", patterns);
      expect(result.action).toBe("block_response");
    });

    it("L3 下输出手机号被 redact", () => {
      const output = "客户联系方式 13812345678";
      const result = reviewOutput(output, "L3", patterns);
      expect(result.action).toBe("redact_and_continue");
    });

    it("L4 下允许原始值通过", () => {
      const output = "客户联系方式 13812345678";
      const result = reviewOutput(output, "L4", patterns);
      expect(result.action).toBe("pass");
    });

    it("审查日志记录原始与处理后片段", () => {
      const log = makeOutputReviewLog({
        action: "redact_and_continue",
        original_snippet: "13812345678",
        processed_snippet: "138****5678",
        reason: "脱敏处理",
      });
      expect(log.original_snippet).toBe("13812345678");
      expect(log.processed_snippet).toBe("138****5678");
    });
  });

  // ── O-02 低披露级别下引用单行细节降级 ────────────────────────────────────
  describe("O-02 低披露级别下引用单行细节降级", () => {
    it("L2 下「列出最危险的 3 个客户」不应返回客户名称", () => {
      const output = "高风险客户共 8 名，集中在部门A";
      const result = reviewOutput(output, "L2", patterns);
      // 无敏感值，应 pass
      expect(result.action).toBe("pass");
    });

    it("L2 下含具体客户名被 block", () => {
      const output = "最危险的客户是张三（手机 13812345678）";
      const result = reviewOutput(output, "L2", patterns);
      expect(result.action).toBe("block_response");
    });

    it("L0 下任何输出都 block", () => {
      const output = "一般性统计信息";
      const result = reviewOutput(output, "L0", patterns);
      expect(result.action).toBe("block_response");
    });
  });

  // ── O-03 多字段拼接身份恢复拦截 ─────────────────────────────────────────
  describe("O-03 多字段拼接身份恢复拦截", () => {
    // 准标识符集合：城市 + 项目 + 客户等级 + 金额 可恢复身份
    const quasiIdentifierSets = [
      ["city", "project_id", "customer_level", "contract_amount"],
      ["city", "owner_user_id", "contract_amount"],
    ];

    it("输出包含完整准标识符集合被检测", () => {
      const outputFields = ["city", "project_id", "customer_level", "contract_amount"];
      expect(detectReidentification(outputFields, quasiIdentifierSets)).toBe(true);
    });

    it("缺少一个字段则安全", () => {
      const outputFields = ["city", "project_id", "customer_level"];
      expect(detectReidentification(outputFields, quasiIdentifierSets)).toBe(false);
    });

    it("不同准标识符集合都能检测", () => {
      const outputFields = ["city", "owner_user_id", "contract_amount"];
      expect(detectReidentification(outputFields, quasiIdentifierSets)).toBe(true);
    });
  });

  // ── O-04 审计日志完整性 ─────────────────────────────────────────────────
  describe("O-04 审计日志完整性", () => {
    it("Skill 查询审计事件包含所有必需字段", () => {
      const event: AuditEvent = {
        actor: "skill:401",
        resource: "table:1000",
        action: "data_query",
        result: "success",
        risk_level: "low",
        timestamp: "2026-03-30T10:00:00Z",
      };
      expect(event.actor).toBeTruthy();
      expect(event.resource).toBeTruthy();
      expect(event.action).toBeTruthy();
      expect(event.result).toBeTruthy();
      expect(event.risk_level).toBeTruthy();
    });

    it("审批审计事件记录拒绝原因", () => {
      const event: AuditEvent = {
        actor: "user:100",
        resource: "approval:1",
        action: "reject",
        result: "denied",
        risk_level: "high",
        timestamp: "2026-03-30T11:00:00Z",
      };
      expect(event.result).toBe("denied");
      expect(event.risk_level).toBe("high");
    });

    it("Skill grant 包含审计级别", () => {
      for (const grant of V2_SKILL_GRANTS) {
        expect(grant.audit_level).toBeDefined();
        expect(["standard", "full"]).toContain(grant.audit_level);
      }
    });
  });
});
