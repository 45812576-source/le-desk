import type { SkillDetail, SkillMemo, SkillMemoTask, SandboxReport } from "@/lib/types";
import type { GovernanceCardData, SelectedFile, StagedEdit } from "./types";
import type { WorkflowStateData } from "./workflow-protocol";
import { resolveFocusedWorkbenchCardId, type CardQueueWindow, type ExternalBuildStatus, type StudioFileRole, type StudioHandoffPolicy, type StudioReturnTarget, type StudioRouteDestination, type StudioRouteKind, type WorkbenchCard, type WorkbenchCardKind, type WorkbenchMode, type WorkbenchTarget, type WorkbenchValidationSource } from "./workbench-types";

export type { CardQueueWindow, ExternalBuildStatus, StudioFileRole, StudioHandoffPolicy, StudioReturnTarget, StudioRouteDestination, StudioRouteKind, WorkbenchCard, WorkbenchCardKind, WorkbenchMode, WorkbenchTarget, WorkbenchValidationSource } from "./workbench-types";
export { isInternalRoute, isExternalHandoff } from "./workbench-types";

export interface GovernanceWorkbenchIntent {
  visible: boolean;
  skillId: number | null;
  mode?: "mount_blocked" | "choose_existing_plan" | "generate_cases" | null;
  summary?: string | null;
  latestPlan?: {
    id: number;
    skill_id: number;
    plan_version: number;
    case_count: number;
    materialized_session_id?: number | null;
  } | null;
  entrySource?: string | null;
  sessionId?: number | null;
  reportId?: number | null;
  blockedStage?: string | null;
  blockedBefore?: string | null;
}

export function resolveNextPendingWorkbenchCardId(cards: WorkbenchCard[], activeId: string | null | undefined): string | null {
  const pendingCards = cards.filter((card) => card.status === "pending");
  if (pendingCards.length === 0) return null;

  const activeIndex = activeId ? cards.findIndex((card) => card.id === activeId) : -1;
  if (activeIndex >= 0) {
    const nextAfterActive = cards.slice(activeIndex + 1).find((card) => card.status === "pending");
    if (nextAfterActive) return nextAfterActive.id;
  }

  return pendingCards[0]?.id ?? null;
}

function normalizeSummary(value: unknown, fallback: string) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return fallback;
}

function phaseMode(phase?: string | null, workflowMode?: string | null): WorkbenchMode {
  if (phase === "validation" || phase === "review" || phase === "remediate" || phase === "validate") {
    return "report";
  }
  if (workflowMode === "architect_mode" || (phase && phase.startsWith("phase_"))) {
    return "analysis";
  }
  return "file";
}

