import { describe, expect, it } from "vitest";

import {
  normalizeStudioErrorPayload,
  normalizeAuditSummaryPayload,
  normalizeWorkflowCardPayload,
  parseStudioPatchEnvelope,
  parseWorkflowStatePayload,
} from "../workflow-adapter";

describe("workflow-adapter", () => {
  it("normalizes audit summary payloads for the fixed audit panel", () => {
    const audit = normalizeAuditSummaryPayload({
      verdict: "needs_work",
      issues: [{ dimension: "structure", score: 40, detail: "缺少角色定义" }],
      recommended_path: "major_rewrite",
      phase_entry: "phase_1_why",
    });

    expect(audit.severity).toBe("medium");
    expect(audit.quality_score).toBe(55);
    expect(audit.recommended_path).toBe("restructure");
    expect(audit.issues).toHaveLength(1);
    expect(audit.phase_entry).toBe("phase_1_why");
  });

  it("parses audit patch envelope", () => {
    const envelope = parseStudioPatchEnvelope({
      run_id: "run_1",
      run_version: 2,
      patch_seq: 3,
      patch_type: "audit_patch",
      payload: { verdict: "poor" },
    });

    expect(envelope?.run_id).toBe("run_1");
    expect(envelope?.patch_type).toBe("audit_patch");
  });

  it("preserves top-level v3 card orchestration fields", () => {
    const card = normalizeWorkflowCardPayload(
      {
        id: "card-1",
        title: "编辑 Example",
        status: "pending",
        target_file: "examples/onboarding.md",
        file_role: "example",
        handoff_policy: "open_file_workspace",
        route_kind: "internal",
        destination: "file_workspace",
        return_to: "none",
        queue_window: {
          active_card_id: "card-1",
          visible_card_ids: ["card-1"],
          backlog_count: 0,
          phase: "phase_2_what",
          max_visible: 5,
          reveal_policy: "stage_gated",
        },
      },
      "memo-recovery",
    );

    expect(card.content).toMatchObject({
      target_file: "examples/onboarding.md",
      file_role: "example",
      handoff_policy: "open_file_workspace",
      route_kind: "internal",
      destination: "file_workspace",
      return_to: "none",
      queue_window: {
        active_card_id: "card-1",
        visible_card_ids: ["card-1"],
      },
    });
  });

  it("preserves stale card status from session recovery", () => {
    const card = normalizeWorkflowCardPayload(
      {
        id: "stale-card",
        title: "已过期卡",
        status: "stale",
      },
      "memo-recovery",
    );

    expect(card.status).toBe("stale");
  });

  it("accepts partial workflow patches that carry queue fields", () => {
    expect(parseWorkflowStatePayload({
      queue_window: {
        active_card_id: "card-1",
        visible_card_ids: ["card-1"],
        backlog_count: 0,
        phase: "phase_2_what",
        max_visible: 5,
        reveal_policy: "stage_gated",
      },
    })).toMatchObject({
      queue_window: {
        active_card_id: "card-1",
      },
    });

    expect(parseWorkflowStatePayload({ unrelated: true })).toBeNull();
  });

  it("normalizes M5 orchestration errors for the Studio error banner", () => {
    const error = normalizeStudioErrorPayload({
      error_type: "studio_orchestration_error",
      message: "外部交接创建失败",
      step: "handoff",
      recovery_hint: "请重试创建交接记录后再继续。",
      active_card_id: "tool-card",
      auto_advanced: false,
      retryable: true,
      payload_snapshot: { target: "opencode" },
    });

    expect(error).toEqual({
      kind: "studio_orchestration_error",
      message: "外部交接创建失败",
      step: "handoff",
      recoveryHint: "请重试创建交接记录后再继续。",
      activeCardId: "tool-card",
      autoAdvanced: false,
      retryable: true,
      payloadSnapshot: { target: "opencode" },
    });
  });
});
