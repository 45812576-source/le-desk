import { getToken } from "@/lib/api";
import type { SandboxSession } from "@/lib/types";

type SandboxStreamPayload<T> = {
  session?: SandboxSession;
  result?: T;
  status?: number;
  message?: string;
  stage?: string;
  label?: string;
};

export async function consumeSandboxSessionStream<T extends SandboxSession = SandboxSession>(
  path: string,
  options: {
    body?: string;
    onSession?: (session: SandboxSession) => void;
  } = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/json";

  const resp = await fetch(`/api/proxy${path}`, {
    method: "POST",
    headers,
    body: options.body,
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => "");
    let message = `HTTP ${resp.status}`;
    try {
      const json = JSON.parse(text);
      message = json.detail || json.message || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "progress";
  let lastResult: T | null = null;
  let streamError: string | null = null;

  const handlePayload = (event: string, raw: string) => {
    const payload = JSON.parse(raw) as SandboxStreamPayload<T>;
    if (event === "error") {
      streamError = payload.message || "沙盒执行失败";
      return;
    }
    if (payload.session) {
      options.onSession?.(payload.session);
      if (!payload.result) {
        lastResult = payload.session as T;
      }
    }
    if (payload.result) {
      lastResult = payload.result;
    }
  };

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
          handlePayload(currentEvent, line.slice(6));
        } catch {
          // ignore malformed event chunks
        }
        currentEvent = "progress";
      }
    }
  }

  if (streamError) throw new Error(streamError);
  if (!lastResult) throw new Error("沙盒执行流未返回结果");
  return lastResult;
}
