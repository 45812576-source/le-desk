"use client";

import type {
  ArchitectArtifact,
  ArchitectOodaDecision,
  ArchitectPhaseSummary,
  ArchitectPriorityMatrix,
  ArchitectQuestion,
  ArchitectReadyForDraft,
  ArchitectStructure,
  AuditResult,
  GovernanceActionCard,
  PhaseProgress,
  StudioDraft,
  StudioFileSplit,
  StudioSummary,
  StudioToolSuggestion,
} from "./types";
import { extractStudioMeta, type StudioMetaDirective } from "./studio-meta";

const STRUCTURED_BLOCK_PATTERN = /```(studio_draft|studio_diff|studio_test_result|studio_summary|studio_tool_suggestion|studio_file_split|studio_memo_status|studio_task_focus|studio_editor_target|studio_persistent_notices|studio_context_rollup|studio_audit|studio_governance_action|studio_phase_progress|artifact_patch|architect_question|architect_phase_summary|architect_structure|architect_priority_matrix|architect_ooda_decision|architect_ready_for_draft|architect_artifact)\s*\n([\s\S]*?)\n```/gi;

const TRAILING_OPEN_BLOCK_PATTERN = /```(?:studio_\w+|architect_\w+|artifact_patch)\s*[\s\S]*$/g;

export interface ParsedStructuredStudioMessage {
  cleanText: string;
  studioMeta: StudioMetaDirective | null;
  draft: StudioDraft | null;
  summary: StudioSummary | null;
  toolSuggestion: StudioToolSuggestion | null;
  fileSplit: StudioFileSplit | null;
  auditResult: AuditResult | null;
  pendingGovernanceActions: GovernanceActionCard[];
  phaseProgress: PhaseProgress[];
  architectQuestions: ArchitectQuestion[];
  architectStructures: ArchitectStructure[];
  architectPriorities: ArchitectPriorityMatrix[];
  oodaDecisions: ArchitectOodaDecision[];
  pendingPhaseSummary: ArchitectPhaseSummary | null;
  architectReady: ArchitectReadyForDraft | null;
  architectArtifacts: ArchitectArtifact[];
}

function normalizeAuditResult(raw: Record<string, unknown>): AuditResult {
  return {
    quality_score: typeof raw.quality_score === "number" ? raw.quality_score : 80,
    severity: (raw.severity as AuditResult["severity"]) || "low",
    issues: Array.isArray(raw.issues) ? raw.issues as AuditResult["issues"] : [],
    recommended_path: raw.recommended_path === "restructure" ? "restructure" : "optimize",
    phase_entry: raw.phase_entry as AuditResult["phase_entry"],
    assist_skills_to_enable: Array.isArray(raw.assist_skills_to_enable)
      ? raw.assist_skills_to_enable as string[]
      : undefined,
  };
}

const STRUCTURED_PHASE_SUMMARY_KEYS = new Set([
  "summary",
  "deliverables",
  "confidence",
  "ready_for_next",
  "confirmed",
]);

const ARTIFACT_LABELS: Record<string, string> = {
  surface_request: "表面需求",
  why_chain: "Why Chain",
  root_cause: "真实根因",
  true_constraints: "真实约束",
  assumptions_to_drop: "可丢弃假设",
  jtbd_scene: "JTBD 场景",
  user_anxiety: "用户焦虑",
  expected_outcome: "预期结果",
  alternative_solution: "替代方案",
  problem_complexity: "问题复杂度",
  skill_design_mode: "Skill 设计模式",
  dimension_groups: "维度分组",
  dimension_items: "维度清单",
  mece_conflicts: "MECE 冲突",
  issue_tree: "Issue Tree",
  value_chain: "Value Chain",
  best_case_scenario: "最佳场景",
  worst_case_scenario: "最差场景",
  edge_case_scenario: "边缘场景",
  hidden_dimensions: "隐藏维度",
  conclusion_evidence_tree: "结论证据树",
  failure_reasons: "失败原因",
  failure_prevention: "失败预防",
  red_team_counterexamples: "Red Team 反例",
  dimension_conflicts: "维度冲突",
  priority_matrix: "优先级矩阵",
  p0_dimensions: "P0 维度",
  p1_dimensions: "P1 维度",
  p2_dimensions: "P2 维度",
  removed_dimensions: "移除维度",
  ooda_rounds: "OODA 轮次",
  ready_for_draft_summary: "草稿前收敛摘要",
};

const ARTIFACT_KEY_TO_CARD_ID: Record<string, string> = {
  surface_request: "create:architect:5whys",
  why_chain: "create:architect:5whys",
  root_cause: "create:architect:5whys",
  true_constraints: "create:architect:first-principles",
  assumptions_to_drop: "create:architect:first-principles",
  jtbd_scene: "create:architect:jtbd",
  user_anxiety: "create:architect:jtbd",
  expected_outcome: "create:architect:jtbd",
  alternative_solution: "create:architect:jtbd",
  problem_complexity: "create:architect:cynefin",
  skill_design_mode: "create:architect:cynefin",
  dimension_groups: "create:architect:mece",
  dimension_items: "create:architect:mece",
  mece_conflicts: "create:architect:mece",
  issue_tree: "create:architect:issue-tree",
  value_chain: "create:architect:value-chain",
  best_case_scenario: "create:architect:scenario",
  worst_case_scenario: "create:architect:scenario",
  edge_case_scenario: "create:architect:scenario",
  hidden_dimensions: "create:architect:scenario",
  conclusion_evidence_tree: "create:architect:pyramid",
  failure_reasons: "create:architect:pre-mortem",
  failure_prevention: "create:architect:pre-mortem",
  red_team_counterexamples: "create:architect:red-team",
  dimension_conflicts: "create:architect:red-team",
  priority_matrix: "create:architect:sensitivity",
  p0_dimensions: "create:architect:sensitivity",
  p1_dimensions: "create:architect:sensitivity",
  p2_dimensions: "create:architect:sensitivity",
  removed_dimensions: "create:architect:zero-based",
  ooda_rounds: "create:architect:ooda",
  ready_for_draft_summary: "create:architect:ooda",
};

const FRAMEWORK_TO_ARTIFACT_CARD_ID: Record<string, string> = {
  "5_whys": "create:architect:5whys",
  "5whys": "create:architect:5whys",
  first_principles: "create:architect:first-principles",
  jtbd: "create:architect:jtbd",
  cynefin: "create:architect:cynefin",
  mece: "create:architect:mece",
  issue_tree: "create:architect:issue-tree",
  value_chain: "create:architect:value-chain",
  scenario_planning: "create:architect:scenario",
  pyramid_principle: "create:architect:pyramid",
  pre_mortem: "create:architect:pre-mortem",
  red_team: "create:architect:red-team",
  sensitivity_analysis: "create:architect:sensitivity",
  sensitivity: "create:architect:sensitivity",
  zero_based: "create:architect:zero-based",
  ooda: "create:architect:ooda",
};

const CARD_ID_TO_CONTRACT_ID: Record<string, string> = {
  "create:architect:5whys": "architect.why.5whys",
  "create:architect:first-principles": "architect.why.first_principles",
  "create:architect:jtbd": "architect.why.jtbd",
  "create:architect:cynefin": "architect.why.cynefin",
  "create:architect:mece": "architect.what.mece",
  "create:architect:issue-tree": "architect.what.issue_tree",
  "create:architect:value-chain": "architect.what.value_chain",
  "create:architect:scenario": "architect.what.scenario_planning",
  "create:architect:pyramid": "architect.how.pyramid",
  "create:architect:pre-mortem": "architect.how.pre_mortem",
  "create:architect:red-team": "architect.how.red_team",
  "create:architect:sensitivity": "architect.how.sensitivity",
  "create:architect:zero-based": "architect.how.zero_based",
  "create:architect:ooda": "architect.how.ooda",
};

function toArtifactId(artifactKey: string, phase?: string | null, index?: number | string) {
  return `artifact:${phase || "global"}:${artifactKey}:${index ?? "latest"}`;
}

function inferArtifactCardId(artifactKey: string, framework?: string | null) {
  if (framework && FRAMEWORK_TO_ARTIFACT_CARD_ID[framework]) {
    return FRAMEWORK_TO_ARTIFACT_CARD_ID[framework];
  }
  return ARTIFACT_KEY_TO_CARD_ID[artifactKey] ?? null;
}

function summarizeArtifactValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `${value.length} 项`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.summary === "string") return record.summary;
    if (typeof record.root === "string") return record.root;
    return `${Object.keys(record).length} 个字段`;
  }
  if (value == null) return "";
  return String(value);
}

function makeArchitectArtifact(input: {
  artifactKey: string;
  data: unknown;
  phase?: string | null;
  cardId?: string | null;
  contractId?: string | null;
  title?: string;
  summary?: string;
  id?: string;
  stale?: boolean;
}): ArchitectArtifact {
  const cardId = input.cardId ?? inferArtifactCardId(input.artifactKey);
  return {
    id: input.id ?? toArtifactId(input.artifactKey, input.phase),
    artifactKey: input.artifactKey,
    title: input.title ?? ARTIFACT_LABELS[input.artifactKey] ?? input.artifactKey,
    summary: input.summary ?? summarizeArtifactValue(input.data),
    phase: input.phase ?? null,
    cardId,
    contractId: input.contractId ?? (cardId ? CARD_ID_TO_CONTRACT_ID[cardId] : null) ?? null,
    stale: input.stale,
    data: input.data,
  };
}

export function normalizeArchitectPhaseSummary(raw: Record<string, unknown>): ArchitectPhaseSummary {
  const outputs = (raw.outputs as Record<string, unknown>) || {};
  const artifacts = Object.fromEntries(
    Object.entries(outputs).filter(([key]) => !STRUCTURED_PHASE_SUMMARY_KEYS.has(key)),
  );
  return {
    phase: (raw.phase as string) || "",
    summary: (raw.summary as string) || (outputs.summary as string) || "",
    deliverables:
      (raw.deliverables as string[])
      || (outputs.deliverables as string[])
      || Object.keys(outputs).filter((key) => key !== "summary" && key !== "confidence" && key !== "ready_for_next"),
    confidence:
      (typeof raw.confidence === "number" ? raw.confidence : undefined)
      ?? (typeof outputs.confidence === "number" ? outputs.confidence : undefined)
      ?? (((raw.confirmed || outputs.confirmed) ? 80 : 50)),
    ready_for_next:
      (typeof raw.ready_for_next === "boolean" ? raw.ready_for_next : undefined)
      ?? (typeof raw.confirmed === "boolean" ? raw.confirmed : undefined)
      ?? (typeof outputs.ready_for_next === "boolean" ? outputs.ready_for_next : undefined)
      ?? false,
    artifacts: Object.keys(artifacts).length > 0 ? artifacts : undefined,
  };
}

export function normalizeArchitectStructure(raw: Record<string, unknown>): ArchitectStructure {
  if (raw.nodes) {
    return raw as unknown as ArchitectStructure;
  }
  const innerData = (raw.data as Record<string, unknown>) || {};
  const nodes = (innerData.nodes as ArchitectStructure["nodes"]) || [];
  return {
    type: (raw.type as ArchitectStructure["type"]) || "issue_tree",
    root: (raw.root as string) || (raw.title as string) || (innerData.root as string) || "",
    nodes: nodes.length > 0
      ? nodes
      : [{ id: "root", label: (raw.title as string) || (innerData.root as string) || "", parent: null, children: [] }],
  };
}

export function normalizeArchitectPriorityMatrix(raw: Record<string, unknown>): ArchitectPriorityMatrix {
  if (raw.dimensions) {
    return raw as unknown as ArchitectPriorityMatrix;
  }
  const items = (raw.items as { label?: string; name?: string; priority?: string; reason?: string; sensitivity?: string }[]) || [];
  return {
    dimensions: items.map((item) => ({
      name: item.label || item.name || "",
      priority: (item.priority as "P0" | "P1" | "P2") || "P2",
      sensitivity:
        (item.sensitivity as "high" | "medium" | "low")
        || (item.priority === "P0" ? "high" : item.priority === "P1" ? "medium" : "low"),
      reason: item.reason || "",
    })),
  };
}

export function normalizeArchitectOodaDecision(raw: Record<string, unknown>): ArchitectOodaDecision {
  return {
    ooda_round: (raw.ooda_round as number) ?? (raw.round as number) ?? 1,
    observation: (raw.observation as string) || (raw.reason as string) || "",
    orientation: (raw.orientation as string) || ((raw.rollback_to ? `回调至 ${raw.rollback_to}` : (raw.action as string)) || ""),
    decision: (raw.decision as string) || (raw.action as string) || "",
    delta_from_last: (raw.delta_from_last as string) || (raw.rollback_to ? `将回调到 ${raw.rollback_to}` : ""),
  };
}

export function normalizeArchitectReadyForDraft(raw: Record<string, unknown>): ArchitectReadyForDraft {
  if (raw.key_elements) {
    return raw as unknown as ArchitectReadyForDraft;
  }
  const summary = (raw.summary as Record<string, unknown>) || {};
  return {
    key_elements:
      (summary.key_elements as ArchitectReadyForDraft["key_elements"])
      || Object.entries(summary)
        .filter(([key]) => key !== "failure_prevention" && key !== "draft_approach")
        .map(([key, value]) => ({ name: key, priority: "P1", source_phase: String(value) })),
    failure_prevention: (summary.failure_prevention as string[]) || [],
    draft_approach: (summary.draft_approach as string) || (raw.exit_to as string) || "generate_draft",
  };
}

export function buildArchitectArtifactsFromPhaseSummary(summary: ArchitectPhaseSummary): ArchitectArtifact[] {
  return Object.entries(summary.artifacts || {}).map(([artifactKey, value]) => makeArchitectArtifact({
    artifactKey,
    data: value,
    phase: summary.phase,
    id: toArtifactId(artifactKey, summary.phase),
  }));
}

export function buildArchitectArtifactFromStructure(structure: ArchitectStructure, phase?: string | null): ArchitectArtifact {
  return makeArchitectArtifact({
    artifactKey: structure.type,
    data: structure,
    phase,
    title: ARTIFACT_LABELS[structure.type] ?? structure.type,
    summary: structure.root,
  });
}

export function buildArchitectArtifactFromPriorityMatrix(matrix: ArchitectPriorityMatrix, phase?: string | null): ArchitectArtifact {
  return makeArchitectArtifact({
    artifactKey: "priority_matrix",
    data: matrix,
    phase,
    summary: `${matrix.dimensions.length} 个维度已分级`,
  });
}

export function buildArchitectArtifactFromOodaDecision(decision: ArchitectOodaDecision, phase?: string | null): ArchitectArtifact {
  return makeArchitectArtifact({
    artifactKey: "ooda_rounds",
    data: decision,
    phase,
    id: toArtifactId("ooda_rounds", phase, decision.ooda_round),
    summary: decision.decision,
  });
}

export function buildArchitectArtifactFromReadyForDraft(ready: ArchitectReadyForDraft): ArchitectArtifact {
  return makeArchitectArtifact({
    artifactKey: "ready_for_draft_summary",
    data: ready,
    phase: "ready_for_draft",
    summary: `${ready.key_elements.length} 个关键要素 · ${ready.failure_prevention.length} 条失败预防`,
  });
}

export function normalizeArchitectArtifactPayload(raw: Record<string, unknown>): ArchitectArtifact | null {
  const patchPayload = raw.patch_type === "artifact_patch" && raw.payload && typeof raw.payload === "object"
    ? raw.payload as Record<string, unknown>
    : raw;
  const artifactKey =
    (typeof patchPayload.artifact_key === "string" && patchPayload.artifact_key)
    || (typeof patchPayload.key === "string" && patchPayload.key)
    || (typeof patchPayload.type === "string" && patchPayload.type)
    || "generic";
  const artifact = "artifact" in patchPayload ? patchPayload.artifact : patchPayload.data;
  if (artifact == null && !("summary" in patchPayload)) return null;
  const cardId = typeof patchPayload.card_id === "string" ? patchPayload.card_id : inferArtifactCardId(artifactKey);
  return makeArchitectArtifact({
    artifactKey,
    data: artifact ?? patchPayload,
    phase: typeof patchPayload.phase === "string" ? patchPayload.phase : null,
    cardId,
    contractId: typeof patchPayload.contract_id === "string" ? patchPayload.contract_id : null,
    title: typeof patchPayload.title === "string" ? patchPayload.title : undefined,
    summary: typeof patchPayload.summary === "string" ? patchPayload.summary : undefined,
    id: typeof patchPayload.id === "string"
      ? patchPayload.id
      : toArtifactId(artifactKey, typeof patchPayload.phase === "string" ? patchPayload.phase : null),
    stale: typeof patchPayload.stale === "boolean" ? patchPayload.stale : undefined,
  });
}

function uniqueArtifacts(artifacts: ArchitectArtifact[]) {
  const map = new Map<string, ArchitectArtifact>();
  for (const artifact of artifacts) {
    map.set(artifact.id, artifact);
  }
  return Array.from(map.values());
}

function buildPlaceholder(parsed: Omit<ParsedStructuredStudioMessage, "cleanText">): string {
  if (parsed.draft) {
    return "草稿已生成，请在右侧草稿卡中查看并决定是否应用。";
  }
  if (parsed.summary) {
    return "需求摘要已生成，请先确认后再继续。";
  }
  if (parsed.pendingPhaseSummary) {
    return "阶段总结已生成，请在下方确认卡中查看并决定是否进入下一阶段。";
  }
  if (parsed.architectReady) {
    return "收敛摘要已生成，请在下方卡片中确认后再生成草稿。";
  }
  if (parsed.auditResult || parsed.pendingGovernanceActions.length > 0) {
    return "治理建议已生成，请在下方卡片中查看并决定是否采纳。";
  }
  if (parsed.fileSplit) {
    return "拆分建议已生成，请在右侧卡片中查看并决定是否应用。";
  }
  if (parsed.toolSuggestion) {
    return "工具建议已生成，请在右侧卡片中查看并决定是否处理。";
  }
  if (
    parsed.phaseProgress.length > 0
    || parsed.architectQuestions.length > 0
    || parsed.architectStructures.length > 0
    || parsed.architectPriorities.length > 0
    || parsed.oodaDecisions.length > 0
    || parsed.architectArtifacts.length > 0
  ) {
    return "架构分析结果已更新，请在下方卡片中继续。";
  }
  return "结构化结果已生成，请查看下方内容。";
}

export function parseStructuredStudioMessage(text: string): ParsedStructuredStudioMessage {
  let draft: StudioDraft | null = null;
  let summary: StudioSummary | null = null;
  let toolSuggestion: StudioToolSuggestion | null = null;
  let fileSplit: StudioFileSplit | null = null;
  let auditResult: AuditResult | null = null;
  let pendingPhaseSummary: ArchitectPhaseSummary | null = null;
  let architectReady: ArchitectReadyForDraft | null = null;

  const pendingGovernanceActions: GovernanceActionCard[] = [];
  const phaseProgress: PhaseProgress[] = [];
  const architectQuestions: ArchitectQuestion[] = [];
  const architectStructures: ArchitectStructure[] = [];
  const architectPriorities: ArchitectPriorityMatrix[] = [];
  const oodaDecisions: ArchitectOodaDecision[] = [];
  const architectArtifacts: ArchitectArtifact[] = [];

  let match: RegExpExecArray | null;
  while ((match = STRUCTURED_BLOCK_PATTERN.exec(text)) !== null) {
    const evtName = match[1]?.toLowerCase();
    const raw = match[2]?.trim();
    if (!evtName || !raw) continue;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (evtName === "studio_draft" && typeof payload.system_prompt === "string") {
      draft = {
        name: typeof payload.name === "string" ? payload.name : undefined,
        description: typeof payload.description === "string" ? payload.description : undefined,
        system_prompt: payload.system_prompt,
        change_note: typeof payload.change_note === "string" ? payload.change_note : undefined,
      };
    } else if (evtName === "studio_summary") {
      summary = payload as unknown as StudioSummary;
    } else if (evtName === "studio_tool_suggestion") {
      toolSuggestion = payload as unknown as StudioToolSuggestion;
    } else if (evtName === "studio_file_split") {
      fileSplit = payload as unknown as StudioFileSplit;
    } else if (evtName === "studio_audit") {
      auditResult = normalizeAuditResult(payload);
    } else if (evtName === "studio_governance_action") {
      pendingGovernanceActions.push(payload as unknown as GovernanceActionCard);
    } else if (evtName === "studio_phase_progress") {
      phaseProgress.push(payload as unknown as PhaseProgress);
    } else if (evtName === "artifact_patch" || evtName === "architect_artifact") {
      const artifact = normalizeArchitectArtifactPayload(payload);
      if (artifact) architectArtifacts.push(artifact);
    } else if (evtName === "architect_question") {
      const question = payload as unknown as ArchitectQuestion;
      architectQuestions.push(question);
      architectArtifacts.push(makeArchitectArtifact({
        artifactKey: "question",
        data: question,
        phase: question.phase,
        cardId: inferArtifactCardId("question", question.framework),
        id: toArtifactId("question", question.phase, architectQuestions.length),
        title: question.framework || "架构问题",
        summary: question.question,
      }));
    } else if (evtName === "architect_phase_summary") {
      pendingPhaseSummary = normalizeArchitectPhaseSummary(payload);
      architectArtifacts.push(...buildArchitectArtifactsFromPhaseSummary(pendingPhaseSummary));
    } else if (evtName === "architect_structure") {
      const structure = normalizeArchitectStructure(payload);
      architectStructures.push(structure);
      architectArtifacts.push(buildArchitectArtifactFromStructure(structure, payload.phase as string | null | undefined));
    } else if (evtName === "architect_priority_matrix") {
      const matrix = normalizeArchitectPriorityMatrix(payload);
      architectPriorities.push(matrix);
      architectArtifacts.push(buildArchitectArtifactFromPriorityMatrix(matrix, payload.phase as string | null | undefined));
    } else if (evtName === "architect_ooda_decision") {
      const decision = normalizeArchitectOodaDecision(payload);
      oodaDecisions.push(decision);
      architectArtifacts.push(buildArchitectArtifactFromOodaDecision(decision, payload.phase as string | null | undefined));
    } else if (evtName === "architect_ready_for_draft") {
      architectReady = normalizeArchitectReadyForDraft(payload);
      architectArtifacts.push(buildArchitectArtifactFromReadyForDraft(architectReady));
    }
  }

  let cleanText = text.replace(STRUCTURED_BLOCK_PATTERN, "");
  cleanText = cleanText.replace(TRAILING_OPEN_BLOCK_PATTERN, "");
  const studioMetaResult = extractStudioMeta(cleanText);
  cleanText = studioMetaResult.cleanText;

  const parsedWithoutText = {
    studioMeta: studioMetaResult.meta,
    draft,
    summary,
    toolSuggestion,
    fileSplit,
    auditResult,
    pendingGovernanceActions,
    phaseProgress,
    architectQuestions,
    architectStructures,
    architectPriorities,
    oodaDecisions,
    pendingPhaseSummary,
    architectReady,
    architectArtifacts: uniqueArtifacts(architectArtifacts),
  };

  if (!cleanText) {
    cleanText = buildPlaceholder(parsedWithoutText);
  }

  return {
    cleanText,
    ...parsedWithoutText,
  };
}
