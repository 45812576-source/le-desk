"use client";

import React, { useState } from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import { BusinessTable } from "../shared/types";

export default function BitableResyncButton({ table, onDone }: { table: BusinessTable; onDone: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");
  const [syncStage, setSyncStage] = useState("");

  async function handleResync() {
    setSyncing(true);
    setMsg("");

    setSyncStage("读取字段中");
    const t1 = setTimeout(() => setSyncStage("拉取记录中"), 1500);
    const t2 = setTimeout(() => setSyncStage("写入记录中"), 4000);

    try {
      const res = await apiFetch<{ ok: boolean; inserted: number; total_fields: number; degraded?: boolean; effective_page_size?: number }>(
        "/business-tables/sync-bitable",
        {
          method: "POST",
          body: JSON.stringify({
            app_token: table.validation_rules.bitable_app_token,
            table_id: table.validation_rules.bitable_table_id,
            display_name: table.display_name,
            sync_table_name: table.table_name,
          }),
        }
      );
      clearTimeout(t1); clearTimeout(t2);
      setSyncStage("");
      const degradedMsg = res.degraded ? `（降级到 ${res.effective_page_size}）` : "";
      setMsg(`✓ ${res.inserted} 条${degradedMsg}`);
      onDone();
    } catch (e: unknown) {
      clearTimeout(t1); clearTimeout(t2);
      setSyncStage("");
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
    } finally {
      setSyncing(false);
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
      {msg && <span className={`text-[9px] font-bold ${msg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{msg}</span>}
    </div>
  );
}
