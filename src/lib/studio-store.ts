"use client";

import { create } from "zustand";
import type {
  ArchitectArtifact,
  StudioDraft,
  StudioSummary,
  StudioToolSuggestion,
  StudioFileSplit,
  V2SessionState,
  GovernanceCardData,
  StagedEdit,
} from "@/components/skill-studio/types";
import type { StudioDeepPatch, WorkflowStateData } from "@/components/skill-studio/workflow-protocol";
import type { StudioOrchestrationErrorPayload } from "@/components/skill-studio/workflow-adapter";
import {
  resolveFocusedWorkbenchCardId,
  type CardQueueWindow,
  type StudioWorkspaceState,
  type WorkbenchCard,
  type WorkbenchMode,
} from "@/components/skill-studio/workbench-types";
import type { SkillMemo } from "@/lib/types";
import { reconcileStudioArtifacts } from "@/lib/studio-reconcile";

export type EditorVisibility = "collapsed" | "auto_expanded" | "pinned_open";
export type SessionMode = "create" | "optimize" | "audit" | null;

export interface ArchivedStudioRun {
  runId: string;
  runVersion: number;
  status: "superseded" | "completed" | "failed" | "cancelled";
  supersededBy?: string | null;
  archivedAt?: string | null;
}

export interface StudioSessionState {
  editorVisibility: EditorVisibility;
  setEditorVisibility: (v: EditorVisibility) => void;
  editorManuallyCollapsed: boolean;
  setEditorManuallyCollapsed: (collapsed: boolean) => void;

  sessionMode: SessionMode;
  setSessionMode: (mode: SessionMode) => void;

  activeAssistSkills: { id: number; name: string; status: string }[];
  setActiveAssistSkills: (skills: { id: number; name: string; status: string }[]) => void;
  workflowState: WorkflowStateData | null;
  setWorkflowState: (state: WorkflowStateData | null) => void;
  activeRunId: string | null;
  activeRunVersion: number | null;
  archivedRuns: ArchivedStudioRun[];
  appliedPatchSeqs: number[];
  deepPatches: StudioDeepPatch[];
  setActiveRun: (runId: string, runVersion: number) => void;
  archiveRun: (run: ArchivedStudioRun) => void;
  rememberPatchSeq: (patchSeq: number) => void;
  addDeepPatch: (patch: StudioDeepPatch) => void;
  resetRunTracking: () => void;

  activeWorkbenchCardId: string | null;
  setActiveWorkbenchCardId: (id: string | null) => void;
  activeCardId: string | null;
  setActiveCardId: (id: string | null) => void;
  workbenchMode: WorkbenchMode;
  setWorkbenchMode: (mode: WorkbenchMode) => void;
  workspace: StudioWorkspaceState;
  setWorkspace: (workspace: StudioWorkspaceState) => void;
  cardsById: Record<string, WorkbenchCard>;
  cardOrder: string[];
  replaceWorkbenchCards: (cards: WorkbenchCard[], preferredActiveId?: string | null) => void;
  upsertWorkbenchCard: (card: WorkbenchCard, options?: { makeActive?: boolean }) => void;
  updateWorkbenchCardStatus: (id: string, status: WorkbenchCard["status"]) => void;

  governanceCards: GovernanceCardData[];
  governanceCardSources: Record<string, GovernanceCardData[]>;
  governanceCardLedger: Record<string, { status: GovernanceCardData["status"]; updatedAt: number }>;
  addGovernanceCard: (card: GovernanceCardData) => void;
  syncGovernanceCards: (source: string, cards: GovernanceCardData[]) => void;
  updateCardStatus: (id: string, status: GovernanceCardData["status"]) => void;

  stagedEdits: StagedEdit[];
  stagedEditSources: Record<string, StagedEdit[]>;
  stagedEditLedger: Record<string, { status: StagedEdit["status"]; updatedAt: number }>;
  addStagedEdit: (edit: StagedEdit) => void;
  syncStagedEdits: (source: string, edits: StagedEdit[]) => void;
  adoptStagedEdit: (id: string) => void;
  rejectStagedEdit: (id: string) => void;