function inferTargetFile(card: GovernanceCardData, stagedEdits: StagedEdit[]): string | null {
  const content = card.content || {};
  const explicitTarget = typeof content.target_ref === "string"
    ? content.target_ref
    : typeof content.target_file === "string"
      ? content.target_file
      : null;
  if (explicitTarget) {
    return explicitTarget;
  }
  const targetFiles = Array.isArray(content.target_files)
    ? content.target_files.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  if (targetFiles.length > 0) {
    return targetFiles[0];
  }
  const stagedEditId = typeof content.staged_edit_id === "string" ? content.staged_edit_id : null;
  if (stagedEditId) {
    const matched = stagedEdits.find((edit) => edit.id === stagedEditId);
    if (matched?.filename) {
      return matched.filename;
    }
  }
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function extractValidationSource(raw: Record<string, unknown> | null | undefined): WorkbenchValidationSource | null {
  if (!raw) return null;
  const content = typeof raw.content === "object" && raw.content
    ? raw.content as Record<string, unknown>
    : raw;
  const source = typeof content.validation_source === "object" && content.validation_source
    ? content.validation_source as Record<string, unknown>
    : content;
  const plan = typeof source.latest_plan === "object" && source.latest_plan
    ? source.latest_plan as Record<string, unknown>
    : null;
  const result: WorkbenchValidationSource = {
    skillId: asNumber(source.skill_id) ?? asNumber(plan?.skill_id),
    planId: asNumber(source.plan_id) ?? asNumber(source.source_case_plan_id) ?? asNumber(plan?.id),
    planVersion: asNumber(source.plan_version) ?? asNumber(source.source_case_plan_version) ?? asNumber(plan?.plan_version),
    caseCount: asNumber(source.case_count) ?? asNumber(plan?.case_count),
    sessionId: asNumber(source.session_id) ?? asNumber(source.sandbox_session_id) ?? asNumber(plan?.materialized_session_id),
    reportId: asNumber(source.report_id),
    entrySource: typeof source.entry_source === "string"
      ? source.entry_source
      : typeof source.test_entry_source === "string"
        ? source.test_entry_source
        : null,
    decisionMode: typeof source.decision_mode === "string" ? source.decision_mode : null,
    blockedStage: typeof source.blocked_stage === "string" ? source.blocked_stage : null,
    blockedBefore: typeof source.blocked_before === "string" ? source.blocked_before : null,
    sourceCasePlanId: asNumber(source.source_case_plan_id),
    sourceCasePlanVersion: asNumber(source.source_case_plan_version),
  };
  return Object.values(result).some((value) => value != null) ? result : null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length > 0 ? items : undefined;
}

function asStudioFileRole(value: unknown): StudioFileRole | null {
  return value === "main_prompt"
    || value === "example"
    || value === "reference"
    || value === "knowledge_base"
    || value === "template"
    || value === "tool"
    || value === "unknown_asset"
    ? value
    : null;
}

function asStudioHandoffPolicy(value: unknown): StudioHandoffPolicy | null {
  return value === "stay_in_studio_chat"
    || value === "open_file_workspace"
    || value === "open_governance_panel"
    || value === "open_development_studio"
    || value === "open_opencode"
    || value === "bind_back_after_external_edit"
    ? value
    : null;
}

function asStudioRouteKind(value: unknown): StudioRouteKind | null {
  if (value === "internal" || value === "internal_route") return "internal";
  if (value === "external" || value === "external_handoff") return "external";
  return null;
}

function asStudioRouteDestination(value: unknown): StudioRouteDestination | null {
  if (
    value === "studio_chat"
    || value === "file_workspace"
    || value === "governance_panel"
    || value === "dev_studio"
    || value === "opencode"
  ) return value;
  if (value === "open_file_workspace") return "file_workspace";
  if (value === "open_governance_panel") return "governance_panel";
  if (value === "open_development_studio" || value === "development_studio" || value === "Development Studio") return "dev_studio";
  if (value === "open_opencode" || value === "OpenCode") return "opencode";
  if (value === "Studio Chat") return "studio_chat";
  return null;
}

function asStudioReturnTarget(value: unknown): StudioReturnTarget | null {
  if (value === "none" || value === "bind_back" || value === "confirm" || value === "validate") return value;
  return null;
}

function inferRouteKindFromPolicy(policy: StudioHandoffPolicy | null): StudioRouteKind | null {
  if (!policy) return null;
  if (policy === "open_development_studio" || policy === "open_opencode") return "external";
  return "internal";
}

function inferDestinationFromPolicy(policy: StudioHandoffPolicy | null): StudioRouteDestination | null {
  if (policy === "open_development_studio") return "dev_studio";
  if (policy === "open_opencode") return "opencode";
  if (policy === "open_file_workspace") return "file_workspace";
  if (policy === "open_governance_panel") return "governance_panel";
  if (policy === "stay_in_studio_chat" || policy === "bind_back_after_external_edit") return "studio_chat";
  return null;
}

export function asCardQueueWindow(value: unknown): CardQueueWindow | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const visibleCardIds = Array.isArray(raw.visible_card_ids)
    ? raw.visible_card_ids.filter((item): item is string => typeof item === "string")
    : [];
  const revealPolicy = raw.reveal_policy === "stage_gated"
    || raw.reveal_policy === "user_expand"
    || raw.reveal_policy === "validation_blocking"
    ? raw.reveal_policy
    : null;
  if (!revealPolicy) return null;
  // M3 增补字段
  const hiddenCardIds = Array.isArray(raw.hidden_card_ids)
    ? raw.hidden_card_ids.filter((item): item is string => typeof item === "string")
    : undefined;

  const previewCardId = typeof raw.preview_card_id === "string" ? raw.preview_card_id : null;

  let pendingArtifacts: CardQueueWindow["pending_artifacts"] = undefined;
  if (raw.pending_artifacts && typeof raw.pending_artifacts === "object") {
    const pa = raw.pending_artifacts as Record<string, unknown>;
    pendingArtifacts = {
      has_pending_staged_edit: pa.has_pending_staged_edit === true,
      has_external_edit_waiting_bindback: pa.has_external_edit_waiting_bindback === true,
      has_failed_validation: pa.has_failed_validation === true,
    };
  }

  let blockingSignal: CardQueueWindow["blocking_signal"] = undefined;
  if (raw.blocking_signal && typeof raw.blocking_signal === "object") {
    const bs = raw.blocking_signal as Record<string, unknown>;
    const bsKind = bs.kind as string;
    if (bsKind === "pending_confirmation" || bsKind === "failed_validation" || bsKind === "waiting_bindback" || bsKind === "phase_gate") {
      blockingSignal = {
        kind: bsKind,
        card_id: typeof bs.card_id === "string" ? bs.card_id : "",
        reason: typeof bs.reason === "string" ? bs.reason : "",
      };
    }
  }

  let resumeHint: CardQueueWindow["resume_hint"] = undefined;
  if (raw.resume_hint && typeof raw.resume_hint === "object") {
    const rh = raw.resume_hint as Record<string, unknown>;
    const rhKind = rh.kind as string;
    if (rhKind === "resume_same_card" || rhKind === "resume_reprioritized") {
      resumeHint = {
        kind: rhKind,
        message: typeof rh.message === "string" ? rh.message : "",
      };
    }
  }

  const activeCardExplanation = typeof raw.active_card_explanation === "string"
    ? raw.active_card_explanation
    : undefined;

  // M4 增补
  const staleCardIds = Array.isArray(raw.stale_card_ids)
    ? raw.stale_card_ids.filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    active_card_id: typeof raw.active_card_id === "string" ? raw.active_card_id : null,
    visible_card_ids: visibleCardIds,
    backlog_count: asNumber(raw.backlog_count) ?? 0,
    phase: typeof raw.phase === "string" ? raw.phase : "discover",
    max_visible: asNumber(raw.max_visible) ?? 5,
    reveal_policy: revealPolicy,
    preview_card_id: previewCardId,
    hidden_card_ids: hiddenCardIds,
    pending_artifacts: pendingArtifacts,
    blocking_signal: blockingSignal,
    resume_hint: resumeHint,
    active_card_explanation: activeCardExplanation,
    stale_card_ids: staleCardIds,
  };
}

function asWorkbenchMode(value: unknown): WorkbenchMode | null {
  return value === "analysis" || value === "file" || value === "report" || value === "governance"
    ? value
    : null;
}

function asWorkbenchKind(value: unknown): WorkbenchCardKind | null {
  return value === "architect"
    || value === "governance"
    || value === "validation"
    || value === "system"
    || value === "create"
    || value === "refine"
    || value === "fixing"
    || value === "release"
    ? value
    : null;
}

function asWorkbenchStatus(value: unknown): WorkbenchCard["status"] | null {
  return value === "pending"
    || value === "active"
    || value === "reviewing"
    || value === "adopted"
    || value === "rejected"
    || value === "stale"
    || value === "dismissed"
    ? value
    : null;
}

function asWorkbenchTarget(value: unknown): WorkbenchTarget | null {
  if (!value || typeof value !== "object") return null;
  const target = value as Record<string, unknown>;
  const type = target.type === "prompt"
    || target.type === "source_file"
    || target.type === "report"
    || target.type === "governance_panel"
    || target.type === "analysis"
    || target.type === null
    ? target.type
    : null;
  return {
    type,
    key: typeof target.key === "string" ? target.key : null,
  };
}

function buildWorkflowWorkbenchCardId(card: GovernanceCardData): string {
  const contentCardId = typeof card.content?.card_id === "string" ? card.content.card_id : null;
  const cardId = contentCardId || card.id;
  if (
    cardId.startsWith("create:")
    || cardId.startsWith("refine:")
    || cardId.startsWith("fixing:")
    || cardId.startsWith("release:")
    || cardId.startsWith("testing:")
    || cardId.startsWith("staged-edit:")
    || cardId.startsWith("workflow-test-flow:")
    || cardId.startsWith("governance:")
    || cardId.startsWith("validation:")
    || cardId.startsWith("audit:")
  ) {
    return cardId;
  }
  return `workflow-card:${card.id}`;
}

