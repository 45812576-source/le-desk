"use client";

import { apiFetch } from "@/lib/api";
import type {
  OrgMemoryGovernanceVersion,
  OrgMemoryGovernanceVersionActionResult,
  OrgMemoryGovernanceVersionRefreshResult,
  OrgMemoryProposal,
  OrgMemoryAppliedConfigVersion,
  OrgMemoryProposalCreateResult,
  OrgMemoryRollbackResult,
  OrgMemorySnapshotDiff,
  OrgMemoryProposalSubmitResult,
  OrgMemorySnapshot,
  OrgMemorySnapshotCreateResult,
  OrgMemorySource,
  OrgMemorySourceIngestResult,
  SnapshotScopeOption,
  SnapshotTabKey,
  WorkspaceSnapshotAggregateSyncStatus,
  WorkspaceSnapshotConflict,
  WorkspaceSnapshotDetail,
  WorkspaceSnapshotEventPayload,
  WorkspaceSnapshotEventResult,
  WorkspaceSnapshotFailedSection,
  WorkspaceSnapshotMissingInputType,
  WorkspaceSnapshotMissingItem,
  WorkspaceSnapshotRunDetail,
  WorkspaceSnapshotRunStatus,
  WorkspaceSnapshotSummary,
  WorkspaceSnapshotTabSyncResult,
} from "@/lib/types";
import {
  MOCK_ORG_MEMORY_GOVERNANCE_VERSIONS,
  MOCK_ORG_MEMORY_PROPOSALS,
  MOCK_ORG_MEMORY_SNAPSHOTS,
  MOCK_ORG_MEMORY_SOURCES,
} from "@/lib/org-memory-mock";
import { shouldEnableOrgMemoryClientFallback } from "@/lib/org-memory-proxy";

export const ORG_MEMORY_SOURCE_TYPE_LABELS: Record<string, string> = {
  feishu_doc: "飞书文档",
  notion: "Notion",
  markdown: "Markdown",
  upload: "上传文件",
};

export const ORG_MEMORY_PARSE_STATUS_LABELS: Record<string, string> = {
  ready: "已就绪",
  processing: "处理中",
  warning: "需确认",
  failed: "失败",
};

export const ORG_MEMORY_PARSE_STATUS_STYLES: Record<string, string> = {
  ready: "bg-green-100 text-green-700",
  processing: "bg-blue-100 text-blue-700",
  warning: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

export const ORG_MEMORY_PROPOSAL_STATUS_LABELS: Record<string, string> = {
  draft: "草案中",
  pending_approval: "待审批",
  approved: "已通过",
  rejected: "已拒绝",
  partially_approved: "部分通过",
};

export const ORG_MEMORY_PROPOSAL_STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  partially_approved: "bg-blue-100 text-blue-700",
};

export const ORG_MEMORY_RISK_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
};

export const ORG_MEMORY_GOVERNANCE_STATUS_LABELS: Record<string, string> = {
  draft: "待生效",
  effective: "已生效",
  archived: "已归档",
};

export const ORG_MEMORY_GOVERNANCE_STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  effective: "bg-green-100 text-green-700",
  archived: "bg-amber-100 text-amber-700",
};

export const ORG_MEMORY_SCOPE_LABELS: Record<string, string> = {
  self: "仅本人",
  manager_chain: "汇报链",
  department: "部门内",
  cross_department: "跨部门",
  company: "全公司",
};

export const ORG_MEMORY_REDACTION_MODE_LABELS: Record<string, string> = {
  raw: "原文",
  masked: "脱敏",
  summary: "摘要",
  pattern_only: "模式提炼",
};

export const ORG_MEMORY_ACCESS_DECISION_LABELS: Record<string, string> = {
  allow: "直接放行",
  require_approval: "需确认",
  deny: "禁止访问",
};

export interface OrgMemoryLoadResult<T> {
  data: T;
  fallback: boolean;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) || fallback : fallback;
}

function pickString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function pickNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function pickBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function extractItems<T>(payload: unknown, normalize: (item: unknown) => T): T[] {
  if (Array.isArray(payload)) return payload.map(normalize);
  const obj = asObject(payload);
  const collection = obj?.items ?? obj?.data ?? obj?.results ?? obj?.list ?? [];
  return asArray(collection).map(normalize);
}

function normalizeEvidenceRef(item: unknown) {
  const obj = asObject(item);
  return {
    label: pickString(obj?.label, "证据"),
    section: pickString(obj?.section, "未命名章节"),
    excerpt: pickString(obj?.excerpt, ""),
  };
}

function normalizeSource(item: unknown): OrgMemorySource {
  const obj = asObject(item);
  return {
    id: pickNumber(obj?.id),
    title: pickString(obj?.title, "未命名源文档"),
    source_type: pickString(obj?.source_type, "markdown") as OrgMemorySource["source_type"],
    source_uri: pickString(obj?.source_uri || obj?.uri, ""),
    owner_name: pickString(obj?.owner_name || obj?.owner, "未指定"),
    external_version: pickNullableString(obj?.external_version || obj?.version),
    fetched_at: pickNullableString(obj?.fetched_at || obj?.updated_at),
    ingest_status: pickString(obj?.ingest_status || obj?.status, "ready") as OrgMemorySource["ingest_status"],
    latest_snapshot_version: pickNullableString(obj?.latest_snapshot_version),
    latest_parse_note: pickNullableString(obj?.latest_parse_note || obj?.parse_note),
  };
}

