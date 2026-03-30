"use client";

import React, { useMemo, useState } from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import type { DataAssetTable } from "./shared/types";

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  lark_bitable: { label: "飞书", color: "bg-blue-50 text-blue-600 border-blue-200" },
  mysql: { label: "MySQL", color: "bg-orange-50 text-orange-600 border-orange-200" },
  imported: { label: "导入", color: "bg-green-50 text-green-600 border-green-200" },
  blank: { label: "手动", color: "bg-gray-50 text-gray-500 border-gray-200" },
};

const SYNC_STATUS: Record<string, { label: string; color: string }> = {
  idle: { label: "空闲", color: "text-gray-400" },
  syncing: { label: "同步中", color: "text-[#00A3C4] animate-pulse" },
  success: { label: "已同步", color: "text-green-500" },
  partial_success: { label: "部分同步", color: "text-yellow-500" },
  failed: { label: "同步失败", color: "text-red-500" },
  disabled: { label: "已禁用", color: "text-gray-400" },
};

interface Props {
  tables: DataAssetTable[];
  selectedTableId: number | null;
  onSelectTable: (id: number) => void;
  loading: boolean;
}

export default function AssetList({ tables, selectedTableId, onSelectTable, loading }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search.toLowerCase();
    return tables.filter((t) =>
      t.display_name.toLowerCase().includes(q) ||
      t.table_name.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q)
    );
  }, [tables, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 border-b-2 border-[#1A202C] flex-shrink-0 flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] flex-shrink-0">数据表</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索..."
          className="flex-1 text-[10px] border border-gray-300 px-2 py-0.5 focus:outline-none focus:border-[#00D1FF] bg-white"
        />
        <span className="text-[9px] text-gray-400 flex-shrink-0">{filtered.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-gray-400 uppercase tracking-widest">
            {tables.length === 0 ? "暂无数据表" : "无匹配结果"}
          </div>
        ) : (
          filtered.map((t) => {
            const src = SOURCE_LABELS[t.source_type] || SOURCE_LABELS.blank;
            const sync = SYNC_STATUS[t.sync_status] || SYNC_STATUS.idle;
            const hasWarnings = t.risk_warnings.length > 0;
            const isSelected = selectedTableId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => onSelectTable(t.id)}
                className={`px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-[#F0FBFF] transition-colors ${
                  isSelected ? "bg-[#CCF2FF] border-l-2 border-l-[#00D1FF]" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold truncate flex-1">{t.display_name}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-px border rounded ${src.color}`}>{src.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[8px] text-gray-400">
                  <span>{t.field_count} 字段</span>
                  {t.record_count !== null && <span>{t.record_count} 行</span>}
                  {t.bound_skills.length > 0 && (
                    <span className="text-[#00A3C4]">{t.bound_skills.length} Skill</span>
                  )}
                  {t.source_type !== "blank" && (
                    <span className={sync.color}>{sync.label}</span>
                  )}
                  {hasWarnings && (
                    <span className="text-yellow-500" title={t.risk_warnings.map((w) => w.message).join("; ")}>⚠ {t.risk_warnings.length}</span>
                  )}
                </div>
                <p className="text-[8px] text-gray-400 font-mono mt-0.5 truncate">{t.table_name}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
