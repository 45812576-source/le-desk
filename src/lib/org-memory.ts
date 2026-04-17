"use client";

import { apiFetch } from "@/lib/api";
import type {
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
} from "@/lib/types";
import {
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
}) {
  return apiFetch<OrgMemorySourceIngestResult>("/org-memory/sources/ingest", {
    method: "POST",
    body: JSON.stringify(payload),
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

export function loadOrgMemoryConfigVersions(proposalId: number) {
  return apiFetch<unknown>(`/org-memory/proposals/${proposalId}/config-versions`)
    .then((payload) => extractItems(payload, normalizeAppliedConfigVersion));
}

export function rollbackOrgMemoryProposalConfig(proposalId: number) {
  return apiFetch<OrgMemoryRollbackResult>(`/org-memory/proposals/${proposalId}/rollback`, {
    method: "POST",
  });
}