function normalizeSnapshot(item: unknown): OrgMemorySnapshot {
  const obj = asObject(item);
  const entityCountsObj = asObject(obj?.entity_counts);
  const lowConfidenceItems = asArray(obj?.low_confidence_items).map((entry) => {
    const entryObj = asObject(entry);
    return {
      label: pickString(entryObj?.label, "未命名项"),
      reason: pickString(entryObj?.reason, ""),
    };
  });

  return {
    id: pickNumber(obj?.id),
    source_id: pickNumber(obj?.source_id),
    source_title: pickString(obj?.source_title, "未命名来源"),
    snapshot_version: pickString(obj?.snapshot_version || obj?.version, "snapshot"),
    parse_status: pickString(obj?.parse_status || obj?.status, "ready") as OrgMemorySnapshot["parse_status"],
    confidence_score: pickNumber(obj?.confidence_score, 0),
    created_at: pickString(obj?.created_at, new Date().toISOString()),
    summary: pickString(obj?.summary, ""),
    entity_counts: {
      units: pickNumber(entityCountsObj?.units),
      roles: pickNumber(entityCountsObj?.roles),
      people: pickNumber(entityCountsObj?.people),
      okrs: pickNumber(entityCountsObj?.okrs),
      processes: pickNumber(entityCountsObj?.processes),
    },
    units: asArray(obj?.units).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        name: pickString(entryObj?.name, "未命名组织"),
        unit_type: pickString(entryObj?.unit_type, "department") as "org" | "department",
        parent_name: pickNullableString(entryObj?.parent_name),
        leader_name: pickNullableString(entryObj?.leader_name),
        responsibilities: asArray(entryObj?.responsibilities).map((value) => pickString(value)).filter(Boolean),
        evidence_refs: asArray(entryObj?.evidence_refs).map(normalizeEvidenceRef),
      };
    }),
    roles: asArray(obj?.roles).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        name: pickString(entryObj?.name, "未命名岗位"),
        department_name: pickString(entryObj?.department_name, "未指定部门"),
        responsibilities: asArray(entryObj?.responsibilities).map((value) => pickString(value)).filter(Boolean),
        evidence_refs: asArray(entryObj?.evidence_refs).map(normalizeEvidenceRef),
      };
    }),
    people: asArray(obj?.people).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        name: pickString(entryObj?.name, "未命名人员"),
        department_name: pickString(entryObj?.department_name, "未指定部门"),
        role_name: pickString(entryObj?.role_name, "未指定岗位"),
        manager_name: pickNullableString(entryObj?.manager_name),
        employment_status: pickString(entryObj?.employment_status, "unknown"),
        evidence_refs: asArray(entryObj?.evidence_refs).map(normalizeEvidenceRef),
      };
    }),
    okrs: asArray(obj?.okrs).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        owner_name: pickString(entryObj?.owner_name, "未指定归属"),
        period: pickString(entryObj?.period, "未指定周期"),
        objective: pickString(entryObj?.objective, "未命名目标"),
        key_results: asArray(entryObj?.key_results).map((value) => pickString(value)).filter(Boolean),
        evidence_refs: asArray(entryObj?.evidence_refs).map(normalizeEvidenceRef),
      };
    }),
    processes: asArray(obj?.processes).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        owner_name: pickString(entryObj?.owner_name, "未指定归属"),
        name: pickString(entryObj?.name, "未命名流程"),
        participants: asArray(entryObj?.participants).map((value) => pickString(value)).filter(Boolean),
        outputs: asArray(entryObj?.outputs).map((value) => pickString(value)).filter(Boolean),
        risk_points: asArray(entryObj?.risk_points).map((value) => pickString(value)).filter(Boolean),
        evidence_refs: asArray(entryObj?.evidence_refs).map(normalizeEvidenceRef),
      };
    }),
    low_confidence_items: lowConfidenceItems,
  };
}

