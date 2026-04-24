/**
 * patch-reducer.ts — 统一 patch 分发 reducer
 *
 * 所有 StudioPatchEnvelope 经由 applyStudioPatch() 入口统一处理。
 * 每种 patch_type 走独立 handler，便于测试和维护。
 *
 * 安全策略：
 *  - 缺少关键字段（run_id / patch_seq / payload）→ applied:false + reject reason
 *  - 未知 patch_type → applied:false + reject reason（不记录 seq，不激活 run）
 *  - sequence 回退（patch_seq <= 最大已应用 seq 且非首包）→ applied:false
 *  - idempotency 去重按 run_id + idempotency_key 复合键
 */

import type { StudioPatchEnvelope } from "./workflow-protocol";
import type { StudioSessionState } from "@/lib/studio-store";
import type { AuditResult, StagedEdit, StudioRouteInfo } from "./types";
import type { WorkbenchCard, WorkbenchTarget } from "./workbench-types";
import {
  normalizeAuditSummaryPayload,
  normalizeDeepPatchEnvelope,
  normalizeWorkflowCardPayload,
  normalizeWorkflowStagedEditPayload,
  parseWorkflowStatePayload,
} from "./workflow-adapter";
import { normalizeArchitectArtifactPayload } from "./message-parser";
import { asCardQueueWindow } from "./workbench";

// ─── Known patch types ──────────────────────────────────────────────────────

const KNOWN_PATCH_TYPES = new Set<StudioPatchEnvelope["patch_type"]>([
  "workflow_patch",
  "audit_patch",
  "governance_patch",
  "staged_edit_patch",
  "card_patch",
  "card_status_patch",
  "artifact_patch",
  "deep_summary_patch",
  "evidence_patch",
  "stale_patch",
  "queue_window_patch",
  "run_status_patch",
  "card_queue_patch",
  "workspace_patch",
  "timeline_patch",
  "transition_blocked_patch",
  "tool_error_patch",
  "error_patch",
  "reconcile_patch",
]);

// ─── PatchContext ────────────────────────────────────────────────────────────

export interface PatchContext {
  /** zustand store (getState snapshot at call time) */
  store: StudioSessionState;
  /** Source string for governance cards / staged edits */
  source: string;

  // Side-effect callbacks — all optional so tests can omit them
  setRouteInfo?: (updater: (prev: StudioRouteInfo | null) => StudioRouteInfo | null) => void;
  setStreamStage?: (stage: string | null) => void;
  setStreaming?: (streaming: boolean) => void;
  setActiveRunId?: (id: string | null) => void;
  setStoreSessionMode?: (mode: "create" | "optimize" | "audit" | null) => void;
  onExpandEditor?: () => void;
  onOpenStagedEditTarget?: (edit: StagedEdit) => void;
  onMemoRefresh?: () => void;
}

// ─── Dedup helpers ───────────────────────────────────────────────────────────

function isDuplicatePatchSeq(envelope: StudioPatchEnvelope, store: StudioSessionState): boolean {
  return store.appliedPatchSeqs.includes(envelope.patch_seq);
}

/**
 * Idempotency key 去重使用 run_id + idempotency_key 复合键，
 * 防止不同 run 的相同 idempotency_key 被误去重。
 */
function buildIdempotencyCompositeKey(envelope: StudioPatchEnvelope): string | null {
  const key = envelope.idempotency_key;
  if (typeof key !== "string" || !key) return null;
  return `${envelope.run_id}:${key}`;
}

function isDuplicateIdempotencyKey(envelope: StudioPatchEnvelope, store: StudioSessionState): boolean {
  const compositeKey = buildIdempotencyCompositeKey(envelope);
  if (!compositeKey) return false;
  return store.appliedIdempotencyKeys.has(compositeKey);
}

function isStaleRun(envelope: StudioPatchEnvelope, store: StudioSessionState): boolean {
  return !!(store.activeRunId && store.activeRunId !== envelope.run_id);
}

function isSequenceRegression(envelope: StudioPatchEnvelope, store: StudioSessionState): boolean {
  if (store.appliedPatchSeqs.length === 0) return false;
  const maxApplied = Math.max(...store.appliedPatchSeqs);
  return envelope.patch_seq <= maxApplied;
}

