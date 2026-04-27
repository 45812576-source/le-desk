"use client";

import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, X } from "lucide-react";
import type { SkillDetail, SkillMemo, SkillMemoTask, SandboxReport, StudioCardQueueLedger } from "@/lib/types";
import { useStudioStore } from "@/lib/studio-store";
import type { ArchitectArtifact } from "./types";
import type { WorkflowStateData } from "./workflow-protocol";
import type { ExternalBuildStatus, WorkbenchCard, WorkbenchCardKind } from "./workbench";
import { resolveStudioCardContract, type StudioCardActionId } from "./card-contracts";
import {
  MetricGrid,
  SummaryList,
  ActionGroup,
  buildAnalysisDescriptor,
  buildGovernanceDescriptor,
  buildReportDescriptor,
  buildWorkspaceActionSections,
  type WorkspaceAction,
  type WorkspaceGovernanceIntent,
} from "./StudioWorkspace";

// ── 分色方案 ──

const KIND_STYLE: Record<WorkbenchCardKind, { bg: string; border: string; label: string; text: string }> = {
  create:     { bg: "bg-[#ECFBFF]", border: "border-[#00D1FF]", label: "创作", text: "text-[#00D1FF]" },
  architect:  { bg: "bg-[#ECFBFF]", border: "border-[#00A3C4]", label: "架构", text: "text-[#00A3C4]" },
  refine:     { bg: "bg-[#EBF5FF]", border: "border-[#3B82F6]", label: "完善", text: "text-[#3B82F6]" },
  governance: { bg: "bg-[#F5F3FF]", border: "border-[#8B5CF6]", label: "治理", text: "text-[#8B5CF6]" },
  validation: { bg: "bg-[#FFFBEB]", border: "border-[#F59E0B]", label: "验证", text: "text-[#F59E0B]" },
  fixing:     { bg: "bg-[#FFF5F5]", border: "border-[#EF4444]", label: "整改", text: "text-[#EF4444]" },
  release:    { bg: "bg-[#F0FFF4]", border: "border-[#10B981]", label: "发布", text: "text-[#10B981]" },
  system:     { bg: "bg-gray-50",   border: "border-gray-300",  label: "系统", text: "text-gray-400" },
};

const MODE_LABEL: Record<WorkbenchCard["mode"], string> = {
  analysis: "分析",
  file: "文件",
  report: "报告",
  governance: "治理",
};

const STATUS_LABEL: Record<WorkbenchCard["status"], string> = {
  pending: "待处理",
  active: "进行中",
  reviewing: "待确认",
  adopted: "已采纳",
  rejected: "已拒绝",
  dismissed: "已关闭",
  stale: "已过期",
};

const EXTERNAL_STATUS_LABEL: Record<ExternalBuildStatus, { text: string; color: string }> = {
  waiting_external_build: { text: "待外部处理", color: "text-blue-500" },
  external_in_progress: { text: "外部处理中", color: "text-blue-600" },
  returned_waiting_bindback: { text: "待回绑", color: "text-amber-600" },
  returned_waiting_validation: { text: "待验证", color: "text-purple-500" },
};

// ── 操作按钮渲染 ──

function CardActions({
  card,
  onOpenPrompt,
  onApplyDraft,
  onDiscardDraft,
  onConfirmSummary,
  onDiscardSummary,
  onConfirmSplit,
  onDiscardSplit,
  onStartFixTask,
  onTargetedRetest,
  onSubmitApproval,
  onOpenGovernancePanel,
  onOpenSandbox,
  onFocusChat,
  onConfirmTool,
  onExternalBuild,
  onBindBack,
}: {
  card: WorkbenchCard;
  onOpenPrompt: () => void;
  onApplyDraft: () => void;
  onDiscardDraft: () => void;
  onConfirmSummary: () => void;
  onDiscardSummary: () => void;
  onConfirmSplit: () => void;
  onDiscardSplit: () => void;
  onStartFixTask: (task: SkillMemoTask) => void;
  onTargetedRetest: (taskId: string) => void;
  onSubmitApproval: () => void;
  onOpenGovernancePanel: () => void;
  onOpenSandbox: () => void;
  onFocusChat: (text: string) => void;
  onConfirmTool: () => void;
  onExternalBuild: (card: WorkbenchCard) => void;
  onBindBack: (card: WorkbenchCard) => void;
}) {
  const btnBase = "text-[8px] font-bold uppercase tracking-widest px-2 py-1 border transition-colors";
  const btnPrimary = `${btnBase} bg-[#1A202C] text-white border-[#1A202C] hover:bg-[#2D3748]`;
  const btnSecondary = `${btnBase} bg-white text-[#1A202C] border-[#1A202C]/30 hover:border-[#1A202C]`;
  const btnDanger = `${btnBase} bg-white text-red-600 border-red-300 hover:border-red-500`;
  const contract = resolveStudioCardContract(card);

  // 1.5: 外部状态 CTA 覆盖
  const externalOverride = card.externalBuildStatus ? EXTERNAL_CTA_OVERRIDE[card.externalBuildStatus] : null;
  const effectiveCtas: { actionId: StudioCardActionId; label: string; tone?: "primary" | "secondary" | "danger" }[] = externalOverride
    ? [{ actionId: externalOverride.actionId, label: externalOverride.label }]
    : contract?.ctas ?? [];

  if (effectiveCtas.length === 0) return null;

  const runAction = (actionId: StudioCardActionId) => {
    switch (actionId) {
      case "chat.start_requirement":
      case "architect.continue":
        onFocusChat("");
        return;
      case "summary.confirm":
        onConfirmSummary();
        return;
      case "summary.discard":
        onDiscardSummary();
        return;
      case "draft.apply":
        onApplyDraft();
        return;
      case "draft.discard":
        onDiscardDraft();
        return;
      case "split.confirm":
        onConfirmSplit();
        return;
      case "split.discard":
        onDiscardSplit();
        return;
      case "knowledge.bind":
        onFocusChat("请帮我绑定知识库标签");
        return;
      case "governance.open_panel":
        onOpenGovernancePanel();
        return;
      case "validation.open_sandbox":
        onOpenSandbox();
        return;
      case "fixing.start_task":
        if (card.fixTask) onStartFixTask(card.fixTask);
        return;
      case "fixing.targeted_retest":
        if (card.fixTask) onTargetedRetest(card.fixTask.id);
        return;
      case "release.submit_approval":
        onSubmitApproval();
        return;
      case "tool.confirm":
        onConfirmTool();
        return;
      case "handoff.external_build":
        onExternalBuild(card);
        return;
      case "handoff.bind_back":
        onBindBack(card);
        return;
      // ── 文件角色 CTA ──
      case "file_role.generate_examples":
        onFocusChat("请帮我生成示例");
        return;
      case "file_role.calibrate_examples":
        onFocusChat("请帮我校准示例");
        return;
      case "file_role.link_main_prompt":
        onFocusChat("请帮我关联主 Prompt");
        return;
      case "file_role.summarize_reference":
        onFocusChat("请帮我摘要资料");
        return;
      case "file_role.extract_rules":
        onFocusChat("请帮我提取引用规则");
        return;
      case "file_role.suggest_prompt_update":
        onFocusChat("请帮我生成主 Prompt 建议");
        return;
      case "file_role.organize_knowledge":
        onFocusChat("请帮我整理知识");
        return;
      case "file_role.bind_knowledge":
        onOpenGovernancePanel();
        return;
      case "file_role.rebuild_index":
        onFocusChat("请帮我重建索引");
        return;
      case "file_role.generate_tool_package":
        onFocusChat("请帮我生成工具交接包");
        return;
      case "file_role.start_validation":
        onOpenSandbox();
        return;
      default: {
        const _exhaustive: never = actionId;
        console.warn(`[CardActions] unhandled actionId: ${_exhaustive}`);
        onOpenPrompt();
      }
    }
  };

  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      {effectiveCtas.map((cta) => {
        const className = cta.tone === "danger" ? btnDanger : cta.tone === "secondary" ? btnSecondary : btnPrimary;
        return (
          <button key={`${card.id}:${cta.actionId}`} className={className} onClick={() => runAction(cta.actionId)}>
            {cta.label}
          </button>
        );
      })}
    </div>
  );
}

