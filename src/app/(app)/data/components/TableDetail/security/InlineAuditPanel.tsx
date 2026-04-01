"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface AuditEntry {
  id: number;
  action: string;
  actor_name: string;
  entity_type: string;
  entity_id: number;
  changes: Record<string, { old: unknown; new: unknown }>;
  risk_level: "low" | "medium" | "high" | null;
  created_at: string;
}

interface Props {
  tableId: number;
}

const ACTION_LABELS: Record<string, string> = {
  create_policy: "创建策略",
  update_policy: "更新策略",
  delete_policy: "删除策略",
  update_field_tags: "更新字段标签",
  update_protection: "更新小样本保护",
  create_role_group: "创建角色组",
  update_role_group: "更新角色组",
  rollback_policy: "回滚策略",
  create_grant: "创建授权",
  update_grant: "更新授权",
};

const RISK_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-600",
  medium: "bg-yellow-50 text-yellow-600",
  low: "bg-green-50 text-green-600",
};

export default function InlineAuditPanel({ tableId }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<{ items: AuditEntry[] }>(`/data-assets/tables/${tableId}/audit-log`)
      .then((d) => setEntries(d.items))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [tableId]);

  if (loading) {
    return (
      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">审计日志</div>
        <div className="text-[9px] text-gray-400 animate-pulse">加载中...</div>
      </div>
    );
  }

  const filtered = filter ? entries.filter((e) => e.action === filter) : entries;
  const actions = [...new Set(entries.map((e) => e.action))];

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">审计日志</div>
        <span className="text-[8px] text-gray-300">{entries.length} 条</span>
        {actions.length > 1 && (
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-[8px] border border-gray-300 rounded px-1 py-0.5 ml-auto"
          >
            <option value="">全部</option>
            {actions.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
            ))}
          </select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-[8px] text-gray-400">暂无审计记录</div>
      ) : (
        <div className="space-y-0 max-h-64 overflow-y-auto">
          {filtered.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="border-b border-gray-100 last:border-0">
                <div
                  className="flex items-center gap-2 py-1.5 px-1 cursor-pointer hover:bg-[#F0FBFF] transition-colors text-[9px]"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <span className="font-bold">{ACTION_LABELS[entry.action] || entry.action}</span>
                  <span className="text-gray-400">{entry.actor_name}</span>
                  {entry.risk_level && (
                    <span className={`text-[7px] font-bold px-1 py-px rounded ${RISK_STYLES[entry.risk_level] || ""}`}>
                      {entry.risk_level}
                    </span>
                  )}
                  <span className="text-[8px] text-gray-300 ml-auto flex-shrink-0">
                    {new Date(entry.created_at).toLocaleString("zh-CN")}
                  </span>
                </div>
                {isExpanded && entry.changes && Object.keys(entry.changes).length > 0 && (
                  <div className="px-1 pb-2 ml-2 border-l-2 border-gray-200 pl-2">
                    {Object.entries(entry.changes).map(([key, { old: oldVal, new: newVal }]) => (
                      <div key={key} className="flex items-center gap-2 text-[8px] py-0.5">
                        <span className="text-gray-400 w-24">{key}</span>
                        <span className="text-red-400 line-through">{JSON.stringify(oldVal)}</span>
                        <span className="text-gray-300">→</span>
                        <span className="text-green-500">{JSON.stringify(newVal)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
