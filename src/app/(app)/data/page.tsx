"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelIcon, ICONS } from "@/components/pixel";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { useTheme } from "@/lib/theme";
import { Table2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ── Extracted components ──────────────────────────────────────────────────────
import type {
  BusinessTable, Column, Department, FieldMeta, FieldType,
  ScopeValue, AccessScope, SkillDataView, TableViewConfig,
  UserRow, ProjectGroup, VirtualFolder, Tab,
} from "./components/shared/types";
import { FIELD_TYPE_LABELS, READONLY_COLS, formatCellValue } from "./components/shared";
import { ConnectTab } from "./components/connect";
import { ViewBar, AddColumnModal, SkillDataViewPanel, BitableResyncButton, FolderNode, TableRow } from "./components/manage";
import { AccessScopeSelector, ScopeSelector } from "./components/shared";
import EditableCell from "./components/shared/EditableCell";

function ThemedIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.data} size={size} />;
  return <Table2 size={size} className="text-muted-foreground" />;
}

// ── Virtual folder counter ────────────────────────────────────────────────────
let _folderSeq = -1;
function nextLocalId() { return _folderSeq--; }

// ─── Preview panel ────────────────────────────────────────────────────────────
function TablePreview({
  table,
  departments,
  onRename,
  onToggleField,
  onScopeChange,
}: {
  table: BusinessTable;
  departments: Department[];
  onRename: (id: number, name: string) => void;
  onToggleField: (id: number, field: string, hidden: boolean) => void;
  onScopeChange: (id: number, patch: Partial<BusinessTable["validation_rules"]>) => void;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameState, setNameState] = useState({ tableId: table.id, displayName: table.display_name, val: table.display_name });
  if (nameState.tableId !== table.id || nameState.displayName !== table.display_name) {
    setNameState({ tableId: table.id, displayName: table.display_name, val: table.display_name });
  }
  const nameVal = nameState.val;
  const setNameVal = (v: string) => setNameState((prev) => ({ ...prev, val: v }));
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [addingRow, setAddingRow] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, string>>({});
  const [showAddCol, setShowAddCol] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; rowId: number } | null>(null);
  const [activeViewId, setActiveViewId] = useState<number | null>(null);

  const hidden = table.validation_rules?.hidden_fields ?? [];
  const fieldMeta: FieldMeta[] = table.validation_rules?.field_meta ?? [];
  const colScope: ScopeValue = table.validation_rules?.column_scope ?? "private";
  const colDeptIds = table.validation_rules?.column_department_ids ?? [];
  const rowScope: ScopeValue = table.validation_rules?.row_scope ?? "private";
  const rowDeptIds = table.validation_rules?.row_department_ids ?? [];

  const tableAccessScope: AccessScope = (table.validation_rules?.access_scope as AccessScope) ?? "self";
  const tableAccessUserIds: number[] = (table.validation_rules?.access_user_ids as number[]) ?? [];
  const tableAccessRoleIds: string[] = (table.validation_rules?.access_role_ids as string[]) ?? [];
  const tableAccessDeptIds: number[] = (table.validation_rules?.access_department_ids as number[]) ?? [];
  const tableAccessProjectIds: number[] = (table.validation_rules?.access_project_ids as number[]) ?? [];

  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectGroup[]>([]);

  useEffect(() => {
    apiFetch<UserRow[]>("/admin/users").then(setAllUsers).catch(() => setAllUsers([]));
    apiFetch<ProjectGroup[]>("/admin/projects").then(setAllProjects).catch(() => setAllProjects([]));
  }, []);

  const skillDataViews: SkillDataView[] = (table.validation_rules?.skill_data_views as SkillDataView[]) ?? [];
  const referencedSkills: string[] = table.referenced_skills ?? [];
  const isEditable = fieldMeta.length > 0 || table.table_name.startsWith("usr_");

  const inferredColTypes = useMemo(() => {
    const result: Record<string, { type: "enum" | "number" | "date" | "text" | "boolean"; uniqueValues?: string[] }> = {};
    if (fieldMeta.length > 0 || rows.length === 0) return result;

    const MIN_ROWS_FOR_ENUM = 3;
    const MAX_ENUM_VALUES = 20;
    const MAX_ENUM_RATIO = 0.6;

    for (const col of cols) {
      if (READONLY_COLS.has(col)) continue;
      const nonNullValues = rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && v !== "");
      if (nonNullValues.length === 0) continue;

      const strValues = nonNullValues.map((v) => String(v).toLowerCase());
      const boolSet = new Set(strValues);
      if (boolSet.size <= 2 && [...boolSet].every((v) => ["true", "false", "0", "1", "是", "否", "yes", "no"].includes(v))) {
        result[col] = { type: "boolean" }; continue;
      }
      if (nonNullValues.every((v) => typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)) && v.trim() !== ""))) {
        result[col] = { type: "number" }; continue;
      }
      if (nonNullValues.every((v) => {
        if (typeof v === "number") return (v >= 1e9 && v <= 9.999e12);
        if (typeof v === "string") return !isNaN(Date.parse(v)) && /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v);
        return false;
      })) {
        result[col] = { type: "date" }; continue;
      }
      const uniqueSet = new Set(nonNullValues.map((v) => formatCellValue(v)));
      if (nonNullValues.length >= MIN_ROWS_FOR_ENUM && uniqueSet.size <= MAX_ENUM_VALUES && uniqueSet.size / nonNullValues.length <= MAX_ENUM_RATIO) {
        result[col] = { type: "enum", uniqueValues: [...uniqueSet].sort() }; continue;
      }
      result[col] = { type: "text" };
    }
    return result;
  }, [cols, rows, fieldMeta.length]);

  function isTextColumn(colName: string): boolean {
    const fm = fieldMeta.find((m) => m.name === colName);
    if (fm) return fm.field_type === "text" || fm.field_type === "url" || fm.field_type === "email" || fm.field_type === "phone";
    const inferred = inferredColTypes[colName];
    return !inferred || inferred.type === "text";
  }

  const groupableColumns = cols.filter((c) => !READONLY_COLS.has(c) && !isTextColumn(c));

  const loadRows = useCallback((viewId?: number | null) => {
    setLoadingRows(true); setRowsError("");
    const qs = viewId ? `?page=1&page_size=100&view_id=${viewId}` : "?page=1&page_size=100";
    apiFetch<{ columns: string[]; rows: Record<string, unknown>[] }>(`/data/${table.table_name}/rows${qs}`)
      .then((d) => { setCols(d.columns ?? []); setRows(d.rows ?? []); })
      .catch((e: unknown) => { setCols([]); setRows([]); setRowsError(e instanceof Error ? e.message : String(e)); })
      .finally(() => setLoadingRows(false));
  }, [table.table_name]);

  function handleViewChange(viewId: number | null) { setActiveViewId(viewId); loadRows(viewId); }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);
  useEffect(() => {
    function close() { setContextMenu(null); }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  function submitRename() {
    const v = nameVal.trim();
    if (v && v !== table.display_name) onRename(table.id, v);
    setEditingName(false);
  }

  async function handleCellSave(rowId: number, col: string, value: string) {
    try {
      await apiFetch(`/data/${table.table_name}/rows/${rowId}`, { method: "PUT", body: JSON.stringify({ data: { [col]: value || null } }) });
      setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, [col]: value } : r));
    } catch { /* silently ignore */ }
  }

  const visibleCols = cols.filter((c) => !hidden.includes(c));
  const editableCols = visibleCols.filter((c) => !READONLY_COLS.has(c));

  async function handleAddRow() {
    const data: Record<string, string | null> = {};
    editableCols.forEach((c) => { data[c] = newRowData[c] ?? null; });
    try {
      await apiFetch(`/data/${table.table_name}/rows`, { method: "POST", body: JSON.stringify({ data }) });
      setAddingRow(false); setNewRowData({}); loadRows();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "新增失败"); }
  }

  async function handleDeleteRow(rowId: number) {
    if (!confirm("确认删除这行数据？")) return;
    try {
      await apiFetch(`/data/${table.table_name}/rows/${rowId}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "删除失败"); }
  }

  async function handleDropColumn(colName: string) {
    if (!confirm(`确认删除列「${colName}」及其所有数据？`)) return;
    try {
      await apiFetch(`/business-tables/${table.id}/columns/${colName}`, { method: "DELETE" });
      onRename(table.id, table.display_name);
      loadRows();
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "删除列失败"); }
  }

  function getFieldMeta(colName: string): FieldMeta | undefined {
    return fieldMeta.find((m) => m.name === colName);
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white flex flex-col" onClick={() => setContextMenu(null)}>
      {contextMenu && (
        <div className="fixed z-50 bg-white border-2 border-[#1A202C] shadow-lg py-1 w-28" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { handleDeleteRow(contextMenu.rowId); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-red-500 hover:bg-red-50">
            🗑 删除行
          </button>
        </div>
      )}
      {showAddCol && (
        <AddColumnModal tableId={table.id} onDone={() => { onRename(table.id, table.display_name); loadRows(); }} onClose={() => setShowAddCol(false)} />
      )}

      {/* Header */}
      <div className="px-5 py-4 border-b-2 border-[#1A202C] flex-shrink-0 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input ref={nameInputRef} value={nameVal} onChange={(e) => setNameVal(e.target.value)} onBlur={submitRename}
              onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setEditingName(false); }}
              className="text-sm font-bold border-2 border-[#00D1FF] px-2 py-0.5 focus:outline-none w-full" />
          ) : (
            <h2 className="text-sm font-bold cursor-pointer hover:text-[#00A3C4] transition-colors" onClick={() => setEditingName(true)} title="点击重命名">
              {table.display_name}
            </h2>
          )}
          <p className="text-[9px] text-gray-400 font-mono mt-0.5">{table.table_name}</p>
        </div>
        <PixelBadge color="gray">{table.columns.length} 列</PixelBadge>
        {isEditable && (
          <button onClick={() => setShowAddCol(true)} className="text-[9px] font-bold px-2 py-1 border-2 border-[#00A3C4] text-[#00A3C4] hover:bg-[#00A3C4] hover:text-white transition-colors flex-shrink-0">
            + 新增列
          </button>
        )}
        {table.validation_rules?.bitable_app_token && (
          <BitableResyncButton table={table} onDone={() => onRename(table.id, table.display_name)} />
        )}
        <button onClick={() => setShowSettings((v) => !v)}
          className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 border-2 border-[#1A202C] bg-white hover:bg-[#F0F4F8] transition-colors flex-shrink-0">
          {showSettings ? "▾ 收起设置" : "▸ 范围 / 字段"}
        </button>
      </div>

      {showSettings && (
        <>
          <div className="px-5 py-3 border-b-2 border-[#1A202C] flex-shrink-0 bg-[#FAFCFD]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">— 数据表访问权限</div>
            <div className="mb-4">
              <AccessScopeSelector label="谁可以访问这张表" accessScope={tableAccessScope} userIds={tableAccessUserIds} roleIds={tableAccessRoleIds}
                deptIds={tableAccessDeptIds} projectIds={tableAccessProjectIds} departments={departments} users={allUsers} projects={allProjects}
                onChange={(patch) => onScopeChange(table.id, patch)} />
              <div className="text-[8px] text-gray-400 mt-2">超管始终可见</div>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">— 列/行可见范围（细粒度）</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <ScopeSelector label="列数据可见范围" scope={colScope} deptIds={colDeptIds} departments={departments}
                onChange={(s, ids) => onScopeChange(table.id, { column_scope: s, column_department_ids: ids })} />
              <ScopeSelector label="行数据可见范围" scope={rowScope} deptIds={rowDeptIds} departments={departments}
                onChange={(s, ids) => onScopeChange(table.id, { row_scope: s, row_department_ids: ids })} />
            </div>
          </div>

          <div className="px-5 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              列字段管理<span className="text-gray-300 ml-1 normal-case">（点击隐藏）</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {table.columns.map((c) => {
                const isHidden = hidden.includes(c.name);
                return (
                  <div key={c.name} className="inline-flex items-center gap-0.5 group">
                    <button onClick={() => onToggleField(table.id, c.name, !isHidden)} title={isHidden ? "已隐藏，点击恢复" : "点击隐藏"}
                      className={`inline-flex items-center gap-1.5 border-2 px-2 py-0.5 text-[9px] font-bold transition-colors ${
                        isHidden ? "border-gray-200 text-gray-300 bg-gray-50" : "border-[#1A202C] text-[#1A202C] bg-white hover:border-[#00A3C4] hover:text-[#00A3C4]"
                      }`}>
                      <span>{isHidden ? "○" : "●"}</span>
                      {c.name}
                      <span className="text-[8px] font-mono opacity-60">{c.type}</span>
                    </button>
                    {isEditable && !READONLY_COLS.has(c.name) && (
                      <button onClick={() => handleDropColumn(c.name)} className="hidden group-hover:inline text-[9px] text-gray-300 hover:text-red-400 px-0.5" title="删除列">✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <SkillDataViewPanel tableId={table.id} columns={cols.length > 0 ? cols : table.columns.map((c) => c.name)}
            filterableColumns={groupableColumns.length > 0 ? groupableColumns : undefined} referencedSkills={referencedSkills} views={skillDataViews}
            onSave={(views) => onScopeChange(table.id, { skill_data_views: views })} />
        </>
      )}

      <ViewBar tableId={table.id} cols={cols} activeViewId={activeViewId} onChangeView={handleViewChange} />

      <div className="flex-1 min-h-0 overflow-auto">
        {loadingRows ? (
          <div className="flex items-center justify-center h-32 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">Loading...</div>
        ) : rowsError ? (
          <div className="flex items-center justify-center h-32 text-[10px] font-bold text-red-500">{rowsError}</div>
        ) : (
          <>
            <table className="text-[9px]" style={{ minWidth: "100%" }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#EBF4F7]">
                  {isEditable && <th className="w-6 border-b-2 border-[#1A202C] border-r border-gray-200" />}
                  {visibleCols.map((c) => {
                    const fm = getFieldMeta(c);
                    const inferred = inferredColTypes[c];
                    const INFERRED_LABELS: Record<string, string> = { enum: "枚举", number: "数字", date: "日期", text: "文本", boolean: "布尔" };
                    const INFERRED_COLORS: Record<string, string> = { enum: "bg-purple-100 text-purple-600", number: "bg-blue-50 text-blue-500", date: "bg-orange-50 text-orange-500", boolean: "bg-green-50 text-green-600", text: "bg-gray-50 text-gray-400" };
                    return (
                      <th key={c} className="text-left px-3 py-2 font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C] border-r border-gray-200 whitespace-nowrap">
                        {c}
                        {fm ? (
                          <span className="text-[7px] text-gray-400 ml-1 normal-case font-normal">{FIELD_TYPE_LABELS[fm.field_type]}</span>
                        ) : inferred ? (
                          <span className={`text-[7px] ml-1 normal-case font-normal px-1 py-px rounded ${INFERRED_COLORS[inferred.type] ?? ""}`}>
                            {INFERRED_LABELS[inferred.type] ?? inferred.type}
                            {inferred.type === "enum" && inferred.uniqueValues && (
                              <span className="text-[6px] ml-0.5 opacity-70">({inferred.uniqueValues.length})</span>
                            )}
                          </span>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={String(row.id ?? i)} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FBFD]"}`}
                    onContextMenu={(e) => { if (!isEditable || !row.id) return; e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, rowId: row.id as number }); }}>
                    {isEditable && (
                      <td className="w-6 border-r border-gray-100 text-center">
                        <button onClick={() => row.id && handleDeleteRow(row.id as number)} className="text-[8px] text-gray-200 hover:text-red-400 px-1" title="删除行">✕</button>
                      </td>
                    )}
                    {visibleCols.map((c) => {
                      const inferred = inferredColTypes[c];
                      const cellVal = row[c];
                      const isEnum = inferred?.type === "enum";
                      const isBool = inferred?.type === "boolean";
                      return (
                        <td key={c} className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap max-w-[240px] truncate" title={formatCellValue(cellVal)}>
                          {isEnum && cellVal != null ? (
                            <span className="inline-block border border-purple-200 bg-purple-50 text-purple-700 px-1.5 py-px text-[9px] font-bold rounded">{formatCellValue(cellVal)}</span>
                          ) : isBool && cellVal != null ? (
                            <span className={`inline-block px-1.5 py-px text-[9px] font-bold rounded ${
                              ["true", "1", "是", "yes"].includes(String(cellVal).toLowerCase()) ? "bg-green-50 text-green-600 border border-green-200" : "bg-gray-50 text-gray-400 border border-gray-200"
                            }`}>{["true", "1", "是", "yes"].includes(String(cellVal).toLowerCase()) ? "是" : "否"}</span>
                          ) : (
                            <EditableCell value={cellVal} fieldMeta={getFieldMeta(c)} readOnly={!isEditable || READONLY_COLS.has(c)}
                              onSave={(v) => row.id && handleCellSave(row.id as number, c, v)} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {addingRow && (
                  <tr className="border-t-2 border-[#00D1FF] bg-[#F0FBFF]">
                    {isEditable && <td className="w-6 border-r border-gray-100" />}
                    {visibleCols.map((c) => (
                      <td key={c} className="px-1 py-1 border-r border-gray-100">
                        {READONLY_COLS.has(c) ? (
                          <span className="text-[9px] text-gray-300 px-2">auto</span>
                        ) : (
                          <input value={newRowData[c] ?? ""} onChange={(e) => setNewRowData((prev) => ({ ...prev, [c]: e.target.value }))}
                            className="border border-[#00D1FF] text-[9px] px-1 py-0.5 w-full focus:outline-none bg-white" placeholder={c} />
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>

            {isEditable && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100">
                {!addingRow ? (
                  <button onClick={() => { setAddingRow(true); setNewRowData({}); }} className="text-[9px] font-bold text-[#00A3C4] hover:text-[#008BA3] flex items-center gap-1">+ 新增行</button>
                ) : (
                  <>
                    <PixelButton size="sm" onClick={handleAddRow}>✓ 保存</PixelButton>
                    <PixelButton size="sm" variant="secondary" onClick={() => { setAddingRow(false); setNewRowData({}); }}>取消</PixelButton>
                  </>
                )}
                {rows.length === 0 && !addingRow && <span className="text-[9px] text-gray-300 ml-2">暂无数据</span>}
              </div>
            )}
            {!isEditable && rows.length === 0 && (
              <div className="flex items-center justify-center h-24 text-[10px] font-bold uppercase tracking-widest text-gray-300">暂无数据</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── ManageTab ─────────────────────────────────────────────────────────────────
function ManageTab() {
  const [allTables, setAllTables] = useState<BusinessTable[]>([]);
  const [folders, setFolders] = useState<VirtualFolder[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const selectedTable = selectedTableId !== null ? (allTables.find((t) => t.id === selectedTableId) ?? null) : null;
  const setSelectedTable = (t: BusinessTable | null) => setSelectedTableId(t?.id ?? null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [draggingTableId, setDraggingTableId] = useState<number | null>(null);
  const [rootDropTarget, setRootDropTarget] = useState(false);
  const [newRootFolder, setNewRootFolder] = useState(false);
  const [newRootName, setNewRootName] = useState("");
  const rootInputRef = useRef<HTMLInputElement>(null);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<BusinessTable[]>("/business-tables");
      setAllTables(Array.isArray(data) ? data : []);
    } catch { setAllTables([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchTables();
    apiFetch<Department[]>("/admin/departments").then((d) => setDepartments(Array.isArray(d) ? d : [])).catch(() => setDepartments([]));
  }, [fetchTables]);

  async function handleRenameTable(id: number, name: string) {
    await apiFetch(`/business-tables/${id}`, { method: "PATCH", body: JSON.stringify({ display_name: name }) });
    await fetchTables();
  }

  async function handleToggleField(tableId: number, field: string, hide: boolean) {
    const table = allTables.find((t) => t.id === tableId);
    if (!table) return;
    const current = table.validation_rules?.hidden_fields ?? [];
    const next = hide ? [...new Set([...current, field])] : current.filter((f) => f !== field);
    await apiFetch(`/business-tables/${tableId}`, { method: "PATCH", body: JSON.stringify({ hidden_fields: next }) });
    await fetchTables();
  }

  async function handleScopeChange(tableId: number, patch: Partial<BusinessTable["validation_rules"]>) {
    await apiFetch(`/business-tables/${tableId}`, { method: "PATCH", body: JSON.stringify(patch) });
    await fetchTables();
  }

  async function handleDropTable(tableId: number, folderId: number | null) {
    await apiFetch(`/business-tables/${tableId}`, { method: "PATCH", body: JSON.stringify({ folder_id: folderId ?? 0 }) });
    setDraggingTableId(null);
    await fetchTables();
  }

  function handleNewRootFolder() {
    if (!newRootName.trim()) { setNewRootFolder(false); return; }
    const f: VirtualFolder = { id: nextLocalId(), name: newRootName.trim(), parent_id: null };
    setFolders((prev) => [...prev, f]);
    setNewRootFolder(false); setNewRootName("");
  }

  function handleNewSubfolder(parentId: number, name: string) {
    const f: VirtualFolder = { id: nextLocalId(), name, parent_id: parentId };
    setFolders((prev) => [...prev, f]);
  }

  function handleRenameFolder(id: number, name: string) {
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name } : f));
  }

  function handleDeleteFolder(id: number) {
    const tables = allTables.filter((t) => (t.validation_rules?.folder_id ?? null) === id);
    Promise.all(tables.map((t) =>
      apiFetch(`/business-tables/${t.id}`, { method: "PATCH", body: JSON.stringify({ folder_id: 0 }) })
    )).then(() => {
      setFolders((prev) => prev.filter((f) => f.id !== id && f.parent_id !== id));
      fetchTables();
    });
  }

  const rootFolders = folders.filter((f) => f.parent_id === null);
  const unassignedTables = allTables.filter((t) => !t.validation_rules?.folder_id || t.validation_rules.folder_id === 0);

  function tablesInFolder(folderId: number) {
    return allTables.filter((t) => t.validation_rules?.folder_id === folderId);
  }

  return (
    <div className="flex h-full border-2 border-[#1A202C]" onDragEnd={() => setDraggingTableId(null)}>
      <div className="w-72 flex-shrink-0 border-r-2 border-[#1A202C] flex flex-col bg-[#F0F4F8]">
        <div className="flex items-center justify-between px-3 py-1.5 border-b-2 border-[#1A202C] flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">数据表</span>
          <button onClick={() => { setNewRootFolder(true); setNewRootName(""); setTimeout(() => rootInputRef.current?.focus(), 30); }}
            className="flex items-center gap-1 px-2 py-1 border-2 border-[#1A202C] bg-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#1A202C] hover:text-white transition-colors">
            + 文件夹
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" onDragEnd={() => setDraggingTableId(null)}>
          {loading ? (
            <div className="text-[9px] text-gray-400 px-3 py-4">Loading...</div>
          ) : (
            <>
              {newRootFolder && (
                <div className="flex items-center gap-1 px-2 py-1 border-b border-[#CBD5E0]">
                  <input ref={rootInputRef} value={newRootName} onChange={(e) => setNewRootName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleNewRootFolder(); if (e.key === "Escape") setNewRootFolder(false); }}
                    placeholder="文件夹名称" className="flex-1 text-[10px] border-2 border-[#00D1FF] px-1.5 py-0.5 focus:outline-none font-bold bg-white" />
                  <button onClick={handleNewRootFolder} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4]">✓</button>
                  <button onClick={() => setNewRootFolder(false)} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-400">✕</button>
                </div>
              )}

              {rootFolders.map((f) => {
                const childFolders = folders.filter((cf) => cf.parent_id === f.id);
                return (
                  <FolderNode key={f.id} folder={f} subFolders={childFolders} tables={tablesInFolder(f.id)}
                    selectedId={selectedTable?.id ?? null} onSelectTable={setSelectedTable} onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder} onNewSubfolder={handleNewSubfolder} onDropTable={handleDropTable}
                    draggingTableId={draggingTableId} onDragStart={setDraggingTableId} depth={0} />
                );
              })}

              <div className={`min-h-[4px] transition-colors ${rootDropTarget && draggingTableId !== null ? "bg-[#CCF2FF]" : ""}`}
                onDragOver={(e) => { if (draggingTableId !== null) { e.preventDefault(); setRootDropTarget(true); } }}
                onDragLeave={() => setRootDropTarget(false)}
                onDrop={(e) => { e.preventDefault(); setRootDropTarget(false); const id = parseInt(e.dataTransfer.getData("tableId")); if (!isNaN(id)) handleDropTable(id, null); }}>
                {rootDropTarget && draggingTableId !== null && (
                  <div className="mx-2 my-1 border-2 border-dashed border-[#00D1FF] px-2 py-1 text-center text-[9px] font-bold text-[#00A3C4] uppercase tracking-widest">移出文件夹</div>
                )}
                {unassignedTables.map((t) => (
                  <TableRow key={t.id} table={t} selected={selectedTable?.id === t.id} depth={0}
                    onClick={() => setSelectedTable(t)} onDragStart={setDraggingTableId} isDragging={draggingTableId === t.id} />
                ))}
              </div>

              {allTables.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-[9px] text-gray-400 uppercase tracking-widest">
                  <div className="mb-3 opacity-40"><ThemedIcon size={28} /></div>
                  暂无数据表，先去连接数据源
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedTable ? (
        <TablePreview table={selectedTable} departments={departments} onRename={handleRenameTable} onToggleField={handleToggleField} onScopeChange={handleScopeChange} />
      ) : (
        <div className="flex-1 bg-white flex flex-col items-center justify-center text-[9px] text-gray-400 uppercase tracking-widest">
          <div className="mb-3 opacity-40"><ThemedIcon size={32} /></div>
          选择左侧数据表预览
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DataPage() {
  const [tab, setTab] = useState<Tab>("manage");
  const [manageKey, setManageKey] = useState(0);
  const { theme } = useTheme();
  const isLab = theme === "lab";
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "dept_admin";

  return (
    <div className="h-full flex flex-col">
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center gap-4 flex-shrink-0" style={{ backgroundColor: "var(--card)" }}>
        <div className="flex items-center gap-2 mr-4">
          <ThemedPageIcon icon={ICONS.data} size={16} />
          <h1 className={`text-xs font-bold uppercase tracking-widest ${isLab ? "text-[#1A202C]" : "text-foreground"}`}>数据表</h1>
        </div>
        <div className="flex gap-1">
          <PixelButton variant={tab === "manage" ? "primary" : "secondary"} size="sm" onClick={() => setTab("manage")}>数据源管理</PixelButton>
          {isAdmin && (
            <PixelButton variant={tab === "connect" ? "primary" : "secondary"} size="sm" onClick={() => setTab("connect")}>对接数据源</PixelButton>
          )}
        </div>
      </div>

      {tab === "connect" && isAdmin ? (
        <div className="flex-1 overflow-auto p-6">
          <ConnectTab onAdded={() => { setManageKey((k) => k + 1); setTab("manage"); }} />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ManageTab key={manageKey} />
          {!isAdmin && (
            <div className="px-6 py-3 text-[10px] text-muted-foreground border-t border-border">
              外部数据源接入与同步仅对部门管理员和超级管理员开放。如需接入飞书多维表，请联系管理员。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
