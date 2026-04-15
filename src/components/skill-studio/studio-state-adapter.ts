import type { StudioDraft, StudioRecoveryInfo, V2SessionState } from "./types";

export interface RecoveredStudioTransientState {
  sessionState: V2SessionState | null;
  reconciledFacts: { type: string; text: string }[];
  directionShift: { from: string; to: string } | null;
  fileNeedStatus: { status: string; forbidden_countdown: number } | null;
  repeatBlocked: string | null;
}

export function parseStudioRecoveryPayload(
  recovery?: Record<string, unknown> | null,
): StudioRecoveryInfo | null {
  if (!recovery || typeof recovery !== "object") {
    return null;
  }
  const source = recovery.source;
  if (source !== "memory" && source !== "persisted" && source !== "none") {
    return null;
  }
  return {
    source,
    cold_start: Boolean(recovery.cold_start),
    recovered_at: typeof recovery.recovered_at === "string" ? recovery.recovered_at : null,
  };
}

export function deriveStudioRecoveryDraftImpact(input: {
  recoveryInfo?: StudioRecoveryInfo | null;
  sessionState?: V2SessionState | null;
  pendingDraft?: StudioDraft | null;
  currentPrompt?: string | null;
  editorIsDirty?: boolean;
}): string | null {
  const {
    recoveryInfo,
    sessionState,
    pendingDraft,
    currentPrompt,
    editorIsDirty,
  } = input;
  if (!recoveryInfo || recoveryInfo.source === "none") {
    return null;
  }
  if (pendingDraft?.system_prompt?.trim()) {
    return "已恢复待采纳草稿，尚未写入编辑器";
  }

  const hasEditorContent = Boolean(currentPrompt && currentPrompt.trim().length > 0);
  if (sessionState?.has_draft && hasEditorContent && editorIsDirty) {
    return "已恢复草稿上下文，当前编辑器仍保留本地修改";
  }
  if (sessionState?.has_draft && hasEditorContent) {
    return "已恢复草稿上下文，当前编辑器已有可继续编辑内容";
  }
  if (sessionState?.has_draft) {
    return "检测到历史草稿记录，但当前编辑器未加载对应内容";
  }
  if (hasEditorContent) {
    return "本次恢复未改写当前编辑器内容";
  }
  return "本次恢复仅同步会话状态，未影响编辑器草稿";
}

export function parseStudioStatePayload(
  studioState?: Record<string, unknown> | null,
): RecoveredStudioTransientState {
  if (!studioState || typeof studioState !== "object") {
    return {
      sessionState: null,
      reconciledFacts: [],
      directionShift: null,
      fileNeedStatus: null,
      repeatBlocked: null,
    };
  }

  const sessionState: V2SessionState = {
    scenario: String(studioState.scenario || "unknown"),
    mode: String(studioState.mode || ""),
    goal: String(studioState.goal || ""),
    confirmed_facts: Array.isArray(studioState.confirmed_facts)
      ? studioState.confirmed_facts.filter((item): item is string => typeof item === "string")
      : [],
    active_constraints: Array.isArray(studioState.active_constraints)
      ? studioState.active_constraints.filter((item): item is string => typeof item === "string")
      : [],
    rejected: Array.isArray(studioState.rejected)
      ? studioState.rejected.filter((item): item is string => typeof item === "string")
      : [],
    file_status: String(studioState.file_status || "not_needed"),
    readiness: Number(studioState.readiness || 0),
    has_draft: Boolean(studioState.has_draft),
    total_rounds: Number(studioState.total_rounds || 0),
  };

  const reconciledFacts = Array.isArray(studioState.reconciled_facts)
    ? studioState.reconciled_facts
        .filter((item): item is { type: string; text: string } =>
          typeof item === "object"
          && item !== null
          && typeof (item as { type?: unknown }).type === "string"
          && typeof (item as { text?: unknown }).text === "string"
        )
        .map((item) => ({ type: item.type, text: item.text }))
    : [];

  const directionShift = studioState.direction_shift;
  const normalizedDirectionShift = directionShift && typeof directionShift === "object"
    && typeof (directionShift as { from?: unknown }).from === "string"
    && typeof (directionShift as { to?: unknown }).to === "string"
    ? {
        from: String((directionShift as { from: string }).from),
        to: String((directionShift as { to: string }).to),
      }
    : null;

  const fileNeedStatus = studioState.file_need_status;
  const normalizedFileNeedStatus = fileNeedStatus && typeof fileNeedStatus === "object"
    && typeof (fileNeedStatus as { status?: unknown }).status === "string"
    ? {
        status: String((fileNeedStatus as { status: string }).status),
        forbidden_countdown: Number((fileNeedStatus as { forbidden_countdown?: unknown }).forbidden_countdown || 0),
      }
    : null;

  const repeatBlocked = studioState.repeat_blocked;
  const normalizedRepeatBlocked = repeatBlocked && typeof repeatBlocked === "object"
    && typeof (repeatBlocked as { reason?: unknown }).reason === "string"
    ? String((repeatBlocked as { reason: string }).reason)
    : null;

  return {
    sessionState,
    reconciledFacts,
    directionShift: normalizedDirectionShift,
    fileNeedStatus: normalizedFileNeedStatus,
    repeatBlocked: normalizedRepeatBlocked,
  };
}
