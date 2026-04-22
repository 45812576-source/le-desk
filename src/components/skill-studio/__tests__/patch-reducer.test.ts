import { describe, expect, it, vi } from "vitest";
import {
  applyStudioPatch,
  normalizeIncomingWorkbenchStatus,
  type PatchContext,
  type ApplyStudioPatchResult,
} from "../patch-reducer";
import type { StudioPatchEnvelope } from "../workflow-protocol";
import type { StudioSessionState } from "@/lib/studio-store";

// ─── Mock store builder ──────────────────────────────────────────────────────

function buildMockStore(overrides: Partial<StudioSessionState> = {}): StudioSessionState {
  return {
    activeRunId: null,
    activeRunVersion: null,
    appliedPatchSeqs: [],
    appliedIdempotencyKeys: new Set<string>(),
    archivedRuns: [],
    deepPatches: [],
    workflowState: null,
    cardsById: {},
    cardOrder: [],
    governanceCards: [],
    governanceCardSources: {},
    governanceCardLedger: {},
    stagedEdits: [],
    stagedEditSources: {},
    stagedEditLedger: {},
    queueWindow: null,
    architectArtifacts: [],
    transitionBlock: null,
    reconcileConflict: null,
    timelineEntries: [],
    workspace: {
      mode: "analysis",
      currentTarget: { type: null, key: null },
      currentCardId: null,
      validationSource: null,
    },
    // Actions — all mocked
    setActiveRun: vi.fn(),
    rememberPatchSeq: vi.fn(),
    rememberIdempotencyKey: vi.fn(),
    addGovernanceCard: vi.fn(),
    addStagedEdit: vi.fn(),
    upsertWorkbenchCard: vi.fn(),
    updateWorkbenchCardStatus: vi.fn(),
    updateCardStatus: vi.fn(),
    setActiveCardId: vi.fn(),
    setWorkflowState: vi.fn(),
    mergeArchitectArtifacts: vi.fn(),
    addDeepPatch: vi.fn(),
    setQueueWindow: vi.fn(),
    setStudioError: vi.fn(),
    archiveRun: vi.fn(),
    setSessionMode: vi.fn(),
    setEditorVisibility: vi.fn(),
    setEditorManuallyCollapsed: vi.fn(),
    setActiveAssistSkills: vi.fn(),
    setActiveWorkbenchCardId: vi.fn(),
    setWorkbenchMode: vi.fn(),
    setWorkspace: vi.fn(),
    replaceWorkbenchCards: vi.fn(),
    syncGovernanceCards: vi.fn(),
    syncStagedEdits: vi.fn(),
    adoptStagedEdit: vi.fn(),
    rejectStagedEdit: vi.fn(),
    requestPreflightRefresh: vi.fn(),
    setPendingDraft: vi.fn(),
    setPendingSummary: vi.fn(),
    setPendingToolSuggestion: vi.fn(),
    setPendingFileSplit: vi.fn(),
    setSessionState: vi.fn(),
    setMemo: vi.fn(),
    dismissResumeHint: vi.fn(),
    clearArchitectArtifacts: vi.fn(),
    resetWorkflowArtifacts: vi.fn(),
    resetRunTracking: vi.fn(),
    reset: vi.fn(),
    setTransitionBlock: vi.fn(),
    setReconcileConflict: vi.fn(),
    appendTimelineEntry: vi.fn(),
    ...overrides,
  } as unknown as StudioSessionState;
}

function buildCtx(storeOverrides: Partial<StudioSessionState> = {}): PatchContext {
  return {
    store: buildMockStore(storeOverrides),
    source: "test-source",
    setRouteInfo: vi.fn(),
    setStreamStage: vi.fn(),
    setStreaming: vi.fn(),
    setActiveRunId: vi.fn(),
    setStoreSessionMode: vi.fn(),
    onExpandEditor: vi.fn(),
    onMemoRefresh: vi.fn(),
  };
}

