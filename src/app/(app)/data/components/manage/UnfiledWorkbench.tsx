"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { DataAssetFolder } from "../shared/types";
import { useV2DataAssets } from "../shared/feature-flags";
import GovernanceProgress from "../GovernanceProgress";

interface UnfiledTable {
  id: number;
  table_name: string;
  display_name: string;
  description: string | null;
  source_type: string;
  field_count: number;
  record_count: number | null;
  created_at: string | null;
}

// V2: 缺失项标签
type MissingTag = "no_folder" | "no_sensitivity" | "no_permission" | "no_description" | "no_field_confirm" | "stale_sync";
const MISSING_TAG_LABELS: Record<MissingTag, { label: string; color: string }> = {
  no_folder: { label: "未归档", color: "bg-red-50 text-red-500" },
  no_sensitivity: { label: "未分级", color: "bg-orange-50 text-orange-500" },
  no_permission: { label: "无权限", color: "bg-yellow-50 text-yellow-600" },
  no_description: { label: "无描述", color: "bg-gray-100 text-gray-500" },
  no_field_confirm: { label: "字段未确认", color: "bg-blue-50 text-blue-500" },
  stale_sync: { label: "同步过期", color: "bg-purple-50 text-purple-500" },
};

const SOURCE_LABELS: Record<string, string> = {
  lark_bitable: "飞书",
  mysql: "MySQL",
  imported: "导入",
  blank: "手动",
};

interface Props {
  folders: DataAssetFolder[];
  onClassified: () => void;
}

