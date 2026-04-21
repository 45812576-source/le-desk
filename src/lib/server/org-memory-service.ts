import { FALLBACK_APPROVAL_TEMPLATES } from "@/lib/approval-templates";
import {
  createRemoteOrgMemoryApproval,
  readOrgMemoryApprovalAdapterConfig,
} from "@/lib/server/org-memory-approval-adapter";
import {
  applyProposalToFormalConfig,
  rollbackFormalConfigForProposal,
} from "@/lib/server/org-memory-config-writer";
import {
  readOrgMemoryState,
  type OrgMemoryApprovalLink,
  resetOrgMemoryPersistentState,
  updateOrgMemoryState,
} from "@/lib/server/org-memory-db";
import {
  clone,
  findApproval,
  findApprovalByProposalId,
  findGovernanceVersion,
  findGovernanceVersionBySnapshotId,
  findApprovalLinkByProposalId,
  findApprovalLinkByRequestId,
  findProposal,
  findSnapshot,
  findSource,
  getConfigVersions,
  listApprovals,
  listGovernanceVersions,
  listProposals,
  listSnapshots,
  listSources,
  nextId,
  prependGovernanceVersion,
  prependProposal,
  prependSnapshot,
  prependSource,
  setConfigVersions,
  upsertApproval,
  upsertApprovalLink,
} from "@/lib/server/org-memory-repository";
import type {
  ApprovalAction,
  ApprovalRequest,
  OrgMemoryAppliedConfig,
  OrgMemoryAppliedConfigVersion,
  OrgMemoryGovernanceVersion,
  OrgMemoryGovernanceVersionActionResult,
  OrgMemoryGovernanceVersionRefreshResult,
  OrgMemoryProposal,
  OrgMemoryProposalCreateResult,
  OrgMemoryProposalSubmitResult,
  OrgMemoryRollbackResult,
  OrgMemorySnapshot,
  OrgMemorySnapshotCreateResult,
  OrgMemorySnapshotDiff,
  OrgMemorySource,
  OrgMemorySourceIngestResult,
} from "@/lib/types";

export type ApiResult = {
  body: unknown;
  status?: number;
};

type AdminApprovalResponse = {
  total: number;
  page: number;
  page_size: number;
  items: ApprovalRequest[];
};

