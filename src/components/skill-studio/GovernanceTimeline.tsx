"use client";

import { memo } from "react";
import type { StudioDeepPatch } from "./workflow-protocol";
import type { ChatMessage, GovernanceCardData, GovernanceAction, AuditResult, GovernanceActionCard, PhaseProgress, ArchitectArtifact, ArchitectPhaseStatus, ArchitectQuestion, ArchitectPhaseSummary, ArchitectStructure, ArchitectPriorityMatrix, ArchitectOodaDecision, ArchitectReadyForDraft } from "./types";
import { GovernanceCard } from "./cards/GovernanceCard";
import { ArchitectPhaseCard } from "./cards/ArchitectPhaseCard";
import { ArchitectQuestionCard } from "./cards/ArchitectQuestionCard";
import { ArchitectConfirmCard } from "./cards/ArchitectConfirmCard";
import { ArchitectStructureCard, PriorityMatrixView } from "./cards/ArchitectStructureCard";
import { OodaDecisionView, ReadyForDraftView } from "./cards/ArchitectDecisionCard";
import { PHASE_THEME } from "./RouteStatusBar";
import { FRAMEWORK_LABELS } from "./utils";

export interface TimelineQuickAction {
  label: string;
  msg: string;
  focusInput?: boolean;
  payload?: Record<string, unknown>;
}

// ─── AuditReportCard（六维度 + 分数条 + 阶段入口）──────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  low: "text-green-600 bg-green-50 border-green-200 dark:text-green-200 dark:bg-green-950/30 dark:border-green-900",
  medium: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
  high: "text-red-500 bg-red-50 border-red-200 dark:text-red-200 dark:bg-red-950/30 dark:border-red-900",
  critical: "text-red-700 bg-red-100 border-red-300 dark:text-red-100 dark:bg-red-950/50 dark:border-red-800",
};

const SCORE_BAR_COLORS: Record<string, string> = {
  high: "bg-green-500",
  medium: "bg-amber-400",
  low: "bg-red-400",
};

