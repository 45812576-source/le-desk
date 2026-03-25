"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface Column {
  name: string;
  type: string;
  nullable: boolean;
  comment: string;
}

type ScopeValue = "all" | "department" | "private";

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
  };
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

interface Folder {
  id: number;           // negative = local-only until saved; positive = stored in validation_rules
  name: string;
  parent_id: number | null;
  sort_order: number;
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
    // 发出请求后不等响应，后端在后台完成同步
    fetch(`/api/proxy/business-tables/sync-bitable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(localStorage.getItem("token") ? { Authorization: `Bearer ${localStorage.getItem("token")}` } : {}),
      },
      body: JSON.stringify({
        app_token: probeResult.app_token,
        table_id: probeResult.table_id,
        display_name: displayName.trim(),
      }),
    });
    setSyncMsg("✓ 同步已提交，数据正在后台写入");
    setSyncing(false);
    onAdded();
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

// ─── Connect Tab ─────────────────────────────────────────────────────────────
function ConnectTab({ onAdded }: { onAdded: () => void }) {
  const [mode, setMode] = useState<ConnectMode>("bitable");

  return (
    <div className="max-w-3xl">
      {/* Source type toggle */}
      <div className="flex gap-1 mb-5">
        <button
          onClick={() => setMode("bitable")}
          className={`flex items-center gap-2 px-4 py-2 border-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            mode === "bitable"
              ? "border-[#1A202C] bg-[#1A202C] text-white"
              : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
          }`}
        >
          <span>🪁</span> 飞书多维表格
        </button>
        <button
          onClick={() => setMode("db")}
          className={`flex items-center gap-2 px-4 py-2 border-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            mode === "db"
              ? "border-[#1A202C] bg-[#1A202C] text-white"
              : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
          }`}
        >
          <span>🗄</span> 外部数据库
        </button>
      </div>

      {mode === "bitable" ? <BitablePanel onAdded={onAdded} /> : <DbPanel onAdded={onAdded} />}
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

// ─── Scope selector sub-component ────────────────────────────────────────────
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
  const [nameVal, setNameVal] = useState(table.display_name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  const hidden = table.validation_rules?.hidden_fields ?? [];
  const colScope: ScopeValue = table.validation_rules?.column_scope ?? "private";
  const colDeptIds = table.validation_rules?.column_department_ids ?? [];
  const rowScope: ScopeValue = table.validation_rules?.row_scope ?? "private";
  const rowDeptIds = table.validation_rules?.row_department_ids ?? [];

  useEffect(() => { Promise.resolve().then(() => setNameVal(table.display_name)); }, [table.id, table.display_name]);

  useEffect(() => {
    setLoadingRows(true);
    setRowsError("");
    apiFetch<{ columns: string[]; rows: Record<string, unknown>[] }>(
      `/data/${table.table_name}/rows?page=1&page_size=50`
    )
      .then((d) => {
        console.log("[DataPage] rows response:", d);
        setCols(d.columns ?? []);
        setRows(d.rows ?? []);
        if (!d.columns?.length && !d.rows?.length) {
          setRowsError(`后端返回空数据（total=${(d as Record<string, unknown>).total ?? "?"}）`);
        }
      })
      .catch((e: unknown) => {
        console.error("[DataPage] rows error:", e);
        setCols([]);
        setRows([]);
        setRowsError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoadingRows(false));
  }, [table.table_name]);

  function submitRename() {
    const v = nameVal.trim();
    if (v && v !== table.display_name) onRename(table.id, v);
    setEditingName(false);
  }

  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);

  const visibleCols = cols.filter((c) => !hidden.includes(c));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white flex flex-col">
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

      {/* ── 访问范围 + 字段管理（可折叠）── */}
      {showSettings && (
        <>
          <div className="px-5 py-3 border-b-2 border-[#1A202C] flex-shrink-0 bg-[#FAFCFD]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">— 访问范围</div>
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
          <div className="px-5 py-3 border-b border-gray-200 flex-shrink-0">
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              列字段管理<span className="text-gray-300 ml-1 normal-case">（点击隐藏）</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {table.columns.map((c) => {
                const isHidden = hidden.includes(c.name);
                return (
                  <button
                    key={c.name}
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
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── 数据预览 ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loadingRows ? (
          <div className="flex items-center justify-center h-32 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
            Loading...
          </div>
        ) : rowsError ? (
          <div className="flex items-center justify-center h-32 text-[10px] font-bold text-red-500">
            {rowsError}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[10px] font-bold uppercase tracking-widest text-gray-300">
            暂无数据
          </div>
        ) : (
          <table className="text-[9px]" style={{ minWidth: "100%" }}>
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#EBF4F7]">
                {visibleCols.map((c) => (
                  <th
                    key={c}
                    className="text-left px-3 py-2 font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-[#1A202C] border-r border-gray-200 whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FBFD]"}`}
                >
                  {visibleCols.map((c) => (
                    <td
                      key={c}
                      className="px-3 py-1.5 border-r border-gray-100 font-mono text-gray-700 whitespace-nowrap max-w-[240px] truncate"
                      title={formatCellValue(row[c])}
                    >
                      {row[c] === null || row[c] === undefined
                        ? <span className="text-gray-300">NULL</span>
                        : formatCellValue(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
  const [selectedTable, setSelectedTable] = useState<BusinessTable | null>(null);
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

  // Keep selectedTable in sync after refetch
  useEffect(() => {
    if (selectedTable) {
      const updated = allTables.find((t) => t.id === selectedTable.id);
      if (updated) setSelectedTable(updated);
    }
  }, [allTables]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <PixelButton
            variant={tab === "connect" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab("connect")}
          >
            对接数据源
          </PixelButton>
        </div>
      </div>

      {/* Content */}
      {tab === "connect" ? (
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
        </div>
      )}
    </div>
  );
}
