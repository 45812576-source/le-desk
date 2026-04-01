"use client";

import React, { useState, useEffect } from "react";
import { fetchOutputReviewLogs } from "../../shared/api";
import type { OutputReviewLog, OutputReviewAction } from "../../shared/types";

interface Props {
  tableId: number;
}

const ACTION_STYLES: Record<OutputReviewAction, { label: string; color: string }> = {
  passed: { label: "通过", color: "bg-green-50 text-green-600" },
  blocked: { label: "拦截", color: "bg-red-50 text-red-600" },
  masked: { label: "脱敏", color: "bg-yellow-50 text-yellow-600" },
  flagged: { label: "标记", color: "bg-orange-50 text-orange-600" },
};

export default function OutputReviewPanel({ tableId }: Props) {
  const [logs, setLogs] = useState<OutputReviewLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OutputReviewAction | "">("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    fetchOutputReviewLogs(tableId)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [tableId]);

  if (loading) {
    return (
      <div className="border-2 border-[#1A202C] p-3 mt-4">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">输出审查日志</div>
        <div className="text-[9px] text-gray-400 animate-pulse">加载中...</div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="border-2 border-[#1A202C] p-3 mt-4">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">输出审查日志</div>
        <div className="text-[8px] text-gray-400">暂无审查记录</div>
      </div>
    );
  }

  // 统计
  const stats = {
    passed: logs.filter((l) => l.action === "passed").length,
    blocked: logs.filter((l) => l.action === "blocked").length,
    masked: logs.filter((l) => l.action === "masked").length,
    flagged: logs.filter((l) => l.action === "flagged").length,
  };

  const filtered = filter ? logs.filter((l) => l.action === filter) : logs;

  return (
    <div className="border-2 border-[#1A202C] p-3 mt-4">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">输出审查日志</div>

      {/* 统计条 */}
      <div className="flex items-center gap-2 mb-2">
        {(Object.entries(stats) as [OutputReviewAction, number][]).map(([action, count]) => {
          const style = ACTION_STYLES[action];
          return (
            <button
              key={action}
              onClick={() => setFilter(filter === action ? "" : action)}
              className={`text-[8px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                filter === action ? style.color + " ring-1 ring-current" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
              }`}
            >
              {style.label} {count}
            </button>
          );
        })}
        <span className="text-[8px] text-gray-300 ml-auto">共 {logs.length} 条</span>
      </div>

      {/* 列表 */}
      <div className="space-y-0 max-h-60 overflow-y-auto">
        {filtered.map((log) => {
          const style = ACTION_STYLES[log.action];
          const isExpanded = expandedId === log.id;
          return (
            <div key={log.id} className="border-b border-gray-100 last:border-0">
              <div
                className="flex items-center gap-2 py-1.5 px-1 cursor-pointer hover:bg-[#F0FBFF] transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
              >
                <span className={`text-[7px] font-bold px-1 py-px rounded ${style.color}`}>{style.label}</span>
                <span className="text-[9px] font-bold">{log.skill_name}</span>
                <span className="text-[8px] text-gray-400 truncate flex-1">{log.reason}</span>
                <span className="text-[8px] text-gray-300 flex-shrink-0">
                  {new Date(log.created_at).toLocaleString("zh-CN")}
                </span>
              </div>
              {isExpanded && (
                <div className="px-1 pb-2 text-[8px] text-gray-500">
                  <div className="mb-1"><span className="text-gray-400">原因: </span>{log.reason}</div>
                  {log.fields_involved.length > 0 && (
                    <div>
                      <span className="text-gray-400">涉及字段: </span>
                      {log.fields_involved.map((f) => (
                        <span key={f} className="inline-block mr-1 px-1 py-px bg-gray-50 rounded text-[7px]">{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
