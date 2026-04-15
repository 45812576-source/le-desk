import type { GovernanceCardData, GovernanceAction, StagedEdit } from "./types";
import type { WorkflowEventEnvelope, WorkflowStateData } from "./workflow-protocol";
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