// ─── Envelope validation ────────────────────────────────────────────────────

function validateEnvelope(envelope: StudioPatchEnvelope): string | null {
  if (!envelope.run_id || typeof envelope.run_id !== "string") {
    return "missing_run_id";
  }
  if (typeof envelope.patch_seq !== "number" || !Number.isFinite(envelope.patch_seq)) {
    return "missing_patch_seq";
  }
  if (!envelope.payload || typeof envelope.payload !== "object") {
    return "missing_payload";
  }
  return null;
}

// ─── Per-type handlers ───────────────────────────────────────────────────────

function handleWorkflowPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const workflowState = parseWorkflowStatePayload(payload);
  if (workflowState) {
    ctx.store.setWorkflowState(
      ctx.store.workflowState
        ? { ...ctx.store.workflowState, ...workflowState }
        : workflowState,
    );
  }
  if ("session_mode" in payload) {
    handleRouteStatus(payload, ctx);
  }
  if ("stage" in payload && typeof payload.stage === "string") {
    handleStatusStage(payload.stage, ctx);
  }
}

function handleGovernancePatch(payload: Record<string, unknown>, ctx: PatchContext) {
  ctx.store.addGovernanceCard(normalizeWorkflowCardPayload(payload, ctx.source));
}

function handleStagedEditPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const edit = normalizeWorkflowStagedEditPayload(payload, ctx.source);
  ctx.store.addStagedEdit(edit);
  if (ctx.onOpenStagedEditTarget) {
    ctx.onOpenStagedEditTarget(edit);
  } else {
    ctx.onExpandEditor?.();
  }
}

function handleCardPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  ctx.store.addGovernanceCard(normalizeWorkflowCardPayload(payload, ctx.source));
}

function handleArtifactPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const artifact = normalizeArchitectArtifactPayload(payload);
  if (artifact) ctx.store.mergeArchitectArtifacts([artifact]);
}

function handleCardStatusPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const cardId = typeof payload.card_id === "string"
    ? payload.card_id
    : typeof payload.id === "string"
      ? payload.id
      : null;
  const status = normalizeIncomingWorkbenchStatus(payload.status);
  if (!cardId || !status) return;

  const exitReason = typeof payload.exit_reason === "string" ? payload.exit_reason : null;
  if (exitReason) {
    const existing = ctx.store.cardsById[cardId];
    if (existing) {
      ctx.store.upsertWorkbenchCard({ ...existing, exitReason });
    }
  }

  ctx.store.updateWorkbenchCardStatus(cardId, status);
  if (status === "adopted" || status === "rejected" || status === "dismissed") {
    ctx.store.updateCardStatus(cardId, status);
  }

  const nextCardId = typeof payload.next_card_id === "string" ? payload.next_card_id : null;
  if (nextCardId && (status === "adopted" || status === "rejected" || status === "dismissed")) {
    const nextCard = ctx.store.cardsById[nextCardId];
    if (nextCard) {
      ctx.store.setActiveCardId(nextCardId);
    }
  }
}

function handleAuditPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  ctx.store.setStudioError(null);
  const result = normalizeAuditSummaryPayload(payload);
  (ctx as PatchContextInternal)._auditResult = result;
}

function handleDeepPatch(envelope: StudioPatchEnvelope, ctx: PatchContext) {
  const deepPatch = normalizeDeepPatchEnvelope(envelope);
  if (deepPatch) {
    ctx.store.addDeepPatch(deepPatch);
  }
  ctx.setRouteInfo?.((prev) => prev ? { ...prev, deep_status: "completed" } : prev);
}

function handleStalePatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const cardIds = Array.isArray(payload.card_ids)
    ? payload.card_ids.filter((id): id is string => typeof id === "string")
    : [];
  for (const id of cardIds) {
    ctx.store.updateWorkbenchCardStatus(id, "stale");
  }
}

function handleQueueWindowPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const parsed = asCardQueueWindow(payload);
  if (parsed) {
    ctx.store.setQueueWindow(parsed);
  }
}

// ─── Phase-2 新增 handlers ──────────────────────────────────────────────────

