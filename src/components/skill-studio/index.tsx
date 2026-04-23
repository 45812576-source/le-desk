"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { consumeSandboxSessionStream } from "@/lib/sandbox-stream";
import type { SkillDetail, SkillMemo, SandboxReport, StudioCardQueueLedger, StudioSessionPayload } from "@/lib/types";
import type { TestFlowPlanSummary, TestFlowBlockedStage, TestFlowBlockedBefore, TestFlowGateReason, TestFlowGuidedStep } from "@/lib/test-flow-types";
import type { Suggestion } from "@/components/skill/CommentsPanel";
import { ImportSkillModal } from "@/components/skill/ImportSkillModal";
import { SandboxTestModal } from "@/components/skill/SandboxTestModal";
import { isEditableSkillStatus, isPublishedSkillStatus } from "@/lib/skill-status";
import { useStudioStore } from "@/lib/studio-store";

import type { ChatMessage, SelectedFile, StudioDraft, StagedEdit } from "./types";
import { SkillList, SkillIcon } from "./SkillList";
import { PromptEditor } from "./PromptEditor";
import { StudioChat, type StudioChatHandle } from "./StudioChat";
import { AssetFileEditor } from "./AssetFileEditor";
import { SkillGovernancePanel } from "./SkillGovernancePanel";
import { StudioCardRail } from "./StudioCardRail";
import { resolveStudioCardContract, type StudioCardContract } from "./card-contracts";
import { buildAssetEditorTarget, buildAssetLoadingTarget, buildEditorErrorTarget, buildPromptEditorTarget, editorTargetFromSelectedFile, selectedFileFromEditorTarget, type StudioEditorTarget } from "./editor-target";
import { normalizeStagedEditPayload, resolveStagedEditEditorTarget } from "./utils";
import { normalizeWorkflowCardPayload, parseWorkflowStatePayload } from "./workflow-adapter";
import { hydrateStudioSessionRecovery } from "./session-recovery";
import type { WorkflowStateData } from "./workflow-protocol";
import { buildWorkbenchCards, doesWorkbenchCardTargetSavedFile, resolveNextPendingWorkbenchCardId, resolvePreferredWorkbenchCardId } from "./workbench";
import { FILE_ROLE_LABEL, isPendingFileConfirmationCard } from "./workbench-types";

// ─── Main page ────────────────────────────────────────────────────────────────

const EDITOR_DRAWER_WIDTH_KEY = "skill_studio_editor_drawer_width";
const DEFAULT_EDITOR_DRAWER_WIDTH = 720;
const MIN_EDITOR_DRAWER_WIDTH = 520;
const MAX_EDITOR_DRAWER_WIDTH = 1040;

function clampEditorDrawerWidth(width: number) {
  const viewportMax = typeof window === "undefined"
    ? MAX_EDITOR_DRAWER_WIDTH
    : Math.max(MIN_EDITOR_DRAWER_WIDTH, Math.min(MAX_EDITOR_DRAWER_WIDTH, window.innerWidth - 360));
  return Math.min(Math.max(width, MIN_EDITOR_DRAWER_WIDTH), viewportMax);
}