function inferCardMode(card: GovernanceCardData, input: {
  workflowState: WorkflowStateData | null;
  stagedEdits: StagedEdit[];
}): { mode: WorkbenchMode; kind: WorkbenchCardKind; target: WorkbenchTarget; priority: number } {
  const title = card.title || "";
  const summary = normalizeSummary(card.content?.summary, title);
  const combined = `${title} ${summary}`.toLowerCase();
  const targetFile = inferTargetFile(card, input.stagedEdits);
  const hasStagedEdit = card.type === "staged_edit" || typeof card.content?.staged_edit_id === "string";

  if (
    combined.includes("sandbox")
    || combined.includes("preflight")
    || combined.includes("测试")
    || combined.includes("报告")
    || combined.includes("retest")
    || combined.includes("整改")
  ) {
    return {
      mode: "report",
      kind: "validation",
      target: { type: "report", key: targetFile },
      priority: 90,
    };
  }

  if (
    combined.includes("权限")
    || combined.includes("挂载")
    || combined.includes("case")
    || combined.includes("readiness")
  ) {
    return {
      mode: "governance",
      kind: "validation",
      target: { type: "governance_panel", key: null },
      priority: 95,
    };
  }

  if (hasStagedEdit || targetFile) {
    return {
      mode: "file",
      kind: "governance",
      target: {
        type: targetFile === "SKILL.md" ? "prompt" : "source_file",
        key: targetFile,
      },
      priority: 80,
    };
  }

  if (phaseMode(card.content?.phase as string | null | undefined, input.workflowState?.workflow_mode) === "analysis") {
    return {
      mode: "analysis",
      kind: "architect",
      target: { type: "analysis", key: null },
      priority: 60,
    };
  }

  return {
    mode: "analysis",
    kind: "system",
    target: { type: "analysis", key: null },
    priority: 40,
  };
}

function buildCardFromGovernanceCard(card: GovernanceCardData, input: {
  workflowState: WorkflowStateData | null;
  stagedEdits: StagedEdit[];
}): WorkbenchCard {
  const inferred = inferCardMode(card, input);
  const explicitMode = asWorkbenchMode(card.content?.mode);
  const explicitKind = asWorkbenchKind(card.content?.kind);
  const explicitTarget = asWorkbenchTarget(card.content?.target);
  const contractId = typeof card.content?.contract_id === "string"
    ? card.content.contract_id
    : inferred.mode === "governance"
    ? "governance.panel"
    : typeof card.content?.staged_edit_id === "string"
      ? "confirm.staged_edit_review"
      : null;
  const priority = asNumber(card.content?.priority) ?? inferred.priority;
  const fileRole = asStudioFileRole(card.content?.file_role ?? (card as unknown as Record<string, unknown>).file_role);
  const handoffPolicy = asStudioHandoffPolicy(card.content?.handoff_policy ?? (card as unknown as Record<string, unknown>).handoff_policy);
  const routeKind = asStudioRouteKind(card.content?.route_kind ?? (card as unknown as Record<string, unknown>).route_kind) ?? inferRouteKindFromPolicy(handoffPolicy);
  const destination = asStudioRouteDestination(card.content?.destination ?? (card as unknown as Record<string, unknown>).destination) ?? inferDestinationFromPolicy(handoffPolicy);
  const returnTo = asStudioReturnTarget(card.content?.return_to ?? (card as unknown as Record<string, unknown>).return_to) ?? (routeKind === "external" ? "bind_back" : null);
  const queueWindow = asCardQueueWindow(card.content?.queue_window ?? (card as unknown as Record<string, unknown>).queue_window);
  return {
    id: buildWorkflowWorkbenchCardId(card),
    contractId,
    title: card.title,
    summary: normalizeSummary(card.content?.summary, "等待处理"),
    status: asWorkbenchStatus(card.content?.status) ?? (card.status === "pending" ? "pending" : card.status),
    kind: explicitKind ?? inferred.kind,
    mode: explicitMode ?? inferred.mode,
    phase: typeof card.content?.phase === "string"
      ? card.content.phase
      : input.workflowState?.phase || "discover",
    source: card.source || "workflow",
    priority,
    target: explicitTarget ?? inferred.target,
    sourceCardId: typeof card.content?.source_card_id === "string" ? card.content.source_card_id : card.id,
    stagedEditId: typeof card.content?.staged_edit_id === "string" ? card.content.staged_edit_id : null,
    artifactRefs: asStringArray(card.content?.artifact_refs),
    blockedBy: asStringArray(card.content?.blocked_by),
    exitReason: typeof card.content?.exit_reason === "string" ? card.content.exit_reason : null,
    actions: card.actions,
    validationSource: extractValidationSource(card as unknown as Record<string, unknown>),
    fileRole,
    handoffPolicy,
    routeKind,
    destination,
    returnTo,
    queueWindow,
    raw: card as unknown as Record<string, unknown>,
    externalBuildStatus: asExternalBuildStatus(
      card.content?.external_build_status
      ?? card.content?.external_state
      ?? (card as unknown as Record<string, unknown>).external_state,
    ),
  };
}

function asExternalBuildStatus(value: unknown): ExternalBuildStatus | null {
  if (
    value === "waiting_external_build"
    || value === "external_in_progress"
    || value === "returned_waiting_bindback"
    || value === "returned_waiting_validation"
  ) {
    return value;
  }
  return null;
}

function buildCardFromStagedEdit(edit: StagedEdit): WorkbenchCard {
  const raw = edit as unknown as Record<string, unknown>;
  const handoffPolicy = asStudioHandoffPolicy(raw.handoff_policy);
  const routeKind = asStudioRouteKind(raw.route_kind) ?? inferRouteKindFromPolicy(handoffPolicy);
  const destination = asStudioRouteDestination(raw.destination) ?? inferDestinationFromPolicy(handoffPolicy);
  const returnTo = asStudioReturnTarget(raw.return_to) ?? (routeKind === "external" ? "bind_back" : null);
  return {
    id: `staged-edit:${edit.id}`,
    contractId: "confirm.staged_edit_review",
    title: edit.filename === "SKILL.md" ? "主 Prompt 待确认修改" : `${edit.filename} 待确认修改`,
    summary: edit.changeNote || "查看本轮变更并决定是否采纳",
    status: edit.status === "pending" ? "pending" : edit.status,
    kind: "governance",
    mode: "file",
    phase: "governance_execution",
    source: edit.source || "workflow",
    priority: edit.status === "pending" ? 85 : 20,
    target: {
      type: edit.filename === "SKILL.md" ? "prompt" : "source_file",
      key: edit.filename,
    },
    stagedEditId: edit.id,
    sourceCardId: edit.sourceCardId ?? null,
    fileRole: asStudioFileRole(raw.file_role),
    handoffPolicy,
    routeKind,
    destination,
    returnTo,
    raw,
  };
}

