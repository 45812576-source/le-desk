"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import { useV2DataAssets } from "../shared/feature-flags";
import { fetchRows, createRow, deleteRow as apiDeleteRow } from "../shared/api";
import type { TableDetail, TableDetailV2, TableCapabilities } from "../shared/types";
import { formatCellValue, READONLY_COLS } from "../shared";
import EditableCell from "../shared/EditableCell";
import DegradationAlert from "./source/DegradationAlert";
import { normalizeFieldType } from "../shared/value-normalization";

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

interface PreviewDiagnostic {
  tone: "green" | "yellow" | "red" | "gray";
  title: string;
  detail: string;
  action: string;
}

function buildPreviewDiagnostics(params: {
  detail: TableDetail;
  mode: ViewMode;
  rowsCount: number;
  total: number;
  error: string;
  notice: string;
}): PreviewDiagnostic[] {
  const { detail, mode, rowsCount, total, error, notice } = params;
  const diagnostics: PreviewDiagnostic[] = [];

  if (error) {
    diagnostics.push({
      tone: "red",
      title: "预览数据读取失败",
      detail: error,
      action: mode === "paged" ? "先切到采样模式确认是否至少能看到样例数据。" : "先确认数据源同步，再回到分页模式检查正式取数链路。",
    });
  }

  if (notice) {
    diagnostics.push({
      tone: "yellow",
      title: "当前为降级展示",
      detail: notice,
      action: "可以先用当前结果判断字段覆盖情况，再补查分页接口或同步链路。",
    });
  }

  if (detail.source_type !== "blank" && (detail.sync_status === "failed" || detail.sync_error)) {
    diagnostics.push({
      tone: "red",
      title: "数据源同步异常",
      detail: detail.sync_error || "最近一次同步失败，当前预览可能拿到的是旧数据或空结果。",
      action: "重新同步并检查数据源授权、链接有效性和工作表选择。",
    });
  }

  if (detail.record_count === 0) {
    diagnostics.push({
      tone: "gray",
      title: "当前表为空",
      detail: "源表当前没有可展示记录，因此预览区不会返回行数据。",
      action: "确认源表是否为空，或切换到正确的工作表后重新同步。",
    });
  } else if (detail.record_count !== null && detail.record_count > 0 && rowsCount === 0 && total === 0) {
    diagnostics.push({
      tone: "yellow",
      title: "表里登记有数据，但预览没取回来",
      detail: `登记记录数为 ${detail.record_count}，但当前 ${mode === "paged" ? "分页接口" : "采样接口"} 没有返回可展示行。`,
      action: "优先检查 /data 读取链路、数据同步状态，以及是否同步到了正确表名。",
    });
  } else if (rowsCount > 0) {
    diagnostics.push({
      tone: "green",
      title: "预览可用",
      detail: `当前显示 ${rowsCount} 条${mode === "sample" ? "采样" : "分页"}数据，可继续判断字段和样例是否符合 Skill 需求。`,
      action: mode === "sample" ? "如果要验证真实分页效果，可切回分页模式。" : "如果要更快扫样例，可切到采样模式。",
    });
  }

  if (detail.views.length === 0) {
    diagnostics.push({
      tone: "gray",
      title: "还没有可复用视图",
      detail: "即使数据已可见，Skill 编辑人仍需要自己理解整表字段范围。",
      action: "补一个按场景划分的视图，让后续挂载直接复用。",
    });
  }

  return diagnostics;
}

