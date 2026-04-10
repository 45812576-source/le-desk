export type SkillStudioViewMode = "all_messages" | "current_skill_messages";

export interface OpenCodeSessionInfo {
  id: string;
  title: string | null;
  directory: string | null;
  message_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface StudioEntryResolution {
  registration_id: number;
  conversation_id: number;
  workspace_root: string;
  project_dir: string;
  runtime_status: "stopped" | "starting" | "running" | "unhealthy";
  runtime_port: number | null;
  generation: number;
  needs_recover: boolean;
  recent_conversation_ids: number[];
  last_active_at: string | null;
  /** opencode.db 中的全量 session 列表 */
  opencode_sessions: OpenCodeSessionInfo[];
  opencode_session_count: number;
  /** POST /entry 返回时额外字段 */
  port?: number | null;
  url?: string | null;
  runtime_error?: string | null;
}

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
  // AI 结构化笔记
  ai_notes_html?: string | null;
  ai_notes_status?: 'pending' | 'processing' | 'ready' | 'failed' | null;
  ai_notes_error?: string | null;
  // 来源与同步
  source_uri?: string | null;
  sync_status?: 'idle' | 'syncing' | 'ok' | 'error' | null;
  sync_error?: string | null;
  lark_doc_url?: string | null;
  lark_doc_token?: string | null;
  lark_sync_interval?: number | null;
  lark_last_synced_at?: number | null;
  external_edit_mode?: "detached_copy" | "linked_readonly" | null;
  source_origin_label?: string | null;
  can_refresh_from_source?: boolean;
  governance_objective_id?: number | null;
  resource_library_id?: number | null;
  object_type_id?: number | null;
  governance_status?: "ungoverned" | "suggested" | "aligned" | "needs_review" | null;
  governance_confidence?: number | null;
  governance_note?: string | null;
  // 能力标志
  can_open_onlyoffice?: boolean;
  can_retry_render?: boolean;
  // 文档理解 Profile
  understanding_display_title?: string | null;
  understanding_document_type?: string | null;
  understanding_permission_domain?: string | null;
  understanding_desensitization_level?: string | null;
  understanding_contains_sensitive_data?: boolean;
  understanding_content_tags?: {
    subject_tag?: string;
    object_tag?: string;
    scenario_tag?: string;
    action_tag?: string;
    industry_or_domain_tag?: string;
  } | null;
  understanding_summary_short?: string | null;
  understanding_summary_search?: string | null;
  understanding_status?: "pending" | "running" | "success" | "partial" | "failed" | null;
  understanding_data_type_hits?: Array<{ type: string; label: string; count: number; samples?: string[] }> | null;
  understanding_visibility_recommendation?: string | null;
  understanding_suggested_tags?: string[] | null;
  understanding_title_confidence?: number | null;
  understanding_title_source?: string | null;
  understanding_summary_sensitivity_mode?: string | null;
}

// ── Skill 知识引用安全检查 ──────────────────────────────────────────────────

export interface SkillKnowledgeReference {
  knowledge_id: number;
  title: string;
  folder_id: number | null;
  folder_path: string;
  document_type: string | null;
  permission_domain: string | null;
  desensitization_level: string | null;
  data_type_hits: Array<{ type: string; label: string; count: number }>;
  effective_mask_rules: Array<{ data_type: string; mask_action: string; label?: string }>;
  mask_rule_source: string | null;
  manager_scope_ok: boolean;
}

export interface SkillPublishPrecheck {
  blocked: boolean;
  block_reasons: string[];
  references: SkillKnowledgeReference[];
  risk_summary: {
    high_sensitivity_count: number;
    missing_mask_config_count: number;
    out_of_scope_count: number;
    unconfirmed_count: number;
  };
  policy_snapshot?: Record<string, unknown>;
}

