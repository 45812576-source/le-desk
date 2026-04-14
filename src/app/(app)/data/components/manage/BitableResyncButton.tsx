"use client";

import React, { useEffect, useState } from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import { useJobPoller } from "@/lib/useJobPoller";
import { BusinessTable } from "../shared/types";

const STAGE_LABELS: Record<string, string> = {
  queued: "排队中",
  fetch_fields: "读取字段中",
  fetch_records: "拉取记录中",
  create_table: "创建本地表中",
  insert_records: "写入记录中",
  register: "注册表信息",
  done: "完成",
  failed: "失败",
};

export default function BitableResyncButton({ table, onDone }: { table: BusinessTable; onDone: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [syncStage, setSyncStage] = useState("");

  const { jobStatus, startPolling } = useJobPoller("/business-tables/sync-bitable/jobs");

  useEffect(() => {
    if (!jobStatus) return;
    const timer = window.setTimeout(() => {
      const label = STAGE_LABELS[jobStatus.stage || ""] || jobStatus.stage || "";
      setSyncStage(label);

      if (jobStatus.status === "success") {
        setSyncing(false);
        setSyncStage("");
        const inserted = (jobStatus.stats as Record<string, unknown>)?.inserted ?? "?";
        const degraded = (jobStatus.stats as Record<string, unknown>)?.degraded;
        const pageSize = (jobStatus.stats as Record<string, unknown>)?.effective_page_size;
        const degradedMsg = degraded ? `（降级到 ${pageSize}）` : "";
        setMsg(`✓ ${inserted} 条${degradedMsg}`);
        onDone();
      } else if (jobStatus.status === "partial_success") {
        setSyncing(false);
        setSyncStage("");
        setMsg("⚠ 部分同步成功，数据不完整，请重试");
      } else if (jobStatus.status === "failed") {
        setSyncing(false);
        setSyncStage("");
        setMsg(`${label || "同步"}失败: ${jobStatus.error || "未知错误"}`);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [jobStatus, onDone]);

  async function handleResync() {
    setSyncing(true);
    setMsg("");
    setSyncStage("提交任务中");

    try {
      const res = await apiFetch<{ job_id: number }>("/business-tables/sync-bitable/jobs", {
        method: "POST",
        body: JSON.stringify({
          app_token: table.validation_rules.bitable_app_token,
          table_id: table.validation_rules.bitable_table_id,
          display_name: table.display_name,
          sync_table_name: table.table_name,
        }),
      });
      startPolling(res.job_id);
    } catch (e: unknown) {
      setSyncStage("");
      setSyncing(false);
      if (e instanceof Error) {
        try {
          const errData = JSON.parse(e.message);
          setMsg(`${errData.stage || "同步"}失败: ${errData.error}`);
        } catch {
          setMsg(e.message);
        }
      } else {
        setMsg("同步失败");
      }
    }
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <PixelBadge color="cyan">飞书 Bitable</PixelBadge>
      <button
        onClick={handleResync}
        disabled={syncing}
        className="px-2 py-0.5 border-2 border-[#00A3C4] text-[#00A3C4] text-[8px] font-bold uppercase hover:bg-[#00A3C4] hover:text-white transition-colors disabled:opacity-40"
      >
        {syncing ? (syncStage || "同步中...") : "⟳ 重新同步"}
      </button>
      {msg && <span className={`text-[9px] font-bold ${msg.startsWith("✓") ? "text-green-600" : msg.startsWith("⚠") ? "text-amber-600" : "text-red-500"}`}>{msg}</span>}
    </div>
  );
}
