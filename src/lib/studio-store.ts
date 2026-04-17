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

// ─── Editor visibility state machine ─────────────────────────────────────────

export type EditorVisibility = "collapsed" | "auto_expanded" | "pinned_open";

// ─── Session mode ─────────────────────────────────────────────────────────────

export type SessionMode = "create" | "optimize" | "audit" | null;

export interface ArchivedStudioRun {
  runId: string;
  runVersion: number;
  status: "superseded" | "completed" | "failed" | "cancelled";
  supersededBy?: string | null;
  archivedAt?: string | null;
}

// ─── Store interface ──────────────────────────────────────────────────────────

export interface StudioSessionState {
  // 编辑区可见性
  editorVisibility: EditorVisibility;
  setEditorVisibility: (v: EditorVisibility) => void;
  editorManuallyCollapsed: boolean;
  setEditorManuallyCollapsed: (collapsed: boolean) => void;

  // 会话模式
  sessionMode: SessionMode;
  setSessionMode: (mode: SessionMode) => void;

  // 辅助 Skill
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

  // 治理卡片队列
  governanceCards: GovernanceCardData[];
  addGovernanceCard: (card: GovernanceCardData) => void;
  syncGovernanceCards: (source: string, cards: GovernanceCardData[]) => void;
  updateCardStatus: (id: string, status: GovernanceCardData["status"]) => void;

  // Staged edits
  stagedEdits: StagedEdit[];
  addStagedEdit: (edit: StagedEdit) => void;
  syncStagedEdits: (source: string, edits: StagedEdit[]) => void;
  adoptStagedEdit: (id: string) => void;
  rejectStagedEdit: (id: string) => void;

  // Preflight re-run trigger
  preflightRefreshToken: number;
  requestPreflightRefresh: () => void;

  // 现有状态迁移（保持向后兼容）
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

  // Reset
  reset: () => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

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
  stagedEdits: [] as StagedEdit[],
  preflightRefreshToken: 0,
  pendingDraft: null as StudioDraft | null,
  pendingSummary: null as StudioSummary | null,
  pendingToolSuggestion: null as StudioToolSuggestion | null,
  pendingFileSplit: null as StudioFileSplit | null,
  sessionState: null as V2SessionState | null,
  memo: null as SkillMemo | null,
};

function preserveResolvedCardStatus(
  existing: GovernanceCardData | undefined,
  incoming: GovernanceCardData,
): GovernanceCardData {
  if (!existing || existing.status === "pending" || incoming.status !== "pending") {
    return incoming;
  }
  return { ...incoming, status: existing.status };
}

function preserveResolvedEditStatus(
  existing: StagedEdit | undefined,
  incoming: StagedEdit,
): StagedEdit {
  if (!existing || existing.status === "pending" || incoming.status !== "pending") {
    return incoming;
  }
  return { ...incoming, status: existing.status };
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
    set((s) => ({
      governanceCards: s.governanceCards.some((existing) => existing.id === card.id)
        ? s.governanceCards.map((existing) => existing.id === card.id ? card : existing)
        : [...s.governanceCards, card],
    })),
  syncGovernanceCards: (source, cards) =>
    set((s) => {
      const preserved = s.governanceCards.filter((card) => card.source !== source);
      const existingById = new Map(s.governanceCards.map((card) => [card.id, card] as const));
      return {
        governanceCards: [
          ...preserved,
          ...cards.map((card) => preserveResolvedCardStatus(existingById.get(card.id), { ...card, source })),
        ],
      };
    }),
  updateCardStatus: (id, status) =>
    set((s) => ({
      governanceCards: s.governanceCards.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
    })),

  addStagedEdit: (edit) =>
    set((s) => ({
      stagedEdits: s.stagedEdits.some((existing) => existing.id === edit.id)
        ? s.stagedEdits.map((existing) => existing.id === edit.id ? edit : existing)
        : [...s.stagedEdits, edit],
    })),
  syncStagedEdits: (source, edits) =>
    set((s) => {
      const preserved = s.stagedEdits.filter((edit) => edit.source !== source);
      const existingById = new Map(s.stagedEdits.map((edit) => [edit.id, edit] as const));
      return {
        stagedEdits: [
          ...preserved,
          ...edits.map((edit) => preserveResolvedEditStatus(existingById.get(edit.id), { ...edit, source })),
        ],
      };
    }),
  adoptStagedEdit: (id) =>
    set((s) => ({
      stagedEdits: s.stagedEdits.map((e) =>
        e.id === id ? { ...e, status: "adopted" as const } : e
      ),
    })),
  rejectStagedEdit: (id) =>
    set((s) => ({
      stagedEdits: s.stagedEdits.map((e) =>
        e.id === id ? { ...e, status: "rejected" as const } : e
      ),
    })),

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
    stagedEdits: [],
  }),

  reset: () => set(initialState),
}));