export interface KnowledgeMaskFeedback {
  id: number;
  knowledge_id: number;
  knowledge_title?: string | null;
  submitted_by: number;
  submitter_name?: string | null;
  current_desensitization_level: string | null;
  current_data_type_hits?: Array<Record<string, unknown>>;
  suggested_desensitization_level: string;
  suggested_data_type_adjustments?: Array<Record<string, unknown>>;
  reason: string;
  evidence_snippet?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by?: number | null;
  reviewer_name?: string | null;
  review_note?: string | null;
  review_action?: string | null;
  reviewed_at?: string | null;
  created_at: string;
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
  action: "approve" | "reject" | "add_conditions" | "request_more_info" | "approve_with_conditions" | "supplement";
  comment: string | null;
  decision_payload: Record<string, unknown> | null;
  checklist_result: Array<{ item: string; status: string; note?: string }> | null;
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
  needs_info_comment: string | null;
  reason: string | null;
  conditions: unknown[];
  security_scan_result?: Record<string, unknown> | null;
  sandbox_report_id?: number | null;
  sandbox_report_hash?: string | null;
  // V2: 模板驱动
  evidence_pack: Record<string, unknown> | null;
  risk_level: string | null;
  impact_summary: string | null;
  review_template: Record<string, unknown> | null;
  evidence_complete: boolean;
  missing_evidence: string[];
  is_high_risk: boolean;
  approve_blocked: boolean;
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

export interface SkillExecutionStats {
  skill_id: number;
  days: number;
  usage_count: number;
  success_rate: number | null;
  avg_duration_ms: number | null;
  avg_rating: number | null;
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
  is_in_my_knowledge?: boolean;
  raw_title?: string | null;
  business_unit?: string | null;
  folder_business_unit?: string | null;
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
  visibility_scope?: {
    scope: string;
    reason: string;
    owner_id?: number;
    department_id?: number;
  };
}

export interface KnowledgeShareLink {
  id: number;
  share_token: string;
  share_url: string;
  is_active: boolean;
  access_scope: string;
  expires_at: string | null;
  created_at: string | null;
  last_accessed_at?: string | null;
  access_count?: number;
}

export interface PublicKnowledgeDetail {
  title: string;
  content: string;
  content_html: string | null;
  source_type: string | null;
  source_origin_label: string | null;
  updated_at: string | null;
  created_at: string | null;
  doc_render_status: string | null;
  share_meta: {
    access_scope: string;
    expires_at: string | null;
  };
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

export interface ToolVersionEntry {
  id: number;
  version: number;
  status: "draft" | "active" | "deprecated";
  version_note: string | null;
  created_by: number | null;
  created_at: string | null;
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
  current_version?: number;
  versions?: ToolVersionEntry[];
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

export interface TokenDashboardSourceStats {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens?: number;
}

export interface TokenDashboardEntry {
  user_id: number;
  display_name: string;
  opencode: TokenDashboardSourceStats;
  skill_studio: TokenDashboardSourceStats;
  chat: TokenDashboardSourceStats;
  project: TokenDashboardSourceStats;
  total_input: number;
  total_output: number;
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
  acceptance_rule: { mode: string; text?: string };
  depends_on: string[];
  result_summary?: string | null;
  // 结构化整改字段
  problem_refs?: string[];
  target_kind?: string;
  target_ref?: string;
  retest_scope?: string[];
  acceptance_rule_text?: string;
  source_report_id?: number;
}

export interface SkillMemoTestRecord {
  id: string;
  source: "preflight" | "sandbox" | "sandbox_interactive" | "manual";
  version: number;
  status: "passed" | "failed";
  summary: string;
  details: Record<string, unknown> & {
    approval_eligible?: boolean;
    blocking_reasons?: string[];
  };
  created_at: string;
  followup_task_ids: string[];
  source_report_id?: number;
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

export interface SandboxStepStatus {
  status: "pending" | "running" | "completed" | "failed";
  started_at: string | null;
  finished_at: string | null;
  error_code: string | null;
  error_message: string | null;
  retryable: boolean;
}

export interface SandboxIssue {
  issue_id: string;
  severity: "critical" | "major" | "minor";
  dimension: string;
  reason: string;
  impact: string;
  source_cases: number[];
  evidence_snippets: string[];
  fix_suggestion: string;
  target_kind: "skill_prompt" | "source_file" | "tool_binding" | "knowledge_reference" | "input_slot_definition" | "permission_config" | "unknown";
  target_ref: string;
  retest_scope: string[];
}

export interface SandboxFixPlanItem {
  id: string;
  title: string;
  priority: "p0" | "p1" | "p2";
  problem_ids: string[];
  action_type: string;
  target_kind: string;
  target_ref: string;
  suggested_changes: string;
  acceptance_rule: string;
  retest_scope: string[];
  estimated_gain: string;
}

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
  step_statuses?: Record<string, SandboxStepStatus>;
  parent_session_id?: number;
  final_status?: "passed" | "failed" | null;
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
  cases?: {
    case_index: number;
    row_visibility: string | null;
    field_output_semantic: string | null;
    group_semantic: string | null;
    tool_precondition: string | null;
    test_input: string | null;
    llm_response: string | null;
    verdict: string | null;
    verdict_reason: string | null;
    execution_duration_ms: number | null;
  }[];
  quality_passed: boolean | null;
  usability_passed: boolean | null;
  anti_hallucination_passed: boolean | null;
  approval_eligible: boolean | null;
  report_hash: string | null;
  knowledge_entry_id: number | null;
  created_at: string | null;
  supporting_findings?: SandboxSupportingFinding[];
}

export interface SandboxSupportingFinding {
  id: string;
  title: string;
  conclusion: string;
  detail?: string;
  evidence_snippets?: string[];
  source_case_indexes?: number[];
  severity?: "info" | "minor" | "major" | "critical";
  recommendation?: string;
}

// ─── 知识管理后台 V1.5 ────────────────────────────────────────────────────

export interface KnowledgeFolderGrant {
  id: number;
  folder_id: number;
  folder_name: string;
  grantee_user_id: number;
  grantee_name: string;
  scope: "subtree";
  can_manage_children: boolean;
  can_delete_descendants: boolean;
  created_by: number;
  created_at: string;
}

export interface KnowledgeRerunJob {
  id: number;
  trigger_type: string;
  target_folder_id: number;
  target_folder_name: string;
  status: "pending" | "running" | "success" | "failed";
  affected_count: number;
  reclassified_count: number;
  renamed_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  finished_at: string | null;
}

export interface FolderAuditLog {
  id: number;
  folder_id: number;
  folder_name: string;
  action: string;
  old_value: Record<string, unknown>;
  new_value: Record<string, unknown>;
  performed_by: number;
  performer_name: string;
  created_at: string;
}

export interface FolderTreeNode {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  is_system: number;
  taxonomy_board: string | null;
  taxonomy_code: string | null;
  entry_count: number;
  manager_count: number;
  created_at: string | null;
  children: FolderTreeNode[];
}

export interface FolderImpact {
  folder_id: number;
  folder_name: string;
  child_folder_count: number;
  entry_count: number;
  grant_count: number;
}

// ─── 标签治理 V1.5 ──────────────────────────────────────────────────────────

export type TagCategory = "industry" | "platform" | "topic" | "scenario" | "custom";
export type TagRelationType = "synonym" | "broader" | "narrower" | "related";

export interface KnowledgeTag {
  id: number;
  name: string;
  code: string;
  category: TagCategory;
  parent_id: number | null;
  description: string | null;
  sort_order: number;
  is_active: number;
  created_at: string | null;
  children?: KnowledgeTag[];
}

export interface KnowledgeTagRelation {
  id: number;
  source_tag_id: number;
  source_tag_name: string | null;
  source_tag_code: string | null;
  target_tag_id: number;
  target_tag_name: string | null;
  target_tag_code: string | null;
  relation_type: TagRelationType;
  confidence: number;
  created_at: string | null;
}

export interface TagRelationEntry {
  id: number;
  direction: "outgoing" | "incoming";
  relation_type: TagRelationType;
  related_tag_id: number;
  related_tag_name: string | null;
  related_tag_code: string | null;
  confidence: number;
}

export interface TagClosureNode {
  id: number;
  name: string;
  code: string;
  category: TagCategory | null;
  depth: number;
  path: string[];
}

export interface GovernanceObjective {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  level: string;
  parent_id?: number | null;
  department_id?: number | null;
  business_line?: string | null;
  objective_role?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface GovernanceResourceLibrary {
  id: number;
  objective_id: number;
  name: string;
  code: string;
  description?: string | null;
  library_type?: string;
  object_type: string;
  governance_mode?: string;
  default_visibility?: string;
  default_update_cycle?: string | null;
  field_schema?: Array<Record<string, unknown>>;
  consumption_scenarios?: string[];
  collaboration_baseline?: Record<string, unknown>;
  classification_hints?: Record<string, unknown>;
  is_active?: boolean;
}

export interface GovernanceSuggestionTask {
  id: number;
  subject_type: string;
  subject_id: number;
  task_type: string;
  status: string;
  objective_id?: number | null;
  resource_library_id?: number | null;
  object_type_id?: number | null;
  suggested_payload?: Record<string, unknown>;
  reason?: string | null;
  confidence?: number;
  created_at?: string | null;
}

export interface GovernanceBlueprintPayload {
  seed_blueprint: Array<Record<string, unknown>>;
  objectives: GovernanceObjective[];
  resource_libraries: GovernanceResourceLibrary[];
  object_types: Array<{
    id: number;
    code: string;
    name: string;
    description?: string | null;
    dimension_schema?: Array<Record<string, unknown>>;
    baseline_fields?: string[];
    default_consumption_modes?: string[];
  }>;
}

// ─── 统一权限模型（P1） ────────────────────────────────────────────────────

export type PermissionResourceType = "folder" | "approval_capability";
export type PermissionSource = "direct" | "approval" | "role_default";
export type PermissionActionCategory = "folder_mgmt" | "content_review" | "publish_approval" | "data_security";

export interface KnowledgePermissionGrantDetail {
  id: number;
  grantee_user_id: number;
  resource_type: PermissionResourceType;
  resource_id: number | null;
  action: string;
  scope: "exact" | "subtree";
  granted_by: number | null;
  granted_at: string;
  expires_at: string | null;
  source: PermissionSource;
  resource_name?: string;
  action_label?: string;
  action_category?: PermissionActionCategory;
}

export type PermissionChangeDomain = "feature_flag" | "model_grant" | "capability_grant";

export interface PermissionChangeRequest {
  id: number;
  target_user_id: number;
  domain: PermissionChangeDomain;
  action_key: string;
  current_value: unknown;
  target_value: unknown;
  reason: string | null;
  risk_note: string | null;
  requester_id: number;
  status: "pending" | "approved" | "rejected";
  reviewer_id: number | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface UserPermissionSummary {
  feature_flags: Record<string, boolean>;
  model_grants: { id: number; user_id: number; model_key: string; granted_at: string | null }[];
  knowledge_permissions: KnowledgePermissionGrantDetail[];
  approval_capabilities: KnowledgePermissionGrantDetail[];
  pending_changes: PermissionChangeRequest[];
}

// ── 组织管理模块 ────────────────────────────────────────────────────────────

export interface OrgImportSession {
  id: number;
  import_type: string;
  file_name: string | null;
  status: "uploading" | "parsing" | "parsed" | "confirmed" | "applied" | "failed";
  row_count: number;
  parsed_count: number;
  raw_data?: unknown;
  ai_parsed_data?: unknown;
  ai_parse_note?: string | null;
  error_rows?: Array<{ row: number; reason: string }>;
  created_at: string | null;
  applied_at: string | null;
}

export interface OrgChangeEvent {
  id: number;
  entity_type: string;
  entity_id: number;
  change_type: "created" | "updated" | "deleted" | "imported" | "confirmed";
  field_changes: Array<{ field: string; old_value: unknown; new_value: unknown }>;
  change_source: string;
  import_session_id: number | null;
  baseline_version: string | null;
  created_by: number | null;
  created_at: string | null;
}

export interface OkrPeriod {
  id: number;
  name: string;
  period_type: "quarter" | "half_year" | "year";
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "active" | "evaluating" | "archived";
}

export interface OkrObjective {
  id: number;
  period_id: number;
  owner_type: "company" | "department" | "user";
  owner_id: number;
  parent_objective_id: number | null;
  title: string;
  weight: number;
  progress: number;
  status: "draft" | "active" | "completed" | "cancelled";
  sort_order: number;
  key_results?: OkrKeyResult[];
  children?: OkrObjective[];
}

export interface OkrKeyResult {
  id: number;
  objective_id: number;
  title: string;
  metric_type: "number" | "percentage" | "boolean" | "milestone";
  target_value: string | null;
  current_value: string | null;
  unit: string | null;
  weight: number;
  progress: number;
  status: "on_track" | "at_risk" | "behind" | "completed";
  owner_user_id: number | null;
  sort_order: number;
}

export interface KpiAssignment {
  id: number;
  user_id: number;
  period_id: number;
  position_id: number | null;
  department_id: number | null;
  kpi_data: Array<{ name: string; weight: number; target: string; actual: string; score: number; metric_type?: string; unit?: string }>;
  total_score: number | null;
  level: string | null;
  evaluator_id: number | null;
  status: "draft" | "submitted" | "evaluated" | "confirmed";
}

export interface DeptMissionDetail {
  id: number;
  department_id: number;
  mission_summary: string | null;
  core_functions: Array<{ name: string; description: string }>;
  upstream_deps: Array<{ dept_id: number; what_receive: string }>;
  downstream_deliveries: Array<{ dept_id: number; what_deliver: string }>;
  owned_data_types: string[];
}

export interface BizProcess {
  id: number;
  name: string;
  code: string;
  description: string | null;
  process_nodes: Array<{ order: number; name: string; dept_id?: number; position_id?: number; input_data?: string[]; output_data?: string[] }>;
  is_active: boolean;
}

export interface BizTerminology {
  id: number;
  term: string;
  aliases: string[];
  definition: string | null;
  resource_library_code: string | null;
  department_id: number | null;
}

export interface DataAssetOwnership {
  id: number;
  asset_name: string;
  asset_code: string;
  owner_department_id: number;
  update_frequency: string;
  consumer_department_ids: number[];
  resource_library_code: string | null;
  description: string | null;
}

export interface DeptCollabLink {
  id: number;
  dept_a_id: number;
  dept_b_id: number;
  frequency: "high" | "medium" | "low";
  scenarios: string[];
}

export interface PositionAccessRule {
  id: number;
  position_id: number;
  data_domain: string;
  access_range: string;
  excluded_fields: string[];
}

export interface OrgBaselineStatus {
  baseline_version: string | null;
  baseline_status: string;
  baseline_created_at: string | null;
  department_count: number;
  user_count: number;
  import_count: number;
  change_event_count: number;
  governance_coverage_rate: number;
}

export interface OrgDepartment {
  id: number;
  name: string;
  parent_id: number | null;
  category: string | null;
  business_unit: string | null;
  code: string | null;
  level: string | null;
  headcount_budget: number | null;
  lifecycle_status: string;
  established_at: string | null;
  dissolved_at: string | null;
  sort_order: number;
  created_at: string | null;
}

export interface OrgRosterUser {
  id: number;
  username: string;
  display_name: string;
  role: string;
  department_id: number | null;
  position_id: number | null;
  report_to_id: number | null;
  is_active: boolean;
  employee_no: string | null;
  employee_status: string | null;
  job_title: string | null;
  job_level: string | null;
  entry_date: string | null;
  exit_date: string | null;
  avatar_url: string | null;
}

// ─── 资产权限模型 ────────────────────────────────────────────────────────────

export type AssetType = "knowledge_folder" | "business_table" | "data_table" | "skill" | "tool";
export type AssetAction = "owner" | "view" | "edit" | "bind_skill" | "bind_tool";

export interface AssetPermissionGrant {
  id: number;
  asset_type: AssetType;
  asset_id: number;
  asset_name: string;
  grantee_type: "user";
  grantee_user_id: number;
  grantee_display_name: string;
  permission_key: AssetAction;
  scope: "exact" | "subtree";
  granted_by: number | null;
  granted_at: string;
  expires_at: string | null;
  source: "direct" | "approval" | "role_default";
}

export interface AssetPermissionChangeRequest {
  id: number;
  asset_type: AssetType;
  asset_id: number;
  asset_name: string;
  grantee_user_id: number;
  grantee_display_name: string;
  permission_key: AssetAction;
  scope: "exact" | "subtree";
  change_type: "grant" | "revoke";
  reason: string | null;
  risk_note: string | null;
  requester_id: number;
  status: "pending" | "approved" | "rejected";
  reviewer_id: number | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ─── 用户资格能力模型 ────────────────────────────────────────────────────────

export type UserCapabilityKey =
  | "knowledge_asset_admin"
  | "knowledge_asset_operator"
  | "knowledge_folder_governance_admin"
  | "skill_release_reviewer"
  | "tool_release_reviewer"
  | "data_asset_reviewer";

export interface UserCapabilityGrant {
  id: number;
  user_id: number;
  capability_key: UserCapabilityKey;
  granted_by: number | null;
  granted_at: string;
  expires_at: string | null;
  source: "direct" | "approval" | "role_default";
  scope_json: Record<string, unknown> | null;
}

// ── 组织基线版本中心 V2 ─────────────────────────────────────────────────────

export interface OrgBaselineVersion {
  id: number;
  version: string;
  version_type: "init" | "incremental" | "major";
  status: "draft" | "candidate" | "active" | "archived";
  snapshot_summary: Record<string, number>;
  diff_from_previous: Array<{ entity_type: string; entity_id: number; change_type: string; summary: string }>;
  impact_analysis: { affected_resource_libraries?: number; affected_policies?: number; affected_rules?: number; affected_missions?: number; total_changes?: number };
  governance_snapshot_id: number | null;
  trigger_source: string;
  created_by: number | null;
  activated_at: string | null;
  created_at: string | null;
  note: string | null;
  impacts?: OrgChangeImpactItem[];
}

export interface OrgChangeImpactItem {
  id: number;
  impact_type: string;
  target_type: string;
  target_id: number | null;
  target_name: string | null;
  severity: "high" | "medium" | "low";
  description: string | null;
  resolved: boolean;
  created_at: string | null;
}

export interface GovernanceSyncStatus {
  active_baseline: { version: string | null; status: string; activated_at: string | null; snapshot_summary: Record<string, number> };
  candidate_baseline: { version: string | null; diff_count: number; impact_analysis: Record<string, number> } | null;
  governance_snapshot: { version: string | null; is_active: boolean };
  baseline_consistent: boolean;
  mission_sync: { total_depts: number; synced: number; pending_sync: number; missing_detail: number };
  resource_library_gaps: { total: number; missing_fields: Array<{ id: number; code: string; name: string; issue: string }>; missing_cycle: Array<Record<string, unknown>>; missing_consumer: Array<Record<string, unknown>> };
  access_rule_sync: { total_rules: number; synced_to_policy: number; pending_sync: number };
  governance_tasks: { pending_suggestions: number };
  unresolved_impacts: number;
}

export interface PositionCompetencyModel {
  id: number;
  position_id: number;
  responsibilities: Array<{ name: string; description: string; priority?: string }>;
  competencies: Array<{ name: string; level_required: string; description?: string }>;
  output_standards: Array<{ deliverable: string; quality_criteria: string; frequency?: string }>;
  career_path: Array<{ from_level: string; to_level: string; typical_duration?: string; requirements?: string }>;
}

export interface ResourceLibraryDef {
  id: number;
  library_code: string;
  display_name: string;
  owner_department_id: number | null;
  owner_position_id: number | null;
  required_fields: Array<{ field_key: string; label: string; type: string; required: boolean }>;
  consumption_scenarios: Array<{ scenario: string; consumer_roles: string[]; frequency: string }>;
  read_write_policy: Record<string, unknown>;
  update_cycle_sla: string | null;
  quality_baseline: Record<string, unknown>;
}

export interface KrResourceMappingItem {
  id: number;
  kr_id: number;
  target_type: string;
  target_code: string;
  target_id: number | null;
  relevance: "direct" | "indirect" | "supporting";
  description: string | null;
}

export interface CollabProtocolItem {
  id: number;
  provider_department_id: number;
  consumer_department_id: number;
  data_object: string;
  trigger_event: string | null;
  sync_frequency: string;
  latency_tolerance: string | null;
  sla_description: string | null;
  is_active: boolean;
}
