"use client";

import React, { useMemo, useState } from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import type { DataAssetTable, DataAssetTableV2, RiskLevel } from "./shared/types";
import { RISK_LEVEL_COLORS } from "./shared/types";
import { useV2DataAssets } from "./shared/feature-flags";

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

export type AssetFilter = {
  source_type?: string;
  sync_status?: string;
  has_warnings?: boolean;
  has_skill_binding?: boolean;
  risk_level?: RiskLevel;
};

interface Props {
  tables: DataAssetTable[];
  selectedTableId: number | null;
  onSelectTable: (id: number) => void;
  loading: boolean;
  filter?: AssetFilter;
  onFilterChange?: (filter: AssetFilter) => void;
}

export default function AssetList({ tables, selectedTableId, onSelectTable, loading, filter, onFilterChange }: Props) {
  const isV2 = useV2DataAssets();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let result = tables;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) =>
        t.display_name.toLowerCase().includes(q) ||
        t.table_name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    }
    if (filter?.source_type) {
      result = result.filter((t) => t.source_type === filter.source_type);
    }
    if (filter?.sync_status) {
      result = result.filter((t) => t.sync_status === filter.sync_status);
    }
    if (filter?.has_warnings) {
      result = result.filter((t) => t.risk_warnings.length > 0);
    }
    if (filter?.has_skill_binding) {
      result = result.filter((t) => t.bound_skills.length > 0);
    }
    if (filter?.risk_level) {
      result = result.filter((t) => (t as DataAssetTableV2).risk_level === filter.risk_level);
    }
    return result;
  }, [tables, search, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 border-b-2 border-[#1A202C] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] flex-shrink-0">数据表</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索..."
            className="flex-1 text-[10px] border border-gray-300 px-2 py-0.5 focus:outline-none focus:border-[#00D1FF] bg-white"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-[8px] font-bold px-1.5 py-0.5 border transition-colors ${
              showFilters || (filter && Object.values(filter).some(Boolean))
                ? "border-[#00D1FF] text-[#00A3C4] bg-[#F0FBFF]"
                : "border-gray-300 text-gray-400 hover:text-[#1A202C]"
            }`}
          >
            ⫶
          </button>
          <span className="text-[9px] text-gray-400 flex-shrink-0">{filtered.length}</span>
        </div>
        {showFilters && onFilterChange && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(["lark_bitable", "mysql", "imported", "blank"] as const).map((st) => (
              <button
                key={st}
                onClick={() => onFilterChange({ ...filter, source_type: filter?.source_type === st ? undefined : st })}
                className={`text-[8px] font-bold px-1.5 py-0.5 border rounded transition-colors ${
                  filter?.source_type === st ? "border-[#00D1FF] text-[#00A3C4] bg-[#CCF2FF]" : "border-gray-200 text-gray-400"
                }`}
              >
                {SOURCE_LABELS[st]?.label || st}
              </button>
            ))}
            <button
              onClick={() => onFilterChange({ ...filter, has_warnings: !filter?.has_warnings })}
              className={`text-[8px] font-bold px-1.5 py-0.5 border rounded transition-colors ${
                filter?.has_warnings ? "border-yellow-300 text-yellow-600 bg-yellow-50" : "border-gray-200 text-gray-400"
              }`}
            >
              ⚠ 风险
            </button>
            <button
              onClick={() => onFilterChange({ ...filter, has_skill_binding: !filter?.has_skill_binding })}
              className={`text-[8px] font-bold px-1.5 py-0.5 border rounded transition-colors ${
                filter?.has_skill_binding ? "border-[#00D1FF] text-[#00A3C4] bg-[#F0FBFF]" : "border-gray-200 text-gray-400"
              }`}
            >
              Skill 绑定
            </button>
            {isV2 && (["high", "critical"] as RiskLevel[]).map((rl) => (
              <button
                key={rl}
                onClick={() => onFilterChange({ ...filter, risk_level: filter?.risk_level === rl ? undefined : rl })}
                className={`text-[8px] font-bold px-1.5 py-0.5 border rounded transition-colors ${
                  filter?.risk_level === rl ? "border-red-300 text-red-600 bg-red-50" : "border-gray-200 text-gray-400"
                }`}
              >
                {rl === "high" ? "高风险" : "严重"}
              </button>
            ))}
          </div>
        )}
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
            const riskLevel = (t as DataAssetTableV2).risk_level;
            const riskColor = riskLevel ? RISK_LEVEL_COLORS[riskLevel] : null;
            return (
              <div
                key={t.id}
                onClick={() => onSelectTable(t.id)}
                className={`px-3 py-2 border-b border-gray-100 cursor-pointer hover:bg-[#F0FBFF] transition-colors ${
                  isSelected ? "bg-[#CCF2FF] border-l-2 border-l-[#00D1FF]" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isV2 && riskColor && (
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${riskColor}`} title={`风险: ${riskLevel}`} />
                  )}
                  <span className="text-[10px] font-bold truncate flex-1">{t.display_name}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-px border rounded ${src.color}`}>{src.label}</span>
                </div>
                <div className="flex items-center gap-3 text-[8px] text-gray-400">
                  <span>{t.field_count} 字段</span>
                  {t.record_count !== null && <span>{t.record_count} 行</span>}
                  {(t.role_group_count || t.view_count || t.bound_skills.length > 0) && (
                    <span className="text-[#00A3C4]">
                      {[
                        t.role_group_count ? `${t.role_group_count} 角色组` : null,
                        t.view_count ? `${t.view_count} 视图` : null,
                        t.bound_skills.length > 0 ? `${t.bound_skills.length} Skill` : null,
                      ].filter(Boolean).join(" / ")}
                    </span>
                  )}
                  {t.source_type !== "blank" && (
                    <span className={sync.color}>{sync.label}</span>
                  )}
                  {hasWarnings && (
                    <span className="text-yellow-500 flex items-center gap-0.5">
                      {t.risk_warnings.map((w) => {
                        const icons: Record<string, string> = {
                          NO_ACCESS_POLICY: "🔓",
                          SYNC_FAILED: "⚡",
                          PROFILE_PENDING: "⏳",
                          PROFILE_FAILED: "❌",
                          NO_SKILL_VIEW: "🔗",
                        };
                        return (
                          <span
                            key={w.code}
                            title={w.message}
                            className="cursor-help"
                          >
                            {icons[w.code] || "⚠"}
                          </span>
                        );
                      })}
                    </span>
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
