import type { TestFlowEntrySource } from "@/lib/test-flow-types";
import type { SkillMemoTask } from "@/lib/types";
import type { GovernanceAction } from "./types";

export type WorkbenchMode = "analysis" | "file" | "report" | "governance";

export type WorkbenchCardKind =
  | "architect"    // 保留（架构分析用）
  | "governance"   // 保留（后端治理卡/staged edit）
  | "validation"   // 保留（测试流）
  | "system"       // 保留
  | "create"       // 创作卡
  | "refine"       // 完善卡
  | "fixing"       // 整改卡
  | "release";     // 确认卡

export type WorkbenchCardStatus = "pending" | "active" | "reviewing" | "adopted" | "rejected" | "dismissed" | "stale";

export interface WorkbenchTarget {
  type: "prompt" | "source_file" | "report" | "governance_panel" | "analysis" | null;
  key: string | null;
}

export interface WorkbenchValidationSource {
  skillId?: number | null;
  planId?: number | null;
  planVersion?: number | null;
  caseCount?: number | null;
  sessionId?: number | null;
  reportId?: number | null;
  entrySource?: TestFlowEntrySource | string | null;
  decisionMode?: string | null;
  blockedStage?: string | null;
  blockedBefore?: string | null;
  sourceCasePlanId?: number | null;
  sourceCasePlanVersion?: number | null;
}

export type StudioFileRole =
  | "main_prompt"
  | "example"
  | "reference"
  | "knowledge_base"
  | "template"
  | "tool"
  | "unknown_asset";

export type StudioHandoffPolicy =
  | "stay_in_studio_chat"
  | "open_file_workspace"
  | "open_governance_panel"
  | "open_development_studio"
  | "open_opencode"
  | "bind_back_after_external_edit";

/** M4: 区分 Studio 内路由 vs 外部实现交接 */
export type StudioRouteKind = "internal" | "external";

export type StudioRouteDestination =
  | "studio_chat"
  | "file_workspace"
  | "governance_panel"
  | "dev_studio"
  | "opencode";

export type StudioReturnTarget = "none" | "bind_back" | "confirm" | "validate";

/** M4: 外部实现状态（映射到展示层，不改全局 status 枚举） */
export type ExternalBuildStatus =
  | "waiting_external_build"
  | "external_in_progress"
  | "returned_waiting_bindback"
  | "returned_waiting_validation";

export interface CardQueueWindow {
  active_card_id: string | null;
  visible_card_ids: string[];
  backlog_count: number;
  phase: string;
  max_visible: number;
  reveal_policy: "stage_gated" | "user_expand" | "validation_blocking";
  // M3 增补
  preview_card_id?: string | null;
  hidden_card_ids?: string[];
  pending_artifacts?: {
    has_pending_staged_edit: boolean;
    has_external_edit_waiting_bindback: boolean;
    has_failed_validation: boolean;
  } | null;
  blocking_signal?: {
    kind: "pending_confirmation" | "failed_validation" | "waiting_bindback" | "waiting_external" | "phase_gate";
    card_id: string;
    reason: string;
    external_state?: ExternalBuildStatus | null;
  } | null;
  resume_hint?: {
    kind: "resume_same_card" | "resume_reprioritized";
    message: string;
  } | null;
  active_card_explanation?: string | null;
  // M4 增补
  stale_card_ids?: string[];
}

export interface WorkbenchCard {
  id: string;
  contractId?: string | null;
  title: string;
  summary: string;
  status: WorkbenchCardStatus;
  kind: WorkbenchCardKind;
  mode: WorkbenchMode;
  phase: string;
  source: string;
  priority: number;
  target: WorkbenchTarget;
  sourceCardId?: string | null;
  stagedEditId?: string | null;
  artifactRefs?: string[];
  blockedBy?: string[];
  exitReason?: string | null;
  actions?: GovernanceAction[];
  validationSource?: WorkbenchValidationSource | null;
  fileRole?: StudioFileRole | null;
  handoffPolicy?: StudioHandoffPolicy | null;
  routeKind?: StudioRouteKind | null;
  destination?: StudioRouteDestination | null;
  returnTo?: StudioReturnTarget | null;
  queueWindow?: CardQueueWindow | null;
  raw?: Record<string, unknown>;
  /** 整改任务的原始数据（仅 kind=fixing 时有） */
  fixTask?: SkillMemoTask | null;
  /** 卡片分组标签（用于 CardRail 分组渲染） */
  groupLabel?: string | null;
  /** M4: 外部实现状态（仅 handoff 卡有值） */
  externalBuildStatus?: ExternalBuildStatus | null;
}

export interface StudioWorkspaceState {
  mode: WorkbenchMode;
  currentTarget: WorkbenchTarget;
  currentCardId: string | null;
  validationSource?: WorkbenchValidationSource | null;
}

