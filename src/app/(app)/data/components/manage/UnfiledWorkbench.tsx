"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { DataAssetFolder } from "../shared/types";

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
  const [tables, setTables] = useState<UnfiledTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [targetFolderId, setTargetFolderId] = useState<number | null>(null);

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
    if (selected.size === tables.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tables.map((t) => t.id)));
    }
  }

  const [suggestions, setSuggestions] = useState<Record<number, { folder_id: number; folder_name: string; reason: string }>>({});

  // 加载分类建议
  useEffect(() => {
    apiFetch<{ suggestions: { table_id: number; suggested_folder_id: number; suggested_folder_name: string; reason: string }[] }>("/data-assets/unfiled/classify-suggestions")
      .then((d) => {
        const map: typeof suggestions = {};
        for (const s of d.suggestions) {
          map[s.table_id] = { folder_id: s.suggested_folder_id, folder_name: s.suggested_folder_name, reason: s.reason };
        }
        setSuggestions(map);
      })
      .catch(() => {});
  }, [tables.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleBatchClassify() {
    if (selected.size === 0 || !targetFolderId) return;
    try {
      const resp = await apiFetch<{ results: { table_id: number; success: boolean; error?: string }[] }>("/data-assets/batch-classify", {
        method: "POST",
        body: JSON.stringify({ table_ids: [...selected], folder_id: targetFolderId }),
      });
      // 显示冲突结果
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
      {/* 操作栏 */}
      <div className="px-4 py-2 border-b-2 border-[#1A202C] flex items-center gap-2 flex-shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
          未归档 ({tables.length})
        </span>
        <div className="flex-1" />
        {selected.size > 0 && (
          <>
            <span className="text-[9px] text-gray-400">已选 {selected.size}</span>
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
        <input type="checkbox" checked={selected.size === tables.length} onChange={toggleAll} className="w-3 h-3" />
        <span className="flex-1">数据表</span>
        <span className="w-14">来源</span>
        <span className="w-14 text-right">字段</span>
        <span className="w-14 text-right">行数</span>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto">
        {tables.map((t) => (
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
              {suggestions[t.id] && (
                <div className="text-[7px] text-green-600 mt-0.5">
                  建议归入: {suggestions[t.id].folder_name} — {suggestions[t.id].reason}
                </div>
              )}
            </div>
            <span className="text-[8px] text-gray-400 w-14">{SOURCE_LABELS[t.source_type] || t.source_type}</span>
            <span className="text-[8px] text-gray-400 w-14 text-right">{t.field_count}</span>
            <span className="text-[8px] text-gray-400 w-14 text-right">{t.record_count ?? "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
