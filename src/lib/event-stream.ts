"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface EventStreamEvent {
  id: number;
  event_type: string;
  source_type: string;
  source_id: number | null;
  payload: Record<string, unknown>;
  user_id: number | null;
  project_id: number | null;
  created_at: string | null;
}

interface UseEventStreamParams {
  project_id?: number;
  enabled?: boolean;
}

export function useEventStream({ project_id, enabled = true }: UseEventStreamParams) {
  const [events, setEvents] = useState<EventStreamEvent[]>([]);
  const lastIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    if (project_id) params.set("project_id", String(project_id));
    if (lastIdRef.current) params.set("since", String(lastIdRef.current));

    (async () => {
      try {
        const resp = await fetch(`/api/proxy/events/stream?${params}`, {
          signal: controller.signal,
          headers: { "Accept": "text/event-stream" },
        });
        if (!resp.ok || !resp.body) return;

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentData = "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              currentData = line.slice(6);
            } else if (line === "" && currentData) {
              try {
                const ev = JSON.parse(currentData) as EventStreamEvent;
                if (ev.id > lastIdRef.current) {
                  lastIdRef.current = ev.id;
                  setEvents((prev) => [...prev.slice(-99), ev]);
                }
              } catch {
                // skip malformed
              }
              currentData = "";
            }
          }
        }
      } catch {
        // connection closed or aborted
      }
    })();

    return () => {
      controller.abort();
    };
  }, [project_id, enabled]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, clearEvents };
}
