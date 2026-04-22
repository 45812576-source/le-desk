import type { AuditResult, GovernanceCardData, GovernanceAction, StagedEdit } from "./types";
import type { StudioDeepPatch, StudioPatchEnvelope, WorkflowEventEnvelope, WorkflowStateData } from "./workflow-protocol";
import { normalizeStagedEditPayload } from "./utils";

export interface StudioOrchestrationErrorPayload {
  kind: string;
  message: string;
  step?: string | null;
  recoveryHint?: string | null;
  activeCardId?: string | null;
  autoAdvanced?: boolean | null;
  retryable?: boolean;
  payloadSnapshot?: Record<string, unknown> | null;
}

export function normalizeWorkflowCardPayload(
  raw: Record<string, unknown>,
  source: string,
): GovernanceCardData {
  if (raw.id && raw.type && raw.actions) {
    return { ...(raw as unknown as GovernanceCardData), source };
  }
  const rawContent = typeof raw.content === "object" && raw.content
    ? raw.content as Record<string, unknown>
    : {};
  const cardId = raw.card_id != null
    ? String(raw.card_id)
    : raw.id != null
      ? String(raw.id)
      : `gov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const contractId = raw.contract_id != null
    ? String(raw.contract_id)
    : rawContent.contract_id != null
      ? String(rawContent.contract_id)
      : undefined;
  const status = raw.status === "adopted" || raw.status === "rejected" || raw.status === "dismissed"
    || raw.status === "stale"
    ? raw.status
    : "pending";
  const cardType: GovernanceCardData["type"] =
    raw.type === "route_status" || raw.type === "assist_skills_status" || raw.type === "staged_edit" || raw.type === "adoption_prompt" || raw.type === "followup_prompt"
      ? raw.type
      : raw.suggested_action === "staged_edit" || raw.staged_edit_id != null
        ? "staged_edit"
        : "followup_prompt";

  const actions: GovernanceAction[] = raw.suggested_action === "staged_edit"
    ? [{ label: "查看修改", type: "view_diff" }, { label: "采纳", type: "adopt" }]
    : contractId
      ? []
      : [{ label: "查看", type: "view_diff" }, { label: "忽略", type: "reject" }];

  return {
    id: cardId,
    source,
    type: cardType,
    title: String(raw.title || "治理建议"),
    content: {
      card_id: cardId,
      contract_id: contractId,
      summary: raw.summary,
      description: raw.description,
      severity: raw.severity,
      category: raw.category,
      status: raw.status,
      kind: raw.kind,
      mode: raw.mode,
      phase: raw.phase,
      priority: raw.priority,
      target: raw.target,
      artifact_refs: raw.artifact_refs,
      blocked_by: raw.blocked_by,
      exit_reason: raw.exit_reason,
      source_card_id: raw.source_card_id,
      validation_source: raw.validation_source,
      target_kind: raw.target_kind,
      target_ref: raw.target_ref ?? raw.target_file,
      acceptance_rule: raw.acceptance_rule ?? raw.acceptance_rule_text,
      evidence_snippets: raw.evidence_snippets,
      target_files: raw.target_files,
      problem_refs: raw.problem_refs,
      target_file: raw.target_file,
      file_role: raw.file_role,
      handoff_policy: raw.handoff_policy,
      route_kind: raw.route_kind,
      destination: raw.destination,
      return_to: raw.return_to,
      external_state: raw.external_state,
      queue_window: raw.queue_window,
      staged_edit_id: raw.staged_edit_id != null
        ? String(raw.staged_edit_id)
        : cardType === "staged_edit" && raw.id != null
          ? String(raw.id)
          : undefined,
      ...rawContent,
    },
    status,
    actions,
  };
}

export function normalizeWorkflowStagedEditPayload(
  raw: Record<string, unknown>,
  source: string,
): StagedEdit {
  return normalizeStagedEditPayload(raw, source);
}

export function parseWorkflowEnvelope(raw: Record<string, unknown>): WorkflowEventEnvelope | null {
  if (!raw.event_type || !raw.source_type || !raw.phase || !raw.payload) return null;
  return raw as unknown as WorkflowEventEnvelope;
}

export function parseWorkflowStatePayload(raw: Record<string, unknown>): WorkflowStateData | null {
  const hasCoreWorkflowFields =
    typeof raw.session_mode === "string"
    && typeof raw.workflow_mode === "string"
    && typeof raw.phase === "string"
    && typeof raw.next_action === "string";
  const hasPatchFields = [
    "queue_window",
    "active_card_id",
    "workspace_mode",
    "metadata",
    "next_action",
    "phase",
  ].some((key) => key in raw);
  if (!hasCoreWorkflowFields && !hasPatchFields) return null;
  return raw as unknown as WorkflowStateData;
}

export function parseStudioPatchEnvelope(raw: Record<string, unknown>): StudioPatchEnvelope | null {
  if (!raw.run_id || !raw.run_version || !raw.patch_seq || !raw.patch_type || !raw.payload) {
    return null;
  }
  return raw as unknown as StudioPatchEnvelope;
}

export function normalizeAuditSummaryPayload(raw: Record<string, unknown>): AuditResult {
  const verdict = String(raw.verdict || "");
  const severity: AuditResult["severity"] =
    raw.severity === "critical" || raw.severity === "high" || raw.severity === "medium" || raw.severity === "low"
      ? raw.severity
      : verdict === "poor"
        ? "high"
        : verdict === "needs_work"
          ? "medium"
          : "low";
  const qualityScore = typeof raw.quality_score === "number"
    ? raw.quality_score
    : severity === "high" || severity === "critical"
      ? 25
      : severity === "medium"
        ? 55
        : 80;

  return {
    quality_score: qualityScore,
    severity,
    issues: Array.isArray(raw.issues) ? raw.issues as AuditResult["issues"] : [],
    recommended_path:
      raw.recommended_path === "restructure"
      || raw.recommended_path === "brainstorming_upgrade"
      || raw.recommended_path === "major_rewrite"
        ? "restructure"
        : "optimize",
    phase_entry: raw.phase_entry as AuditResult["phase_entry"],
    assist_skills_to_enable: Array.isArray(raw.assist_skills_to_enable)
      ? raw.assist_skills_to_enable.filter((item): item is string => typeof item === "string")
      : undefined,
  };
}

export function normalizeDeepPatchEnvelope(envelope: StudioPatchEnvelope): StudioDeepPatch | null {
  if (envelope.patch_type !== "deep_summary_patch" && envelope.patch_type !== "evidence_patch") {
    return null;
  }
  const payload = envelope.payload || {};
  const evidence = Array.isArray(payload.evidence)
    ? payload.evidence.filter((item): item is string => typeof item === "string")
    : Array.isArray(payload.items)
      ? payload.items.filter((item): item is string => typeof item === "string")
      : undefined;
  const title = typeof payload.title === "string"
    ? payload.title
    : envelope.patch_type === "evidence_patch"
      ? "证据补充"
      : "深层补完";
  const summary = typeof payload.summary === "string"
    ? payload.summary
    : typeof payload.text === "string"
      ? payload.text
      : typeof payload.message === "string"
        ? payload.message
        : "";

  return {
    run_id: envelope.run_id,
    run_version: envelope.run_version,
    patch_seq: envelope.patch_seq,
    patch_type: envelope.patch_type,
    title,
    summary,
    evidence,
    created_at: envelope.created_at,
    payload,
  };
}

export function normalizeStudioErrorPayload(raw: Record<string, unknown>): StudioOrchestrationErrorPayload | null {
  const message = typeof raw.message === "string" && raw.message.trim()
    ? raw.message.trim()
    : null;
  if (!message) return null;

  const payloadSnapshot = raw.payload_snapshot && typeof raw.payload_snapshot === "object"
    ? raw.payload_snapshot as Record<string, unknown>
    : null;

  return {
    kind: typeof raw.error_type === "string" && raw.error_type.trim()
      ? raw.error_type.trim()
      : "server_error",
    message,
    step: typeof raw.step === "string" && raw.step.trim() ? raw.step.trim() : null,
    recoveryHint: typeof raw.recovery_hint === "string" && raw.recovery_hint.trim()
      ? raw.recovery_hint.trim()
      : null,
    activeCardId: typeof raw.active_card_id === "string" && raw.active_card_id.trim()
      ? raw.active_card_id.trim()
      : null,
    autoAdvanced: typeof raw.auto_advanced === "boolean" ? raw.auto_advanced : null,
    retryable: raw.retryable === true,
    payloadSnapshot,
  };
}
