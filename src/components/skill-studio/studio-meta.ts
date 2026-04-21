"use client";

export interface StudioMetaDirective {
  phase: string | null;
  turn: number | null;
  quickReplies: string[];
}

const STUDIO_META_PATTERN = /<!--\s*STUDIO_META:\s*(\{[\s\S]*?\})\s*-->/gi;
const QUICK_REPLY_ACTION_HINT = /继续|创建|开始|生成|编辑|执行|产出|补|输出/i;

function normalizeQuickReplies(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item, index, list) => item.length > 0 && list.indexOf(item) === index);
}

function normalizeStudioMeta(raw: Record<string, unknown>): StudioMetaDirective {
  return {
    phase: typeof raw.phase === "string" ? raw.phase : null,
    turn: typeof raw.turn === "number" ? raw.turn : typeof raw.turn === "string" ? Number(raw.turn) || null : null,
    quickReplies: normalizeQuickReplies(raw.quick_replies),
  };
}

function stripForIntentMatch(text: string): string {
  return text.replace(/[，。！？!?,、；;：:\s]/g, "").toLowerCase();
}

function isGenericContinue(text: string): boolean {
  const normalized = stripForIntentMatch(text);
  if (!normalized) return false;
  if ([
    "可以",
    "可以继续",
    "可以请继续",
    "继续",
    "请继续",
    "继续吧",
    "好的",
    "好",
    "行",
    "嗯",
    "ok",
    "okay",
    "yes",
    "开始",
    "开始吧",
    "执行",
    "执行吧",
    "请开始",
  ].includes(normalized)) {
    return true;
  }
  return /^(可以|好|好的|行|嗯)?(请)?(继续|开始|执行)/i.test(normalized);
}

export function extractStudioMeta(text: string): { cleanText: string; meta: StudioMetaDirective | null } {
  let meta: StudioMetaDirective | null = null;
  const cleanText = text.replace(STUDIO_META_PATTERN, (_, rawJson: string) => {
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      meta = normalizeStudioMeta(parsed);
    } catch {
      // ignore invalid studio meta comments
    }
    return "";
  });

  return {
    cleanText: cleanText.replace(/\n{3,}/g, "\n\n").trim(),
    meta,
  };
}

export function pickPrimaryStudioQuickReply(meta: StudioMetaDirective | null | undefined): string | null {
  if (!meta?.quickReplies.length) return null;
  return meta.quickReplies.find((reply) => QUICK_REPLY_ACTION_HINT.test(reply)) || meta.quickReplies[0] || null;
}

export function resolveStudioMetaReply(userText: string, meta: StudioMetaDirective | null | undefined): string | null {
  const trimmed = userText.trim();
  if (!trimmed || !meta?.quickReplies.length) return null;
  if (meta.quickReplies.includes(trimmed)) {
    return trimmed;
  }
  if (isGenericContinue(trimmed)) {
    return pickPrimaryStudioQuickReply(meta);
  }
  return null;
}

export function resolveWorkflowNextActionMessage(
  nextAction: string | null | undefined,
  meta: StudioMetaDirective | null | undefined,
): string | null {
  if (!nextAction) return null;
  if (
    nextAction === "start_editing"
    || nextAction === "continue_editing"
    || nextAction === "generate_draft"
    || nextAction === "generate_outline"
    || nextAction === "generate_section"
  ) {
    return pickPrimaryStudioQuickReply(meta);
  }
  return null;
}