const CATEGORY_TO_FILE_ROLE: Record<string, StudioFileRole> = {
  "knowledge-base": "knowledge_base",
  reference: "reference",
  example: "example",
  tool: "tool",
  template: "template",
};

function inferFileRoleFromName(filename: string): StudioFileRole {
  const name = filename.toLowerCase();
  if (name.startsWith("example") || name.includes("-example") || name.includes("_example")) return "example";
  if (name.startsWith("reference") || name.includes("-reference") || name.includes("_reference") || name.startsWith("ref-") || name.startsWith("ref_")) return "reference";
  if (name.includes("knowledge") || name.startsWith("kb-") || name.startsWith("kb_")) return "knowledge_base";
  if (name.startsWith("template") || name.startsWith("tpl-") || name.startsWith("tpl_") || name.includes("-template") || name.includes("_template")) return "template";
  if (name.startsWith("tool-") || name.startsWith("tool_") || name.includes("-tool.") || name.includes("_tool.")) return "tool";
  return "unknown_asset";
}

function resolveFileRole(selectedFile: SelectedFile, selectedSkill: SkillDetail | null): StudioFileRole {
  if (selectedFile.fileType === "prompt") return "main_prompt";
  // 优先读后端 source_files 中的 category
  if (selectedSkill?.source_files) {
    const match = selectedSkill.source_files.find((f) => f.filename === selectedFile.filename);
    if (match?.category) {
      const mapped = CATEGORY_TO_FILE_ROLE[match.category];
      if (mapped) return mapped;
    }
  }
  return inferFileRoleFromName(selectedFile.filename);
}

const FILE_ROLE_LABEL: Record<StudioFileRole, string> = {
  main_prompt: "当前正在处理的主 Prompt",
  example: "示例文件",
  reference: "参考资料",
  knowledge_base: "知识库文件",
  template: "模板文件",
  tool: "工具定义文件",
  unknown_asset: "当前正在处理的附属文件",
};

function buildSelectedFileCard(selectedFile: SelectedFile | null, selectedSkill: SkillDetail | null, workflowState: WorkflowStateData | null): WorkbenchCard | null {
  if (!selectedFile || !selectedSkill) {
    return null;
  }
  const fileRole = resolveFileRole(selectedFile, selectedSkill);
  return {
    id: `selected-file:${selectedFile.skillId}:${selectedFile.fileType === "asset" ? selectedFile.filename : "SKILL.md"}`,
    title: selectedFile.fileType === "asset" ? selectedFile.filename : "SKILL.md",
    summary: FILE_ROLE_LABEL[fileRole],
    status: "active",
    kind: workflowState?.workflow_mode === "architect_mode" ? "architect" : "governance",
    mode: "file",
    phase: workflowState?.phase || "governance_execution",
    source: "selection",
    priority: 10,
    target: {
      type: selectedFile.fileType === "asset" ? "source_file" : "prompt",
      key: selectedFile.fileType === "asset" ? selectedFile.filename : "SKILL.md",
    },
    fileRole,
    validationSource: extractValidationSource(workflowState?.metadata),
  };
}

function buildArchitectPhaseCard(workflowState: WorkflowStateData | null, memo: SkillMemo | null): WorkbenchCard | null {
  if (!workflowState) {
    return null;
  }
  if (workflowState.workflow_mode !== "architect_mode" && !workflowState.phase?.startsWith("phase_")) {
    return null;
  }
  return {
    id: `architect-phase:${workflowState.phase}`,
    title: "架构分析阶段",
    summary: memo?.status_summary || workflowState.route_reason || "正在收敛当前 Skill 的结构与边界",
    status: "active",
    kind: "architect",
    mode: "analysis",
    phase: workflowState.phase,
    source: "workflow_state",
    priority: 50,
    target: { type: "analysis", key: workflowState.phase },
    validationSource: extractValidationSource(workflowState.metadata),
    raw: workflowState as Record<string, unknown>,
  };
}

function buildGovernanceIntentCard(intent: GovernanceWorkbenchIntent): WorkbenchCard | null {
  if (!intent.visible || !intent.skillId) {
    return null;
  }
  const titleMap: Record<string, string> = {
    mount_blocked: "测试流被挂载门禁阻断",
    choose_existing_plan: "存在历史测试方案待决策",
    generate_cases: "测试用例生成与执行",
  };
  const mode = intent.mode || "generate_cases";
  return {
    id: `governance-intent:${intent.skillId}:${mode}`,
    contractId: "governance.panel",
    title: titleMap[mode] || "权限治理与测试编排",
    summary: intent.summary || "当前卡片需要通过治理面板继续推进",
    status: "active",
    kind: "validation",
    mode: "governance",
    phase: "validation",
    source: "governance_panel",
    priority: 100,
    target: { type: "governance_panel", key: String(intent.skillId) },
    validationSource: {
      skillId: intent.skillId,
      planId: intent.latestPlan?.id ?? null,
      planVersion: intent.latestPlan?.plan_version ?? null,
      caseCount: intent.latestPlan?.case_count ?? null,
      sessionId: intent.sessionId ?? intent.latestPlan?.materialized_session_id ?? null,
      reportId: intent.reportId ?? null,
      entrySource: intent.entrySource ?? null,
      blockedStage: intent.blockedStage ?? null,
      blockedBefore: intent.blockedBefore ?? null,
    },
  };
}

function buildSandboxReportCard(activeSandboxReport: SandboxReport | null): WorkbenchCard | null {
  if (!activeSandboxReport) {
    return null;
  }
  const reportRecord = activeSandboxReport as unknown as Record<string, unknown>;
  return {
    id: `sandbox-report:${activeSandboxReport.report_id}`,
    title: `Sandbox 报告 #${activeSandboxReport.report_id}`,
    summary: activeSandboxReport.approval_eligible ? "当前报告已通过，可继续发布" : "当前报告存在阻断问题，需要继续整改",
    status: activeSandboxReport.approval_eligible ? "reviewing" : "pending",
    kind: "validation",
    mode: "report",
    phase: "validation",
    source: "sandbox_report",
    priority: activeSandboxReport.approval_eligible ? 70 : 98,
    target: { type: "report", key: String(activeSandboxReport.report_id) },
    validationSource: {
      reportId: activeSandboxReport.report_id,
      sessionId: asNumber(activeSandboxReport.session_id),
      skillId: asNumber(reportRecord.skill_id),
      sourceCasePlanId: asNumber(reportRecord.source_case_plan_id),
      sourceCasePlanVersion: asNumber(reportRecord.source_case_plan_version),
      entrySource: typeof reportRecord.test_entry_source === "string" ? reportRecord.test_entry_source : null,
    },
    raw: reportRecord,
  };
}