function DiagnosticCard({ item }: { item: PreviewDiagnostic }) {
  const style =
    item.tone === "green"
      ? "border-green-200 bg-green-50"
      : item.tone === "yellow"
        ? "border-yellow-200 bg-yellow-50"
        : item.tone === "red"
          ? "border-red-200 bg-red-50"
          : "border-gray-200 bg-gray-50";

  return (
    <div className={`border px-3 py-2 ${style}`}>
      <div className="text-[9px] font-bold text-[#1A202C]">{item.title}</div>
      <div className="text-[8px] text-gray-600 mt-0.5">{item.detail}</div>
      <div className="text-[8px] text-gray-500 mt-1">下一步：{item.action}</div>
    </div>
  );
}

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
  const [notice, setNotice] = useState("");
  const [total, setTotal] = useState(0);
  const [strategy, setStrategy] = useState<SampleStrategy | null>(null);

  // 分页状态
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // 新增行
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [addingRow, setAddingRow] = useState(false);

  const fetchSampleData = useCallback(async () => {
    const data = await apiFetch<SampleResponse>(`/data/${encodeURIComponent(detail.table_name)}/sample?max_rows=200`);
    return {
      columns: data.columns ?? [],
      rows: data.rows ?? [],
      total: data.total ?? 0,
      sampleStrategy: data.sample_strategy ?? null,
    };
  }, [detail.table_name]);

  const loadSample = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchSampleData();
      setCols(data.columns);
      setRows(data.rows);
      setTotal(data.total);
      setStrategy(data.sampleStrategy);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [fetchSampleData]);

  const loadPaged = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchRows(detail.table_name, page, pageSize);
      const nextCols = data.columns ?? [];
      const nextRows = data.rows ?? [];
      const nextTotal = data.total ?? 0;
      if (nextRows.length === 0 && nextTotal === 0) {
        try {
          const sample = await fetchSampleData();
          if (sample.rows.length > 0) {
            setCols(sample.columns);
            setRows(sample.rows);
            setTotal(Math.max(detail.record_count ?? 0, sample.total, sample.rows.length));
            setStrategy(sample.sampleStrategy);
            setNotice("分页接口未返回数据，已自动降级显示采样结果。");
            return;
          }
          if (sample.total > 0) {
            setCols(sample.columns);
            setRows([]);
            setTotal(sample.total);
            setStrategy(sample.sampleStrategy);
            setNotice("表内存在数据，但采样接口未返回可展示行；请检查后端数据读取链路。");
            return;
          }
        } catch {
          if ((detail.record_count ?? 0) > 0) {
            setNotice("表内存在数据，但分页接口未返回结果；请检查后端数据读取链路。");
          }
        }
      }
      setCols(nextCols);
      setRows(nextRows);
      setTotal(nextTotal);
      setStrategy(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [detail.record_count, detail.table_name, fetchSampleData, page, pageSize]);

  const triggerResync = useCallback(async () => {
    try {
      await apiFetch(`/data-assets/tables/${detail.id}/sync`, { method: "POST" });
      if (mode === "paged") {
        await loadPaged();
      } else {
        await loadSample();
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "重试同步失败");
    }
  }, [detail.id, loadPaged, loadSample, mode]);

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
  const diagnostics = buildPreviewDiagnostics({
    detail,
    mode,
    rowsCount: rows.length,
    total,
    error,
    notice,
  });

  const fieldMetaByColumn = new Map(
    detail.fields.flatMap((field) => {
      const aliases = [field.field_name];
      if (field.physical_column_name) aliases.push(field.physical_column_name);
      return aliases.map((alias) => [
        alias,
        {
          name: alias,
          field_type: normalizeFieldType(field.field_type) || "text",
          options: field.enum_values || [],
          nullable: field.is_nullable,
          comment: field.description || "",
        },
      ] as const);
    })
  );

  async function handleCellSave(rowId: number, col: string, value: unknown) {
    try {
      await apiFetch(`/data/${detail.table_name}/rows/${rowId}`, {
        method: "PUT",
        body: JSON.stringify({ data: { [col]: value ?? null } }),
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

  async function handleExport(format: "csv" | "excel" | "json") {
    try {
      const token = (await import("@/lib/api")).getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/proxy/data/${encodeURIComponent(detail.table_name)}/export?format=${format}`, { headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let message = `导出失败 (${res.status})`;
        if (text) {
          try {
            const json = JSON.parse(text) as { detail?: string; message?: string };
            message = json.detail || json.message || message;
          } catch {
            message = text;
          }
        }
        if (res.status === 401) {
          throw new Error(message || "登录已过期或无导出权限");
        }
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "excel" ? "xlsx" : format;
      a.download = `${detail.display_name || detail.table_name}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "导出失败");
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-[10px] font-bold text-[#00A3C4] animate-pulse">Loading...</div>;
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

      {notice && (
        <div className="px-3 py-1.5 text-[8px] text-yellow-700 bg-yellow-50 border-b border-yellow-200">
          {notice}
        </div>
      )}

      {(error || rows.length === 0 || notice) && (
        <div className="px-3 py-2 border-b border-gray-200 bg-[#FAFCFE] space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">预览诊断</span>
            <span className="text-[8px] text-gray-400">帮助解释为什么现在看不到或只看到部分数据</span>
          </div>
          <div className="space-y-2">
            {diagnostics.map((item) => (
              <DiagnosticCard key={`${item.title}-${item.detail}`} item={item} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <PixelButton size="sm" variant="secondary" onClick={() => { if (mode === "paged") loadPaged(); else loadSample(); }}>
              重新加载
            </PixelButton>
            {detail.source_type !== "blank" && (
              <PixelButton size="sm" variant="secondary" onClick={() => { void triggerResync(); }}>
                重新同步
              </PixelButton>
            )}
            {mode === "paged" && (
              <PixelButton size="sm" variant="secondary" onClick={() => setMode("sample")}>
                切到采样
              </PixelButton>
            )}
          </div>
        </div>
      )}

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
                      fieldMeta={fieldMetaByColumn.get(c)}
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
                <td colSpan={Math.max(1, visibleCols.length + (capabilities?.can_edit_rows ? 1 : 0))} className="text-center py-8 text-[10px] text-gray-400 uppercase tracking-widest">
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