  preflightRefreshToken: number;
  requestPreflightRefresh: () => void;

  pendingDraft: StudioDraft | null;
  setPendingDraft: (draft: StudioDraft | null) => void;
  pendingSummary: StudioSummary | null;
  setPendingSummary: (summary: StudioSummary | null) => void;
  pendingToolSuggestion: StudioToolSuggestion | null;
  setPendingToolSuggestion: (suggestion: StudioToolSuggestion | null) => void;
  pendingFileSplit: StudioFileSplit | null;
  setPendingFileSplit: (split: StudioFileSplit | null) => void;
  sessionState: V2SessionState | null;
  setSessionState: (state: V2SessionState | null) => void;
  memo: SkillMemo | null;
  setMemo: (memo: SkillMemo | null) => void;

  queueWindow: CardQueueWindow | null;
  setQueueWindow: (qw: CardQueueWindow | null) => void;
  resumeHintDismissed: boolean;
  dismissResumeHint: () => void;

  studioError: StudioOrchestrationErrorPayload | null;
  setStudioError: (error: StudioOrchestrationErrorPayload | null) => void;

  architectArtifacts: ArchitectArtifact[];
  mergeArchitectArtifacts: (artifacts: ArchitectArtifact[]) => void;
  clearArchitectArtifacts: () => void;

  resetWorkflowArtifacts: () => void;

  reset: () => void;
}

const initialState = {
  editorVisibility: "collapsed" as EditorVisibility,
  editorManuallyCollapsed: false,
  sessionMode: null as SessionMode,
  activeAssistSkills: [] as { id: number; name: string; status: string }[],
  workflowState: null as WorkflowStateData | null,
  activeRunId: null as string | null,
  activeRunVersion: null as number | null,
  archivedRuns: [] as ArchivedStudioRun[],
  appliedPatchSeqs: [] as number[],
  deepPatches: [] as StudioDeepPatch[],
  activeWorkbenchCardId: null as string | null,
  activeCardId: null as string | null,
  workbenchMode: "analysis" as WorkbenchMode,
  workspace: {
    mode: "analysis" as WorkbenchMode,
    currentTarget: { type: null, key: null },
    currentCardId: null as string | null,
    validationSource: null,
  } as StudioWorkspaceState,
  cardsById: {} as Record<string, WorkbenchCard>,
  cardOrder: [] as string[],
  governanceCards: [] as GovernanceCardData[],
  governanceCardSources: {} as Record<string, GovernanceCardData[]>,
  governanceCardLedger: {} as Record<string, { status: GovernanceCardData["status"]; updatedAt: number }>,
  stagedEdits: [] as StagedEdit[],
  stagedEditSources: {} as Record<string, StagedEdit[]>,
  stagedEditLedger: {} as Record<string, { status: StagedEdit["status"]; updatedAt: number }>,
  preflightRefreshToken: 0,
  pendingDraft: null as StudioDraft | null,
  pendingSummary: null as StudioSummary | null,
  pendingToolSuggestion: null as StudioToolSuggestion | null,
  pendingFileSplit: null as StudioFileSplit | null,
  sessionState: null as V2SessionState | null,
  memo: null as SkillMemo | null,
  queueWindow: null as CardQueueWindow | null,
  resumeHintDismissed: false,
  studioError: null as StudioOrchestrationErrorPayload | null,
  architectArtifacts: [] as ArchitectArtifact[],
};

function buildResolvedStudioArtifacts(state: Pick<
  StudioSessionState,
  "governanceCardSources" | "stagedEditSources" | "governanceCardLedger" | "stagedEditLedger"
>) {
  return reconcileStudioArtifacts({
    governanceCardSources: state.governanceCardSources,
    stagedEditSources: state.stagedEditSources,
    governanceCardLedger: state.governanceCardLedger,
    stagedEditLedger: state.stagedEditLedger,
  });
}