export type OrgMemoryRequestContext = {
  authorization?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function extractProposalId(path: string, suffix: string) {
  const match = path.match(new RegExp(`^/org-memory/proposals/(\\d+)${suffix}$`));
  if (!match) return null;
  return Number(match[1]);
}

function extractSourceId(path: string, suffix: string) {
  const match = path.match(new RegExp(`^/org-memory/sources/(\\d+)${suffix}$`));
  if (!match) return null;
  return Number(match[1]);
}

function extractSnapshotId(path: string, suffix: string) {
  const match = path.match(new RegExp(`^/org-memory/snapshots/(\\d+)${suffix}$`));
  if (!match) return null;
  return Number(match[1]);
}

function extractGovernanceVersionId(path: string, suffix: string) {
  const match = path.match(new RegExp(`^/org-memory/governance-versions/(\\d+)${suffix}$`));
  if (!match) return null;
  return Number(match[1]);
}

function compactDate() {
  return new Date().toISOString().slice(0, 10);
}

function pickString(payload: Record<string, unknown>, key: string, fallback: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isSourceType(value: string): value is OrgMemorySource["source_type"] {
  return ["feishu_doc", "notion", "markdown", "upload"].includes(value);
}

function nextApprovalId(proposalId: number) {
  return 900000 + proposalId;
}

function normalizeApprovalRequestStatus(status: string | null | undefined): ApprovalRequest["status"] {
  if (status === "approved" || status === "rejected" || status === "conditions" || status === "withdrawn") {
    return status;
  }
  return "pending";
}

function normalizeProposalStatusFromApprovalStatus(status: string | null | undefined): OrgMemoryProposal["proposal_status"] | null {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "conditions") return "partially_approved";
  if (status === "pending" || status === "needs_info") return "pending_approval";
  return null;
}

function makeEvidencePack(proposal: OrgMemoryProposal) {
  return {
    summary: proposal.summary,
    impact_summary: proposal.impact_summary,
    structure_changes: proposal.structure_changes,
    classification_rules: proposal.classification_rules,
    skill_mounts: proposal.skill_mounts,
    approval_impacts: proposal.approval_impacts,
    evidence_refs: proposal.evidence_refs,
  };
}

function createSource(stateSources: OrgMemorySource[], payload: Record<string, unknown>): OrgMemorySource {
  const id = nextId(stateSources);
  const sourceTypeValue = pickString(payload, "source_type", "markdown");
  const sourceType = isSourceType(sourceTypeValue) ? sourceTypeValue : "markdown";
  return {
    id,
    title: pickString(payload, "title", `组织 Memory 源文档 #${id}`),
    source_type: sourceType,
    source_uri: pickString(payload, "source_uri", `manual://org-memory/source-${id}`),
    owner_name: pickString(payload, "owner_name", "组织运营组"),
    external_version: `v${compactDate()}.${id}`,
    fetched_at: nowIso(),
    ingest_status: "processing",
    latest_snapshot_version: null,
    latest_parse_note: "源文档已导入，等待生成结构化快照。",
  };
}

function createSnapshot(stateSnapshots: OrgMemorySnapshot[], source: OrgMemorySource): OrgMemorySnapshot {
  const id = nextId(stateSnapshots);
  const base = stateSnapshots[0];
  const snapshotVersion = `snapshot-${compactDate()}-${String(id).padStart(2, "0")}`;
  const snapshot: OrgMemorySnapshot = {
    ...clone(base),
    id,
    source_id: source.id,
    source_title: source.title,
    snapshot_version: snapshotVersion,
    parse_status: "ready",
    confidence_score: source.source_type === "upload" ? 0.82 : 0.9,
    created_at: nowIso(),
    summary: `已从《${source.title}》抽取组织、岗位、人员、OKR 与流程对象，可继续生成统一草案。`,
    low_confidence_items: source.source_type === "upload"
      ? [
          {
            label: "上传文档格式差异",
            reason: "上传文件可能存在章节标题不一致，建议审批前复核证据链。",
          },
        ]
      : base.low_confidence_items,
  };
  source.ingest_status = "ready";
  source.fetched_at = nowIso();
  source.latest_snapshot_version = snapshotVersion;
  source.latest_parse_note = "已生成结构化快照，六类组织对象字段齐全。";
  return snapshot;
}

function createProposal(stateProposals: OrgMemoryProposal[], snapshot: OrgMemorySnapshot): OrgMemoryProposal {
  const id = nextId(stateProposals);
  return {
    id,
    snapshot_id: snapshot.id,
    title: `${snapshot.source_title} Memory 草案 #${id}`,
    proposal_status: "draft",
    risk_level: snapshot.low_confidence_items.length > 0 ? "medium" : "low",
    summary: `基于 ${snapshot.snapshot_version} 生成目录、分类规则、共享边界与 Skill 挂载建议。`,
    impact_summary: `涉及 ${Math.max(snapshot.entity_counts.units, 1)} 个组织域、${Math.max(snapshot.entity_counts.processes, 1)} 条流程相关规则。`,
    created_at: nowIso(),
    submitted_at: null,
    structure_changes: [
      {
        id: id * 10 + 1,
        change_type: "create",
        target_path: `/${snapshot.source_title}/组织治理/培训与复盘`,
        dept_scope: snapshot.units[0]?.name || "组织治理",
        rationale: "快照显示该组织域包含稳定职责、流程与复盘产物，适合作为知识库目录。",
        confidence_score: Math.min(snapshot.confidence_score, 0.95),
      },
    ],
    classification_rules: [
      {
        id: id * 10 + 2,
        target_scope: `${snapshot.source_title} 相关组织知识`,
        match_signals: ["组织职责", "岗位职责", "业务流程", "复盘材料"],
        default_folder_path: `/${snapshot.source_title}/组织治理/培训与复盘`,
        origin_scope: "manager_chain",
        allowed_scope: "department",
        usage_purpose: "knowledge_reuse",
        redaction_mode: "summary",
        rationale: "组织 Memory 只允许以摘要或匿名化形式进入部门共享知识域。",
      },
    ],
    skill_mounts: [
      {
        id: id * 10 + 3,
        skill_id: 402,
        skill_name: "销售复盘助手",
        target_scope: `${snapshot.source_title} 知识域`,
        required_domains: ["组织职责", "业务流程", "OKR"],
        max_allowed_scope: "department",
        required_redaction_mode: "summary",
        decision: "require_approval",
        rationale: "Skill 可消费组织摘要，但挂载到部门知识域前需要审批确认共享边界。",
      },
    ],
    approval_impacts: [
      {
        id: id * 10 + 4,
        impact_type: "org_memory.proposal.generated",
        target_asset_name: `${snapshot.source_title} 组织 Memory 草案`,
        risk_reason: "草案会影响知识目录、默认分类规则与 Skill 可用知识域。",
        requires_manual_approval: true,
      },
    ],
    evidence_refs: snapshot.units[0]?.evidence_refs?.length
      ? snapshot.units[0].evidence_refs
      : [
          {
            label: "快照摘要",
            section: snapshot.snapshot_version,
            excerpt: snapshot.summary,
          },
        ],
  };
}

function governanceTableName(snapshotId: number, suffix: string) {
  return `org_memory_snapshot_${snapshotId}_${suffix}`;
}

function createGovernanceVersion(
  stateGovernanceVersions: OrgMemoryGovernanceVersion[],
  snapshot: OrgMemorySnapshot,
): OrgMemoryGovernanceVersion {
  const id = nextId(stateGovernanceVersions);
  const version = Math.max(0, ...stateGovernanceVersions.map((item) => item.version)) + 1;
  const organizationPaths = snapshot.units
    .slice(0, 3)
    .map((unit) => {
      if (unit.unit_type === "org") return `/${unit.name}/资料与治理`;
      return `/${unit.parent_name || snapshot.source_title}/${unit.name}/资料与治理`;
    });
  const knowledgeBases = organizationPaths.length > 0
    ? Array.from(new Set(organizationPaths))
    : [`/${snapshot.source_title}/资料与治理`];
  const dataTables = [
    governanceTableName(snapshot.id, "knowledge_view"),
    ...(snapshot.low_confidence_items.length > 0 ? [governanceTableName(snapshot.id, "risk_view")] : []),
  ];
  const baseDecision: OrgMemoryGovernanceVersion["skill_access_rules"][number]["decision"] =
    snapshot.parse_status === "warning" || snapshot.low_confidence_items.length > 0
    ? "require_approval"
    : "allow";
  const baseRedactionMode: OrgMemoryGovernanceVersion["skill_access_rules"][number]["redaction_mode"] =
    snapshot.low_confidence_items.length > 0 ? "masked" : "summary";

  const affectedSkills = [
    snapshot.units.length > 0 || snapshot.people.length > 0
      ? { skill_id: 6100 + snapshot.id, skill_name: "组织事实助手" }
      : null,
    snapshot.okrs.length > 0
      ? { skill_id: 6200 + snapshot.id, skill_name: "OKR 对齐助手" }
      : null,
    snapshot.processes.length > 0
      ? { skill_id: 6300 + snapshot.id, skill_name: "流程问答助手" }
      : null,
  ].filter((item): item is { skill_id: number; skill_name: string } => Boolean(item));

  const skillAccessRules: OrgMemoryGovernanceVersion["skill_access_rules"] = affectedSkills.map((skill, index) => ({
    id: id * 10 + index + 1,
    skill_id: skill.skill_id,
    skill_name: skill.skill_name,
    knowledge_bases: knowledgeBases.slice(index === 0 ? 0 : Math.min(index - 1, knowledgeBases.length - 1), Math.min(index + 1, knowledgeBases.length)),
    data_tables: dataTables.slice(0, skill.skill_name === "组织事实助手" ? 1 : dataTables.length),
    access_scope: (snapshot.low_confidence_items.length > 0 ? "manager_chain" : "department") as OrgMemoryGovernanceVersion["skill_access_rules"][number]["access_scope"],
    redaction_mode: skill.skill_name === "组织事实助手" ? "summary" : baseRedactionMode,
    decision: baseDecision,
    rationale:
      skill.skill_name === "组织事实助手"
        ? "组织事实查询默认只消费结构化摘要，避免直接暴露原始组织资料。"
        : skill.skill_name === "OKR 对齐助手"
          ? "OKR 相关查询仅开放治理版本允许的知识库与表视图。"
          : "流程问答只能访问当前治理版本标注的流程知识与风险视图。",
    required_domains:
      skill.skill_name === "组织事实助手"
        ? ["组织职责", "岗位与人员"]
        : skill.skill_name === "OKR 对齐助手"
          ? ["OKR", "组织目标"]
          : ["业务流程", "风险点"],
  }));

  return {
    id,
    derived_from_snapshot_id: snapshot.id,
    derived_from_snapshot_version: snapshot.snapshot_version,
    version,
    status: "draft",
    summary: `已基于 ${snapshot.snapshot_version} 派生治理版本，供 Skill 统一按治理规则消费资料。`,
    impact_summary: `影响 ${affectedSkills.length} 个 Skill、${knowledgeBases.length} 个知识库、${dataTables.length} 张数据表。`,
    knowledge_bases: knowledgeBases,
    data_tables: dataTables,
    affected_skills: affectedSkills,
    skill_access_rules: skillAccessRules,
    created_at: nowIso(),
    activated_at: null,
  };
}

function findCurrentEffectiveGovernanceVersion(versions: OrgMemoryGovernanceVersion[]) {
  return [...versions]
    .filter((item) => item.status === "effective")
    .sort((left, right) => (right.activated_at || "").localeCompare(left.activated_at || ""))
    [0] || null;
}

function refreshGovernanceVersionForSnapshot(
  state: { governance_versions: OrgMemoryGovernanceVersion[] },
  snapshot: OrgMemorySnapshot,
) {
  state.governance_versions.forEach((item) => {
    if (item.derived_from_snapshot_id === snapshot.id && item.status === "draft") {
      item.status = "archived";
    }
  });
  const governanceVersion = createGovernanceVersion(state.governance_versions, snapshot);
  state.governance_versions.unshift(governanceVersion);
  return governanceVersion;
}

function syncGovernanceVersionForProposalApproval(
  state: { governance_versions: OrgMemoryGovernanceVersion[] },
  proposal: OrgMemoryProposal,
) {
  const governanceVersion = state.governance_versions.find((item) => item.derived_from_snapshot_id === proposal.snapshot_id) || null;
  if (!governanceVersion) return null;
  return activateGovernanceVersion(state, governanceVersion);
}

function syncGovernanceVersionForProposalRollback(
  state: { governance_versions: OrgMemoryGovernanceVersion[] },
  proposal: OrgMemoryProposal,
) {
  const governanceVersion = state.governance_versions.find((item) => item.derived_from_snapshot_id === proposal.snapshot_id) || null;
  if (!governanceVersion) return null;
  if (governanceVersion.status === "effective") {
    return rollbackGovernanceVersion(state, governanceVersion);
  }
  if (governanceVersion.status === "draft") {
    governanceVersion.status = "archived";
  }
  return null;
}

function activateGovernanceVersion(
  state: { governance_versions: OrgMemoryGovernanceVersion[] },
  governanceVersion: OrgMemoryGovernanceVersion,
): OrgMemoryGovernanceVersionActionResult {
  state.governance_versions.forEach((item) => {
    if (item.id !== governanceVersion.id && item.status === "effective") {
      item.status = "archived";
    }
  });
  governanceVersion.status = "effective";
  governanceVersion.activated_at = nowIso();
  return {
    governance_version_id: governanceVersion.id,
    status: governanceVersion.status,
    message: `治理版本 v${governanceVersion.version} 已生效`,
    current_effective_governance_version_id: governanceVersion.id,
  };
}

function rollbackGovernanceVersion(
  state: { governance_versions: OrgMemoryGovernanceVersion[] },
  governanceVersion: OrgMemoryGovernanceVersion,
): OrgMemoryGovernanceVersionActionResult | null {
  const previous = [...state.governance_versions]
    .filter((item) => item.id !== governanceVersion.id && item.activated_at)
    .sort((left, right) => (right.activated_at || "").localeCompare(left.activated_at || ""))
    [0] || null;
  if (!previous) return null;
  governanceVersion.status = "archived";
  previous.status = "effective";
  previous.activated_at = nowIso();
  return {
    governance_version_id: governanceVersion.id,
    status: governanceVersion.status,
    message: `已回滚到治理版本 v${previous.version}`,
    current_effective_governance_version_id: previous.id,
    rolled_back_to_governance_version_id: previous.id,
  };
}

function diffNames(current: string[], previous: string[]): { added: string[]; removed: string[] } {
  const previousSet = new Set(previous);
  const currentSet = new Set(current);
  return {
    added: current.filter((item) => !previousSet.has(item)),
    removed: previous.filter((item) => !currentSet.has(item)),
  };
}

function findPreviousSnapshot(snapshots: OrgMemorySnapshot[], snapshot: OrgMemorySnapshot) {
  const siblings = snapshots
    .filter((item) => item.source_id === snapshot.source_id)
    .sort((left, right) => (right.created_at || "").localeCompare(left.created_at || ""));
  const currentIndex = siblings.findIndex((item) => item.id === snapshot.id);
  return currentIndex >= 0 ? siblings[currentIndex + 1] || null : null;
}

function createSnapshotDiff(snapshots: OrgMemorySnapshot[], snapshot: OrgMemorySnapshot): OrgMemorySnapshotDiff {
  const previous = findPreviousSnapshot(snapshots, snapshot);
  if (!previous) {
    return {
      snapshot_id: snapshot.id,
      snapshot_version: snapshot.snapshot_version,
      previous_snapshot_id: null,
      previous_snapshot_version: null,
      summary: "当前快照是该源文档的首个版本，暂无可对比的上一版。",
      units: { added: snapshot.units.map((item) => item.name), removed: [] },
      roles: { added: snapshot.roles.map((item) => item.name), removed: [] },
      people: { added: snapshot.people.map((item) => item.name), removed: [] },
      okrs: { added: snapshot.okrs.map((item) => item.objective), removed: [] },
      processes: { added: snapshot.processes.map((item) => item.name), removed: [] },
    };
  }

  const units = diffNames(snapshot.units.map((item) => item.name), previous.units.map((item) => item.name));
  const roles = diffNames(snapshot.roles.map((item) => item.name), previous.roles.map((item) => item.name));
  const people = diffNames(snapshot.people.map((item) => item.name), previous.people.map((item) => item.name));
  const okrs = diffNames(snapshot.okrs.map((item) => item.objective), previous.okrs.map((item) => item.objective));
  const processes = diffNames(snapshot.processes.map((item) => item.name), previous.processes.map((item) => item.name));

  const addedCount = units.added.length + roles.added.length + people.added.length + okrs.added.length + processes.added.length;
  const removedCount = units.removed.length + roles.removed.length + people.removed.length + okrs.removed.length + processes.removed.length;

  return {
    snapshot_id: snapshot.id,
    snapshot_version: snapshot.snapshot_version,
    previous_snapshot_id: previous.id,
    previous_snapshot_version: previous.snapshot_version,
    summary: `相较 ${previous.snapshot_version}，新增 ${addedCount} 项、移除 ${removedCount} 项组织 Memory 对象。`,
    units,
    roles,
    people,
    okrs,
    processes,
  };
}

function createApprovalForProposal(
  proposal: OrgMemoryProposal,
  versions: OrgMemoryAppliedConfigVersion[],
  options?: {
    approvalRequestId?: number;
    status?: string | null;
    createdAt?: string;
  },
): ApprovalRequest {
  const id = options?.approvalRequestId ?? nextApprovalId(proposal.id);
  const createdAt = nowIso();
  const evidencePack = makeEvidencePack(proposal);
  return {
    id,
    request_type: "org_memory_proposal",
    target_id: proposal.id,
    target_type: "org_memory_proposal",
    target_detail: {
      proposal_id: proposal.id,
      snapshot_id: proposal.snapshot_id,
      title: proposal.title,
      risk_level: proposal.risk_level,
      ...evidencePack,
      applied_config: proposal.applied_config || null,
      config_versions: versions,
    },
    requester_id: 1,
    requester_name: "组织 Memory 联调",
    status: normalizeApprovalRequestStatus(options?.status),
    stage: "dept_pending",
    needs_info_comment: null,
    reason: `提交组织 Memory 草案审批：${proposal.title}`,
    conditions: [],
    security_scan_result: null,
    sandbox_report_id: null,
    sandbox_report_hash: null,
    evidence_pack: evidencePack,
    risk_level: proposal.risk_level,
    impact_summary: proposal.impact_summary,
    review_template: null,
    evidence_complete: Boolean(proposal.summary && proposal.impact_summary && proposal.evidence_refs.length > 0),
    missing_evidence: proposal.evidence_refs.length > 0 ? [] : ["evidence_refs"],
    is_high_risk: proposal.risk_level === "high",
    approve_blocked: false,
    created_at: options?.createdAt || createdAt,
    actions: [],
  };
}

function createApprovalLink(
  proposalId: number,
  approvalRequestId: number,
  source: OrgMemoryApprovalLink["source"],
  status: string,
  raw: Record<string, unknown> | null,
): OrgMemoryApprovalLink {
  const timestamp = nowIso();
  return {
    proposal_id: proposalId,
    approval_request_id: approvalRequestId,
    source,
    external_status: status,
    external_payload: raw,
    created_at: timestamp,
    updated_at: timestamp,
    last_synced_at: source === "remote" ? timestamp : null,
  };
}

function updateApprovalLink(
  link: OrgMemoryApprovalLink,
  status: string,
  raw: Record<string, unknown> | null,
) {
  const timestamp = nowIso();
  link.external_status = status;
  link.external_payload = raw;
  link.updated_at = timestamp;
  link.last_synced_at = timestamp;
}

function syncApprovalTargetDetail(
  approval: ApprovalRequest | null,
  proposal: OrgMemoryProposal,
  versions: OrgMemoryAppliedConfigVersion[],
) {
  if (!approval) return;
  approval.target_detail = {
    ...(approval.target_detail || {}),
    title: proposal.title,
    risk_level: proposal.risk_level,
    summary: proposal.summary,
    impact_summary: proposal.impact_summary,
    structure_changes: proposal.structure_changes,
    classification_rules: proposal.classification_rules,
    skill_mounts: proposal.skill_mounts,
    approval_impacts: proposal.approval_impacts,
    evidence_refs: proposal.evidence_refs,
    applied_config: proposal.applied_config || null,
    config_versions: versions,
  };
}

function mergeApprovalSnapshots(local: ApprovalRequest, remote: ApprovalRequest): ApprovalRequest {
  return {
    ...remote,
    target_detail:
      typeof remote.target_detail === "object" && remote.target_detail !== null && Object.keys(remote.target_detail).length > 0
        ? remote.target_detail
        : local.target_detail,
    evidence_pack:
      remote.evidence_pack && Object.keys(remote.evidence_pack).length > 0
        ? remote.evidence_pack
        : local.evidence_pack,
    requester_name: remote.requester_name || local.requester_name,
    reason: remote.reason || local.reason,
    impact_summary: remote.impact_summary || local.impact_summary,
    review_template: remote.review_template || local.review_template,
    missing_evidence: remote.missing_evidence?.length ? remote.missing_evidence : local.missing_evidence,
    actions: remote.actions?.length ? remote.actions : local.actions,
  };
}

function appendConfigVersion(
  versions: OrgMemoryAppliedConfigVersion[],
  config: OrgMemoryAppliedConfig,
  action: OrgMemoryAppliedConfigVersion["action"],
  note: string | null,
) {
  const version: OrgMemoryAppliedConfigVersion = {
    ...clone(config),
    version: versions.length + 1,
    action,
    note,
  };
  return [version, ...versions];
}

function createAppliedConfig(
  state: Awaited<ReturnType<typeof readOrgMemoryState>>,
  proposal: OrgMemoryProposal,
  approvalRequest: ApprovalRequest,
  versions: OrgMemoryAppliedConfigVersion[],
  status: OrgMemoryAppliedConfig["status"],
) {
  if (proposal.applied_config) {
    return { config: proposal.applied_config, versions };
  }

  const config: OrgMemoryAppliedConfig = {
    id: 800000 + proposal.id,
    proposal_id: proposal.id,
    approval_request_id: approvalRequest.id,
    status,
    applied_at: nowIso(),
    knowledge_paths: proposal.structure_changes
      .filter((item) => item.change_type === "create")
      .map((item) => item.target_path),
    classification_rule_count: proposal.classification_rules.length,
    skill_mount_count: proposal.skill_mounts.filter((item) => item.decision !== "deny").length,
    conditions: approvalRequest.conditions,
  };
  proposal.applied_config = config;
  applyProposalToFormalConfig(state, proposal, config);
  return {
    config,
    versions: appendConfigVersion(versions, config, "apply", null),
  };
}

function rollbackProposalConfig(
  state: Awaited<ReturnType<typeof readOrgMemoryState>>,
  proposal: OrgMemoryProposal,
  versions: OrgMemoryAppliedConfigVersion[],
): { result: OrgMemoryRollbackResult; versions: OrgMemoryAppliedConfigVersion[] } {
  const current = proposal.applied_config || null;
  if (!current) {
    return {
      result: {
        proposal_id: proposal.id,
        rolled_back_config_id: null,
        status: "rolled_back",
        message: "当前草案没有可回滚的生效配置",
      },
      versions,
    };
  }

  proposal.applied_config = null;
  rollbackFormalConfigForProposal(state, proposal.id, current.id);
  syncGovernanceVersionForProposalRollback(state, proposal);
  return {
    result: {
      proposal_id: proposal.id,
      rolled_back_config_id: current.id,
      status: "rolled_back",
      message: "已回滚当前正式配置",
    },
    versions: appendConfigVersion(versions, current, "rollback", "已回滚当前正式配置"),
  };
}

function applyApprovalOutcomeToProposal(
  state: Awaited<ReturnType<typeof readOrgMemoryState>>,
  proposal: OrgMemoryProposal | null,
  request: ApprovalRequest,
  action: ApprovalAction["action"],
  versions: OrgMemoryAppliedConfigVersion[],
) {
  if (!proposal) return versions;

  if (action === "approve") {
    proposal.proposal_status = "approved";
    syncGovernanceVersionForProposalApproval(state, proposal);
    return createAppliedConfig(state, proposal, request, versions, "effective").versions;
  }
  if (action === "approve_with_conditions" || action === "add_conditions") {
    proposal.proposal_status = "partially_approved";
    syncGovernanceVersionForProposalApproval(state, proposal);
    return createAppliedConfig(state, proposal, request, versions, "effective_with_conditions").versions;
  }
  if (action === "reject") {
    proposal.proposal_status = "rejected";
    proposal.applied_config = null;
  }
  return versions;
}

function filterApprovals(items: ApprovalRequest[], url: URL) {
  const typeFilter = url.searchParams.get("type");
  const statusFilter = url.searchParams.get("status");
  return items.filter((item) => {
    if (typeFilter) {
      const allowedTypes = typeFilter.split(",").filter(Boolean);
      if (allowedTypes.length > 0 && !allowedTypes.includes(item.request_type)) {
        return false;
      }
    }
    if (statusFilter && item.status !== statusFilter) {
      return false;
    }
    return true;
  });
}

function paginate(items: ApprovalRequest[], url: URL): AdminApprovalResponse {
  const page = Math.max(Number(url.searchParams.get("page") || "1") || 1, 1);
  const pageSize = Math.max(Number(url.searchParams.get("page_size") || "20") || 20, 1);
  const start = (page - 1) * pageSize;
  return {
    total: items.length,
    page,
    page_size: pageSize,
    items: clone(items.slice(start, start + pageSize)),
  };
}

function appendAction(request: ApprovalRequest, action: ApprovalAction["action"], payload: Record<string, unknown>) {
  const nextAction: ApprovalAction = {
    id: request.actions.length + 1,
    actor_id: 1,
    actor_name: "本地审批人",
    action,
    comment: typeof payload.comment === "string" ? payload.comment : null,
    decision_payload: typeof payload.decision_payload === "object" && payload.decision_payload !== null
      ? payload.decision_payload as Record<string, unknown>
      : null,
    checklist_result: Array.isArray(payload.checklist_result)
      ? payload.checklist_result as ApprovalAction["checklist_result"]
      : null,
    created_at: nowIso(),
  };
  request.actions = [nextAction, ...request.actions];
}

function updateApprovalByAction(
  request: ApprovalRequest,
  action: ApprovalAction["action"],
  payload: Record<string, unknown>,
) {
  appendAction(request, action, payload);
  if (action === "approve") {
    request.status = "approved";
    request.stage = null;
  } else if (action === "reject") {
    request.status = "rejected";
    request.stage = null;
  } else if (action === "approve_with_conditions" || action === "add_conditions") {
    request.status = "conditions";
    request.stage = null;
    request.conditions = Array.isArray(payload.conditions) ? payload.conditions : [];
  } else if (action === "request_more_info") {
    request.stage = "needs_info";
    request.needs_info_comment = typeof payload.comment === "string" ? payload.comment : null;
  }
}

function isApprovalRequest(value: unknown): value is ApprovalRequest {
  return typeof value === "object" && value !== null && "id" in value && "request_type" in value;
}

function syncRemoteApprovalItems(state: Awaited<ReturnType<typeof readOrgMemoryState>>, items: ApprovalRequest[]) {
  for (const item of items) {
    const link = findApprovalLinkByRequestId(state, item.id);
    if (!link) continue;

    updateApprovalLink(
      link,
      item.status || item.stage || link.external_status,
      item as unknown as Record<string, unknown>,
    );

    const proposal = findProposal(state, link.proposal_id);
    if (proposal) {
      const remoteAction =
        item.status === "approved"
          ? "approve"
          : item.status === "conditions"
            ? "approve_with_conditions"
            : item.status === "rejected"
              ? "reject"
              : null;
      if (remoteAction) {
        const mergedShadow = findApproval(state, item.id)
          ? mergeApprovalSnapshots(findApproval(state, item.id)!, item)
          : item;
        const versions = applyApprovalOutcomeToProposal(
          state,
          proposal,
          mergedShadow,
          remoteAction,
          getConfigVersions(state, proposal.id),
        );
        setConfigVersions(state, proposal.id, versions);
      }

      const nextStatus = normalizeProposalStatusFromApprovalStatus(item.status || item.stage);
      if (nextStatus) {
        proposal.proposal_status = nextStatus;
      }
      if (item.status === "pending" && !proposal.submitted_at) {
        proposal.submitted_at = item.created_at || proposal.submitted_at;
      }
    }

    const shadow = findApproval(state, item.id);
    if (shadow) {
      if (proposal) {
        syncApprovalTargetDetail(shadow, proposal, getConfigVersions(state, proposal.id));
      }
      upsertApproval(state, mergeApprovalSnapshots(shadow, item));
    }
  }
}

function extractApprovalItems(path: string, payload: unknown): ApprovalRequest[] {
  if ((path === "/approvals/my" || path === "/approvals/incoming") && Array.isArray(payload)) {
    return payload.filter(isApprovalRequest);
  }
  if (path === "/approvals" && typeof payload === "object" && payload !== null && Array.isArray((payload as AdminApprovalResponse).items)) {
    return (payload as AdminApprovalResponse).items.filter(isApprovalRequest);
  }
  return [];
}

export async function resolveOrgMemoryRequest(
  method: string,
  path: string,
  payload: Record<string, unknown> = {},
  context: OrgMemoryRequestContext = {},
): Promise<ApiResult | null> {
  if (method === "GET" && path === "/org-memory/sources") {
    const state = await readOrgMemoryState();
    return { body: { items: listSources(state) } };
  }

  if (method === "GET" && path === "/org-memory/snapshots") {
    const state = await readOrgMemoryState();
    return { body: { items: listSnapshots(state) } };
  }

  const snapshotId = extractSnapshotId(path, "");
  if (method === "GET" && snapshotId != null) {
    const state = await readOrgMemoryState();
    const snapshot = findSnapshot(state, snapshotId);
    if (!snapshot) {
      return { status: 404, body: { detail: "组织 Memory 快照不存在" } };
    }
    return { body: clone(snapshot) };
  }

  if (method === "GET" && path === "/org-memory/governance-versions") {
    const state = await readOrgMemoryState();
    return { body: { items: listGovernanceVersions(state) } };
  }

  if (method === "GET" && path === "/org-memory/governance-versions/current") {
    const state = await readOrgMemoryState();
    const current = findCurrentEffectiveGovernanceVersion(state.governance_versions);
    if (!current) {
      return { status: 404, body: { detail: "当前没有已生效的治理版本" } };
    }
    return { body: clone(current) };
  }

  if (method === "GET" && path === "/org-memory/proposals") {
    const state = await readOrgMemoryState();
    return { body: { items: listProposals(state) } };
  }

  const proposalId = extractProposalId(path, "");
  if (method === "GET" && proposalId != null) {
    const state = await readOrgMemoryState();
    const proposal = findProposal(state, proposalId);
    if (!proposal) {
      return { status: 404, body: { detail: "组织 Memory 草案不存在" } };
    }
    return { body: clone(proposal) };
  }

  const proposalVersionId = extractProposalId(path, "/config-versions");
  if (method === "GET" && proposalVersionId != null) {
    const state = await readOrgMemoryState();
    const proposal = findProposal(state, proposalVersionId);
    if (!proposal) {
      return { status: 404, body: { detail: "组织 Memory 草案不存在" } };
    }
    return { body: { items: clone(getConfigVersions(state, proposal.id)) } };
  }

  const proposalRollbackId = extractProposalId(path, "/rollback");
  if (method === "POST" && proposalRollbackId != null) {
    return updateOrgMemoryState((state) => {
      const proposal = findProposal(state, proposalRollbackId);
      if (!proposal) {
        return { status: 404, body: { detail: "组织 Memory 草案不存在" } };
      }
      const rollback = rollbackProposalConfig(state, proposal, getConfigVersions(state, proposal.id));
      setConfigVersions(state, proposal.id, rollback.versions);
      syncApprovalTargetDetail(findApprovalByProposalId(state, proposal.id), proposal, rollback.versions);
      return { body: rollback.result };
    });
  }

  const governanceVersionId = extractGovernanceVersionId(path, "");
  if (method === "GET" && governanceVersionId != null) {
    const state = await readOrgMemoryState();
    const governanceVersion = findGovernanceVersion(state, governanceVersionId);
    if (!governanceVersion) {
      return { status: 404, body: { detail: "治理版本不存在" } };
    }
    return { body: clone(governanceVersion) };
  }

  const activateGovernanceVersionId = extractGovernanceVersionId(path, "/activate");
  if (method === "POST" && activateGovernanceVersionId != null) {
    return updateOrgMemoryState((state) => {
      const governanceVersion = findGovernanceVersion(state, activateGovernanceVersionId);
      if (!governanceVersion) {
        return { status: 404, body: { detail: "治理版本不存在" } };
      }
      return { body: activateGovernanceVersion(state, governanceVersion) };
    });
  }

  const rollbackGovernanceVersionId = extractGovernanceVersionId(path, "/rollback");
  if (method === "POST" && rollbackGovernanceVersionId != null) {
    return updateOrgMemoryState((state) => {
      const governanceVersion = findGovernanceVersion(state, rollbackGovernanceVersionId);
      if (!governanceVersion) {
        return { status: 404, body: { detail: "治理版本不存在" } };
      }
      const result = rollbackGovernanceVersion(state, governanceVersion);
      if (!result) {
        return { status: 409, body: { detail: "没有可回滚的上一治理版本" } };
      }
      return { body: result };
    });
  }

  const snapshotDiffId = extractSnapshotId(path, "/diff");
  if (method === "GET" && snapshotDiffId != null) {
    const state = await readOrgMemoryState();
    const snapshot = findSnapshot(state, snapshotDiffId);
    if (!snapshot) {
      return { status: 404, body: { detail: "组织 Memory 快照不存在" } };
    }
    return { body: createSnapshotDiff(state.snapshots, snapshot) };
  }

  const snapshotGovernanceVersionId = extractSnapshotId(path, "/governance-version");
  if (snapshotGovernanceVersionId != null) {
    if (method === "GET") {
      const state = await readOrgMemoryState();
      const snapshot = findSnapshot(state, snapshotGovernanceVersionId);
      if (!snapshot) {
        return { status: 404, body: { detail: "组织 Memory 快照不存在" } };
      }
      const governanceVersion = findGovernanceVersionBySnapshotId(state, snapshot.id);
      if (!governanceVersion) {
        return { status: 404, body: { detail: "当前快照尚未派生治理版本" } };
      }
      return { body: clone(governanceVersion) };
    }
    if (method === "POST") {
      return updateOrgMemoryState((state) => {
        const snapshot = findSnapshot(state, snapshotGovernanceVersionId);
        if (!snapshot) {
          return { status: 404, body: { detail: "组织 Memory 快照不存在" } };
        }
        const governanceVersion = refreshGovernanceVersionForSnapshot(state, snapshot);
        return {
          body: {
            governance_version_id: governanceVersion.id,
            status: governanceVersion.status,
          } satisfies OrgMemoryGovernanceVersionRefreshResult,
        };
      });
    }
  }

  if (method === "POST" && path === "/org-memory/sources/ingest") {
    return updateOrgMemoryState((state) => {
      const source = createSource(state.sources, payload);
      prependSource(state, source);
      const snapshot = createSnapshot(state.snapshots, source);
      prependSnapshot(state, snapshot);
      const governanceVersion = createGovernanceVersion(state.governance_versions, snapshot);
      prependGovernanceVersion(state, governanceVersion);
      const result: OrgMemorySourceIngestResult = {
        source_id: source.id,
        status: snapshot.parse_status,
        snapshot_id: snapshot.id,
        snapshot_version: snapshot.snapshot_version,
        governance_version_id: governanceVersion.id,
      };
      return { body: result };
    });
  }

  const sourceSnapshotId = extractSourceId(path, "/snapshots");
  if (method === "POST" && sourceSnapshotId != null) {
    return updateOrgMemoryState((state) => {
      const source = findSource(state, sourceSnapshotId);
      if (!source) {
        return { status: 404, body: { detail: "组织 Memory 源文档不存在" } };
      }
      const snapshot = createSnapshot(state.snapshots, source);
      prependSnapshot(state, snapshot);
      const governanceVersion = createGovernanceVersion(state.governance_versions, snapshot);
      prependGovernanceVersion(state, governanceVersion);
      const result: OrgMemorySnapshotCreateResult = {
        snapshot_id: snapshot.id,
        status: snapshot.parse_status,
        snapshot_version: snapshot.snapshot_version,
        governance_version_id: governanceVersion.id,
      };
      return { body: result };
    });
  }

  const snapshotProposalId = extractSnapshotId(path, "/proposals");
  if (method === "POST" && snapshotProposalId != null) {
    return updateOrgMemoryState((state) => {
      const snapshot = findSnapshot(state, snapshotProposalId);
      if (!snapshot) {
        return { status: 404, body: { detail: "组织 Memory 快照不存在" } };
      }
      const existingProposal = state.proposals.find(
        (item) => item.snapshot_id === snapshot.id && item.proposal_status === "draft",
      );
      if (existingProposal) {
        return {
          body: {
            proposal_id: existingProposal.id,
            status: existingProposal.proposal_status,
          } satisfies OrgMemoryProposalCreateResult,
        };
      }
      const proposal = createProposal(state.proposals, snapshot);
      prependProposal(state, proposal);
      const result: OrgMemoryProposalCreateResult = {
        proposal_id: proposal.id,
        status: proposal.proposal_status,
      };
      return { body: result };
    });
  }

  const submitProposalId = extractProposalId(path, "/submit");
  if (method === "POST" && submitProposalId != null) {
    return updateOrgMemoryState(async (state) => {
      const proposal = findProposal(state, submitProposalId);
      if (!proposal) {
        return { status: 404, body: { detail: "组织 Memory 草案不存在" } };
      }

      const approvalConfig = readOrgMemoryApprovalAdapterConfig();
      const versions = getConfigVersions(state, proposal.id);
      const existingLink = findApprovalLinkByProposalId(state, proposal.id);

      let approvalRequestId = existingLink?.approval_request_id || 0;
      let approvalSource: OrgMemoryApprovalLink["source"] = existingLink?.source || "local";
      let externalStatus = existingLink?.external_status || "pending";
      let externalPayload = existingLink?.external_payload || null;

      if (!existingLink) {
        if (approvalConfig.mode === "local") {
          approvalRequestId = nextApprovalId(proposal.id);
          approvalSource = "local";
        } else {
          const draftApproval = createApprovalForProposal(proposal, versions);
          try {
            const remote = await createRemoteOrgMemoryApproval(
              {
                request_type: draftApproval.request_type,
                target_id: proposal.id,
                target_type: "org_memory_proposal",
                target_detail: draftApproval.target_detail,
                evidence_pack: draftApproval.evidence_pack || {},
                risk_level: proposal.risk_level,
                impact_summary: proposal.impact_summary,
              },
              { authorization: context.authorization },
              approvalConfig,
            );
            approvalRequestId = remote.approval_request_id;
            approvalSource = "remote";
            externalStatus = remote.status || "pending";
            externalPayload = remote.raw;
          } catch (error) {
            if (approvalConfig.mode === "remote") {
              return {
                status: 502,
                body: { detail: error instanceof Error ? error.message : "外部审批创建失败" },
              };
            }
            approvalRequestId = nextApprovalId(proposal.id);
            approvalSource = "local";
            externalStatus = "pending";
            externalPayload = {
              fallback_reason: error instanceof Error ? error.message : "外部审批创建失败，已退回本地 shadow 审批",
            };
          }
        }

        upsertApprovalLink(
          state,
          createApprovalLink(proposal.id, approvalRequestId, approvalSource, externalStatus, externalPayload),
        );
      } else {
        approvalRequestId = existingLink.approval_request_id;
        approvalSource = existingLink.source;
        externalStatus = existingLink.external_status;
        externalPayload = existingLink.external_payload;
      }

      const approval = findApproval(state, approvalRequestId)
        || createApprovalForProposal(
          proposal,
          versions,
          {
            approvalRequestId,
            status: externalStatus,
            createdAt: proposal.submitted_at || nowIso(),
          },
        );
      approval.status = normalizeApprovalRequestStatus(externalStatus);
      approval.stage = approval.status === "pending" ? "dept_pending" : approval.stage;

      proposal.proposal_status = normalizeProposalStatusFromApprovalStatus(externalStatus) || "pending_approval";
      proposal.submitted_at = proposal.submitted_at || approval.created_at || nowIso();
      syncApprovalTargetDetail(approval, proposal, versions);
      upsertApproval(state, approval);

      const result: OrgMemoryProposalSubmitResult = {
        proposal_id: proposal.id,
        approval_request_id: approvalRequestId,
        status: "submitted",
        message: "已提交审批",
      };
      return { body: result };
    });
  }

  return null;
}

export async function resolveApprovalRequest(
  method: string,
  path: string,
  url: URL,
  payload: Record<string, unknown> = {},
): Promise<ApiResult | null> {
  if (method === "GET" && path === "/approvals/templates") {
    return { body: FALLBACK_APPROVAL_TEMPLATES };
  }

  if (method === "GET" && path === "/approvals/my") {
    const state = await readOrgMemoryState();
    return { body: clone(listApprovals(state)) };
  }

  if (method === "GET" && path === "/approvals/incoming") {
    return { body: [] };
  }

  if (method === "GET" && path === "/approvals") {
    const state = await readOrgMemoryState();
    return { body: paginate(filterApprovals(listApprovals(state), url), url) };
  }

  const actionMatch = path.match(/^\/approvals\/(\d+)\/actions$/);
  if (method === "POST" && actionMatch) {
    return updateOrgMemoryState((state) => {
      const requestId = Number(actionMatch[1]);
      const request = findApproval(state, requestId);
      if (!request) return null;
      const link = findApprovalLinkByRequestId(state, requestId);
      if (link?.source === "remote") {
        return { status: 409, body: { detail: "真实外部审批单不支持本地 fallback 裁决" } };
      }
      const action = payload.action;
      if (typeof action !== "string") {
        return { status: 400, body: { detail: "缺少审批动作" } };
      }
      updateApprovalByAction(request, action as ApprovalAction["action"], payload);
      const proposal = request.target_type === "org_memory_proposal" && request.target_id
        ? findProposal(state, request.target_id)
        : null;
      if (proposal) {
        const versions = applyApprovalOutcomeToProposal(
          state,
          proposal,
          request,
          action as ApprovalAction["action"],
          getConfigVersions(state, proposal.id),
        );
        setConfigVersions(state, proposal.id, versions);
        syncApprovalTargetDetail(request, proposal, versions);
      }
      upsertApproval(state, request);
      return { body: clone(request) };
    });
  }

  const withdrawMatch = path.match(/^\/approvals\/(\d+)\/withdraw$/);
  if (method === "POST" && withdrawMatch) {
    return updateOrgMemoryState((state) => {
      const requestId = Number(withdrawMatch[1]);
      const request = findApproval(state, requestId);
      if (!request) return null;
      const link = findApprovalLinkByRequestId(state, requestId);
      if (link?.source === "remote") {
        return { status: 409, body: { detail: "真实外部审批单不支持本地 fallback 撤回" } };
      }
      request.status = "withdrawn";
      request.stage = null;
      appendAction(request, "withdraw", {});
      upsertApproval(state, request);
      return { body: clone(request) };
    });
  }

  const supplementMatch = path.match(/^\/approvals\/(\d+)\/supplement$/);
  if (method === "POST" && supplementMatch) {
    return updateOrgMemoryState((state) => {
      const requestId = Number(supplementMatch[1]);
      const request = findApproval(state, requestId);
      if (!request) return null;
      const link = findApprovalLinkByRequestId(state, requestId);
      if (link?.source === "remote") {
        return { status: 409, body: { detail: "真实外部审批单不支持本地 fallback 补充证据" } };
      }
      request.evidence_pack = {
        ...(request.evidence_pack || {}),
        ...(typeof payload.evidence_pack === "object" && payload.evidence_pack !== null
          ? payload.evidence_pack as Record<string, unknown>
          : {}),
      };
      request.missing_evidence = [];
      request.evidence_complete = true;
      request.stage = "dept_pending";
      appendAction(request, "supplement", payload);
      upsertApproval(state, request);
      return { body: { ok: true } };
    });
  }

  return null;
}

export async function mergeLocalApprovals(path: string, url: URL, payload: unknown): Promise<unknown> {
  return updateOrgMemoryState((state) => {
    const remoteItems = extractApprovalItems(path, payload);
    if (remoteItems.length > 0) {
      syncRemoteApprovalItems(state, remoteItems);
    }

    const localItems = listApprovals(state);
    if (localItems.length === 0) return payload;

    if (path === "/approvals/my" && Array.isArray(payload)) {
      const remoteById = new Map(remoteItems.map((item) => [item.id, item]));
      const mergedRemote = payload
        .filter(isApprovalRequest)
        .map((item) => {
          const local = localItems.find((candidate) => candidate.id === item.id);
          return local ? mergeApprovalSnapshots(local, item) : item;
        });
      const localOnly = localItems.filter((item) => !remoteById.has(item.id));
      return [...localOnly, ...mergedRemote];
    }

    if (path === "/approvals/incoming" && Array.isArray(payload)) {
      return payload.map((item) => {
        if (!isApprovalRequest(item)) return item;
        const local = localItems.find((candidate) => candidate.id === item.id);
        return local ? mergeApprovalSnapshots(local, item) : item;
      });
    }

    if (path === "/approvals" && typeof payload === "object" && payload !== null && Array.isArray((payload as AdminApprovalResponse).items)) {
      const response = payload as AdminApprovalResponse;
      const filteredLocal = filterApprovals(localItems, url);
      const remoteById = new Map(response.items.map((item) => [item.id, item]));
      const mergedItems = response.items.map((item) => {
        const local = filteredLocal.find((candidate) => candidate.id === item.id);
        return local ? mergeApprovalSnapshots(local, item) : item;
      });
      const localOnlyItems = filteredLocal.filter((item) => !remoteById.has(item.id));
      return {
        ...response,
        total: response.total + localOnlyItems.length,
        items: [...localOnlyItems, ...mergedItems],
      };
    }

    return payload;
  });
}

export function isApprovalListPath(path: string) {
  return path === "/approvals/my" || path === "/approvals/incoming" || path === "/approvals";
}

export async function resetOrgMemoryLocalState() {
  await resetOrgMemoryPersistentState();
}
