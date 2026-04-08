"use client";

import React, { useState, useEffect } from "react";
import type { LogicalViewRun } from "../../shared/types";
import { fetchLogicalViewRuns } from "../../shared/api";

interface Props {
  tableId: number;
}

export default function LogicalViewWorkbench({ tableId }: Props) {
  const [runs, setRuns] = useState<LogicalViewRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchLogicalViewRuns(tableId);
        if (!cancelled) setRuns(data);
      } catch {
        if (!cancelled) setRuns([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tableId]);

  if (loading) {
    return <div className="p-4 text-[9px] text-gray-400 animate-pulse">加载逻辑视图运行记录...</div>;
  }

  if (runs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[10px] text-gray-400 uppercase tracking-widest">
        暂无逻辑视图运行记录
      </div>
    );
  }

  const STATUS_COLORS: Record<string, string> = {
    success: "text-green-500",
    failed: "text-red-500",
    running: "text-[#00A3C4] animate-pulse",
  };

  return (
    <div>
      <div className="flex items-center px-4 py-2 border-b-2 border-[#1A202C] bg-[#EBF4F7]">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
          逻辑视图运行 ({runs.length})
        </span>
      </div>
      {runs.map((run) => (
        <div key={run.id}>
          <div
            className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 hover:bg-[#F0FBFF] transition-colors cursor-pointer"
            onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
          >
            <span className={`text-[9px] font-bold ${STATUS_COLORS[run.status] || "text-gray-400"}`}>
              {run.status}
            </span>
            <span className="text-[9px] font-bold flex-1">{run.view_name}</span>
            <span className="text-[8px] text-gray-400">{run.triggered_by}</span>
            {run.row_count !== null && (
              <span className="text-[8px] text-gray-400">{run.row_count} 行</span>
            )}
            {run.duration_ms !== null && (
              <span className="text-[8px] text-gray-400">{run.duration_ms}ms</span>
            )}
            <span className="text-[8px] text-gray-400 font-mono">
              {new Date(run.created_at).toLocaleString("zh-CN")}
            </span>
          </div>
          {expandedId === run.id && (
            <div className="px-4 py-2 bg-[#F0F4F8] border-b border-gray-200 text-[8px] text-gray-500">
              <div>视图 ID: {run.view_id}</div>
              <div>触发来源: {run.triggered_by}</div>
              <div>行数: {run.row_count ?? "未知"}</div>
              <div>耗时: {run.duration_ms !== null ? `${run.duration_ms}ms` : "未知"}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