function handleRunStatusPatch(payload: Record<string, unknown>, envelope: StudioPatchEnvelope, ctx: PatchContext) {
  const status = typeof payload.status === "string" ? payload.status : null;
  if (!status) return;

  if (status === "cancelled" || status === "superseded" || status === "completed" || status === "failed") {
    ctx.store.archiveRun({
      runId: envelope.run_id,
      runVersion: envelope.run_version,
      status: status === "superseded" ? "superseded" : status === "cancelled" ? "cancelled" : status === "failed" ? "failed" : "completed",
      supersededBy: typeof payload.superseded_by === "string" ? payload.superseded_by : null,
      archivedAt: typeof payload.archived_at === "string" ? payload.archived_at : new Date().toISOString(),
    });
    ctx.setStreaming?.(false);
    ctx.setActiveRunId?.(null);
    ctx.setStreamStage?.(status === "superseded" ? "superseded" : null);
  } else if (status === "running" || status === "queued") {
    ctx.store.setActiveRun(envelope.run_id, envelope.run_version);
    ctx.setStreaming?.(true);
  }
}

function handleCardQueuePatch(payload: Record<string, unknown>, ctx: PatchContext) {
  // Sync queue window state
  const queueWindow = asCardQueueWindow(payload);
  if (queueWindow) {
    ctx.store.setQueueWindow(queueWindow);
  }
  // If card_order is provided, replace workbench cards in the specified order
  if (Array.isArray(payload.card_order)) {
    const cardOrder = payload.card_order.filter((id): id is string => typeof id === "string");
    const existing = ctx.store.cardsById;
    const cards = cardOrder.map((id) => existing[id]).filter(Boolean);
    if (cards.length > 0) {
      ctx.store.replaceWorkbenchCards(cards);
    }
  }
}

function handleWorkspacePatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const mode = typeof payload.mode === "string" ? payload.mode : null;
  if (mode === "analysis" || mode === "file" || mode === "report" || mode === "governance") {
    ctx.store.setWorkbenchMode(mode);
  }
  const rawTargetType = typeof payload.target_type === "string" ? payload.target_type : null;
  const targetType: WorkbenchTarget["type"] =
    rawTargetType === "prompt" || rawTargetType === "source_file" || rawTargetType === "report"
    || rawTargetType === "governance_panel" || rawTargetType === "analysis"
      ? rawTargetType : null;
  const targetKey = typeof payload.target_key === "string" ? payload.target_key : null;
  if (targetType || targetKey) {
    ctx.store.setWorkspace({
      mode: (mode as "analysis" | "file" | "report" | "governance") ?? ctx.store.workspace.mode,
      currentTarget: { type: targetType, key: targetKey },
      currentCardId: typeof payload.card_id === "string" ? payload.card_id : ctx.store.workspace.currentCardId,
      validationSource: ctx.store.workspace.validationSource,
    });
  }
  const activeCardId = typeof payload.active_card_id === "string" ? payload.active_card_id : null;
  if (activeCardId) {
    ctx.store.setActiveCardId(activeCardId);
  }
}

function handleTimelinePatch(payload: Record<string, unknown>, envelope: StudioPatchEnvelope, ctx: PatchContext) {
  const entryId = typeof payload.entry_id === "string" ? payload.entry_id : `tl-${envelope.patch_seq}`;
  const entryType = typeof payload.type === "string" ? payload.type : "info";
  const message = typeof payload.message === "string" ? payload.message : "";
  const timestamp = typeof payload.timestamp === "string" ? payload.timestamp : (envelope.created_at ?? new Date().toISOString());
  const cardId = typeof payload.card_id === "string" ? payload.card_id : null;

  ctx.store.appendTimelineEntry({
    id: entryId,
    type: entryType,
    timestamp,
    message,
    cardId,
    payload,
  });
}

function handleTransitionBlockedPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const reason = typeof payload.reason === "string" ? payload.reason : "前置条件未满足";
  const blockedCardId = typeof payload.blocked_card_id === "string" ? payload.blocked_card_id : null;
  const prerequisiteCardIds = Array.isArray(payload.prerequisite_card_ids)
    ? payload.prerequisite_card_ids.filter((id): id is string => typeof id === "string")
    : [];

  ctx.store.setTransitionBlock({ reason, blockedCardId, prerequisiteCardIds });
  // Do NOT advance the active card — keep it on the blocked card
}

function handleToolErrorPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const message = typeof payload.message === "string" ? payload.message : "工具执行失败";
  const toolName = typeof payload.tool_name === "string" ? payload.tool_name : null;
  const retryable = payload.retryable === true;
  const step = typeof payload.step === "string" ? payload.step : null;

  ctx.store.setStudioError({
    kind: "tool_error",
    message: toolName ? `${toolName}: ${message}` : message,
    step,
    recoveryHint: retryable ? "可重试" : null,
    retryable,
    activeCardId: typeof payload.card_id === "string" ? payload.card_id : null,
    autoAdvanced: null,
    payloadSnapshot: null,
  });
  // Do NOT advance the active card — keep it in place for retry CTA
}

function handleErrorPatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const message = typeof payload.message === "string" ? payload.message : "服务端错误";
  const kind = typeof payload.error_type === "string" ? payload.error_type : "server_error";
  const step = typeof payload.step === "string" ? payload.step : null;
  const recoveryHint = typeof payload.recovery_hint === "string" ? payload.recovery_hint : null;
  const retryable = payload.retryable === true;
  const activeCardId = typeof payload.active_card_id === "string" ? payload.active_card_id : null;

  ctx.store.setStudioError({
    kind,
    message,
    step,
    recoveryHint,
    retryable,
    activeCardId,
    autoAdvanced: null,
    payloadSnapshot: null,
  });
  // Preserve: active card, queue, staged edits, handoff summary — no clearing
}

