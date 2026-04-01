// ─── 统一 API 调用层 ──────────────────────────────────────────────────────────
// 所有 data-assets API 调用收口，通过 normalizer 转换返回值
// can-mock 接口后端 404 时返回空态

import { apiFetch, ApiError } from "@/lib/api";
import { normalizeTableDetail, normalizeAssetTable, normalizeField } from "./normalize";
import {
  EMPTY_RISK_ASSESSMENT,
  EMPTY_SIMULATION_RESULT,
  EMPTY_DASHBOARD_STATS,
  EMPTY_FIELD_IMPACT,
} from "./empty-states";
import type {
  TableDetail,
  TableDetailV2,
  DataAssetTable,
  DataAssetTableV2,
  DataAssetFolder,
  RiskAssessment,
  AccessSimulationRequest,
  AccessSimulationResult,
  OutputReviewLog,
  LogicalViewRun,
  PolicyVersion,
  DataApproval,
  FieldImpact,
  DashboardStats,
  UnfiledTask,
  SensitivityLevel,
  FieldLifecycleStatus,
  SmallSampleProtectionConfig,
  ExportRule,
  TableFieldDetailV2,
} from "./types";

/** 安全降级：can-mock 接口 404 时返回 fallback */
async function fetchWithFallback<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return fallback;
    }
    throw e;
  }
}

// ── 表详情 ──

export async function fetchTableDetail(tableId: number): Promise<TableDetailV2> {
  const raw = await apiFetch<TableDetail>(`/data-assets/tables/${tableId}`);
  return normalizeTableDetail(raw);
}

// ── 资产列表 ──

export async function fetchAssetTables(params?: {
  folder_id?: number;
  source_type?: string;
  risk_level?: string;
}): Promise<{ items: DataAssetTableV2[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.folder_id) qs.set("folder_id", String(params.folder_id));
  if (params?.source_type) qs.set("source_type", params.source_type);
  if (params?.risk_level) qs.set("risk_level", params.risk_level);
  const qsStr = qs.toString() ? `?${qs.toString()}` : "";

  try {
    const data = await apiFetch<{ items: DataAssetTable[]; total: number }>(`/data-assets/tables${qsStr}`);
    return {
      items: data.items.map(normalizeAssetTable),
      total: data.total,
    };
  } catch {
    // 降级到旧 API
    const arr = await apiFetch<DataAssetTable[]>("/business-tables").catch(() => []);
    const items = (Array.isArray(arr) ? arr : []).map((t) => normalizeAssetTable({
      id: t.id,
      table_name: t.table_name ?? "",
      display_name: t.display_name ?? "",
      description: t.description ?? "",
      folder_id: null,
      source_type: "blank",
      sync_status: "idle",
      last_synced_at: null,
      record_count: null,
      field_count: 0,
      bound_skills: [],
      risk_warnings: [],
      is_archived: false,
      created_at: t.created_at ?? null,
    }));
    return { items, total: items.length };
  }
}

// ── 风险评估 ──

export async function fetchRiskAssessment(tableId: number): Promise<RiskAssessment> {
  return fetchWithFallback(`/data-assets/tables/${tableId}/risk`, { ...EMPTY_RISK_ASSESSMENT, table_id: tableId });
}

// ── 治理缺失项 ──

export async function fetchUnfiledTasks(tableId: number): Promise<UnfiledTask[]> {
  return fetchWithFallback(`/data-assets/tables/${tableId}/unfiled-tasks`, []);
}

// ── 首页 KPI ──

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return fetchWithFallback("/data-assets/dashboard-stats", EMPTY_DASHBOARD_STATS);
}

// ── 策略版本 ──

export async function fetchPolicyVersions(policyId: number): Promise<PolicyVersion[]> {
  const data = await fetchWithFallback<{ items: PolicyVersion[] }>(
    `/data-assets/policies/${policyId}/versions`,
    { items: [] }
  );
  return data.items;
}

// ── 审批 ──

export async function createApprovalRequest(payload: {
  approval_type: string;
  table_id: number;
  payload: Record<string, unknown>;
}): Promise<DataApproval> {
  return apiFetch<DataApproval>("/data-assets/approval-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── 访问模拟 ──

export async function simulateAccess(req: AccessSimulationRequest): Promise<AccessSimulationResult> {
  try {
    return await apiFetch<AccessSimulationResult>("/data-assets/simulations/access", {
      method: "POST",
      body: JSON.stringify(req),
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return EMPTY_SIMULATION_RESULT;
    }
    throw e;
  }
}

// ── 输出审查日志 ──

export async function fetchOutputReviewLogs(tableId: number): Promise<OutputReviewLog[]> {
  const data = await fetchWithFallback<{ items: OutputReviewLog[] }>(
    `/data-assets/output-review-logs?table_id=${tableId}`,
    { items: [] }
  );
  return data.items;
}

// ── 字段影响 ──

export async function fetchFieldImpact(fieldId: number): Promise<FieldImpact> {
  return fetchWithFallback(`/data-assets/fields/${fieldId}/impact`, { ...EMPTY_FIELD_IMPACT, field_id: fieldId });
}

// ── 逻辑视图运行记录 ──

export async function fetchLogicalViewRuns(tableId: number): Promise<LogicalViewRun[]> {
  const data = await fetchWithFallback<{ items: LogicalViewRun[] }>(
    `/data-assets/tables/${tableId}/logical-view-runs`,
    { items: [] }
  );
  return data.items;
}

// ── 字段标签更新（扩展 sensitivity_level） ──

export async function updateFieldTags(fieldId: number, tags: {
  is_sensitive?: boolean;
  sensitivity_level?: SensitivityLevel;
  lifecycle_status?: FieldLifecycleStatus;
  is_free_text?: boolean;
  is_enum?: boolean;
}): Promise<TableFieldDetailV2> {
  const raw = await apiFetch(`/data-assets/fields/${fieldId}/tags`, {
    method: "PATCH",
    body: JSON.stringify(tags),
  });
  return normalizeField(raw as TableFieldDetailV2);
}

// ── 批量字段标签更新 ──

export async function batchUpdateFieldTags(fieldIds: number[], tags: {
  is_sensitive?: boolean;
  sensitivity_level?: SensitivityLevel;
}): Promise<void> {
  await apiFetch("/data-assets/fields/batch-tags", {
    method: "PATCH",
    body: JSON.stringify({ field_ids: fieldIds, ...tags }),
  });
}

// ── 小样本保护 ──

export async function updateSmallSampleProtection(
  tableId: number,
  config: SmallSampleProtectionConfig
): Promise<void> {
  await apiFetch(`/data-assets/tables/${tableId}`, {
    method: "PATCH",
    body: JSON.stringify({ small_sample_protection: config }),
  });
}

// ── 导出规则 ──

export async function fetchExportRules(tableId: number): Promise<ExportRule[]> {
  const data = await fetchWithFallback<{ items: ExportRule[] }>(
    `/data-assets/tables/${tableId}/export-rules`,
    { items: [] }
  );
  return data.items;
}

export async function saveExportRule(tableId: number, rule: Partial<ExportRule>): Promise<ExportRule> {
  return apiFetch<ExportRule>(`/data-assets/tables/${tableId}/export-rules`, {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

// ── 目录 ──

export async function fetchFolders(): Promise<DataAssetFolder[]> {
  const data = await apiFetch<{ items: DataAssetFolder[] }>("/data-assets/folders");
  return data.items;
}
