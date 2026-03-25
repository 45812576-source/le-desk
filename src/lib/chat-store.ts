"use client";

import { create } from "zustand";
import { apiFetch } from "./api";
import { streamChat, streamUpload, createBlockFromStart, applyBlockDelta, finalizeBlock, blocksToPlainText } from "./stream";
import { connectionManager } from "./connection";
import type { ContentBlock, Conversation, Message } from "./types";

// Per-conversation streaming state
export interface ConvStreamState {
  isSending: boolean;
  isFileUpload: boolean;
  streamingBlocks: ContentBlock[];
  streamingText: string;
  streamStage: string | null;
  abortController: AbortController | null;
  currentRound: number;
  maxRounds: number;
  streamError: { type: string; message: string } | null;
  tokenUsage: { input: number; output: number; used: number; limit: number } | null;
}

const DEFAULT_STREAM_STATE: ConvStreamState = {
  isSending: false,
  isFileUpload: false,
  streamingBlocks: [],
  streamingText: "",
  streamStage: null,
  abortController: null,
  currentRound: 0,
  maxRounds: 0,
  streamError: null,
  tokenUsage: null,
};

// ─── Out-of-store stream state (avoids global re-render on every delta) ───────

const _streamStates = new Map<number, ConvStreamState>();
const _streamListeners = new Map<number, Set<() => void>>();
const _pendingNotify = new Set<number>();

function getStreamState(convId: number): ConvStreamState {
  return _streamStates.get(convId) ?? { ...DEFAULT_STREAM_STATE };
}

function _flushNotify(convId: number) {
  _pendingNotify.delete(convId);
  _streamListeners.get(convId)?.forEach((fn) => fn());
}

function patchStreamState(convId: number, patch: Partial<ConvStreamState>, immediate = false) {
  const prev = _streamStates.get(convId) ?? { ...DEFAULT_STREAM_STATE };
  _streamStates.set(convId, { ...prev, ...patch });
  if (immediate) {
    _pendingNotify.delete(convId);
    _streamListeners.get(convId)?.forEach((fn) => fn());
  } else if (!_pendingNotify.has(convId)) {
    _pendingNotify.add(convId);
    requestAnimationFrame(() => _flushNotify(convId));
  }
}

export function subscribeConvStream(convId: number, listener: () => void): () => void {
  if (!_streamListeners.has(convId)) _streamListeners.set(convId, new Set());
  _streamListeners.get(convId)!.add(listener);
  return () => _streamListeners.get(convId)?.delete(listener);
}

export function getConvStreamSnapshot(convId: number): ConvStreamState {
  return getStreamState(convId);
}

// ─── Zustand store (messages + conversations only) ────────────────────────────

interface ChatStore {
  conversations: Conversation[];
  activeConvId: number | null;
  messagesMap: Map<number, Message[]>;

  loadConversations: () => Promise<void>;
  loadMessages: (convId: number) => Promise<void>;
  setActiveConv: (convId: number | null) => void;
  sendMessage: (
    convId: number,
    content: string,
    opts?: {
      activeSkillIds?: number[];
      toolId?: number;
      file?: File;
      multiFiles?: Record<string, File>;
      forceSkillId?: number;
    }
  ) => Promise<void>;
  stopGeneration: (convId: number) => void;
  appendOptimisticMessage: (convId: number, msg: Message) => void;
  updateMessage: (convId: number, msg: Message) => void;
  updateConvTitle: (convId: number, title: string) => void;
  clearStreamError: (convId: number) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConvId: null,
  messagesMap: new Map(),

  setActiveConv(convId) {
    set({ activeConvId: convId });
  },

  async loadConversations() {
    try {
      const data = await apiFetch<Conversation[]>("/conversations");
      set({ conversations: data });
    } catch {
      // ignore
    }
  },