export const EMPTY_WORKBENCH_TARGET: WorkbenchTarget = { type: null, key: null };

/** 判断 handoff_policy 是否为 Studio 内路由（治理/文件/聊天） */
export function isInternalRoute(policy: StudioHandoffPolicy | null | undefined): boolean {
  return policy === "stay_in_studio_chat"
    || policy === "open_file_workspace"
    || policy === "open_governance_panel"
    || !policy;
}

/** 判断 handoff_policy 是否为外部实现交接 */
export function isExternalHandoff(policy: StudioHandoffPolicy | null | undefined): boolean {
  return policy === "open_development_studio"
    || policy === "open_opencode";
}

export function isActionableWorkbenchCard(card: WorkbenchCard): boolean {
  return card.status === "pending" || card.status === "active" || card.status === "reviewing";
}

export function isPendingFileConfirmationCard(card: WorkbenchCard): boolean {
  if (!isActionableWorkbenchCard(card)) return false;
  return Boolean(
    card.stagedEditId
    || card.id === "refine:draft-ready"
    || card.id === "refine:file-split"
    || card.source === "pending_draft"
    || card.source === "pending_file_split"
  );
}

/**
 * Active card 选择排序（高→低）：
 * 1. confirm / staged edit 待确认
 * 2. fixing 当前任务
 * 3. fixing overview / 其他
 * 4. governance 门禁阻断（mode=governance）
 * 5. validation 测试推进
 * 6. governance 普通卡（kind=governance, mode 非 governance）
 * 7. create summary-ready
 * 8. create architect active
 * 9. create 其他
 * 10. refine 建议性完善
 * 11. release 发布前动作
 * 12. architect phase（旧兼容）
 * 13. selected-file 兜底
 */
export const FILE_ROLE_LABEL: Record<StudioFileRole, string> = {
  main_prompt: "Main Prompt",
  example: "Example",
  reference: "Reference",
  knowledge_base: "Knowledge Base",
  template: "Template",
  tool: "Tool",
  unknown_asset: "文件",
};

export function getWorkbenchCardFocusRank(card: WorkbenchCard): number {
  if (!isActionableWorkbenchCard(card)) return 0;
  // 0. 外部返回的卡优先成为 active card
  if (card.externalBuildStatus === "returned_waiting_bindback") return 1010;
  if (card.externalBuildStatus === "returned_waiting_validation") return 990;
  // 1. confirm / staged edit 待确认
  if (isPendingFileConfirmationCard(card)) return 1000;
  // 2. fixing 当前任务
  if (card.id.startsWith("fixing:current:")) return 970;
  // 3. fixing overview / 其他
  if (card.id === "fixing:overview") return 960;
  if (card.kind === "fixing") return 940;
  // 4. governance 门禁阻断（仅 mode=governance 的真正门禁卡）
  if (card.mode === "governance") return 920;
  // 5. validation 测试推进
  if (card.id === "testing:test-ready") return 900;
  if (card.kind === "validation") return 890;
  // 5.5. governance 普通卡（kind=governance 但 mode 非 governance，如文件卡）
  if (card.kind === "governance") return 880;
  // 6. create summary-ready
  if (card.id === "create:summary-ready") return 880;
  // 7. create architect active
  if (card.id.startsWith("create:architect:")) return card.status === "active" ? 860 : 780;
  // 8. create 其他
  if (card.kind === "create") return 840;
  // 9. refine 建议性完善
  if (card.kind === "refine") return 800;
  // 10. release 发布前动作
  if (card.id === "release:test-passed" || card.id === "release:submit") return 760;
  if (card.kind === "release") return 740;
  // 11. architect phase（旧兼容）
  if (card.kind === "architect") return 720;
  // 12. selected-file 兜底
  if (card.source === "selection") return 10;
  return 100;
}

export function resolveFocusedWorkbenchCardId(
  cards: WorkbenchCard[],
  preferredActiveId?: string | null,
): string | null {
  if (cards.length === 0) return null;
  const preferredCard = preferredActiveId
    ? cards.find((card) => card.id === preferredActiveId)
    : null;
  const bestCard = [...cards]
    .sort((left, right) => {
      const rankDelta = getWorkbenchCardFocusRank(right) - getWorkbenchCardFocusRank(left);
      if (rankDelta !== 0) return rankDelta;
      return right.priority - left.priority;
    })[0] ?? null;
  if (!bestCard) return preferredCard?.id ?? cards[0]?.id ?? null;
  if (
    preferredCard
    && getWorkbenchCardFocusRank(preferredCard) === getWorkbenchCardFocusRank(bestCard)
  ) {
    return preferredCard.id;
  }
  return getWorkbenchCardFocusRank(bestCard) > 0
    ? bestCard.id
    : preferredCard?.id ?? cards[0]?.id ?? null;
}