export function buildWorkflowMetadataCards(workflowState: WorkflowStateData | null): WorkbenchCard[] {
  const metadata = workflowState?.metadata;
  const testFlow = metadata && typeof metadata.test_flow === "object" && metadata.test_flow
    ? metadata.test_flow as Record<string, unknown>
    : null;
  if (!testFlow) return [];
  const action = typeof testFlow.action === "string" ? testFlow.action : null;
  const skillId = asNumber(testFlow.skill_id);
  if (!action && !skillId) return [];
  const latestPlan = typeof testFlow.latest_plan === "object" && testFlow.latest_plan
    ? testFlow.latest_plan as Record<string, unknown>
    : null;
  const validationSource = extractValidationSource(testFlow);
  const titleMap: Record<string, string> = {
    mount_blocked: "测试流被挂载门禁阻断",
    choose_existing_plan: "存在历史测试方案待决策",
    generate_cases: "测试用例生成与执行",
  };
  const mode = action === "mount_blocked" || action === "choose_existing_plan" || action === "generate_cases"
    ? "governance"
    : "report";
  return [{
    id: `workflow-test-flow:${skillId ?? "unknown"}:${action || workflowState?.phase || "validation"}`,
    title: titleMap[action || ""] || "测试流上下文",
    summary: typeof testFlow.gate_summary === "string"
      ? testFlow.gate_summary
      : typeof testFlow.verdict_reason === "string"
        ? testFlow.verdict_reason
        : latestPlan
          ? `Plan v${latestPlan.plan_version ?? "?"} · ${latestPlan.case_count ?? 0} 个用例`
          : "当前 workflow 带有测试流上下文",
    status: action === "mount_blocked" ? "pending" : "active",
    kind: "validation",
    mode,
    phase: "validation",
    source: "workflow_state.test_flow",
    priority: action === "mount_blocked" ? 99 : 88,
    target: mode === "governance"
      ? { type: "governance_panel", key: skillId ? String(skillId) : null }
      : { type: "report", key: validationSource?.reportId ? String(validationSource.reportId) : null },
    validationSource,
    raw: testFlow,
  }];
}

// ── 架构师阶段判定 ──

type ArchitectPhase = "why" | "what" | "how" | null;

function inferArchitectPhase(workflowState: WorkflowStateData | null): ArchitectPhase {
  if (!workflowState || workflowState.workflow_mode !== "architect_mode") return null;
  const phase = workflowState.phase || "";
  if (phase.startsWith("phase_1") || phase === "why") return "why";
  if (phase.startsWith("phase_2") || phase === "what") return "what";
  if (phase.startsWith("phase_3") || phase === "how") return "how";
  // 用 metadata 中的 architect_phase 做回退
  const meta = workflowState.metadata;
  if (meta && typeof meta.architect_phase === "string") {
    const p = meta.architect_phase;
    if (p === "why" || p === "what" || p === "how") return p;
  }
  return "why"; // 默认从 Why 开始
}

// ── 1. 创作卡 builders (kind="create") ──

function buildOnboardingCard(prompt: string, workflowState: WorkflowStateData | null, selectedSkill: SkillDetail | null): WorkbenchCard | null {
  if (!selectedSkill) return null;
  if (prompt.trim().length > 0) return null;
  if (workflowState) return null;
  return {
    id: "create:onboarding",
    contractId: "create.onboarding",
    title: "起步引导",
    summary: "选择一个 Skill 后，在 Chat 中描述你想解决的问题",
    status: "pending",
    kind: "create",
    mode: "analysis",
    phase: "onboarding",
    source: "system",
    priority: 120,
    target: { type: null, key: null },
  };
}

function buildSummaryReadyCard(hasPendingSummary: boolean): WorkbenchCard | null {
  if (!hasPendingSummary) return null;
  return {
    id: "create:summary-ready",
    contractId: "create.summary_ready",
    title: "需求摘要确认",
    summary: "AI 已理解你的需求并生成了摘要，请确认或编辑后继续",
    status: "pending",
    kind: "create",
    mode: "analysis",
    phase: "summary",
    source: "pending_summary",
    priority: 110,
    target: { type: null, key: null },
  };
}

// ── 架构师卡片（Why → What → How 三阶段） ──

interface ArchitectCardDef {
  id: string;
  title: string;
  summary: string;
  phase: ArchitectPhase;
  priority: number;
  artifactRefs: string[];
}

const ARCHITECT_CARD_DEFS: ArchitectCardDef[] = [
  // Why 阶段
  {
    id: "5whys",
    title: "5 Whys 根因卡",
    summary: "连续追问「为什么需要这个 Skill」，找到真实业务根因",
    phase: "why",
    priority: 49,
    artifactRefs: ["artifact:surface_request", "artifact:why_chain", "artifact:root_cause"],
  },
  {
    id: "first-principles",
    title: "第一性原理卡",
    summary: "剥离惯性假设，找到真约束与最小必要解法",
    phase: "why",
    priority: 48,
    artifactRefs: ["artifact:true_constraints", "artifact:assumptions_to_drop"],
  },
  {
    id: "jtbd",
    title: "JTBD 场景卡",
    summary: "定义谁在什么情境下「雇佣」这个 Skill",
    phase: "why",
    priority: 47,
    artifactRefs: ["artifact:jtbd_scene", "artifact:user_anxiety", "artifact:expected_outcome", "artifact:alternative_solution"],
  },
  {
    id: "cynefin",
    title: "Cynefin 分类卡",
    summary: "判断问题复杂度：简单/复杂/探索/混沌，决定 Skill 设计模式",
    phase: "why",
    priority: 46,
    artifactRefs: ["artifact:problem_complexity", "artifact:skill_design_mode"],
  },
  // What 阶段
  {
    id: "mece",
    title: "MECE 维度卡",
    summary: "穷举所有影响结论质量的输入维度，不重叠不遗漏",
    phase: "what",
    priority: 45,
    artifactRefs: ["artifact:dimension_groups", "artifact:dimension_items", "artifact:mece_conflicts"],
  },
  {
    id: "issue-tree",
    title: "Issue Tree 卡",
    summary: "把核心问题拆成可验证的子问题树",
    phase: "what",
    priority: 44,
    artifactRefs: ["artifact:issue_tree"],
  },
  {
    id: "value-chain",
    title: "Value Chain 卡",
    summary: "拆解输入→处理→输出链条，找瓶颈环节",
    phase: "what",
    priority: 43,
    artifactRefs: ["artifact:value_chain"],
  },
  {
    id: "scenario",
    title: "Scenario Planning 卡",
    summary: "用最佳/最差/边缘场景补充隐藏维度",
    phase: "what",
    priority: 42,
    artifactRefs: ["artifact:best_case_scenario", "artifact:worst_case_scenario", "artifact:edge_case_scenario", "artifact:hidden_dimensions"],
  },
  // How 阶段
  {
    id: "pyramid",
    title: "金字塔验证卡",
    summary: "把核心结论、证据和子论点串成可验证结构",
    phase: "how",
    priority: 41,
    artifactRefs: ["artifact:conclusion_evidence_tree"],
  },
  {
    id: "pre-mortem",
    title: "Pre-Mortem 卡",
    summary: "假设上线失败，倒推至少 3 个失败原因",
    phase: "how",
    priority: 40,
    artifactRefs: ["artifact:failure_reasons", "artifact:failure_prevention"],
  },
  {
    id: "red-team",
    title: "Red Team 卡",
    summary: "挑战已有维度，找反例、冲突、伪重要维度",
    phase: "how",
    priority: 39,
    artifactRefs: ["artifact:red_team_counterexamples", "artifact:dimension_conflicts"],
  },
  {
    id: "sensitivity",
    title: "Sensitivity 卡",
    summary: "维度 P0/P1/P2 分级，避免维度膨胀",
    phase: "how",
    priority: 38,
    artifactRefs: ["artifact:priority_matrix", "artifact:p0_dimensions", "artifact:p1_dimensions", "artifact:p2_dimensions"],
  },
  {
    id: "zero-based",
    title: "归零思维卡",
    summary: "从零重审哪些维度可以删除，避免 Skill 变成臃肿表单",
    phase: "how",
    priority: 37,
    artifactRefs: ["artifact:removed_dimensions"],
  },
  {
    id: "ooda",
    title: "OODA 收敛卡",
    summary: "至少两轮迭代，直到框架稳定后才进入治理与测试",
    phase: "how",
    priority: 36,
    artifactRefs: ["artifact:ooda_rounds", "artifact:ready_for_draft_summary"],
  },
];