function makeEnvelope(overrides: Partial<StudioPatchEnvelope> = {}): StudioPatchEnvelope {
  return {
    run_id: "run_1",
    run_version: 1,
    patch_seq: 1,
    patch_type: "governance_patch",
    payload: { id: "card-1", title: "Test", type: "followup_prompt", actions: [] },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("applyStudioPatch", () => {
  // ─── Envelope validation ────────────────────────────────────────────────
  describe("envelope validation", () => {
    it("rejects envelope with missing run_id", () => {
      const ctx = buildCtx();
      const result = applyStudioPatch(makeEnvelope({ run_id: "" as any }), ctx);
      expect(result.applied).toBe(false);
      expect(result.rejectReason).toBe("invalid_envelope");
      expect(result.rejectDetail).toBe("missing_run_id");
    });

    it("rejects envelope with missing patch_seq", () => {
      const ctx = buildCtx();
      const result = applyStudioPatch(makeEnvelope({ patch_seq: NaN as any }), ctx);
      expect(result.applied).toBe(false);
      expect(result.rejectReason).toBe("invalid_envelope");
      expect(result.rejectDetail).toBe("missing_patch_seq");
    });

    it("rejects envelope with missing payload", () => {
      const ctx = buildCtx();
      const result = applyStudioPatch(makeEnvelope({ payload: null as any }), ctx);
      expect(result.applied).toBe(false);
      expect(result.rejectReason).toBe("invalid_envelope");
      expect(result.rejectDetail).toBe("missing_payload");
    });
  });

  // ─── Dedup ──────────────────────────────────────────────────────────────
  describe("dedup", () => {
    it("skips duplicate patch_seq", () => {
      const ctx = buildCtx({ appliedPatchSeqs: [1, 2, 3] });
      const result = applyStudioPatch(makeEnvelope({ patch_seq: 2 }), ctx);
      expect(result.applied).toBe(false);
      expect(result.rejectReason).toBe("duplicate_patch_seq");
      expect(ctx.store.addGovernanceCard).not.toHaveBeenCalled();
    });

    it("skips duplicate idempotency_key (composite: run_id + key)", () => {
      const keys = new Set(["run_1:key-abc"]);
      const ctx = buildCtx({ appliedIdempotencyKeys: keys });
      const envelope = makeEnvelope({ patch_seq: 99, idempotency_key: "key-abc" });
      const result = applyStudioPatch(envelope, ctx);
      expect(result.applied).toBe(false);
      expect(result.rejectReason).toBe("duplicate_idempotency_key");
    });

    it("allows same idempotency_key from different run (composite key differs)", () => {
      const keys = new Set(["run_old:key-abc"]);
      const ctx = buildCtx({ appliedIdempotencyKeys: keys, activeRunId: null });
      const envelope = makeEnvelope({ run_id: "run_new", patch_seq: 99, idempotency_key: "key-abc" });
      const result = applyStudioPatch(envelope, ctx);
      expect(result.applied).toBe(true);
    });

    it("applies novel patch_seq and records it", () => {
      const ctx = buildCtx();
      const result = applyStudioPatch(makeEnvelope({ patch_seq: 5 }), ctx);
      expect(result.applied).toBe(true);
      expect(ctx.store.rememberPatchSeq).toHaveBeenCalledWith(5);
    });

    it("records composite idempotency_key when present", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({ idempotency_key: "key-xyz" });
      const result = applyStudioPatch(envelope, ctx);
      expect(result.applied).toBe(true);
      expect(ctx.store.rememberIdempotencyKey).toHaveBeenCalledWith("run_1:key-xyz");
    });
  });

  // ─── Sequence regression ────────────────────────────────────────────────
  describe("sequence regression", () => {
    it("rejects patch_seq <= max applied (non-dup different seq)", () => {
      const ctx = buildCtx({ appliedPatchSeqs: [1, 5, 10] });
      const result = applyStudioPatch(makeEnvelope({ patch_seq: 7 }), ctx);
      expect(result.applied).toBe(false);
      expect(result.rejectReason).toBe("sequence_regression");
    });

    it("accepts first patch when appliedPatchSeqs is empty", () => {
      const ctx = buildCtx({ appliedPatchSeqs: [] });
      const result = applyStudioPatch(makeEnvelope({ patch_seq: 1 }), ctx);
      expect(result.applied).toBe(true);
    });
  });

  // ─── Stale run rejection ────────────────────────────────────────────────
  describe("stale run rejection", () => {
    it("rejects patch from a different run when activeRunId is set", () => {
      const ctx = buildCtx({ activeRunId: "run_current" });
      const result = applyStudioPatch(makeEnvelope({ run_id: "run_old" }), ctx);
      expect(result.applied).toBe(false);
      expect(result.rejectReason).toBe("stale_run");
    });

    it("accepts patch matching activeRunId", () => {
      const ctx = buildCtx({ activeRunId: "run_1" });
      const result = applyStudioPatch(makeEnvelope({ run_id: "run_1" }), ctx);
      expect(result.applied).toBe(true);
    });

    it("accepts patch when no activeRunId is set and activates run", () => {
      const ctx = buildCtx({ activeRunId: null });
      const result = applyStudioPatch(makeEnvelope({ run_id: "run_new", run_version: 3 }), ctx);
      expect(result.applied).toBe(true);
      expect(ctx.store.setActiveRun).toHaveBeenCalledWith("run_new", 3);
    });
  });

  // ─── Unknown / dirty patch_type ─────────────────────────────────────────
  describe("unknown patch_type", () => {
    it("rejects unknown patch_type with explicit error", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({ patch_type: "unknown_future_type" as any });
      const result = applyStudioPatch(envelope, ctx);
      expect(result.applied).toBe(false);
      expect(result.rejectReason).toBe("unknown_patch_type");
      expect(result.rejectDetail).toBe("unknown_future_type");
    });

    it("sets studioError for unknown patch_type", () => {
      const ctx = buildCtx();
      applyStudioPatch(makeEnvelope({ patch_type: "never_seen" as any }), ctx);
      expect(ctx.store.setStudioError).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "unknown_patch_type",
          retryable: false,
        }),
      );
    });

    it("does NOT record patch_seq or activate run for unknown patch_type", () => {
      const ctx = buildCtx();
      applyStudioPatch(makeEnvelope({ patch_type: "bogus" as any }), ctx);
      expect(ctx.store.rememberPatchSeq).not.toHaveBeenCalled();
      expect(ctx.store.setActiveRun).not.toHaveBeenCalled();
    });
  });

  // ─── Phase-1 patch_type dispatch ────────────────────────────────────────
  describe("Phase-1 patch_type dispatch", () => {
    it("handles governance_patch", () => {
      const ctx = buildCtx();
      applyStudioPatch(makeEnvelope({ patch_type: "governance_patch" }), ctx);
      expect(ctx.store.addGovernanceCard).toHaveBeenCalled();
    });

    it("handles staged_edit_patch and expands editor", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({
        patch_type: "staged_edit_patch",
        payload: { id: "edit-1", file_path: "SKILL.md", diff: "test" },
      });
      applyStudioPatch(envelope, ctx);
      expect(ctx.store.addStagedEdit).toHaveBeenCalled();
      expect(ctx.onExpandEditor).toHaveBeenCalled();
    });

    it("handles card_patch", () => {
      const ctx = buildCtx();
      applyStudioPatch(makeEnvelope({ patch_type: "card_patch" }), ctx);
      expect(ctx.store.addGovernanceCard).toHaveBeenCalled();
    });

    it("handles artifact_patch", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({
        patch_type: "artifact_patch",
        payload: { id: "art-1", type: "structure", title: "Test", summary: "artifact body" },
      });
      applyStudioPatch(envelope, ctx);
      expect(ctx.store.mergeArchitectArtifacts).toHaveBeenCalled();
    });

    it("handles card_status_patch — updates workbench card", () => {
      const ctx = buildCtx({
        cardsById: {
          "card-1": { id: "card-1", status: "pending", mode: "analysis", priority: 1, target: { type: null, key: null } } as any,
        },
      });
      const envelope = makeEnvelope({
        patch_type: "card_status_patch",
        payload: { card_id: "card-1", status: "adopted" },
      });
      applyStudioPatch(envelope, ctx);
      expect(ctx.store.updateWorkbenchCardStatus).toHaveBeenCalledWith("card-1", "adopted");
      expect(ctx.store.updateCardStatus).toHaveBeenCalledWith("card-1", "adopted");
    });

    it("handles audit_patch and returns audit result", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({
        patch_type: "audit_patch",
        payload: { verdict: "needs_work", issues: [], recommended_path: "optimize" },
      });
      const result = applyStudioPatch(envelope, ctx);
      expect(result.applied).toBe(true);
      expect(result.auditResult).toBeDefined();
      expect(result.auditResult?.severity).toBe("medium");
    });

    it("handles stale_patch — marks cards stale", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({
        patch_type: "stale_patch",
        payload: { card_ids: ["card-a", "card-b"] },
      });
      applyStudioPatch(envelope, ctx);
      expect(ctx.store.updateWorkbenchCardStatus).toHaveBeenCalledWith("card-a", "stale");
      expect(ctx.store.updateWorkbenchCardStatus).toHaveBeenCalledWith("card-b", "stale");
    });

    it("handles queue_window_patch", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({
        patch_type: "queue_window_patch",
        payload: {
          active_card_id: "card-1",
          visible_card_ids: ["card-1"],
          backlog_count: 0,
          phase: "phase_2",
          max_visible: 3,
          reveal_policy: "stage_gated",
        },
      });
      applyStudioPatch(envelope, ctx);
      expect(ctx.store.setQueueWindow).toHaveBeenCalled();
    });

    it("handles workflow_patch — updates workflow state", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({
        patch_type: "workflow_patch",
        payload: {
          session_mode: "create_new_skill",
          workflow_mode: "architect",
          phase: "phase_1_why",
          next_action: "await_user",
        },
      });
      applyStudioPatch(envelope, ctx);
      expect(ctx.store.setWorkflowState).toHaveBeenCalled();
      expect(ctx.setStoreSessionMode).toHaveBeenCalledWith("create");
    });

    it("handles deep_summary_patch", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({
        patch_type: "deep_summary_patch",
        payload: { title: "深层补完", summary: "test summary" },
      });
      applyStudioPatch(envelope, ctx);
      expect(ctx.store.addDeepPatch).toHaveBeenCalled();
      expect(ctx.setRouteInfo).toHaveBeenCalled();
    });

    it("handles evidence_patch (same handler as deep_summary_patch)", () => {
      const ctx = buildCtx();
      const envelope = makeEnvelope({
        patch_type: "evidence_patch",
        payload: { title: "证据补完", summary: "evidence data" },
      });
      applyStudioPatch(envelope, ctx);
      expect(ctx.store.addDeepPatch).toHaveBeenCalled();
    });
  });

  // ─── Phase-2 patch_type dispatch ────────────────────────────────────────
  describe("Phase-2 patch_type dispatch", () => {
    // ── run_status_patch ────────────────────────────────────────────────
    describe("run_status_patch", () => {
      it("archives run and stops streaming on completed", () => {
        const ctx = buildCtx({ activeRunId: "run_1" });
        const envelope = makeEnvelope({
          patch_type: "run_status_patch",
          payload: { status: "completed" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.archiveRun).toHaveBeenCalledWith(
          expect.objectContaining({ runId: "run_1", status: "completed" }),
        );
        expect(ctx.setStreaming).toHaveBeenCalledWith(false);
        expect(ctx.setActiveRunId).toHaveBeenCalledWith(null);
      });

      it("archives run on cancelled", () => {
        const ctx = buildCtx({ activeRunId: "run_1" });
        const envelope = makeEnvelope({
          patch_type: "run_status_patch",
          payload: { status: "cancelled" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.archiveRun).toHaveBeenCalledWith(
          expect.objectContaining({ status: "cancelled" }),
        );
      });

      it("archives run on superseded with superseded_by", () => {
        const ctx = buildCtx({ activeRunId: "run_1" });
        const envelope = makeEnvelope({
          patch_type: "run_status_patch",
          payload: { status: "superseded", superseded_by: "run_2" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.archiveRun).toHaveBeenCalledWith(
          expect.objectContaining({ status: "superseded", supersededBy: "run_2" }),
        );
        expect(ctx.setStreamStage).toHaveBeenCalledWith("superseded");
      });

      it("archives run on failed", () => {
        const ctx = buildCtx({ activeRunId: "run_1" });
        const envelope = makeEnvelope({
          patch_type: "run_status_patch",
          payload: { status: "failed" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.archiveRun).toHaveBeenCalledWith(
          expect.objectContaining({ status: "failed" }),
        );
      });

      it("activates run and starts streaming on running", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "run_status_patch",
          payload: { status: "running" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setActiveRun).toHaveBeenCalledWith("run_1", 1);
        expect(ctx.setStreaming).toHaveBeenCalledWith(true);
      });

      it("activates run on queued", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "run_status_patch",
          payload: { status: "queued" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.setStreaming).toHaveBeenCalledWith(true);
      });

      it("ignores missing status field", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "run_status_patch",
          payload: {},
        });
        const result = applyStudioPatch(envelope, ctx);
        expect(result.applied).toBe(true);
        expect(ctx.store.archiveRun).not.toHaveBeenCalled();
      });

      it("replay idempotent: duplicate patch_seq rejected", () => {
        const ctx = buildCtx({ appliedPatchSeqs: [10] });
        const envelope = makeEnvelope({
          patch_seq: 10,
          patch_type: "run_status_patch",
          payload: { status: "completed" },
        });
        const result = applyStudioPatch(envelope, ctx);
        expect(result.applied).toBe(false);
        expect(ctx.store.archiveRun).not.toHaveBeenCalled();
      });
    });

    // ── card_queue_patch ────────────────────────────────────────────────
    describe("card_queue_patch", () => {
      it("sets queue window and replaces card order", () => {
        const ctx = buildCtx({
          cardsById: {
            "c1": { id: "c1", status: "pending" } as any,
            "c2": { id: "c2", status: "active" } as any,
          },
        });
        const envelope = makeEnvelope({
          patch_type: "card_queue_patch",
          payload: {
            active_card_id: "c1",
            visible_card_ids: ["c1", "c2"],
            backlog_count: 0,
            phase: "phase_2",
            max_visible: 5,
            reveal_policy: "stage_gated",
            card_order: ["c2", "c1"],
          },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setQueueWindow).toHaveBeenCalled();
        expect(ctx.store.replaceWorkbenchCards).toHaveBeenCalled();
      });

      it("skips replaceWorkbenchCards if card_order absent", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "card_queue_patch",
          payload: {
            active_card_id: "c1",
            visible_card_ids: ["c1"],
            backlog_count: 0,
            phase: "phase_2",
            max_visible: 5,
            reveal_policy: "stage_gated",
          },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.replaceWorkbenchCards).not.toHaveBeenCalled();
      });

      it("replay idempotent: duplicate rejected", () => {
        const ctx = buildCtx({ appliedPatchSeqs: [3] });
        const result = applyStudioPatch(makeEnvelope({ patch_seq: 3, patch_type: "card_queue_patch", payload: {} }), ctx);
        expect(result.applied).toBe(false);
      });
    });

    // ── workspace_patch ─────────────────────────────────────────────────
    describe("workspace_patch", () => {
      it("sets workbench mode", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "workspace_patch",
          payload: { mode: "report" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setWorkbenchMode).toHaveBeenCalledWith("report");
      });

      it("sets workspace with valid target_type", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "workspace_patch",
          payload: { target_type: "prompt", target_key: "main.md" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setWorkspace).toHaveBeenCalledWith(
          expect.objectContaining({
            currentTarget: { type: "prompt", key: "main.md" },
          }),
        );
      });

      it("normalizes unknown target_type to null", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "workspace_patch",
          payload: { target_type: "totally_unknown", target_key: "x" },
        });
        applyStudioPatch(envelope, ctx);
        // targetType normalized to null, but targetKey is "x" so setWorkspace still called
        expect(ctx.store.setWorkspace).toHaveBeenCalledWith(
          expect.objectContaining({
            currentTarget: { type: null, key: "x" },
          }),
        );
      });

      it("sets active card id", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "workspace_patch",
          payload: { active_card_id: "card-99" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setActiveCardId).toHaveBeenCalledWith("card-99");
      });

      it("replay idempotent: duplicate rejected", () => {
        const ctx = buildCtx({ appliedPatchSeqs: [5] });
        const result = applyStudioPatch(makeEnvelope({ patch_seq: 5, patch_type: "workspace_patch", payload: { mode: "file" } }), ctx);
        expect(result.applied).toBe(false);
      });
    });

    // ── timeline_patch ──────────────────────────────────────────────────
    describe("timeline_patch", () => {
      it("appends timeline entry", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "timeline_patch",
          patch_seq: 42,
          payload: {
            entry_id: "tl-1",
            type: "action",
            message: "卡片已采纳",
            timestamp: "2026-04-22T10:00:00Z",
            card_id: "card-1",
          },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.appendTimelineEntry).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "tl-1",
            type: "action",
            message: "卡片已采纳",
            cardId: "card-1",
          }),
        );
      });

      it("generates entry_id from patch_seq when absent", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "timeline_patch",
          patch_seq: 77,
          payload: { message: "auto id" },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.appendTimelineEntry).toHaveBeenCalledWith(
          expect.objectContaining({ id: "tl-77" }),
        );
      });

      it("replay idempotent: duplicate rejected", () => {
        const ctx = buildCtx({ appliedPatchSeqs: [42] });
        const result = applyStudioPatch(makeEnvelope({ patch_seq: 42, patch_type: "timeline_patch", payload: { message: "x" } }), ctx);
        expect(result.applied).toBe(false);
      });
    });

    // ── transition_blocked_patch ────────────────────────────────────────
    describe("transition_blocked_patch", () => {
      it("sets transition block with reason and card ids", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "transition_blocked_patch",
          payload: {
            reason: "需要完成审核",
            blocked_card_id: "card-5",
            prerequisite_card_ids: ["card-3", "card-4"],
          },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setTransitionBlock).toHaveBeenCalledWith({
          reason: "需要完成审核",
          blockedCardId: "card-5",
          prerequisiteCardIds: ["card-3", "card-4"],
        });
      });

      it("uses default reason when absent", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "transition_blocked_patch",
          payload: {},
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setTransitionBlock).toHaveBeenCalledWith(
          expect.objectContaining({ reason: "前置条件未满足" }),
        );
      });

      it("replay idempotent: duplicate rejected", () => {
        const ctx = buildCtx({ appliedPatchSeqs: [9] });
        const result = applyStudioPatch(makeEnvelope({ patch_seq: 9, patch_type: "transition_blocked_patch", payload: {} }), ctx);
        expect(result.applied).toBe(false);
      });
    });

    // ── tool_error_patch ────────────────────────────────────────────────
    describe("tool_error_patch", () => {
      it("sets studio error with tool name", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "tool_error_patch",
          payload: {
            tool_name: "code_analysis",
            message: "超时",
            retryable: true,
            step: "analyze",
            card_id: "card-7",
          },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setStudioError).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: "tool_error",
            message: "code_analysis: 超时",
            retryable: true,
            step: "analyze",
            activeCardId: "card-7",
          }),
        );
      });

      it("uses default message when absent", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "tool_error_patch",
          payload: {},
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setStudioError).toHaveBeenCalledWith(
          expect.objectContaining({ message: "工具执行失败" }),
        );
      });

      it("replay idempotent: duplicate rejected", () => {
        const ctx = buildCtx({ appliedPatchSeqs: [11] });
        const result = applyStudioPatch(makeEnvelope({ patch_seq: 11, patch_type: "tool_error_patch", payload: {} }), ctx);
        expect(result.applied).toBe(false);
      });
    });

    // ── error_patch ─────────────────────────────────────────────────────
    describe("error_patch", () => {
      it("sets studio error with full fields", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "error_patch",
          payload: {
            error_type: "rate_limit",
            message: "请求过快",
            step: "generation",
            recovery_hint: "请等待 30 秒后重试",
            retryable: true,
            active_card_id: "card-10",
          },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setStudioError).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: "rate_limit",
            message: "请求过快",
            step: "generation",
            recoveryHint: "请等待 30 秒后重试",
            retryable: true,
            activeCardId: "card-10",
          }),
        );
      });

      it("uses defaults for missing fields", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "error_patch",
          payload: {},
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setStudioError).toHaveBeenCalledWith(
          expect.objectContaining({
            kind: "server_error",
            message: "服务端错误",
          }),
        );
      });

      it("replay idempotent: duplicate rejected", () => {
        const ctx = buildCtx({ appliedPatchSeqs: [13] });
        const result = applyStudioPatch(makeEnvelope({ patch_seq: 13, patch_type: "error_patch", payload: {} }), ctx);
        expect(result.applied).toBe(false);
      });
    });

    // ── reconcile_patch ─────────────────────────────────────────────────
    describe("reconcile_patch", () => {
      it("sets reconcile conflict with message and details", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "reconcile_patch",
          payload: {
            message: "卡片状态冲突",
            details: { card_id: "card-1", local: "adopted", remote: "pending" },
          },
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setReconcileConflict).toHaveBeenCalledWith({
          message: "卡片状态冲突",
          conflictDetails: { card_id: "card-1", local: "adopted", remote: "pending" },
        });
      });

      it("uses default message when absent", () => {
        const ctx = buildCtx();
        const envelope = makeEnvelope({
          patch_type: "reconcile_patch",
          payload: {},
        });
        applyStudioPatch(envelope, ctx);
        expect(ctx.store.setReconcileConflict).toHaveBeenCalledWith(
          expect.objectContaining({ message: "检测到状态冲突，请确认" }),
        );
      });

      it("replay idempotent: duplicate rejected", () => {
        const ctx = buildCtx({ appliedPatchSeqs: [15] });
        const result = applyStudioPatch(makeEnvelope({ patch_seq: 15, patch_type: "reconcile_patch", payload: {} }), ctx);
        expect(result.applied).toBe(false);
      });
    });
  });

  // ─── Cross-run dedup ────────────────────────────────────────────────────
  describe("cross-run dedup", () => {
    it("old run late patch rejected when activeRunId differs", () => {
      const ctx = buildCtx({ activeRunId: "run_2" });
      const envelope = makeEnvelope({
        run_id: "run_1",
        patch_seq: 100,
        patch_type: "governance_patch",
      });
      const result = applyStudioPatch(envelope, ctx);
      expect(result.applied).toBe(false);
      expect(result.rejectReason).toBe("stale_run");
      expect(ctx.store.addGovernanceCard).not.toHaveBeenCalled();
    });

    it("old run late patch does not record seq or activate run", () => {
      const ctx = buildCtx({ activeRunId: "run_2" });
      applyStudioPatch(makeEnvelope({ run_id: "run_1" }), ctx);
      expect(ctx.store.rememberPatchSeq).not.toHaveBeenCalled();
      // setActiveRun is called once by the standard flow (step 7) but since stale_run
      // rejects before step 6, it should not be called
      expect(ctx.store.setActiveRun).not.toHaveBeenCalled();
    });

    it("idempotency key from run_1 does not block same key from run_2", () => {
      // Simulate: run_1 had key "create-card", now run_2 sends same key
      const keys = new Set(["run_1:create-card"]);
      const ctx = buildCtx({ appliedIdempotencyKeys: keys, activeRunId: null });
      const envelope = makeEnvelope({
        run_id: "run_2",
        patch_seq: 1,
        idempotency_key: "create-card",
      });
      const result = applyStudioPatch(envelope, ctx);
      expect(result.applied).toBe(true);
      expect(ctx.store.rememberIdempotencyKey).toHaveBeenCalledWith("run_2:create-card");
    });
  });
});

