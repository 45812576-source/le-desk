export interface User {
  id: number;
  username: string;
  display_name: string;
  role: "super_admin" | "dept_admin" | "user";
  department_id: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface Conversation {
  id: number;
  title: string | null;
  workspace_id: number | null;
  workspace?: {
    name: string;
    icon: string;
    color: string;
  } | null;
  created_at: string;
  updated_at: string;
  last_message?: string | null;
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
  status: "draft" | "pending" | "approved" | "rejected";
  created_by: number;
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
}

export interface TaskItem {
  id: number;
  title: string;
  priority: "urgent_important" | "important" | "urgent" | "neither";
  status: "pending" | "in_progress" | "done";
  source_message_id: number | null;
  created_at: string;
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

export interface KnowledgeDetail extends KnowledgeEntry {
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

export interface ToolEntry {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  tool_type?: string;
  input_schema?: Record<string, unknown>;
  output_format?: string;
  config?: Record<string, unknown>;
  created_by?: number;
  created_at?: string;
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
}

export interface Department {
  id: number;
  name: string;
  parent_id: number | null;
  category: string | null;
  business_unit: string | null;
}
