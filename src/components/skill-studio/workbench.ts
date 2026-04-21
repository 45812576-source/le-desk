import type { SkillDetail, SkillMemo, SandboxReport } from "@/lib/types";
import type { GovernanceCardData, SelectedFile, StagedEdit } from "./types";
import type { WorkflowStateData } from "./workflow-protocol";
import type { WorkbenchCard, WorkbenchCardKind, WorkbenchMode, WorkbenchTarget, WorkbenchValidationSource } from "./workbench-types";

export type { WorkbenchCard, WorkbenchCardKind, WorkbenchMode, WorkbenchTarget, WorkbenchValidationSource } from "./workbench-types";

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
  return {
    id: `workflow-card:${card.id}`,
    title: card.title,
    summary: normalizeSummary(card.content?.summary, "等待处理"),
    status: card.status === "pending" ? "pending" : card.status,
    kind: inferred.kind,
    mode: inferred.mode,
    phase: typeof card.content?.phase === "string"
      ? card.content.phase
      : input.workflowState?.phase || "discover",
    source: card.source || "workflow",
    priority: inferred.priority,
    target: inferred.target,
    sourceCardId: card.id,
    stagedEditId: typeof card.content?.staged_edit_id === "string" ? card.content.staged_edit_id : null,
    actions: card.actions,
    validationSource: extractValidationSource(card as unknown as Record<string, unknown>),
    raw: card as unknown as Record<string, unknown>,
  };
}

function buildCardFromStagedEdit(edit: StagedEdit): WorkbenchCard {
  return {
    id: `staged-edit:${edit.id}`,
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
    raw: edit as unknown as Record<string, unknown>,
  };
}

function buildSelectedFileCard(selectedFile: SelectedFile | null, selectedSkill: SkillDetail | null, workflowState: WorkflowStateData | null): WorkbenchCard | null {
  if (!selectedFile || !selectedSkill) {
    return null;
  }
  return {
    id: `selected-file:${selectedFile.skillId}:${selectedFile.fileType === "asset" ? selectedFile.filename : "SKILL.md"}`,
    title: selectedFile.fileType === "asset" ? selectedFile.filename : "SKILL.md",
    summary: selectedFile.fileType === "asset" ? "当前正在处理的附属文件" : "当前正在处理的主 Prompt",
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

export function buildWorkbenchCards(input: {
  governanceCards: GovernanceCardData[];
  stagedEdits: StagedEdit[];
  selectedFile: SelectedFile | null;
  selectedSkill: SkillDetail | null;
  workflowState: WorkflowStateData | null;
  memo: SkillMemo | null;
  governanceIntent: GovernanceWorkbenchIntent;
  activeSandboxReport: SandboxReport | null;
}): WorkbenchCard[] {
  const cards: WorkbenchCard[] = [];
  const referencedStagedEditIds = new Set<string>();

  const governanceIntentCard = buildGovernanceIntentCard(input.governanceIntent);
  if (governanceIntentCard) {
    cards.push(governanceIntentCard);
  }

  const sandboxReportCard = buildSandboxReportCard(input.activeSandboxReport);
  if (sandboxReportCard) {
    cards.push(sandboxReportCard);
  }

  const architectPhaseCard = buildArchitectPhaseCard(input.workflowState, input.memo);
  if (architectPhaseCard) {
    cards.push(architectPhaseCard);
  }

  cards.push(...buildWorkflowMetadataCards(input.workflowState));

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

  const selectedFileCard = buildSelectedFileCard(input.selectedFile, input.selectedSkill, input.workflowState);
  if (selectedFileCard) {
    cards.push(selectedFileCard);
  }

  const uniqueCards = cards.filter((card, index, all) => all.findIndex((item) => item.id === card.id) === index);
  return uniqueCards.sort((left, right) => right.priority - left.priority);
}

export function deriveActiveWorkbenchCardId(cards: WorkbenchCard[], activeId: string | null): string | null {
  if (activeId && cards.some((card) => card.id === activeId)) {
    return activeId;
  }
  const firstPending = cards.find((card) => card.status === "pending" || card.status === "active");
  return firstPending?.id || cards[0]?.id || null;
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
    if (explicitMatch) return explicitMatch.id;
  }
  return deriveActiveWorkbenchCardId(cards, fallbackActiveId);
}