const ARCHITECT_CONTRACT_BY_CARD_ID: Record<string, string> = {
  "5whys": "architect.why.5whys",
  "first-principles": "architect.why.first_principles",
  jtbd: "architect.why.jtbd",
  cynefin: "architect.why.cynefin",
  mece: "architect.what.mece",
  "issue-tree": "architect.what.issue_tree",
  "value-chain": "architect.what.value_chain",
  scenario: "architect.what.scenario_planning",
  pyramid: "architect.how.pyramid",
  "pre-mortem": "architect.how.pre_mortem",
  "red-team": "architect.how.red_team",
  sensitivity: "architect.how.sensitivity",
  "zero-based": "architect.how.zero_based",
  ooda: "architect.how.ooda",
};

function buildArchitectMethodCards(workflowState: WorkflowStateData | null): WorkbenchCard[] {
  const currentPhase = inferArchitectPhase(workflowState);
  if (!currentPhase) return [];

  // 取 metadata 中已完成的架构师卡片 ID 列表
  const completedIds = new Set<string>(
    Array.isArray(workflowState?.metadata?.completed_architect_cards)
      ? (workflowState.metadata.completed_architect_cards as string[])
      : [],
  );

  const phaseOrder: ArchitectPhase[] = ["why", "what", "how"];
  const currentIdx = phaseOrder.indexOf(currentPhase);

  return ARCHITECT_CARD_DEFS
    .filter((def) => {
      // 只显示当前阶段及之前阶段的卡片
      const defIdx = phaseOrder.indexOf(def.phase);
      return defIdx <= currentIdx;
    })
    .map((def): WorkbenchCard => {
      const done = completedIds.has(def.id);
      const isCurrent = def.phase === currentPhase && !done;
      return {
        id: `create:architect:${def.id}`,
        contractId: ARCHITECT_CONTRACT_BY_CARD_ID[def.id] ?? "architect.phase.execute",
        title: def.title,
        summary: def.summary,
        status: done ? "adopted" : isCurrent ? "active" : "pending",
        kind: "create",
        mode: "analysis",
        phase: `architect_${def.phase}`,
        source: "architect_method",
        priority: done ? 5 : def.priority,
        target: { type: "analysis", key: def.id },
        artifactRefs: def.artifactRefs,
        groupLabel: def.phase === "why" ? "问题定义 Why" : def.phase === "what" ? "要素拆解 What" : "验证收敛 How",
      };
    });
}

function buildCreateCards(input: {
  prompt: string;
  workflowState: WorkflowStateData | null;
  selectedSkill: SkillDetail | null;
  memo: SkillMemo | null;
  hasPendingSummary: boolean;
}): WorkbenchCard[] {
  const cards: WorkbenchCard[] = [];
  const onboarding = buildOnboardingCard(input.prompt, input.workflowState, input.selectedSkill);
  if (onboarding) cards.push(onboarding);
  const summaryReady = buildSummaryReadyCard(input.hasPendingSummary);
  if (summaryReady) cards.push(summaryReady);
  cards.push(...buildArchitectMethodCards(input.workflowState));
  return cards;
}

// ── 2. 完善卡 builders (kind="refine") ──

function buildDraftReadyCard(hasPendingDraft: boolean): WorkbenchCard | null {
  if (!hasPendingDraft) return null;
  return {
    id: "refine:draft-ready",
    contractId: "refine.draft_ready",
    title: "草稿就绪",
    summary: "AI 已生成草稿内容，应用到编辑器或放弃",
    status: "pending",
    kind: "refine",
    mode: "file",
    phase: "draft",
    source: "pending_draft",
    priority: 108,
    target: { type: "prompt", key: "SKILL.md" },
  };
}

function buildToolSuggestionCard(hasPendingToolSuggestion: boolean): WorkbenchCard | null {
  if (!hasPendingToolSuggestion) return null;
  return {
    id: "refine:tool-suggestion",
    contractId: "refine.tool_suggestion",
    title: "工具绑定建议",
    summary: "AI 建议绑定外部工具，逐个确认或跳转 DevStudio 创建",
    status: "pending",
    kind: "refine",
    mode: "file",
    phase: "tool_binding",
    source: "pending_tool_suggestion",
    priority: 105,
    target: { type: null, key: null },
  };
}

function buildFileSplitCard(hasPendingFileSplit: boolean): WorkbenchCard | null {
  if (!hasPendingFileSplit) return null;
  return {
    id: "refine:file-split",
    contractId: "refine.file_split",
    title: "文件拆分建议",
    summary: "AI 建议拆分当前文件，确认或放弃",
    status: "pending",
    kind: "refine",
    mode: "file",
    phase: "file_split",
    source: "pending_file_split",
    priority: 103,
    target: { type: null, key: null },
  };
}

