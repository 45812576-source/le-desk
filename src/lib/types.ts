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

export interface TaskItem {
  id: number;
  title: string;
  priority: "urgent_important" | "important" | "urgent" | "neither";
  status: "pending" | "in_progress" | "done";
  source_message_id: number | null;
  created_at: string;
}
