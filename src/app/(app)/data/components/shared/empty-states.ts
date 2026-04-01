// ─── 空态常量 ──────────────────────────────────────────────────────────────────
// 后端未返回或 404 时的降级默认值

import type {
  RiskAssessment,
  AccessSimulationResult,
  SmallSampleProtectionConfig,
  DashboardStats,
  SourceProfile,
  FieldImpact,
} from "./types";

export const EMPTY_RISK_ASSESSMENT: RiskAssessment = {
  table_id: 0,
  overall_level: "low",
  overall_score: 0,
  factors: [],
  assessed_at: "",
};

export const EMPTY_SIMULATION_RESULT: AccessSimulationResult = {
  accessible_fields: [],
  blocked_fields: [],
  disclosure_level: "L0",
  row_access_summary: "未配置",
  intercepted_items: [],
};

export const EMPTY_SMALL_SAMPLE: SmallSampleProtectionConfig = {
  enabled: false,
  threshold: 5,
  fallback: "hide_bucket",
};

export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  unfiled_count: 0,
  high_risk_count: 0,
  pending_approval_count: 0,
  sync_failed_count: 0,
};

export const EMPTY_SOURCE_PROFILE: SourceProfile = {
  source_type: "unknown",
  connection_status: "healthy",
  last_check_at: "",
  latency_ms: null,
  error_rate: 0,
  metadata: {},
};

export const EMPTY_FIELD_IMPACT: FieldImpact = {
  field_id: 0,
  field_name: "",
  used_by_views: [],
  used_by_policies: [],
  used_by_skills: [],
  used_by_sync_rules: [],
};
