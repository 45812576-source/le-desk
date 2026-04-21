"use client";

import type {
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

const STRUCTURED_BLOCK_PATTERN = /```(studio_draft|studio_diff|studio_test_result|studio_summary|studio_tool_suggestion|studio_file_split|studio_memo_status|studio_task_focus|studio_editor_target|studio_persistent_notices|studio_context_rollup|studio_audit|studio_governance_action|studio_phase_progress|architect_question|architect_phase_summary|architect_structure|architect_priority_matrix|architect_ooda_decision|architect_ready_for_draft)\s*\n([\s\S]*?)\n```/gi;

const TRAILING_OPEN_BLOCK_PATTERN = /```(?:studio_\w+|architect_\w+)\s*[\s\S]*$/g;

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

function normalizePhaseSummary(raw: Record<string, unknown>): ArchitectPhaseSummary {
  const outputs = (raw.outputs as Record<string, unknown>) || {};
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
      ?? (((raw.confirmed || outputs.confirmed) ? 0.8 : 0.5)),
    ready_for_next:
      (typeof raw.ready_for_next === "boolean" ? raw.ready_for_next : undefined)
      ?? (typeof raw.confirmed === "boolean" ? raw.confirmed : undefined)
      ?? (typeof outputs.ready_for_next === "boolean" ? outputs.ready_for_next : undefined)
      ?? false,
  };
}

function normalizeStructure(raw: Record<string, unknown>): ArchitectStructure {
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

function normalizePriorityMatrix(raw: Record<string, unknown>): ArchitectPriorityMatrix {
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

function normalizeOodaDecision(raw: Record<string, unknown>): ArchitectOodaDecision {
  return {
    ooda_round: (raw.ooda_round as number) ?? (raw.round as number) ?? 1,
    observation: (raw.observation as string) || (raw.reason as string) || "",
    orientation: (raw.orientation as string) || ((raw.rollback_to ? `回调至 ${raw.rollback_to}` : (raw.action as string)) || ""),
    decision: (raw.decision as string) || (raw.action as string) || "",
    delta_from_last: (raw.delta_from_last as string) || (raw.rollback_to ? `将回调到 ${raw.rollback_to}` : ""),
  };
}

function normalizeReadyForDraft(raw: Record<string, unknown>): ArchitectReadyForDraft {
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
    } else if (evtName === "architect_question") {
      architectQuestions.push(payload as unknown as ArchitectQuestion);
    } else if (evtName === "architect_phase_summary") {
      pendingPhaseSummary = normalizePhaseSummary(payload);
    } else if (evtName === "architect_structure") {
      architectStructures.push(normalizeStructure(payload));
    } else if (evtName === "architect_priority_matrix") {
      architectPriorities.push(normalizePriorityMatrix(payload));
    } else if (evtName === "architect_ooda_decision") {
      oodaDecisions.push(normalizeOodaDecision(payload));
    } else if (evtName === "architect_ready_for_draft") {
      architectReady = normalizeReadyForDraft(payload);
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
  };

  if (!cleanText) {
    cleanText = buildPlaceholder(parsedWithoutText);
  }

  return {
    cleanText,
    ...parsedWithoutText,
  };
}
