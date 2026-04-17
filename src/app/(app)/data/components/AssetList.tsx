"use client";

import React, { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
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
  ok: { label: "已同步", color: "text-green-500" },
  partial_success: { label: "部分同步", color: "text-yellow-500" },
  failed: { label: "同步失败", color: "text-red-500" },
  disabled: { label: "已禁用", color: "text-gray-400" },
};

interface AvailabilityState {
  key: "sync_issue" | "empty" | "pending_sync" | "review_needed" | "ready";
  label: string;
  tone: string;
  detail: string;
}

function getAvailabilityState(table: DataAssetTable): AvailabilityState {
  if (table.sync_status === "failed") {
    return {
      key: "sync_issue",
      label: "同步异常",
      tone: "border-red-200 bg-red-50 text-red-600",
      detail: "需要先修复同步，再判断这张表是否还能给 Skill 用。",
    };
  }

  if (table.sync_status === "partial_success") {
    return {
      key: "review_needed",
      label: "部分可用",
      tone: "border-yellow-200 bg-yellow-50 text-yellow-700",
      detail: "部分数据可能没同步完整，建议先检查样例预览。",
    };
  }

  if (table.record_count === 0) {
    return {
      key: "empty",
      label: "空表",
      tone: "border-gray-200 bg-gray-50 text-gray-500",
      detail: "当前没有可展示记录，贴给 Skill 编辑人也无法验证字段覆盖情况。",
    };
  }

  if (table.record_count === null && table.source_type !== "blank" && !table.last_synced_at) {
    return {
      key: "pending_sync",
      label: "待同步",
      tone: "border-yellow-200 bg-yellow-50 text-yellow-700",
      detail: "还没完成首次同步，暂时不能确认表里到底有多少数据。",
    };
  }

  if ((table.record_count ?? 0) > 0 && table.sync_status !== "success" && table.sync_status !== "ok" && table.sync_status !== "idle") {
    return {
      key: "review_needed",
      label: "有数据待验证",
      tone: "border-yellow-200 bg-yellow-50 text-yellow-700",
      detail: "登记上有数据，但还需要点进去确认预览链路是否正常。",
    };
  }

  return {
    key: "ready",
    label: "可预览",
    tone: "border-green-200 bg-green-50 text-green-600",
    detail: "可以直接进入详情页看字段、样例和视图范围。",
  };
}

export type AssetFilter = {
  source_type?: string;
  sync_status?: string;
  has_warnings?: boolean;
  has_skill_binding?: boolean;
  risk_level?: RiskLevel;
  availability?: "sync_issue" | "empty" | "pending_sync" | "review_needed" | "ready";
};

interface Props {
  tables: DataAssetTable[];
  selectedTableId: number | null;
  onSelectTable: (id: number) => void;
  onOpenTableTab?: (id: number, tab: "overview" | "preview") => void;
  onTablesChange?: () => void;
  loading: boolean;
  filter?: AssetFilter;
  onFilterChange?: (filter: AssetFilter) => void;
}

export default function AssetList({
  tables,
  selectedTableId,
  onSelectTable,
  onOpenTableTab,
  onTablesChange,
  loading,
  filter,
  onFilterChange,
}: Props) {
  const isV2 = useV2DataAssets();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [syncingTableId, setSyncingTableId] = useState<number | null>(null);

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
    if (filter?.availability) {
      result = result.filter((t) => getAvailabilityState(t).key === filter.availability);
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
            {[
              { key: "sync_issue", label: "同步异常", activeCls: "border-red-300 text-red-600 bg-red-50" },
              { key: "empty", label: "空表", activeCls: "border-gray-300 text-gray-600 bg-gray-50" },
              { key: "pending_sync", label: "待同步", activeCls: "border-yellow-300 text-yellow-700 bg-yellow-50" },
              { key: "ready", label: "可预览", activeCls: "border-green-300 text-green-600 bg-green-50" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => onFilterChange({ ...filter, availability: filter?.availability === item.key ? undefined : item.key as AssetFilter["availability"] })}
                className={`text-[8px] font-bold px-1.5 py-0.5 border rounded transition-colors ${
                  filter?.availability === item.key ? item.activeCls : "border-gray-200 text-gray-400"
                }`}
              >
                {item.label}
              </button>
            ))}
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
            const availability = getAvailabilityState(t);
            const canQuickSync = t.source_type !== "blank" && (availability.key === "sync_issue" || availability.key === "review_needed");
            const canOpenPreview = availability.key === "ready" || (availability.key === "review_needed" && (t.record_count ?? 0) > 0);

            async function handleQuickSync(event: React.MouseEvent<HTMLButtonElement>) {
              event.stopPropagation();
              setSyncingTableId(t.id);
              try {
                await apiFetch(`/data-assets/tables/${t.id}/sync`, { method: "POST" });
                onTablesChange?.();
                onOpenTableTab?.(t.id, "overview");
              } catch {
                onOpenTableTab?.(t.id, "overview");
              } finally {
                setSyncingTableId(null);
              }
            }

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
                  {t.publish_status === "published" && (
                    <span className="text-[7px] font-bold px-1 py-px bg-green-50 text-green-600 border border-green-200 rounded">已发布</span>
                  )}
                  <span className={`text-[8px] font-bold px-1.5 py-px border rounded ${src.color}`}>{src.label}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-px border rounded ${availability.tone}`} title={availability.detail}>
                    {availability.label}
                  </span>
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
                <div className="text-[8px] text-gray-500 mt-1 line-clamp-2">
                  {availability.detail}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-[8px] text-gray-400 font-mono truncate">{t.table_name}</p>
                  {t.last_synced_at && (
                    <span className="text-[7px] text-gray-300">· {new Date(t.last_synced_at).toLocaleString("zh-CN")}</span>
                  )}
                  {t.governance_status && <GovernanceBadge status={t.governance_status} />}
                  <div className="ml-auto flex items-center gap-1">
                    {canOpenPreview && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenTableTab?.(t.id, "preview");
                        }}
                        className="text-[8px] text-[#00CC99] hover:underline"
                      >
                        查看预览
                      </button>
                    )}
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenTableTab?.(t.id, "overview");
                      }}
                      className="text-[8px] text-[#00A3C4] hover:underline"
                    >
                      查看诊断
                    </button>
                    {canQuickSync && (
                      <button
                        onClick={handleQuickSync}
                        disabled={syncingTableId === t.id}
                        className="text-[8px] text-[#00CC99] hover:text-[#00A87A] disabled:text-gray-300"
                      >
                        {syncingTableId === t.id ? "同步中..." : "重新同步"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const GOVERNANCE_BADGE: Record<string, { label: string; cls: string }> = {
  aligned: { label: "已治理", cls: "bg-green-50 text-green-600 border-green-200" },
  suggested: { label: "待审", cls: "bg-yellow-50 text-yellow-600 border-yellow-200" },
  needs_review: { label: "待审", cls: "bg-yellow-50 text-yellow-600 border-yellow-200" },
  ungoverned: { label: "未治理", cls: "bg-gray-50 text-gray-400 border-gray-200" },
};

function GovernanceBadge({ status }: { status: string }) {
  const badge = GOVERNANCE_BADGE[status];
  if (!badge) return null;
  return (
    <span className={`text-[7px] font-bold px-1 py-px border rounded flex-shrink-0 ${badge.cls}`}>
      {badge.label}
    </span>
  );
}