function normalizeProposal(item: unknown): OrgMemoryProposal {
  const obj = asObject(item);
  const appliedConfigObj = asObject(obj?.applied_config);
  return {
    id: pickNumber(obj?.id),
    snapshot_id: pickNumber(obj?.snapshot_id),
    title: pickString(obj?.title, "未命名草案"),
    proposal_status: pickString(obj?.proposal_status || obj?.status, "draft") as OrgMemoryProposal["proposal_status"],
    risk_level: pickString(obj?.risk_level, "low") as OrgMemoryProposal["risk_level"],
    summary: pickString(obj?.summary, ""),
    impact_summary: pickString(obj?.impact_summary, ""),
    created_at: pickString(obj?.created_at, new Date().toISOString()),
    submitted_at: pickNullableString(obj?.submitted_at),
    structure_changes: asArray(obj?.structure_changes).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        change_type: pickString(entryObj?.change_type, "create") as OrgMemoryProposal["structure_changes"][number]["change_type"],
        target_path: pickString(entryObj?.target_path, "/"),
        dept_scope: pickString(entryObj?.dept_scope, "未指定"),
        rationale: pickString(entryObj?.rationale, ""),
        confidence_score: pickNumber(entryObj?.confidence_score, 0),
      };
    }),
    classification_rules: asArray(obj?.classification_rules).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        target_scope: pickString(entryObj?.target_scope, "未命名范围"),
        match_signals: asArray(entryObj?.match_signals).map((value) => pickString(value)).filter(Boolean),
        default_folder_path: pickString(entryObj?.default_folder_path, "/"),
        origin_scope: pickString(entryObj?.origin_scope, "department") as OrgMemoryProposal["classification_rules"][number]["origin_scope"],
        allowed_scope: pickString(entryObj?.allowed_scope, "department") as OrgMemoryProposal["classification_rules"][number]["allowed_scope"],
        usage_purpose: pickString(entryObj?.usage_purpose, "knowledge_reuse") as OrgMemoryProposal["classification_rules"][number]["usage_purpose"],
        redaction_mode: pickString(entryObj?.redaction_mode, "summary") as OrgMemoryProposal["classification_rules"][number]["redaction_mode"],
        rationale: pickString(entryObj?.rationale, ""),
      };
    }),
    skill_mounts: asArray(obj?.skill_mounts).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        skill_id: pickNumber(entryObj?.skill_id),
        skill_name: pickString(entryObj?.skill_name, "未命名 Skill"),
        target_scope: pickString(entryObj?.target_scope, "未指定知识域"),
        required_domains: asArray(entryObj?.required_domains).map((value) => pickString(value)).filter(Boolean),
        max_allowed_scope: pickString(entryObj?.max_allowed_scope, "department") as OrgMemoryProposal["skill_mounts"][number]["max_allowed_scope"],
        required_redaction_mode: pickString(entryObj?.required_redaction_mode, "summary") as OrgMemoryProposal["skill_mounts"][number]["required_redaction_mode"],
        decision: pickString(entryObj?.decision, "allow") as OrgMemoryProposal["skill_mounts"][number]["decision"],
        rationale: pickString(entryObj?.rationale, ""),
      };
    }),
    approval_impacts: asArray(obj?.approval_impacts).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        impact_type: pickString(entryObj?.impact_type, "unknown"),
        target_asset_name: pickString(entryObj?.target_asset_name, "未命名资产"),
        risk_reason: pickString(entryObj?.risk_reason, ""),
        requires_manual_approval: pickBoolean(entryObj?.requires_manual_approval, false),
      };
    }),
    evidence_refs: asArray(obj?.evidence_refs).map(normalizeEvidenceRef),
    applied_config: appliedConfigObj
      ? {
          id: pickNumber(appliedConfigObj.id),
          proposal_id: pickNumber(appliedConfigObj.proposal_id),
          approval_request_id: pickNumber(appliedConfigObj.approval_request_id),
          status: pickString(appliedConfigObj.status, "effective") as "effective" | "effective_with_conditions",
          applied_at: pickString(appliedConfigObj.applied_at, new Date().toISOString()),
          knowledge_paths: asArray(appliedConfigObj.knowledge_paths).map((value) => pickString(value)).filter(Boolean),
          classification_rule_count: pickNumber(appliedConfigObj.classification_rule_count),
          skill_mount_count: pickNumber(appliedConfigObj.skill_mount_count),
          conditions: asArray(appliedConfigObj.conditions),
        }
      : null,
  };
}

function normalizeGovernanceVersion(item: unknown): OrgMemoryGovernanceVersion {
  const obj = asObject(item);
  return {
    id: pickNumber(obj?.id),
    derived_from_snapshot_id: pickNumber(obj?.derived_from_snapshot_id || obj?.snapshot_id),
    derived_from_snapshot_version: pickString(obj?.derived_from_snapshot_version || obj?.snapshot_version, "snapshot"),
    version: pickNumber(obj?.version, 1),
    status: pickString(obj?.status, "draft") as OrgMemoryGovernanceVersion["status"],
    summary: pickString(obj?.summary, ""),
    impact_summary: pickString(obj?.impact_summary, ""),
    knowledge_bases: asArray(obj?.knowledge_bases).map((value) => pickString(value)).filter(Boolean),
    data_tables: asArray(obj?.data_tables).map((value) => pickString(value)).filter(Boolean),
    affected_skills: asArray(obj?.affected_skills).map((entry) => {
      const entryObj = asObject(entry);
      return {
        skill_id: pickNumber(entryObj?.skill_id),
        skill_name: pickString(entryObj?.skill_name, "未命名 Skill"),
      };
    }),
    skill_access_rules: asArray(obj?.skill_access_rules).map((entry) => {
      const entryObj = asObject(entry);
      return {
        id: pickNumber(entryObj?.id),
        skill_id: pickNumber(entryObj?.skill_id),
        skill_name: pickString(entryObj?.skill_name, "未命名 Skill"),
        knowledge_bases: asArray(entryObj?.knowledge_bases).map((value) => pickString(value)).filter(Boolean),
        data_tables: asArray(entryObj?.data_tables).map((value) => pickString(value)).filter(Boolean),
        access_scope: pickString(entryObj?.access_scope, "department") as OrgMemoryGovernanceVersion["skill_access_rules"][number]["access_scope"],
        redaction_mode: pickString(entryObj?.redaction_mode, "summary") as OrgMemoryGovernanceVersion["skill_access_rules"][number]["redaction_mode"],
        decision: pickString(entryObj?.decision, "allow") as OrgMemoryGovernanceVersion["skill_access_rules"][number]["decision"],
        rationale: pickString(entryObj?.rationale, ""),
        required_domains: asArray(entryObj?.required_domains).map((value) => pickString(value)).filter(Boolean),
      };
    }),
    created_at: pickString(obj?.created_at, new Date().toISOString()),
    activated_at: pickNullableString(obj?.activated_at),
  };
}

