import type { GovernanceCardData, StagedEdit } from "./types";

export interface WorkflowStateData extends Record<string, unknown> {
  workflow_id?: string | null;
  session_mode: "create_new_skill" | "optimize_existing_skill" | "audit_imported_skill";
  workflow_mode: string;
  phase: string;
  next_action: string;
  complexity_level?: "simple" | "medium" | "high";
  execution_strategy?: "fast_only" | "fast_then_deep" | "deep_resume";
  fast_status?: "not_requested" | "pending" | "running" | "completed" | "failed";
  deep_status?: "not_requested" | "pending" | "running" | "completed" | "failed" | "superseded";
  route_reason?: string;
  active_assist_skills?: string[];
  status?: string;
  skill_id?: number | null;
  conversation_id?: number | null;
  metadata?: Record<string, unknown>;
  queue_window?: {
    active_card_id: string | null;
    visible_card_ids: string[];
    backlog_count: number;
    phase: string;
    max_visible: number;
    reveal_policy: "stage_gated" | "user_expand" | "validation_blocking";
  } | null;
}

export interface WorkflowEventEnvelope {
  event_type: string;
  workflow_id?: string | null;
  source_type: string;
  phase: string;
  step?: string | null;
  payload: Record<string, unknown>;
  correlation_id?: string;
  created_at?: string;
  skill_id?: number | null;
  conversation_id?: number | null;
}

export interface StudioPatchEnvelope {
  run_id: string;
  run_version: number;
  patch_seq: number;
  patch_type:
    | "workflow_patch"
    | "audit_patch"
    | "governance_patch"
    | "staged_edit_patch"
    | "card_patch"
    | "card_status_patch"
    | "artifact_patch"
    | "deep_summary_patch"
    | "evidence_patch"
    | "stale_patch"
    | "queue_window_patch";
  payload: Record<string, unknown>;
  created_at?: string;
}

export interface StudioDeepPatch {
  run_id: string;
  run_version: number;
  patch_seq: number;
  patch_type: "deep_summary_patch" | "evidence_patch";
  title: string;
  summary: string;
  evidence?: string[];
  created_at?: string;
  payload: Record<string, unknown>;
}

export interface WorkflowActionResult {
  action_id: string;
  ok: boolean;
  action: string;
  card_id?: string | null;
  staged_edit_id?: string | null;
  target_type?: string | null;
  target_key?: string | null;
  updated_card_status?: GovernanceCardData["status"] | null;
  updated_staged_edit_status?: StagedEdit["status"] | null;
  workflow_state_patch?: Record<string, unknown>;
  memo_refresh_required?: boolean;
  editor_refresh_required?: boolean;
  recovery_source?: string | null;
  recovery_revision?: number | null;
  recovery_updated_at?: string | null;
  next_cards?: GovernanceCardData[];
  result?: Record<string, unknown>;
  error?: string | null;
}
