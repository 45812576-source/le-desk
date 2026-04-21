"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, FlaskConical, ShieldCheck, Sparkles } from "lucide-react";
import type {
  TestFlowBlockedBefore,
  TestFlowBlockedStage,
  TestFlowEntrySource,
  TestFlowGateReason,
  TestFlowGuidedStep,
  TestFlowPlanSummary,
} from "@/lib/test-flow-types";
import type { SkillDetail, SkillMemo, SandboxReport } from "@/lib/types";
import { CaseGenerationGateCard } from "./CaseGenerationGateCard";
import type { WorkflowStateData } from "./workflow-protocol";
import type { WorkbenchCard } from "./workbench";

export type WorkspaceAction = {
  id: string;
  label: string;
  tone?: "primary" | "secondary" | "danger";
  onClick: () => void;
};

type WorkspaceActionSection = {
  title: string;
  actions: WorkspaceAction[];
};

export type WorkspaceMetric = {
  label: string;
  value: string;
  hint?: string | null;
  tone?: "cyan" | "amber";
};

export type WorkspaceSummaryItem = {
  icon: ReactNode;
  label: string;
  text: string;
  tone?: "neutral" | "warn" | "success";
};

export type WorkspaceDescriptor = {
  description: string;
  metrics: WorkspaceMetric[];
  summaries: WorkspaceSummaryItem[];
};

export type WorkspaceGovernanceIntent = {
  mode: "mount_blocked" | "choose_existing_plan" | "generate_cases";
  entrySource: TestFlowEntrySource;
  conversationId: number;
  triggerMessage: string;
  latestPlan: TestFlowPlanSummary | null;
  mountCta?: string | null;
  blockedStage?: TestFlowBlockedStage | null;
  blockedBefore?: TestFlowBlockedBefore | null;
  caseGenerationAllowed?: boolean;
  qualityEvaluationStarted?: boolean;
  verdictLabel?: string | null;
  verdictReason?: string | null;
  gateSummary?: string | null;
  gateReasons?: TestFlowGateReason[];
  guidedSteps?: TestFlowGuidedStep[];
  primaryAction?: string | null;
} | null;

const NEXT_ACTION_LABELS: Record<string, string> = {
  collect_requirements: "继续收集需求",
  review_cards: "处理整改卡片",
  continue_chat: "继续对话推进",
  start_editing: "开始编辑",
  continue_editing: "继续编辑",
  generate_draft: "生成草稿",
  generate_outline: "生成目录",
  generate_section: "生成章节",
  run_preflight: "运行 Preflight",
  run_sandbox: "运行 Sandbox",
  run_targeted_rerun: "运行局部重测",
  import_remediation: "导入整改",
  submit_approval: "提交审批",
};

function actionButtonClass(tone: WorkspaceAction["tone"]) {
  if (tone === "primary") {
    return "border-[#1A202C] bg-[#00A3C4] text-white hover:opacity-90";
  }
  if (tone === "danger") {
    return "border-[#1A202C] bg-[#E11D48] text-white hover:opacity-90";
  }
  return "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#ECFBFF]";
}

function Panel({
  title,
  eyebrow,
  children,
  tone = "cyan",
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  tone?: "cyan" | "amber";
}) {
  return (
    <div className="border-2 border-[#1A202C] bg-white p-5">
      <div className={`text-[8px] font-bold uppercase tracking-[0.24em] ${tone === "amber" ? "text-[#F59E0B]" : "text-[#00A3C4]"}`}>
        {eyebrow}
      </div>
      <div className="mt-3 text-lg font-bold text-[#1A202C]">
        {title}
      </div>
      <div className="mt-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone = "cyan",
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: "cyan" | "amber";
}) {
  return (
    <div className={`border p-3 ${tone === "amber" ? "border-[#F59E0B]/20 bg-[#FFFBF2]" : "border-[#1A202C]/10 bg-[#F8FCFD]"}`}>
      <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{label}</div>
      <div className="mt-2 text-sm font-bold text-[#1A202C] break-words">{value}</div>
      {hint && (
        <div className="mt-2 text-[10px] leading-relaxed text-gray-500">{hint}</div>
      )}
    </div>
  );
}

export function MetricGrid({ metrics }: { metrics: WorkspaceMetric[] }) {
  if (metrics.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map((metric) => (
        <MetricCard
          key={`${metric.label}:${metric.value}`}
          label={metric.label}
          value={metric.value}
          hint={metric.hint}
          tone={metric.tone}
        />
      ))}
    </div>
  );
}