function normalizeProposalSubmitResult(
  proposalId: number,
  payload: unknown,
): OrgMemoryProposalSubmitResult {
  const obj = asObject(payload);
  const data = asObject(obj?.data);
  const result = data || obj;
  return {
    proposal_id: pickNumber(result?.proposal_id, proposalId),
    approval_request_id: (() => {
      const value = result?.approval_request_id ?? result?.approval_id ?? result?.request_id ?? result?.id;
      const parsed = pickNumber(value, 0);
      return parsed > 0 ? parsed : null;
    })(),
    status: pickString(result?.status, "submitted"),
    message: pickNullableString(result?.message),
  };
}

function normalizeSnapshotDiff(payload: unknown): OrgMemorySnapshotDiff {
  const obj = asObject(payload);
  const makeBucket = (value: unknown): OrgMemorySnapshotDiff["units"] => {
    const bucket = asObject(value);
    return {
      added: asArray(bucket?.added).map((item) => pickString(item)).filter(Boolean),
      removed: asArray(bucket?.removed).map((item) => pickString(item)).filter(Boolean),
    };
  };

  return {
    snapshot_id: pickNumber(obj?.snapshot_id),
    snapshot_version: pickString(obj?.snapshot_version, "snapshot"),
    previous_snapshot_id: (() => {
      const value = pickNumber(obj?.previous_snapshot_id, 0);
      return value > 0 ? value : null;
    })(),
    previous_snapshot_version: pickNullableString(obj?.previous_snapshot_version),
    summary: pickString(obj?.summary, "暂无差异摘要"),
    units: makeBucket(obj?.units),
    roles: makeBucket(obj?.roles),
    people: makeBucket(obj?.people),
    okrs: makeBucket(obj?.okrs),
    processes: makeBucket(obj?.processes),
  };
}

function normalizeAppliedConfigVersion(item: unknown): OrgMemoryAppliedConfigVersion {
  const obj = asObject(item);
  return {
    id: pickNumber(obj?.id),
    proposal_id: pickNumber(obj?.proposal_id),
    approval_request_id: pickNumber(obj?.approval_request_id),
    status: pickString(obj?.status, "effective") as "effective" | "effective_with_conditions",
    applied_at: pickString(obj?.applied_at, new Date().toISOString()),
    knowledge_paths: asArray(obj?.knowledge_paths).map((value) => pickString(value)).filter(Boolean),
    classification_rule_count: pickNumber(obj?.classification_rule_count),
    skill_mount_count: pickNumber(obj?.skill_mount_count),
    conditions: asArray(obj?.conditions),
    version: pickNumber(obj?.version),
    action: pickString(obj?.action, "apply") as "apply" | "rollback",
    note: pickNullableString(obj?.note),
  };
}

async function withFallback<T>(
  request: () => Promise<T>,
  fallbackData: T,
): Promise<OrgMemoryLoadResult<T>> {
  try {
    const data = await request();
    return { data, fallback: false };
  } catch (error) {
    if (!shouldEnableOrgMemoryClientFallback()) {
      throw error instanceof Error ? error : new Error("组织 Memory 真实后端暂不可用");
    }
    return { data: fallbackData, fallback: true };
  }
}

export function loadOrgMemorySources() {
  return withFallback(
    async () => extractItems(await apiFetch<unknown>("/org-memory/sources"), normalizeSource),
    MOCK_ORG_MEMORY_SOURCES,
  );
}

export function loadOrgMemorySnapshots() {
  return withFallback(
    async () => extractItems(await apiFetch<unknown>("/org-memory/snapshots"), normalizeSnapshot),
    MOCK_ORG_MEMORY_SNAPSHOTS,
  );
}

export function loadOrgMemoryProposals() {
  return withFallback(
    async () => extractItems(await apiFetch<unknown>("/org-memory/proposals"), normalizeProposal),
    MOCK_ORG_MEMORY_PROPOSALS,
  );
}

export function loadOrgMemoryGovernanceVersions() {
  return withFallback(
    async () => extractItems(await apiFetch<unknown>("/org-memory/governance-versions"), normalizeGovernanceVersion),
    MOCK_ORG_MEMORY_GOVERNANCE_VERSIONS,
  );
}

export async function loadOrgMemoryOverviewData(): Promise<
  OrgMemoryLoadResult<{
    sources: OrgMemorySource[];
    proposals: OrgMemoryProposal[];
  }>
> {
  const [sourcesResult, proposalsResult] = await Promise.all([
    loadOrgMemorySources(),
    loadOrgMemoryProposals(),
  ]);
  return {
    data: {
      sources: sourcesResult.data,
      proposals: proposalsResult.data,
    },
    fallback: sourcesResult.fallback || proposalsResult.fallback,
  };
}

export function submitOrgMemoryProposal(proposalId: number) {
  return apiFetch<unknown>(`/org-memory/proposals/${proposalId}/submit`, {
    method: "POST",
  }).then((payload) => normalizeProposalSubmitResult(proposalId, payload));
}

