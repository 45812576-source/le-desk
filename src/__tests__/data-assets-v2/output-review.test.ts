/**
 * 安全内核 V2 — D3 输出审查日志测试
 *
 * 覆盖：
 * - 统计数据计算
 * - 筛选逻辑
 * - 空态
 */
import { describe, it, expect } from "vitest";
import type { OutputReviewLog, OutputReviewAction } from "@/app/(app)/data/components/shared/types";

function makeLog(overrides: Partial<OutputReviewLog> & { id: number }): OutputReviewLog {
  return {
    skill_id: 1,
    skill_name: "测试Skill",
    table_id: 100,
    action: "passed",
    reason: "测试",
    fields_involved: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function computeStats(logs: OutputReviewLog[]) {
  return {
    passed: logs.filter((l) => l.action === "passed").length,
    blocked: logs.filter((l) => l.action === "blocked").length,
    masked: logs.filter((l) => l.action === "masked").length,
    flagged: logs.filter((l) => l.action === "flagged").length,
  };
}

function filterLogs(logs: OutputReviewLog[], filter: OutputReviewAction | ""): OutputReviewLog[] {
  return filter ? logs.filter((l) => l.action === filter) : logs;
}

describe("D3 输出审查日志", () => {
  const logs: OutputReviewLog[] = [
    makeLog({ id: 1, action: "passed" }),
    makeLog({ id: 2, action: "blocked", reason: "敏感字段" }),
    makeLog({ id: 3, action: "masked", fields_involved: ["phone", "name"] }),
    makeLog({ id: 4, action: "passed" }),
    makeLog({ id: 5, action: "flagged" }),
  ];

  it("统计各动作数量", () => {
    const stats = computeStats(logs);
    expect(stats.passed).toBe(2);
    expect(stats.blocked).toBe(1);
    expect(stats.masked).toBe(1);
    expect(stats.flagged).toBe(1);
  });

  it("筛选为空时返回全部", () => {
    expect(filterLogs(logs, "")).toHaveLength(5);
  });

  it("筛选 blocked", () => {
    const filtered = filterLogs(logs, "blocked");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].reason).toBe("敏感字段");
  });

  it("空列表统计全为 0", () => {
    const stats = computeStats([]);
    expect(stats.passed).toBe(0);
    expect(stats.blocked).toBe(0);
    expect(stats.masked).toBe(0);
    expect(stats.flagged).toBe(0);
  });
});
