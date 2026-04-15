import { describe, expect, it } from "vitest";

import { deriveStudioRecoveryDraftImpact, parseStudioRecoveryPayload, parseStudioStatePayload } from "../studio-state-adapter";

describe("parseStudioStatePayload", () => {
  it("normalizes persisted studio transient state", () => {
    const parsed = parseStudioStatePayload({
      scenario: "optimize_existing_skill",
      mode: "draft",
      goal: "补齐 Skill 描述",
      confirmed_facts: ["事实 A"],
      active_constraints: ["约束 B"],
      rejected: ["假设 C"],
      file_status: "forbidden",
      readiness: 4,
      has_draft: true,
      total_rounds: 7,
      reconciled_facts: [{ type: "constraint", text: "约束 B" }],
      direction_shift: { from: "unknown", to: "audit_imported_skill" },
      file_need_status: { status: "forbidden", forbidden_countdown: 2 },
      repeat_blocked: { reason: "连续重复追问，已自动切换到 draft 模式" },
    });

    expect(parsed.sessionState?.scenario).toBe("optimize_existing_skill");
    expect(parsed.sessionState?.file_status).toBe("forbidden");
    expect(parsed.reconciledFacts).toEqual([{ type: "constraint", text: "约束 B" }]);
    expect(parsed.directionShift).toEqual({ from: "unknown", to: "audit_imported_skill" });
    expect(parsed.fileNeedStatus).toEqual({ status: "forbidden", forbidden_countdown: 2 });
    expect(parsed.repeatBlocked).toContain("自动切换到 draft 模式");
  });

  it("falls back cleanly for empty payload", () => {
    const parsed = parseStudioStatePayload(null);

    expect(parsed.sessionState).toBeNull();
    expect(parsed.reconciledFacts).toEqual([]);
    expect(parsed.directionShift).toBeNull();
    expect(parsed.fileNeedStatus).toBeNull();
    expect(parsed.repeatBlocked).toBeNull();
  });

  it("normalizes recovery metadata", () => {
    const parsed = parseStudioRecoveryPayload({
      source: "persisted",
      cold_start: true,
      recovered_at: "2026-04-15T05:12:00Z",
    });

    expect(parsed).toEqual({
      source: "persisted",
      cold_start: true,
      recovered_at: "2026-04-15T05:12:00Z",
    });
  });

  it("describes how recovery affects editor draft", () => {
    const recoveryInfo = {
      source: "persisted" as const,
      cold_start: true,
      recovered_at: "2026-04-15T05:12:00Z",
    };

    expect(deriveStudioRecoveryDraftImpact({
      recoveryInfo,
      pendingDraft: { system_prompt: "draft" },
    })).toBe("已恢复待采纳草稿，尚未写入编辑器");

    expect(deriveStudioRecoveryDraftImpact({
      recoveryInfo,
      sessionState: {
        scenario: "optimize_existing_skill",
        mode: "draft",
        goal: "继续优化",
        confirmed_facts: [],
        active_constraints: [],
        rejected: [],
        file_status: "not_needed",
        readiness: 3,
        has_draft: true,
        total_rounds: 2,
      },
      currentPrompt: "已有编辑器内容",
      editorIsDirty: true,
    })).toBe("已恢复草稿上下文，当前编辑器仍保留本地修改");
  });
});