export function ingestOrgMemorySource(payload: {
  source_type: OrgMemorySource["source_type"];
  source_uri: string;
  title: string;
  owner_name?: string;
  bitable_app_token?: string;
  bitable_table_id?: string;
  raw_fields?: { name: string; type: number; nullable: boolean; comment: string }[];
  raw_records?: Record<string, unknown>[];
}) {
  return apiFetch<OrgMemorySourceIngestResult>("/org-memory/sources/ingest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function uploadOrgMemorySource(file: File, title?: string, ownerName?: string) {
  const form = new FormData();
  form.append("file", file);
  if (title) form.append("title", title);
  if (ownerName) form.append("owner_name", ownerName);
  return apiFetch<OrgMemorySourceIngestResult>("/org-memory/sources/upload", {
    method: "POST",
    body: form,
  });
}

export function deleteOrgMemorySource(sourceId: number) {
  return apiFetch<{ ok: boolean }>(`/org-memory/sources/${sourceId}`, {
    method: "DELETE",
  });
}

export function batchCreateSnapshots(sourceIds: number[]) {
  return apiFetch<{
    snapshots: { snapshot_id: number; source_id: number; status: string }[];
  }>("/org-memory/sources/batch-snapshot", {
    method: "POST",
    body: JSON.stringify({ source_ids: sourceIds }),
  });
}

export function createOrgMemorySnapshot(sourceId: number) {
  return apiFetch<OrgMemorySnapshotCreateResult>(`/org-memory/sources/${sourceId}/snapshots`, {
    method: "POST",
  });
}

export function createOrgMemoryProposal(snapshotId: number) {
  return apiFetch<OrgMemoryProposalCreateResult>(`/org-memory/snapshots/${snapshotId}/proposals`, {
    method: "POST",
  });
}

export function loadOrgMemoryProposalDetail(proposalId: number) {
  return apiFetch<unknown>(`/org-memory/proposals/${proposalId}`).then((payload) => normalizeProposal(payload));
}

export function loadOrgMemorySnapshotDiff(snapshotId: number) {
  return apiFetch<unknown>(`/org-memory/snapshots/${snapshotId}/diff`).then((payload) => normalizeSnapshotDiff(payload));
}

export async function loadOrgMemorySnapshotGovernanceVersion(snapshotId: number): Promise<OrgMemoryLoadResult<OrgMemoryGovernanceVersion | null>> {
  try {
    const payload = await apiFetch<unknown>(`/org-memory/snapshots/${snapshotId}/governance-version`);
    return { data: normalizeGovernanceVersion(payload), fallback: false };
  } catch (error) {
    if (!shouldEnableOrgMemoryClientFallback()) {
      throw error instanceof Error ? error : new Error("治理版本加载失败");
    }
    const fallback = MOCK_ORG_MEMORY_GOVERNANCE_VERSIONS.find((item) => item.derived_from_snapshot_id === snapshotId) || null;
    return { data: fallback, fallback: true };
  }
}

export async function loadWorkspaceSnapshotGovernanceVersion(snapshotId: number): Promise<OrgMemoryLoadResult<OrgMemoryGovernanceVersion | null>> {
  try {
    const payload = await apiFetch<unknown>(`/org-memory/workspace-snapshots/${snapshotId}/governance-version`);
    return { data: normalizeGovernanceVersion(payload), fallback: false };
  } catch (error) {
    if (!shouldEnableOrgMemoryClientFallback()) {
      throw error instanceof Error ? error : new Error("工作台治理版本加载失败");
    }
    return { data: null, fallback: true };
  }
}

export async function loadCurrentOrgMemoryGovernanceVersion(): Promise<OrgMemoryLoadResult<OrgMemoryGovernanceVersion | null>> {
  try {
    const payload = await apiFetch<unknown>("/org-memory/governance-versions/current");
    return { data: normalizeGovernanceVersion(payload), fallback: false };
  } catch (error) {
    if (!shouldEnableOrgMemoryClientFallback()) {
      throw error instanceof Error ? error : new Error("当前治理版本加载失败");
    }
    const fallback = MOCK_ORG_MEMORY_GOVERNANCE_VERSIONS.find((item) => item.status === "effective") || null;
    return { data: fallback, fallback: true };
  }
}

export function refreshOrgMemoryGovernanceVersion(snapshotId: number) {
  return apiFetch<OrgMemoryGovernanceVersionRefreshResult>(`/org-memory/snapshots/${snapshotId}/governance-version`, {
    method: "POST",
  });
}

export function activateOrgMemoryGovernanceVersion(governanceVersionId: number) {
  return apiFetch<OrgMemoryGovernanceVersionActionResult>(`/org-memory/governance-versions/${governanceVersionId}/activate`, {
    method: "POST",
  });
}

export function rollbackOrgMemoryGovernanceVersion(governanceVersionId: number) {
  return apiFetch<OrgMemoryGovernanceVersionActionResult>(`/org-memory/governance-versions/${governanceVersionId}/rollback`, {
    method: "POST",
  });
}

export function loadOrgMemoryConfigVersions(proposalId: number) {
  return apiFetch<unknown>(`/org-memory/proposals/${proposalId}/config-versions`)
    .then((payload) => extractItems(payload, normalizeAppliedConfigVersion));
}

export function rollbackOrgMemoryProposalConfig(proposalId: number) {
  return apiFetch<OrgMemoryRollbackResult>(`/org-memory/proposals/${proposalId}/rollback`, {
    method: "POST",
  });
}

// ─── 组织治理快照工作台 API ───────────────────────────────────────────────────

export const SNAPSHOT_SCOPE_LABELS: Record<string, string> = {
  full: "全量快照",
  single_tab: "单类快照",
  current_tab_only: "仅当前 Tab",
};

export const SNAPSHOT_RUN_STATUS_LABELS: Record<string, string> = {
  idle: "空闲",
  queued: "排队中",
  running: "生成中",
  needs_input: "需补充信息",
  ready_for_review: "待审阅",
  synced: "已同步",
  partial_sync: "部分同步",
  failed: "失败",
};

export const SNAPSHOT_RUN_STATUS_STYLES: Record<string, string> = {
  idle: "bg-slate-100 text-slate-700",
  queued: "bg-blue-100 text-blue-700",
  running: "bg-blue-100 text-blue-700",
  needs_input: "bg-amber-100 text-amber-700",
  ready_for_review: "bg-green-100 text-green-700",
  synced: "bg-green-100 text-green-700",
  partial_sync: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

const DEFAULT_WORKSPACE_SNAPSHOT_APP = "le-desk";
const DEFAULT_WORKSPACE_SNAPSHOT_ID = "org-management";
const DEFAULT_WORKSPACE_SNAPSHOT_TYPE = "workspace";
const SNAPSHOT_SYNC_SECTION = "structured";

function isSnapshotTabKey(value: unknown): value is SnapshotTabKey {
  return typeof value === "string" && value in {
    organization: true,
    department: true,
    role: true,
    person: true,
    okr: true,
    process: true,
  };
}

function normalizeWorkspaceSnapshotScope(value: unknown): SnapshotScopeOption {
  if (value === "all" || value === "full") return "full";
  if (value === "active_tab" || value === "current_tab_only") return "current_tab_only";
  if (isSnapshotTabKey(value) || value === "single_tab") return "single_tab";
  return "full";
}

function toBackendSnapshotScope(scope: SnapshotScopeOption, tabKey?: SnapshotTabKey): string {
  if (scope === "full") return "all";
  if (tabKey) return "active_tab";
  return "all";
}

function normalizeWorkspaceSnapshotStatus(value: unknown): WorkspaceSnapshotRunStatus {
  if (
    value === "idle"
    || value === "queued"
    || value === "running"
    || value === "needs_input"
    || value === "ready_for_review"
    || value === "synced"
    || value === "partial_sync"
    || value === "failed"
  ) {
    return value;
  }
  if (value === "reviewed") return "ready_for_review";
  return "idle";
}

function normalizeFailedSection(item: unknown): WorkspaceSnapshotFailedSection {
  const obj = asObject(item);
  return {
    section: pickString(obj?.section, "unknown"),
    reason: pickString(obj?.reason, "同步失败"),
  };
}

function normalizeMissingInputType(value: unknown): WorkspaceSnapshotMissingInputType {
  switch (value) {
    case "select":
    case "multi_select":
    case "boolean":
    case "user_select":
    case "department_select":
    case "role_select":
      return value;
    default:
      return "text";
  }
}

function normalizeMissingItem(item: unknown): WorkspaceSnapshotMissingItem {
  const obj = asObject(item);
  const fallbackFieldKey = pickString(obj?.label, "missing_item")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w\u4e00-\u9fa5]/g, "") || "missing_item";
  const fieldKey = pickString(obj?.field_key || obj?.field, fallbackFieldKey);
  const options = asArray(obj?.options).map((entry, index) => {
    const optionObj = asObject(entry);
    const value = pickString(optionObj?.value, pickString(optionObj?.id, `option_${index + 1}`));
    return {
      value,
      label: pickString(optionObj?.label, value || `选项 ${index + 1}`),
    };
  });
  return {
    id: pickString(obj?.id, fieldKey),
    field_key: fieldKey,
    label: pickString(obj?.label, fieldKey || "补充信息"),
    description: pickString(obj?.description || obj?.reason || obj?.impact, ""),
    input_type: normalizeMissingInputType(obj?.input_type || obj?.suggested_input_type),
    options: options.length > 0 ? options : undefined,
    required: pickBoolean(obj?.required, false),
    default_value: obj?.default_value as string | string[] | boolean | undefined,
    raw: obj ?? undefined,
  };
}