function scoreLevel(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const AuditReportCard = memo(function AuditReportCard({ audit, onDismiss }: { audit: AuditResult; onDismiss: () => void }) {
  const sevClass = SEVERITY_COLORS[audit.severity] || SEVERITY_COLORS.medium;
  const entryTheme = audit.phase_entry ? PHASE_THEME[audit.phase_entry] : null;
  return (
    <div className={`mx-3 my-2 border ${sevClass} rounded-lg text-[9px] font-mono overflow-hidden`}>
      {/* 标题栏 */}
      <div className="px-3 py-2 border-b border-inherit flex items-center gap-2">
        <span className="font-bold uppercase tracking-widest text-[8px] flex-1">
          ◆ Skill 审计结论
        </span>
        <span className={`text-[11px] font-bold ${audit.quality_score >= 70 ? "text-green-600" : audit.quality_score >= 40 ? "text-amber-600" : "text-red-600"}`}>
          {audit.quality_score}
        </span>
        <span className="text-[7px] text-gray-400 dark:text-zinc-500">/100</span>
        <button onClick={onDismiss} className="text-[8px] opacity-40 hover:opacity-100 ml-1 dark:text-zinc-300">✕</button>
      </div>

      {/* 概要行 */}
      <div className="px-3 py-1.5 flex items-center gap-3 border-b border-inherit flex-wrap">
        <span>
          <span className="font-bold">严重度</span>
          <span className={`ml-1 px-1 py-0.5 text-[7px] font-bold uppercase ${sevClass}`}>{audit.severity}</span>
        </span>
        <span>
          <span className="font-bold">建议</span>
          <span className="ml-1">{audit.recommended_path === "restructure" ? "重构（回到问题定义）" : "优化（局部补强）"}</span>
        </span>
        {entryTheme && (
          <span className={`ml-auto px-1.5 py-0.5 text-[7px] font-bold uppercase ${entryTheme.text} ${entryTheme.bg} ${entryTheme.border} border`}>
            进入 {entryTheme.label}
          </span>
        )}
      </div>

      {/* 六维度评分列表 */}
      {audit.issues.length > 0 && (
        <div className="px-3 py-2 space-y-1.5">
          {audit.issues.map((issue, i) => {
            const level = scoreLevel(issue.score);
            const barColor = SCORE_BAR_COLORS[level];
            const fwLabel = issue.framework ? FRAMEWORK_LABELS[issue.framework] || issue.framework : null;
            return (
              <div key={i}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-bold w-20 flex-shrink-0 truncate">{issue.dimension}</span>
                  <div className="flex-1 h-1 bg-gray-200 dark:bg-zinc-800 relative">
                    <div className={`h-full ${barColor}`} style={{ width: `${issue.score}%` }} />
                  </div>
                  <span className={`w-6 text-right font-bold ${level === "high" ? "text-green-600" : level === "medium" ? "text-amber-600" : "text-red-500"}`}>
                    {issue.score}
                  </span>
                  {fwLabel && (
                    <span className="text-[7px] text-gray-400 dark:text-zinc-500 w-16 truncate text-right" title={fwLabel}>{fwLabel}</span>
                  )}
                </div>
                <div className="text-gray-500 dark:text-muted-foreground pl-[86px] text-[8px]">{issue.detail}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ─── GovernanceActionCard（阶段色带 + 框架标签）──────────────────────────────

const RISK_BADGE: Record<string, string> = {
  low: "bg-green-100 text-green-700 border-green-300 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900",
  medium: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900",
  high: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900",
};

const GovernanceActionCardComponent = memo(function GovernanceActionCardComponent({
  action,
  onAdopt,
}: {
  action: GovernanceActionCard;
  onAdopt: (a: GovernanceActionCard) => void;
}) {
  const riskClass = RISK_BADGE[action.risk_level] || RISK_BADGE.medium;
  const phaseTheme = action.phase ? PHASE_THEME[action.phase] : null;
  const fwLabel = action.framework ? FRAMEWORK_LABELS[action.framework] || action.framework : null;
  return (
    <div className={`mx-3 my-1.5 border ${phaseTheme ? phaseTheme.border : "border-[#00A3C4]/30 dark:border-cyan-900"} rounded-lg bg-white dark:bg-card text-[9px] font-mono overflow-hidden`}>
      {/* 标题栏：阶段色带 + 标题 + 风险徽章 */}
      <div className={`px-2.5 py-1.5 border-b ${phaseTheme ? phaseTheme.border : "border-gray-200 dark:border-zinc-700"} flex items-center gap-2`}>
        {phaseTheme && (
          <span className={`${phaseTheme.accent} text-white px-1 py-0.5 text-[6px] font-bold uppercase tracking-widest`}>
            {phaseTheme.label.split("·")[0].trim()}
          </span>
        )}
        <span className="font-bold text-[#1A202C] dark:text-foreground flex-1">{action.title}</span>
        <span className={`text-[7px] px-1 py-0.5 border font-bold uppercase ${riskClass}`}>
          {action.risk_level}
        </span>
      </div>
      {/* 正文 */}
      <div className="px-2.5 py-2">
        <p className="text-gray-600 dark:text-muted-foreground mb-1">{action.summary}</p>
        <div className="flex items-center gap-2 text-[8px] text-gray-400 dark:text-zinc-500 mb-1.5 flex-wrap">
          <span>原因：{action.reason}</span>
          {fwLabel && (
            <span className={`px-1 py-0.5 ${phaseTheme ? phaseTheme.bg : "bg-gray-100"} ${phaseTheme ? phaseTheme.text : "text-gray-500"} text-[7px]`}>
              {fwLabel}
            </span>
          )}
        </div>
        {action.staged_edit && (
          <button
            onClick={() => onAdopt(action)}
            className={`px-2 py-0.5 text-white text-[8px] font-bold uppercase tracking-widest transition-colors ${
              phaseTheme ? `${phaseTheme.accent} hover:opacity-80` : "bg-[#00A3C4] hover:bg-[#00D1FF]"
            }`}
          >
            采纳修改
          </button>
        )}
      </div>
    </div>
  );
});

const DeepPatchCard = memo(function DeepPatchCard({ patch }: { patch: StudioDeepPatch }) {
  const isEvidence = patch.patch_type === "evidence_patch";
  return (
    <div className="mx-3 my-1.5 border border-purple-300 dark:border-purple-800 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-[9px] font-mono overflow-hidden">
      <div className="px-3 py-1.5 border-b border-purple-300 dark:border-purple-800 flex items-center gap-2">
        <span className="bg-purple-600 dark:bg-purple-500 text-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest">
          {isEvidence ? "Evidence" : "Deep Lane"}
        </span>
        <span className="text-purple-700 dark:text-purple-200 font-bold text-[8px] uppercase tracking-widest flex-1">
          {patch.title}
        </span>
        <span className="text-[7px] text-purple-500 dark:text-purple-300">
          v{patch.run_version} · #{patch.patch_seq}
        </span>
      </div>
      <div className="px-3 py-2 space-y-1">
        {patch.summary && (
          <p className="text-[#1A202C] dark:text-foreground">{patch.summary}</p>
        )}
        {patch.evidence && patch.evidence.length > 0 && (
          <ul className="list-disc pl-4 text-gray-600 dark:text-muted-foreground space-y-0.5">
            {patch.evidence.map((item, index) => (
              <li key={`${patch.run_id}-${patch.patch_seq}-${index}`}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

// ─── PhaseProgressCard ───────────────────────────────────────────────────────

const PhaseProgressCard = memo(function PhaseProgressCard({ progress }: { progress: PhaseProgress }) {
  const theme = PHASE_THEME[progress.completed_phase] || PHASE_THEME.phase1;
  const nextTheme = progress.next_phase ? PHASE_THEME[progress.next_phase] : null;
  return (
    <div className={`mx-3 my-2 border ${theme.border} ${theme.bg} rounded-lg text-[9px] font-mono overflow-hidden`}>
      <div className={`px-3 py-1.5 border-b ${theme.border} flex items-center gap-2`}>
        <span className={`${theme.accent} text-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest`}>
          ✓ {theme.label}
        </span>
        <span className={`${theme.text} font-bold text-[8px] uppercase tracking-widest flex-1`}>完成</span>
      </div>
      <div className="px-3 py-2">
        <div className="mb-1.5">
          <span className="font-bold text-gray-500 text-[8px]">产出：</span>
          <span className="text-gray-600">{progress.deliverables.join(" · ")}</span>
        </div>
        {nextTheme && progress.next_label && (
          <div className={`mt-1 pt-1 border-t ${theme.border}`}>
            <span className={`${nextTheme.text} font-bold text-[8px]`}>
              → 下一步：{progress.next_label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Stage Indicator ─────────────────────────────────────────────────────────

function StageIndicator({ stage }: { stage: string | null }) {
  return (
    <span className="text-[#00A3C4] flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1 h-1 bg-[#00A3C4] rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
        ))}
      </span>
      {stage && <span className="text-[8px] font-bold uppercase tracking-widest">{stage}</span>}
    </span>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

const MessageBubble = memo(function MessageBubble({
  message,
  isLast,
  streaming,
  streamStage,
  quickActions,
  onQuickAction,
}: {
  message: ChatMessage;
  isLast: boolean;
  streaming: boolean;
  streamStage: string | null;
  quickActions?: TimelineQuickAction[];
  onQuickAction?: (action: TimelineQuickAction) => void;
}) {
  const isLongAssistant = message.role === "assistant" && !message.loading && message.text && message.text.length > 200;

  return (
    <div className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
      <div className={`max-w-[95%] px-3 py-2.5 text-[9px] font-mono leading-relaxed whitespace-pre-wrap border ${
        message.role === "user"
          ? "bg-[#1A202C] text-white border-[#1A202C] rounded-2xl rounded-br-sm"
          : "bg-[#F0F4F8] text-[#1A202C] border-gray-200 rounded-2xl rounded-bl-sm"
      } ${isLongAssistant ? "studio-collapsible" : ""}`}>
        {message.loading && !message.text ? (
          <StageIndicator stage={streaming ? streamStage : null} />
        ) : isLongAssistant ? (
          <details>
            <summary className="cursor-pointer select-none text-[8px] text-gray-400 hover:text-[#00A3C4] font-bold uppercase tracking-widest mb-1">
              {message.text!.slice(0, 80)}… <span className="text-[7px] normal-case font-normal">[展开全文]</span>
            </summary>
            <div className="mt-1 pt-1 border-t border-gray-200">{message.text}</div>
          </details>
        ) : (
          <>
            {message.text}
            {message.loading && <span className="animate-pulse text-[#00A3C4]"> ▋</span>}
          </>
        )}
      </div>
      {message.role === "assistant" && !message.loading && isLast && !streaming && quickActions && (
        <div className="flex gap-1 mt-1.5 flex-wrap max-w-[95%]">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => onQuickAction?.(action)}
              className="text-[7px] px-2 py-1 border border-gray-300 rounded-full text-gray-500 hover:border-[#00A3C4] hover:text-[#00A3C4] hover:bg-[#ECFBFF] transition-colors font-mono uppercase tracking-wider"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

const DEDICATED_ARTIFACT_KEYS = new Set([
  "question",
  "issue_tree",
  "dimension_map",
  "value_chain",
  "priority_matrix",
  "ooda_rounds",
  "ready_for_draft_summary",
]);

function formatArtifactLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderArchitectArtifactValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <p className="text-[#1A202C] dark:text-foreground">{String(value)}</p>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-1">
        {value.map((item, index) => (
          <li key={index} className="flex items-start gap-1.5 text-[#1A202C] dark:text-foreground">
            <span className="text-[#00A3C4]">•</span>
            <span>{typeof item === "string" ? item : JSON.stringify(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (value && typeof value === "object") {
    return (
      <div className="space-y-1">
        {Object.entries(value as Record<string, unknown>).map(([key, entry]) => (
          <div key={key} className="flex items-start gap-2">
            <span className="w-24 flex-shrink-0 text-[8px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
              {formatArtifactLabel(key)}
            </span>
            <div className="flex-1 min-w-0">
              {renderArchitectArtifactValue(entry)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-gray-400 dark:text-zinc-500">暂无结构化内容</p>;
}

const ArchitectArtifactPanel = memo(function ArchitectArtifactPanel({
  artifacts,
}: {
  artifacts: ArchitectArtifact[];
}) {
  const visibleArtifacts = artifacts.filter((artifact) => !DEDICATED_ARTIFACT_KEYS.has(artifact.artifactKey));
  if (visibleArtifacts.length === 0) return null;

  return (
    <div className="mx-3 my-2 border border-cyan-200 dark:border-cyan-900 rounded-lg overflow-hidden bg-cyan-50/60 dark:bg-cyan-950/20 text-[9px] font-mono">
      <div className="px-3 py-1.5 border-b border-cyan-200 dark:border-cyan-900 flex items-center gap-2">
        <span className="bg-[#00A3C4] text-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest">
          Artifacts
        </span>
        <span className="text-[#00A3C4] font-bold text-[8px] uppercase tracking-widest">
          Skill Architect 沉淀结果
        </span>
      </div>
      <div className="px-3 py-2 space-y-2">
        {visibleArtifacts.map((artifact) => (
          <div
            key={artifact.id}
            className={`rounded-md border px-2.5 py-2 ${
              artifact.stale
                ? "border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/20"
                : "border-white/70 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/50"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#1A202C] dark:text-foreground">{artifact.title}</span>
              {artifact.phase && (
                <span className="text-[7px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
                  {artifact.phase}
                </span>
              )}
              {artifact.stale && (
                <span className="text-[7px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-300">
                  stale
                </span>
              )}
            </div>
            {artifact.summary && (
              <p className="mt-1 text-gray-500 dark:text-muted-foreground">{artifact.summary}</p>
            )}
            <div className="mt-2">
              {renderArchitectArtifactValue(artifact.data)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── GovernanceTimeline ──────────────────────────────────────────────────────

export function GovernanceTimeline({
  messages,
  streaming,
  streamStage,
  governanceCards,
  auditResult,
  pendingGovernanceActions,
  deepPatches = [],
  phaseProgress = [],
  architectPhase,
  architectQuestions = [],
  answeredQuestionIdx = -1,
  pendingPhaseSummary,
  confirmedPhases = [],
  architectArtifacts = [],
  architectStructures = [],
  architectPriorities = [],
  oodaDecisions = [],
  architectReady,
  onGovernanceAction,
  onOpenGovernanceTarget,
  onDismissGovernance,
  onDismissAudit,
  onAdoptGovernanceAction,
  onQuickAction,
  overrideQuickActions,
  onArchitectAnswer,
  onArchitectCustom,
  onArchitectConfirm,
  onArchitectRevise,
  onOodaContinue,
  onGenerateDraft,
  onGovernanceComplete,
  compact = false,
}: {
  messages: ChatMessage[];
  streaming: boolean;
  streamStage: string | null;
  governanceCards: GovernanceCardData[];
  auditResult: AuditResult | null;
  pendingGovernanceActions: GovernanceActionCard[];
  deepPatches?: StudioDeepPatch[];
  phaseProgress?: PhaseProgress[];
  architectPhase?: ArchitectPhaseStatus | null;
  architectQuestions?: ArchitectQuestion[];
  answeredQuestionIdx?: number;
  pendingPhaseSummary?: ArchitectPhaseSummary | null;
  confirmedPhases?: string[];
  architectArtifacts?: ArchitectArtifact[];
  architectStructures?: ArchitectStructure[];
  architectPriorities?: ArchitectPriorityMatrix[];
  onGovernanceAction: (card: GovernanceCardData, action: GovernanceAction) => void;
  onOpenGovernanceTarget?: (card: GovernanceCardData) => void;
  onDismissGovernance: (card: GovernanceCardData) => void;
  onDismissAudit: () => void;
  onAdoptGovernanceAction: (action: GovernanceActionCard) => void;
  onQuickAction: (action: TimelineQuickAction) => void;
  overrideQuickActions?: TimelineQuickAction[] | null;
  onArchitectAnswer?: (answer: string) => void;
  onArchitectCustom?: (text: string) => void;
  onArchitectConfirm?: () => void;
  onArchitectRevise?: (note: string) => void;
  oodaDecisions?: ArchitectOodaDecision[];
  architectReady?: ArchitectReadyForDraft | null;
  onOodaContinue?: () => void;
  onGenerateDraft?: () => void;
  onGovernanceComplete?: () => void;
  compact?: boolean;
}) {
  const pendingCards = governanceCards.filter((c) => c.status === "pending");
  const resolvedCards = governanceCards.filter((c) => c.status !== "pending");
  const hasPhase3Progress = phaseProgress.some((pp) => pp.completed_phase === "phase3");
  const showGovernanceSection = !compact && phaseProgress.length > 0 && (
    pendingCards.length > 0 ||
    resolvedCards.length > 0 ||
    !!auditResult ||
    pendingGovernanceActions.length > 0
  );
  const governanceCompleted = !compact && hasPhase3Progress &&
    governanceCards.length > 0 &&
    pendingCards.length === 0 &&
    pendingGovernanceActions.length === 0 &&
    !auditResult;
  const quickActions = overrideQuickActions ?? [
    { label: "补齐描述", msg: "请直接补一版用于检索、展示和审核的 Skill 描述，要求短、准、可读" },
    { label: "重写定位", msg: "请基于现有上下文，重写这个 Skill 的定位、适用对象、核心任务和边界" },
    { label: "输出草稿", msg: "信息足够了，请直接输出完整可用的 SKILL.md 草稿" },
    { label: "只改这段", msg: "不要重写全文，只修改我刚才指出的那一段，保持其他部分不变" },
    { label: "收敛成版", msg: "请按当前结论整理成可直接采纳的最终版本，不再继续追问" },
  ];
  const showDeepSection = !compact && deepPatches.length > 0;

  return (
    <>
      {/* Message bubbles */}
      {messages.map((m, i) => (
        <MessageBubble
          key={i}
          message={m}
          isLast={i === messages.length - 1}
          streaming={streaming}
          streamStage={streamStage}
          quickActions={i === messages.length - 1 ? quickActions : undefined}
          onQuickAction={i === messages.length - 1 ? onQuickAction : undefined}
        />
      ))}

      {/* Architect phase status card */}
      {architectPhase && (
        <ArchitectPhaseCard phase={architectPhase} />
      )}

      {/* Architect question cards */}
      {architectQuestions.map((q, i) => (
        <ArchitectQuestionCard
          key={`aq-${i}`}
          question={q}
          answered={i <= answeredQuestionIdx}
          answeredText={i <= answeredQuestionIdx ? undefined : undefined}
          onAnswer={(answer) => onArchitectAnswer?.(answer)}
          onCustom={(text) => onArchitectCustom?.(text)}
        />
      ))}

      <ArchitectArtifactPanel artifacts={architectArtifacts} />

      {/* Architect structure cards (issue tree / dimension map / value chain) */}
      {architectStructures.map((s, i) => (
        <ArchitectStructureCard key={`as-${i}`} structure={s} />
      ))}

      {/* Architect priority matrix cards */}
      {architectPriorities.map((m, i) => (
        <PriorityMatrixView key={`pm-${i}`} matrix={m} />
      ))}

      {/* Architect phase confirm card */}
      {pendingPhaseSummary && (
        <ArchitectConfirmCard
          summary={pendingPhaseSummary}
          confirmed={confirmedPhases.includes(pendingPhaseSummary.phase)}
          onConfirm={() => onArchitectConfirm?.()}
          onRevise={(note) => onArchitectRevise?.(note)}
        />
      )}

      {/* OODA decision cards */}
      {oodaDecisions.map((d, i) => (
        <OodaDecisionView
          key={`ooda-${i}`}
          decision={d}
          phaseStatus={architectPhase ?? null}
          onContinue={() => onOodaContinue?.()}
        />
      ))}

      {/* Ready for draft card */}
      {architectReady && (
        <ReadyForDraftView
          ready={architectReady}
          onGenerateDraft={() => onGenerateDraft?.()}
        />
      )}

      {/* Phase progress cards */}
      {!compact && phaseProgress.map((pp) => (
        <PhaseProgressCard key={pp.completed_phase} progress={pp} />
      ))}

      {/* Architect → Governance transition divider */}
      {showGovernanceSection && (
        <div className="mx-3 my-2 flex items-center gap-2 text-[8px] font-mono text-gray-400 dark:text-muted-foreground">
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
          <span className="font-bold uppercase tracking-widest">治理 · Governance</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
        </div>
      )}

      {/* Governance cards from store (new structured events) */}
      {pendingCards.map((card) => (
        <GovernanceCard
          key={card.id}
          card={card}
          onAction={onGovernanceAction}
          onOpenTarget={onOpenGovernanceTarget}
          onDismiss={onDismissGovernance}
        />
      ))}

      {!compact && resolvedCards.length > 0 && (
        <div className="space-y-1">
          <div className="mx-3 mt-2 flex items-center gap-2 text-[8px] font-mono text-gray-400 dark:text-muted-foreground">
            <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
            <span className="font-bold uppercase tracking-widest">已处理整改项</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-800" />
          </div>
          {resolvedCards.map((card) => (
            <GovernanceCard
              key={card.id}
              card={card}
              onAction={onGovernanceAction}
              onOpenTarget={onOpenGovernanceTarget}
            />
          ))}
        </div>
      )}

      {/* Audit report */}
      {!compact && auditResult && (
        <AuditReportCard audit={auditResult} onDismiss={onDismissAudit} />
      )}

      {/* Governance action cards */}
      {pendingGovernanceActions.map((ga) => (
        <GovernanceActionCardComponent
          key={ga.card_id}
          action={ga}
          onAdopt={onAdoptGovernanceAction}
        />
      ))}

      {showDeepSection && (
        <div className="mx-3 my-2 flex items-center gap-2 text-[8px] font-mono text-purple-500 dark:text-purple-300">
          <div className="flex-1 h-px bg-purple-200 dark:bg-purple-900" />
          <span className="font-bold uppercase tracking-widest">Deep Lane 补完</span>
          <div className="flex-1 h-px bg-purple-200 dark:bg-purple-900" />
        </div>
      )}

      {!compact && deepPatches.map((patch) => (
        <DeepPatchCard key={`${patch.run_id}:${patch.patch_seq}`} patch={patch} />
      ))}

      {governanceCompleted && (
        <div className="mx-3 my-2 border border-emerald-300 dark:border-emerald-800 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-[9px] font-mono overflow-hidden">
          <div className="px-3 py-1.5 border-b border-emerald-300 dark:border-emerald-800 flex items-center gap-2">
            <span className="bg-emerald-600 dark:bg-emerald-500 text-white px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest">
              ✓ Governance
            </span>
            <span className="text-emerald-700 dark:text-emerald-200 font-bold text-[8px] uppercase tracking-widest flex-1">
              本轮整改已处理完成
            </span>
          </div>
          <div className="px-3 py-2 space-y-2">
            <p className="text-[#1A202C] dark:text-foreground">
              已没有待采纳卡片。下一步应继续验收或进入最终草稿生成，而不是重复口头描述整改项。
            </p>
            <button
              onClick={() => onGovernanceComplete?.()}
              className="px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-white bg-emerald-600 dark:bg-emerald-500 hover:opacity-80 transition-colors"
            >
              继续下一步
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Re-export for backward compatibility
export { AuditReportCard, DeepPatchCard, GovernanceActionCardComponent, PhaseProgressCard };
