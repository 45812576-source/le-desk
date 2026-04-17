"use client";

import { create } from "zustand";
import type {
  StudioDraft,
  StudioSummary,
  StudioToolSuggestion,
  StudioFileSplit,
  V2SessionState,
  GovernanceCardData,
  StagedEdit,
} from "@/components/skill-studio/types";
import type { StudioDeepPatch, WorkflowStateData } from "@/components/skill-studio/workflow-protocol";
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
      return {
        governanceCardLedger,
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
      return {
        stagedEditLedger,
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
      return {
        stagedEditLedger,
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
  resetWorkflowArtifacts: () => set({
    sessionMode: null,
    activeAssistSkills: [],
    workflowState: null,
    activeRunId: null,
    activeRunVersion: null,
    archivedRuns: [],
    appliedPatchSeqs: [],
    deepPatches: [],
    governanceCards: [],
    governanceCardSources: {},
    governanceCardLedger: {},
    stagedEdits: [],
    stagedEditSources: {},
    stagedEditLedger: {},
  }),

  reset: () => set(initialState),
}));