function normalizeWorkspaceSnapshotConflict(item: unknown): WorkspaceSnapshotConflict {
  const obj = asObject(item);
  const severity = obj?.severity === "high" || obj?.severity === "medium" || obj?.severity === "low"
    ? obj.severity
    : "medium";
  return {
    id: pickString(obj?.id, `${pickString(obj?.entity_name, "entity")}:${pickString(obj?.field, "field")}`),
    entity_type: isSnapshotTabKey(obj?.entity_type) ? obj.entity_type : "organization",
    entity_name: pickString(obj?.entity_name, "未命名对象"),
    field: pickString(obj?.field, "unknown"),
    current_value: pickString(obj?.current_value || obj?.before, ""),
    new_value: pickString(obj?.new_value || obj?.after, ""),
    source_label: pickString(obj?.source_label || obj?.source, ""),
    severity,
  };
}

function normalizeAggregateSyncStatus(value: unknown): WorkspaceSnapshotAggregateSyncStatus | null {
  const obj = asObject(value);
  if (!obj) return null;
  return {
    markdown_saved: pickBoolean(obj?.markdown_saved, false),
    structured_updated: pickBoolean(obj?.structured_updated, false),
    failed_sections: asArray(obj?.failed_sections).map(normalizeFailedSection),
    parser_warnings: asArray(obj?.parser_warnings).map((item) => pickString(item)).filter(Boolean),
  };
}

function normalizeWorkspaceSnapshotSummary(item: unknown): WorkspaceSnapshotSummary {
  const obj = asObject(item);
  return {
    id: pickNumber(obj?.id),
    workspace_id: pickNullableString(obj?.workspace_id),
    workspace_type: pickNullableString(obj?.workspace_type),
    app: pickNullableString(obj?.app),
    title: pickString(obj?.title, "组织治理快照"),
    source_snapshot_id: typeof obj?.source_snapshot_id === "number" ? obj.source_snapshot_id : null,
    legacy_snapshot_id: typeof obj?.legacy_snapshot_id === "number" ? obj.legacy_snapshot_id : null,
    version: pickString(obj?.version, "snapshot"),
    scope: normalizeWorkspaceSnapshotScope(obj?.scope),
    status: normalizeWorkspaceSnapshotStatus(obj?.status),
    confidence_score: pickNumber(obj?.confidence_score, 0),
    missing_count: pickNumber(obj?.missing_count, 0),
    conflict_count: pickNumber(obj?.conflict_count, 0),
    created_at: pickString(obj?.created_at, new Date().toISOString()),
    updated_at: pickString(obj?.updated_at, new Date().toISOString()),
  };
}

