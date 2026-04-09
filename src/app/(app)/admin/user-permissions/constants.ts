// ─── 用户权限后台常量 ─────────────────────────────────────────────────────────

// ── Feature Flags ────────────────────────────────────────────────────────────

export interface FeatureFlags {
  dev_studio: boolean;
  asr: boolean;
  webapp_publish: boolean;
  batch_upload_skill: boolean;
  feishu_sync: boolean;
}

export const FEATURE_LABELS: Record<keyof FeatureFlags, string> = {
  dev_studio: "Dev Studio（OpenCode）",
  asr: "语音转写（ASR）",
  webapp_publish: "发布 WebApp",
  batch_upload_skill: "批量上传 Skill",
  feishu_sync: "飞书多维表格同步",
};

export type FeatureRiskLevel = "low" | "high";

export const FEATURE_RISK_LEVEL: Record<keyof FeatureFlags, FeatureRiskLevel> = {
  dev_studio: "high",
  asr: "low",
  webapp_publish: "high",
  batch_upload_skill: "low",
  feishu_sync: "high",
};

export const HIGH_RISK_FLAGS = new Set(
  (Object.keys(FEATURE_RISK_LEVEL) as (keyof FeatureFlags)[]).filter(
    (k) => FEATURE_RISK_LEVEL[k] === "high"
  )
);

// ── 模型授权 ─────────────────────────────────────────────────────────────────

export const RESTRICTED_MODELS = ["lemondata/gpt-5.4"];
export const MODEL_LABELS: Record<string, string> = {
  "lemondata/gpt-5.4": "GPT-5.4（LemonData）",
};

// ── 角色 ─────────────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "超管",
  dept_admin: "部门管理员",
  employee: "员工",
};
export const ROLE_COLORS: Record<string, "red" | "yellow" | "cyan"> = {
  super_admin: "red",
  dept_admin: "yellow",
  employee: "cyan",
};

// ── 审批体系资格动作（从共享文件 re-export）──────────────────────────────────

export {
  KNOWLEDGE_ACTION_LABELS,
  REVIEW_ACTIONS,
  PUBLISH_ACTIONS,
  HIGH_RISK_ACTIONS,
  SOURCE_LABELS,
  SOURCE_COLORS,
  CAPABILITY_LABELS,
  CAPABILITY_DESCRIPTIONS,
  CAPABILITY_RISK_LEVEL,
} from "@/lib/knowledge-permission-constants";
