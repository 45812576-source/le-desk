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

export interface TestFlowResolveResponse {
  action: TestFlowAction;
  reason?: string | null;
  skill?: TestFlowSkillCandidate | null;
  candidates?: TestFlowSkillCandidate[];
  blocking_issues?: string[];
  latest_plan?: TestFlowPlanSummary | null;
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