// ─── normalizeIncomingWorkbenchStatus ──────────────────────────────────────

describe("normalizeIncomingWorkbenchStatus", () => {
  it("returns valid statuses as-is", () => {
    expect(normalizeIncomingWorkbenchStatus("pending")).toBe("pending");
    expect(normalizeIncomingWorkbenchStatus("active")).toBe("active");
    expect(normalizeIncomingWorkbenchStatus("reviewing")).toBe("reviewing");
    expect(normalizeIncomingWorkbenchStatus("adopted")).toBe("adopted");
    expect(normalizeIncomingWorkbenchStatus("rejected")).toBe("rejected");
    expect(normalizeIncomingWorkbenchStatus("dismissed")).toBe("dismissed");
    expect(normalizeIncomingWorkbenchStatus("stale")).toBe("stale");
  });

  it("maps blocked/reopened to pending", () => {
    expect(normalizeIncomingWorkbenchStatus("blocked")).toBe("pending");
    expect(normalizeIncomingWorkbenchStatus("reopened")).toBe("pending");
  });

  it("maps archived to dismissed", () => {
    expect(normalizeIncomingWorkbenchStatus("archived")).toBe("dismissed");
  });

  it("returns null for unknown statuses", () => {
    expect(normalizeIncomingWorkbenchStatus("banana")).toBeNull();
    expect(normalizeIncomingWorkbenchStatus(undefined)).toBeNull();
    expect(normalizeIncomingWorkbenchStatus(42)).toBeNull();
  });
});