export default function UnfiledWorkbench({ folders, onClassified }: Props) {
  const isV2 = useV2DataAssets();
  const [tables, setTables] = useState<UnfiledTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);
  const [filterTag, setFilterTag] = useState<MissingTag | null>(null);

  const fetchUnfiled = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: UnfiledTable[] }>("/data-assets/unfiled");
      setTables(data.items);
    } catch {
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUnfiled(); }, [fetchUnfiled]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const visible = filteredTables.map((t) => t.id);
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible));
    }
  }

  const [suggestions, setSuggestions] = useState<Record<number, { folder_id: number; folder_name: string; reason: string; confidence?: number }>>({});

  useEffect(() => {
    apiFetch<{ suggestions: { table_id: number; suggested_folder_id: number; suggested_folder_name: string; reason: string; confidence?: number }[] }>("/data-assets/unfiled/classify-suggestions")
      .then((d) => {
        const map: typeof suggestions = {};
        for (const s of d.suggestions) {
          map[s.table_id] = { folder_id: s.suggested_folder_id, folder_name: s.suggested_folder_name, reason: s.reason, confidence: s.confidence };
        }
        setSuggestions(map);
      })
      .catch(() => {});
  }, [tables.length]);

  // V2: 计算缺失项标签
  function getMissingTags(t: UnfiledTable): MissingTag[] {
    const tags: MissingTag[] = ["no_folder"]; // 未归档表必定有此标签
    if (!t.description) tags.push("no_description");
    return tags;
  }

  // V2: 按缺失项筛选
  const filteredTables = useMemo(() => {
    if (!isV2 || !filterTag) return tables;
    return tables.filter((t) => getMissingTags(t).includes(filterTag));
  }, [tables, filterTag, isV2]);

  async function handleBatchClassify() {
    if (selected.size === 0 || !targetFolderId) return;
    try {
      const resp = await apiFetch<{ results: { table_id: number; success: boolean; error?: string }[] }>("/data-assets/batch-classify", {
        method: "POST",
        body: JSON.stringify({ table_ids: [...selected], folder_id: targetFolderId }),
      });
      const failures = resp.results.filter((r) => !r.success);
      if (failures.length > 0) {
        alert(`${failures.length} 个表归档失败:\n${failures.map((f) => f.error).join("\n")}`);
      }
      setSelected(new Set());
      fetchUnfiled();
      onClassified();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "分类失败");
    }
  }

  // V2: 批量接受建议
  async function handleBatchAcceptSuggestions() {
    const toAccept = [...selected].filter((id) => suggestions[id]);
    if (toAccept.length === 0) {
      alert("选中的表中没有分类建议");
      return;
    }
    try {
      for (const id of toAccept) {
        const sug = suggestions[id];
        await apiFetch("/data-assets/batch-classify", {
          method: "POST",
          body: JSON.stringify({ table_ids: [id], folder_id: sug.folder_id }),
        });
      }
      setSelected(new Set());
      fetchUnfiled();
      onClassified();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "批量接受失败");
    }
  }

  function flattenFolders(folders: DataAssetFolder[], depth = 0): { id: number; name: string; depth: number }[] {
    const result: { id: number; name: string; depth: number }[] = [];
    for (const f of folders) {
      result.push({ id: f.id, name: f.name, depth });
      result.push(...flattenFolders(f.children, depth + 1));
    }
    return result;
  }

  const flatFolders = flattenFolders(folders);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
        Loading...
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-gray-400 uppercase tracking-widest">
        所有数据表已归档
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* V2: 治理进度 */}
      {isV2 && (
        <GovernanceProgress
          totalTables={tables.length + flatFolders.length * 2} // 粗略估计
          filedCount={flatFolders.length * 2} // 粗略估计
          withPermissions={0}
        />
      )}

      {/* 操作栏 */}
      <div className="px-4 py-2 border-b-2 border-[#1A202C] flex items-center gap-2 flex-shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
          未归档 ({filteredTables.length})
        </span>

        {/* V2: 缺失项筛选 */}
        {isV2 && (
          <div className="flex items-center gap-1 ml-2">
            {(Object.entries(MISSING_TAG_LABELS) as [MissingTag, { label: string; color: string }][]).slice(0, 4).map(([tag, info]) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`text-[7px] font-bold px-1.5 py-0.5 border rounded transition-colors ${
                  filterTag === tag ? `${info.color} border-current` : "border-gray-200 text-gray-400"
                }`}
              >
                {info.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />
        {selected.size > 0 && (
          <>
            <span className="text-[9px] text-gray-400">已选 {selected.size}</span>
            {isV2 && (
              <PixelButton size="sm" variant="secondary" onClick={handleBatchAcceptSuggestions}>
                接受建议
              </PixelButton>
            )}
            <select
              value={targetFolderId ?? ""}
              onChange={(e) => setTargetFolderId(e.target.value ? Number(e.target.value) : null)}
              className="text-[9px] border border-gray-300 px-1 py-0.5 bg-white"
            >
              <option value="">选择目标目录</option>
              {flatFolders.map((f) => (
                <option key={f.id} value={f.id}>{"　".repeat(f.depth)}{f.name}</option>
              ))}
            </select>
            <PixelButton size="sm" onClick={handleBatchClassify} disabled={!targetFolderId}>
              批量归档
            </PixelButton>
          </>
        )}
      </div>

      {/* 表头 */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#EBF4F7] border-b border-gray-200 text-[8px] font-bold uppercase tracking-widest text-gray-400 flex-shrink-0">
        <input type="checkbox" checked={selected.size === filteredTables.length && filteredTables.length > 0} onChange={toggleAll} className="w-3 h-3" />
        <span className="flex-1">数据表</span>
        {isV2 && <span className="w-28">缺失项</span>}
        <span className="w-14">来源</span>
        <span className="w-14 text-right">字段</span>
        <span className="w-14 text-right">行数</span>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredTables.map((t) => {
          const missingTags = isV2 ? getMissingTags(t) : [];
          const sug = suggestions[t.id];

          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-4 py-2 border-b border-gray-100 hover:bg-[#F0FBFF] transition-colors cursor-pointer ${
                selected.has(t.id) ? "bg-[#F0FBFF]" : ""
              }`}
              onClick={() => toggleSelect(t.id)}
            >
              <input
                type="checkbox"
                checked={selected.has(t.id)}
                onChange={() => toggleSelect(t.id)}
                onClick={(e) => e.stopPropagation()}
                className="w-3 h-3 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold truncate">{t.display_name}</div>
                <div className="text-[8px] text-gray-400 font-mono truncate">{t.table_name}</div>
                {sug && (
                  <div className="text-[7px] text-green-600 mt-0.5">
                    建议归入: {sug.folder_name}
                    {isV2 && sug.confidence !== undefined && (
                      <span className="text-gray-400 ml-1">置信度 {Math.round(sug.confidence * 100)}%</span>
                    )}
                    {" — "}{sug.reason}
                  </div>
                )}
              </div>

              {/* V2: 缺失项标签 */}
              {isV2 && (
                <div className="w-28 flex flex-wrap gap-0.5 flex-shrink-0">
                  {missingTags.map((tag) => {
                    const info = MISSING_TAG_LABELS[tag];
                    return (
                      <span key={tag} className={`text-[6px] font-bold px-1 py-px rounded ${info.color}`}>
                        {info.label}
                      </span>
                    );
                  })}
                </div>
              )}

              <span className="text-[8px] text-gray-400 w-14">{SOURCE_LABELS[t.source_type] || t.source_type}</span>
              <span className="text-[8px] text-gray-400 w-14 text-right">{t.field_count}</span>
              <span className="text-[8px] text-gray-400 w-14 text-right">{t.record_count ?? "-"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