function deriveWorkspaceFromCard(card: WorkbenchCard | null): StudioWorkspaceState {
  if (!card) {
    return {
      mode: "analysis",
      currentTarget: { type: null, key: null },
      currentCardId: null,
      validationSource: null,
    };
  }
  return {
    mode: card.mode,
    currentTarget: card.target,
    currentCardId: card.id,
    validationSource: card.validationSource ?? null,
  };
}

function orderWorkbenchCards(
  cardsById: Record<string, WorkbenchCard>,
  currentOrder: string[],
  options?: { preserveProvidedOrder?: boolean },
) {
  const known = new Set(currentOrder);
  const ordered = currentOrder.filter((id) => cardsById[id]);
  const missing = Object.values(cardsById)
    .filter((card) => !known.has(card.id))
    .sort((left, right) => right.priority - left.priority)
    .map((card) => card.id);
  if (options?.preserveProvidedOrder) {
    return Array.from(new Set([...ordered, ...missing]));
  }
  const sorted = [...ordered, ...missing].sort((leftId, rightId) => {
    const left = cardsById[leftId];
    const right = cardsById[rightId];
    if (!left || !right) return 0;
    if (left.status !== right.status) {
      const rank: Record<WorkbenchCard["status"], number> = {
        pending: 5,
        active: 4,
        reviewing: 3,
        adopted: 2,
        rejected: 1,
        dismissed: 0,
        stale: -1,
      };
      return rank[right.status] - rank[left.status];
    }
    return right.priority - left.priority;
  });
  return Array.from(new Set(sorted));
}

function deriveActiveCardId(cardsById: Record<string, WorkbenchCard>, cardOrder: string[], preferredActiveId?: string | null) {
  return resolveFocusedWorkbenchCardId(
    cardOrder.map((id) => cardsById[id]).filter(Boolean),
    preferredActiveId,
  );
}

