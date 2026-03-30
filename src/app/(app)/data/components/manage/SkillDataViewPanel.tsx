"use client";

import React, { useState } from "react";
import { SkillDataView, ViewFilter, OP_LABELS } from "../shared/types";

export default function SkillDataViewPanel({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tableId,
  columns,
  filterableColumns,
  referencedSkills,
  views,
  onSave,
}: {
  tableId: number;
  columns: string[];
  filterableColumns?: string[];
  referencedSkills: string[];
  views: SkillDataView[];
  onSave: (views: SkillDataView[]) => void;
}) {
  const [expandedViewId, setExpandedViewId] = useState<string | null>(null);
  const [addingForSkill, setAddingForSkill] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState("");

  function addView(skillName: string) {
    if (!newViewName.trim()) return;
    const newView: SkillDataView = {
      view_id: `sdv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      view_name: newViewName.trim(),
      skill_id: 0,
      skill_name: skillName,
      allowed_fields: [...columns],
      row_filters: [],
    };
    onSave([...views, newView]);
    setAddingForSkill(null);
    setNewViewName("");
    setExpandedViewId(newView.view_id);
  }

  function deleteView(viewId: string) {
    if (!confirm("确认删除此数据视图？")) return;
    onSave(views.filter((v) => v.view_id !== viewId));
    if (expandedViewId === viewId) setExpandedViewId(null);
  }

  function updateView(viewId: string, patch: Partial<SkillDataView>) {
    onSave(views.map((v) => v.view_id === viewId ? { ...v, ...patch } : v));
  }

  function toggleField(viewId: string, field: string) {
    const view = views.find((v) => v.view_id === viewId);
    if (!view) return;
    const next = view.allowed_fields.includes(field)
      ? view.allowed_fields.filter((f) => f !== field)
      : [...view.allowed_fields, field];
    updateView(viewId, { allowed_fields: next });
  }

  function addFilter(viewId: string) {
    const view = views.find((v) => v.view_id === viewId);
    if (!view) return;
    const defaultField = (filterableColumns ?? columns)[0] ?? "";
    updateView(viewId, {
      row_filters: [...view.row_filters, { field: defaultField, op: "eq", value: "" }],
    });
  }

  function updateFilter(viewId: string, idx: number, patch: Partial<ViewFilter>) {
    const view = views.find((v) => v.view_id === viewId);
    if (!view) return;
    const filters = view.row_filters.map((f, i) => i === idx ? { ...f, ...patch } : f);
    updateView(viewId, { row_filters: filters });
  }

  function removeFilter(viewId: string, idx: number) {
    const view = views.find((v) => v.view_id === viewId);
    if (!view) return;
    updateView(viewId, { row_filters: view.row_filters.filter((_, i) => i !== idx) });
  }

  // Group views by skill
  const viewsBySkill: Record<string, SkillDataView[]> = {};
  for (const v of views) {
    (viewsBySkill[v.skill_name] ??= []).push(v);
  }

  return (
    <div className="px-5 py-3 border-b border-gray-200 flex-shrink-0">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">— Skill 数据视图</div>
      <div className="text-[8px] text-gray-400 mb-3">每个视图限定 Skill 可使用的字段和行范围（白名单模式）</div>

      {referencedSkills.length === 0 && views.length === 0 ? (
        <span className="text-[9px] text-gray-400">暂无 Skill 引用此表</span>
      ) : (
        <div className="space-y-3">
          {referencedSkills.map((skillName) => {
            const skillViews = viewsBySkill[skillName] ?? [];
            return (
              <div key={skillName} className="border-2 border-gray-200">
                <div className="px-3 py-2 bg-[#EBF4F7] border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold">{skillName}</span>
                    <span className="text-[8px] text-gray-400">{skillViews.length} 个视图</span>
                  </div>
                  <button
                    onClick={() => { setAddingForSkill(skillName); setNewViewName(""); }}
                    className="text-[9px] font-bold text-[#00A3C4] hover:text-[#008BA3]"
                  >
                    + 新增视图
                  </button>
                </div>

                {addingForSkill === skillName && (
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 bg-[#F0FBFF]">
                    <input
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addView(skillName); if (e.key === "Escape") setAddingForSkill(null); }}
                      placeholder="视图名称，如「客户基本信息」"
                      autoFocus
                      className="flex-1 border border-[#00D1FF] text-[10px] px-2 py-1 focus:outline-none"
                    />
                    <button onClick={() => addView(skillName)} className="text-[9px] font-bold text-[#00A3C4]">✓</button>
                    <button onClick={() => setAddingForSkill(null)} className="text-[9px] text-gray-400">✕</button>
                  </div>
                )}

                {skillViews.length === 0 && addingForSkill !== skillName && (
                  <div className="px-3 py-2 text-[9px] text-gray-400">
                    未配置视图，该 Skill 无法使用此表数据
                  </div>
                )}

                {skillViews.map((sv) => {
                  const isExpanded = expandedViewId === sv.view_id;
                  return (
                    <div key={sv.view_id} className="border-b border-gray-100 last:border-0">
                      <div
                        className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[#F8FBFD]"
                        onClick={() => setExpandedViewId(isExpanded ? null : sv.view_id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-gray-400">{isExpanded ? "▾" : "▸"}</span>
                          <span className="text-[10px] font-bold">{sv.view_name}</span>
                          <span className="text-[8px] text-gray-400">
                            {sv.allowed_fields.length}/{columns.length} 列
                            {sv.row_filters.length > 0 && ` · ${sv.row_filters.length} 筛选`}
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteView(sv.view_id); }}
                          className="text-[9px] text-gray-300 hover:text-red-400"
                        >✕</button>
                      </div>

                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-3 bg-[#FAFCFD]">
                          <div>
                            <div className="text-[9px] font-bold text-gray-500 mb-1.5">允许使用的列</div>
                            <div className="flex flex-wrap gap-1">
                              {columns.map((col) => {
                                const allowed = sv.allowed_fields.includes(col);
                                return (
                                  <button
                                    key={col}
                                    onClick={() => toggleField(sv.view_id, col)}
                                    className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                                      allowed
                                        ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                                        : "border-gray-200 text-gray-300 bg-gray-50"
                                    }`}
                                  >
                                    {allowed ? "✓ " : ""}{col}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 mt-1">
                              <button
                                onClick={() => updateView(sv.view_id, { allowed_fields: [...columns] })}
                                className="text-[8px] text-[#00A3C4] hover:underline"
                              >全选</button>
                              <button
                                onClick={() => updateView(sv.view_id, { allowed_fields: [] })}
                                className="text-[8px] text-gray-400 hover:underline"
                              >全不选</button>
                            </div>
                          </div>

                          <div>
                            <div className="text-[9px] font-bold text-gray-500 mb-1.5">行级筛选条件</div>
                            {sv.row_filters.map((f, i) => (
                              <div key={i} className="flex items-center gap-2 mb-1">
                                <select
                                  value={f.field}
                                  onChange={(e) => updateFilter(sv.view_id, i, { field: e.target.value })}
                                  className="border border-gray-200 text-[9px] px-1.5 py-0.5 bg-white focus:outline-none focus:border-[#00D1FF]"
                                >
                                  {(filterableColumns ?? columns).map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select
                                  value={f.op}
                                  onChange={(e) => updateFilter(sv.view_id, i, { op: e.target.value as ViewFilter["op"] })}
                                  className="border border-gray-200 text-[9px] px-1.5 py-0.5 bg-white focus:outline-none focus:border-[#00D1FF]"
                                >
                                  {Object.entries(OP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                                <input
                                  value={f.value}
                                  onChange={(e) => updateFilter(sv.view_id, i, { value: e.target.value })}
                                  placeholder="值"
                                  className="border border-gray-200 text-[9px] px-1.5 py-0.5 focus:outline-none focus:border-[#00D1FF] w-28"
                                />
                                <button
                                  onClick={() => removeFilter(sv.view_id, i)}
                                  className="text-[9px] text-gray-300 hover:text-red-400"
                                >✕</button>
                              </div>
                            ))}
                            <button
                              onClick={() => addFilter(sv.view_id)}
                              className="text-[9px] font-bold text-[#00A3C4] hover:text-[#008BA3]"
                            >+ 添加条件</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Views for skills no longer referenced */}
          {Object.keys(viewsBySkill)
            .filter((sk) => !referencedSkills.includes(sk))
            .map((skillName) => (
              <div key={skillName} className="border-2 border-gray-200 opacity-60">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500">{skillName}</span>
                  <span className="text-[8px] text-red-400">（已取消引用）</span>
                </div>
                {(viewsBySkill[skillName] ?? []).map((sv) => (
                  <div key={sv.view_id} className="px-3 py-1.5 flex items-center justify-between border-b border-gray-100 last:border-0">
                    <span className="text-[10px] text-gray-500">{sv.view_name}</span>
                    <button
                      onClick={() => deleteView(sv.view_id)}
                      className="text-[9px] text-gray-300 hover:text-red-400"
                    >✕</button>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