export function SkillStudio({
  convId,
  initialSkillId,
  fromSandbox,
  sandboxReportId,
  sandboxSessionId,
}: {
  convId: number;
  initialSkillId?: number;
  fromSandbox?: boolean;
  sandboxReportId?: string;
  sandboxSessionId?: string;
}) {
  const [activeCardActions, setActiveCardActions] = useState<Array<{
    id: string;
    label: string;
    tone?: "primary" | "secondary" | "danger";
    onClick: () => void;
  }>>([]);
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [editorTarget, _setEditorTarget] = useState<StudioEditorTarget>(() => {
    if (initialSkillId) return buildPromptEditorTarget(initialSkillId, "initial_skill");
    try {
      const saved = localStorage.getItem("skill_studio_selected");
      return saved ? editorTargetFromSelectedFile(JSON.parse(saved) as SelectedFile, "local_storage") : { kind: "empty" };
    } catch { return { kind: "empty" }; }
  });
  const selectedFile = selectedFileFromEditorTarget(editorTarget);
  const [adoptedAssetPreview, setAdoptedAssetPreview] = useState<StagedEdit | null>(null);
  const [adoptedPromptPreview, setAdoptedPromptPreview] = useState<StagedEdit | null>(null);
  const [editorDrawerWidth, setEditorDrawerWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(EDITOR_DRAWER_WIDTH_KEY));
      return clampEditorDrawerWidth(Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_EDITOR_DRAWER_WIDTH);
    } catch {
      return DEFAULT_EDITOR_DRAWER_WIDTH;
    }
  });
  const [editorResizing, setEditorResizing] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setEditorDrawerWidth((currentWidth) => clampEditorDrawerWidth(currentWidth));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const setEditorTarget = useCallback((target: StudioEditorTarget) => {
    _setEditorTarget(target);
    const nextSelection = selectedFileFromEditorTarget(target);
    try {
      if (nextSelection) localStorage.setItem("skill_studio_selected", JSON.stringify(nextSelection));
      else localStorage.removeItem("skill_studio_selected");
    } catch { /* ignore */ }
  }, []);
  const setSelectedFile = useCallback((f: SelectedFile | null) => {
    setAdoptedAssetPreview(null);
    setAdoptedPromptPreview(null);
    if (!f) {
      setEditorTarget({ kind: "empty" });
      return;
    }
    if (f.fileType === "prompt") {
      setEditorTarget(buildPromptEditorTarget(f.skillId, "selected_file"));
      return;
    }
    setEditorTarget(buildAssetLoadingTarget(f, selectedFile, "selected_file"));
  }, [selectedFile, setEditorTarget]);
  const [isNew, setIsNew] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [skillListCollapsed, setSkillListCollapsed] = useState(false);
  const [showSandbox, setShowSandbox] = useState<number | null>(null);
  const [showGovernancePanel, setShowGovernancePanel] = useState(false);
  const [chatTestFlowIntent, setChatTestFlowIntent] = useState<{
    mode: "mount_blocked" | "choose_existing_plan" | "generate_cases";
    entrySource: "skill_studio_chat";
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
  } | null>(null);
  const [memo, setMemo] = useState<SkillMemo | null>(null);
  const [sandboxEntryHandled, setSandboxEntryHandled] = useState(false);
  const [memoSyncError, setMemoSyncError] = useState<string | null>(null);
  const [retryingMemoSync, setRetryingMemoSync] = useState(false);
  const [activeSandboxReport, setActiveSandboxReport] = useState<SandboxReport | null>(null);
  const [sandboxRemediationSummary, setSandboxRemediationSummary] = useState<{ cards: number; stagedEdits: number } | null>(null);
  const [sandboxRemediationLoading, setSandboxRemediationLoading] = useState(false);
  const [cardQueueLedger, setCardQueueLedger] = useState<StudioCardQueueLedger | null>(null);

  const [prompt, setPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");  // last persisted version for dirty tracking
  const [externalName, setExternalName] = useState<string | null>(null);
  const [externalDescription, setExternalDescription] = useState<string | null>(null);
  const [pendingDiffBase, setPendingDiffBase] = useState<string | null>(null);
  const editorSaveRef = useRef<(() => void) | null>(null);
  const clearChatRef = useRef<(() => void) | null>(null);
  const setInputRef = useRef<((text: string) => void) | null>(null);
  const chatActionsRef = useRef<StudioChatHandle | null>(null);

  // ── Pending states for Card Queue (derived from store) ──
  const storePendingDraft = useStudioStore((s) => s.pendingDraft);
  const storePendingSummary = useStudioStore((s) => s.pendingSummary);
  const storePendingToolSuggestion = useStudioStore((s) => s.pendingToolSuggestion);
  const storePendingFileSplit = useStudioStore((s) => s.pendingFileSplit);
  const setStorePendingDraft = useStudioStore((s) => s.setPendingDraft);
  const setStorePendingSummary = useStudioStore((s) => s.setPendingSummary);
  const setStorePendingToolSuggestion = useStudioStore((s) => s.setPendingToolSuggestion);
  const setStorePendingFileSplit = useStudioStore((s) => s.setPendingFileSplit);
  const hasPendingDraft = Boolean(storePendingDraft);
  const hasPendingSummary = Boolean(storePendingSummary);
  const hasPendingToolSuggestion = Boolean(storePendingToolSuggestion);
  const hasPendingFileSplit = Boolean(storePendingFileSplit);

  const editorIsDirty = prompt !== savedPrompt && prompt.trim().length > 0;

  // ── Editor visibility from store ──
  const editorVisibility = useStudioStore((s) => s.editorVisibility);
  const setEditorVisibility = useStudioStore((s) => s.setEditorVisibility);
  const setEditorManuallyCollapsed = useStudioStore((s) => s.setEditorManuallyCollapsed);
  const activeWorkbenchCardId = useStudioStore((s) => s.activeWorkbenchCardId);
  const setActiveWorkbenchCardId = useStudioStore((s) => s.setActiveWorkbenchCardId);
  const updateWorkbenchCardStatus = useStudioStore((s) => s.updateWorkbenchCardStatus);
  const replaceWorkbenchCards = useStudioStore((s) => s.replaceWorkbenchCards);
  const setWorkbenchMode = useStudioStore((s) => s.setWorkbenchMode);
  const storeCardsById = useStudioStore((s) => s.cardsById);
  const storeCardOrder = useStudioStore((s) => s.cardOrder);
  const storeWorkflowState = useStudioStore((s) => s.workflowState);
  const syncGovernanceCards = useStudioStore((s) => s.syncGovernanceCards);
  const syncStagedEdits = useStudioStore((s) => s.syncStagedEdits);
  const setStoreMemo = useStudioStore((s) => s.setMemo);
  const setWorkflowState = useStudioStore((s) => s.setWorkflowState);
  const resetWorkflowArtifacts = useStudioStore((s) => s.resetWorkflowArtifacts);
  const setStoreQueueWindow = useStudioStore((s) => s.setQueueWindow);
  const mergeArchitectArtifacts = useStudioStore((s) => s.mergeArchitectArtifacts);
  const hydratedRecoveryRef = useRef<string | null>(null);
  const lastAutoOpenedCardIdRef = useRef<string | null>(null);
  const skipNextActiveCardEditorSyncRef = useRef(false);

  // File workspace panel visibility: visible only when pinned or confirmation flow opens it.
  const editorVisible = editorVisibility !== "collapsed";

  const router = useRouter();

  // Skill 切换时做页面级路由跳转：resolve 该 skill 的独立 conversation → router.replace
  const navigateToSkillConv = useCallback(async (skillId: number) => {
    try {
      const entry = await apiFetch<{ conversation_id: number }>(
        `/conversations/studio-entry?type=skill_studio&skill_id=${skillId}`
      );
      if (entry.conversation_id !== convId) {
        router.replace(`/chat/${entry.conversation_id}?ws=skill_studio&skill_id=${skillId}`);
      }
    } catch { /* resolve 失败则留在当前 conversation */ }
  }, [convId, router]);

  // 选择新 skill 时触发路由跳转
  useEffect(() => {
    const skillId = selectedFile?.skillId;
    if (skillId && skillId !== initialSkillId) {
      navigateToSkillConv(skillId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.skillId]);

  // URL skill_id 变化时（路由跳转但组件未重新挂载），强制同步 selectedFile
  useEffect(() => {
    if (initialSkillId && selectedFile?.skillId !== initialSkillId) {
      setEditorTarget(buildPromptEditorTarget(initialSkillId, "route_sync"));
      // 同步写入 localStorage
      try { localStorage.setItem("skill_studio_selected", JSON.stringify({ skillId: initialSkillId, fileType: "prompt" })); } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSkillId]);

  const selectedSkill = selectedFile
    ? (skills.find((s) => s.id === selectedFile.skillId) ?? null)
    : null;
  const storeGovernanceCards = useStudioStore((s) => s.governanceCards);
  const storeStagedEdits = useStudioStore((s) => s.stagedEdits);
  const sandboxVersionMismatch = Boolean(
    fromSandbox &&
    activeSandboxReport &&
    selectedSkill &&
    activeSandboxReport.target_version != null &&
    selectedSkill.current_version !== activeSandboxReport.target_version,
  );
  const sandboxVersionMismatchMessage = sandboxVersionMismatch
    ? `当前 Skill 已是 v${selectedSkill?.current_version}，但整改来源报告基于 v${activeSandboxReport?.target_version}。如果要继续提交审批，请先重新运行质量检测生成新报告。`
    : null;

  const governanceWorkbenchIntent = useMemo(() => ({
    visible: showGovernancePanel,
    skillId: selectedSkill?.id ?? null,
    mode: chatTestFlowIntent?.mode ?? null,
    latestPlan: chatTestFlowIntent?.latestPlan ?? null,
    entrySource: chatTestFlowIntent?.entrySource ?? null,
    sessionId: sandboxSessionId ? Number(sandboxSessionId) : null,
    reportId: sandboxReportId ? Number(sandboxReportId) : null,
    blockedStage: chatTestFlowIntent?.blockedStage ?? null,
    blockedBefore: chatTestFlowIntent?.blockedBefore ?? null,
    summary: chatTestFlowIntent?.gateSummary
      ?? chatTestFlowIntent?.verdictReason
      ?? (showGovernancePanel ? "当前卡片需要通过治理面板继续推进" : null),
  }), [chatTestFlowIntent?.blockedBefore, chatTestFlowIntent?.blockedStage, chatTestFlowIntent?.entrySource, chatTestFlowIntent?.gateSummary, chatTestFlowIntent?.latestPlan, chatTestFlowIntent?.mode, chatTestFlowIntent?.verdictReason, sandboxReportId, sandboxSessionId, selectedSkill?.id, showGovernancePanel]);

  const computedWorkbenchCards = useMemo(() => buildWorkbenchCards({
    governanceCards: storeGovernanceCards,
    stagedEdits: storeStagedEdits,
    selectedFile,
    selectedSkill,
    workflowState: storeWorkflowState,
    memo,
    governanceIntent: governanceWorkbenchIntent,
    activeSandboxReport,
    prompt,
    hasPendingDraft,
    hasPendingSummary,
    hasPendingToolSuggestion,
    hasPendingFileSplit,
  }), [activeSandboxReport, governanceWorkbenchIntent, memo, selectedFile, selectedSkill, storeGovernanceCards, storeStagedEdits, storeWorkflowState, prompt, hasPendingDraft, hasPendingSummary, hasPendingToolSuggestion, hasPendingFileSplit]);

  const lastReplaceKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const preferredId = resolvePreferredWorkbenchCardId(
      computedWorkbenchCards,
      storeWorkflowState,
      useStudioStore.getState().activeWorkbenchCardId,
    );
    const key = JSON.stringify([computedWorkbenchCards.map((c) => `${c.id}:${c.status}`), preferredId]);
    if (key === lastReplaceKeyRef.current) return;
    lastReplaceKeyRef.current = key;
    replaceWorkbenchCards(computedWorkbenchCards, preferredId);
  }, [computedWorkbenchCards, storeWorkflowState, replaceWorkbenchCards]);

  const workbenchCards = useMemo(
    () => storeCardOrder.map((id) => storeCardsById[id]).filter(Boolean),
    [storeCardOrder, storeCardsById],
  );

  const pendingGovernanceCount = useMemo(
    () => storeGovernanceCards.filter((card) => card.status === "pending").length,
    [storeGovernanceCards],
  );
  const pendingStagedEditCount = useMemo(
    () => storeStagedEdits.filter((edit) => edit.status === "pending").length,
    [storeStagedEdits],
  );

  const activeWorkbenchId = activeWorkbenchCardId;
  const activeWorkbenchCard = workbenchCards.find((card) => card.id === activeWorkbenchId) ?? null;
  const activeCardQueueWindow = useMemo(() => {
    if (activeWorkbenchCard?.queueWindow) {
      return activeWorkbenchCard.queueWindow;
    }
    if (storeWorkflowState?.queue_window) {
      return storeWorkflowState.queue_window;
    }
    if (!activeWorkbenchCard) return null;
    const visibleIds = workbenchCards
      .filter((card) => card.status === "active" || card.status === "pending" || card.status === "reviewing")
      .slice(0, 5)
      .map((card) => card.id);
    return {
      active_card_id: activeWorkbenchCard.id,
      visible_card_ids: visibleIds.includes(activeWorkbenchCard.id)
        ? visibleIds
        : [activeWorkbenchCard.id, ...visibleIds].slice(0, 5),
      backlog_count: Math.max(workbenchCards.length - Math.min(visibleIds.length || 1, 5), 0),
      phase: activeWorkbenchCard.phase || storeWorkflowState?.phase || "discover",
      max_visible: 5,
      reveal_policy: "stage_gated" as const,
      _fallback: true as const,
    };
  }, [activeWorkbenchCard, storeWorkflowState, workbenchCards]);

  useEffect(() => {
    setStoreQueueWindow(activeCardQueueWindow);
  }, [activeCardQueueWindow, setStoreQueueWindow]);

  const handleOpenPromptFromWorkspace = useCallback(() => {
    const targetSkillId = selectedSkill?.id ?? selectedFile?.skillId ?? initialSkillId;
    if (!targetSkillId) return;
    setSelectedFile({ skillId: targetSkillId, fileType: "prompt" });
  }, [initialSkillId, selectedFile?.skillId, selectedSkill?.id, setSelectedFile]);

  const handleFocusChatFromWorkspace = useCallback((text: string) => {
    setInputRef.current?.(text);
  }, []);

  const handleManualExpandEditor = useCallback(() => {
    setEditorManuallyCollapsed(false);
    setEditorVisibility("pinned_open");
  }, [setEditorManuallyCollapsed, setEditorVisibility]);

  const handleEditorDrawerResizeStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = editorDrawerWidth;
    setEditorResizing(true);

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = clampEditorDrawerWidth(startWidth + startX - moveEvent.clientX);
      setEditorDrawerWidth(nextWidth);
    };

    const handleUp = () => {
      setEditorResizing(false);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      setEditorDrawerWidth((currentWidth) => {
        const nextWidth = clampEditorDrawerWidth(currentWidth);
        try { localStorage.setItem(EDITOR_DRAWER_WIDTH_KEY, String(nextWidth)); } catch { /* ignore */ }
        return nextWidth;
      });
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }, [editorDrawerWidth]);

  const handleOpenStagedEditTarget = useCallback((edit: StagedEdit) => {
    const targetSkillId = selectedSkill?.id ?? selectedFile?.skillId ?? initialSkillId;
    if (!targetSkillId) return;

    const target = resolveStagedEditEditorTarget(edit);
    skipNextActiveCardEditorSyncRef.current = true;
    if (target?.fileType === "asset") {
      setAdoptedAssetPreview(null);
      setEditorTarget(buildAssetLoadingTarget({
        skillId: targetSkillId,
        fileType: "asset",
        filename: target.filename,
      }, selectedFile, "staged_edit_patch"));
    } else {
      setSelectedFile({ skillId: targetSkillId, fileType: "prompt" });
    }

    setEditorManuallyCollapsed(false);
    setEditorVisibility("pinned_open");
  }, [
    initialSkillId,
    selectedFile,
    selectedSkill?.id,
    setEditorManuallyCollapsed,
    setEditorTarget,
    setEditorVisibility,
    setSelectedFile,
  ]);

  const handlePendingDraftChange = useCallback((draft: StudioDraft | null) => {
    setStorePendingDraft(draft);
  }, [setStorePendingDraft]);

  const handlePendingSummaryChange = useCallback((summary: import("./types").StudioSummary | null) => {
    setStorePendingSummary(summary);
  }, [setStorePendingSummary]);

  const handlePendingToolSuggestionChange = useCallback((suggestion: import("./types").StudioToolSuggestion | null) => {
    setStorePendingToolSuggestion(suggestion);
  }, [setStorePendingToolSuggestion]);

  const handlePendingFileSplitChange = useCallback((split: import("./types").StudioFileSplit | null) => {
    setStorePendingFileSplit(split);
  }, [setStorePendingFileSplit]);

  const handleOpenChatTestFlowPanel = useCallback((intent: {
    skillId: number;
    mode: "mount_blocked" | "choose_existing_plan" | "generate_cases";
    triggerMessage: string;
    latestPlan: TestFlowPlanSummary | null | undefined;
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
  }) => {
    if (!selectedFile || selectedFile.skillId !== intent.skillId) {
      setSelectedFile({ skillId: intent.skillId, fileType: "prompt" });
    }
    setShowGovernancePanel(true);
    setChatTestFlowIntent({
      ...intent,
      entrySource: "skill_studio_chat",
      conversationId: convId,
      latestPlan: intent.latestPlan ?? null,
      mountCta: intent.mountCta ?? null,
      blockedStage: intent.blockedStage ?? null,
      blockedBefore: intent.blockedBefore ?? null,
      caseGenerationAllowed: intent.caseGenerationAllowed,
      qualityEvaluationStarted: intent.qualityEvaluationStarted,
      verdictLabel: intent.verdictLabel ?? null,
      verdictReason: intent.verdictReason ?? null,
      gateSummary: intent.gateSummary ?? null,
      gateReasons: intent.gateReasons ?? [],
      guidedSteps: intent.guidedSteps ?? [],
      primaryAction: intent.primaryAction ?? null,
    });
  }, [convId, selectedFile, setSelectedFile]);

  const handleSelectSkillForTestFlow = useCallback((targetSkillId: number) => {
    setSelectedFile({ skillId: targetSkillId, fileType: "prompt" });
  }, [setSelectedFile]);

  useEffect(() => {
    if (!activeWorkbenchCard) {
      setWorkbenchMode("analysis");
      if (editorVisibility === "auto_expanded") {
        setEditorVisibility("collapsed");
      }
      skipNextActiveCardEditorSyncRef.current = false;
      return;
    }
    setWorkbenchMode(activeWorkbenchCard.mode);

    // File Workspace 自动展开规则：
    // 1. contract drawerPolicy === "on_pending_edit" → 展开
    // 2. 无 contract 时 fallback: isPendingFileConfirmationCard
    // 3. store 有 pendingDraft 或 pendingFileSplit → 展开（不论 active card）
    const contract: StudioCardContract | null = resolveStudioCardContract(activeWorkbenchCard);
    const drawerPolicy = contract?.drawerPolicy ?? null;
    const shouldAutoOpenWorkspace =
      drawerPolicy === "on_pending_edit"
      || (!drawerPolicy && isPendingFileConfirmationCard(activeWorkbenchCard))
      || hasPendingDraft
      || hasPendingFileSplit;

    if (shouldAutoOpenWorkspace && lastAutoOpenedCardIdRef.current !== activeWorkbenchCard.id) {
      lastAutoOpenedCardIdRef.current = activeWorkbenchCard.id;
      setEditorManuallyCollapsed(false);
      setEditorVisibility("auto_expanded");
    } else if (!shouldAutoOpenWorkspace && editorVisibility === "auto_expanded") {
      lastAutoOpenedCardIdRef.current = null;
      setEditorVisibility("collapsed");
    }

    if (activeWorkbenchCard.mode === "governance" && !showGovernancePanel && selectedSkill) {
      setShowGovernancePanel(true);
    }

    if (activeWorkbenchCard.mode !== "file" || !selectedSkill) {
      skipNextActiveCardEditorSyncRef.current = false;
      return;
    }

    if (skipNextActiveCardEditorSyncRef.current) {
      skipNextActiveCardEditorSyncRef.current = false;
      return;
    }

    if (activeWorkbenchCard.target.type === "prompt" && selectedFile?.fileType !== "prompt") {
      setSelectedFile({ skillId: selectedSkill.id, fileType: "prompt" });
      return;
    }

    if (
      activeWorkbenchCard.target.type === "source_file"
      && activeWorkbenchCard.target.key
      && (selectedFile?.fileType !== "asset" || selectedFile.filename !== activeWorkbenchCard.target.key)
    ) {
      setSelectedFile({ skillId: selectedSkill.id, fileType: "asset", filename: activeWorkbenchCard.target.key });
    }
  }, [
    activeWorkbenchCard,
    selectedFile,
    selectedSkill,
    setSelectedFile,
    editorVisibility,
    setEditorManuallyCollapsed,
    setEditorVisibility,
    setWorkbenchMode,
    showGovernancePanel,
    hasPendingDraft,
    hasPendingFileSplit,
  ]);

  // ── Memo: fetch when selected skill changes ──
  const fetchMemo = useCallback((skillId: number) => {
    return apiFetch<SkillMemo>(`/skills/${skillId}/memo`)
      .then((data) => {
        if (data && data.lifecycle_stage) {
          setMemo(data);
          setStoreMemo(data);
        } else {
          setMemo(null);
          setStoreMemo(null);
        }
      })
      .catch(() => {
        setMemo(null);
        setStoreMemo(null);
      });
  }, [setStoreMemo]);

  const fetchStudioSession = useCallback((skillId: number) => {
    return apiFetch<StudioSessionPayload>(`/skills/${skillId}/studio/session`)
      .then((data) => {
        const hydrated = hydrateStudioSessionRecovery(skillId, data);
        setWorkflowState(hydrated.workflowState);
        if (hydratedRecoveryRef.current === hydrated.recoverySignature) {
          return;
        }
        syncGovernanceCards("memo-recovery", hydrated.governanceCards);
        syncStagedEdits("memo-recovery", hydrated.stagedEdits);
        setStoreQueueWindow(hydrated.queueWindow);
        setCardQueueLedger(hydrated.cardQueueLedger);
        if (hydrated.architectArtifacts.length > 0) {
          mergeArchitectArtifacts(hydrated.architectArtifacts);
        }
        hydratedRecoveryRef.current = hydrated.recoverySignature;
        if (hydrated.stagedEdits.some((edit) => edit.status === "pending")) {
          setEditorManuallyCollapsed(false);
          setEditorVisibility("auto_expanded");
        }
      })
      .catch(() => {
        setWorkflowState(null);
        syncGovernanceCards("memo-recovery", []);
        syncStagedEdits("memo-recovery", []);
        setStoreQueueWindow(null);
        setCardQueueLedger(null);
        hydratedRecoveryRef.current = skillId ? `${skillId}:none` : null;
      });
  }, [
    mergeArchitectArtifacts,
    setWorkflowState,
    setEditorManuallyCollapsed,
    setEditorVisibility,
    setStoreQueueWindow,
    syncGovernanceCards,
    syncStagedEdits,
  ]);

  useEffect(() => {
    const skillId = selectedFile?.skillId;
    if (skillId) {
      resetWorkflowArtifacts();
      hydratedRecoveryRef.current = null;
      setCardQueueLedger(null);
      fetchMemo(skillId);
      fetchStudioSession(skillId);
    }
    return () => {
      setMemo(null);
      setStoreMemo(null);
      setCardQueueLedger(null);
    };
  }, [selectedFile?.skillId, fetchMemo, fetchStudioSession, resetWorkflowArtifacts, setStoreMemo]);

  // ── Sandbox report 入口：首次进入时刷新 memo + 拉取报告，绑定整改上下文 ──
  useEffect(() => {
    if (!fromSandbox || sandboxEntryHandled || !initialSkillId) return;
    setSandboxEntryHandled(true);
    setMemoSyncError(null);
    let cancelled = false;
    (async () => {
      try {
        const [memoData, reportData] = await Promise.all([
          apiFetch<SkillMemo>(`/skills/${initialSkillId}/memo`),
          (sandboxSessionId
            ? apiFetch<SandboxReport>(`/sandbox/interactive/${sandboxSessionId}/report`).catch(() => null)
            : Promise.resolve(null)),
        ]);
        if (cancelled) return;

        const reportIdForRemediation = reportData?.report_id ?? (sandboxReportId ? Number(sandboxReportId) : NaN);
        if (reportData) {
          setActiveSandboxReport(reportData);
        }
        if (Number.isFinite(reportIdForRemediation) && reportIdForRemediation > 0) {
          try {
            if (!cancelled) setSandboxRemediationLoading(true);
            const remediation = await apiFetch<{
              workflow_state?: WorkflowStateData;
              cards: Record<string, unknown>[];
              staged_edits: Record<string, unknown>[];
            }>(
              `/sandbox/interactive/by-report/${reportIdForRemediation}/remediation-actions`,
              { method: "POST" }
            );
            if (!cancelled) {
              const workflowState = remediation.workflow_state
                ? parseWorkflowStatePayload(remediation.workflow_state as Record<string, unknown>)
                : null;
              if (workflowState) {
                setWorkflowState(workflowState);
              }
              const source = `sandbox-report:${reportIdForRemediation}`;
              syncGovernanceCards(
                source,
                (remediation.cards || []).map((card) => normalizeWorkflowCardPayload(card, source)),
              );
              syncStagedEdits(source, (remediation.staged_edits || []).map(normalizeStagedEdit));
              setSandboxRemediationSummary({
                cards: remediation.cards?.length || 0,
                stagedEdits: remediation.staged_edits?.length || 0,
              });
              if ((remediation.staged_edits?.length || 0) > 0) {
                setEditorManuallyCollapsed(false);
                setEditorVisibility("auto_expanded");
                const firstSourceFileEdit = (remediation.staged_edits || []).find((edit) =>
                  edit.target_type === "source_file" && typeof edit.target_key === "string" && edit.target_key
                );
                if (firstSourceFileEdit?.target_key) {
                  setEditorTarget(buildAssetLoadingTarget({ skillId: initialSkillId, fileType: "asset", filename: String(firstSourceFileEdit.target_key) }, selectedFile, "sandbox_remediation"));
                }
              }
            }
          } catch {
            // best effort: remediation actions might not be available for older backend
          } finally {
            if (!cancelled) setSandboxRemediationLoading(false);
          }
        }

        if (memoData && memoData.lifecycle_stage) {
          setMemo(memoData);
          setStoreMemo(memoData);
          if (memoData.lifecycle_stage !== "fixing" && (!memoData.latest_test || memoData.latest_test.status !== "failed")) {
            setMemoSyncError("整改计划未导入 — Memo 中未检测到 fixing 状态");
          }
        } else {
          setMemoSyncError("整改计划未导入 — Memo 不存在");
        }
      } catch {
        if (!cancelled) setMemoSyncError("整改任务尚未同步到 Memo");
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromSandbox, initialSkillId, sandboxReportId]);

  const handleRetryMemoSync = async () => {
    if (!sandboxSessionId || retryingMemoSync) return;
    setRetryingMemoSync(true);
    try {
      await consumeSandboxSessionStream(
        `/sandbox/interactive/${sandboxSessionId}/retry-from-step-stream`,
        { body: JSON.stringify({ step: "memo_sync" }) },
      );
      setMemoSyncError(null);
      if (initialSkillId) {
        fetchMemo(initialSkillId);
        fetchStudioSession(initialSkillId);
      }
    } catch (err) {
      setMemoSyncError(err instanceof Error ? err.message : "重试 Memo 同步失败");
    } finally {
      setRetryingMemoSync(false);
    }
  };

  const handleMemoRefresh = () => {
    if (selectedFile?.skillId) {
      fetchMemo(selectedFile.skillId);
      fetchStudioSession(selectedFile.skillId);
    }
  };

  // ── Memo: complete-from-save after file save ──
  async function handleFileSaved(filename: string, contentSize: number) {
    if (filename !== "SKILL.md") setAdoptedAssetPreview(null);
    if (filename === "SKILL.md") setAdoptedPromptPreview(null);
    if (!selectedFile?.skillId) return;
    const skillId = selectedFile.skillId;
    const activeCard = workbenchCards.find((card) => card.id === activeWorkbenchId) ?? null;
    const nextPendingCardId = resolveNextPendingWorkbenchCardId(workbenchCards, activeWorkbenchId);
    const shouldAdvanceWorkbenchCard = Boolean(
      activeCard
      && (activeCard.status === "pending" || activeCard.status === "active")
      && doesWorkbenchCardTargetSavedFile(activeCard, filename)
    );

    if (shouldAdvanceWorkbenchCard && activeCard) {
      updateWorkbenchCardStatus(activeCard.id, "adopted");
      if (nextPendingCardId) {
        setActiveWorkbenchCardId(nextPendingCardId);
      }
    }

    if (!memo?.current_task) return;

    try {
      await apiFetch<{ ok: boolean; task_completed?: boolean }>(`/skills/${skillId}/memo/tasks/${memo.current_task.id}/complete-from-save`, {
        method: "POST",
        body: JSON.stringify({
          filename,
          file_type: filename === "SKILL.md" ? "prompt" : "asset",
          content_size: contentSize,
        }),
      });
      await Promise.all([
        fetchMemo(skillId),
        fetchStudioSession(skillId),
      ]).catch(() => {});
    } catch { /* ignore — memo may not exist for this skill */ }
  }

  // ── Memo: editor target switching ──
  function handleEditorTarget(fileType: string, filename: string, previewEdit?: StagedEdit | null) {
    if (!selectedFile?.skillId) return;
    if (fileType === "prompt" || filename === "SKILL.md") {
      setSelectedFile({ skillId: selectedFile.skillId, fileType: "prompt" });
      setAdoptedAssetPreview(null);
      setAdoptedPromptPreview(
        previewEdit?.status === "adopted"
          && (previewEdit.fileType === "system_prompt" || previewEdit.fileType === "prompt" || previewEdit.filename === "SKILL.md")
          ? previewEdit
          : null,
      );
      return;
    }

    setAdoptedPromptPreview(null);
    setSelectedFile({ skillId: selectedFile.skillId, fileType: "asset", filename });
    setAdoptedAssetPreview(
      previewEdit?.status === "adopted" && previewEdit.fileType === "source_file" && previewEdit.filename === filename
        ? previewEdit
        : null,
    );
  }

  const fetchSkills = useCallback(() => {
    setSkillsLoading(true);
    apiFetch<SkillDetail[]>("/skills?mine=true")
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]))
      .finally(() => setSkillsLoading(false));
  }, []);

  const [skillRefreshCounter, setSkillRefreshCounter] = useState(0);

  async function refreshSkill(skillId: number, options?: { syncPrompt?: boolean }) {
    try {
      const updated = await apiFetch<SkillDetail>(`/skills/${skillId}`);
      setSkills((prev) => prev.map((s) => s.id === skillId ? { ...s, ...updated } : s));
      if (options?.syncPrompt && selectedFile?.skillId === skillId) {
        const latestPrompt = updated.versions?.[0]?.system_prompt ?? updated.system_prompt ?? "";
        setSavedPrompt(latestPrompt);
        if (!editorIsDirty || selectedFile.fileType !== "prompt") {
          setPrompt(latestPrompt);
          setPendingDiffBase(null);
        }
      }
      setSkillRefreshCounter((c) => c + 1);
    } catch { /* ignore */ }
  }

  const [globalSkills, setGlobalSkills] = useState<SkillDetail[]>([]);
  useEffect(() => {
    apiFetch<SkillDetail[]>("/skills")
      .then((data) => setGlobalSkills(Array.isArray(data) ? data.filter((s) => isPublishedSkillStatus(s.status)) : []))
      .catch(() => {});
  }, []);

  const searchableSkills = (() => {
    const seen = new Set<number>();
    return [
      ...skills.filter((s) => isEditableSkillStatus(s.status) || isPublishedSkillStatus(s.status)),
      ...globalSkills,
    ].filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
  })();

  // 初始化时同步 workspace 中未注册的 skill 文件到 DB，再加载列表
  useEffect(() => {
    apiFetch("/dev-studio/sync-skills-from-workspace", { method: "POST" })
      .catch(() => {})
      .finally(() => fetchSkills());
  }, [fetchSkills]);

  async function handleNewFromList(name: string) {
    const created = await apiFetch<SkillDetail>("/skills", {
      method: "POST",
      body: JSON.stringify({ name, description: "", system_prompt: "", mode: "hybrid", variables: [], auto_inject: true }),
    });
    fetchSkills();
    setSelectedFile({ skillId: created.id, fileType: "prompt" });
    setIsNew(false);
    setPrompt("");
    setSavedPrompt("");
  }

  async function handleSaved(skill: SkillDetail) {
    setSelectedFile({ skillId: skill.id, fileType: "prompt" });
    setIsNew(false);
    setSavedPrompt(prompt);
    fetchSkills();

    // 将本轮 chat 摘要写入 skill 的 _memo.md 附属文件
    const chatKey = `studio_msgs_${convId}`;
    try {
      let chatMsgs: ChatMessage[] = [];
      try {
        const dbMsgs = await apiFetch<{ role: string; content: string; metadata?: Record<string, unknown> }[]>(
          `/conversations/${convId}/messages`
        );
        chatMsgs = dbMsgs.map((m) => ({ role: m.role as "user" | "assistant", text: m.content, loading: false }));
      } catch {
        const raw = localStorage.getItem(chatKey);
        chatMsgs = raw ? JSON.parse(raw) : [];
      }
      if (chatMsgs.length > 0) {
        // 取最近 10 条消息作为摘要
        const recent = chatMsgs.slice(-10);
        const summary = recent.map((m) => {
          const prefix = m.role === "user" ? "👤" : "🤖";
          const text = m.text.length > 200 ? m.text.slice(0, 200) + "..." : m.text;
          return `${prefix} ${text}`;
        }).join("\n\n");

        const now = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        const newEntry = `## ${now} 改动记录\n\n${summary}\n\n---\n`;

        // 读取已有 memo 内容并追加
        let existing = "";
        try {
          const res = await apiFetch<{ content: string }>(`/skills/${skill.id}/files/_memo.md`);
          existing = res.content || "";
        } catch { /* 文件不存在，忽略 */ }

        const header = existing ? "" : `# Skill Memo - ${skill.name}\n\n`;
        const content = header + newEntry + existing.replace(/^# Skill Memo.*\n\n/, "");

        await apiFetch(`/skills/${skill.id}/files/${encodeURIComponent("_memo.md")}`, {
          method: "PUT",
          body: JSON.stringify({ content }),
        });

        // 归档后清空本轮 chat
        localStorage.removeItem(chatKey);
        clearChatRef.current?.();
      }
    } catch { /* memo 写入失败不阻塞保存流程 */ }
  }

  async function handleFork() {
    if (!selectedSkill) return;
    try {
      const forked = await apiFetch<SkillDetail>(`/skills/${selectedSkill.id}/fork`, { method: "POST" }).catch(() => null);
      if (forked) { handleSaved(forked); return; }
      const detail = await apiFetch<SkillDetail>(`/skills/${selectedSkill.id}`);
      const srcPrompt = detail.versions?.[0]?.system_prompt ?? detail.system_prompt ?? "";
      const created = await apiFetch<SkillDetail>("/skills", {
        method: "POST",
        body: JSON.stringify({ name: `${selectedSkill.name}（副本）`, description: selectedSkill.description, system_prompt: srcPrompt, mode: "hybrid", variables: [], auto_inject: true }),
      });
      handleSaved(created);
    } catch (err) {
      console.error("Fork failed", err);
    }
  }

  function handleApplyDraft(draft: StudioDraft) {
    if (draft.system_prompt !== prompt) {
      setPendingDiffBase(prompt);
      setPrompt(draft.system_prompt);
    }
    if (draft.name) setExternalName(draft.name);
    if (draft.description !== undefined) setExternalDescription(draft.description);
  }

  function handleNewSession() {
    clearChatRef.current?.();
  }

  const handleResetSessionArtifacts = useCallback(() => {
    resetWorkflowArtifacts();
    setShowGovernancePanel(false);
    setChatTestFlowIntent(null);
    setActiveCardActions([]);
  }, [resetWorkflowArtifacts]);

  function handleAdoptSuggestion(skillName: string, suggestion: Suggestion) {
    const text = `${skillName}-修改意见: ${suggestion.problem_desc}\n期望: ${suggestion.expected_direction}`;
    setInputRef.current?.(text);
    // Also register in memo if skill has one
    if (selectedSkill) {
      apiFetch(`/skills/${selectedSkill.id}/memo/adopt-feedback`, {
        method: "POST",
        body: JSON.stringify({
          source_type: "comment",
          source_id: (suggestion as unknown as { id?: number }).id ?? 0,
          summary: `${suggestion.problem_desc} → ${suggestion.expected_direction}`,
          task_blueprint: {},
        }),
      }).then(() => handleMemoRefresh()).catch(() => {});
    }
  }

  const showAssetEditor = (editorTarget.kind === "asset" || (editorTarget.kind === "loading" && editorTarget.next.fileType === "asset")) && selectedSkill !== null;
  const selectedEditorFilename = selectedFile?.fileType === "asset"
    ? (selectedFile as { filename: string }).filename
    : selectedFile?.fileType === "prompt"
      ? "SKILL.md"
      : null;
  const editorErrorMessage = editorTarget.kind === "error" ? editorTarget.message : null;
  const activeCardKindLabel = activeWorkbenchCard
    ? ({
        architect: "架构卡",
        governance: "治理卡",
        validation: "验证卡",
        system: "系统卡",
        create: "创作卡",
        refine: "完善卡",
        fixing: "整改卡",
        release: "发布卡",
      } as const)[activeWorkbenchCard.kind]
    : null;
  const activeCardStatusLabel = activeWorkbenchCard
    ? ({
        pending: "待处理",
        active: "进行中",
        reviewing: "待确认",
        adopted: "已采纳",
        rejected: "已拒绝",
        dismissed: "已关闭",
        stale: "已过期",
      } as const)[activeWorkbenchCard.status]
    : null;
  const activeCardContractId = activeWorkbenchCard?.contractId
    ?? resolveStudioCardContract(activeWorkbenchCard)?.contractId
    ?? null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b-2 border-[#1A202C] bg-[#EBF4F7] px-4 py-2.5 flex items-center gap-3">
        <SkillIcon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">Skill Studio</span>
        <div className="ml-2 min-w-0">
          <div className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">
            {activeWorkbenchCard ? "当前" : "正在编辑"}
          </div>
          <div className="text-[10px] font-bold text-[#1A202C] truncate">
            {activeWorkbenchCard
              ? [
                  activeCardQueueWindow?.phase || activeWorkbenchCard.phase || storeWorkflowState?.phase || "discover",
                  activeWorkbenchCard.title,
                  activeWorkbenchCard.fileRole ? FILE_ROLE_LABEL[activeWorkbenchCard.fileRole] : null,
                ].filter(Boolean).join(" · ")
              : selectedFile?.fileType === "asset"
                ? `${selectedSkill?.name ?? ""} / ${(selectedFile as { filename: string }).filename}`
                : selectedSkill
                  ? `${selectedSkill.name} / SKILL.md`
                  : isNew
                    ? "新建 Skill"
                    : "选择或新建 Skill 开始"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {activeWorkbenchCard && (
            <div className="flex items-center gap-1.5">
              <span className="text-[7px] font-bold uppercase tracking-widest text-[#00A3C4]">
                {activeCardKindLabel}
              </span>
              <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 border ${
                activeWorkbenchCard.status === "pending" || activeWorkbenchCard.status === "active"
                  ? "border-[#F59E0B]/40 bg-[#FFFBF2] text-[#F59E0B]"
                  : activeWorkbenchCard.status === "adopted"
                    ? "border-[#00CC99]/40 bg-emerald-50 text-[#00CC99]"
                    : "border-gray-300 bg-gray-50 text-gray-400"
              }`}>
                {activeCardStatusLabel}
              </span>
            </div>
          )}
          {selectedSkill && (
            <button
              type="button"
              onClick={() => setShowGovernancePanel((prev) => !prev)}
              className={`text-[8px] font-bold uppercase tracking-widest border px-2 py-1 flex items-center gap-1 transition-colors ${
                showGovernancePanel
                  ? "border-[#00A3C4] bg-[#00A3C4] text-white"
                  : "border-[#00A3C4]/40 text-[#00A3C4] bg-white hover:bg-[#00A3C4]/10"
              }`}
            >
              <ShieldCheck size={10} />
              权限助手
            </button>
          )}
        </div>
      </div>

      {/* 沙盒报告入口提示 */}
      {fromSandbox && sandboxReportId && (
        <div className="flex-shrink-0 px-4 py-1.5 bg-amber-50 border-b-2 border-amber-300 text-[9px] flex items-center gap-2 flex-wrap">
          <span className="text-amber-700 font-bold">
            来源：沙盒报告 #{sandboxReportId}
          </span>
          {activeSandboxReport && (
            <span className="text-gray-500">
              {activeSandboxReport.approval_eligible ? "通过" : "失败"}
              {(() => {
                const issues = (activeSandboxReport.part3_evaluation as Record<string, unknown>)?.issues as unknown[] | undefined;
                const fixPlan = (activeSandboxReport.part3_evaluation as Record<string, unknown>)?.fix_plan_structured as unknown[] | undefined;
                const parts: string[] = [];
                if (issues?.length) parts.push(`${issues.length} 个问题`);
                if (fixPlan?.length) parts.push(`${fixPlan.length} 项整改`);
                return parts.length ? ` · ${parts.join(" / ")}` : "";
              })()}
            </span>
          )}
          {memoSyncError && (
            <>
              <span className="text-red-500 font-bold ml-2">{memoSyncError}</span>
              <button
                onClick={handleRetryMemoSync}
                disabled={retryingMemoSync || !sandboxSessionId}
                className="text-[8px] font-bold text-[#00A3C4] border border-[#00A3C4] px-2 py-0.5 hover:bg-[#00A3C4] hover:text-white disabled:opacity-50 ml-1"
              >
                {retryingMemoSync ? "同步中..." : "重试同步"}
              </button>
            </>
          )}
          {!memoSyncError && memo?.lifecycle_stage === "fixing" && (
            <span className="text-[#00CC99] font-bold ml-2">已进入整改模式</span>
          )}
          {sandboxRemediationLoading && (
            <span className="text-[#F59E0B] font-bold ml-2">正在扫描 Skill 并生成治理卡片...</span>
          )}
          {sandboxRemediationSummary && (
            <span className="text-[#00A3C4] font-bold ml-2">
              已生成 {sandboxRemediationSummary.cards} 张治理卡片 / {sandboxRemediationSummary.stagedEdits} 个待确认修改
            </span>
          )}
          {sandboxVersionMismatchMessage && (
            <div className="basis-full text-red-600 font-bold border border-red-300 bg-red-50 px-2 py-1 mt-1">
              {sandboxVersionMismatchMessage}
            </div>
          )}
        </div>
      )}

      {/* Workbench body: SkillList | Card Queue | Chat | File Workspace (slide-out) | Governance */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: Skill list */}
        <SkillList
          skills={skills}
          loading={skillsLoading}
          selectedFile={selectedFile}
          refreshCounter={skillRefreshCounter}
          collapsed={skillListCollapsed}
          onSelectFile={(f) => {
            setSelectedFile(f);
            setIsNew(false);
          }}
          onNew={handleNewFromList}
          onImport={() => setShowImportModal(true)}
          onRefreshSkill={refreshSkill}
          onAdoptSuggestion={handleAdoptSuggestion}
          onToggleCollapse={() => setSkillListCollapsed((v) => !v)}
        />

        {/* Card Queue + expanded card detail */}
        <StudioCardRail
          skill={selectedSkill}
          workflowState={storeWorkflowState}
          cards={workbenchCards}
          activeCardId={activeWorkbenchId}
          memo={memo}
          cardQueueLedger={cardQueueLedger}
          activeSandboxReport={activeSandboxReport}
          governanceIntent={chatTestFlowIntent}
          pendingGovernanceCount={pendingGovernanceCount}
          pendingStagedEditCount={pendingStagedEditCount}
          activeCardActions={activeCardActions}
          onSelect={setActiveWorkbenchCardId}
          onOpenGovernancePanel={() => setShowGovernancePanel(true)}
          onOpenSandbox={() => {
            if (selectedSkill) setShowSandbox(selectedSkill.id);
          }}
          onOpenPrompt={handleOpenPromptFromWorkspace}
          onFocusChat={handleFocusChatFromWorkspace}
          onApplyDraft={() => chatActionsRef.current?.applyDraft()}
          onDiscardDraft={() => chatActionsRef.current?.discardDraft()}
          onConfirmSummary={() => chatActionsRef.current?.confirmSummary()}
          onDiscardSummary={() => chatActionsRef.current?.discardSummary()}
          onConfirmSplit={() => chatActionsRef.current?.confirmSplit()}
          onDiscardSplit={() => chatActionsRef.current?.discardSplit()}
          onStartFixTask={(task) => chatActionsRef.current?.startFixTask(task)}
          onTargetedRetest={(taskId) => chatActionsRef.current?.targetedRetest(taskId)}
          onSubmitApproval={() => {
            // submit approval — trigger chat message
            handleFocusChatFromWorkspace("请帮我提交审批");
          }}
          onConfirmTool={() => chatActionsRef.current?.toolBound()}
          onExternalBuild={async (card) => {
            if (!selectedSkill) return;
            const rawCard = card.raw ?? {};
            const handoffSummary = typeof rawCard.handoff_summary === "string" && rawCard.handoff_summary.trim()
              ? rawCard.handoff_summary.trim()
              : card.summary;
            const rawCriteria = Array.isArray(rawCard.acceptance_criteria)
              ? rawCard.acceptance_criteria.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
              : [];
            const acceptanceCriteria = rawCriteria.length > 0
              ? rawCriteria
              : [`${card.title} 实现完成并通过基本功能验证`];
            try {
              const result = await apiFetch<{
                ok: boolean;
                route_kind?: "internal" | "external";
                destination?: string;
                derived_card_id?: string;
                handoff_policy?: string;
                return_to?: "bind_back" | "confirm" | "validate";
                explanation?: string;
                error?: string;
              }>(`/skills/${selectedSkill.id}/studio/cards/${card.id}/handoff`, {
                method: "POST",
                body: JSON.stringify({
                  target_role: card.fileRole || "tool",
                  target_file: card.target.key,
                  route_kind: card.routeKind || "external",
                  destination: card.destination || "dev_studio",
                  return_to: card.returnTo || "bind_back",
                  handoff_policy: card.handoffPolicy || "open_development_studio",
                  summary: card.summary,
                  handoff_summary: handoffSummary,
                  acceptance_criteria: acceptanceCriteria,
                }),
              });
              if (!result.ok) {
                useStudioStore.getState().setStudioError({
                  kind: "handoff_failed",
                  message: "外部交接记录创建失败，当前未进入外部处理。请重试。",
                  step: "handoff",
                  recoveryHint: "请重试创建交接记录，确认交接包完整后再发起外部实现。",
                  autoAdvanced: false,
                  activeCardId: card.id,
                });
                handleFocusChatFromWorkspace("外部交接记录创建失败，请先修复后再发起外部实现");
                return;
              }
              useStudioStore.getState().setStudioError(null);
              fetchStudioSession(selectedSkill.id);
              const dest = result.destination || card.destination || "dev_studio";
              if (dest === "opencode") {
                const popup = window.open("/api/opencode/", "_blank", "noopener,noreferrer");
                if (!popup) window.location.assign("/api/opencode/");
              } else if (dest === "dev_studio") {
                router.push("/dev-studio");
              } else {
                handleFocusChatFromWorkspace(result.explanation || "交接已记录，请回到 Studio 继续处理当前内部路由");
              }
            } catch {
              useStudioStore.getState().setStudioError({
                kind: "handoff_failed",
                message: "外部交接记录创建失败，当前未进入外部处理。请重试。",
                step: "handoff",
                recoveryHint: "请重试创建交接记录，确认交接包完整后再发起外部实现。",
                autoAdvanced: false,
                activeCardId: card.id,
              });
              handleFocusChatFromWorkspace("外部交接记录创建失败，请先修复后再发起外部实现");
            }
          }}
          onBindBack={async (card) => {
            if (!selectedSkill) return;
            try {
              const result = await apiFetch<{
                ok: boolean;
                next_card_id?: string;
                next_card_kind?: string;
                explanation?: string;
              }>(`/skills/${selectedSkill.id}/studio/cards/${card.id}/bind-back`, {
                method: "POST",
                body: JSON.stringify({
                  source: "user_initiated",
                  summary: "外部编辑完成，回绑变更",
                }),
              });
              useStudioStore.getState().setStudioError(null);
              fetchStudioSession(selectedSkill.id);
              if (result?.next_card_id) {
                setActiveWorkbenchCardId(`workflow-card:${result.next_card_id}`);
              }
            } catch {
              useStudioStore.getState().setStudioError({
                kind: "bindback_failed",
                message: "回绑操作失败，外部变更未确认。请重试。",
                step: "bind_back",
                recoveryHint: "请重试回绑；如果外部产物尚未准备好，先回到外部工作台确认结果。",
                autoAdvanced: false,
                activeCardId: card.id,
              });
              handleFocusChatFromWorkspace("外部编辑完成，请回绑变更并触发验证");
            }
          }}
        />

        {/* Studio Chat — fills remaining space; editor/governance overlay on top */}
        <div className="flex-1 min-w-0 relative overflow-hidden bg-white">
          <StudioChat
            ref={chatActionsRef}
            convId={convId}
            skillId={selectedSkill?.id ?? null}
            currentPrompt={prompt}
            editorIsDirty={editorIsDirty}
            selectedSourceFile={selectedEditorFilename}
            allSkills={searchableSkills}
            memo={memo}
            onApplyDraft={handleApplyDraft}
            onNewSession={handleNewSession}
            onResetSessionArtifacts={handleResetSessionArtifacts}
            onToolBound={() => { if (selectedSkill) { refreshSkill(selectedSkill.id); handleMemoRefresh(); } }}
            onFileSplitDone={() => { if (selectedSkill) refreshSkill(selectedSkill.id); }}
            onMemoRefresh={handleMemoRefresh}
            onOpenSandbox={(id) => setShowSandbox(id)}
            onEditorTarget={handleEditorTarget}
            clearRef={clearChatRef}
            setInputRef={setInputRef}
            sandboxReportId={fromSandbox ? sandboxReportId : undefined}
            fromSandbox={fromSandbox}
            onExpandEditor={handleManualExpandEditor}
            onOpenStagedEditTarget={handleOpenStagedEditTarget}
            onRefreshSkill={() => { if (selectedSkill) refreshSkill(selectedSkill.id); }}
            onOpenTestFlowPanel={handleOpenChatTestFlowPanel}
            onSelectSkillForTestFlow={handleSelectSkillForTestFlow}
            editorExpanded={editorVisible}
            activeCardTitle={activeWorkbenchCard?.title ?? null}
            activeCardSummary={activeWorkbenchCard?.summary ?? null}
            activeCardMode={activeWorkbenchCard?.mode ?? null}
            activeCardTarget={activeWorkbenchCard?.target.key ?? null}
            activeCardId={activeWorkbenchCard?.id ?? null}
            activeCardContractId={activeCardContractId}
            activeCardSourceCardId={activeWorkbenchCard?.sourceCardId ?? null}
            activeCardStagedEditId={activeWorkbenchCard?.stagedEditId ?? null}
            activeCardValidationSource={activeWorkbenchCard?.validationSource ?? null}
            activeCardFileRole={activeWorkbenchCard?.fileRole ?? null}
            activeCardHandoffPolicy={activeWorkbenchCard?.handoffPolicy ?? null}
            activeCardRouteKind={activeWorkbenchCard?.routeKind ?? null}
            activeCardDestination={activeWorkbenchCard?.destination ?? null}
            activeCardReturnTo={activeWorkbenchCard?.returnTo ?? null}
            activeCardQueueWindow={activeCardQueueWindow}
            onActiveCardActionsChange={setActiveCardActions}
            onPendingDraftChange={handlePendingDraftChange}
            onPendingSummaryChange={handlePendingSummaryChange}
            onPendingToolSuggestionChange={handlePendingToolSuggestionChange}
            onPendingFileSplitChange={handlePendingFileSplitChange}
            onOpenGovernancePanel={() => setShowGovernancePanel(true)}
          />

          {!editorVisible && selectedSkill && (
            <button
              type="button"
              onClick={handleManualExpandEditor}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 border-2 border-r-0 border-[#1A202C] bg-[#ECFBFF] px-2 py-3 text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] hover:bg-white"
            >
              展开编辑区
            </button>
          )}

          {/* File Workspace - 覆盖在 StudioChat 之上 */}
        <div
          className={`absolute top-0 right-0 bottom-0 border-l-2 border-[#1A202C] bg-white transition-[width,opacity] ease-in-out overflow-hidden z-20 ${
            editorResizing ? "duration-0" : "duration-300"
          } ${editorVisible ? "opacity-100" : "opacity-0 border-l-0"}`}
          style={{ width: editorVisible ? editorDrawerWidth : 0 }}
        >
          {editorVisible && (
            <div
              role="separator"
              aria-label="调整编辑器宽度"
              aria-orientation="vertical"
              tabIndex={0}
              onPointerDown={handleEditorDrawerResizeStart}
              className="absolute left-0 top-0 bottom-0 z-10 w-2 -translate-x-1/2 cursor-col-resize bg-transparent"
            />
          )}
          <div className="h-full min-h-0 flex flex-col" style={{ width: editorDrawerWidth }}>
            <div className="flex-shrink-0 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between bg-[#F8FCFD]">
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">
                {selectedFile?.fileType === "asset" ? (selectedFile as { filename: string }).filename : "SKILL.md"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditorManuallyCollapsed(true);
                  setEditorVisibility("collapsed");
                }}
                className="text-[8px] font-bold text-gray-400 hover:text-[#1A202C] border border-gray-300 px-1.5 py-0.5 hover:bg-gray-100 transition-colors"
              >
                收起 ✕
              </button>
            </div>
            {editorErrorMessage && (
              <div className="mx-3 mt-2 border border-red-300 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-600">
                {editorErrorMessage}
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
              {showAssetEditor && selectedSkill ? (
                <AssetFileEditor
                  skill={selectedSkill}
                  filename={(selectedFile as { filename: string }).filename}
                  onDeleted={() => {
                    refreshSkill(selectedSkill.id);
                    setSelectedFile({ skillId: selectedSkill.id, fileType: "prompt" });
                  }}
                  onFileSaved={handleFileSaved}
                  adoptedPreviewEdit={adoptedAssetPreview}
                  onContentChange={setPrompt}
                  onBaselineChange={setSavedPrompt}
                  onLoadStart={(nextFilename) => {
                    setEditorTarget(buildAssetLoadingTarget({ skillId: selectedSkill.id, fileType: "asset", filename: nextFilename }, selectedFile, "asset_load_start"));
                  }}
                  onLoadSuccess={(nextFilename) => {
                    setEditorTarget(buildAssetEditorTarget(selectedSkill.id, nextFilename, "asset_load_success"));
                  }}
                  onLoadError={(_nextFilename, message) => {
                    setAdoptedAssetPreview(null);
                    setEditorTarget(buildEditorErrorTarget(message, { skillId: selectedSkill.id, fileType: "prompt" }, "asset_load_failed"));
                  }}
                />
              ) : (
                <PromptEditor
                  skill={selectedSkill}
                  isNew={isNew}
                  prompt={prompt}
                  externalName={externalName}
                  externalDescription={externalDescription}
                  pendingDiffBase={pendingDiffBase}
                  saveRef={editorSaveRef}
                  onPromptChange={setPrompt}
                  onBaselineChange={setSavedPrompt}
                  onSaved={handleSaved}
                  onFork={handleFork}
                  onFileSaved={handleFileSaved}
                  adoptedPreviewEdit={adoptedPromptPreview}
                  sandboxVersionMismatch={sandboxVersionMismatch}
                  sandboxVersionMismatchMessage={sandboxVersionMismatchMessage}
                  onOpenTestFlowPanel={handleOpenChatTestFlowPanel}
                />
              )}
            </div>
          </div>
        </div>

        {/* Governance Panel — 覆盖在 StudioChat 之上 */}
        {showGovernancePanel && selectedSkill && (
          <div className="absolute top-0 right-0 bottom-0 w-[460px] border-l-2 border-[#1A202C] overflow-hidden bg-white z-30">
            <SkillGovernancePanel
              skill={selectedSkill}
              testFlowIntent={chatTestFlowIntent}
              onClose={() => {
                setShowGovernancePanel(false);
                setChatTestFlowIntent(null);
              }}
              onSkillMounted={() => refreshSkill(selectedSkill.id, { syncPrompt: true })}
              onMaterializedSession={(sessionId) => {
                setShowSandbox(selectedSkill.id);
                if (sessionId > 0) {
                  router.replace(`/chat/${convId}?ws=skill_studio&skill_id=${selectedSkill.id}&session_id=${sessionId}`);
                }
              }}
            />
          </div>
        )}
        </div>
      </div>

      {/* Import modal */}
      {showSandbox && (
        <SandboxTestModal
          type="skill"
          id={showSandbox}
          name={skills.find(s => s.id === showSandbox)?.name ?? ""}
          onPassed={() => { setShowSandbox(null); handleMemoRefresh(); }}
          onCancel={() => { setShowSandbox(null); handleMemoRefresh(); }}
          onImportToStudio={() => {
            // 1. 关闭弹窗
            setShowSandbox(null);
            // 2. 刷新 memo（会自动加载 fixing 状态的 fix tasks）
            handleMemoRefresh();
            // 3. 确保 Skill 被选中并打开 prompt 编辑器
            const sandboxSkillId = showSandbox;
            if (sandboxSkillId) {
              setSelectedFile({ skillId: sandboxSkillId, fileType: "prompt" });
            }
          }}
          initialSessionId={
            fromSandbox && sandboxSessionId && showSandbox === initialSkillId
              ? Number(sandboxSessionId)
              : undefined
          }
        />
      )}

      {showImportModal && (
        <ImportSkillModal
          onImported={(skill) => {
            setShowImportModal(false);
            handleSaved(skill as SkillDetail);
            // Trigger memo analyze-import for the imported skill
            const imported = skill as SkillDetail;
            apiFetch(`/skills/${imported.id}/memo/analyze-import`, {
              method: "POST",
              body: JSON.stringify({ trigger: "import_zip" }),
            }).then(() => {
              if (imported.id) fetchMemo(imported.id);
            }).catch(() => {});
          }}
          onCancel={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}
  function normalizeStagedEdit(raw: Record<string, unknown>): StagedEdit {
    return normalizeStagedEditPayload(raw);
  }
