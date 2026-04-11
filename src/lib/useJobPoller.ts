"use client";

import { useCallback, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { isTerminalJobStatus } from "@/lib/job-status";

export interface JobStatus {
  job_id: number;
  status: string;      // queued | running | success | partial_success | failed
  stage?: string;      // bitable sync 阶段
  phase?: string;      // knowledge import 阶段
  error?: string;
  error_type?: string;
  result?: Record<string, unknown>;
  stats?: Record<string, unknown>;
}

/**
 * 通用 job 轮询 hook。
 * @param endpoint  轮询的 GET 端点前缀，如 "/business-tables/sync-bitable/jobs"
 * @param interval  轮询间隔 ms，默认 1500
 */
export function useJobPoller(endpoint: string, interval = 1500) {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPolling(false);
  }, []);

  const startPolling = useCallback(
    (jobId: number) => {
      stopPolling();
      setPolling(true);
      setJobStatus(null);

      const poll = async () => {
        try {
          const data = await apiFetch<JobStatus>(`${endpoint}/${jobId}`);
          setJobStatus(data);
          if (isTerminalJobStatus(data.status)) {
            stopPolling();
          }
        } catch {
          // 网络抖动时不中断轮询
        }
      };

      // 立即查一次
      poll();
      timerRef.current = setInterval(poll, interval);
    },
    [endpoint, interval, stopPolling],
  );

  return { jobStatus, polling, startPolling, stopPolling };
}
