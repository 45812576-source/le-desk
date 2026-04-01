export interface User {
  id: number;
  username: string;
  display_name: string;
  role: "super_admin" | "dept_admin" | "employee";
  department_id: number | null;
  position_id: number | null;
  report_to_id: number | null;
  report_to_name: string | null;
  is_active: boolean;
  created_at: string;
  avatar_url?: string | null;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string; collapsed?: boolean }
  | { type: "tool_call"; id: string; tool: string; input: Record<string, unknown>; status: "running" | "done" | "error"; phase?: "validating" | "executing" | "completed"; duration_ms?: number }
  | { type: "tool_result"; tool_call_id: string; output: string; ok: boolean }
  | { type: "file_ref"; filename: string; url?: string; mime?: string }
  | { type: "knowledge_ref"; id: number; title: string; snippet?: string };

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  content_blocks?: ContentBlock[];
  created_at: string;
  metadata?: {
    skill_id?: number;
    skill_name?: string;
    model_id?: string;
    input_tokens?: number;
    output_tokens?: number;
    duration_ms?: number;
    download_url?: string;
    download_filename?: string;
    [key: string]: unknown;
  };
}

export interface Conversation {
  id: number;
  title: string | null;
  workspace_id: number | null;
  project_id?: number | null;
  workspace?: {
    name: string;
    icon: string;
    color: string;
  } | null;
  workspace_type?: string | null;
  created_at: string;
  updated_at: string;
  last_message?: string | null;
  owner_id?: number | null;
  owner_name?: string | null;
}

export interface Skill {
  id: number;
  name: string;
  description: string;
  scope: "company" | "department" | "personal";
  department_id: number | null;
  created_by: number;
  is_active: boolean;
  variables?: SkillVariable[];
  created_at: string;
}

