"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import { useV2DataAssets } from "../shared/feature-flags";
import { fetchRows, createRow, deleteRow as apiDeleteRow, getExportUrl } from "../shared/api";
import type { TableDetail, TableDetailV2, TableCapabilities } from "../shared/types";
import { formatCellValue, READONLY_COLS } from "../shared";
import EditableCell from "../shared/EditableCell";
import DegradationAlert from "./source/DegradationAlert";

interface SampleStrategy {
  enum_fields: { field: string; covered_values: string[] }[];
  sampled: number;
  max_rows: number;
}

interface SampleResponse {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  sample_strategy: SampleStrategy;
}

type ViewMode = "paged" | "sample";

interface Props {
  detail: TableDetail;
  capabilities?: TableCapabilities;
}

export default function PreviewTab({ detail, capabilities }: Props) {
  const isV2 = useV2DataAssets();
  const [mode, setMode] = useState<ViewMode>("paged");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [strategy, setStrategy] = useState<SampleStrategy | null>(null);

  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 新增行
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [addingRow, setAddingRow] = useState(false);

  const loadSample = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<SampleResponse>(
        `/data/${detail.table_name}/sample?max_rows=200`
      );
      setCols(data.columns ?? []);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setStrategy(data.sample_strategy ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [detail.table_name]);

  const loadPaged = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchRows(detail.table_name, page, pageSize);
      setCols(data.columns ?? []);
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setStrategy(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [detail.table_name, page, pageSize]);

  useEffect(() => {
    if (mode === "sample") {
      loadSample();
    } else {
      loadPaged();
    }
  }, [mode, loadSample, loadPaged]);

  const visibleCols = cols;
  const isEditable = capabilities?.can_edit_rows ?? (detail.fields.length > 0 || detail.table_name.startsWith("usr_"));
  const hasRoleGroups = detail.role_groups && detail.role_groups.length > 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleCellSave(rowId: number, col: string, value: string) {
    try {
      await apiFetch(`/data/${detail.table_name}/rows/${rowId}`, {
        method: "PUT",
        body: JSON.stringify({ data: { [col]: value || null } }),
      });
      setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, [col]: value } : r));
    } catch { /* silently ignore */ }
  }

  async function handleAddRow() {
    setAddingRow(true);
    try {
      await createRow(detail.table_name, newRowData);
      setShowAddRow(false);
      setNewRowData({});
      // 刷新当前页
      if (mode === "paged") loadPaged(); else loadSample();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "新增失败");
    } finally {
      setAddingRow(false);
    }
  }

  async function handleDeleteRow(rowId: number) {
    if (!confirm("确认删除该行？")) return;
    try {
      await apiDeleteRow(detail.table_name, rowId);
      setRows((prev) => prev.filter((r) => r.id !== rowId));
      setTotal((prev) => prev - 1);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  function handleExport(format: "csv" | "excel" | "json") {
    window.open(getExportUrl(detail.table_name, format), "_blank");
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-[10px] font-bold text-[#00A3C4] animate-pulse">Loading...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-32 text-[10px] font-bold text-red-500">{error}</div>;
  }

  // 无权限且非空表时显示拒绝提示
  if (rows.length === 0 && total === 0 && detail.record_count && detail.record_count > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <div className="text-[10px] font-bold text-red-500">您无权查看此表数据</div>
        <div className="text-[8px] text-gray-400">表中有 {detail.record_count} 条记录，但当前权限不允许查看</div>
      </div>
    );
  }

  // 编辑行中可编辑的列（排除系统列）
  const editableCols = visibleCols.filter((c) => !READONLY_COLS.has(c));

  // 采样说明
  const enumFieldCount = strategy?.enum_fields?.length ?? 0;
  const enumCoveredCount = strategy?.enum_fields?.reduce((sum, ef) => sum + ef.covered_values.length, 0) ?? 0;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* V2: 降级告警 */}
      {isV2 && <DegradationAlert profile={(detail as TableDetailV2).source_profile} />}

      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#EBF4F7] border-b border-gray-200 text-[8px] flex-shrink-0">
        {/* 模式切换 */}
        <div className="flex border border-gray-300 rounded overflow-hidden">
          <button
            onClick={() => { setMode("paged"); setPage(1); }}
            className={`px-2 py-0.5 text-[8px] font-bold ${mode === "paged" ? "bg-[#00A3C4] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            分页
          </button>
          <button
            onClick={() => setMode("sample")}
            className={`px-2 py-0.5 text-[8px] font-bold ${mode === "sample" ? "bg-[#00A3C4] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            采样
          </button>
        </div>

        <span className="text-[#1A202C] font-bold">共 {total.toLocaleString()} 条</span>

        {mode === "sample" && (
          <>
            <span className="text-gray-400">·</span>
            <span className="text-gray-400">展示 {rows.length} 条采样</span>
            {enumFieldCount > 0 && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-gray-400">{enumFieldCount} 个枚举字段覆盖 {enumCoveredCount} 种值</span>
              </>
            )}
          </>
        )}

        {mode === "paged" && (
          <>
            <span className="text-gray-400">·</span>
            <span className="text-gray-400">第 {page}/{totalPages} 页</span>
          </>
        )}

        {hasRoleGroups && (
          <>
            <span className="text-gray-400">·</span>
            <span className="text-gray-400">可见 {visibleCols.length} 列</span>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          {/* 新增行 */}
          {capabilities?.can_edit_rows && (
            <PixelButton size="sm" onClick={() => setShowAddRow(true)}>+ 新增行</PixelButton>
          )}
          {/* 刷新 */}
          <PixelButton size="sm" variant="secondary" onClick={() => { if (mode === "paged") loadPaged(); else loadSample(); }}>
            刷新
          </PixelButton>
          {/* 导出 */}
          {capabilities?.can_export && (
            <div className="relative group">
              <PixelButton size="sm" variant="secondary">导出 ▾</PixelButton>
              <div className="hidden group-hover:block absolute right-0 top-full z-20 bg-white border-2 border-[#1A202C] shadow-md min-w-[80px]">
                <button onClick={() => handleExport("csv")} className="block w-full text-left px-3 py-1.5 text-[9px] hover:bg-[#F0F4F8]">CSV</button>
                <button onClick={() => handleExport("excel")} className="block w-full text-left px-3 py-1.5 text-[9px] hover:bg-[#F0F4F8]">Excel</button>
                <button onClick={() => handleExport("json")} className="block w-full text-left px-3 py-1.5 text-[9px] hover:bg-[#F0F4F8]">JSON</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 新增行表单 */}
      {showAddRow && (
        <div className="px-3 py-2 bg-[#F0FBFF] border-b border-[#00D1FF] flex-shrink-0">
          <div className="text-[9px] font-bold text-[#00A3C4] mb-2">新增行</div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            {editableCols.map((col) => (
              <div key={col}>
                <label className="block text-[8px] text-gray-500 font-bold mb-0.5">{col}</label>
                <input
                  value={newRowData[col] || ""}
                  onChange={(e) => setNewRowData((prev) => ({ ...prev, [col]: e.target.value }))}
                  className="w-full border border-border px-1.5 py-0.5 text-[9px] bg-background focus:outline-none focus:border-[#00D1FF]"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <PixelButton size="sm" onClick={handleAddRow} disabled={addingRow}>
              {addingRow ? "添加中..." : "确认添加"}
            </PixelButton>
            <PixelButton size="sm" variant="secondary" onClick={() => { setShowAddRow(false); setNewRowData({}); }}>取消</PixelButton>
          </div>
        </div>
      )}

      {/* 数据表格 */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="text-[9px]" style={{ minWidth: "100%" }}>
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#EBF4F7]">
              {visibleCols.map((c) => (
                <th key={c} className="text-left px-3 py-2 font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C] border-r border-gray-200 whitespace-nowrap">
                  {c}
                </th>
              ))}
              {capabilities?.can_edit_rows && (
                <th className="text-center px-2 py-2 font-bold text-[#00A3C4] border-b-2 border-[#1A202C] whitespace-nowrap w-12">操作</th>
              )}
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
                {capabilities?.can_edit_rows && (
                  <td className="text-center px-2 py-1.5">
                    {row.id != null && (
                      <button
                        onClick={() => handleDeleteRow(row.id as number)}
                        className="text-[8px] text-muted-foreground hover:text-red-500 transition-colors"
                        title="删除行"
                      >
                        删除
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + (capabilities?.can_edit_rows ? 1 : 0)} className="text-center py-8 text-[10px] text-gray-400 uppercase tracking-widest">
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页器 */}
      {mode === "paged" && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 border-t border-gray-200 bg-[#F8FBFD] flex-shrink-0">
          <PixelButton size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            ← 上一页
          </PixelButton>
          <span className="text-[9px] font-bold text-gray-500">
            {page} / {totalPages}
          </span>
          <PixelButton size="sm" variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            下一页 →
          </PixelButton>
        </div>
      )}
    </div>
  );
}
