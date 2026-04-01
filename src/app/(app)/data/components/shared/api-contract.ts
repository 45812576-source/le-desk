// ─── API Contract Registry ────────────────────────────────────────────────────
// 所有 V2 新增/扩展接口，按优先级分类
// must-have: 已有接口，需扩展
// can-mock:  前端可本地计算或 mock
// later:     后续实现

export type ApiPriority = "must-have" | "can-mock" | "later";

export interface ApiContractEntry {
  method: string;
  path: string;
  priority: ApiPriority;
  description: string;
}

export const API_CONTRACTS: ApiContractEntry[] = [
  // ── must-have (已有，需扩展) ──
  { method: "GET", path: "/data-assets/tables/{id}", priority: "must-have", description: "扩展返回 risk_assessment, source_profile, small_sample_protection" },
  { method: "PATCH", path: "/data-assets/fields/{id}/tags", priority: "must-have", description: "扩展支持 sensitivity_level" },
  { method: "GET", path: "/data-assets/views/{id}/impact", priority: "must-have", description: "视图影响分析（已有）" },

  // ── can-mock (前端可降级) ──
  { method: "GET", path: "/data-assets/tables/{id}/risk", priority: "can-mock", description: "风险评分，前端可本地计算" },
  { method: "GET", path: "/data-assets/tables/{id}/unfiled-tasks", priority: "can-mock", description: "治理缺失项检查" },
  { method: "GET", path: "/data-assets/dashboard-stats", priority: "can-mock", description: "首页 KPI" },
  { method: "GET", path: "/data-assets/policies/{id}/versions", priority: "can-mock", description: "策略版本列表" },
  { method: "POST", path: "/data-assets/approval-requests", priority: "can-mock", description: "数据安全审批" },
  { method: "POST", path: "/data-assets/simulations/access", priority: "can-mock", description: "访问模拟" },
  { method: "GET", path: "/data-assets/output-review-logs", priority: "can-mock", description: "输出审查日志" },
  { method: "GET", path: "/data-assets/fields/{id}/impact", priority: "can-mock", description: "字段影响图" },
  { method: "GET", path: "/data-assets/tables/{id}/logical-view-runs", priority: "can-mock", description: "逻辑视图运行记录" },

  // ── later (后续实现) ──
  { method: "POST", path: "/data-assets/tables/{id}/run-governance-check", priority: "later", description: "治理检查触发" },
  { method: "POST", path: "/data-assets/policies/{id}/rollback", priority: "later", description: "策略回滚" },
  { method: "POST", path: "/data-assets/approval-requests/{id}/approve", priority: "later", description: "审批通过" },
  { method: "POST", path: "/data-assets/approval-requests/{id}/reject", priority: "later", description: "审批拒绝" },
  { method: "POST", path: "/data-assets/simulations/skill-answer", priority: "later", description: "Skill 回答模拟" },
  { method: "GET", path: "/data-assets/skills/{id}/data-impact", priority: "later", description: "Skill 数据影响" },
];