export function ActionGroup({
  title,
  actions,
}: {
  title: string;
  actions: WorkspaceAction[];
}) {
  if (actions.length === 0) return null;
  return (
    <div>
      <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={action.onClick}
            className={`border-2 px-3 py-2 text-[10px] font-bold transition-colors ${actionButtonClass(action.tone)}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function buildAction(
  id: string,
  label: string,
  onClick: () => void,
  tone?: WorkspaceAction["tone"],
): WorkspaceAction {
  return { id, label, onClick, tone };
}

function dedupeActions(actions: WorkspaceAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

export function buildWorkspaceActionSections(input: {
  kind: "analysis" | "governance" | "report";
  workflowState?: WorkflowStateData | null;
  memo?: SkillMemo | null;
  nextPendingCard?: WorkbenchCard | null;
  hasGovernanceQueue?: boolean;
  hasLatestTest?: boolean;
  onSelectWorkbenchCard: (cardId: string) => void;
  onOpenPrompt?: () => void;
  onOpenGovernancePanel?: () => void;
  onOpenSandbox?: () => void;
  onFocusChat?: (text: string) => void;
  activeCardActions: WorkspaceAction[];
}) {
  const actions: WorkspaceAction[] = [];
  const nextActionLabel = NEXT_ACTION_LABELS[input.workflowState?.next_action || "continue_chat"] || "继续推进";
  const nextPendingCard = input.nextPendingCard || null;

  if (nextPendingCard) {
    actions.push(
      buildAction(
        `${input.kind}:next-card`,
        "继续下一项",
        () => input.onSelectWorkbenchCard(nextPendingCard.id),
        "primary",
      ),
    );
  }

  if (input.kind === "analysis" && input.onFocusChat) {
    actions.push(
      buildAction(
        "analysis:continue",
        nextActionLabel,
        () => input.onFocusChat?.(buildAnalysisContinueMessage(input.workflowState || null, input.memo || null)),
        nextPendingCard ? "secondary" : "primary",
      ),
    );
  }

  if (input.kind === "report" && input.onOpenSandbox) {
    actions.push(
      buildAction(
        "report:open-sandbox",
        "打开 Sandbox",
        input.onOpenSandbox,
        nextPendingCard ? "secondary" : "primary",
      ),
    );
  }

  if (input.onOpenGovernancePanel) {
    actions.push(
      buildAction(
        `${input.kind}:open-governance`,
        input.kind === "governance" ? "展开治理面板" : "打开治理面板",
        input.onOpenGovernancePanel,
        input.kind === "governance" && !nextPendingCard ? "primary" : "secondary",
      ),
    );
  }

  if (input.onOpenPrompt && input.kind !== "report") {
    actions.push(
      buildAction(`${input.kind}:open-prompt`, "打开主 Prompt", input.onOpenPrompt, "secondary"),
    );
  }

  if (input.kind === "analysis" && input.hasGovernanceQueue && input.onOpenGovernancePanel) {
    actions.push(
      buildAction("analysis:view-governance", "查看治理卡片", input.onOpenGovernancePanel, "secondary"),
    );
  }

  if (input.kind === "governance" && input.onFocusChat) {
    actions.push(
      buildAction(
        "governance:continue-chat",
        "继续在对话区推进",
        () => input.onFocusChat?.("我已进入治理工作区，请基于当前卡片继续推进下一步。"),
        "secondary",
      ),
    );
  }

  if (input.kind === "report" && input.onFocusChat) {
    actions.push(
      buildAction(
        "report:continue-chat",
        "让对话区继续整改",
        () => input.onFocusChat?.("请基于当前 Sandbox 报告、治理卡片和待确认修改，继续推进下一项整改。"),
        "secondary",
      ),
    );
  }

  if (input.hasLatestTest && input.onOpenSandbox && input.kind !== "report") {
    actions.push(
      buildAction(`${input.kind}:open-sandbox`, "打开 Sandbox", input.onOpenSandbox, "secondary"),
    );
  }

  const sections: WorkspaceActionSection[] = [];
  const primaryActions = dedupeActions(actions);
  if (primaryActions.length > 0) {
    sections.push({ title: "推荐操作", actions: primaryActions });
  }
  if (input.activeCardActions.length > 0) {
    sections.push({ title: "当前卡片动作", actions: input.activeCardActions });
  }
  return sections;
}

function WorkspaceActionSections({
  sections,
}: {
  sections: WorkspaceActionSection[];
}) {
  if (sections.length === 0) return null;
  return (
    <>
      {sections.map((section) => (
        <ActionGroup
          key={section.title}
          title={section.title}
          actions={section.actions}
        />
      ))}
    </>
  );
}

function CardQueueList({
  title,
  cards,
  activeCardId,
  emptyHint,
  onSelectCard,
}: {
  title: string;
  cards: WorkbenchCard[];
  activeCardId?: string | null;
  emptyHint?: string;
  onSelectCard: (cardId: string) => void;
}) {
  const [filter, setFilter] = useState<WorkbenchCard["mode"] | "all">("all");
  const filters: Array<{ id: WorkbenchCard["mode"] | "all"; label: string }> = [
    { id: "all", label: "全部" },
    { id: "analysis", label: "分析" },
    { id: "file", label: "文件" },
    { id: "report", label: "报告" },
    { id: "governance", label: "治理" },
  ];
  const counts = useMemo(() => ({
    all: cards.length,
    analysis: cards.filter((card) => card.mode === "analysis").length,
    file: cards.filter((card) => card.mode === "file").length,
    report: cards.filter((card) => card.mode === "report").length,
    governance: cards.filter((card) => card.mode === "governance").length,
  }), [cards]);
  const filteredCards = filter === "all" ? cards : cards.filter((card) => card.mode === filter);
  const visibleCards = filteredCards.slice(0, 6);
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{title}</div>
        <div className="ml-auto text-[8px] font-mono text-gray-400">{filteredCards.length}/{cards.length}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`border px-2 py-1 text-[8px] font-bold transition-colors ${
              filter === item.id
                ? "border-[#00A3C4] bg-[#00A3C4] text-white"
                : "border-[#1A202C]/15 bg-white text-gray-500 hover:border-[#00A3C4] hover:text-[#00A3C4]"
            }`}
          >
            {item.label} {counts[item.id]}
          </button>
        ))}
      </div>

      {cards.length === 0 && (
        <div className="mt-2 border border-dashed border-[#1A202C]/20 bg-white px-3 py-4 text-[10px] leading-relaxed text-gray-500">
          {emptyHint || "当前没有可承接卡片。"}
        </div>
      )}

      {cards.length > 0 && filteredCards.length === 0 && (
        <div className="mt-2 border border-dashed border-[#1A202C]/20 bg-white px-3 py-4 text-[10px] leading-relaxed text-gray-500">
          该分类暂无待处理卡片，可切回「全部」继续处理。
        </div>
      )}

      {visibleCards.length > 0 && (
        <div className="mt-2 space-y-2">
          {visibleCards.map((card) => {
            const active = card.id === activeCardId;
            return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectCard(card.id)}
            className={`w-full border px-3 py-2 text-left transition-colors ${
              active
                ? "border-[#00A3C4] bg-[#ECFBFF] shadow-[3px_3px_0_0_#1A202C]"
                : "border-[#1A202C]/15 bg-white hover:border-[#00A3C4] hover:bg-[#ECFBFF]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-bold text-[#00A3C4]">{card.kind}</span>
              <span className="text-[8px] font-bold text-gray-400">{card.status}</span>
              {active && (
                <span className="text-[8px] font-bold text-[#00CC99]">当前</span>
              )}
              <span className="ml-auto text-[8px] font-mono text-gray-400">{card.phase}</span>
            </div>
            <div className="mt-1 text-[11px] font-bold text-[#1A202C] line-clamp-1">{card.title}</div>
            <div className="mt-0.5 text-[9px] leading-relaxed text-gray-500 line-clamp-2">{card.summary}</div>
          </button>
            );
          })}
        </div>
      )}

      {filteredCards.length > visibleCards.length && (
        <div className="mt-2 text-[9px] font-mono text-gray-400">
          还有 {filteredCards.length - visibleCards.length} 张卡片，请通过左侧队列继续查看。
        </div>
      )}
    </div>
  );
}