export const useStudioStore = create<StudioSessionState>((set) => ({
  ...initialState,

  setEditorVisibility: (v) => set({ editorVisibility: v }),
  setEditorManuallyCollapsed: (collapsed) => set({ editorManuallyCollapsed: collapsed }),
  setSessionMode: (mode) => set({ sessionMode: mode }),
  setActiveAssistSkills: (skills) => set({ activeAssistSkills: skills }),
  setWorkflowState: (state) => set({ workflowState: state }),
  setActiveRun: (runId, runVersion) => set({ activeRunId: runId, activeRunVersion: runVersion }),
  archiveRun: (run) =>
    set((s) => ({
      archivedRuns: s.archivedRuns.some((existing) => existing.runId === run.runId)
        ? s.archivedRuns.map((existing) => existing.runId === run.runId ? { ...existing, ...run } : existing)
        : [run, ...s.archivedRuns].slice(0, 12),
      activeRunId: s.activeRunId === run.runId ? null : s.activeRunId,
      activeRunVersion: s.activeRunId === run.runId ? null : s.activeRunVersion,
    })),
  rememberPatchSeq: (patchSeq) =>
    set((s) => (
      s.appliedPatchSeqs.includes(patchSeq)
        ? s
        : { appliedPatchSeqs: [...s.appliedPatchSeqs, patchSeq].slice(-200) }
    )),
  addDeepPatch: (patch) =>
    set((s) => ({
      deepPatches: s.deepPatches.some((existing) =>
        existing.run_id === patch.run_id && existing.patch_seq === patch.patch_seq
      )
        ? s.deepPatches.map((existing) =>
            existing.run_id === patch.run_id && existing.patch_seq === patch.patch_seq ? patch : existing
          )
        : [...s.deepPatches, patch].slice(-20),
    })),
  resetRunTracking: () => set({
    activeRunId: null,
    activeRunVersion: null,
    archivedRuns: [],
    appliedPatchSeqs: [],
    deepPatches: [],
  }),
  setActiveWorkbenchCardId: (id) => set((s) => {
    const card = id ? s.cardsById[id] ?? null : null;
    return {
      activeWorkbenchCardId: id,
      activeCardId: id,
      workbenchMode: card?.mode ?? s.workbenchMode,
      workspace: card ? deriveWorkspaceFromCard(card) : { ...s.workspace, currentCardId: id },
    };
  }),
  setActiveCardId: (id) => set((s) => {
    const card = id ? s.cardsById[id] ?? null : null;
    return {
      activeCardId: id,
      activeWorkbenchCardId: id,
      workbenchMode: card?.mode ?? s.workbenchMode,
      workspace: card ? deriveWorkspaceFromCard(card) : { ...s.workspace, currentCardId: id },
    };
  }),
  setWorkbenchMode: (mode) => set((s) => ({ workbenchMode: mode, workspace: { ...s.workspace, mode } })),
  setWorkspace: (workspace) => set({ workspace, workbenchMode: workspace.mode, activeCardId: workspace.currentCardId, activeWorkbenchCardId: workspace.currentCardId }),
  replaceWorkbenchCards: (cards, preferredActiveId) =>
    set((s) => {
      const cardsById = Object.fromEntries(cards.map((card) => [card.id, card]));
      const cardOrder = orderWorkbenchCards(cardsById, cards.map((card) => card.id), { preserveProvidedOrder: true });
      const activeCardId = deriveActiveCardId(
        cardsById,
        cardOrder,
        preferredActiveId ?? s.activeCardId ?? s.activeWorkbenchCardId,
      );
      const activeCard = activeCardId ? cardsById[activeCardId] ?? null : null;
      return {
        cardsById,
        cardOrder,
        activeCardId,
        activeWorkbenchCardId: activeCardId,
        workbenchMode: activeCard?.mode ?? "analysis",
        workspace: deriveWorkspaceFromCard(activeCard),
      };
    }),
  upsertWorkbenchCard: (card, options) =>
    set((s) => {
      const cardsById = { ...s.cardsById, [card.id]: card };
      const cardOrder = orderWorkbenchCards(cardsById, s.cardOrder.includes(card.id) ? s.cardOrder : [card.id, ...s.cardOrder]);
      const activeCardId = options?.makeActive ? card.id : deriveActiveCardId(cardsById, cardOrder, s.activeCardId);
      const activeCard = activeCardId ? cardsById[activeCardId] ?? null : null;
      return {
        cardsById,
        cardOrder,
        activeCardId,
        activeWorkbenchCardId: activeCardId,
        workbenchMode: activeCard?.mode ?? "analysis",
        workspace: deriveWorkspaceFromCard(activeCard),
      };
    }),
  updateWorkbenchCardStatus: (id, status) =>
    set((s) => {
      const current = s.cardsById[id];
      if (!current) return s;
      const cardsById = { ...s.cardsById, [id]: { ...current, status } };
      const cardOrder = orderWorkbenchCards(cardsById, s.cardOrder);
      const activeCardId = deriveActiveCardId(cardsById, cardOrder, id);
      const activeCard = cardsById[activeCardId ?? ""];
      return {
        cardsById,
        cardOrder,
        activeCardId,
        activeWorkbenchCardId: activeCardId,
        workbenchMode: activeCard?.mode ?? s.workbenchMode,
        workspace: deriveWorkspaceFromCard(activeCard ?? null),
      };
    }),

  addGovernanceCard: (card) =>
    set((s) => {
      const source = card.source || "runtime";
      const nextSourceCards = s.governanceCardSources[source] || [];
      const governanceCardSources = {
        ...s.governanceCardSources,
        [source]: nextSourceCards.some((existing) => existing.id === card.id)
          ? nextSourceCards.map((existing) => existing.id === card.id ? { ...card, source } : existing)
          : [...nextSourceCards, { ...card, source }],
      };
      return {
        governanceCardSources,
        ...buildResolvedStudioArtifacts({
          governanceCardSources,
          stagedEditSources: s.stagedEditSources,
          governanceCardLedger: s.governanceCardLedger,
          stagedEditLedger: s.stagedEditLedger,
        }),
      };
    }),
  syncGovernanceCards: (source, cards) =>
    set((s) => {
      const governanceCardSources = {
        ...s.governanceCardSources,
        [source]: cards.map((card) => ({ ...card, source })),
      };
      return {
        governanceCardSources,
        ...buildResolvedStudioArtifacts({
          governanceCardSources,
          stagedEditSources: s.stagedEditSources,
          governanceCardLedger: s.governanceCardLedger,
          stagedEditLedger: s.stagedEditLedger,
        }),
      };
    }),
  updateCardStatus: (id, status) =>
    set((s) => {
      const governanceCardLedger = {
        ...s.governanceCardLedger,
        [id]: { status, updatedAt: Date.now() },
      };
      const linkedWorkbenchCardId = Object.values(s.cardsById).find((card) => card.sourceCardId === id)?.id;
      const nextCardsById = linkedWorkbenchCardId && s.cardsById[linkedWorkbenchCardId]
        ? {
            ...s.cardsById,
            [linkedWorkbenchCardId]: { ...s.cardsById[linkedWorkbenchCardId], status },
          }
        : s.cardsById;
      const nextCardOrder = linkedWorkbenchCardId ? orderWorkbenchCards(nextCardsById, s.cardOrder) : s.cardOrder;
      const activeCardId = linkedWorkbenchCardId
        ? deriveActiveCardId(nextCardsById, nextCardOrder, linkedWorkbenchCardId)
        : s.activeCardId;
      return {
        governanceCardLedger,
        cardsById: nextCardsById,
        cardOrder: nextCardOrder,
        activeCardId,
        activeWorkbenchCardId: activeCardId,
        workspace: linkedWorkbenchCardId ? deriveWorkspaceFromCard(nextCardsById[activeCardId ?? ""] ?? null) : s.workspace,
        ...buildResolvedStudioArtifacts({
          governanceCardSources: s.governanceCardSources,
          stagedEditSources: s.stagedEditSources,
          governanceCardLedger,
          stagedEditLedger: s.stagedEditLedger,
        }),
      };
    }),

  addStagedEdit: (edit) =>
    set((s) => {
      const source = edit.source || "runtime";
      const nextSourceEdits = s.stagedEditSources[source] || [];
      const stagedEditSources = {
        ...s.stagedEditSources,
        [source]: nextSourceEdits.some((existing) => existing.id === edit.id)
          ? nextSourceEdits.map((existing) => existing.id === edit.id ? { ...edit, source } : existing)
          : [...nextSourceEdits, { ...edit, source }],
      };
      return {
        stagedEditSources,
        ...buildResolvedStudioArtifacts({
          governanceCardSources: s.governanceCardSources,
          stagedEditSources,
          governanceCardLedger: s.governanceCardLedger,
          stagedEditLedger: s.stagedEditLedger,
        }),
      };
    }),
  syncStagedEdits: (source, edits) =>
    set((s) => {
      const stagedEditSources = {
        ...s.stagedEditSources,
        [source]: edits.map((edit) => ({ ...edit, source })),
      };
      return {
        stagedEditSources,
        ...buildResolvedStudioArtifacts({
          governanceCardSources: s.governanceCardSources,
          stagedEditSources,
          governanceCardLedger: s.governanceCardLedger,
          stagedEditLedger: s.stagedEditLedger,
        }),
      };
    }),
  adoptStagedEdit: (id) =>
    set((s) => {
      const stagedEditLedger = {
        ...s.stagedEditLedger,
        [id]: { status: "adopted" as const, updatedAt: Date.now() },
      };
      const linkedWorkbenchCardId = Object.values(s.cardsById).find((card) => card.stagedEditId === id)?.id;
      const nextCardsById = linkedWorkbenchCardId && s.cardsById[linkedWorkbenchCardId]
        ? {
            ...s.cardsById,
            [linkedWorkbenchCardId]: { ...s.cardsById[linkedWorkbenchCardId], status: "adopted" as const },
          }
        : s.cardsById;
      const nextCardOrder = linkedWorkbenchCardId ? orderWorkbenchCards(nextCardsById, s.cardOrder) : s.cardOrder;
      // 采纳后焦点保留在刚处理完的卡上，让用户确认结果
      const activeCardId = linkedWorkbenchCardId ?? s.activeCardId;
      return {
        stagedEditLedger,
        cardsById: nextCardsById,
        cardOrder: nextCardOrder,
        activeCardId,
        activeWorkbenchCardId: activeCardId,
        workspace: linkedWorkbenchCardId ? deriveWorkspaceFromCard(nextCardsById[activeCardId ?? ""] ?? null) : s.workspace,
        ...buildResolvedStudioArtifacts({
          governanceCardSources: s.governanceCardSources,
          stagedEditSources: s.stagedEditSources,
          governanceCardLedger: s.governanceCardLedger,
          stagedEditLedger,
        }),
      };
    }),
  rejectStagedEdit: (id) =>
    set((s) => {
      const stagedEditLedger = {
        ...s.stagedEditLedger,
        [id]: { status: "rejected" as const, updatedAt: Date.now() },
      };
      const linkedWorkbenchCardId = Object.values(s.cardsById).find((card) => card.stagedEditId === id)?.id;
      const nextCardsById = linkedWorkbenchCardId && s.cardsById[linkedWorkbenchCardId]
        ? {
            ...s.cardsById,
            [linkedWorkbenchCardId]: { ...s.cardsById[linkedWorkbenchCardId], status: "rejected" as const },
          }
        : s.cardsById;
      const nextCardOrder = linkedWorkbenchCardId ? orderWorkbenchCards(nextCardsById, s.cardOrder) : s.cardOrder;
      const activeCardId = linkedWorkbenchCardId
        ? deriveActiveCardId(nextCardsById, nextCardOrder, linkedWorkbenchCardId)
        : s.activeCardId;
      return {
        stagedEditLedger,
        cardsById: nextCardsById,
        cardOrder: nextCardOrder,
        activeCardId,
        activeWorkbenchCardId: activeCardId,
        workspace: linkedWorkbenchCardId ? deriveWorkspaceFromCard(nextCardsById[activeCardId ?? ""] ?? null) : s.workspace,
        ...buildResolvedStudioArtifacts({
          governanceCardSources: s.governanceCardSources,
          stagedEditSources: s.stagedEditSources,
          governanceCardLedger: s.governanceCardLedger,
          stagedEditLedger,
        }),
      };
    }),

  requestPreflightRefresh: () =>
    set((s) => ({ preflightRefreshToken: s.preflightRefreshToken + 1 })),

  setPendingDraft: (draft) => set({ pendingDraft: draft }),
  setPendingSummary: (summary) => set({ pendingSummary: summary }),
  setPendingToolSuggestion: (suggestion) => set({ pendingToolSuggestion: suggestion }),
  setPendingFileSplit: (split) => set({ pendingFileSplit: split }),
  setSessionState: (state) => set({ sessionState: state }),
  setMemo: (memo) => set({ memo }),

  setQueueWindow: (qw) => set({ queueWindow: qw }),
  dismissResumeHint: () => set({ resumeHintDismissed: true }),
  setStudioError: (error) => set({ studioError: error }),

  mergeArchitectArtifacts: (artifacts) =>
    set((s) => {
      const byId = new Map(s.architectArtifacts.map((a) => [a.id, a]));
      for (const a of artifacts) byId.set(a.id, a);
      return { architectArtifacts: Array.from(byId.values()) };
    }),
  clearArchitectArtifacts: () => set({ architectArtifacts: [] }),

  resetWorkflowArtifacts: () => set({
    sessionMode: null,
    activeAssistSkills: [],
    workflowState: null,
    queueWindow: null,
    resumeHintDismissed: false,
    activeRunId: null,
    activeRunVersion: null,
    archivedRuns: [],
    appliedPatchSeqs: [],
    deepPatches: [],
    activeWorkbenchCardId: null,
    activeCardId: null,
    workbenchMode: "analysis",
    workspace: {
      mode: "analysis",
      currentTarget: { type: null, key: null },
      currentCardId: null,
      validationSource: null,
    },
    cardsById: {},
    cardOrder: [],
    governanceCards: [],
    governanceCardSources: {},
    governanceCardLedger: {},
    stagedEdits: [],
    stagedEditSources: {},
    stagedEditLedger: {},
    architectArtifacts: [],
  }),

  reset: () => set(initialState),
}));