function normalizeWorkspaceSnapshotDetail(item: unknown): WorkspaceSnapshotDetail {
  const obj = asObject(item);
  const markdownByTab = asObject(obj?.markdown_by_tab) || {};
  const structuredByTab = asObject(obj?.structured_by_tab) || {};
  const governanceOutputs = asObject(obj?.governance_outputs) || {};
  const lowConfidenceItems = asArray(obj?.low_confidence_items).map((entry) => {
    const entryObj = asObject(entry);
    return {
      label: pickString(entryObj?.label, "未命名项"),
      reason: pickString(entryObj?.reason, ""),
      tab_key: isSnapshotTabKey(entryObj?.tab_key) ? entryObj.tab_key : undefined,
    };
  });
  const separationOfDutyRisks = asArray(obj?.separation_of_duty_risks).map((entry) => {
    const entryObj = asObject(entry);
    const severity: "high" | "medium" | "low" = entryObj?.severity === "high" || entryObj?.severity === "medium" || entryObj?.severity === "low"
      ? entryObj.severity
      : "medium";
    return {
      description: pickString(entryObj?.description, "未命名风险"),
      severity,
      entities: asArray(entryObj?.entities).map((entity) => pickString(entity)).filter(Boolean),
    };
  });

  return {
    id: pickNumber(obj?.id),
    workspace_id: pickNullableString(obj?.workspace_id),
    workspace_type: pickNullableString(obj?.workspace_type),
    app: pickNullableString(obj?.app),
    title: pickString(obj?.title, "组织治理快照"),
    source_snapshot_id: typeof obj?.source_snapshot_id === "number" ? obj.source_snapshot_id : null,
    base_snapshot_id: typeof obj?.base_snapshot_id === "number" ? obj.base_snapshot_id : null,
    legacy_snapshot_id: typeof obj?.legacy_snapshot_id === "number" ? obj.legacy_snapshot_id : null,
    version: pickString(obj?.version, "snapshot"),
    scope: normalizeWorkspaceSnapshotScope(obj?.scope),
    status: normalizeWorkspaceSnapshotStatus(obj?.status),
    confidence_score: pickNumber(obj?.confidence_score, 0),
    created_at: pickString(obj?.created_at, new Date().toISOString()),
    updated_at: pickString(obj?.updated_at, new Date().toISOString()),
    markdown_by_tab: Object.fromEntries(
      Object.entries(markdownByTab).filter(([key]) => isSnapshotTabKey(key)).map(([key, value]) => [key, pickString(value)]),
    ) as Partial<Record<SnapshotTabKey, string>>,
    structured_by_tab: Object.fromEntries(
      Object.entries(structuredByTab)
        .filter(([key, value]) => isSnapshotTabKey(key) && typeof value === "object" && value !== null)
        .map(([key, value]) => [key, value as Record<string, unknown>]),
    ) as Partial<Record<SnapshotTabKey, Record<string, unknown>>>,
    governance_outputs: {
      authority_map: asArray(governanceOutputs.authority_map).map((entry) => asObject(entry) || {}).filter((entry) => Object.keys(entry).length > 0),
      resource_access_matrix: asArray(governanceOutputs.resource_access_matrix).map((entry) => asObject(entry) || {}).filter((entry) => Object.keys(entry).length > 0),
      approval_route_candidates: asArray(governanceOutputs.approval_route_candidates).map((entry) => asObject(entry) || {}).filter((entry) => Object.keys(entry).length > 0),
      policy_hints: asArray(governanceOutputs.policy_hints).map((entry) => asObject(entry) || {}).filter((entry) => Object.keys(entry).length > 0),
    },
    missing_items: asArray(obj?.missing_items).map(normalizeMissingItem),
    conflicts: asArray(obj?.conflicts).map(normalizeWorkspaceSnapshotConflict),
    low_confidence_items: lowConfidenceItems,
    separation_of_duty_risks: separationOfDutyRisks,
    change_summary: asObject(obj?.change_summary),
    sync_status: normalizeAggregateSyncStatus(obj?.sync_status),
  };
}

function normalizeWorkspaceSnapshotEventResult(item: unknown): WorkspaceSnapshotEventResult {
  const obj = asObject(item);
  return {
    run_id: pickString(obj?.run_id),
    snapshot_id: pickNumber(obj?.snapshot_id ?? obj?.id, 0) || null,
    status: normalizeWorkspaceSnapshotStatus(obj?.status),
    missing_items: asArray(obj?.missing_items).map(normalizeMissingItem),
    error: pickNullableString(obj?.error || obj?.error_message) || undefined,
  };
}

