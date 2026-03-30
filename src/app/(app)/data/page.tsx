"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelIcon, ICONS } from "@/components/pixel";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { useTheme } from "@/lib/theme";
import { Table2 } from "lucide-react";

function ThemedIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.data} size={size} />;
  return <Table2 size={size} className="text-muted-foreground" />;
}
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Column {
  name: string;
  type: string;
  nullable: boolean;
  comment: string;
}

type ScopeValue = "all" | "department" | "private";
type AccessScope = "self" | "users" | "roles" | "departments" | "projects" | "company";

// Forward declaration for validation_rules typing
interface SkillDataViewBase {
  view_id: string;
  view_name: string;
  skill_id: number;
  skill_name: string;
  allowed_fields: string[];
  row_filters: { field: string; op: string; value: string }[];
}

type FieldType = "text" | "number" | "select" | "multi_select" | "date" | "person" | "url" | "checkbox" | "email" | "phone";

interface FieldMeta {
  name: string;
  field_type: FieldType;
  options: string[];
  nullable: boolean;
  comment: string;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "文本",
  number: "数字",
  select: "单选",
  multi_select: "多选",
  date: "日期",
  person: "人员",
  url: "链接",
  checkbox: "复选框",
  email: "邮箱",
  phone: "电话",
};

interface BusinessTable {
  id: number;
  table_name: string;
  display_name: string;
  description: string;
  columns: Column[];
  validation_rules: {
    hidden_fields?: string[];
    folder_id?: number;
    sort_order?: number;
    column_scope?: ScopeValue;
    column_department_ids?: number[];
    row_scope?: ScopeValue;
    row_department_ids?: number[];
    bitable_app_token?: string;
    bitable_table_id?: string;
    last_synced_at?: number;
    field_meta?: FieldMeta[];
    // 六级访问权限
    access_scope?: AccessScope;
    access_user_ids?: number[];
    access_role_ids?: string[];
    access_department_ids?: number[];
    access_project_ids?: number[];
    // Skill 数据视图
    skill_data_views?: SkillDataViewBase[];
  };
  referenced_skills?: string[];
  created_at: string;
}

interface Department {
  id: number;
  name: string;
  parent_id: number | null;
}

interface ProbeResult {
  table_name: string;
  columns: Column[];
  preview_rows: Record<string, unknown>[];
}

// ─── Cell value formatter ─────────────────────────────────────────────────────
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((item) => formatCellValue(item)).join("、");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.display_name === "string") return obj.display_name;
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    // 毫秒时间戳（13位）
    if (value >= 1e12 && value <= 9.999e12) {
      return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    }
    // 秒时间戳（10位）
    if (value >= 1e9 && value <= 9.999e9) {
      return new Date(value * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    }
  }
  return String(value);
}

// ─── Tab ──────────────────────────────────────────────────────────────────────
type Tab = "connect" | "manage";
type ConnectMode = "db" | "bitable";