// ── 已有 Descriptor 详情展开 ──

function CardDetail({
  card,
  descriptor,
  actionSections,
  showActions = true,
}: {
  card: WorkbenchCard;
  descriptor: { description: string; metrics: Array<{ label: string; value: string; hint?: string | null; tone?: "cyan" | "amber" }>; summaries: Array<{ icon: ReactNode; label: string; text: string; tone?: "neutral" | "warn" | "success" }> };
  actionSections: Array<{ title: string; actions: WorkspaceAction[] }>;
  showActions?: boolean;
}) {
  const style = KIND_STYLE[card.kind];
  return (
    <div className={`border-2 ${style.border} bg-white p-3 space-y-3`}>
      <div className="text-[10px] leading-relaxed text-gray-600">{descriptor.description}</div>
      <MetricGrid metrics={descriptor.metrics} />
      <SummaryList items={descriptor.summaries} />
      {showActions && actionSections.map((section) => (
        <ActionGroup key={section.title} title={section.title} actions={section.actions} />
      ))}
    </div>
  );
}

// ── 用户摘要层：把队列/contract/报告明细收敛成可执行说明 ──

type UserFacingCardSummary = {
  eyebrow: string;
  title: string;
  description: string;
  blockers: string[];
  nextStep: string;
  note?: string | null;
  tone: "governance" | "validation" | "fixing";
};

const GOVERNANCE_BLOCKER_LABELS: Record<string, string> = {
  missing_bound_assets: "选择这个功能要用哪些数据",
  missing_confirmed_declaration: "让系统生成一段权限说明，然后点确认",
  missing_skill_data_grant: "允许这个功能读取需要的数据",
  grant_missing_view_binding: "选择这个功能能看到哪一版数据",
  missing_role_group_binding: "选择哪些人可以使用这个功能",
  missing_table_permission_policy: "设置这个功能能读哪些数据",
  skill_content_version_mismatch: "重新检查一次设置，确保用的是最新版",
  governance_version_mismatch: "重新检查一次设置，确保用的是最新版",
  stale_governance_bundle: "重新检查一次设置，确保用的是最新版",
};

