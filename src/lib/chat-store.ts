"use client";

import { create } from "zustand";
import { apiFetch } from "./api";
import { streamChat, streamUpload, createBlockFromStart, applyBlockDelta, finalizeBlock, blocksToPlainText } from "./stream";
import { connectionManager } from "./connection";
import type { ContentBlock, Conversation, Message } from "./types";

interface ChatStore {
  // Conversations
  conversations: Conversation[];
  activeConvId: number | null;

  // Messages: keyed by conv id
  messagesMap: Map<number, Message[]>;

  // Streaming state
  streamingBlocks: ContentBlock[];
  streamingText: string;
  streamStage: string | null;
  isSending: boolean;
  isFileUpload: boolean;
  abortController: AbortController | null;

  // Agent Loop state
  currentRound: number;
  maxRounds: number;

  // Error state
  streamError: { type: string; message: string } | null;

  // Token usage
  tokenUsage: { input: number; output: number; used: number; limit: number } | null;

  // Actions
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
    }
  ) => Promise<void>;
  stopGeneration: () => void;
  appendOptimisticMessage: (convId: number, msg: Message) => void;
  updateMessage: (convId: number, msg: Message) => void;
  updateConvTitle: (convId: number, title: string) => void;
  clearStreamError: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  activeConvId: null,
  messagesMap: new Map(),
  streamingBlocks: [],
  streamingText: "",
  streamStage: null,
  isSending: false,
  isFileUpload: false,
  abortController: null,
  currentRound: 0,
  maxRounds: 0,
  streamError: null,
  tokenUsage: null,

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
    if (cached) return; // already loaded
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
    // Persist to backend (fire-and-forget)
    apiFetch(`/conversations/${convId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }).catch(() => {});
  },

  clearStreamError() {
    set({ streamError: null });
  },

  stopGeneration() {
    get().abortController?.abort();
  },

  async sendMessage(convId, content, opts) {
    if (get().isSending) return;

    const file = opts?.file;

    // 文件上传走流式路径
    if (file) {
      const optimisticContent = content ? `${content}\n\n[文件: ${file.name}]` : `[文件: ${file.name}]`;
      const tempId = Date.now();
      get().appendOptimisticMessage(convId, {
        id: tempId,
        role: "user",
        content: optimisticContent,
        created_at: new Date().toISOString(),
      });

      const abort = new AbortController();
      set({
        isSending: true,
        isFileUpload: true,
        streamError: null,
        streamingText: "",
        streamingBlocks: [],
        streamStage: null,
        abortController: abort,
        currentRound: 0,
        maxRounds: 0,
        tokenUsage: null,
      });

      let accumulated = "";
      let finalMessageId: number | null = null;
      let finalMetadata: Record<string, unknown> = {};
      const blocks: ContentBlock[] = [];

      try {
        for await (const event of streamUpload(convId, file, content || undefined, {
          signal: abort.signal,
        })) {
          switch (event.type) {
            case "status":
              set({ streamStage: event.data.stage as string });
              break;
            case "delta":
              accumulated += event.data.text as string;
              set({ streamingText: accumulated, streamStage: null });
              break;
            case "replace":
              accumulated = event.data.text as string;
              set({ streamingText: accumulated });
              break;
            case "content_block_start": {
              const idx = event.data.index as number;
              blocks[idx] = createBlockFromStart(event.data);
              set({ streamingBlocks: [...blocks], streamStage: null });
              break;
            }
            case "content_block_delta": {
              const idx = event.data.index as number;
              const delta = event.data.delta as Record<string, unknown>;
              const updated = applyBlockDelta(blocks, idx, delta);
              updated.forEach((b, i) => { blocks[i] = b; });
              set({ streamingBlocks: [...blocks] });
              break;
            }
            case "content_block_stop": {
              const idx = event.data.index as number;
              const finalized = finalizeBlock(blocks, idx, event.data);
              finalized.forEach((b, i) => { blocks[i] = b; });
              set({ streamingBlocks: [...blocks] });
              break;
            }
            case "round_start":
              set({ currentRound: event.data.round as number, maxRounds: event.data.max_rounds as number });
              break;
            case "done":
              finalMessageId = event.data.message_id as number;
              finalMetadata = (event.data.metadata as Record<string, unknown>) ?? {};
              if (event.data.token_usage) {
                const tu = event.data.token_usage as Record<string, number>;
                set({
                  tokenUsage: {
                    input: tu.input_tokens || 0,
                    output: tu.output_tokens || 0,
                    used: tu.estimated_context_used || 0,
                    limit: tu.context_limit || 32000,
                  },
                });
              }
              break;
            case "error": {
              const errorType = (event.data.error_type as string) || "unknown";
              set({
                streamError: {
                  type: errorType,
                  message: (event.data.message as string) || "未知错误",
                },
              });
              break;
            }
          }
        }

        if (finalMessageId) {
          const finalBlocks = blocks.length > 0 ? blocks : undefined;
          const finalContent = finalBlocks ? blocksToPlainText(finalBlocks) : accumulated;
          get().updateMessage(convId, {
            id: finalMessageId,
            role: "assistant",
            content: finalContent || accumulated,
            content_blocks: finalBlocks,
            created_at: new Date().toISOString(),
            metadata: finalMetadata,
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
              id: Date.now(),
              role: "assistant",
              content: accumulated + "\n\n[已停止生成]",
              created_at: new Date().toISOString(),
            });
          }
        } else {
          set((s) => {
            const next = new Map(s.messagesMap);
            const prev = next.get(convId) ?? [];
            next.set(convId, prev.filter((m) => m.id !== tempId));
            return { messagesMap: next };
          });
        }
      } finally {
        set({
          isSending: false,
          isFileUpload: false,
          streamingText: "",
          streamingBlocks: [],
          streamStage: null,
          abortController: null,
          currentRound: 0,
          maxRounds: 0,
        });
      }
      return;
    }

    // SSE 流式路径
    const tempId = Date.now();
    const kbIdx = content.indexOf("\n\n[知识引用:");
    const displayContent = (kbIdx > 0 ? content.slice(0, kbIdx) : content).trim() || content;
    get().appendOptimisticMessage(convId, {
      id: tempId,
      role: "user",
      content: displayContent,
      created_at: new Date().toISOString(),
    });

    const abort = new AbortController();
    set({
      isSending: true,
      isFileUpload: false,
      streamingText: "",
      streamingBlocks: [],
      streamStage: null,
      abortController: abort,
      currentRound: 0,
      maxRounds: 0,
      streamError: null,
      tokenUsage: null,
    });

    let accumulated = "";
    let finalMessageId: number | null = null;
    let finalMetadata: Record<string, unknown> = {};
    const blocks: ContentBlock[] = [];

    try {
      for await (const event of streamChat(convId, content, {
        signal: abort.signal,
        activeSkillIds: opts?.activeSkillIds,
        toolId: opts?.toolId,
      })) {
        switch (event.type) {
          case "status":
            set({ streamStage: event.data.stage as string });
            break;

          case "delta":
            accumulated += event.data.text as string;
            set({ streamingText: accumulated, streamStage: null });
            break;

          case "replace":
            accumulated = event.data.text as string;
            set({ streamingText: accumulated });
            break;

          case "content_block_start": {
            const idx = event.data.index as number;
            blocks[idx] = createBlockFromStart(event.data);
            set({ streamingBlocks: [...blocks], streamStage: null });
            break;
          }

          case "content_block_delta": {
            const idx = event.data.index as number;
            const delta = event.data.delta as Record<string, unknown>;
            const updated = applyBlockDelta(blocks, idx, delta);
            updated.forEach((b, i) => { blocks[i] = b; });
            set({ streamingBlocks: [...blocks] });
            break;
          }

          case "content_block_stop": {
            const idx = event.data.index as number;
            const finalized = finalizeBlock(blocks, idx, event.data);
            finalized.forEach((b, i) => { blocks[i] = b; });
            set({ streamingBlocks: [...blocks] });
            break;
          }

          case "round_start":
            set({
              currentRound: event.data.round as number,
              maxRounds: event.data.max_rounds as number,
            });
            break;

          case "tool_progress":
            // Update tool block progress message (handled via streamingBlocks)
            break;

          case "round_end":
            // Round finished, has_next indicates more rounds coming
            break;

          case "done":
            finalMessageId = event.data.message_id as number;
            finalMetadata = (event.data.metadata as Record<string, unknown>) ?? {};
            if (event.data.token_usage) {
              const tu = event.data.token_usage as Record<string, number>;
              set({
                tokenUsage: {
                  input: tu.input_tokens || 0,
                  output: tu.output_tokens || 0,
                  used: tu.estimated_context_used || 0,
                  limit: tu.context_limit || 32000,
                },
              });
            }
            break;

          case "error": {
            const errorType = (event.data.error_type as string) || "unknown";
            const retryable = event.data.retryable as boolean;
            if (retryable) {
              // Let connectionManager handle retry
              connectionManager.handleStreamError();
            }
            set({
              streamError: {
                type: errorType,
                message: (event.data.message as string) || "未知错误",
              },
            });
            console.error("[stream error]", event.data.message);
            break;
          }
        }
      }

      if (finalMessageId) {
        const finalBlocks = blocks.length > 0 ? blocks : undefined;
        const finalContent = finalBlocks ? blocksToPlainText(finalBlocks) : accumulated;
        const assistantMsg: Message = {
          id: finalMessageId,
          role: "assistant",
          content: finalContent || accumulated,
          content_blocks: finalBlocks,
          created_at: new Date().toISOString(),
          metadata: finalMetadata,
        };
        get().updateMessage(convId, assistantMsg);

        const msgs = get().messagesMap.get(convId) ?? [];
        if (msgs.filter((m) => m.role === "user").length <= 1) {
          get().updateConvTitle(convId, displayContent.slice(0, 60));
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (accumulated) {
          get().appendOptimisticMessage(convId, {
            id: Date.now(),
            role: "assistant",
            content: accumulated + "\n\n[已停止生成]",
            created_at: new Date().toISOString(),
          });
        }
      } else {
        // Remove optimistic message
        set((s) => {
          const next = new Map(s.messagesMap);
          const prev = next.get(convId) ?? [];
          next.set(convId, prev.filter((m) => m.id !== tempId));
          return { messagesMap: next };
        });
        connectionManager.handleStreamError();
      }
    } finally {
      set({
        isSending: false,
        isFileUpload: false,
        streamingText: "",
        streamingBlocks: [],
        streamStage: null,
        abortController: null,
        currentRound: 0,
        maxRounds: 0,
      });
    }
  },
}));
