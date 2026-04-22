export type TestFlowEntrySource =
  | "sandbox_chat"
  | "skill_studio_chat"
  | "skill_governance_panel";

export type TestFlowDecisionMode = "reuse" | "revise" | "regenerate";

export type TestFlowAction =
  | "chat_default"
  | "pick_skill"
  | "mount_blocked"
  | "choose_existing_plan"
  | "generate_cases";

export type TestFlowBlockedStage = "case_generation_gate" | "case_generation" | "test_execution" | "quality_evaluation";
export type TestFlowBlockedBefore = "case_generation" | "test_execution" | "quality_evaluation" | "final_verdict";

export interface TestFlowGateReason {
  code: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  step_id: string;
  action: string;
}

export interface TestFlowGuidedStep {
  id: string;
  order: number;
  title: string;
  detail: string;
  status: "blocked" | "todo" | "done";
  action: string;
  action_label: string;
  anchor_id?: string | null;
}

export interface TestFlowSkillCandidate {
  id: number;
  name: string;
  status?: string | null;
}

export interface TestFlowPlanSummary {
  id: number;
  skill_id: number;
  plan_version: number;
  status: string;
  case_count: number;
  focus_mode: string;
  materialized_session_id?: number | null;
}

export interface TestFlowWorkflowCard {
  id: string;
  contract_id?: string | null;
  title: string;
  summary?: string | null;
  status?: string | null;
  kind?: string | null;
  mode?: string | null;
  phase?: string | null;
  priority?: number | null;
  target?: { type?: string | null; key?: string | null } | null;
  source_card_id?: string | null;
  staged_edit_id?: string | null;
  validation_source?: Record<string, unknown> | null;
  artifact_refs?: string[];
}

export interface TestFlowStagedEditNotice {
  id: string;
  source_card_id?: string | null;
  contract_id?: string | null;
  filename: string;
  fileType?: string;
  target_type?: string;
  target_key?: string;
  diff?: Record<string, unknown>[];
  diff_ops?: Record<string, unknown>[];
  change_note?: string;
  next_action?: string | null;
  status?: "pending" | "adopted" | "rejected";
}

export interface TestFlowResolveResponse {
  action: TestFlowAction;
  reason?: string | null;
  skill?: TestFlowSkillCandidate | null;
  candidates?: TestFlowSkillCandidate[];
  blocking_issues?: string[];
  mount_cta?: string | null;
  latest_plan?: TestFlowPlanSummary | null;
  blocked_stage?: TestFlowBlockedStage | null;
  blocked_before?: TestFlowBlockedBefore | null;
  case_generation_allowed?: boolean;
  quality_evaluation_started?: boolean;
  verdict_label?: string | null;
  verdict_reason?: string | null;
  gate_summary?: string | null;
  gate_reasons?: TestFlowGateReason[];
  guided_steps?: TestFlowGuidedStep[];
  primary_action?: string | null;
  workflow_cards?: TestFlowWorkflowCard[];
  staged_edits?: TestFlowStagedEditNotice[];
}

export interface TestFlowResolveRequest {
  entry_source: TestFlowEntrySource;
  conversation_id?: number | null;
  content: string;
  selected_skill_id?: number | null;
  mentioned_skill_ids?: number[];
  candidate_skills?: TestFlowSkillCandidate[];
}

export interface TestFlowRunLink {
  session_id: number;
  report_id?: number | null;
  skill_id: number;
  plan_id: number;
  plan_version: number;
  case_count: number;
  entry_source: TestFlowEntrySource;
  decision_mode?: TestFlowDecisionMode | null;
  conversation_id?: number | null;
  created_at: string;
}