function compactText(value: string | null | undefined, maxLength = 132) {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = compactText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function parseGateSummary(value: string | null | undefined) {
  const text = compactText(value, 240);
  if (!text) return [];
  const afterColon = text.includes("：") ? text.split("：").slice(1).join("：") : text;
  return afterColon
    .split(/[、,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeGovernanceBlocker(code: string | null | undefined, title: string | null | undefined) {
  if (code && GOVERNANCE_BLOCKER_LABELS[code]) return GOVERNANCE_BLOCKER_LABELS[code];
  const text = title || "";
  if (/权限声明/.test(text)) return "让系统生成一段权限说明，然后点确认";
  if (/治理包|治理版本|内容版本|刷新/.test(text)) return "重新检查一次设置，确保用的是最新版";
  if (/数据资产|数据表/.test(text) && /绑定|未/.test(text)) return "选择这个功能要用哪些数据";
  if (/授权/.test(text)) return "允许这个功能读取需要的数据";
  if (/角色组/.test(text)) return "选择哪些人可以使用这个功能";
  return text
    .replace("未确认权限声明", "让系统生成一段权限说明，然后点确认")
    .replace("治理包已过期", "重新检查一次设置，确保用的是最新版");
}

function simplifyGuidedStepTitle(title: string) {
  if (/权限声明/.test(title)) return "让系统生成一段权限说明，然后点确认";
  if (/刷新|治理状态|过期|版本/.test(title)) return "重新检查一次设置，确保用的是最新版";
  if (/数据资产|数据表/.test(title)) return "选择这个功能要用哪些数据";
  return title;
}

function getGovernanceBlockers(governanceIntent: WorkspaceGovernanceIntent) {
  if (!governanceIntent) return [];
  const fromReasons = governanceIntent.gateReasons?.map((reason) => normalizeGovernanceBlocker(reason.code, reason.title)) ?? [];
  if (fromReasons.length > 0) return uniqueNonEmpty(fromReasons);
  const fromSummary = parseGateSummary(governanceIntent.gateSummary).map((item) => normalizeGovernanceBlocker(null, item));
  if (fromSummary.length > 0) return uniqueNonEmpty(fromSummary);
  return uniqueNonEmpty(governanceIntent.guidedSteps?.filter((step) => step.status !== "done").map((step) => step.title) ?? []);
}

function buildGovernanceNextStep(blockers: string[], governanceIntent: WorkspaceGovernanceIntent) {
  const firstGuidedStep = governanceIntent?.guidedSteps?.find((step) => step.status !== "done");
  if (firstGuidedStep?.title) {
    return `点击下面的按钮，先完成「${simplifyGuidedStepTitle(firstGuidedStep.title)}」。`;
  }
  if (blockers.some((item) => item.includes("权限说明"))) {
    return blockers.some((item) => item.includes("重新检查"))
      ? "点击下面的按钮，先让系统生成权限说明并确认；完成后再重新检查一次设置。"
      : "点击下面的按钮，先让系统生成权限说明并确认。";
  }
  if (blockers.some((item) => item.includes("重新检查"))) {
    return "点击下面的按钮，重新检查一次设置，然后再继续测试。";
  }
  if (blockers.length > 0) {
    return `点击下面的按钮，先处理「${blockers[0]}」。`;
  }
  return "点击下面的按钮，让系统检查还缺什么。";
}

function buildUserFacingCardSummary(input: {
  card: WorkbenchCard;
  memo: SkillMemo | null;
  activeSandboxReport: SandboxReport | null;
  governanceIntent: WorkspaceGovernanceIntent;
  nextPendingCard: WorkbenchCard | null;
}): UserFacingCardSummary | null {
  const { card, memo, activeSandboxReport, governanceIntent, nextPendingCard } = input;
  const isGovernanceCard = card.mode === "governance" || card.contractId === "governance.panel";
  const isValidationCard = card.kind === "validation" || card.contractId === "validation.test_ready";
  const isFixingCard = card.kind === "fixing" || card.contractId?.startsWith("fixing.");

  if (isGovernanceCard) {
    const blockers = getGovernanceBlockers(governanceIntent);
    const blocked = governanceIntent?.mode === "mount_blocked" || blockers.length > 0;
    return {
      eyebrow: "当前状态",
      title: blocked ? "现在还不能测试" : "需要先检查设置",
      description: blocked
        ? "系统还缺几步设置。做完下面这些事，才能继续测试。"
        : "系统需要先确认这个功能能用哪些数据、哪些人能用。",
      blockers,
      nextStep: buildGovernanceNextStep(blockers, governanceIntent),
      note: governanceIntent?.verdictReason || governanceIntent?.gateSummary || null,
      tone: "governance",
    };
  }

  if (card.contractId === "validation.test_ready") {
    return {
      eyebrow: "当前状态",
      title: "现在可以测试",
      description: "设置已经够了，可以让系统跑一遍测试。",
      blockers: [],
      nextStep: "点击「打开 Sandbox」开始测试。",
      note: memo?.status_summary || null,
      tone: "validation",
    };
  }

  if (isValidationCard && card.mode === "report") {
    const failed = activeSandboxReport ? !activeSandboxReport.approval_eligible : memo?.latest_test?.status === "failed";
    return {
      eyebrow: "测试结论",
      title: failed ? "测试没通过" : "测试通过了",
      description: failed
        ? "系统发现了问题，需要先修。"
        : "这次测试没发现需要拦住的问题，可以继续提交或发布。",
      blockers: failed ? uniqueNonEmpty([
        memo?.current_task?.title,
        nextPendingCard?.kind === "fixing" ? nextPendingCard.title : null,
      ]).slice(0, 3) : [],
      nextStep: failed
        ? "先处理下一张修复卡；想看详细原因时再展开技术详情。"
        : "继续提交审批或进入发布流程。",
      note: activeSandboxReport ? `Sandbox 报告 #${activeSandboxReport.report_id}` : memo?.latest_test?.summary || null,
      tone: "validation",
    };
  }

  if (isFixingCard) {
    if (card.fixTask) {
      return {
        eyebrow: "整改任务",
        title: "这里需要修一下",
        description: compactText(card.fixTask.description || card.summary || "当前测试问题需要修改 Skill 内容。"),
        blockers: card.fixTask.acceptance_rule_text ? [card.fixTask.acceptance_rule_text] : [],
        nextStep: "点击「修复此项」，让系统直接生成修改建议。",
        note: card.target.key ? `目标：${card.target.key}` : null,
        tone: "fixing",
      };
    }
    return {
      eyebrow: "整改概览",
      title: "测试没过，需要修",
      description: compactText(memo?.latest_test?.summary || card.summary || "这次测试没通过，需要一项一项修。"),
      blockers: uniqueNonEmpty([
        memo?.current_task?.title,
        nextPendingCard?.kind === "fixing" ? nextPendingCard.title : null,
      ]).slice(0, 3),
      nextStep: nextPendingCard
        ? `先处理「${nextPendingCard.title}」。`
        : "让系统把测试问题拆成可以直接处理的修复任务。",
      note: memo?.latest_test?.source_report_id ? `来源报告 #${memo.latest_test.source_report_id}` : null,
      tone: "fixing",
    };
  }

  return null;
}

function UserFacingCardSummaryPanel({ summary }: { summary: UserFacingCardSummary }) {
  const toneClass = summary.tone === "fixing"
    ? "border-[#EF4444] bg-[#FFF5F5]"
    : summary.tone === "validation"
      ? "border-[#F59E0B] bg-[#FFFBEB]"
      : "border-[#8B5CF6] bg-[#F5F3FF]";
  const accentClass = summary.tone === "fixing"
    ? "text-[#EF4444]"
    : summary.tone === "validation"
      ? "text-[#F59E0B]"
      : "text-[#8B5CF6]";

  return (
    <div className={`border-2 ${toneClass} p-3 space-y-3`}>
      <div className={`text-[8px] font-bold uppercase tracking-[0.2em] ${accentClass}`}>
        {summary.eyebrow}
      </div>
      <div>
        <div className="text-[13px] font-bold text-[#1A202C]">{summary.title}</div>
        <div className="mt-1 text-[10px] leading-relaxed text-gray-600">{summary.description}</div>
      </div>
      {summary.blockers.length > 0 && (
        <div className="border border-white/80 bg-white/80 px-2 py-2">
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-500">
            先做这 {summary.blockers.length} 件事
          </div>
          <ol className="mt-1.5 space-y-1">
            {summary.blockers.map((blocker, index) => (
              <li key={`${blocker}:${index}`} className="flex gap-2 text-[10px] leading-relaxed text-[#1A202C]">
                <span className={`font-bold ${accentClass}`}>{index + 1}.</span>
                <span>{blocker}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="border-l-2 border-[#1A202C] bg-white/70 px-2 py-2">
        <div className="text-[8px] font-bold uppercase tracking-widest text-gray-500">建议下一步</div>
        <div className="mt-1 text-[10px] leading-relaxed font-semibold text-[#1A202C]">{summary.nextStep}</div>
      </div>
      {summary.note && (
        <div className="text-[9px] leading-relaxed text-gray-500">{compactText(summary.note, 120)}</div>
      )}
    </div>
  );
}

function TechnicalDetails({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-dashed border-[#1A202C]/15 bg-[#F8FCFD]">
      <button
        type="button"
        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-gray-500">技术详情</span>
        {expanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="border-t border-dashed border-[#1A202C]/10 p-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

function hasDirectCardActions(card: WorkbenchCard) {
  if (card.externalBuildStatus && EXTERNAL_CTA_OVERRIDE[card.externalBuildStatus]) return true;
  return Boolean(resolveStudioCardContract(card)?.ctas.length);
}

// ── 整改任务详情 ──

function FixTaskDetail({ task }: { task: SkillMemoTask }) {
  const priorityColor = task.priority === "high" ? "bg-red-500" : task.priority === "medium" ? "bg-amber-500" : "bg-gray-400";
  const priorityLabel = task.priority === "high" ? "P0" : task.priority === "medium" ? "P1" : "P2";
  return (
    <div className="mt-1 space-y-1">
      <div className="flex items-center gap-2">
        <span className={`${priorityColor} text-white text-[7px] font-bold px-1 py-0.5`}>{priorityLabel}</span>
        <span className="text-[7px] font-bold uppercase tracking-widest text-gray-400">{task.type}</span>
      </div>
      {task.description && (
        <div className="text-[9px] text-gray-600 leading-relaxed">{task.description}</div>
      )}
      {task.acceptance_rule_text && (
        <div className="text-[8px] text-gray-500 border-l-2 border-gray-200 pl-2">
          验收：{task.acceptance_rule_text}
        </div>
      )}
      {task.target_files.length > 0 && (
        <div className="text-[8px] font-mono text-[#00A3C4]">
          {task.target_files.join(", ")}
        </div>
      )}
    </div>
  );
}

function ContractDetail({ card }: { card: WorkbenchCard }) {
  const contract = resolveStudioCardContract(card);
  if (!contract) return null;
  return (
    <div className="border border-dashed border-[#1A202C]/15 bg-[#F8FCFD] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">
          Contract · {contract.contractId}
        </span>
        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">
          {contract.phase}
        </span>
      </div>
      <div className="text-[10px] leading-relaxed text-gray-600">{contract.objective}</div>
      {contract.forbiddenActions.length > 0 && (
        <div className="text-[9px] leading-relaxed text-red-500">
          禁止：{contract.forbiddenActions.join("；")}
        </div>
      )}
      {contract.nextCards.length > 0 && (
        <div className="text-[8px] font-mono text-gray-500">
          Next: {contract.nextCards.join(" → ")}
        </div>
      )}
    </div>
  );
}

// ── 阶段引导提示 ──

function PhaseGuidance({ card }: { card: WorkbenchCard }) {
  if (!card.id.startsWith("create:architect:")) return null;
  const phase = card.phase?.replace("architect_", "") || "";
  if (phase === "why") {
    return (
      <div className="mt-2 text-[9px] text-[#00D1FF] leading-relaxed border-l-2 border-[#00D1FF] pl-2">
        当前在 Why 阶段：通过对话追问根因，不要急于打开编辑器
      </div>
    );
  }
  if (phase === "what") {
    return (
      <div className="mt-2 text-[9px] text-[#3B82F6] leading-relaxed border-l-2 border-[#3B82F6] pl-2">
        当前在 What 阶段：关注结构树、维度清单、场景覆盖
      </div>
    );
  }
  if (phase === "how") {
    return (
      <div className="mt-2 text-[9px] text-[#10B981] leading-relaxed border-l-2 border-[#10B981] pl-2">
        当前在 How 阶段：暴露失败风险、优先级和收敛结论
      </div>
    );
  }
  return null;
}

// ── Artifact 展示 ──

function formatArtifactLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderArtifactValue(value: unknown): ReactNode {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <p className="text-[#1A202C]">{String(value)}</p>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-0.5">
        {value.map((item, i) => (
          <li key={i} className="flex items-start gap-1 text-[#1A202C]">
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
            <span className="w-20 flex-shrink-0 text-[7px] font-bold uppercase tracking-widest text-gray-400">
              {formatArtifactLabel(key)}
            </span>
            <div className="flex-1 min-w-0">{renderArtifactValue(entry)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-gray-400">暂无结构化内容</p>;
}

function CardArtifacts({ card }: { card: WorkbenchCard }) {
  const allArtifacts = useStudioStore((s) => s.architectArtifacts);
  const matched = useMemo(() => {
    if (allArtifacts.length === 0) return [];
    const refSet = card.artifactRefs ? new Set(card.artifactRefs) : null;
    return allArtifacts.filter((a) =>
      a.cardId === card.id
      || (refSet && refSet.has(a.id))
      || (a.contractId && a.contractId === card.contractId)
    );
  }, [allArtifacts, card.id, card.artifactRefs, card.contractId]);

  if (matched.length === 0) return null;

  return (
    <div className="border border-dashed border-[#00A3C4]/30 bg-[#ECFBFF] p-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-[#00A3C4]">Artifacts</span>
        <span className="text-[7px] text-gray-400">{matched.length}</span>
      </div>
      {matched.map((artifact) => (
        <ArtifactItem key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );
}

function ArtifactItem({ artifact }: { artifact: ArchitectArtifact }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border px-2 py-1.5 ${artifact.stale ? "border-amber-300 bg-amber-50/80" : "border-white/70 bg-white/80"}`}>
      <button
        type="button"
        className="w-full text-left flex items-center gap-2"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded
          ? <ChevronDown size={10} className="text-gray-400 flex-shrink-0" />
          : <ChevronRight size={10} className="text-gray-400 flex-shrink-0" />}
        <span className="text-[9px] font-bold text-[#1A202C] truncate">{artifact.title}</span>
        {artifact.phase && (
          <span className="ml-auto text-[7px] font-bold uppercase tracking-widest text-gray-400">{artifact.phase}</span>
        )}
        {artifact.stale && (
          <span className="text-[7px] font-bold uppercase tracking-widest text-amber-600">stale</span>
        )}
      </button>
      {artifact.summary && !expanded && (
        <p className="mt-0.5 text-[8px] text-gray-500 line-clamp-2 pl-4">{artifact.summary}</p>
      )}
      {expanded && (
        <div className="mt-1.5 pl-4 text-[9px]">
          {artifact.summary && <p className="text-gray-500 mb-1">{artifact.summary}</p>}
          {renderArtifactValue(artifact.data)}
        </div>
      )}
    </div>
  );
}

const BLOCK_REASON: Record<string, string> = {
  pending_confirmation: "存在待确认修改",
  failed_validation: "测试失败待整改",
  waiting_bindback: "外部编辑待回绑",
  waiting_external: "外部处理中",
  phase_gate: "治理门禁未满足",
};

const EXTERNAL_CTA_OVERRIDE: Record<string, { label: string; actionId: StudioCardActionId }> = {
  waiting_external_build: { label: "去外部完成实现", actionId: "handoff.external_build" },
  external_in_progress: { label: "查看交接信息", actionId: "architect.continue" },
  returned_waiting_bindback: { label: "回到 Studio 继续绑定", actionId: "handoff.bind_back" },
  returned_waiting_validation: { label: "开始验证", actionId: "validation.open_sandbox" },
};

// ── 主组件 ──

export function StudioCardRail({
  skill,
  workflowState,
  cards,
  activeCardId,
  memo,
  cardQueueLedger,
  activeSandboxReport,
  governanceIntent,
  pendingGovernanceCount,
  pendingStagedEditCount,
  activeCardActions,
  onSelect,
  onOpenGovernancePanel,
  onOpenSandbox,
  onOpenPrompt,
  onFocusChat,
  onApplyDraft,
  onDiscardDraft,
  onConfirmSummary,
  onDiscardSummary,
  onConfirmSplit,
  onDiscardSplit,
  onStartFixTask,
  onTargetedRetest,
  onSubmitApproval,
  onConfirmTool,
  onExternalBuild,
  onBindBack,
}: {
  skill: SkillDetail | null;
  workflowState: WorkflowStateData | null;
  cards: WorkbenchCard[];
  activeCardId: string | null;
  memo: SkillMemo | null;
  cardQueueLedger?: StudioCardQueueLedger | null;
  activeSandboxReport: SandboxReport | null;
  governanceIntent: WorkspaceGovernanceIntent;
  pendingGovernanceCount: number;
  pendingStagedEditCount: number;
  activeCardActions: WorkspaceAction[];
  onSelect: (cardId: string) => void;
  onOpenGovernancePanel: () => void;
  onOpenSandbox: () => void;
  onOpenPrompt: () => void;
  onFocusChat: (text: string) => void;
  onApplyDraft: () => void;
  onDiscardDraft: () => void;
  onConfirmSummary: () => void;
  onDiscardSummary: () => void;
  onConfirmSplit: () => void;
  onDiscardSplit: () => void;
  onStartFixTask: (task: SkillMemoTask) => void;
  onTargetedRetest: (taskId: string) => void;
  onSubmitApproval: () => void;
  onConfirmTool: () => void;
  onExternalBuild: (card: WorkbenchCard) => void;
  onBindBack: (card: WorkbenchCard) => void;
}) {
  const [completedCollapsed, setCompletedCollapsed] = useState(true);
  const [backlogExpanded, setBacklogExpanded] = useState(false);
  const queueWindow = useStudioStore((s) => s.queueWindow);
  const resumeHintDismissed = useStudioStore((s) => s.resumeHintDismissed);
  const dismissResumeHint = useStudioStore((s) => s.dismissResumeHint);
  const studioError = useStudioStore((s) => s.studioError);
  const setStudioError = useStudioStore((s) => s.setStudioError);
  const transitionBlock = useStudioStore((s) => s.transitionBlock);
  const setTransitionBlock = useStudioStore((s) => s.setTransitionBlock);
  const reconcileConflict = useStudioStore((s) => s.reconcileConflict);
  const setReconcileConflict = useStudioStore((s) => s.setReconcileConflict);
  const timelineEntries = useStudioStore((s) => s.timelineEntries);
  const pendingCount = cards.filter((card) => card.status === "pending" || card.status === "active").length;
  const activeCard = cards.find((c) => c.id === activeCardId) ?? null;
  const pendingCards = useMemo(
    () => cards.filter((c) => c.id !== activeCardId && (c.status === "pending" || c.status === "active")),
    [cards, activeCardId],
  );
  const ledgerStats = cardQueueLedger?.stats ?? {};
  const ledgerCompletedCount = ledgerStats.completed ?? cardQueueLedger?.completed?.length ?? 0;
  const ledgerStaleCount = ledgerStats.stale ?? cardQueueLedger?.stale?.length ?? 0;
  const ledgerArtifactContractCount = Object.keys(cardQueueLedger?.artifacts_by_contract ?? {}).length;
  const ledgerExitLog = cardQueueLedger?.exit_log ?? [];
  const latestExit = ledgerExitLog[ledgerExitLog.length - 1] ?? null;

  // 已完成任务折叠组的卡片
  const completedGroupCard = cards.find((c) => c.id === "fixing:completed-group");

  const hiddenCardIdSet = useMemo(
    () => new Set(queueWindow?.hidden_card_ids ?? []),
    [queueWindow],
  );

  const { windowCards, backlogCards } = useMemo(() => {
    const withoutCompletedGroup = cards.filter((c) => c.id !== "fixing:completed-group");
    if (!queueWindow || queueWindow.visible_card_ids.length === 0) {
      const actionable = withoutCompletedGroup.filter(c =>
        c.id === activeCardId || c.status === "pending" || c.status === "active" || c.status === "reviewing"
      ).slice(0, 5);
      const actionableSet = new Set(actionable.map(c => c.id));
      return {
        windowCards: actionable,
        backlogCards: withoutCompletedGroup.filter(c => !actionableSet.has(c.id)),
      };
    }
    const visibleSet = new Set(queueWindow.visible_card_ids);
    if (queueWindow.active_card_id) visibleSet.add(queueWindow.active_card_id);
    // preview 卡也进 window（低强调展示）
    if (queueWindow.preview_card_id) visibleSet.add(queueWindow.preview_card_id);
    // 1.2: blocking 卡强制进可见窗口
    const blockingCardId = queueWindow.blocking_signal?.card_id;
    if (blockingCardId) visibleSet.add(blockingCardId);
    const window: WorkbenchCard[] = [];
    const backlog: WorkbenchCard[] = [];
    for (const c of withoutCompletedGroup) {
      if (visibleSet.has(c.id)) window.push(c);
      else backlog.push(c);
    }
    // 确保 blocking 卡在 active card 之后
    if (blockingCardId && !queueWindow.visible_card_ids.includes(blockingCardId)) {
      const blockingIdx = window.findIndex(c => c.id === blockingCardId);
      const activeIdx = window.findIndex(c => c.id === queueWindow.active_card_id);
      if (blockingIdx > -1 && activeIdx > -1 && blockingIdx !== activeIdx + 1) {
        const [blockingCard] = window.splice(blockingIdx, 1);
        window.splice(activeIdx + 1, 0, blockingCard);
      }
    }
    return { windowCards: window, backlogCards: backlog };
  }, [cards, queueWindow, activeCardId]);

  const descriptor = useMemo(() => {
    if (!activeCard) return null;
    if (activeCard.mode === "analysis") {
      return buildAnalysisDescriptor({
        card: activeCard,
        workflowState,
        memo,
        pendingGovernanceCount,
        pendingStagedEditCount,
        pendingAnalysisCards: pendingCards.filter((c) => c.mode === "analysis").length,
        pendingExecutionCards: pendingCards.filter((c) => c.mode !== "analysis").length,
        nextPendingCard: pendingCards[0] ?? null,
      });
    }
    if (activeCard.mode === "governance") {
      return buildGovernanceDescriptor({
        skill,
        memo,
        activeSandboxReport,
        governanceIntent,
        pendingGovernanceCount,
        pendingStagedEditCount,
        pendingValidationCards: pendingCards.filter((c) => c.kind === "validation").length,
        pendingGovernanceCards: pendingCards.filter((c) => c.kind === "governance").length,
        nextPendingCard: pendingCards[0] ?? null,
      });
    }
    if (activeCard.mode === "report") {
      return buildReportDescriptor({
        memo,
        activeSandboxReport,
        pendingGovernanceCount,
        pendingStagedEditCount,
        nextPendingCard: pendingCards[0] ?? null,
      });
    }
    return null;
  }, [activeCard, workflowState, memo, skill, activeSandboxReport, governanceIntent, pendingGovernanceCount, pendingStagedEditCount, pendingCards]);

  const actionSections = useMemo(() => {
    if (!activeCard) return [];
    const kind = activeCard.mode === "analysis" ? "analysis"
      : activeCard.mode === "governance" ? "governance"
        : activeCard.mode === "report" ? "report"
          : null;
    if (!kind || kind === "report" && false) return [];
    return buildWorkspaceActionSections({
      kind: kind as "analysis" | "governance" | "report",
      workflowState,
      memo,
      nextPendingCard: pendingCards[0] ?? null,
      hasGovernanceQueue: pendingGovernanceCount > 0 || pendingStagedEditCount > 0,
      hasLatestTest: Boolean(activeSandboxReport || memo?.latest_test),
      onSelectWorkbenchCard: onSelect,
      onOpenPrompt: kind !== "report" ? onOpenPrompt : undefined,
      onOpenGovernancePanel,
      onOpenSandbox,
      onFocusChat,
      activeCardActions,
    });
  }, [activeCard, workflowState, memo, pendingCards, pendingGovernanceCount, pendingStagedEditCount, activeSandboxReport, onSelect, onOpenPrompt, onOpenGovernancePanel, onOpenSandbox, onFocusChat, activeCardActions]);

  return (
    <div className="flex-1 min-w-[320px] max-w-[480px] flex-shrink-0 border-r-2 border-[#1A202C] bg-[#F8FCFD] min-h-0 flex flex-col">
      <div className="flex-shrink-0 border-b-2 border-[#1A202C] px-4 py-3 bg-white">
        <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#00A3C4]">Card Queue</div>
        <div className="mt-2 text-sm font-bold text-[#1A202C] truncate">
          {skill?.name || "未选择 Skill"}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-gray-500 font-mono">
          <span>{queueWindow?.phase || workflowState?.phase || "discover"}</span>
          <span>
            {pendingCount}/{cards.length} 待处理
            {backlogCards.length > 0 && ` · ${backlogCards.length} 排队`}
          </span>
        </div>
        {/* resume_hint 恢复提示 */}
        {queueWindow?.resume_hint && !resumeHintDismissed && (
          <div className={`mt-1.5 flex items-center gap-1.5 text-[9px] ${
            queueWindow.resume_hint.kind === "resume_reprioritized" ? "text-amber-600" : "text-[#00A3C4]"
          }`}>
            <span className="flex-1 truncate">{queueWindow.resume_hint.message}</span>
            <button
              type="button"
              onClick={dismissResumeHint}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        )}
        {cardQueueLedger && (
          <div className="mt-2 border border-dashed border-[#00A3C4]/30 bg-[#F8FCFD] px-2 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-[#00A3C4]">
                Queue Ledger
              </span>
              <span className="text-[7px] font-mono text-gray-400">
                {ledgerStats.total ?? cards.length} cards
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              <div className="bg-white border border-[#1A202C]/10 px-1 py-1">
                <div className="text-[10px] font-bold text-[#1A202C]">{ledgerCompletedCount}</div>
                <div className="text-[7px] text-gray-400">完成</div>
              </div>
              <div className="bg-white border border-[#1A202C]/10 px-1 py-1">
                <div className="text-[10px] font-bold text-[#F59E0B]">{ledgerStaleCount}</div>
                <div className="text-[7px] text-gray-400">过期</div>
              </div>
              <div className="bg-white border border-[#1A202C]/10 px-1 py-1">
                <div className="text-[10px] font-bold text-[#00A3C4]">{ledgerStats.active ?? 0}</div>
                <div className="text-[7px] text-gray-400">活跃</div>
              </div>
              <div className="bg-white border border-[#1A202C]/10 px-1 py-1">
                <div className="text-[10px] font-bold text-[#10B981]">{ledgerArtifactContractCount}</div>
                <div className="text-[7px] text-gray-400">产物</div>
              </div>
            </div>
            {latestExit && (
              <div className="text-[8px] font-mono text-gray-500 truncate">
                最近退场：{String(latestExit.card_id ?? latestExit.id ?? "unknown")} · {String(latestExit.exit_reason ?? latestExit.reason ?? latestExit.status ?? "recorded")}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {cards.length === 0 && (
          <div className="border border-dashed border-gray-300 bg-white px-3 py-4 text-[9px] text-gray-400 font-mono">
            当前还没有可聚焦卡片
          </div>
        )}

        {/* blocking_signal 横幅 */}
        {queueWindow?.blocking_signal && (
          <div className="border border-amber-300 bg-amber-50 px-3 py-2 flex items-center gap-2 text-[9px] text-amber-700">
            <AlertTriangle size={12} className="flex-shrink-0 text-amber-500" />
            <span>{queueWindow.blocking_signal.reason}</span>
          </div>
        )}

        {/* transition_blocked_patch 显式阻塞横幅 */}
        {transitionBlock && (
          <div className="border border-amber-400 bg-amber-50 px-3 py-2 text-[9px] space-y-1.5">
            <div className="font-bold text-amber-700">{transitionBlock.reason}</div>
            {transitionBlock.blockedCardId && (
              <div className="text-amber-600 font-mono">阻塞卡片：{transitionBlock.blockedCardId}</div>
            )}
            {transitionBlock.prerequisiteCardIds.length > 0 && (
              <div className="space-y-1">
                <div className="text-amber-600">先完成这些前置项：</div>
                <div className="flex flex-wrap gap-1">
                  {transitionBlock.prerequisiteCardIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelect(id)}
                      className="text-[8px] font-bold uppercase tracking-widest text-amber-700 border border-amber-300 bg-white px-2 py-0.5 hover:bg-amber-100 transition-colors"
                    >
                      前往 {id}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setTransitionBlock(null)}
              className="text-[8px] font-bold uppercase tracking-widest text-amber-700 border border-amber-300 px-2 py-0.5 hover:bg-amber-100 transition-colors"
            >
              关闭
            </button>
          </div>
        )}

        {/* studioError 显式报错横幅 */}
        {studioError && (
          <div className="border-2 border-red-400 bg-red-50 px-3 py-2 text-[9px] space-y-1">
            <div className="font-bold text-red-700">{studioError.message}</div>
            {studioError.step && (
              <div className="text-red-600">失败步骤：{studioError.step}</div>
            )}
            <div className="text-red-500">
              {studioError.autoAdvanced === false ? "当前未自动继续推进。" : "当前已暂停自动推进。"}
            </div>
            {studioError.recoveryHint && (
              <div className="text-red-600">补救动作：{studioError.recoveryHint}</div>
            )}
            {studioError.activeCardId && (
              <div className="text-red-500 font-mono">当前卡片：{studioError.activeCardId}</div>
            )}
            <button
              type="button"
              onClick={() => setStudioError(null)}
              className="text-[8px] font-bold uppercase tracking-widest text-red-600 border border-red-300 px-2 py-0.5 hover:bg-red-100 transition-colors"
            >
              关闭
            </button>
          </div>
        )}

        {/* reconcile_patch 冲突横幅 */}
        {reconcileConflict && (
          <div className="border border-purple-300 bg-purple-50 px-3 py-2 text-[9px] space-y-1.5">
            <div className="font-bold text-purple-700">{reconcileConflict.message}</div>
            {Object.keys(reconcileConflict.conflictDetails).length > 0 && (
              <div className="text-purple-600 font-mono break-all">
                冲突详情：{JSON.stringify(reconcileConflict.conflictDetails, null, 0)}
              </div>
            )}
            <div className="text-purple-600">检测到冲突，当前不会静默合并。</div>
            <button
              type="button"
              onClick={() => setReconcileConflict(null)}
              className="text-[8px] font-bold uppercase tracking-widest text-purple-700 border border-purple-300 px-2 py-0.5 hover:bg-purple-100 transition-colors"
            >
              关闭
            </button>
          </div>
        )}

        {/* timeline_patch 最近事件 */}
        {timelineEntries.length > 0 && (
          <div className="border border-[#1A202C]/10 bg-white px-3 py-2 space-y-1.5">
            <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-gray-500">Timeline</div>
            {timelineEntries.slice(-3).reverse().map((entry) => (
              <div key={entry.id} className="text-[8px] text-gray-600 font-mono">
                <span className="text-gray-400">{entry.timestamp}</span>
                {" · "}
                <span>{entry.message}</span>
                {entry.cardId ? ` · ${entry.cardId}` : ""}
              </div>
            ))}
          </div>
        )}

        {/* queue_window fallback 轻提示 */}
        {!!(queueWindow as Record<string, unknown> | null)?._fallback && (
          <div className="text-[8px] text-gray-400 px-3 py-1 font-mono">
            队列信息来自本地推算
          </div>
        )}

        {windowCards.map((card, index) => {
          const active = card.id === activeCardId;
          const isPreview = queueWindow?.preview_card_id === card.id;
          const isBlocked = hiddenCardIdSet.has(card.id);
          const isStale = card.status === "stale";
          const style = KIND_STYLE[card.kind];
          const previousGroupLabel = index > 0 ? windowCards[index - 1]?.groupLabel ?? null : null;

          // 分组标题
          const groupHeader: ReactNode = card.groupLabel && card.groupLabel !== previousGroupLabel ? (
            <div className="text-[7px] font-bold uppercase tracking-[0.2em] text-gray-400 mt-3 mb-1 first:mt-0">
              {card.groupLabel}
            </div>
          ) : null;

          // preview / blocked / stale 卡点击处理
          const handleCardClick = () => {
            if (isPreview) return; // preview 卡不可选中
            onSelect(card.id); // blocked 和 stale 卡均可选中
          };

          // 卡片样式
          const cardBorderClass = active
            ? `${style.border} ${style.bg} shadow-[4px_4px_0_0_#1A202C]`
            : isStale
              ? "border-dashed border-gray-300 bg-gray-100/50"
              : isPreview
                ? "border-dashed border-gray-300 bg-gray-50"
                : isBlocked
                  ? "border-amber-300 bg-amber-50/50"
                  : `border-[#1A202C]/15 bg-white hover:${style.border}`;
          const userFacingSummary = active
            ? buildUserFacingCardSummary({
              card,
              memo,
              activeSandboxReport,
              governanceIntent,
              nextPendingCard: pendingCards[0] ?? null,
            })
            : null;

          return (
            <div key={card.id}>
              {groupHeader}
              <div className="space-y-0">
                <button
                  type="button"
                  onClick={handleCardClick}
                  className={`w-full text-left border-2 px-3 py-3 transition-colors ${cardBorderClass} ${
                    isPreview ? "cursor-default" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {isBlocked && (
                      <AlertTriangle size={10} className="text-amber-500 flex-shrink-0" />
                    )}
                    <span className={`text-[7px] font-bold uppercase tracking-widest ${isStale ? "text-gray-400" : style.text}`}>
                      {style.label}
                    </span>
                    <span className="text-[7px] font-bold uppercase tracking-widest text-gray-400">
                      {MODE_LABEL[card.mode]}
                    </span>
                    {isPreview && (
                      <span className="text-[7px] font-bold uppercase tracking-widest text-gray-400 border border-gray-300 px-1">
                        预览
                      </span>
                    )}
                    {card.externalBuildStatus ? (
                      <span className={`ml-auto text-[7px] font-bold uppercase tracking-widest ${EXTERNAL_STATUS_LABEL[card.externalBuildStatus].color}`}>
                        {EXTERNAL_STATUS_LABEL[card.externalBuildStatus].text}
                      </span>
                    ) : (
                      <span className={`ml-auto text-[7px] font-bold uppercase tracking-widest ${isStale ? "text-amber-500" : "text-gray-400"}`}>
                        {STATUS_LABEL[card.status]}
                      </span>
                    )}
                  </div>
                  <div className={`mt-2 text-[11px] font-bold text-[#1A202C] line-clamp-2 ${isStale ? "opacity-50" : ""}`}>
                    {card.title}
                  </div>
                  {isPreview && (
                    <div className="mt-1 text-[8px] text-gray-400">当前阶段完成后可进入</div>
                  )}
                  {isBlocked && queueWindow?.blocking_signal && (
                    <div className="mt-1 text-[8px] text-amber-600">
                      {BLOCK_REASON[queueWindow.blocking_signal.kind] || queueWindow.blocking_signal.reason}
                    </div>
                  )}
                  <div className={`mt-1 text-[9px] leading-relaxed text-gray-500 line-clamp-3 ${isStale ? "opacity-50" : ""}`}>
                    {card.summary}
                  </div>
                  {card.target.key && (
                    <div className="mt-2 text-[8px] font-mono text-[#00A3C4] truncate">
                      {card.target.key}
                    </div>
                  )}
                </button>

                {/* Expanded detail for active card */}
                {active && (
                  <div className={`border-2 border-t-0 ${style.border} bg-white p-3 space-y-2`}>
                    {/* 阶段引导提示 */}
                    <PhaseGuidance card={card} />

                    {/* Architect artifact 展示 */}
                    <CardArtifacts card={card} />

                    {/* 整改任务详情 */}
                    {card.fixTask && <FixTaskDetail task={card.fixTask} />}

                    {/* 面向用户的默认摘要，技术细节默认折叠 */}
                    {userFacingSummary && (
                      <UserFacingCardSummaryPanel summary={userFacingSummary} />
                    )}

                    {/* 操作按钮 */}
                    <CardActions
                      card={card}
                      onOpenPrompt={onOpenPrompt}
                      onApplyDraft={onApplyDraft}
                      onDiscardDraft={onDiscardDraft}
                      onConfirmSummary={onConfirmSummary}
                      onDiscardSummary={onDiscardSummary}
                      onConfirmSplit={onConfirmSplit}
                      onDiscardSplit={onDiscardSplit}
                      onStartFixTask={onStartFixTask}
                      onTargetedRetest={onTargetedRetest}
                      onSubmitApproval={onSubmitApproval}
                      onOpenGovernancePanel={onOpenGovernancePanel}
                      onOpenSandbox={onOpenSandbox}
                      onFocusChat={onFocusChat}
                      onConfirmTool={onConfirmTool}
                      onExternalBuild={onExternalBuild}
                      onBindBack={onBindBack}
                    />

                    {userFacingSummary && !hasDirectCardActions(card) && actionSections.map((section) => (
                      <ActionGroup
                        key={section.title}
                        title={section.title === "推荐操作" ? "建议操作" : section.title}
                        actions={section.actions.slice(0, 3)}
                      />
                    ))}

                    {userFacingSummary ? (
                      <TechnicalDetails>
                        <ContractDetail card={card} />
                        {descriptor && (
                          <CardDetail
                            card={card}
                            descriptor={descriptor}
                            actionSections={actionSections}
                            showActions={false}
                          />
                        )}
                      </TechnicalDetails>
                    ) : (
                      <>
                        <ContractDetail card={card} />

                        {/* 传统 descriptor 详情（governance/analysis/report 模式） */}
                        {descriptor && (
                          <CardDetail
                            card={card}
                            descriptor={descriptor}
                            actionSections={actionSections}
                          />
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Backlog 折叠区 */}
        {backlogCards.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setBacklogExpanded((v) => !v)}
              className={`w-full text-left border border-dashed px-3 py-2 flex items-center gap-2 ${
                queueWindow?.reveal_policy === "user_expand"
                  ? "border-[#00A3C4]/30 bg-[#F8FCFD]"
                  : "border-gray-300 bg-gray-50"
              }`}
            >
              {backlogExpanded
                ? <ChevronDown size={12} className={queueWindow?.reveal_policy === "user_expand" ? "text-[#00A3C4]" : "text-gray-400"} />
                : <ChevronRight size={12} className={queueWindow?.reveal_policy === "user_expand" ? "text-[#00A3C4]" : "text-gray-400"} />}
              <span className={`text-[9px] font-bold ${
                queueWindow?.reveal_policy === "user_expand" ? "text-[#00A3C4]" : "text-gray-400"
              }`}>
                {backlogCards.length} 张卡片在队列中
              </span>
              {queueWindow?.reveal_policy === "validation_blocking" && (
                <span className="text-[8px] text-amber-600 ml-auto">
                  需通过验证后解锁
                </span>
              )}
            </button>
            {backlogExpanded && (
              <div className={`border border-t-0 border-dashed bg-white px-3 py-2 space-y-1 ${
                queueWindow?.reveal_policy === "user_expand"
                  ? "border-[#00A3C4]/30"
                  : "border-gray-300"
              }`}>
                {backlogCards.map((card) => {
                  const bStyle = KIND_STYLE[card.kind];
                  const isBacklogPreview = queueWindow?.preview_card_id === card.id;
                  const isBacklogLocked = card.status === "stale" || card.status === "dismissed";
                  const backlogDisabled = isBacklogPreview || isBacklogLocked;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        if (backlogDisabled) return;
                        onSelect(card.id);
                      }}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 transition-colors ${
                        backlogDisabled ? "opacity-50 cursor-default" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className={`text-[7px] font-bold uppercase tracking-widest ${bStyle.text}`}>
                        {bStyle.label}
                      </span>
                      <span className="text-[10px] font-bold text-[#1A202C] truncate flex-1">
                        {card.title}
                      </span>
                      {isBacklogPreview && (
                        <span className="text-[7px] text-gray-400 flex-shrink-0">预览</span>
                      )}
                      {isBacklogLocked && (
                        <span className="text-[7px] text-gray-400 flex-shrink-0">{STATUS_LABEL[card.status]}</span>
                      )}
                      {!backlogDisabled && (
                        <span className="text-[7px] font-bold uppercase tracking-widest text-gray-400 flex-shrink-0">
                          {STATUS_LABEL[card.status]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 已完成任务折叠组 */}
        {completedGroupCard && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setCompletedCollapsed((v) => !v)}
              className="w-full text-left border border-gray-200 bg-gray-50 px-3 py-2 flex items-center gap-2"
            >
              {completedCollapsed ? <ChevronRight size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
              <span className="text-[9px] font-bold text-gray-500">{completedGroupCard.title}</span>
            </button>
            {!completedCollapsed && (
              <div className="border border-t-0 border-gray-200 bg-white px-3 py-2">
                <div className="text-[9px] text-gray-400 leading-relaxed">
                  {completedGroupCard.summary}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