function handleReconcilePatch(payload: Record<string, unknown>, ctx: PatchContext) {
  const message = typeof payload.message === "string" ? payload.message : "检测到状态冲突，请确认";
  const conflictDetails = typeof payload.details === "object" && payload.details
    ? payload.details as Record<string, unknown>
    : {};

  ctx.store.setReconcileConflict({ message, conflictDetails });
  // 禁止前端 silent merge — UI 必须展示冲突让用户决定
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function handleRouteStatus(data: Record<string, unknown>, ctx: PatchContext) {
  const rs = data as unknown as StudioRouteInfo;
  ctx.setRouteInfo?.(() => rs);
  const mode = rs.session_mode;
  ctx.setStoreSessionMode?.(
    mode === "create_new_skill" ? "create"
    : mode === "optimize_existing_skill" ? "optimize"
    : mode === "audit_imported_skill" ? "audit"
    : null,
  );
}

function handleStatusStage(stage: string, ctx: PatchContext) {
  ctx.setStreamStage?.(stage);
  if (stage === "first_useful_response") {
    ctx.setRouteInfo?.((prev) => prev ? { ...prev, fast_status: "completed" } : prev);
    return;
  }
  if (stage === "superseded") {
    ctx.setRouteInfo?.((prev) => prev ? { ...prev, deep_status: "superseded" } : prev);
    return;
  }
  if (stage === "generating") {
    ctx.setRouteInfo?.((prev) => prev ? { ...prev, fast_status: "running" } : prev);
  }
}

export function normalizeIncomingWorkbenchStatus(status: unknown): WorkbenchCard["status"] | null {
  if (
    status === "pending"
    || status === "active"
    || status === "reviewing"
    || status === "adopted"
    || status === "rejected"
    || status === "dismissed"
    || status === "stale"
  ) {
    return status;
  }
  if (status === "blocked" || status === "reopened") {
    return "pending";
  }
  if (status === "completed") {
    return "adopted";
  }
  if (status === "archived") {
    return "dismissed";
  }
  return null;
}

// ─── Internal result type ────────────────────────────────────────────────────

interface PatchContextInternal extends PatchContext {
  _auditResult?: AuditResult;
}

// ─── Main entry point ────────────────────────────────────────────────────────

export type PatchRejectReason =
  | "duplicate_patch_seq"
  | "duplicate_idempotency_key"
  | "stale_run"
  | "sequence_regression"
  | "invalid_envelope"
  | "unknown_patch_type";

export interface ApplyStudioPatchResult {
  applied: boolean;
  auditResult?: AuditResult;
  /** 当 applied=false 时，说明为什么被拒绝 */
  rejectReason?: PatchRejectReason;
  /** 补充描述 */
  rejectDetail?: string;
}

/**
 * 统一 patch 分发入口。
 *
 * 返回值告知调用方是否成功应用，被拒绝的原因，以及 audit_patch 的结果。
 */
export function applyStudioPatch(
  envelope: StudioPatchEnvelope,
  ctx: PatchContext,
): ApplyStudioPatchResult {
  const { store } = ctx;

  // 0. Envelope validation — missing key fields
  const validationError = validateEnvelope(envelope);
  if (validationError) {
    return { applied: false, rejectReason: "invalid_envelope", rejectDetail: validationError };
  }

  // 1. 未知 patch_type — 不记录 seq，不激活 run，设置显式错误
  if (!KNOWN_PATCH_TYPES.has(envelope.patch_type)) {
    store.setStudioError({
      kind: "unknown_patch_type",
      message: `未知 patch 类型: ${envelope.patch_type}`,
      step: null,
      recoveryHint: "忽略此 patch，等待后端修复",
      retryable: false,
      activeCardId: null,
      autoAdvanced: null,
      payloadSnapshot: envelope.payload,
    });
    return { applied: false, rejectReason: "unknown_patch_type", rejectDetail: envelope.patch_type };
  }

  // 2. 去重: patch_seq（同一 run 内）
  if (isDuplicatePatchSeq(envelope, store)) {
    return { applied: false, rejectReason: "duplicate_patch_seq" };
  }

  // 3. 去重: run_id + idempotency_key 复合键
  if (isDuplicateIdempotencyKey(envelope, store)) {
    return { applied: false, rejectReason: "duplicate_idempotency_key" };
  }

  // 4. 旧 run patch 忽略
  if (isStaleRun(envelope, store)) {
    return { applied: false, rejectReason: "stale_run" };
  }

  // 5. Sequence 回退检查（patch_seq <= 已应用最大值，且不是 duplicate 而是不同 patch_type）
  if (isSequenceRegression(envelope, store)) {
    return { applied: false, rejectReason: "sequence_regression" };
  }

  // 6. 记录 patch_seq + idempotency composite key
  store.rememberPatchSeq(envelope.patch_seq);
  const compositeKey = buildIdempotencyCompositeKey(envelope);
  if (compositeKey) {
    store.rememberIdempotencyKey(compositeKey);
  }

  // 7. 激活 run（如果尚未激活）
  if (!store.activeRunId) {
    store.setActiveRun(envelope.run_id, envelope.run_version);
  }

  // 8. dispatch by patch_type
  const internalCtx = ctx as PatchContextInternal;

  switch (envelope.patch_type) {
    case "workflow_patch":
      handleWorkflowPatch(envelope.payload, ctx);
      break;
    case "governance_patch":
      handleGovernancePatch(envelope.payload, ctx);
      break;
    case "staged_edit_patch":
      handleStagedEditPatch(envelope.payload, ctx);
      break;
    case "card_patch":
      handleCardPatch(envelope.payload, ctx);
      break;
    case "artifact_patch":
      handleArtifactPatch(envelope.payload, ctx);
      break;
    case "card_status_patch":
      handleCardStatusPatch(envelope.payload, ctx);
      break;
    case "audit_patch":
      handleAuditPatch(envelope.payload, ctx);
      break;
    case "deep_summary_patch":
    case "evidence_patch":
      handleDeepPatch(envelope, ctx);
      break;
    case "stale_patch":
      handleStalePatch(envelope.payload, ctx);
      break;
    case "queue_window_patch":
      handleQueueWindowPatch(envelope.payload, ctx);
      break;
    case "run_status_patch":
      handleRunStatusPatch(envelope.payload, envelope, ctx);
      break;
    case "card_queue_patch":
      handleCardQueuePatch(envelope.payload, ctx);
      break;
    case "workspace_patch":
      handleWorkspacePatch(envelope.payload, ctx);
      break;
    case "timeline_patch":
      handleTimelinePatch(envelope.payload, envelope, ctx);
      break;
    case "transition_blocked_patch":
      handleTransitionBlockedPatch(envelope.payload, ctx);
      break;
    case "tool_error_patch":
      handleToolErrorPatch(envelope.payload, ctx);
      break;
    case "error_patch":
      handleErrorPatch(envelope.payload, ctx);
      break;
    case "reconcile_patch":
      handleReconcilePatch(envelope.payload, ctx);
      break;
  }

  return {
    applied: true,
    auditResult: internalCtx._auditResult,
  };
}
