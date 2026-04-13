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
import type { SkillMemo } from "@/lib/types";

// ─── Editor visibility state machine ─────────────────────────────────────────

export type EditorVisibility = "collapsed" | "auto_expanded" | "pinned_open";

// ─── Session mode ─────────────────────────────────────────────────────────────

export type SessionMode = "create" | "optimize" | "audit" | null;

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

  // 治理卡片队列
  governanceCards: GovernanceCardData[];
  addGovernanceCard: (card: GovernanceCardData) => void;
  updateCardStatus: (id: string, status: GovernanceCardData["status"]) => void;

  // Staged edits
  stagedEdits: StagedEdit[];
  addStagedEdit: (edit: StagedEdit) => void;
  adoptStagedEdit: (id: string) => void;
  rejectStagedEdit: (id: string) => void;

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

  // Reset
  reset: () => void;
}

// ─── Store implementation ─────────────────────────────────────────────────────

const initialState = {
  editorVisibility: "collapsed" as EditorVisibility,
  editorManuallyCollapsed: false,
  sessionMode: null as SessionMode,
  activeAssistSkills: [] as { id: number; name: string; status: string }[],
  governanceCards: [] as GovernanceCardData[],
  stagedEdits: [] as StagedEdit[],
  pendingDraft: null as StudioDraft | null,
  pendingSummary: null as StudioSummary | null,
  pendingToolSuggestion: null as StudioToolSuggestion | null,
  pendingFileSplit: null as StudioFileSplit | null,
  sessionState: null as V2SessionState | null,
  memo: null as SkillMemo | null,
};

export const useStudioStore = create<StudioSessionState>((set) => ({
  ...initialState,

  setEditorVisibility: (v) => set({ editorVisibility: v }),
  setEditorManuallyCollapsed: (collapsed) => set({ editorManuallyCollapsed: collapsed }),
  setSessionMode: (mode) => set({ sessionMode: mode }),
  setActiveAssistSkills: (skills) => set({ activeAssistSkills: skills }),

  addGovernanceCard: (card) =>
    set((s) => ({ governanceCards: [...s.governanceCards, card] })),
  updateCardStatus: (id, status) =>
    set((s) => ({
      governanceCards: s.governanceCards.map((c) =>
        c.id === id ? { ...c, status } : c
      ),
    })),

  addStagedEdit: (edit) =>
    set((s) => ({ stagedEdits: [...s.stagedEdits, edit] })),
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

  setPendingDraft: (draft) => set({ pendingDraft: draft }),
  setPendingSummary: (summary) => set({ pendingSummary: summary }),
  setPendingToolSuggestion: (suggestion) => set({ pendingToolSuggestion: suggestion }),
  setPendingFileSplit: (split) => set({ pendingFileSplit: split }),
  setSessionState: (state) => set({ sessionState: state }),
  setMemo: (memo) => set({ memo }),

  reset: () => set(initialState),
}));
