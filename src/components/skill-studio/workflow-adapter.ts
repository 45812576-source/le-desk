import type { AuditResult, GovernanceCardData, GovernanceAction, StagedEdit } from "./types";
import type { StudioDeepPatch, StudioPatchEnvelope, WorkflowEventEnvelope, WorkflowStateData } from "./workflow-protocol";
import { normalizeStagedEditPayload } from "./utils";

export function normalizeWorkflowCardPayload(
  raw: Record<string, unknown>,
  source: string,
): GovernanceCardData {
  if (raw.id && raw.type && raw.actions) {
    return { ...(raw as unknown as GovernanceCardData), source };
  }

  const actions: GovernanceAction[] = raw.suggested_action === "staged_edit"
    ? [{ label: "查看修改", type: "view_diff" }, { label: "采纳", type: "adopt" }]
    : [{ label: "查看", type: "view_diff" }, { label: "忽略", type: "reject" }];

  return {
    id: `gov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    source,
    type: raw.suggested_action === "staged_edit" ? "staged_edit" : "followup_prompt",
    title: String(raw.title || "治理建议"),
    content: {
      summary: raw.summary,
      description: raw.description,
      severity: raw.severity,
      category: raw.category,
      target_kind: raw.target_kind,
      target_ref: raw.target_ref ?? raw.target_file,
      acceptance_rule: raw.acceptance_rule ?? raw.acceptance_rule_text,
      evidence_snippets: raw.evidence_snippets,
      target_files: raw.target_files,
      problem_refs: raw.problem_refs,
      staged_edit_id: raw.staged_edit_id != null
        ? String(raw.staged_edit_id)
        : raw.id != null
          ? String(raw.id)
          : undefined,
      ...(typeof raw.content === "object" && raw.content ? raw.content as Record<string, unknown> : {}),
    },
    status: "pending",
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
  if (!raw.session_mode || !raw.workflow_mode || !raw.phase || !raw.next_action) return null;
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
