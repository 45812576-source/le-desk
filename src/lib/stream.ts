/**
 * SSE streaming client for Le Desk chat.
 *
 * Usage:
 *   for await (const event of streamChat(convId, "hello")) {
 *     if (event.type === "delta") accumulatedText += event.data.text;
 *   }
 */

export type StreamEventType =
  | "status"
  | "delta"
  | "replace"
  | "done"
  | "error"
  | "content_block_start"
  | "content_block_delta"
  | "content_block_stop"
  | "round_start"
  | "tool_progress"
  | "round_end"
  | "pev_start"
  | "pev_plan_ready"
  | "pev_step_start"
  | "pev_step_retry"
  | "pev_step_result"
  | "pev_replan"
  | "pev_done"
  | "pev_error";

export interface StreamEvent {
  type: StreamEventType;
  data: Record<string, unknown>;
}

export interface StreamChatOptions {
  signal?: AbortSignal;
  activeSkillIds?: number[];
  toolId?: number;
  multiFiles?: Record<string, File>;
  forceSkillId?: number;
}

import { dispatchAuthExpired } from "./api";

const API_BASE = "/api/proxy";

export async function* streamChat(
  convId: number,
  content: string,
  options?: StreamChatOptions,
): AsyncGenerator<StreamEvent> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const body: Record<string, unknown> = { content };
  if (options?.activeSkillIds) body.active_skill_ids = options.activeSkillIds;
  if (options?.toolId) body.tool_id = options.toolId;
  if (options?.forceSkillId) body.force_skill_id = options.forceSkillId;

  const resp = await fetch(
    `${API_BASE}/conversations/${convId}/messages/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status === 401) {
      dispatchAuthExpired();
    }
    yield {
      type: "error",
      data: { message: resp.status === 401 ? "登录已过期，请重新登录" : `HTTP ${resp.status}: ${text}`, error_type: resp.status === 401 ? "auth" : "server_error" },
    };
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) {
    yield { type: "error", data: { message: "No response body" } };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "delta";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          yield { type: currentEvent as StreamEventType, data };
        } catch {
          // skip malformed JSON
        }
        currentEvent = "delta"; // reset to default
      }
      // empty lines and comments are ignored
    }
  }
}

/**
 * SSE streaming for file upload — same event format as streamChat.
 */
export async function* streamUpload(
  convId: number,
  files: File | File[],
  message?: string,
  options?: StreamChatOptions,
): AsyncGenerator<StreamEvent> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const form = new FormData();
  // 多文件拼盘（工具 manifest data_source）：每个 key 对应一个文件
  if (options?.multiFiles && Object.keys(options.multiFiles).length > 0) {
    for (const [key, f] of Object.entries(options.multiFiles)) {
      form.append(`file_${key}`, f, f.name);
    }
  } else {
    // 普通上传：支持单文件或多文件，多文件用 file_0, file_1 ... 字段名
    const fileArr = Array.isArray(files) ? files : [files];
    if (fileArr.length === 1) {
      form.append("file", fileArr[0]);
    } else {
      fileArr.forEach((f, i) => form.append(`file_${i}`, f, f.name));
    }
  }
  if (message) form.append("message", message);

  const resp = await fetch(
    `${API_BASE}/conversations/${convId}/messages/upload-stream`,
    {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
      signal: options?.signal,
    },
  );

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    if (resp.status === 401) {
      dispatchAuthExpired();
    }
    yield {
      type: "error",
      data: { message: resp.status === 401 ? "登录已过期，请重新登录" : `HTTP ${resp.status}: ${text}`, error_type: resp.status === 401 ? "auth" : "server_error" },
    };
    return;
  }

  const reader = resp.body?.getReader();
  if (!reader) {
    yield { type: "error", data: { message: "No response body" } };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "delta";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          yield { type: currentEvent as StreamEventType, data };
        } catch {
          // skip malformed JSON
        }
        currentEvent = "delta";
      }
    }
  }
}

// ── Block accumulation helpers ──────────────────────────────────────────────

import type { ContentBlock } from "./types";

export function createBlockFromStart(data: Record<string, unknown>): ContentBlock {
  const type = data.type as string;
  if (type === "tool_call") {
    return {
      type: "tool_call",
      id: String(data.index ?? ""),
      tool: String(data.tool ?? ""),
      input: (data.input as Record<string, unknown>) ?? {},
      status: "running",
    };
  }
  if (type === "thinking") {
    return { type: "thinking", text: "", collapsed: false };
  }
  // default: text block
  return { type: "text", text: "" };
}

export function applyBlockDelta(
  blocks: ContentBlock[],
  index: number,
  delta: Record<string, unknown>,
): ContentBlock[] {
  return blocks.map((b, i) => {
    if (i !== index) return b;
    if (b.type === "text" && typeof delta.text === "string") {
      return { ...b, text: b.text + delta.text };
    }
    if (b.type === "thinking" && typeof delta.text === "string") {
      return { ...b, text: b.text + delta.text };
    }
    // tool_progress phase update
    if (b.type === "tool_call" && delta.phase) {
      return { ...b, phase: delta.phase as "validating" | "executing" | "completed" };
    }
    return b;
  });
}

export function finalizeBlock(
  blocks: ContentBlock[],
  index: number,
  data: Record<string, unknown>,
): ContentBlock[] {
  return blocks.map((b, i) => {
    if (i !== index) return b;
    if (b.type === "tool_call") {
      return {
        ...b,
        status: data.ok ? ("done" as const) : ("error" as const),
        phase: "completed" as const,
        ...(typeof data.duration_ms === "number" ? { duration_ms: data.duration_ms } : {}),
      };
    }
    return b;
  });
}

export function blocksToPlainText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is ContentBlock => b != null)
    .map((b) => {
      if (b.type === "text") return b.text;
      if (b.type === "thinking") return "";
      // tool_call/tool_result blocks are not plain text
      return "";
    })
    .join("")
    .trim();
}