export interface SkillVariable {
  name: string;
  label: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface KnowledgeEntry {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string[];
  industry_tags?: string[];
  platform_tags?: string[];
  topic_tags?: string[];
  status: "draft" | "pending" | "approved" | "rejected";
  created_by: number;
  created_at: string;
  // OSS 文件信息
  oss_key?: string | null;
  file_type?: string | null;
  file_ext?: string | null;
  file_size?: number | null;
  // AI 命名
  ai_title?: string | null;
  ai_summary?: string | null;
  ai_tags?: { industry?: string[]; platform?: string[]; topic?: string[] } | null;
  quality_score?: number | null;
  // 云文档 HTML
  content_html?: string | null;
  // 云文档渲染状态
  doc_render_status?: 'pending' | 'processing' | 'ready' | 'failed' | null;
  doc_render_error?: string | null;
  doc_render_mode?: string | null;
  // 来源与同步
  source_uri?: string | null;
  sync_status?: 'idle' | 'syncing' | 'ok' | 'error' | null;
  sync_error?: string | null;
  lark_doc_url?: string | null;
  lark_doc_token?: string | null;
  lark_sync_interval?: number | null;
  lark_last_synced_at?: number | null;
  // 能力标志
  can_open_onlyoffice?: boolean;
  can_retry_render?: boolean;
}

export interface Workspace {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  status: string;
  visibility: string;
  welcome_message: string;
  sort_order: number;
  workspace_type?: "chat" | "opencode" | "sandbox" | "skill_studio";
  is_preset?: boolean;
  recommended_by?: number | null;
  for_department_id?: number | null;
}

export interface TaskItem {
  id: number;
  title: string;
  description: string | null;
  priority: "urgent_important" | "important" | "urgent" | "neither";
  status: "pending" | "in_progress" | "done" | "cancelled";
  due_date: string | null;
  assignee_id: number;
  assignee_name: string | null;
  created_by_id: number;
  creator_name: string | null;
  source_type: string;
  source_id: number | null;
  conversation_id: number | null;
  workspace_id: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string | null;
  sub_tasks?: TaskItem[];
}

export interface TaskStats {
  urgent_important: number;
  important: number;
  urgent: number;
  neither: number;
  overdue: number;
  total_pending: number;
}

export interface ConfirmationItem {
  draft_id: number;
  draft_title: string;
  object_type: string;
  field: string;
  question: string;
  options?: string[];
  current_value?: unknown;
}

// --- 审批相关 ---
export interface ApprovalAction {
  id: number;
  actor_id: number;
  actor_name: string | null;
  action: "approve" | "reject" | "add_conditions";
  comment: string | null;
  created_at: string | null;
}

export interface ApprovalRequest {
  id: number;
  request_type: string;
  target_id: number | null;
  target_type: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target_detail: Record<string, any>;
  requester_id: number;
  requester_name: string | null;
  status: "pending" | "approved" | "rejected" | "conditions";
  stage: string | null;
  conditions: unknown[];
  security_scan_result?: Record<string, unknown> | null;
  created_at: string | null;
  actions: ApprovalAction[];
}

export interface EditPermissionCheck {
  can_edit: boolean;
  is_owner: boolean;
  pending_request: { id: number; created_at: string | null } | null;
}

// --- Skill admin types ---
export interface SkillDetail {
  id: number;
  name: string;
  description: string;
  scope: "company" | "department" | "personal";
  department_id: number | null;
  created_by: number;
  is_active: boolean;
  variables?: SkillVariable[];
  created_at: string;
  mode: string;
  status: string;
  knowledge_tags: string[];
  auto_inject: boolean;
  current_version: number;
  versions?: SkillVersion[];
  source_type?: "local" | "imported" | "forked";
  system_prompt?: string;
  source_files?: { filename: string; path: string; size: number; category?: string }[];
  rejection_comment?: string | null;
  data_queries?: { query_name: string; query_type: string; table_name: string; description?: string }[];
}

export interface SkillVersion {
  id: number;
  version: number;
  system_prompt?: string;
  variables: string[];
  model_config_id: number | null;
  change_note: string;
  created_by: number;
  created_at: string;
}

export interface BoundTool {
  id: number;
  name: string;
  display_name: string;
  tool_type: string;
  description: string;
  status: string;
}

export interface KnowledgeDetail extends KnowledgeEntry {
  folder_id: number | null;
  folder_name: string | null;
  review_level: number;
  review_level_label: string;
  review_stage: string;
  review_stage_label: string;
  sensitivity_flags: string[];
  auto_review_note: string | null;
  source_type: string;
  source_file: string | null;
  capture_mode: string;
  reviewed_by: number | null;
  review_note: string | null;
  taxonomy_board: string | null;
  taxonomy_code: string | null;
  taxonomy_path: string[];
}

export interface ModelConfig {
  id: number;
  name: string;
  provider: string;
  model_id: string;
  api_base: string;
  api_key_env: string;
  max_tokens: number;
  temperature: string;
  is_default: boolean;
}

export interface ModelSlot {
  slot_key: string;
  name: string;
  category: string;
  desc: string;
  fallback: string;
  model_config_id: number | null;
  model_name: string | null;
}

export interface ToolManifestDataSource {
  key: string;
  type: "registered_table" | "uploaded_file" | "chat_context";
  required?: boolean;
  description?: string;
  accept?: string[];
}

export interface ToolDeployInfo {
  purpose: string;           // 用途说明
  env_requirements: string;  // 运行环境/依赖
  permissions: string[];     // 权限声明（文字描述）
  tested: boolean;           // 是否本地测试通过
  test_note: string;         // 测试备注
  extra_note: string;        // 其他说明
}

export interface ToolApprovalDetail {
  name: string;
  tool_name: string;
  description: string;
  tool_type: string;
  scope: string;
  input_schema: Record<string, unknown>;
  invocation_mode: string;
  data_sources: ToolManifestDataSource[];
  permissions: string[];
  preconditions: string[];
  deploy_info: Partial<ToolDeployInfo>;
}

export interface ToolManifest {
  invocation_mode?: "chat" | "registered_table" | "file_upload";
  data_sources?: ToolManifestDataSource[];
  permissions?: string[];
  preconditions?: string[];
}

export interface ToolEntry {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  tool_type?: string;
  input_schema?: Record<string, unknown>;
  output_format?: string;
  config?: Record<string, unknown> & { manifest?: ToolManifest };
  created_by?: number;
  created_at?: string;
  scope?: string;
  status?: string;
}

export interface WorkspaceEntry {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  status: string;
  created_by: number;
  department_id: number | null;
  visibility: string;
  welcome_message: string;
  sort_order: number;
  model_config_id: number | null;
  workspace_type?: "chat" | "opencode";
  skills?: { id: number }[];
  tools?: { id: number }[];
  data_tables?: string[];
  system_context?: string;
  created_at?: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  table_name: string;
  operation: string;
  row_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  sql_executed: string | null;
  created_at: string;
}

export interface ContributionStat {
  user_id: number;
  display_name: string;
  department_id: number | null;
  total_suggestions: number;
  adopted_count: number;
  adoption_rate: number;
  influence_score: number;
  impacted_skills: number;
}

export interface KbContributionStat {
  user_id: number;
  display_name: string;
  department_id: number | null;
  total_entries: number;
  approved_entries: number;
  input_tokens: number;
  output_tokens: number;
  models: Record<string, number>;
  top_model: string | null;
}

export interface OpenCodeOutputFile {
  path: string;
  session_title: string;
}

export interface OpenCodeUsageStat {
  user_id: number;
  display_name: string;
  sessions: number;
  ai_calls: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  models: Record<string, number>;
  top_model: string | null;
  files_changed: number;
  lines_added: number;
  lines_deleted: number;
  output_files: OpenCodeOutputFile[];
  skills_submitted: number;
  tools_submitted: number;
  workspaces: string[];
  computed_at: string | null;
}

export interface OpenCodeWorkspace {
  id: string;
  worktree: string;
  name: string | null;
  icon_color: string | null;
  time_created: number;
}

export interface OpenCodeMapping {
  id: number;
  opencode_workspace_id: string;
  opencode_workspace_name: string | null;
  user_id: number;
  display_name: string | null;
  directory: string | null;
}

export interface McpToken {
  id: number;
  prefix: string;
  scope: string;
  workspace_id: number | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface McpSource {
  id: number;
  name: string;
  url: string;
  adapter_type: string;
  is_active: boolean;
  last_synced_at: string | null;
}

export interface BusinessTable {
  id: number;
  table_name: string;
  display_name: string;
  description: string;
  department_id: number | null;
  owner_id: number | null;
  ddl_sql: string;
  validation_rules: Record<string, unknown>;
  workflow: Record<string, unknown>;
  created_at: string;
  columns?: { name: string; type: string; nullable: boolean; comment: string }[];
  // enriched fields (list endpoint)
  owner_name?: string | null;
  department_name?: string | null;
  ownership?: {
    owner_field: string;
    department_field: string | null;
    visibility_level: "detail" | "desensitized" | "stats";
  } | null;
  referenced_skills?: string[];
}

export interface Department {
  id: number;
  name: string;
  parent_id: number | null;
  category: string | null;
  business_unit: string | null;
}

export interface ChunkSearchResult {
  knowledge_id: number;
  chunk_index: number;
  text: string;
  score: number;
  source_file: string | null;
  taxonomy_board: string | null;
  category: string | null;
  title: string;
  // Block mapping (may be null for legacy entries)
  block_id: number | null;
  block_key: string | null;
  heading_path: string | null;
  char_range: [number, number] | null;
}

export interface KnowledgeChunkDetail {
  id: number;
  title: string;
  content: string;
  source_type: string;
  source_file: string | null;
  chunks: { index: number; text: string }[];
}

export interface SavedSkill extends SkillDetail {
  has_update: boolean;
  saved_at: string;
}

// ─── Project types ─────────────────────────────────────────────────────────

export interface ProjectMember {
  id: number;
  user_id: number;
  display_name: string | null;
  role_desc: string | null;
  workspace_id: number | null;
  workspace_name: string | null;
  task_order: number;
  joined_at: string;
}

export interface ProjectContext {
  id: number;
  workspace_id: number;
  workspace_name: string | null;
  summary: string | null;
  requirements: string | null;
  acceptance_criteria: string | null;
  handoff_status: "none" | "submitted" | "accepted";
  handoff_at: string | null;
  updated_at: string;
}

export interface ProjectKnowledgeShare {
  id: number;
  user_id: number;
  user_name: string | null;
  knowledge_id: number;
  knowledge_title: string | null;
  shared_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "active" | "completed" | "archived";
  project_type: "dev" | "custom";
  owner_id: number;
  owner_name: string | null;
  department_id: number | null;
  max_members: number;
  llm_generated_plan: ProjectPlan | null;
  created_at: string;
  updated_at: string;
  // list endpoint
  member_count?: number;
  member_names?: string[];
  // detail endpoint
  members?: ProjectMember[];
  contexts?: ProjectContext[];
  knowledge_shares?: ProjectKnowledgeShare[];
}

export interface ProjectWorkspacePlan {
  user_id: number;
  workspace_name: string;
  identity_desc: string;
  system_context: string;
  responsibilities: string[];
  suggested_skills: string[];
  suggested_tools: string[];
  task_order: number;
  dependencies: number[];
}

export interface ProjectPlan {
  overall_flow: string;
  workspaces: ProjectWorkspacePlan[];
}

export interface ProjectReport {
  id: number;
  project_id: number;
  report_type: "daily" | "weekly";
  content: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

// ─── 交互式沙盒测试 ─────────────────────────────────────────────────────────

// ─── Skill Memo types ─────────────────────────────────────────────────────────

export interface SkillPersistentNotice {
  id: string;
  type: "missing_structure" | "test_failure" | "feedback_followup";
  title: string;
  message: string;
  blocking: boolean;
  status: "active" | "resolved";
  related_task_ids: string[];
}

export interface SkillMemoTask {
  id: string;
  title: string;
  type: string;
  status: "todo" | "in_progress" | "done" | "skipped";
  priority: "high" | "medium" | "low";
  description: string;
  target_files: string[];
  acceptance_rule: { mode: string };
  depends_on: string[];
  result_summary?: string | null;
}

export interface SkillMemoTestRecord {
  id: string;
  source: "preflight" | "sandbox" | "manual";
  version: number;
  status: "passed" | "failed";
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
  followup_task_ids: string[];
}

export interface SkillMemo {
  skill_id: number;
  scenario_type: "import_remediation" | "new_skill_creation" | "published_iteration";
  lifecycle_stage: "analysis" | "planning" | "editing" | "awaiting_test" | "testing" | "fixing" | "ready_to_submit" | "completed";
  status_summary: string;
  goal_summary: string | null;
  persistent_notices: SkillPersistentNotice[];
  current_task: SkillMemoTask | null;
  next_task: SkillMemoTask | null;
  memo: Record<string, unknown>;
  latest_test: SkillMemoTestRecord | null;
}

export interface StudioMemoStatusEvent {
  lifecycle_stage: string;
  status_summary: string;
  has_open_todos: boolean;
  can_test: boolean;
}

export interface StudioEditorTargetEvent {
  mode: "open_or_create";
  file_type: "asset" | "prompt";
  filename: string;
}

// ─── 交互式沙盒测试 ─────────────────────────────────────────────────────────

export interface SandboxInputSlot {
  slot_key: string;
  label: string;
  structured: boolean;
  required: boolean;
  allowed_sources: string[];
  chosen_source: string | null;
  evidence_status: "pending" | "verified" | "failed" | "not_applicable";
  evidence_ref: string | null;
  chat_example: string | null;
  knowledge_entry_id: number | null;
  table_name: string | null;
  field_name: string | null;
  // 证据化审批
  required_reason?: string;
  evidence_requirement?: string;
  pass_criteria?: string;
  verification_conclusion?: "verified" | "failed" | "not_needed" | "unsupported";
  verification_reason?: string;
  suggested_source?: string;
}

export interface SandboxToolProvenance {
  field_name: string;
  field_type?: string;
  description?: string;
  source_kind: string | null;
  source_ref: string | null;
  resolved_value_preview: string | null;
  verified: boolean;
}

export interface SandboxToolReview {
  tool_id: number;
  tool_name: string;
  description: string;
  input_schema?: Record<string, unknown>;
  manifest_data_sources?: Record<string, unknown>[];
  preconditions?: unknown[];
  confirmed: boolean;
  input_provenance: SandboxToolProvenance[];
  // 证据化审批
  requiredness?: "required" | "optional" | "avoidable" | "unknown";
  requiredness_reason?: string;
  non_tool_proof_required?: boolean;
  pass_criteria?: string;
  decision?: "must_call" | "no_need" | "uncertain_block";
  no_tool_proof?: string;
}

export interface SandboxPermissionSnapshot {
  table_name: string;
  display_name: string;
  row_visibility: string;
  ownership_rules: Record<string, unknown>;
  field_masks: { field_name: string; mask_action: string; mask_params: Record<string, unknown>; level?: string }[];
  groupable_fields: string[];
  confirmed: boolean;
  included_in_test: boolean;
  warning?: string;
  // 证据化审批
  permission_required?: boolean;
  permission_required_reason?: string;
  why_no_permission_needed?: string | null;
  applied_rules?: string[];
  evidence_examples?: string[];
  decision?: "required_confirmed" | "no_permission_needed" | "mismatch" | "uncertain_block";
  no_permission_reason?: string;
}

export type SandboxSessionStatus = "draft" | "blocked" | "ready_to_run" | "running" | "completed" | "cannot_test";
export type SandboxSessionStep =
  | "start"
  | "input_slot_review"
  | "tool_review"
  | "permission_review"
  | "case_generation"
  | "execution"
  | "evaluation"
  | "done";

export interface SandboxSession {
  session_id: number;
  target_type: string;
  target_id: number;
  target_version: number | null;
  target_name: string | null;
  tester_id: number;
  status: SandboxSessionStatus;
  current_step: SandboxSessionStep;
  blocked_reason: string | null;
  detected_slots: SandboxInputSlot[];
  tool_review: SandboxToolReview[];
  permission_snapshot: SandboxPermissionSnapshot[] | null;
  theoretical_combo_count: number | null;
  semantic_combo_count: number | null;
  executed_case_count: number | null;
  quality_passed: boolean | null;
  usability_passed: boolean | null;
  anti_hallucination_passed: boolean | null;
  approval_eligible: boolean | null;
  report_id: number | null;
  created_at: string | null;
  completed_at: string | null;
}

export interface SandboxReport {
  report_id: number;
  session_id: number;
  target_type: string;
  target_id: number;
  target_version: number | null;
  target_name: string | null;
  part1_evidence_check: Record<string, unknown>;
  part2_test_matrix: Record<string, unknown>;
  part3_evaluation: Record<string, unknown>;
  quality_passed: boolean | null;
  usability_passed: boolean | null;
  anti_hallucination_passed: boolean | null;
  approval_eligible: boolean | null;
  report_hash: string | null;
  knowledge_entry_id: number | null;
  created_at: string | null;
}
