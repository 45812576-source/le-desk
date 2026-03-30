"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { TableDetail } from "../shared/types";
import { formatCellValue, READONLY_COLS } from "../shared";
import EditableCell from "../shared/EditableCell";

interface Props {
  detail: TableDetail;
}

export default function PreviewTab({ detail }: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<{ columns: string[]; rows: Record<string, unknown>[] }>(
        `/data/${detail.table_name}/rows?page=1&page_size=100`
      );
      setCols(data.columns ?? []);
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [detail.table_name]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const hidden = detail.access_policy.hidden_fields;
  const visibleCols = cols.filter((c) => !hidden.includes(c));
  const isEditable = detail.fields.length > 0 || detail.table_name.startsWith("usr_");

  async function handleCellSave(rowId: number, col: string, value: string) {
    try {
      await apiFetch(`/data/${detail.table_name}/rows/${rowId}`, {
        method: "PUT",
        body: JSON.stringify({ data: { [col]: value || null } }),
      });
      setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, [col]: value } : r));
    } catch { /* silently ignore */ }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-[10px] font-bold text-[#00A3C4] animate-pulse">Loading...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-[10px] font-bold text-red-500">{error}</div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <table className="text-[9px]" style={{ minWidth: "100%" }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#EBF4F7]">
            {visibleCols.map((c) => (
              <th key={c} className="text-left px-3 py-2 font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C] border-r border-gray-200 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FBFD]"}`}>
              {visibleCols.map((c) => (
                <td key={c} className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap max-w-[240px] truncate" title={formatCellValue(row[c])}>
                  <EditableCell
                    value={row[c]}
                    readOnly={!isEditable || READONLY_COLS.has(c)}
                    onSave={(v) => row.id && handleCellSave(row.id as number, c, v)}
                  />
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={visibleCols.length} className="text-center py-8 text-[10px] text-gray-400 uppercase tracking-widest">
                暂无数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