function normalizeWorkspaceSnapshotRun(item: unknown): WorkspaceSnapshotRunDetail {
  const obj = asObject(item);
  const responseSummary = asObject(obj?.response_summary);
  const normalizedStatus = normalizeWorkspaceSnapshotStatus(
    obj?.status === "completed"
      ? responseSummary?.status
      : obj?.status,
  );
  return {
    run_id: pickString(obj?.run_id),
    snapshot_id: pickNumber(obj?.snapshot_id ?? responseSummary?.snapshot_id, 0) || null,
    event_type: pickNullableString(obj?.event_type) || undefined,
    status: normalizedStatus,
    message: pickNullableString(obj?.message || responseSummary?.message) || undefined,
    error: pickNullableString(obj?.error || obj?.error_message) || undefined,
    error_message: pickNullableString(obj?.error_message),
    workspace_id: pickNullableString(obj?.workspace_id) || undefined,
    workspace_type: pickNullableString(obj?.workspace_type) || undefined,
    app: pickNullableString(obj?.app) || undefined,
    response_summary: responseSummary,
    created_at: pickNullableString(obj?.created_at),
    updated_at: pickNullableString(obj?.updated_at),
    completed_at: pickNullableString(obj?.completed_at),
  };
}

function normalizeWorkspaceSnapshotTabSyncResult(
  tabKey: SnapshotTabKey,
  payload: unknown,
): WorkspaceSnapshotTabSyncResult {
  const detail = normalizeWorkspaceSnapshotDetail(payload);
  const syncStatus = normalizeAggregateSyncStatus(asObject(payload)?.sync_status) ?? {
    markdown_saved: true,
    structured_updated: detail.status === "synced",
    failed_sections: [],
    parser_warnings: [],
  };
  const status: WorkspaceSnapshotTabSyncResult["status"] =
    detail.status === "synced"
      ? "synced"
      : detail.status === "partial_sync"
        ? "partial_sync"
        : "failed";
  return {
    tab_key: tabKey,
    status,
    synced_sections: syncStatus.structured_updated ? [SNAPSHOT_SYNC_SECTION] : [],
    failed_sections: syncStatus.failed_sections,
    parser_warnings: syncStatus.parser_warnings,
    detail,
    error: status === "failed" ? "同步失败" : undefined,
  };
}

/** 8.1 事件入口 — 生成/更新快照 */
export function createWorkspaceSnapshotEvent(
  payload: WorkspaceSnapshotEventPayload,
) {
  const requestPayload = {
    event_type: payload.event_type,
    workspace: {
      app: payload.app || DEFAULT_WORKSPACE_SNAPSHOT_APP,
      workspace_id: payload.workspace_id || DEFAULT_WORKSPACE_SNAPSHOT_ID,
      workspace_type: payload.workspace_type || DEFAULT_WORKSPACE_SNAPSHOT_TYPE,
    },
    snapshot: {
      scope: toBackendSnapshotScope(payload.scope, payload.tab_key),
      active_tab: payload.tab_key,
      snapshot_id: payload.snapshot_id,
      base_snapshot_id: payload.base_snapshot_id ?? undefined,
      source_snapshot_id: payload.source_snapshot_id ?? undefined,
      title: payload.title,
    },
    sources: {
      source_ids: payload.source_ids ?? [],
    },
    editor: {
      existing_markdown_by_tab: payload.existing_markdown_by_tab ?? {},
      tab_key: payload.tab_key,
    },
    form: payload.missing_item_answers ?? {},
    options: {
      preserve_existing_structured_on_parse_failure: payload.preserve_existing_structured_on_parse_failure ?? true,
    },
  };
  return apiFetch<unknown>("/org-memory/workspace-snapshot-events", {
    method: "POST",
    body: JSON.stringify(requestPayload),
  }).then((response) => normalizeWorkspaceSnapshotEventResult(response));
}

/** 8.2 版本列表 */
export function loadWorkspaceSnapshots(params?: {
  workspace_id?: string;
  app?: string;
}) {
  const query = new URLSearchParams();
  if (params?.workspace_id) query.set("workspace_id", params.workspace_id);
  if (params?.app) query.set("app", params.app);
  const qs = query.toString();
  return apiFetch<unknown>(
    `/org-memory/workspace-snapshots${qs ? `?${qs}` : ""}`,
  ).then((payload) => extractItems(payload, normalizeWorkspaceSnapshotSummary));
}

/** 8.3 快照详情 */
export function loadWorkspaceSnapshotDetail(snapshotId: number) {
  return apiFetch<unknown>(
    `/org-memory/workspace-snapshots/${snapshotId}`,
  ).then((payload) => normalizeWorkspaceSnapshotDetail(payload));
}

/** 8.4 单 Tab 保存 Markdown */
export function saveWorkspaceSnapshotTabMarkdown(
  snapshotId: number,
  tabKey: SnapshotTabKey,
  markdown: string,
) {
  return apiFetch<unknown>(
    `/org-memory/workspace-snapshots/${snapshotId}/tabs/${tabKey}/markdown`,
    { method: "PUT", body: JSON.stringify({ markdown }) },
  ).then((payload) => normalizeWorkspaceSnapshotTabSyncResult(tabKey, payload));
}

/** 8.5 全量同步 */
export function syncWorkspaceSnapshot(snapshotId: number) {
  return apiFetch<unknown>(`/org-memory/workspace-snapshots/${snapshotId}/sync`, { method: "POST" })
    .then((payload) => {
      const detail = normalizeWorkspaceSnapshotDetail(payload);
      return {
        status: detail.status as WorkspaceSnapshotRunStatus,
        sync_status: detail.sync_status as WorkspaceSnapshotAggregateSyncStatus | null,
        detail,
      };
    });
}

/** 8.6 查询运行状态 */
export function loadWorkspaceSnapshotRun(runId: string) {
  return apiFetch<unknown>(
    `/org-memory/workspace-snapshot-runs/${runId}`,
  ).then((payload) => normalizeWorkspaceSnapshotRun(payload));
}
