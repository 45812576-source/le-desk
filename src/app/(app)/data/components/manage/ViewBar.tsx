"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { TableView, TableViewConfig, ViewFilter, ViewSort, OP_LABELS } from "../shared/types";

export default function ViewBar({
  tableId,
  cols,
  activeViewId,
  onChangeView,
}: {
  tableId: number;
  cols: string[];
  activeViewId: number | null;
  onChangeView: (viewId: number | null, config: TableViewConfig | null) => void;
}) {
  const [views, setViews] = useState<TableView[]>([]);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [creatingView, setCreatingView] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  const activeView = views.find((v) => v.id === activeViewId) ?? null;
  const defaultConfig: TableViewConfig = { filters: [], sorts: [], group_by: "", hidden_columns: [], column_widths: {} };
  const [localConfigOverride, setLocalConfigOverride] = useState<{ viewId: number | null; config: TableViewConfig } | null>(null);
  const localConfig = localConfigOverride?.viewId === activeViewId
    ? localConfigOverride.config
    : (activeView?.config ?? defaultConfig);

  function setLocalConfig(cfg: TableViewConfig) {
    setLocalConfigOverride({ viewId: activeViewId, config: cfg });
  }

  const loadViews = useCallback(() => {
    apiFetch<TableView[]>(`/business-tables/${tableId}/views`)
      .then(setViews)
      .catch(() => setViews([]));
  }, [tableId]);

  useEffect(() => { loadViews(); }, [loadViews]);

  async function handleCreateView() {
    if (!newViewName.trim()) return;
    try {
      const v = await apiFetch<TableView>(`/business-tables/${tableId}/views`, {
        method: "POST",
        body: JSON.stringify({ name: newViewName.trim(), config: { filters: [], sorts: [], group_by: "", hidden_columns: [], column_widths: {} } }),
      });
      loadViews();
      onChangeView(v.id, v.config);
    } catch { /* ignore */ }
    setCreatingView(false);
    setNewViewName("");
  }

  async function handleDeleteView(viewId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("删除此视图？")) return;
    await apiFetch(`/business-tables/${tableId}/views/${viewId}`, { method: "DELETE" });
    loadViews();
    if (activeViewId === viewId) onChangeView(null, null);
  }

  async function saveConfig(cfg: TableViewConfig) {
    setLocalConfig(cfg);
    onChangeView(activeViewId, cfg);
    if (activeViewId) {
      await apiFetch(`/business-tables/${tableId}/views/${activeViewId}`, {
        method: "PATCH",
        body: JSON.stringify({ config: cfg }),
      });
    }
  }

  function addFilter() {
    const next = { ...localConfig, filters: [...localConfig.filters, { field: cols[0] ?? "", op: "eq" as const, value: "" }] };
    saveConfig(next);
  }
  function updateFilter(i: number, patch: Partial<ViewFilter>) {
    const filters = localConfig.filters.map((f, idx) => idx === i ? { ...f, ...patch } : f);
    saveConfig({ ...localConfig, filters });
  }
  function removeFilter(i: number) {
    saveConfig({ ...localConfig, filters: localConfig.filters.filter((_, idx) => idx !== i) });
  }
  function addSort() {
    const next = { ...localConfig, sorts: [...localConfig.sorts, { field: cols[0] ?? "", dir: "asc" as const }] };
    saveConfig(next);
  }
  function updateSort(i: number, patch: Partial<ViewSort>) {
    const sorts = localConfig.sorts.map((s, idx) => idx === i ? { ...s, ...patch } : s);
    saveConfig({ ...localConfig, sorts });
  }
  function removeSort(i: number) {
    saveConfig({ ...localConfig, sorts: localConfig.sorts.filter((_, idx) => idx !== i) });
  }

  const filterCount = localConfig.filters.length;
  const sortCount = localConfig.sorts.length;

  return (
    <div className="border-b border-gray-200 bg-white flex-shrink-0">
      {/* View tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 overflow-x-auto">
        <button
          onClick={() => onChangeView(null, null)}
          className={`px-2.5 py-1 text-[9px] font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeViewId === null ? "border-[#00A3C4] text-[#00A3C4]" : "border-transparent text-gray-400 hover:text-gray-700"
          }`}
        >
          默认视图
        </button>
        {views.map((v) => (
          <div key={v.id} className="relative group">
            <button
              onClick={() => onChangeView(v.id, v.config)}
              className={`px-2.5 py-1 text-[9px] font-bold border-b-2 transition-colors whitespace-nowrap pr-5 ${
                activeViewId === v.id ? "border-[#00A3C4] text-[#00A3C4]" : "border-transparent text-gray-400 hover:text-gray-700"
              }`}
            >
              {v.name}
            </button>
            <button
              onClick={(e) => handleDeleteView(v.id, e)}
              className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover:block text-[8px] text-gray-300 hover:text-red-400 px-0.5"
            >✕</button>
          </div>
        ))}
        {creatingView ? (
          <div className="flex items-center gap-1">
            <input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateView(); if (e.key === "Escape") setCreatingView(false); }}
              placeholder="视图名称"
              autoFocus
              className="border border-[#00D1FF] text-[9px] px-1.5 py-0.5 focus:outline-none w-24"
            />
            <button onClick={handleCreateView} className="text-[9px] font-bold text-[#00A3C4]">✓</button>
            <button onClick={() => setCreatingView(false)} className="text-[9px] text-gray-400">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setCreatingView(true)}
            className="text-[9px] text-gray-300 hover:text-[#00A3C4] px-1.5 whitespace-nowrap"
          >+ 新建视图</button>
        )}

        {/* Filter / Sort buttons */}
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => { setShowFilterPanel((v) => !v); setShowSortPanel(false); }}
            className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 border transition-colors ${
              showFilterPanel || filterCount > 0
                ? "border-[#00A3C4] text-[#00A3C4] bg-[#EBF4F7]"
                : "border-gray-200 text-gray-400 hover:border-[#00A3C4] hover:text-[#00A3C4]"
            }`}
          >
            筛选{filterCount > 0 && <span className="bg-[#00A3C4] text-white text-[8px] px-1 rounded-sm">{filterCount}</span>}
          </button>
          <button
            onClick={() => { setShowSortPanel((v) => !v); setShowFilterPanel(false); }}
            className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 border transition-colors ${
              showSortPanel || sortCount > 0
                ? "border-[#00A3C4] text-[#00A3C4] bg-[#EBF4F7]"
                : "border-gray-200 text-gray-400 hover:border-[#00A3C4] hover:text-[#00A3C4]"
            }`}
          >
            排序{sortCount > 0 && <span className="bg-[#00A3C4] text-white text-[8px] px-1 rounded-sm">{sortCount}</span>}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilterPanel && (
        <div className="border-t border-gray-100 px-4 py-3 bg-[#FAFCFD] space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">筛选条件</div>
          {localConfig.filters.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={f.field} onChange={(e) => updateFilter(i, { field: e.target.value })}
                className="border border-gray-200 text-[9px] px-1.5 py-0.5 bg-white focus:outline-none focus:border-[#00D1FF]">
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={f.op} onChange={(e) => updateFilter(i, { op: e.target.value as ViewFilter["op"] })}
                className="border border-gray-200 text-[9px] px-1.5 py-0.5 bg-white focus:outline-none focus:border-[#00D1FF]">
                {Object.entries(OP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })}
                placeholder="值"
                className="border border-gray-200 text-[9px] px-1.5 py-0.5 focus:outline-none focus:border-[#00D1FF] w-28" />
              <button onClick={() => removeFilter(i)} className="text-[9px] text-gray-300 hover:text-red-400">✕</button>
            </div>
          ))}
          <button onClick={addFilter} className="text-[9px] font-bold text-[#00A3C4] hover:text-[#008BA3]">+ 添加条件</button>
        </div>
      )}

      {/* Sort panel */}
      {showSortPanel && (
        <div className="border-t border-gray-100 px-4 py-3 bg-[#FAFCFD] space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">排序规则</div>
          {localConfig.sorts.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={s.field} onChange={(e) => updateSort(i, { field: e.target.value })}
                className="border border-gray-200 text-[9px] px-1.5 py-0.5 bg-white focus:outline-none focus:border-[#00D1FF]">
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={s.dir} onChange={(e) => updateSort(i, { dir: e.target.value as "asc" | "desc" })}
                className="border border-gray-200 text-[9px] px-1.5 py-0.5 bg-white focus:outline-none focus:border-[#00D1FF]">
                <option value="asc">升序 ↑</option>
                <option value="desc">降序 ↓</option>
              </select>
              <button onClick={() => removeSort(i)} className="text-[9px] text-gray-300 hover:text-red-400">✕</button>
            </div>
          ))}
          <button onClick={addSort} className="text-[9px] font-bold text-[#00A3C4] hover:text-[#008BA3]">+ 添加排序</button>
        </div>
      )}
    </div>
  );
}