// ─── Shared preview table ─────────────────────────────────────────────────────
function PreviewTable({
  columns,
  rows,
  title,
}: {
  columns: { name: string; type: string | number }[];
  rows: Record<string, unknown>[];
  title: string;
}) {
  return (
    <div className="border-2 border-[#1A202C] bg-white">
      <div className="px-4 py-2.5 bg-[#EBF4F7] border-b-2 border-[#1A202C] flex items-center gap-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— {title}</span>
        <PixelBadge color="green">{columns.length} 列</PixelBadge>
        <PixelBadge color="gray">前 {rows.length} 行</PixelBadge>
      </div>
      <div className="px-4 pt-3 pb-1">
        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">字段结构</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {columns.map((c) => (
            <span key={c.name} className="inline-flex items-center gap-1 border-2 border-[#1A202C] px-2 py-0.5 text-[9px] font-bold bg-white">
              {c.name}
              <span className="text-[8px] text-[#00A3C4] font-mono">{String(c.type)}</span>
            </span>
          ))}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto border-t-2 border-[#1A202C]">
          <table className="text-[9px] w-full">
            <thead>
              <tr className="bg-[#EBF4F7]">
                {columns.map((c) => (
                  <th key={c.name} className="text-left px-3 py-2 font-bold uppercase tracking-widest text-[#00A3C4] border-r border-gray-200 whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FBFD]"}`}>
                  {columns.map((c) => (
                    <td key={c.name} className="px-3 py-1.5 border-r border-gray-100 font-mono text-gray-700 max-w-[160px] truncate" title={formatCellValue(row[c.name])}>
                      {row[c.name] === null || row[c.name] === undefined
                        ? <span className="text-gray-300">NULL</span>
                        : formatCellValue(row[c.name])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Bitable panel ────────────────────────────────────────────────────────────
interface BitableProbeResult {
  app_token: string;
  table_id: string;
  columns: { name: string; type: number; nullable: boolean; comment: string }[];
  preview_rows: Record<string, unknown>[];
}

interface WikiTable {
  table_id: string;
  name: string;
}

function BitablePanel({ onAdded }: { onAdded: () => void }) {
  const [appToken, setAppToken] = useState("");
  const [tableId, setTableId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [probing, setProbing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [probeResult, setProbeResult] = useState<BitableProbeResult | null>(null);
  const [error, setError] = useState("");
  const [syncMsg, setSyncMsg] = useState("");
  const [wikiTables, setWikiTables] = useState<WikiTable[] | null>(null);
  const [resolvingWiki, setResolvingWiki] = useState(false);

  // Parse app_token + table_id from a pasted URL
  async function parseUrl(url: string) {
    if (url.includes("/wiki/")) {
      const m = url.match(/\/wiki\/([A-Za-z0-9]+)/);
      if (!m) return;
      const wikiToken = m[1];
      const tableParam = url.match(/[?&]table=([A-Za-z0-9]+)/);
      setError("");
      setWikiTables(null);
      setResolvingWiki(true);
      try {
        const res = await apiFetch<{ app_token: string; title: string; tables: WikiTable[] }>(
          "/business-tables/resolve-wiki",
          { method: "POST", body: JSON.stringify({ wiki_token: wikiToken }) }
        );
        setAppToken(res.app_token);
        if (!displayName) setDisplayName(res.title);
        if (res.tables.length === 1) {
          setTableId(res.tables[0].table_id);
        } else if (tableParam) {
          const matched = res.tables.find((t) => t.table_id === tableParam[1]);
          if (matched) setTableId(matched.table_id);
          else setWikiTables(res.tables);
        } else {
          setWikiTables(res.tables);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Wiki 解析失败");
      } finally {
        setResolvingWiki(false);
      }
      return;
    }
    setError("");
    setWikiTables(null);
    const m = url.match(/\/base\/([A-Za-z0-9]+)/);
    if (m) setAppToken(m[1]);
    const t = url.match(/[?&]table=([A-Za-z0-9]+)/);
    if (t) setTableId(t[1]);
  }

  async function handleProbe() {
    if (!appToken.trim() || !tableId.trim()) {
      setError("请填写 App Token 和 Table ID");
      return;
    }
    setError("");
    setSyncMsg("");
    setProbing(true);
    setProbeResult(null);
    try {
      const data = await apiFetch<BitableProbeResult>("/business-tables/probe-bitable", {
        method: "POST",
        body: JSON.stringify({ app_token: appToken.trim(), table_id: tableId.trim(), display_name: displayName.trim() }),
      });
      setProbeResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "预览失败");
    } finally {
      setProbing(false);
    }
  }

  async function handleSync() {
    if (!probeResult) return;
    setSyncing(true);
    setError("");
    setSyncMsg("");
    try {
      await apiFetch("/business-tables/sync-bitable", {
        method: "POST",
        body: JSON.stringify({
          app_token: probeResult.app_token,
          table_id: probeResult.table_id,
          display_name: displayName.trim(),
        }),
      });
      setSyncMsg("✓ 同步完成");
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-[#1A202C] bg-white">
        <div className="px-4 py-2.5 bg-[#EBF4F7] border-b-2 border-[#1A202C] flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— 飞书多维表格</span>
          <PixelBadge color="cyan">Bitable API</PixelBadge>
        </div>
        <div className="p-4 space-y-3">
          {/* URL paste shortcut */}
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">
              粘贴多维表格链接（自动解析）
            </label>
            <input
              placeholder="支持 /base/ 或 /wiki/ 链接，粘贴后自动解析"
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text) { e.preventDefault(); (e.target as HTMLInputElement).value = text; parseUrl(text); }
              }}
              onBlur={(e) => { if (e.target.value) parseUrl(e.target.value); }}
              className="w-full border-2 border-gray-300 px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-[#00D1FF]"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">App Token</label>
              <input
                value={appToken}
                onChange={(e) => setAppToken(e.target.value)}
                placeholder="从 URL /base/ 后面复制"
                className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-[#00D1FF]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Table ID</label>
              <input
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                placeholder="URL 中 ?table=tbl... 后面的部分"
                className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-[#00D1FF]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">显示名称（可选）</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="留空则用 table_id"
                className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] focus:outline-none focus:border-[#00D1FF]"
              />
            </div>
          </div>

          {resolvingWiki && (
            <p className="text-[10px] text-[#00A3C4] font-bold animate-pulse">正在解析 Wiki 节点...</p>
          )}
          {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
          {syncMsg && <p className="text-[10px] text-green-600 font-bold">{syncMsg}</p>}

          {wikiTables && wikiTables.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                该多维表格包含多个数据表，请选择：
              </p>
              <div className="flex flex-wrap gap-1.5">
                {wikiTables.map((t) => (
                  <button
                    key={t.table_id}
                    onClick={() => { setTableId(t.table_id); setWikiTables(null); }}
                    className={`px-2.5 py-1 border-2 text-[9px] font-bold transition-colors ${
                      tableId === t.table_id
                        ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                        : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <PixelButton onClick={handleProbe} disabled={probing}>
              {probing ? "获取中..." : "▶ 预览字段和数据"}
            </PixelButton>
            {probeResult && (
              <PixelButton variant="secondary" onClick={handleSync} disabled={syncing}>
                {syncing ? "同步中..." : "⟳ 全量同步到本地"}
              </PixelButton>
            )}
          </div>

          {/* Hint */}
          <p className="text-[9px] text-gray-400 leading-relaxed border-t border-gray-100 pt-2">
            <strong>需要</strong>：在飞书多维表格 → 右上角「...」→ 添加文档应用 → 选择本系统的飞书应用，并确保应用已开通 <code>bitable:app:readonly</code> 权限。
          </p>
        </div>
      </div>

      {probeResult && (
        <PreviewTable
          title={`${probeResult.table_id} 预览`}
          columns={probeResult.columns}
          rows={probeResult.preview_rows}
        />
      )}
    </div>
  );
}

// ─── DB panel ─────────────────────────────────────────────────────────────────
function DbPanel({ onAdded }: { onAdded: () => void }) {
  const [dbUrl, setDbUrl] = useState("");
  const [tableName, setTableName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleProbe() {
    if (!dbUrl.trim() || !tableName.trim()) { setError("请填写数据库地址和表名"); return; }
    setError(""); setProbing(true); setProbeResult(null); setSaved(false);
    try {
      const data = await apiFetch<ProbeResult>("/business-tables/probe", {
        method: "POST",
        body: JSON.stringify({ db_url: dbUrl.trim(), table_name: tableName.trim() }),
      });
      setProbeResult(data);
      if (!displayName.trim()) setDisplayName(data.table_name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setProbing(false);
    }
  }

  async function handleAdd() {
    if (!probeResult) return;
    setSaving(true); setError("");
    try {
      await apiFetch("/business-tables/apply", {
        method: "POST",
        body: JSON.stringify({
          table_name: probeResult.table_name,
          display_name: displayName.trim() || probeResult.table_name,
          description: `外部数据源: ${dbUrl.replace(/:[^@]*@/, ":***@")}`,
          ddl_sql: "", validation_rules: {}, workflow: {}, create_skill: false,
        }),
      });
      setSaved(true);
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-[#1A202C] bg-white">
        <div className="px-4 py-2.5 bg-[#EBF4F7] border-b-2 border-[#1A202C]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— 数据库连接</span>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">数据库地址</label>
            <input value={dbUrl} onChange={(e) => setDbUrl(e.target.value)}
              placeholder="mysql+pymysql://user:pass@host:3306/dbname"
              className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-[#00D1FF]" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">表名</label>
              <input value={tableName} onChange={(e) => setTableName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleProbe()}
                placeholder="例：orders"
                className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-[#00D1FF]" />
            </div>
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">显示名称（可选）</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="留空则用表名"
                className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] focus:outline-none focus:border-[#00D1FF]" />
            </div>
          </div>
          {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <PixelButton onClick={handleProbe} disabled={probing}>
              {probing ? "连接中..." : "▶ 连接并预览"}
            </PixelButton>
            {probeResult && !saved && (
              <PixelButton variant="secondary" onClick={handleAdd} disabled={saving}>
                {saving ? "添加中..." : "+ 添加到数据源"}
              </PixelButton>
            )}
            {saved && <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">✓ 已添加</span>}
          </div>
        </div>
      </div>
      {probeResult && (
        <PreviewTable title={probeResult.table_name} columns={probeResult.columns} rows={probeResult.preview_rows} />
      )}
    </div>
  );
}

// ─── CreateBlank Panel ────────────────────────────────────────────────────────
function CreateBlankPanel({ onAdded }: { onAdded: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldMeta[]>([
    { name: "名称", field_type: "text", options: [], nullable: true, comment: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addField() {
    setFields((prev) => [...prev, { name: "", field_type: "text", options: [], nullable: true, comment: "" }]);
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateField(i: number, patch: Partial<FieldMeta>) {
    setFields((prev) => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }

  async function handleCreate() {
    if (!displayName.trim()) { setError("请填写表名称"); return; }
    const invalid = fields.find((f) => !f.name.trim());
    if (invalid !== undefined) { setError("字段名称不能为空"); return; }
    setError(""); setSaving(true);
    try {
      await apiFetch("/business-tables/create-blank", {
        method: "POST",
        body: JSON.stringify({ display_name: displayName.trim(), description: description.trim(), fields }),
      });
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="border-2 border-[#1A202C] bg-white">
        <div className="px-4 py-2.5 bg-[#EBF4F7] border-b-2 border-[#1A202C]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— 新建空白表</span>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">表名称 *</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例：客户线索表"
              className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] focus:outline-none focus:border-[#00D1FF]"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">描述（可选）</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这张表用来记录..."
              className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] focus:outline-none focus:border-[#00D1FF]"
            />
          </div>

          {/* Field designer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">字段定义</span>
              <button
                onClick={addField}
                className="text-[9px] font-bold px-2 py-0.5 border-2 border-[#1A202C] bg-white hover:bg-[#1A202C] hover:text-white transition-colors"
              >
                + 添加字段
              </button>
            </div>
            {/* System fields hint */}
            <div className="flex gap-1 flex-wrap mb-2">
              {["id (自增主键)", "created_at (创建时间)", "updated_at (更新时间)"].map((f) => (
                <span key={f} className="text-[8px] text-gray-400 border border-gray-200 px-1.5 py-0.5 bg-gray-50">{f}</span>
              ))}
            </div>
            <div className="space-y-1.5">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2 border border-gray-200 p-2 bg-white">
                  <input
                    value={f.name}
                    onChange={(e) => updateField(i, { name: e.target.value })}
                    placeholder="字段名称"
                    className="flex-1 border-2 border-gray-200 px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-[#00D1FF]"
                  />
                  <select
                    value={f.field_type}
                    onChange={(e) => updateField(i, { field_type: e.target.value as FieldType })}
                    className="border-2 border-gray-200 px-2 py-1 text-[10px] focus:outline-none focus:border-[#00D1FF] bg-white"
                  >
                    {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                      <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  {(f.field_type === "select" || f.field_type === "multi_select") && (
                    <input
                      value={f.options.join(",")}
                      onChange={(e) => updateField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="选项1,选项2"
                      className="w-28 border-2 border-gray-200 px-2 py-1 text-[10px] focus:outline-none focus:border-[#00D1FF]"
                    />
                  )}
                  <button
                    onClick={() => removeField(i)}
                    className="text-[10px] text-gray-300 hover:text-red-400 px-1"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
          <PixelButton onClick={handleCreate} disabled={saving}>
            {saving ? "创建中..." : "✓ 创建数据表"}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─── Connect Tab ─────────────────────────────────────────────────────────────
type ConnectMode3 = ConnectMode | "blank";

function ConnectTab({ onAdded }: { onAdded: () => void }) {
  const [mode, setMode] = useState<ConnectMode3>("bitable");

  const MODES: { key: ConnectMode3; icon: string; label: string }[] = [
    { key: "bitable", icon: "🪁", label: "飞书多维表格" },
    { key: "db",      icon: "🗄", label: "外部数据库" },
    { key: "blank",   icon: "✦", label: "新建空白表" },
  ];

  return (
    <div className="max-w-3xl">
      {/* Source type toggle */}
      <div className="flex gap-1 mb-5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex items-center gap-2 px-4 py-2 border-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              mode === m.key
                ? "border-[#1A202C] bg-[#1A202C] text-white"
                : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
          >
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {mode === "bitable" ? <BitablePanel onAdded={onAdded} /> :
       mode === "db" ? <DbPanel onAdded={onAdded} /> :
       <CreateBlankPanel onAdded={onAdded} />}
    </div>
  );
}

// ─── Manage Tab ───────────────────────────────────────────────────────────────

// Virtual folder counter for local-only folders (negative IDs)
let _folderSeq = -1;
function nextLocalId() { return _folderSeq--; }

interface VirtualFolder {
  id: number;       // positive = from validation_rules.folder_id convention; we use local map
  name: string;
  parent_id: number | null;
}

// ─── Bitable resync button ────────────────────────────────────────────────────
function BitableResyncButton({ table, onDone }: { table: BusinessTable; onDone: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleResync() {
    setSyncing(true);
    setMsg("");
    try {
      const res = await apiFetch<{ ok: boolean; inserted: number; total_fields: number }>(
        "/business-tables/sync-bitable",
        {
          method: "POST",
          body: JSON.stringify({
            app_token: table.validation_rules.bitable_app_token,
            table_id: table.validation_rules.bitable_table_id,
            display_name: table.display_name,
            sync_table_name: table.table_name,
          }),
        }
      );
      setMsg(`✓ ${res.inserted} 条`);
      onDone();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <PixelBadge color="cyan">飞书 Bitable</PixelBadge>
      <button
        onClick={handleResync}
        disabled={syncing}
        className="px-2 py-0.5 border-2 border-[#00A3C4] text-[#00A3C4] text-[8px] font-bold uppercase hover:bg-[#00A3C4] hover:text-white transition-colors disabled:opacity-40"
      >
        {syncing ? "同步中..." : "⟳ 重新同步"}
      </button>
      {msg && <span className={`text-[9px] font-bold ${msg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{msg}</span>}
    </div>
  );
}

// ─── Access Scope selector (6-level) ─────────────────────────────────────────
function AccessScopeSelector({
  label,
  accessScope,
  userIds,
  roleIds,
  deptIds,
  projectIds,
  departments,
  users,
  projects,
  onChange,
}: {
  label: string;
  accessScope: AccessScope;
  userIds: number[];
  roleIds: string[];
  deptIds: number[];
  projectIds: number[];
  departments: Department[];
  users: UserRow[];
  projects: ProjectGroup[];
  onChange: (patch: {
    access_scope: AccessScope;
    access_user_ids?: number[];
    access_role_ids?: string[];
    access_department_ids?: number[];
    access_project_ids?: number[];
  }) => void;
}) {
  const [userSearch, setUserSearch] = useState("");

  const SCOPE_OPTS: { value: AccessScope; label: string; desc: string }[] = [
    { value: "self", label: "仅自己", desc: "仅创建者和超管可见" },
    { value: "users", label: "指定人员", desc: "多选指定用户可见" },
    { value: "roles", label: "指定角色", desc: "指定岗位角色可见" },
    { value: "departments", label: "指定部门", desc: "仅选中部门成员可见" },
    { value: "projects", label: "指定项目组", desc: "指定项目组成员可见" },
    { value: "company", label: "全公司", desc: "所有人可见" },
  ];

  function toggleUser(id: number) {
    const next = userIds.includes(id) ? userIds.filter((u) => u !== id) : [...userIds, id];
    onChange({ access_scope: "users", access_user_ids: next });
  }

  function toggleRole(role: string) {
    const next = roleIds.includes(role) ? roleIds.filter((r) => r !== role) : [...roleIds, role];
    onChange({ access_scope: "roles", access_role_ids: next });
  }

  function toggleDept(id: number) {
    const next = deptIds.includes(id) ? deptIds.filter((d) => d !== id) : [...deptIds, id];
    onChange({ access_scope: "departments", access_department_ids: next });
  }

  function toggleProject(id: number) {
    const next = projectIds.includes(id) ? projectIds.filter((p) => p !== id) : [...projectIds, id];
    onChange({ access_scope: "projects", access_project_ids: next });
  }

  function handleScopeChange(s: AccessScope) {
    const patch: Parameters<typeof onChange>[0] = { access_scope: s };
    if (s === "users") patch.access_user_ids = userIds;
    else if (s === "roles") patch.access_role_ids = roleIds;
    else if (s === "departments") patch.access_department_ids = deptIds;
    else if (s === "projects") patch.access_project_ids = projectIds;
    onChange(patch);
  }

  const filteredUsers = userSearch
    ? users.filter((u) => u.display_name.includes(userSearch) || u.username.includes(userSearch))
    : users;

  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SCOPE_OPTS.map((o) => (
          <button
            key={o.value}
            title={o.desc}
            onClick={() => handleScopeChange(o.value)}
            className={`px-2.5 py-1 border-2 text-[9px] font-bold uppercase tracking-wide transition-colors ${
              accessScope === o.value
                ? "border-[#1A202C] bg-[#1A202C] text-white"
                : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* 指定人员 */}
      {accessScope === "users" && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="搜索用户..."
            className="w-full border-2 border-gray-200 px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-[#00D1FF]"
          />
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => toggleUser(u.id)}
                className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                  userIds.includes(u.id)
                    ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                    : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
                }`}
              >
                {userIds.includes(u.id) ? "✓ " : ""}{u.display_name}
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <span className="text-[9px] text-gray-400">无匹配用户</span>
            )}
          </div>
          {userIds.length > 0 && (
            <div className="text-[8px] text-gray-400">已选 {userIds.length} 人</div>
          )}
        </div>
      )}

      {/* 指定角色 */}
      {accessScope === "roles" && (
        <div className="flex flex-wrap gap-1">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => toggleRole(r.value)}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                roleIds.includes(r.value)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {roleIds.includes(r.value) ? "✓ " : ""}{r.label}
            </button>
          ))}
        </div>
      )}

      {/* 指定部门 */}
      {accessScope === "departments" && departments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => toggleDept(d.id)}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                deptIds.includes(d.id)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {deptIds.includes(d.id) ? "✓ " : ""}{d.name}
            </button>
          ))}
        </div>
      )}

      {/* 指定项目组 */}
      {accessScope === "projects" && (
        <div className="flex flex-wrap gap-1">
          {projects.length > 0 ? projects.map((p) => (
            <button
              key={p.id}
              onClick={() => toggleProject(p.id)}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                projectIds.includes(p.id)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {projectIds.includes(p.id) ? "✓ " : ""}{p.name}
            </button>
          )) : (
            <span className="text-[9px] text-gray-400">暂无项目组</span>
          )}
        </div>
      )}
    </div>
  );
}

// Legacy wrapper for backward compatibility (column_scope / row_scope)
function ScopeSelector({
  label,
  scope,
  deptIds,
  departments,
  onChange,
}: {
  label: string;
  scope: ScopeValue;
  deptIds: number[];
  departments: Department[];
  onChange: (scope: ScopeValue, deptIds: number[]) => void;
}) {
  const SCOPE_OPTS: { value: ScopeValue; label: string; desc: string }[] = [
    { value: "all", label: "全公司", desc: "所有人可见" },
    { value: "department", label: "指定部门", desc: "仅选中部门成员可见" },
    { value: "private", label: "仅管理员", desc: "普通用户不可见" },
  ];

  function toggleDept(id: number) {
    const next = deptIds.includes(id) ? deptIds.filter((d) => d !== id) : [...deptIds, id];
    onChange(scope, next);
  }

  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}</div>
      <div className="flex gap-1.5 mb-2">
        {SCOPE_OPTS.map((o) => (
          <button
            key={o.value}
            title={o.desc}
            onClick={() => onChange(o.value, o.value === "department" ? deptIds : [])}
            className={`px-2.5 py-1 border-2 text-[9px] font-bold uppercase tracking-wide transition-colors ${
              scope === o.value
                ? "border-[#1A202C] bg-[#1A202C] text-white"
                : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {scope === "department" && departments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => toggleDept(d.id)}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                deptIds.includes(d.id)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {deptIds.includes(d.id) ? "✓ " : ""}{d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── View types ───────────────────────────────────────────────────────────────
interface ViewFilter {
  field: string;
  op: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "starts" | "ends";
  value: string;
}

interface ViewSort {
  field: string;
  dir: "asc" | "desc";
}

interface TableViewConfig {
  filters: ViewFilter[];
  sorts: ViewSort[];
  group_by: string;
  hidden_columns: string[];
  column_widths: Record<string, number>;
}

interface TableView {
  id: number;
  table_id: number;
  name: string;
  view_type: string;
  config: TableViewConfig;
  created_by: number | null;
}

interface SkillDataView {
  view_id: string;
  view_name: string;
  skill_id: number;
  skill_name: string;
  allowed_fields: string[];
  row_filters: ViewFilter[];
}

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: string;
  department_id: number | null;
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "sales", label: "商务" },
  { value: "planner", label: "策划" },
  { value: "finance", label: "财务" },
  { value: "hr", label: "HR" },
  { value: "management", label: "管理层" },
];

interface ProjectGroup {
  id: number;
  name: string;
}

const OP_LABELS: Record<string, string> = {
  eq: "等于", ne: "不等于", gt: "大于", gte: "大于等于",
  lt: "小于", lte: "小于等于", contains: "包含", starts: "开头是", ends: "结尾是",
};

// ─── View Bar ─────────────────────────────────────────────────────────────────
function ViewBar({
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

// ─── Editable Cell ────────────────────────────────────────────────────────────
function EditableCell({
  value,
  fieldMeta,
  onSave,
  readOnly,
}: {
  value: unknown;
  fieldMeta?: FieldMeta;
  onSave: (v: string) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState<{ source: unknown; text: string }>({ source: value, text: formatCellValue(value) });
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // Reset edit value when the prop changes (instead of setState in effect)
  if (editVal.source !== value) {
    setEditVal({ source: value, text: formatCellValue(value) });
  }
  const val = editVal.text;
  const setVal = (text: string) => setEditVal({ source: value, text });

  useEffect(() => { if (editing) (inputRef.current as HTMLElement | null)?.focus(); }, [editing]);

  if (readOnly) {
    return (
      <span className="text-gray-700 font-mono">
        {value === null || value === undefined ? <span className="text-gray-300">NULL</span> : formatCellValue(value)}
      </span>
    );
  }

  if (!editing) {
    return (
      <span
        className="text-gray-700 font-mono cursor-text hover:bg-[#F0F8FF] px-0.5 rounded min-w-[20px] inline-block"
        onDoubleClick={() => { setVal(formatCellValue(value)); setEditing(true); }}
        title="双击编辑"
      >
        {value === null || value === undefined ? <span className="text-gray-200">—</span> : formatCellValue(value)}
      </span>
    );
  }

  function commit() {
    setEditing(false);
    if (val !== formatCellValue(value)) onSave(val);
  }

  const ft = fieldMeta?.field_type;

  if (ft === "select" && fieldMeta?.options?.length) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        className="border border-[#00D1FF] text-[9px] px-1 py-0.5 bg-white focus:outline-none"
      >
        <option value="">—</option>
        {fieldMeta.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (ft === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={val === "1" || val === "true"}
        onChange={(e) => { const v = e.target.checked ? "1" : "0"; setVal(v); onSave(v); setEditing(false); }}
        className="w-3 h-3"
      />
    );
  }

  if (ft === "date") {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="datetime-local"
        value={val.slice(0, 16)}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="border border-[#00D1FF] text-[9px] px-1 py-0.5 focus:outline-none"
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={ft === "number" ? "number" : "text"}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      className="border border-[#00D1FF] text-[9px] px-1 py-0.5 min-w-[60px] max-w-[200px] focus:outline-none bg-white"
    />
  );
}

// ─── Add Column Modal ─────────────────────────────────────────────────────────
function AddColumnModal({ tableId, onDone, onClose }: { tableId: number; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!name.trim()) { setError("字段名不能为空"); return; }
    setSaving(true); setError("");
    try {
      await apiFetch(`/business-tables/${tableId}/columns`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          field_type: fieldType,
          options: options.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      onDone();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white border-2 border-[#1A202C] w-80 p-4 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">新增列</div>
        <div>
          <label className="block text-[9px] font-bold text-gray-500 mb-1">字段名称 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-[#00D1FF]"
            placeholder="例：备注" autoFocus />
        </div>
        <div>
          <label className="block text-[9px] font-bold text-gray-500 mb-1">类型</label>
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value as FieldType)}
            className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[10px] bg-white focus:outline-none">
            {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
              <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        {(fieldType === "select" || fieldType === "multi_select") && (
          <div>
            <label className="block text-[9px] font-bold text-gray-500 mb-1">选项（逗号分隔）</label>
            <input value={options} onChange={(e) => setOptions(e.target.value)}
              placeholder="选项1,选项2,选项3"
              className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[11px] focus:outline-none focus:border-[#00D1FF]" />
          </div>
        )}
        {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
        <div className="flex gap-2 pt-1">
          <PixelButton onClick={handleAdd} disabled={saving}>{saving ? "添加中..." : "✓ 添加"}</PixelButton>
          <PixelButton variant="secondary" onClick={onClose}>取消</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─── Skill Data View Panel ────────────────────────────────────────────────────
function SkillDataViewPanel({
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

// ─── Preview panel ────────────────────────────────────────────────────────────
const READONLY_COLS = new Set(["id", "created_at", "updated_at", "_record_id", "_synced_at"]);

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
  // Sync nameVal when table prop changes (instead of setState in effect)
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

  // New 6-level access scope
  const tableAccessScope: AccessScope = (table.validation_rules?.access_scope as AccessScope) ?? "self";
  const tableAccessUserIds: number[] = (table.validation_rules?.access_user_ids as number[]) ?? [];
  const tableAccessRoleIds: string[] = (table.validation_rules?.access_role_ids as string[]) ?? [];
  const tableAccessDeptIds: number[] = (table.validation_rules?.access_department_ids as number[]) ?? [];
  const tableAccessProjectIds: number[] = (table.validation_rules?.access_project_ids as number[]) ?? [];

  // Users & projects for access scope selector
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectGroup[]>([]);

  useEffect(() => {
    apiFetch<UserRow[]>("/admin/users")
      .then(setAllUsers)
      .catch(() => setAllUsers([]));
    apiFetch<ProjectGroup[]>("/admin/projects")
      .then(setAllProjects)
      .catch(() => setAllProjects([]));
  }, []);

  // Skill data views
  const skillDataViews: SkillDataView[] = (table.validation_rules?.skill_data_views as SkillDataView[]) ?? [];
  const referencedSkills: string[] = table.referenced_skills ?? [];

  // Is this a blank (user-created) table — has field_meta
  const isEditable = fieldMeta.length > 0 || table.table_name.startsWith("usr_");

  // ── 自动推断同步表列类型（枚举检测）──
  // 对没有 field_meta 的同步表，从行数据自动推断每列的类型
  const inferredColTypes = React.useMemo(() => {
    const result: Record<string, { type: "enum" | "number" | "date" | "text" | "boolean"; uniqueValues?: string[] }> = {};
    if (fieldMeta.length > 0 || rows.length === 0) return result; // 有 field_meta 时不推断

    const MIN_ROWS_FOR_ENUM = 3;
    const MAX_ENUM_VALUES = 20;
    const MAX_ENUM_RATIO = 0.6; // 唯一值 / 非空行数 ≤ 60% 才算枚举

    for (const col of cols) {
      if (READONLY_COLS.has(col)) continue;
      const nonNullValues = rows
        .map((r) => r[col])
        .filter((v) => v !== null && v !== undefined && v !== "");
      if (nonNullValues.length === 0) continue;

      // 检测布尔
      const strValues = nonNullValues.map((v) => String(v).toLowerCase());
      const boolSet = new Set(strValues);
      if (boolSet.size <= 2 && [...boolSet].every((v) => ["true", "false", "0", "1", "是", "否", "yes", "no"].includes(v))) {
        result[col] = { type: "boolean" };
        continue;
      }

      // 检测数字
      if (nonNullValues.every((v) => typeof v === "number" || (typeof v === "string" && !isNaN(Number(v)) && v.trim() !== ""))) {
        result[col] = { type: "number" };
        continue;
      }

      // 检测日期（时间戳或日期字符串）
      if (nonNullValues.every((v) => {
        if (typeof v === "number") return (v >= 1e9 && v <= 9.999e12);
        if (typeof v === "string") return !isNaN(Date.parse(v)) && /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(v);
        return false;
      })) {
        result[col] = { type: "date" };
        continue;
      }

      // 检测枚举：唯一值少、行数足够
      const uniqueSet = new Set(nonNullValues.map((v) => formatCellValue(v)));
      if (
        nonNullValues.length >= MIN_ROWS_FOR_ENUM &&
        uniqueSet.size <= MAX_ENUM_VALUES &&
        uniqueSet.size / nonNullValues.length <= MAX_ENUM_RATIO
      ) {
        result[col] = { type: "enum", uniqueValues: [...uniqueSet].sort() };
        continue;
      }

      result[col] = { type: "text" };
    }
    return result;
  }, [cols, rows, fieldMeta.length]);

  // 判断列是否为自由文本（不可用于分组/筛选权限）
  function isTextColumn(colName: string): boolean {
    // 有 field_meta 时根据 field_type 判断
    const fm = fieldMeta.find((m) => m.name === colName);
    if (fm) return fm.field_type === "text" || fm.field_type === "url" || fm.field_type === "email" || fm.field_type === "phone";
    // 无 field_meta 时根据推断类型判断
    const inferred = inferredColTypes[colName];
    return !inferred || inferred.type === "text";
  }

  // 可用于分组/筛选的列（排除自由文本）
  const groupableColumns = cols.filter((c) => !READONLY_COLS.has(c) && !isTextColumn(c));

  const loadRows = useCallback((viewId?: number | null) => {
    setLoadingRows(true);
    setRowsError("");
    const qs = viewId ? `?page=1&page_size=100&view_id=${viewId}` : "?page=1&page_size=100";
    apiFetch<{ columns: string[]; rows: Record<string, unknown>[] }>(
      `/data/${table.table_name}/rows${qs}`
    )
      .then((d) => {
        setCols(d.columns ?? []);
        setRows(d.rows ?? []);
      })
      .catch((e: unknown) => {
        setCols([]); setRows([]);
        setRowsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoadingRows(false));
  }, [table.table_name]);

  function handleViewChange(viewId: number | null) {
    setActiveViewId(viewId);
    loadRows(viewId);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
  useEffect(() => { loadRows(); }, [loadRows]);
  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);

  // Close context menu on outside click
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
      await apiFetch(`/data/${table.table_name}/rows/${rowId}`, {
        method: "PUT",
        body: JSON.stringify({ data: { [col]: value || null } }),
      });
      setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, [col]: value } : r));
    } catch {
      // silently ignore
    }
  }

  async function handleAddRow() {
    const data: Record<string, string | null> = {};
    editableCols.forEach((c) => { data[c] = newRowData[c] ?? null; });
    try {
      await apiFetch(`/data/${table.table_name}/rows`, {
        method: "POST",
        body: JSON.stringify({ data }),
      });
      setAddingRow(false);
      setNewRowData({});
      loadRows();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "新增失败");
    }
  }

  async function handleDeleteRow(rowId: number) {
    if (!confirm("确认删除这行数据？")) return;
    try {
      await apiFetch(`/data/${table.table_name}/rows/${rowId}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== rowId));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  async function handleDropColumn(colName: string) {
    if (!confirm(`确认删除列「${colName}」及其所有数据？`)) return;
    try {
      await apiFetch(`/business-tables/${table.id}/columns/${colName}`, { method: "DELETE" });
      onRename(table.id, table.display_name); // trigger parent refresh
      loadRows();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除列失败");
    }
  }

  const visibleCols = cols.filter((c) => !hidden.includes(c));
  const editableCols = visibleCols.filter((c) => !READONLY_COLS.has(c));

  function getFieldMeta(colName: string): FieldMeta | undefined {
    return fieldMeta.find((m) => m.name === colName);
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white flex flex-col" onClick={() => setContextMenu(null)}>
      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border-2 border-[#1A202C] shadow-lg py-1 w-28"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { handleDeleteRow(contextMenu.rowId); setContextMenu(null); }}
            className="w-full text-left px-3 py-1.5 text-[10px] font-bold text-red-500 hover:bg-red-50"
          >
            🗑 删除行
          </button>
        </div>
      )}

      {/* Add column modal */}
      {showAddCol && (
        <AddColumnModal
          tableId={table.id}
          onDone={() => { onRename(table.id, table.display_name); loadRows(); }}
          onClose={() => setShowAddCol(false)}
        />
      )}

      {/* Header */}
      <div className="px-5 py-4 border-b-2 border-[#1A202C] flex-shrink-0 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="text-sm font-bold border-2 border-[#00D1FF] px-2 py-0.5 focus:outline-none w-full"
            />
          ) : (
            <h2
              className="text-sm font-bold cursor-pointer hover:text-[#00A3C4] transition-colors"
              onClick={() => setEditingName(true)}
              title="点击重命名"
            >
              {table.display_name}
            </h2>
          )}
          <p className="text-[9px] text-gray-400 font-mono mt-0.5">{table.table_name}</p>
        </div>
        <PixelBadge color="gray">{table.columns.length} 列</PixelBadge>
        {isEditable && (
          <button
            onClick={() => setShowAddCol(true)}
            className="text-[9px] font-bold px-2 py-1 border-2 border-[#00A3C4] text-[#00A3C4] hover:bg-[#00A3C4] hover:text-white transition-colors flex-shrink-0"
          >
            + 新增列
          </button>
        )}
        {table.validation_rules?.bitable_app_token && (
          <BitableResyncButton table={table} onDone={() => onRename(table.id, table.display_name)} />
        )}
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 border-2 border-[#1A202C] bg-white hover:bg-[#F0F4F8] transition-colors flex-shrink-0"
        >
          {showSettings ? "▾ 收起设置" : "▸ 范围 / 字段"}
        </button>
      </div>

      {/* ── 访问范围 + 字段管理 + Skill 数据视图（可折叠）── */}
      {showSettings && (
        <>
          {/* 数据表访问权限（六级） */}
          <div className="px-5 py-3 border-b-2 border-[#1A202C] flex-shrink-0 bg-[#FAFCFD]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">— 数据表访问权限</div>
            <div className="mb-4">
              <AccessScopeSelector
                label="谁可以访问这张表"
                accessScope={tableAccessScope}
                userIds={tableAccessUserIds}
                roleIds={tableAccessRoleIds}
                deptIds={tableAccessDeptIds}
                projectIds={tableAccessProjectIds}
                departments={departments}
                users={allUsers}
                projects={allProjects}
                onChange={(patch) => onScopeChange(table.id, patch)}
              />
              <div className="text-[8px] text-gray-400 mt-2">超管始终可见</div>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">— 列/行可见范围（细粒度）</div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3">
              <ScopeSelector
                label="列数据可见范围"
                scope={colScope}
                deptIds={colDeptIds}
                departments={departments}
                onChange={(s, ids) => onScopeChange(table.id, { column_scope: s, column_department_ids: ids })}
              />
              <ScopeSelector
                label="行数据可见范围"
                scope={rowScope}
                deptIds={rowDeptIds}
                departments={departments}
                onChange={(s, ids) => onScopeChange(table.id, { row_scope: s, row_department_ids: ids })}
              />
            </div>
          </div>

          {/* 列字段管理 */}
          <div className="px-5 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              列字段管理<span className="text-gray-300 ml-1 normal-case">（点击隐藏）</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {table.columns.map((c) => {
                const isHidden = hidden.includes(c.name);
                return (
                  <div key={c.name} className="inline-flex items-center gap-0.5 group">
                    <button
                      onClick={() => onToggleField(table.id, c.name, !isHidden)}
                      title={isHidden ? "已隐藏，点击恢复" : "点击隐藏"}
                      className={`inline-flex items-center gap-1.5 border-2 px-2 py-0.5 text-[9px] font-bold transition-colors ${
                        isHidden
                          ? "border-gray-200 text-gray-300 bg-gray-50"
                          : "border-[#1A202C] text-[#1A202C] bg-white hover:border-[#00A3C4] hover:text-[#00A3C4]"
                      }`}
                    >
                      <span>{isHidden ? "○" : "●"}</span>
                      {c.name}
                      <span className="text-[8px] font-mono opacity-60">{c.type}</span>
                    </button>
                    {isEditable && !READONLY_COLS.has(c.name) && (
                      <button
                        onClick={() => handleDropColumn(c.name)}
                        className="hidden group-hover:inline text-[9px] text-gray-300 hover:text-red-400 px-0.5"
                        title="删除列"
                      >✕</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skill 数据视图 */}
          <SkillDataViewPanel
            tableId={table.id}
            columns={cols.length > 0 ? cols : table.columns.map((c) => c.name)}
            filterableColumns={groupableColumns.length > 0 ? groupableColumns : undefined}
            referencedSkills={referencedSkills}
            views={skillDataViews}
            onSave={(views) => onScopeChange(table.id, { skill_data_views: views })}
          />
        </>
      )}

      {/* ── 视图栏 ── */}
      <ViewBar
        tableId={table.id}
        cols={cols}
        activeViewId={activeViewId}
        onChangeView={handleViewChange}
      />

      {/* ── 数据区域 ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loadingRows ? (
          <div className="flex items-center justify-center h-32 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
            Loading...
          </div>
        ) : rowsError ? (
          <div className="flex items-center justify-center h-32 text-[10px] font-bold text-red-500">
            {rowsError}
          </div>
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
                    const INFERRED_COLORS: Record<string, string> = {
                      enum: "bg-purple-100 text-purple-600",
                      number: "bg-blue-50 text-blue-500",
                      date: "bg-orange-50 text-orange-500",
                      boolean: "bg-green-50 text-green-600",
                      text: "bg-gray-50 text-gray-400",
                    };
                    return (
                      <th
                        key={c}
                        className="text-left px-3 py-2 font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C] border-r border-gray-200 whitespace-nowrap"
                      >
                        {c}
                        {fm ? (
                          <span className="text-[7px] text-gray-400 ml-1 normal-case font-normal">
                            {FIELD_TYPE_LABELS[fm.field_type]}
                          </span>
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
                  <tr
                    key={String(row.id ?? i)}
                    className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FBFD]"}`}
                    onContextMenu={(e) => {
                      if (!isEditable || !row.id) return;
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, rowId: row.id as number });
                    }}
                  >
                    {isEditable && (
                      <td className="w-6 border-r border-gray-100 text-center">
                        <button
                          onClick={() => row.id && handleDeleteRow(row.id as number)}
                          className="text-[8px] text-gray-200 hover:text-red-400 px-1"
                          title="删除行"
                        >✕</button>
                      </td>
                    )}
                    {visibleCols.map((c) => {
                      const inferred = inferredColTypes[c];
                      const cellVal = row[c];
                      const isEnum = inferred?.type === "enum";
                      const isBool = inferred?.type === "boolean";
                      return (
                        <td
                          key={c}
                          className="px-3 py-1.5 border-r border-gray-100 whitespace-nowrap max-w-[240px] truncate"
                          title={formatCellValue(cellVal)}
                        >
                          {isEnum && cellVal != null ? (
                            <span className="inline-block border border-purple-200 bg-purple-50 text-purple-700 px-1.5 py-px text-[9px] font-bold rounded">
                              {formatCellValue(cellVal)}
                            </span>
                          ) : isBool && cellVal != null ? (
                            <span className={`inline-block px-1.5 py-px text-[9px] font-bold rounded ${
                              ["true", "1", "是", "yes"].includes(String(cellVal).toLowerCase())
                                ? "bg-green-50 text-green-600 border border-green-200"
                                : "bg-gray-50 text-gray-400 border border-gray-200"
                            }`}>
                              {["true", "1", "是", "yes"].includes(String(cellVal).toLowerCase()) ? "是" : "否"}
                            </span>
                          ) : (
                            <EditableCell
                              value={cellVal}
                              fieldMeta={getFieldMeta(c)}
                              readOnly={!isEditable || READONLY_COLS.has(c)}
                              onSave={(v) => row.id && handleCellSave(row.id as number, c, v)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* New row input */}
                {addingRow && (
                  <tr className="border-t-2 border-[#00D1FF] bg-[#F0FBFF]">
                    {isEditable && <td className="w-6 border-r border-gray-100" />}
                    {visibleCols.map((c) => (
                      <td key={c} className="px-1 py-1 border-r border-gray-100">
                        {READONLY_COLS.has(c) ? (
                          <span className="text-[9px] text-gray-300 px-2">auto</span>
                        ) : (
                          <input
                            value={newRowData[c] ?? ""}
                            onChange={(e) => setNewRowData((prev) => ({ ...prev, [c]: e.target.value }))}
                            className="border border-[#00D1FF] text-[9px] px-1 py-0.5 w-full focus:outline-none bg-white"
                            placeholder={c}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>

            {/* Add row / confirm buttons */}
            {isEditable && (
              <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-100">
                {!addingRow ? (
                  <button
                    onClick={() => { setAddingRow(true); setNewRowData({}); }}
                    className="text-[9px] font-bold text-[#00A3C4] hover:text-[#008BA3] flex items-center gap-1"
                  >
                    + 新增行
                  </button>
                ) : (
                  <>
                    <PixelButton size="sm" onClick={handleAddRow}>✓ 保存</PixelButton>
                    <PixelButton size="sm" variant="secondary" onClick={() => { setAddingRow(false); setNewRowData({}); }}>取消</PixelButton>
                  </>
                )}
                {rows.length === 0 && !addingRow && (
                  <span className="text-[9px] text-gray-300 ml-2">暂无数据</span>
                )}
              </div>
            )}
            {!isEditable && rows.length === 0 && (
              <div className="flex items-center justify-center h-24 text-[10px] font-bold uppercase tracking-widest text-gray-300">
                暂无数据
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Table row in tree
function TableRow({
  table,
  selected,
  depth,
  onClick,
  onDragStart,
  isDragging,
}: {
  table: BusinessTable;
  selected: boolean;
  depth: number;
  onClick: () => void;
  onDragStart: (id: number) => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.dataTransfer.setData("tableId", String(table.id));
        onDragStart(table.id);
      }}
      className={`flex items-center gap-2 py-1.5 select-none border-b border-gray-100 cursor-pointer transition-opacity group ${
        isDragging
          ? "opacity-40 cursor-grabbing"
          : selected
          ? "bg-[#CCF2FF]"
          : "hover:bg-white"
      }`}
      style={{ paddingLeft: `${8 + depth * 16 + 20}px`, paddingRight: "8px" }}
    >
      <ThemedIcon size={12} />
      <span className="flex-1 text-[10px] font-bold truncate">
        {table.display_name}
      </span>
      <span className="text-[8px] font-mono text-gray-400 hidden group-hover:inline">
        {table.table_name}
      </span>
    </div>
  );
}

// Folder node
function FolderNode({
  folder,
  subFolders: childFolders,
  tables,
  selectedId,
  onSelectTable,
  onRenameFolder,
  onDeleteFolder,
  onNewSubfolder,
  onDropTable,
  draggingTableId,
  onDragStart,
  depth,
}: {
  folder: VirtualFolder;
  subFolders: VirtualFolder[];
  tables: BusinessTable[];
  selectedId: number | null;
  onSelectTable: (t: BusinessTable) => void;
  onRenameFolder: (id: number, name: string) => void;
  onDeleteFolder: (id: number) => void;
  onNewSubfolder: (parentId: number, name: string) => void;
  onDropTable: (tableId: number, folderId: number | null) => void;
  draggingTableId: number | null;
  onDragStart: (id: number) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const childRef = useRef<HTMLInputElement>(null);
  const [dropTarget, setDropTarget] = useState(false);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  function submitRename() {
    if (nameVal.trim() && nameVal.trim() !== folder.name) onRenameFolder(folder.id, nameVal.trim());
    setRenaming(false);
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 group select-none transition-colors ${
          dropTarget && draggingTableId !== null
            ? "bg-[#CCF2FF] border-l-2 border-[#00D1FF]"
            : "hover:bg-white"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: "8px" }}
        onDragOver={(e) => { if (draggingTableId !== null) { e.preventDefault(); setDropTarget(true); } }}
        onDragLeave={() => setDropTarget(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropTarget(false);
          const id = parseInt(e.dataTransfer.getData("tableId"));
          if (!isNaN(id)) { onDropTable(id, folder.id); setOpen(true); }
        }}
      >
        <span
          className="text-[10px] w-4 text-gray-400 flex-shrink-0 cursor-pointer hover:text-[#00A3C4] text-center"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          {open ? "▾" : "▸"}
        </span>
        <span className="mr-1 flex-shrink-0 text-[9px]">📁</span>
        {renaming ? (
          <input
            ref={inputRef}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-[10px] font-bold border border-[#00D1FF] px-1 focus:outline-none bg-white"
          />
        ) : (
          <span
            className="flex-1 text-[10px] font-bold truncate cursor-pointer"
            onClick={() => setOpen((v) => !v)}
          >
            {folder.name}
          </span>
        )}
        {!renaming && (
          <span className="hidden group-hover:flex items-center gap-1 ml-1 flex-shrink-0">
            <button
              className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5"
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setNameVal(folder.name); }}
              title="重命名"
            >✎</button>
            <button
              className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5"
              onClick={(e) => {
                e.stopPropagation();
                setAddingChild(true);
                setChildName("");
                setOpen(true);
                setTimeout(() => childRef.current?.focus(), 30);
              }}
              title="新建子文件夹"
            >+</button>
            <button
              className="text-[8px] text-gray-400 hover:text-red-400 px-0.5"
              onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
              title="删除"
            >✕</button>
          </span>
        )}
      </div>

      {open && (
        <>
          {childFolders.map((cf) => (
            <FolderNode
              key={cf.id}
              folder={cf}
              subFolders={[]}
              tables={tables.filter((t) => (t.validation_rules?.folder_id ?? null) === cf.id)}
              selectedId={selectedId}
              onSelectTable={onSelectTable}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onNewSubfolder={onNewSubfolder}
              onDropTable={onDropTable}
              draggingTableId={draggingTableId}
              onDragStart={onDragStart}
              depth={depth + 1}
            />
          ))}
          {addingChild && (
            <div
              className="flex items-center gap-1 py-1"
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px`, paddingRight: "8px" }}
            >
              <input
                ref={childRef}
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { if (childName.trim()) onNewSubfolder(folder.id, childName.trim()); setAddingChild(false); }
                  if (e.key === "Escape") setAddingChild(false);
                }}
                placeholder="文件夹名称"
                className="flex-1 text-[10px] border-2 border-[#00D1FF] px-1.5 py-0.5 focus:outline-none font-bold bg-white"
              />
              <button
                onClick={() => { if (childName.trim()) onNewSubfolder(folder.id, childName.trim()); setAddingChild(false); }}
                className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4]"
              >✓</button>
              <button
                onClick={() => setAddingChild(false)}
                className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-400"
              >✕</button>
            </div>
          )}
          {tables.map((t) => (
            <TableRow
              key={t.id}
              table={t}
              selected={selectedId === t.id}
              depth={depth}
              onClick={() => onSelectTable(t)}
              onDragStart={onDragStart}
              isDragging={draggingTableId === t.id}
            />
          ))}
        </>
      )}
    </div>
  );
}

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
    } catch {
      setAllTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();
    apiFetch<Department[]>("/admin/departments")
      .then((d) => setDepartments(Array.isArray(d) ? d : []))
      .catch(() => setDepartments([]));
  }, [fetchTables]);

  async function handleRenameTable(id: number, name: string) {
    await apiFetch(`/business-tables/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ display_name: name }),
    });
    await fetchTables();
  }

  async function handleToggleField(tableId: number, field: string, hide: boolean) {
    const table = allTables.find((t) => t.id === tableId);
    if (!table) return;
    const current = table.validation_rules?.hidden_fields ?? [];
    const next = hide
      ? [...new Set([...current, field])]
      : current.filter((f) => f !== field);
    await apiFetch(`/business-tables/${tableId}`, {
      method: "PATCH",
      body: JSON.stringify({ hidden_fields: next }),
    });
    await fetchTables();
  }

  async function handleScopeChange(tableId: number, patch: Partial<BusinessTable["validation_rules"]>) {
    await apiFetch(`/business-tables/${tableId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    await fetchTables();
  }

  async function handleDropTable(tableId: number, folderId: number | null) {
    await apiFetch(`/business-tables/${tableId}`, {
      method: "PATCH",
      body: JSON.stringify({ folder_id: folderId ?? 0 }),
    });
    setDraggingTableId(null);
    await fetchTables();
  }

  function handleNewRootFolder() {
    if (!newRootName.trim()) { setNewRootFolder(false); return; }
    const f: VirtualFolder = { id: nextLocalId(), name: newRootName.trim(), parent_id: null };
    setFolders((prev) => [...prev, f]);
    setNewRootFolder(false);
    setNewRootName("");
  }

  function handleNewSubfolder(parentId: number, name: string) {
    const f: VirtualFolder = { id: nextLocalId(), name, parent_id: parentId };
    setFolders((prev) => [...prev, f]);
  }

  function handleRenameFolder(id: number, name: string) {
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, name } : f));
  }

  function handleDeleteFolder(id: number) {
    // Move tables out of this folder
    const tables = allTables.filter((t) => (t.validation_rules?.folder_id ?? null) === id);
    Promise.all(tables.map((t) =>
      apiFetch(`/business-tables/${t.id}`, { method: "PATCH", body: JSON.stringify({ folder_id: 0 }) })
    )).then(() => {
      setFolders((prev) => prev.filter((f) => f.id !== id && f.parent_id !== id));
      fetchTables();
    });
  }

  const rootFolders = folders.filter((f) => f.parent_id === null);

  // Tables with no folder assignment (folder_id = 0 or undefined/null)
  const unassignedTables = allTables.filter(
    (t) => !t.validation_rules?.folder_id || t.validation_rules.folder_id === 0
  );

  // For each folder, get its direct tables
  function tablesInFolder(folderId: number) {
    return allTables.filter((t) => t.validation_rules?.folder_id === folderId);
  }

  return (
    <div className="flex h-full border-2 border-[#1A202C]" onDragEnd={() => setDraggingTableId(null)}>
      {/* Left: tree */}
      <div className="w-72 flex-shrink-0 border-r-2 border-[#1A202C] flex flex-col bg-[#F0F4F8]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b-2 border-[#1A202C] flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            数据表
          </span>
          <button
            onClick={() => { setNewRootFolder(true); setNewRootName(""); setTimeout(() => rootInputRef.current?.focus(), 30); }}
            className="flex items-center gap-1 px-2 py-1 border-2 border-[#1A202C] bg-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#1A202C] hover:text-white transition-colors"
          >
            + 文件夹
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto"
          onDragEnd={() => setDraggingTableId(null)}
        >
          {loading ? (
            <div className="text-[9px] text-gray-400 px-3 py-4">Loading...</div>
          ) : (
            <>
              {/* New root folder input */}
              {newRootFolder && (
                <div className="flex items-center gap-1 px-2 py-1 border-b border-[#CBD5E0]">
                  <input
                    ref={rootInputRef}
                    value={newRootName}
                    onChange={(e) => setNewRootName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleNewRootFolder();
                      if (e.key === "Escape") setNewRootFolder(false);
                    }}
                    placeholder="文件夹名称"
                    className="flex-1 text-[10px] border-2 border-[#00D1FF] px-1.5 py-0.5 focus:outline-none font-bold bg-white"
                  />
                  <button onClick={handleNewRootFolder} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4]">✓</button>
                  <button onClick={() => setNewRootFolder(false)} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-400">✕</button>
                </div>
              )}

              {/* Root folders */}
              {rootFolders.map((f) => {
                const childFolders = folders.filter((cf) => cf.parent_id === f.id);
                return (
                  <FolderNode
                    key={f.id}
                    folder={f}
                    subFolders={childFolders}
                    tables={tablesInFolder(f.id)}
                    selectedId={selectedTable?.id ?? null}
                    onSelectTable={setSelectedTable}
                    onRenameFolder={handleRenameFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onNewSubfolder={handleNewSubfolder}
                    onDropTable={handleDropTable}
                    draggingTableId={draggingTableId}
                    onDragStart={setDraggingTableId}
                    depth={0}
                  />
                );
              })}

              {/* Unassigned tables (root drop zone) */}
              <div
                className={`min-h-[4px] transition-colors ${rootDropTarget && draggingTableId !== null ? "bg-[#CCF2FF]" : ""}`}
                onDragOver={(e) => { if (draggingTableId !== null) { e.preventDefault(); setRootDropTarget(true); } }}
                onDragLeave={() => setRootDropTarget(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setRootDropTarget(false);
                  const id = parseInt(e.dataTransfer.getData("tableId"));
                  if (!isNaN(id)) handleDropTable(id, null);
                }}
              >
                {rootDropTarget && draggingTableId !== null && (
                  <div className="mx-2 my-1 border-2 border-dashed border-[#00D1FF] px-2 py-1 text-center text-[9px] font-bold text-[#00A3C4] uppercase tracking-widest">
                    移出文件夹
                  </div>
                )}
                {unassignedTables.map((t) => (
                  <TableRow
                    key={t.id}
                    table={t}
                    selected={selectedTable?.id === t.id}
                    depth={0}
                    onClick={() => setSelectedTable(t)}
                    onDragStart={setDraggingTableId}
                    isDragging={draggingTableId === t.id}
                  />
                ))}
              </div>

              {allTables.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-[9px] text-gray-400 uppercase tracking-widest">
                  <div className="mb-3 opacity-40">
                    <ThemedIcon size={28} />
                  </div>
                  暂无数据表，先去连接数据源
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right: preview */}
      {selectedTable ? (
        <TablePreview
          table={selectedTable}
          departments={departments}
          onRename={handleRenameTable}
          onToggleField={handleToggleField}
          onScopeChange={handleScopeChange}
        />
      ) : (
        <div className="flex-1 bg-white flex flex-col items-center justify-center text-[9px] text-gray-400 uppercase tracking-widest">
          <div className="mb-3 opacity-40">
            <ThemedIcon size={32} />
          </div>
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
      {/* Header */}
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center gap-4 flex-shrink-0" style={{ backgroundColor: "var(--card)" }}>
        <div className="flex items-center gap-2 mr-4">
          <ThemedPageIcon icon={ICONS.data} size={16} />
          <h1 className={`text-xs font-bold uppercase tracking-widest ${isLab ? "text-[#1A202C]" : "text-foreground"}`}>
            数据表
          </h1>
        </div>
        <div className="flex gap-1">
          <PixelButton
            variant={tab === "manage" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab("manage")}
          >
            数据源管理
          </PixelButton>
          {isAdmin && (
            <PixelButton
              variant={tab === "connect" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTab("connect")}
            >
              对接数据源
            </PixelButton>
          )}
        </div>
      </div>

      {/* Content */}
      {tab === "connect" && isAdmin ? (
        <div className="flex-1 overflow-auto p-6">
          <ConnectTab
            onAdded={() => {
              setManageKey((k) => k + 1);
              setTab("manage");
            }}
          />
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