function buildKnowledgeHintCard(selectedSkill: SkillDetail | null, memo: SkillMemo | null): WorkbenchCard | null {
  if (!selectedSkill) return null;
  const hasSourceFiles = Array.isArray(selectedSkill.source_files) && selectedSkill.source_files.length > 0;
  const hasKnowledgeTags = Array.isArray((selectedSkill as unknown as Record<string, unknown>).knowledge_tags)
    && ((selectedSkill as unknown as Record<string, unknown>).knowledge_tags as unknown[]).length > 0;
  if (!hasSourceFiles || hasKnowledgeTags) return null;
  if (memo?.lifecycle_stage === "analysis") return null;
  return {
    id: "refine:knowledge-hint",
    contractId: "refine.knowledge_binding_hint",
    title: "知识库引用建议",
    summary: "当前 Skill 有附属文件但未绑定知识标签，建议关联知识库",
    status: "pending",
    kind: "refine",
    mode: "analysis",
    phase: "knowledge",
    source: "system",
    priority: 70,
    target: { type: null, key: null },
  };
}

function buildRefineCards(input: {
  hasPendingDraft: boolean;
  hasPendingToolSuggestion: boolean;
  hasPendingFileSplit: boolean;
  selectedSkill: SkillDetail | null;
  memo: SkillMemo | null;
}): WorkbenchCard[] {
  const cards: WorkbenchCard[] = [];
  const draft = buildDraftReadyCard(input.hasPendingDraft);
  if (draft) cards.push(draft);
  const tool = buildToolSuggestionCard(input.hasPendingToolSuggestion);
  if (tool) cards.push(tool);
  const split = buildFileSplitCard(input.hasPendingFileSplit);
  if (split) cards.push(split);
  const knowledge = buildKnowledgeHintCard(input.selectedSkill, input.memo);
  if (knowledge) cards.push(knowledge);
  return cards;
}

// ── 3. 治理卡 — 复用现有的 governance/staged-edit builder ──

// ── 4. 测试卡 builders (kind="validation") ──

function buildTestReadyCard(memo: SkillMemo | null, activeSandboxReport: SandboxReport | null): WorkbenchCard | null {
  if (!memo) return null;
  if (memo.lifecycle_stage !== "awaiting_test") return null;
  if (activeSandboxReport) return null;
  return {
    id: "testing:test-ready",
    contractId: "validation.test_ready",
    title: "测试就绪",
    summary: "当前 Skill 已进入待测试阶段，打开 Sandbox 运行质量检测",
    status: "pending",
    kind: "validation",
    mode: "report",
    phase: "awaiting_test",
    source: "memo",
    priority: 92,
    target: { type: "report", key: null },
  };
}

// ── 5. 整改卡 builders (kind="fixing") ──

function buildFixingOverviewCard(memo: SkillMemo | null): WorkbenchCard | null {
  if (!memo) return null;
  if (memo.lifecycle_stage !== "fixing" || memo.latest_test?.status !== "failed") return null;
  return {
    id: "fixing:overview",
    contractId: "fixing.overview",
    title: "整改概览",
    summary: memo.latest_test?.summary || "测试未通过，需要逐项修复",
    status: "active",
    kind: "fixing",
    mode: "report",
    phase: "fixing",
    source: "memo",
    priority: 96,
    target: { type: "report", key: null },
  };
}

function buildCurrentTaskCard(memo: SkillMemo | null): WorkbenchCard | null {
  if (!memo?.current_task) return null;
  return {
    id: `fixing:current:${memo.current_task.id}`,
    contractId: "fixing.task",
    title: `当前任务：${memo.current_task.title}`,
    summary: memo.current_task.description || "正在修复中",
    status: "active",
    kind: "fixing",
    mode: "file",
    phase: "fixing",
    source: "memo",
    priority: 94,
    target: {
      type: memo.current_task.target_kind === "skill_prompt" ? "prompt" : "source_file",
      key: memo.current_task.target_files[0] || null,
    },
    fixTask: memo.current_task,
  };
}

function buildFixTaskCards(memo: SkillMemo | null): WorkbenchCard[] {
  if (!memo) return [];
  const tasks = Array.isArray((memo.memo as Record<string, unknown>)?.tasks)
    ? (memo.memo as Record<string, unknown>).tasks as SkillMemoTask[]
    : [];
  const cards: WorkbenchCard[] = [];
  for (const task of tasks) {
    if (task.status === "done" || task.status === "skipped") continue;
    if (memo.current_task?.id === task.id) continue;
    const isRetest = task.type === "run_targeted_retest";
    const priorityMap: Record<string, number> = { high: 93, medium: 91, low: 89 };
    cards.push({
      id: `fixing:task:${task.id}`,
      contractId: isRetest ? "fixing.targeted_retest" : "fixing.task",
      title: isRetest ? `局部重测：${task.title}` : task.title,
      summary: task.description || (isRetest ? "运行局部重测验证修复" : "待修复"),
      status: "pending",
      kind: "fixing",
      mode: isRetest ? "report" : "file",
      phase: "fixing",
      source: "memo",
      priority: isRetest ? 90 : (priorityMap[task.priority] ?? 91),
      target: {
        type: task.target_kind === "skill_prompt" ? "prompt" : "source_file",
        key: task.target_files[0] || null,
      },
      fixTask: task,
      groupLabel: isRetest ? "重测" : `P${task.priority === "high" ? "0" : task.priority === "medium" ? "1" : "2"}`,
    });
  }
  return cards;
}

function buildCompletedTasksCard(memo: SkillMemo | null): WorkbenchCard | null {
  if (!memo) return null;
  const tasks = Array.isArray((memo.memo as Record<string, unknown>)?.tasks)
    ? (memo.memo as Record<string, unknown>).tasks as SkillMemoTask[]
    : [];
  const completed = tasks.filter((t) => t.status === "done" || t.status === "skipped");
  if (completed.length === 0) return null;
  return {
    id: "fixing:completed-group",
    title: `已完成任务 (${completed.length})`,
    summary: completed.map((t) => t.title).join("、"),
    status: "adopted",
    kind: "fixing",
    mode: "analysis",
    phase: "fixing",
    source: "memo",
    priority: 10,
    target: { type: null, key: null },
    groupLabel: "已完成",
  };
}

