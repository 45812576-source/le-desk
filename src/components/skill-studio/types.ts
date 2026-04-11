// ─── Shared types for Skill Studio ─────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  loading?: boolean;
}

export interface StudioDraft {
  name?: string;
  description?: string;
  system_prompt: string;
  change_note?: string;
}

export interface DiffOp {
  type: "replace" | "insert_after" | "insert_before" | "delete" | "append";
  old?: string;
  new?: string;
  anchor?: string;
  content?: string;
}

export interface StudioDiff {
  system_prompt?: { old: string; new: string };  // 向后兼容
  ops?: DiffOp[];
  change_note?: string;
  [key: string]: unknown;
}

export interface StudioSummary {
  title?: string;
  items: { label: string; value: string }[];
  next_action?: "generate_draft" | "generate_outline" | "generate_section";
}

export interface ToolSuggestionItem {
  name: string;
  reason: string;
  action: "bind_existing" | "create_new";
  tool_id: number | null;
}

export interface StudioToolSuggestion {
  suggestions: ToolSuggestionItem[];
}

export interface StudioFileSplit {
  files: {
    filename: string;
    category: FileCategory;
    content: string;
    reason: string;
  }[];
  main_prompt_after_split: string;
  change_note?: string;
}

// Which file is currently selected in the editor
export type SelectedFile =
  | { skillId: number; fileType: "prompt" }
  | { skillId: number; fileType: "asset"; filename: string };

// ─── 文件角色分类 ───────────────────────────────────────────────────────────────

export type FileCategory = "knowledge-base" | "reference" | "example" | "tool" | "template" | "other";

// ─── Preflight types ─────────────────────────────────────────────────────────

export interface PreflightGate {
  gate: string;
  label: string;
  status: "running" | "passed" | "failed";
  items?: { check: string; ok: boolean; issue?: string; detail?: string; action?: string; knowledge_id?: number }[];
  cached?: boolean;
  checked_at?: string;
}

export interface PreflightTestResult {
  index: number;
  test_input: string;
  response: string;
  score: number;
  detail: { score?: number; coverage?: number; completeness?: number; professionalism?: number; reason?: string };
}

export interface PreflightResult {
  passed: boolean;
  blocked_by?: string;
  score?: number;
  gates: PreflightGate[];
  tests?: PreflightTestResult[];
}

// ─── V2 Session State ─────────────────────────────────────────────────────────

export interface V2SessionState {
  scenario: string;
  mode: string;
  goal: string;
  confirmed_facts: string[];
  active_constraints: string[];
  rejected: string[];
  file_status: string;
  readiness: number;
  has_draft: boolean;
  total_rounds: number;
}

// ─── Governance Card types ───────────────────────────────────────────────────

export interface GovernanceAction {
  label: string;
  type: "adopt" | "reject" | "view_diff" | "refine";
}

export interface GovernanceCardData {
  id: string;
  type: "route_status" | "assist_skills_status" | "staged_edit" | "adoption_prompt" | "followup_prompt";
  title: string;
  content: Record<string, unknown>;
  status: "pending" | "adopted" | "rejected" | "dismissed";
  actions: GovernanceAction[];
}

// ─── AI 编排层：路由 / 审计 / 治理动作 ──────────────────────────────────────────

export interface StudioRouteInfo {
  session_mode: "create_new_skill" | "optimize_existing_skill" | "audit_imported_skill";
  route_reason: string;
  active_assist_skills: string[];
}

export interface AuditIssue {
  dimension: string;
  score: number;
  detail: string;
  framework?: string;  // 5_whys | mece_issue_tree | scenario_planning | pyramid_principle | pre_mortem | sensitivity_analysis
}

export interface AuditResult {
  quality_score: number;
  severity: "low" | "medium" | "high" | "critical";
  issues: AuditIssue[];
  recommended_path: "optimize" | "restructure";
  phase_entry?: "phase1" | "phase2" | "phase3";
  assist_skills_to_enable?: string[];
}

export interface GovernanceActionCard {
  card_id: string;
  title: string;
  summary: string;
  target: string;
  reason: string;
  risk_level: "low" | "medium" | "high";
  framework?: string;
  phase?: "phase1" | "phase2" | "phase3";
  staged_edit?: { ops: DiffOp[] };
}

// ─── Phase Progress (Skill Architect 三阶段) ─────────────────────────────────

export interface PhaseProgress {
  completed_phase: "phase1" | "phase2" | "phase3";
  phase_label: string;
  deliverables: string[];
  next_phase: "phase1" | "phase2" | "phase3" | null;
  next_label: string | null;
}

// ─── Architect Workflow 事件类型 ─────────────────────────────────────────────

export interface ArchitectQuestion {
  phase: string;
  framework: string;
  question: string;
  options?: string[];
  why?: string;
}

export interface ArchitectPhaseSummary {
  phase: string;
  summary: string;
  deliverables: string[];
  confidence: number;
  ready_for_next: boolean;
}

export interface ArchitectStructure {
  type: "issue_tree" | "dimension_map" | "value_chain";
  root: string;
  nodes: { id: string; label: string; parent: string | null; children: string[] }[];
}

export interface ArchitectPriorityMatrix {
  dimensions: { name: string; priority: "P0" | "P1" | "P2"; sensitivity: "high" | "medium" | "low"; reason: string }[];
}

export interface ArchitectOodaDecision {
  ooda_round: number;
  observation: string;
  orientation: string;
  decision: string;
  delta_from_last: string;
}

export interface ArchitectReadyForDraft {
  key_elements: { name: string; priority: string; source_phase: string }[];
  failure_prevention: string[];
  draft_approach: string;
}

export interface ArchitectPhaseStatus {
  phase: string;
  mode_source: string;
  ooda_round: number;
  phase_confirmed?: Record<string, boolean>;
  transition?: string;
  ooda_decision?: string;
  upgrade_reason?: string;
}

// ─── Staged Edit (batch 3/4 skeleton) ─────────────────────────────────────────

export interface StagedEdit {
  id: string;
  fileType: string;
  filename: string;
  diff: DiffOp[];
  changeNote?: string;
  status: "pending" | "adopted" | "rejected";
}