export function SummaryList({
  items,
}: {
  items: Array<{ icon: ReactNode; label: string; text: string; tone?: "neutral" | "warn" | "success" }>;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={`${item.label}:${item.text}`}
          className={`flex items-start gap-2 border px-3 py-2 ${
            item.tone === "warn"
              ? "border-amber-200 bg-amber-50"
              : item.tone === "success"
                ? "border-emerald-200 bg-emerald-50"
                : "border-[#1A202C]/10 bg-[#F8FCFD]"
          }`}
        >
          <div className={`mt-0.5 shrink-0 ${item.tone === "warn" ? "text-amber-600" : item.tone === "success" ? "text-emerald-600" : "text-[#00A3C4]"}`}>
            {item.icon}
          </div>
          <div className="min-w-0">
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{item.label}</div>
            <div className="mt-1 text-[11px] leading-relaxed text-[#1A202C]">{item.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function buildAnalysisContinueMessage(workflowState: WorkflowStateData | null, memo: SkillMemo | null) {
  const nextAction = workflowState?.next_action || "";
  if (nextAction === "collect_requirements") {
    return "请基于当前上下文继续收集关键需求，并明确下一步。";
  }
  if (nextAction === "review_cards") {
    return "请基于当前工作台卡片给出优先处理顺序，并继续推进。";
  }
  if (nextAction === "run_preflight") {
    return "请基于当前最新内容继续推进到 Preflight 前的最后一步。";
  }
  if (nextAction === "run_sandbox") {
    return "我已准备好，请继续收敛到可以发起 Sandbox 的状态。";
  }
  if (memo?.current_task?.description) {
    return `请围绕当前任务继续推进：${memo.current_task.description}`;
  }
  return "请基于当前工作流状态继续下一步。";
}

function getReportCounts(report: SandboxReport | null) {
  const evaluation = report?.part3_evaluation || {};
  const issues = Array.isArray(evaluation.issues) ? evaluation.issues.length : 0;
  const fixPlan = Array.isArray(evaluation.fix_plan_structured) ? evaluation.fix_plan_structured.length : 0;
  return {
    issues,
    fixPlan,
    cases: report?.cases?.length || 0,
    findings: report?.supporting_findings?.length || 0,
  };
}

export function buildAnalysisDescriptor(input: {
  card: WorkbenchCard | null;
  workflowState: WorkflowStateData | null;
  memo: SkillMemo | null;
  pendingGovernanceCount: number;
  pendingStagedEditCount: number;
  pendingAnalysisCards: number;
  pendingExecutionCards: number;
  nextPendingCard: WorkbenchCard | null;
}): WorkspaceDescriptor {
  const latestTest = input.memo?.latest_test;
  return {
    description: input.card?.summary
      || input.memo?.status_summary
      || input.workflowState?.route_reason
      || "等待新的分析结果进入工作台。",
    metrics: [
      {
        label: "Phase",
        value: input.workflowState?.phase || "discover",
        hint: input.workflowState?.route_reason || null,
      },
      {
        label: "Next Action",
        value: NEXT_ACTION_LABELS[input.workflowState?.next_action || "continue_chat"] || input.workflowState?.next_action || "继续对话推进",
        hint: input.memo?.current_task?.title || null,
      },
      {
        label: "Lifecycle",
        value: input.memo?.lifecycle_stage || "analysis",
        hint: input.memo?.goal_summary || null,
      },
      {
        label: "Pending Queue",
        value: `${input.pendingGovernanceCount} 张治理卡 / ${input.pendingStagedEditCount} 个修改`,
        hint: input.pendingGovernanceCount + input.pendingStagedEditCount > 0
          ? "分析结束后可直接进入治理与确认环节"
          : "当前还没有待处理治理动作",
      },
      {
        label: "Queue Mix",
        value: `${input.pendingAnalysisCards} 张分析 / ${input.pendingExecutionCards} 张执行`,
        hint: input.nextPendingCard ? `下一项：${input.nextPendingCard.title}` : "当前没有下一项待承接卡片",
      },
      {
        label: "Workflow Mode",
        value: input.workflowState?.workflow_mode || "未进入工作流",
        hint: input.workflowState?.execution_strategy ? `策略：${input.workflowState.execution_strategy}` : null,
      },
    ],
    summaries: [
      {
        icon: <Sparkles size={14} />,
        label: "当前结论",
        text: input.workflowState?.route_reason || input.memo?.status_summary || "工作流尚未产出新的分析结论。",
      },
      {
        icon: <ClipboardList size={14} />,
        label: "当前任务",
        text: input.memo?.current_task
          ? `${input.memo.current_task.title}${input.memo.current_task.description ? `：${input.memo.current_task.description}` : ""}`
          : "当前没有显式任务，建议继续通过对话推进。",
      },
      {
        icon: latestTest ? <CheckCircle2 size={14} /> : <ArrowRight size={14} />,
        label: "测试状态",
        text: latestTest
          ? `${latestTest.status === "passed" ? "最近一次测试已通过" : "最近一次测试失败"}：${latestTest.summary}`
          : "尚未进入测试阶段。",
        tone: latestTest?.status === "failed" ? "warn" : latestTest?.status === "passed" ? "success" : "neutral",
      },
      {
        icon: <ArrowRight size={14} />,
        label: "下一承接项",
        text: input.nextPendingCard
          ? `${input.nextPendingCard.title}：${input.nextPendingCard.summary}`
          : "当前没有下一承接项，可继续通过对话推进分析。",
        tone: input.nextPendingCard ? "warn" : "success",
      },
    ],
  };
}

export function buildGovernanceDescriptor(input: {
  skill: SkillDetail | null;
  memo: SkillMemo | null;
  activeSandboxReport: SandboxReport | null;
  governanceIntent: WorkspaceGovernanceIntent;
  pendingGovernanceCount: number;
  pendingStagedEditCount: number;
  pendingValidationCards: number;
  pendingGovernanceCards: number;
  nextPendingCard: WorkbenchCard | null;
}): WorkspaceDescriptor {
  const latestTestStatus = input.memo?.latest_test
    ? input.memo.latest_test.status === "passed" ? "通过" : "失败"
    : "未运行";
  const targetVersionLabel = input.activeSandboxReport?.target_version != null
    ? `v${input.activeSandboxReport.target_version}`
    : "未关联";
  const intentLabel = input.governanceIntent?.mode === "mount_blocked"
    ? "门禁阻断"
    : input.governanceIntent?.mode === "choose_existing_plan"
      ? "历史计划待决策"
      : input.governanceIntent?.mode === "generate_cases"
        ? "生成测试用例"
        : "治理推进";
  return {
    description: input.governanceIntent?.gateSummary
      || input.memo?.status_summary
      || "当前卡片需要通过权限挂载、声明确认、case plan 或 sandbox 编排继续推进。",
    metrics: [
      {
        label: "Governance Queue",
        value: `${input.pendingGovernanceCount} 张治理卡`,
        hint: input.pendingGovernanceCount > 0 ? "卡片会继续驱动挂载、声明与回流动作" : "当前没有待处理治理卡",
      },
      {
        label: "Pending Diff",
        value: `${input.pendingStagedEditCount} 个待确认修改`,
        hint: input.pendingStagedEditCount > 0 ? "可直接查看、采纳或拒绝" : "当前没有待确认修改",
      },
      {
        label: "Latest Test",
        value: latestTestStatus,
        hint: input.memo?.latest_test?.summary || null,
        tone: latestTestStatus === "失败" ? "amber" : "cyan",
      },
      {
        label: "Report Version",
        value: targetVersionLabel,
        hint: input.activeSandboxReport ? `报告 #${input.activeSandboxReport.report_id}` : "当前未绑定 Sandbox 报告",
        tone: input.activeSandboxReport?.approval_eligible ? "cyan" : "amber",
      },
      {
        label: "Intent",
        value: intentLabel,
        hint: input.governanceIntent?.gateSummary || input.governanceIntent?.verdictReason || null,
      },
      {
        label: "Queue Mix",
        value: `${input.pendingValidationCards} 张验证 / ${input.pendingGovernanceCards} 张治理`,
        hint: input.nextPendingCard ? `下一项：${input.nextPendingCard.title}` : "当前没有下一项待承接卡片",
      },
    ],
    summaries: [
      {
        icon: <ShieldCheck size={14} />,
        label: "治理承接",
        text: input.memo?.current_task
          ? `${input.memo.current_task.title}${input.memo.current_task.target_files.length > 0 ? ` · 目标：${input.memo.current_task.target_files.join("、")}` : ""}`
          : "当前卡片需要通过治理面板继续推进。",
      },
      {
        icon: <FlaskConical size={14} />,
        label: "测试门禁",
        text: input.governanceIntent?.verdictReason
          || (input.activeSandboxReport
            ? input.activeSandboxReport.approval_eligible
              ? "当前报告已可通过，可继续提交或发布。"
              : "当前报告仍有阻断项，需要继续整改。"
            : "当前尚未拿到最新 Sandbox 结论。"),
        tone: input.activeSandboxReport?.approval_eligible ? "success" : input.activeSandboxReport ? "warn" : "neutral",
      },
      {
        icon: input.pendingGovernanceCount + input.pendingStagedEditCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />,
        label: "待处理总量",
        text: `当前共有 ${input.pendingGovernanceCount + input.pendingStagedEditCount} 个治理承接项。`,
        tone: input.pendingGovernanceCount + input.pendingStagedEditCount > 0 ? "warn" : "success",
      },
      {
        icon: <ArrowRight size={14} />,
        label: "下一承接项",
        text: input.nextPendingCard
          ? `${input.nextPendingCard.title}：${input.nextPendingCard.summary}`
          : "当前没有下一承接项，可继续在对话区推进或回到治理面板刷新。",
        tone: input.nextPendingCard ? "warn" : "success",
      },
    ],
  };
}

export function buildReportDescriptor(input: {
  memo: SkillMemo | null;
  activeSandboxReport: SandboxReport | null;
  pendingGovernanceCount: number;
  pendingStagedEditCount: number;
  nextPendingCard: WorkbenchCard | null;
}): WorkspaceDescriptor {
  const latestTest = input.memo?.latest_test;
  const reportCounts = getReportCounts(input.activeSandboxReport);
  return {
    description: latestTest?.summary || "当前工作区承接 preflight、sandbox 报告与整改建议。",
    metrics: [
      {
        label: "Latest Test",
        value: latestTest?.status || "未运行",
        hint: latestTest?.details?.blocking_reasons?.join("、") || null,
        tone: "amber",
      },
      {
        label: "Lifecycle",
        value: input.memo?.lifecycle_stage || "analysis",
        tone: "amber",
      },
      {
        label: "Report Issues",
        value: `${reportCounts.issues} 个问题 / ${reportCounts.fixPlan} 项整改`,
        hint: reportCounts.findings > 0 ? `${reportCounts.findings} 条支撑发现` : null,
        tone: "amber",
      },
      {
        label: "Remediation Queue",
        value: `${input.pendingGovernanceCount} 张治理卡 / ${input.pendingStagedEditCount} 个修改`,
        hint: input.pendingGovernanceCount + input.pendingStagedEditCount > 0 ? "可按队列逐个处理并回流到编辑器" : "当前无待处理整改项",
        tone: "amber",
      },
      ...(input.activeSandboxReport ? [
        {
          label: "Report Verdict",
          value: input.activeSandboxReport.approval_eligible ? "通过" : "需整改",
          tone: "amber" as const,
        },
        {
          label: "Target Version",
          value: `v${input.activeSandboxReport.target_version ?? "-"}`,
          tone: "amber" as const,
        },
      ] : []),
    ],
    summaries: [
      {
        icon: input.activeSandboxReport?.approval_eligible ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />,
        label: "报告结论",
        text: input.activeSandboxReport
          ? input.activeSandboxReport.approval_eligible
            ? "当前报告已通过，后续重点是提交或发布前确认。"
            : "当前报告仍需整改，优先处理治理卡与 staged edit。"
          : "当前未拿到 Sandbox 报告，先打开 Sandbox 或等待报告回流。",
        tone: input.activeSandboxReport?.approval_eligible ? "success" : input.activeSandboxReport ? "warn" : "neutral",
      },
      {
        icon: <ClipboardList size={14} />,
        label: "整改来源",
        text: reportCounts.cases > 0
          ? `报告覆盖 ${reportCounts.cases} 条测试用例，识别 ${reportCounts.issues} 个问题。`
          : "当前报告没有回填用例明细。",
      },
      {
        icon: <ArrowRight size={14} />,
        label: "下一承接项",
        text: input.nextPendingCard
          ? `${input.nextPendingCard.title}：${input.nextPendingCard.summary}`
          : "没有待处理队列项，可回到 Sandbox 或治理面板刷新状态。",
        tone: input.nextPendingCard ? "warn" : "success",
      },
    ],
  };
}

function AnalysisWorkspace({
  card,
  workflowState,
  memo,
  pendingGovernanceCount,
  pendingStagedEditCount,
  activeCardActions,
  pendingCards,
  onOpenPrompt,
  onOpenGovernancePanel,
  onOpenSandbox,
  onFocusChat,
  onSelectWorkbenchCard,
}: {
  card: WorkbenchCard | null;
  workflowState: WorkflowStateData | null;
  memo: SkillMemo | null;
  pendingGovernanceCount: number;
  pendingStagedEditCount: number;
  activeCardActions: WorkspaceAction[];
  pendingCards: WorkbenchCard[];
  onOpenPrompt: () => void;
  onOpenGovernancePanel: () => void;
  onOpenSandbox: () => void;
  onFocusChat: (text: string) => void;
  onSelectWorkbenchCard: (cardId: string) => void;
}) {
  const facts = workflowState?.active_assist_skills || [];
  const nextPendingCard = pendingCards[0] || null;
  const pendingAnalysisCards = pendingCards.filter((item) => item.mode === "analysis").length;
  const pendingExecutionCards = pendingCards.filter((item) => item.mode !== "analysis").length;
  const descriptor = buildAnalysisDescriptor({
    card,
    workflowState,
    memo,
    pendingGovernanceCount,
    pendingStagedEditCount,
    pendingAnalysisCards,
    pendingExecutionCards,
    nextPendingCard,
  });
  const actionSections = buildWorkspaceActionSections({
    kind: "analysis",
    workflowState,
    memo,
    nextPendingCard,
    hasGovernanceQueue: pendingGovernanceCount > 0 || pendingStagedEditCount > 0,
    hasLatestTest: Boolean(memo?.latest_test),
    onSelectWorkbenchCard,
    onOpenPrompt,
    onOpenGovernancePanel,
    onOpenSandbox,
    onFocusChat,
    activeCardActions,
  });

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-[#F8FCFD]">
      <Panel
        eyebrow="Analysis Workspace"
        title={card?.title || "当前处于分析阶段"}
      >
        <div className="text-[11px] leading-6 text-gray-600">{descriptor.description}</div>
        <MetricGrid metrics={descriptor.metrics} />
        <SummaryList items={descriptor.summaries} />

        {facts.length > 0 && (
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">Assist Skills</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {facts.map((item) => (
                <span key={item} className="border border-[#00A3C4]/30 bg-[#ECFBFF] px-2 py-1 text-[9px] font-mono text-[#00A3C4]">
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        <CardQueueList
          title="分析队列"
          cards={card ? [card, ...pendingCards] : pendingCards}
          activeCardId={card?.id}
          emptyHint="当前没有分析队列项，可继续通过对话推进或打开主 Prompt 编辑。"
          onSelectCard={onSelectWorkbenchCard}
        />

        <WorkspaceActionSections sections={actionSections} />
      </Panel>
    </div>
  );
}

function GovernanceWorkspace({
  card,
  skill,
  memo,
  activeSandboxReport,
  governanceIntent,
  pendingGovernanceCount,
  pendingStagedEditCount,
  activeCardActions,
  pendingCards,
  onOpenGovernancePanel,
  onOpenSandbox,
  onOpenPrompt,
  onFocusChat,
  onSelectWorkbenchCard,
}: {
  card: WorkbenchCard | null;
  skill: SkillDetail | null;
  memo: SkillMemo | null;
  activeSandboxReport: SandboxReport | null;
  governanceIntent: WorkspaceGovernanceIntent;
  pendingGovernanceCount: number;
  pendingStagedEditCount: number;
  activeCardActions: WorkspaceAction[];
  pendingCards: WorkbenchCard[];
  onOpenGovernancePanel: () => void;
  onOpenSandbox: () => void;
  onOpenPrompt: () => void;
  onFocusChat: (text: string) => void;
  onSelectWorkbenchCard: (cardId: string) => void;
}) {
  const nextPendingCard = pendingCards[0] || null;
  const pendingValidationCards = pendingCards.filter((card) => card.kind === "validation").length;
  const pendingGovernanceCards = pendingCards.filter((card) => card.kind === "governance").length;
  const descriptor = buildGovernanceDescriptor({
    skill,
    memo,
    activeSandboxReport,
    governanceIntent,
    pendingGovernanceCount,
    pendingStagedEditCount,
    pendingValidationCards,
    pendingGovernanceCards,
    nextPendingCard,
  });
  const actionSections = buildWorkspaceActionSections({
    kind: "governance",
    memo,
    nextPendingCard,
    hasLatestTest: Boolean(activeSandboxReport || memo?.latest_test),
    onSelectWorkbenchCard,
    onOpenPrompt,
    onOpenGovernancePanel,
    onOpenSandbox,
    onFocusChat,
    activeCardActions,
  });

  const gateTone = governanceIntent?.mode === "mount_blocked" ? "amber" : "cyan";
  return (
    <div className="flex-1 overflow-y-auto p-5 bg-[#F4FBFF]">
      <Panel
        eyebrow="Governance Workspace"
        title={skill ? `继续处理 ${skill.name} 的治理与测试承接` : "治理面板待打开"}
        tone={gateTone}
      >
        <div className="text-[11px] leading-6 text-gray-600">{descriptor.description}</div>

        {governanceIntent?.mode === "mount_blocked" && (
          <CaseGenerationGateCard
            verdictLabel={governanceIntent.verdictLabel}
            verdictReason={governanceIntent.verdictReason}
            gateSummary={governanceIntent.gateSummary}
            gateReasons={governanceIntent.gateReasons}
            guidedSteps={governanceIntent.guidedSteps}
            primaryAction={governanceIntent.primaryAction}
            onAction={() => onOpenGovernancePanel()}
          />
        )}

        <MetricGrid metrics={descriptor.metrics} />
        <SummaryList items={descriptor.summaries} />

        <CardQueueList
          title="治理队列"
          cards={card ? [card, ...pendingCards] : pendingCards}
          activeCardId={card?.id}
          emptyHint="当前没有治理队列项，可展开治理面板刷新权限与测试状态。"
          onSelectCard={onSelectWorkbenchCard}
        />

        <WorkspaceActionSections sections={actionSections} />
      </Panel>
    </div>
  );
}

function ReportWorkspace({
  card,
  memo,
  activeSandboxReport,
  pendingGovernanceCount,
  pendingStagedEditCount,
  activeCardActions,
  pendingCards,
  onOpenGovernancePanel,
  onOpenSandbox,
  onFocusChat,
  onSelectWorkbenchCard,
}: {
  card: WorkbenchCard | null;
  memo: SkillMemo | null;
  activeSandboxReport: SandboxReport | null;
  pendingGovernanceCount: number;
  pendingStagedEditCount: number;
  activeCardActions: WorkspaceAction[];
  pendingCards: WorkbenchCard[];
  onOpenGovernancePanel: () => void;
  onOpenSandbox: () => void;
  onFocusChat: (text: string) => void;
  onSelectWorkbenchCard: (cardId: string) => void;
}) {
  const nextPendingCard = pendingCards[0] || null;
  const descriptor = buildReportDescriptor({
    memo,
    activeSandboxReport,
    pendingGovernanceCount,
    pendingStagedEditCount,
    nextPendingCard,
  });
  const actionSections = buildWorkspaceActionSections({
    kind: "report",
    memo,
    nextPendingCard,
    hasLatestTest: true,
    onSelectWorkbenchCard,
    onOpenGovernancePanel,
    onOpenSandbox,
    onFocusChat,
    activeCardActions,
  });

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-[#FFF9F5]">
      <Panel
        eyebrow="Report Workspace"
        title={activeSandboxReport ? `Sandbox 报告 #${activeSandboxReport.report_id}` : "验证与整改工作区"}
        tone="amber"
      >
        <div className="text-[11px] leading-6 text-gray-600">{descriptor.description}</div>
        <MetricGrid metrics={descriptor.metrics} />
        <SummaryList items={descriptor.summaries} />

        <CardQueueList
          title="整改队列"
          cards={card ? [card, ...pendingCards] : pendingCards}
          activeCardId={card?.id}
          emptyHint="当前没有整改队列项，可打开 Sandbox 或治理面板刷新报告承接状态。"
          onSelectCard={onSelectWorkbenchCard}
        />

        <WorkspaceActionSections sections={actionSections} />
      </Panel>
    </div>
  );
}

function FileWorkspace({
  card,
  activeCardActions,
  children,
}: {
  card: WorkbenchCard | null;
  activeCardActions: WorkspaceAction[];
  children: ReactNode;
}) {
  if (activeCardActions.length === 0 && !card) {
    return (
      <div className="flex-1 overflow-hidden bg-white">
        {children}
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      {(activeCardActions.length > 0 || card) && (
        <div className="border-b border-[#D7EAF0] bg-[#F8FCFD] px-5 py-3">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-gray-400">File Workspace</div>
              {card && (
                <>
                  <div className="mt-1 text-[11px] font-bold text-[#1A202C] line-clamp-1">{card.title}</div>
                  <div className="mt-0.5 text-[9px] leading-relaxed text-gray-500 line-clamp-2">{card.summary}</div>
                </>
              )}
            </div>
            {card?.target.key && (
              <div className="max-w-[180px] shrink-0 text-right">
                <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">目标文件</div>
                <div className="mt-1 truncate text-[10px] font-mono text-[#00A3C4]">{card.target.key}</div>
              </div>
            )}
          </div>
          <ActionGroup title="当前卡片动作" actions={activeCardActions} />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function StudioWorkspace({
  activeCard,
  workflowState,
  memo,
  selectedSkill,
  activeSandboxReport,
  governanceIntent,
  pendingGovernanceCount,
  pendingStagedEditCount,
  activeCardActions,
  pendingCards,
  onOpenGovernancePanel,
  onOpenSandbox,
  onOpenPrompt,
  onFocusChat,
  onSelectWorkbenchCard,
  children,
}: {
  activeCard: WorkbenchCard | null;
  workflowState: WorkflowStateData | null;
  memo: SkillMemo | null;
  selectedSkill: SkillDetail | null;
  activeSandboxReport: SandboxReport | null;
  governanceIntent: WorkspaceGovernanceIntent;
  pendingGovernanceCount: number;
  pendingStagedEditCount: number;
  activeCardActions: WorkspaceAction[];
  pendingCards: WorkbenchCard[];
  onOpenGovernancePanel: () => void;
  onOpenSandbox: () => void;
  onOpenPrompt: () => void;
  onFocusChat: (text: string) => void;
  onSelectWorkbenchCard: (cardId: string) => void;
  children: ReactNode;
}) {
  if (activeCard?.mode === "analysis") {
    return (
      <AnalysisWorkspace
        card={activeCard}
        workflowState={workflowState}
        memo={memo}
        pendingGovernanceCount={pendingGovernanceCount}
        pendingStagedEditCount={pendingStagedEditCount}
        activeCardActions={activeCardActions}
        pendingCards={pendingCards}
        onOpenPrompt={onOpenPrompt}
        onOpenGovernancePanel={onOpenGovernancePanel}
        onOpenSandbox={onOpenSandbox}
        onFocusChat={onFocusChat}
        onSelectWorkbenchCard={onSelectWorkbenchCard}
      />
    );
  }

  if (activeCard?.mode === "report") {
    return (
      <ReportWorkspace
        card={activeCard}
        memo={memo}
        activeSandboxReport={activeSandboxReport}
        pendingGovernanceCount={pendingGovernanceCount}
        pendingStagedEditCount={pendingStagedEditCount}
        activeCardActions={activeCardActions}
        pendingCards={pendingCards}
        onOpenGovernancePanel={onOpenGovernancePanel}
        onOpenSandbox={onOpenSandbox}
        onFocusChat={onFocusChat}
        onSelectWorkbenchCard={onSelectWorkbenchCard}
      />
    );
  }

  if (activeCard?.mode === "governance") {
    return (
      <GovernanceWorkspace
        card={activeCard}
        skill={selectedSkill}
        memo={memo}
        activeSandboxReport={activeSandboxReport}
        governanceIntent={governanceIntent}
        pendingGovernanceCount={pendingGovernanceCount}
        pendingStagedEditCount={pendingStagedEditCount}
        activeCardActions={activeCardActions}
        pendingCards={pendingCards}
        onOpenGovernancePanel={onOpenGovernancePanel}
        onOpenSandbox={onOpenSandbox}
        onOpenPrompt={onOpenPrompt}
        onFocusChat={onFocusChat}
        onSelectWorkbenchCard={onSelectWorkbenchCard}
      />
    );
  }

  return (
    <FileWorkspace
      card={activeCard}
      activeCardActions={activeCardActions}
    >
      {children}
    </FileWorkspace>
  );
}