function buildFixingCards(memo: SkillMemo | null): WorkbenchCard[] {
  const cards: WorkbenchCard[] = [];
  const overview = buildFixingOverviewCard(memo);
  if (overview) cards.push(overview);
  const current = buildCurrentTaskCard(memo);
  if (current) cards.push(current);
  cards.push(...buildFixTaskCards(memo));
  const completed = buildCompletedTasksCard(memo);
  if (completed) cards.push(completed);
  return cards;
}

// ── 6. 确认卡 builders (kind="release") ──

function buildTestPassedCard(memo: SkillMemo | null): WorkbenchCard | null {
  if (!memo?.latest_test) return null;
  if (!memo.latest_test.details?.approval_eligible) return null;
  if (memo.lifecycle_stage === "completed" || memo.lifecycle_stage === "ready_to_submit") return null;
  return {
    id: "release:test-passed",
    contractId: "release.test_passed",
    title: "测试通过",
    summary: "质量检测已通过，可以提交审批",
    status: "active",
    kind: "release",
    mode: "report",
    phase: "release",
    source: "memo",
    priority: 97,
    target: { type: "report", key: null },
  };
}

function buildSubmitCard(memo: SkillMemo | null): WorkbenchCard | null {
  if (!memo) return null;
  if (memo.lifecycle_stage !== "ready_to_submit") return null;
  return {
    id: "release:submit",
    contractId: "release.submit",
    title: "提交审批",
    summary: "Skill 已就绪，执行提交",
    status: "pending",
    kind: "release",
    mode: "analysis",
    phase: "release",
    source: "memo",
    priority: 115,
    target: { type: null, key: null },
  };
}

function buildCompletedCard(memo: SkillMemo | null): WorkbenchCard | null {
  if (!memo) return null;
  if (memo.lifecycle_stage !== "completed") return null;
  return {
    id: "release:completed",
    title: "发布完成",
    summary: "Skill 已发布上线",
    status: "adopted",
    kind: "release",
    mode: "analysis",
    phase: "release",
    source: "memo",
    priority: 5,
    target: { type: null, key: null },
  };
}

function buildReleaseCards(memo: SkillMemo | null): WorkbenchCard[] {
  const cards: WorkbenchCard[] = [];
  const passed = buildTestPassedCard(memo);
  if (passed) cards.push(passed);
  const submit = buildSubmitCard(memo);
  if (submit) cards.push(submit);
  const completed = buildCompletedCard(memo);
  if (completed) cards.push(completed);
  return cards;
}

// ── buildWorkbenchCards 主入口 ──

export function buildWorkbenchCards(input: {
  governanceCards: GovernanceCardData[];
  stagedEdits: StagedEdit[];
  selectedFile: SelectedFile | null;
  selectedSkill: SkillDetail | null;
  workflowState: WorkflowStateData | null;
  memo: SkillMemo | null;
  governanceIntent: GovernanceWorkbenchIntent;
  activeSandboxReport: SandboxReport | null;
  // ── 新增 ──
  prompt: string;
  hasPendingDraft: boolean;
  hasPendingSummary: boolean;
  hasPendingToolSuggestion: boolean;
  hasPendingFileSplit: boolean;
}): WorkbenchCard[] {
  const cards: WorkbenchCard[] = [];
  const referencedStagedEditIds = new Set<string>();

  // 1. 创作卡
  cards.push(...buildCreateCards({
    prompt: input.prompt,
    workflowState: input.workflowState,
    selectedSkill: input.selectedSkill,
    memo: input.memo,
    hasPendingSummary: input.hasPendingSummary,
  }));

  // 2. 完善卡
  cards.push(...buildRefineCards({
    hasPendingDraft: input.hasPendingDraft,
    hasPendingToolSuggestion: input.hasPendingToolSuggestion,
    hasPendingFileSplit: input.hasPendingFileSplit,
    selectedSkill: input.selectedSkill,
    memo: input.memo,
  }));

  // 3. 治理卡 — governanceIntent / 后端 governance cards / staged edits
  const governanceIntentCard = buildGovernanceIntentCard(input.governanceIntent);
  if (governanceIntentCard) {
    cards.push(governanceIntentCard);
  }

  for (const card of input.governanceCards) {
    const workbenchCard = buildCardFromGovernanceCard(card, input);
    if (workbenchCard.stagedEditId) {
      referencedStagedEditIds.add(workbenchCard.stagedEditId);
    }
    cards.push(workbenchCard);
  }

  for (const edit of input.stagedEdits) {
    if (!referencedStagedEditIds.has(edit.id)) {
      cards.push(buildCardFromStagedEdit(edit));
    }
  }

  // 4. 测试卡
  const sandboxReportCard = buildSandboxReportCard(input.activeSandboxReport);
  if (sandboxReportCard) {
    cards.push(sandboxReportCard);
  }

  const architectPhaseCard = buildArchitectPhaseCard(input.workflowState, input.memo);
  if (architectPhaseCard) {
    cards.push(architectPhaseCard);
  }

  cards.push(...buildWorkflowMetadataCards(input.workflowState));

  const testReady = buildTestReadyCard(input.memo, input.activeSandboxReport);
  if (testReady) cards.push(testReady);

  // 5. 整改卡
  cards.push(...buildFixingCards(input.memo));

  // 6. 确认卡
  cards.push(...buildReleaseCards(input.memo));

  // 当前文件卡（低优先级）
  const selectedFileCard = buildSelectedFileCard(input.selectedFile, input.selectedSkill, input.workflowState);
  if (selectedFileCard) {
    cards.push(selectedFileCard);
  }

  const uniqueCards = cards.filter((card, index, all) => all.findIndex((item) => item.id === card.id) === index);
  return uniqueCards.sort((left, right) => right.priority - left.priority);
}

export function deriveActiveWorkbenchCardId(cards: WorkbenchCard[], activeId: string | null): string | null {
  return resolveFocusedWorkbenchCardId(cards, activeId);
}

export function resolvePreferredWorkbenchCardId(
  cards: WorkbenchCard[],
  workflowState: WorkflowStateData | null,
  fallbackActiveId: string | null,
): string | null {
  const explicitActiveId = typeof workflowState?.active_card_id === "string"
    ? workflowState.active_card_id
    : null;
  if (explicitActiveId) {
    const explicitMatch = cards.find((card) =>
      card.id === explicitActiveId
      || card.sourceCardId === explicitActiveId
      || card.stagedEditId === explicitActiveId
    );
    if (explicitMatch) return resolveFocusedWorkbenchCardId(cards, explicitMatch.id);
  }
  return deriveActiveWorkbenchCardId(cards, fallbackActiveId);
}