  async loadMessages(convId) {
    const cached = get().messagesMap.get(convId);
    if (cached) return;
    try {
      const data = await apiFetch<Message[]>(`/conversations/${convId}/messages`);
      set((s) => {
        const next = new Map(s.messagesMap);
        next.set(convId, data);
        return { messagesMap: next };
      });
    } catch {
      // ignore
    }
  },

  appendOptimisticMessage(convId, msg) {
    set((s) => {
      const next = new Map(s.messagesMap);
      const prev = next.get(convId) ?? [];
      next.set(convId, [...prev, msg]);
      return { messagesMap: next };
    });
  },

  updateMessage(convId, msg) {
    set((s) => {
      const next = new Map(s.messagesMap);
      const prev = next.get(convId) ?? [];
      const idx = prev.findIndex((m) => m.id === msg.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = msg;
        next.set(convId, updated);
      } else {
        next.set(convId, [...prev, msg]);
      }
      return { messagesMap: next };
    });
  },

  updateConvTitle(convId, title) {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === convId ? { ...c, title } : c
      ),
    }));
    apiFetch(`/conversations/${convId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }).catch(() => {});
  },

  clearStreamError(convId) {
    patchStreamState(convId, { streamError: null });
  },

  stopGeneration(convId) {
    getStreamState(convId).abortController?.abort();
  },

  async sendMessage(convId, content, opts) {
    if (getStreamState(convId).isSending) return;

    const file = opts?.file;
    const multiFiles = opts?.multiFiles;

    // 多文件上传
    if (multiFiles && Object.keys(multiFiles).length > 0) {
      const fileNames = Object.entries(multiFiles).map(([k, f]) => `${k}: ${f.name}`).join("、");
      const optimisticContent = content ? `${content}\n\n[多文件上传: ${fileNames}]` : `[多文件上传: ${fileNames}]`;
      const tempId = Date.now();
      get().appendOptimisticMessage(convId, {
        id: tempId,
        role: "user",
        content: optimisticContent,
        created_at: new Date().toISOString(),
      });

      const abort = new AbortController();
      patchStreamState(convId, {
        isSending: true, isFileUpload: true, streamError: null,
        streamingText: "", streamingBlocks: [], streamStage: null,
        abortController: abort, currentRound: 0, maxRounds: 0, tokenUsage: null,
      }, true);

      let accumulated = "";
      let finalMessageId: number | null = null;
      let finalMetadata: Record<string, unknown> = {};
      const blocks: ContentBlock[] = [];

      try {
        const firstFile = Object.values(multiFiles)[0];
        for await (const event of streamUpload(convId, firstFile, content || undefined, {
          signal: abort.signal,
          multiFiles,
        })) {
          switch (event.type) {
            case "status": patchStreamState(convId, { streamStage: event.data.stage as string }, true); break;
            case "delta":
              accumulated += event.data.text as string;
              patchStreamState(convId, { streamingText: accumulated, streamStage: null }); break;
            case "replace":
              accumulated = event.data.text as string;
              patchStreamState(convId, { streamingText: accumulated }); break;
            case "content_block_start": {
              const idx = event.data.index as number;
              blocks[idx] = createBlockFromStart(event.data);
              patchStreamState(convId, { streamingBlocks: [...blocks], streamStage: null }, true); break;
            }
            case "content_block_delta": {
              const idx = event.data.index as number;
              const updated = applyBlockDelta(blocks, idx, event.data.delta as Record<string, unknown>);
              updated.forEach((b, i) => { blocks[i] = b; });
              patchStreamState(convId, { streamingBlocks: [...blocks] }); break;
            }
            case "content_block_stop": {
              const idx = event.data.index as number;
              const finalized = finalizeBlock(blocks, idx, event.data);
              finalized.forEach((b, i) => { blocks[i] = b; });
              patchStreamState(convId, { streamingBlocks: [...blocks] }, true); break;
            }
            case "round_start":
              patchStreamState(convId, { currentRound: event.data.round as number, maxRounds: event.data.max_rounds as number }, true); break;
            case "done":
              finalMessageId = event.data.message_id as number;
              finalMetadata = (event.data.metadata as Record<string, unknown>) ?? {};
              break;
            case "error":
              patchStreamState(convId, { streamError: { type: (event.data.error_type as string) || "unknown", message: (event.data.message as string) || "未知错误" } }, true); break;
          }
        }
        if (finalMessageId) {
          const finalBlocks = blocks.length > 0 ? blocks : undefined;
          const finalContent = finalBlocks ? blocksToPlainText(finalBlocks) : accumulated;
          get().updateMessage(convId, {
            id: finalMessageId, role: "assistant",
            content: finalContent || accumulated, content_blocks: finalBlocks,
            created_at: new Date().toISOString(), metadata: finalMetadata,
          });
        }
      } catch (err: unknown) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          set((s) => {
            const next = new Map(s.messagesMap);
            next.set(convId, (next.get(convId) ?? []).filter((m) => m.id !== tempId));
            return { messagesMap: next };
          });
        }
      } finally {
        patchStreamState(convId, {
          isSending: false, isFileUpload: false, streamingText: "", streamingBlocks: [], streamStage: null, abortController: null,
        });
      }
      return;
    }

    // 单文件上传
    if (file) {
      const optimisticContent = content ? `${content}\n\n[文件: ${file.name}]` : `[文件: ${file.name}]`;
      const tempId = Date.now();
      get().appendOptimisticMessage(convId, {
        id: tempId, role: "user", content: optimisticContent, created_at: new Date().toISOString(),
      });

      const abort = new AbortController();
      patchStreamState(convId, {
        isSending: true, isFileUpload: true, streamError: null,
        streamingText: "", streamingBlocks: [], streamStage: null,
        abortController: abort, currentRound: 0, maxRounds: 0, tokenUsage: null,
      }, true);

      let accumulated = "";
      let finalMessageId: number | null = null;
      let finalMetadata: Record<string, unknown> = {};
      const blocks: ContentBlock[] = [];

      try {
        for await (const event of streamUpload(convId, file, content || undefined, { signal: abort.signal })) {
          switch (event.type) {
            case "status": patchStreamState(convId, { streamStage: event.data.stage as string }, true); break;
            case "delta":
              accumulated += event.data.text as string;
              patchStreamState(convId, { streamingText: accumulated, streamStage: null }); break;
            case "replace":
              accumulated = event.data.text as string;
              patchStreamState(convId, { streamingText: accumulated }); break;
            case "content_block_start": {
              const idx = event.data.index as number;
              blocks[idx] = createBlockFromStart(event.data);
              patchStreamState(convId, { streamingBlocks: [...blocks], streamStage: null }, true); break;
            }
            case "content_block_delta": {
              const idx = event.data.index as number;
              const updated = applyBlockDelta(blocks, idx, event.data.delta as Record<string, unknown>);
              updated.forEach((b, i) => { blocks[i] = b; });
              patchStreamState(convId, { streamingBlocks: [...blocks] }); break;
            }
            case "content_block_stop": {
              const idx = event.data.index as number;
              const finalized = finalizeBlock(blocks, idx, event.data);
              finalized.forEach((b, i) => { blocks[i] = b; });
              patchStreamState(convId, { streamingBlocks: [...blocks] }, true); break;
            }
            case "round_start":
              patchStreamState(convId, { currentRound: event.data.round as number, maxRounds: event.data.max_rounds as number }, true); break;
            case "done":
              finalMessageId = event.data.message_id as number;
              finalMetadata = (event.data.metadata as Record<string, unknown>) ?? {};
              if (event.data.token_usage) {
                const tu = event.data.token_usage as Record<string, number>;
                patchStreamState(convId, { tokenUsage: { input: tu.input_tokens || 0, output: tu.output_tokens || 0, used: tu.estimated_context_used || 0, limit: tu.context_limit || 32000 } }, true);
              }
              break;
            case "error":
              patchStreamState(convId, { streamError: { type: (event.data.error_type as string) || "unknown", message: (event.data.message as string) || "未知错误" } }, true); break;
          }
        }
        if (finalMessageId) {
          const finalBlocks = blocks.length > 0 ? blocks : undefined;
          const finalContent = finalBlocks ? blocksToPlainText(finalBlocks) : accumulated;
          get().updateMessage(convId, {
            id: finalMessageId, role: "assistant",
            content: finalContent || accumulated, content_blocks: finalBlocks,
            created_at: new Date().toISOString(), metadata: finalMetadata,
          });
          const msgs = get().messagesMap.get(convId) ?? [];
          if (msgs.filter((m) => m.role === "user").length <= 1) {
            get().updateConvTitle(convId, `[文件] ${file.name}`.slice(0, 60));
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          if (accumulated) {
            get().appendOptimisticMessage(convId, {
              id: Date.now(), role: "assistant",
              content: accumulated + "\n\n[已停止生成]", created_at: new Date().toISOString(),
            });
          }
        } else {
          set((s) => {
            const next = new Map(s.messagesMap);
            next.set(convId, (next.get(convId) ?? []).filter((m) => m.id !== tempId));
            return { messagesMap: next };
          });
        }
      } finally {
        patchStreamState(convId, {
          isSending: false, isFileUpload: false, streamingText: "", streamingBlocks: [],
          streamStage: null, abortController: null, currentRound: 0, maxRounds: 0,
        }, true);
      }
      return;
    }

    // SSE 流式路径
    const tempId = Date.now();
    const kbIdx = content.indexOf("\n\n[知识引用:");
    const displayContent = (kbIdx > 0 ? content.slice(0, kbIdx) : content).trim() || content;
    get().appendOptimisticMessage(convId, {
      id: tempId, role: "user", content: displayContent, created_at: new Date().toISOString(),
    });

    const abort = new AbortController();
    patchStreamState(convId, {
      isSending: true, isFileUpload: false, streamingText: "", streamingBlocks: [],
      streamStage: null, abortController: abort, currentRound: 0, maxRounds: 0,
      streamError: null, tokenUsage: null,
    }, true);

    let accumulated = "";
    let finalMessageId: number | null = null;
    let finalMetadata: Record<string, unknown> = {};
    const blocks: ContentBlock[] = [];

    try {
      for await (const event of streamChat(convId, content, {
        signal: abort.signal,
        activeSkillIds: opts?.activeSkillIds,
        toolId: opts?.toolId,
        forceSkillId: opts?.forceSkillId,
      })) {
        switch (event.type) {
          case "status": patchStreamState(convId, { streamStage: event.data.stage as string }, true); break;
          case "delta":
            accumulated += event.data.text as string;
            patchStreamState(convId, { streamingText: accumulated, streamStage: null }); break;
          case "replace":
            accumulated = event.data.text as string;
            patchStreamState(convId, { streamingText: accumulated }); break;
          case "content_block_start": {
            const idx = event.data.index as number;
            blocks[idx] = createBlockFromStart(event.data);
            patchStreamState(convId, { streamingBlocks: [...blocks], streamStage: null }, true); break;
          }
          case "content_block_delta": {
            const idx = event.data.index as number;
            const updated = applyBlockDelta(blocks, idx, event.data.delta as Record<string, unknown>);
            updated.forEach((b, i) => { blocks[i] = b; });
            patchStreamState(convId, { streamingBlocks: [...blocks] }); break;
          }
          case "content_block_stop": {
            const idx = event.data.index as number;
            const finalized = finalizeBlock(blocks, idx, event.data);
            finalized.forEach((b, i) => { blocks[i] = b; });
            patchStreamState(convId, { streamingBlocks: [...blocks] }, true); break;
          }
          case "round_start":
            patchStreamState(convId, { currentRound: event.data.round as number, maxRounds: event.data.max_rounds as number }, true); break;
          case "tool_progress": {
            const tpIdx = event.data.index as number;
            if (tpIdx !== undefined && blocks[tpIdx]) {
              const updated = applyBlockDelta(blocks, tpIdx, event.data);
              updated.forEach((b, i) => { blocks[i] = b; });
              patchStreamState(convId, { streamingBlocks: [...blocks] });
            }
            break;
          }
          case "round_end": break;
          case "pev_start": patchStreamState(convId, { streamStage: "pev_start" }, true); break;
          case "pev_plan_ready": {
            const steps = event.data.steps as Array<{ step_key: string; description: string }> | undefined;
            const planText = steps ? steps.map((s, i) => `${i + 1}. ${s.description || s.step_key}`).join("\n") : "";
            accumulated = `**执行计划（${event.data.step_count ?? 0} 步）**\n\n${planText}`;
            patchStreamState(convId, { streamingText: accumulated, streamStage: null }, true); break;
          }
          case "pev_step_start":
            patchStreamState(convId, { streamStage: `executing:${(event.data.description as string) || (event.data.step_key as string)}` }, true); break;
          case "pev_step_retry":
            patchStreamState(convId, { streamStage: `retrying:${event.data.step_key}` }, true); break;
          case "pev_step_result": break;
          case "pev_replan": patchStreamState(convId, { streamStage: "replanning" }, true); break;
          case "pev_done": {
            const summary = (event.data.summary as string) || "";
            if (summary) { accumulated = summary; patchStreamState(convId, { streamingText: accumulated, streamStage: null }, true); }
            break;
          }
          case "pev_error":
            patchStreamState(convId, { streamError: { type: "server_error", message: (event.data.message as string) || "任务执行失败" } }, true); break;
          case "done":
            finalMessageId = event.data.message_id as number;
            finalMetadata = (event.data.metadata as Record<string, unknown>) ?? {};
            if (event.data.token_usage) {
              const tu = event.data.token_usage as Record<string, number>;
              patchStreamState(convId, { tokenUsage: { input: tu.input_tokens || 0, output: tu.output_tokens || 0, used: tu.estimated_context_used || 0, limit: tu.context_limit || 32000 } }, true);
            }
            break;
          case "error": {
            const errorType = (event.data.error_type as string) || "unknown";
            if (event.data.retryable) connectionManager.handleStreamError();
            patchStreamState(convId, { streamError: { type: errorType, message: (event.data.message as string) || "未知错误" } }, true);
            console.error("[stream error]", event.data.message);
            break;
          }
        }
      }

      if (finalMessageId) {
        const finalBlocks = blocks.length > 0 ? blocks : undefined;
        const finalContent = finalBlocks ? blocksToPlainText(finalBlocks) : accumulated;
        get().updateMessage(convId, {
          id: finalMessageId, role: "assistant",
          content: finalContent || accumulated, content_blocks: finalBlocks,
          created_at: new Date().toISOString(), metadata: finalMetadata,
        });
        const msgs = get().messagesMap.get(convId) ?? [];
        if (msgs.filter((m) => m.role === "user").length <= 1) {
          get().updateConvTitle(convId, displayContent.slice(0, 60));
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (accumulated) {
          get().appendOptimisticMessage(convId, {
            id: Date.now(), role: "assistant",
            content: accumulated + "\n\n[已停止生成]", created_at: new Date().toISOString(),
          });
        }
      } else {
        set((s) => {
          const next = new Map(s.messagesMap);
          next.set(convId, (next.get(convId) ?? []).filter((m) => m.id !== tempId));
          return { messagesMap: next };
        });
        connectionManager.handleStreamError();
      }
    } finally {
      patchStreamState(convId, {
        isSending: false, isFileUpload: false, streamingText: "", streamingBlocks: [],
        streamStage: null, abortController: null, currentRound: 0, maxRounds: 0,
      }, true);
    }
  },
}));
