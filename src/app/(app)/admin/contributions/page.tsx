"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type {
  ContributionStat,
  KbContributionStat,
  OpenCodeUsageStat,
  OpenCodeOutputFile,
  OpenCodeWorkspace,
  OpenCodeMapping,
} from "@/lib/types";

type Tab = "skill" | "kb" | "opencode";

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function RankCell({ i }: { i: number }) {
  if (i === 0) return <span className="text-sm font-bold text-yellow-500">#{i + 1}</span>;
  if (i === 1) return <span className="text-sm font-bold text-gray-400">#{i + 1}</span>;
  if (i === 2) return <span className="text-sm font-bold text-amber-700">#{i + 1}</span>;
  return <span className="text-xs text-gray-400">#{i + 1}</span>;
}

function SkillTab() {
  const [stats, setStats] = useState<ContributionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ContributionStat[]>("/contributions/stats")
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingRow />;
  if (stats.length === 0) return <EmptyRow text="暂无 Skill 贡献数据" />;

  return (
    <table className="w-full border-2 border-[#1A202C]">
      <thead>
        <tr className="bg-[#EBF4F7]">
          {["排名", "用户", "提交数", "采纳数", "采纳率", "影响力", "影响Skill数"].map((h) => (
            <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stats.map((s, i) => (
          <tr key={s.user_id} className="border-b border-gray-200 hover:bg-gray-50">
            <td className="px-3 py-2"><RankCell i={i} /></td>
            <td className="px-3 py-2 text-xs font-bold">{s.display_name}</td>
            <td className="px-3 py-2 text-xs">{s.total_suggestions}</td>
            <td className="px-3 py-2 text-xs">{s.adopted_count}</td>
            <td className="px-3 py-2">
              <PixelBadge color={s.adoption_rate >= 0.5 ? "green" : s.adoption_rate > 0 ? "yellow" : "gray"}>
                {(s.adoption_rate * 100).toFixed(0)}%
              </PixelBadge>
            </td>
            <td className="px-3 py-2 text-xs font-bold">{s.influence_score}</td>
            <td className="px-3 py-2 text-xs">{s.impacted_skills}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KbTab() {
  const [stats, setStats] = useState<KbContributionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<KbContributionStat[]>("/contributions/kb-stats")
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingRow />;
  if (stats.length === 0) return <EmptyRow text="暂无知识库贡献数据" />;

  return (
    <table className="w-full border-2 border-[#1A202C]">
      <thead>
        <tr className="bg-[#EBF4F7]">
          {["排名", "用户", "提交条目", "已审核", "使用模型", "Input Token", "Output Token", "总产出"].map((h) => (
            <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stats.map((s, i) => (
          <tr key={s.user_id} className="border-b border-gray-200 hover:bg-gray-50">
            <td className="px-3 py-2"><RankCell i={i} /></td>
            <td className="px-3 py-2 text-xs font-bold">{s.display_name}</td>
            <td className="px-3 py-2 text-xs">{s.total_entries}</td>
            <td className="px-3 py-2">
              <PixelBadge color={s.approved_entries > 0 ? "green" : "gray"}>
                {s.approved_entries}
              </PixelBadge>
            </td>
            <td className="px-3 py-2 text-[9px] text-gray-500 max-w-[120px]">
              {s.top_model ? (
                <span className="truncate block" title={Object.entries(s.models).map(([m, c]) => `${m}: ${c}次`).join(" / ")}>
                  {s.top_model}
                </span>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </td>
            <td className="px-3 py-2 text-xs font-mono">
              {s.input_tokens > 0 ? (
                <span className="text-[#00A3C4]">{fmtTokens(s.input_tokens)}</span>
              ) : <span className="text-gray-300">—</span>}
            </td>
            <td className="px-3 py-2 text-xs font-mono">
              {s.output_tokens > 0 ? (
                <span className="text-[#00CC99]">{fmtTokens(s.output_tokens)}</span>
              ) : <span className="text-gray-300">—</span>}
            </td>
            <td className="px-3 py-2 text-xs font-mono font-bold">
              {s.input_tokens + s.output_tokens > 0 ? (
                fmtTokens(s.input_tokens + s.output_tokens)
              ) : <span className="text-gray-300">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── 文件列表行 ────────────────────────────────────────────────────────────────

function FileList({ files }: { files: OpenCodeOutputFile[] }) {
  if (files.length === 0) return <span className="text-gray-300">—</span>;
  return (
    <div className="space-y-0.5 max-h-32 overflow-y-auto">
      {files.map((f, i) => {
        const name = f.path.split("/").pop() || f.path;
        return (
          <div key={i} className="flex items-center gap-1 group">
            <span
              className="text-[9px] font-mono text-[#6B46C1] truncate max-w-[160px] cursor-default"
              title={f.path}
            >
              {name}
            </span>
            {f.session_title && (
              <span className="text-[8px] text-gray-400 truncate max-w-[80px]" title={f.session_title}>
                · {f.session_title.slice(0, 20)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UsageRow({ stat: s, rank: i }: { stat: OpenCodeUsageStat; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="border-b border-gray-200 hover:bg-gray-50">
        <td className="px-3 py-2"><RankCell i={i} /></td>
        <td className="px-3 py-2 text-xs font-bold">{s.display_name}</td>
        <td className="px-3 py-2 text-[9px] text-gray-500 max-w-[100px]">
          <span className="truncate block" title={s.workspaces.join(", ")}>
            {s.workspaces.join(", ") || "—"}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">{s.sessions}</td>
        <td className="px-3 py-2 text-[9px] text-gray-500 max-w-[100px]">
          {s.top_model ? (
            <span
              className="truncate block"
              title={Object.entries(s.models).map(([m, c]) => `${m}: ${c}次`).join(" / ")}
            >
              {s.top_model}
            </span>
          ) : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs font-mono">
          {s.input_tokens > 0
            ? <span className="text-[#00A3C4]">{fmtTokens(s.input_tokens)}</span>
            : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs font-mono">
          {s.output_tokens > 0
            ? <span className="text-[#00CC99]">{fmtTokens(s.output_tokens)}</span>
            : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs font-mono text-gray-400">
          {s.cache_read_tokens > 0 ? fmtTokens(s.cache_read_tokens) : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs">{s.files_changed || <span className="text-gray-300">—</span>}</td>
        <td className="px-3 py-2 text-xs text-green-600">
          {s.lines_added > 0 ? `+${s.lines_added}` : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs text-red-500">
          {s.lines_deleted > 0 ? `-${s.lines_deleted}` : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs">
          {s.skills_submitted > 0
            ? <span className="font-bold text-[#6B46C1]">{s.skills_submitted}</span>
            : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs">
          {s.tools_submitted > 0
            ? <span className="font-bold text-[#00A3C4]">{s.tools_submitted}</span>
            : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-3 py-2 text-xs">
          {s.output_files.length > 0 ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[9px] font-bold text-[#6B46C1] hover:underline"
            >
              {expanded ? "▾ 收起" : `▸ ${s.output_files.length} 个文件`}
            </button>
          ) : <span className="text-gray-300">—</span>}
        </td>
      </tr>
      {expanded && s.output_files.length > 0 && (
        <tr className="bg-[#F7F3FF] border-b border-gray-200">
          <td colSpan={14} className="px-6 py-3">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1] mb-2">产出文件</div>
            <FileList files={s.output_files} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── OpenCode 用量 Tab ─────────────────────────────────────────────────────────

function OpenCodeTab() {
  const [stats, setStats] = useState<OpenCodeUsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  const reload = () => {
    setLoading(true);
    apiFetch<OpenCodeUsageStat[]>("/contributions/opencode-usage")
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await apiFetch("/contributions/opencode-usage/refresh", { method: "POST" });
      reload();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(reload, []);

  const computedAt = stats[0]?.computed_at;

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest">
          每 12 小时自动统计
          {computedAt && (
            <span className="ml-2 normal-case">· 上次更新：{new Date(computedAt).toLocaleString("zh-CN")}</span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-[10px] font-bold uppercase tracking-widest border-2 border-[#1A202C] bg-[#1A202C] text-[#00D1FF] px-3 py-1 disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >
            {refreshing ? "计算中..." : "立即刷新"}
          </button>
          <button
            onClick={() => setShowMapping((v) => !v)}
            className="text-[10px] font-bold uppercase tracking-widest border-2 border-[#1A202C] px-3 py-1 hover:bg-[#EBF4F7] transition-colors"
          >
            {showMapping ? "隐藏映射配置" : "配置 Workspace 映射"}
          </button>
        </div>
      </div>

      {/* 映射配置面板 */}
      {showMapping && <MappingPanel onSaved={reload} />}

      {/* 用量统计表 */}
      {loading ? (
        <LoadingRow />
      ) : stats.length === 0 ? (
        <EmptyRow text="暂无数据 — 请先配置 Workspace 映射" />
      ) : (
        <table className="w-full border-2 border-[#1A202C]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["排名", "用户", "Workspace", "会话数", "主力模型", "Input", "Output", "缓存读", "改文件", "新增行", "删除行", "提交Skill", "提交Tool", "产出文件"].map((h) => (
                <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <UsageRow key={s.user_id} stat={s} rank={i} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Workspace 映射配置面板 ────────────────────────────────────────────────────

interface LeUser { id: number; display_name: string; username: string; }

function MappingPanel({ onSaved }: { onSaved: () => void }) {
  const [workspaces, setWorkspaces] = useState<OpenCodeWorkspace[]>([]);
  const [mappings, setMappings] = useState<OpenCodeMapping[]>([]);
  const [users, setUsers] = useState<LeUser[]>([]);
  const [loadingWs, setLoadingWs] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ opencode_workspace_id: "", opencode_workspace_name: "", user_id: "" });

  const reload = () => {
    Promise.all([
      apiFetch<OpenCodeWorkspace[]>("/contributions/opencode-workspaces"),
      apiFetch<OpenCodeMapping[]>("/contributions/opencode-mappings"),
      apiFetch<LeUser[]>("/admin/users"),
    ]).then(([ws, mp, us]) => {
      setWorkspaces(ws);
      setMappings(mp);
      setUsers(us);
    }).catch(() => {}).finally(() => setLoadingWs(false));
  };

  useEffect(reload, []);

  const mappedIds = new Set(mappings.map((m) => m.opencode_workspace_id));
  const unmapped = workspaces.filter((w) => !mappedIds.has(w.id));

  async function handleAdd() {
    if (!form.opencode_workspace_id || !form.user_id) return;
    setAdding(true);
    try {
      await apiFetch("/contributions/opencode-mappings", {
        method: "POST",
        body: JSON.stringify({
          opencode_workspace_id: form.opencode_workspace_id,
          opencode_workspace_name: form.opencode_workspace_name || null,
          user_id: parseInt(form.user_id),
        }),
      });
      setForm({ opencode_workspace_id: "", opencode_workspace_name: "", user_id: "" });
      reload();
      onSaved();
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    await apiFetch(`/contributions/opencode-mappings/${id}`, { method: "DELETE" });
    reload();
    onSaved();
  }

  return (
    <div className="border-2 border-[#1A202C] bg-[#EBF4F7] p-4 space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4]">Workspace → 员工 映射</p>

      {loadingWs ? (
        <p className="text-[10px] text-gray-400">加载中...</p>
      ) : mappings.length === 0 ? (
        <p className="text-[10px] text-gray-400">暂无映射</p>
      ) : (
        <table className="w-full border border-gray-300 bg-white text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-3 py-1.5 text-[10px] text-gray-500 uppercase">Workspace ID</th>
              <th className="text-left px-3 py-1.5 text-[10px] text-gray-500 uppercase">备注名</th>
              <th className="text-left px-3 py-1.5 text-[10px] text-gray-500 uppercase">目录</th>
              <th className="text-left px-3 py-1.5 text-[10px] text-gray-500 uppercase">员工</th>
              <th className="px-3 py-1.5 w-12" />
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.id} className="border-b border-gray-100">
                <td className="px-3 py-1.5 font-mono text-[10px] text-gray-600 max-w-[160px] truncate" title={m.opencode_workspace_id}>
                  {m.opencode_workspace_id.slice(0, 16)}…
                </td>
                <td className="px-3 py-1.5 text-gray-600">{m.opencode_workspace_name || <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-1.5 font-mono text-[9px] max-w-[200px] truncate" title={m.directory || ""}>
                  {m.directory
                    ? <span className="text-green-600">{m.directory.split("/").slice(-2).join("/")}</span>
                    : <span className="text-red-400 font-bold">未配置 ⚠</span>}
                </td>
                <td className="px-3 py-1.5 font-bold">{m.display_name}</td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 添加新映射 */}
      <div className="flex gap-2 items-end flex-wrap">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-gray-500">Workspace</label>
          <select
            className="border-2 border-[#1A202C] text-xs px-2 py-1 bg-white min-w-[200px]"
            value={form.opencode_workspace_id}
            onChange={(e) => {
              const ws = workspaces.find((w) => w.id === e.target.value);
              setForm((f) => ({
                ...f,
                opencode_workspace_id: e.target.value,
                opencode_workspace_name: ws?.name || "",
              }));
            }}
          >
            <option value="">— 选择 Workspace —</option>
            {unmapped.map((w) => (
              <option key={w.id} value={w.id}>
                {w.worktree} {w.name ? `(${w.name})` : ""}
              </option>
            ))}
            {unmapped.length === 0 && workspaces.length > 0 && (
              <option disabled>所有 Workspace 已映射</option>
            )}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-gray-500">备注名（可选）</label>
          <input
            className="border-2 border-[#1A202C] text-xs px-2 py-1 bg-white w-[120px]"
            placeholder="如：前端项目"
            value={form.opencode_workspace_name}
            onChange={(e) => setForm((f) => ({ ...f, opencode_workspace_name: e.target.value }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-gray-500">归属员工</label>
          <select
            className="border-2 border-[#1A202C] text-xs px-2 py-1 bg-white min-w-[120px]"
            value={form.user_id}
            onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
          >
            <option value="">— 选择员工 —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.display_name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAdd}
          disabled={adding || !form.opencode_workspace_id || !form.user_id}
          className="border-2 border-[#1A202C] bg-[#1A202C] text-[#00D1FF] text-[10px] font-bold uppercase tracking-widest px-3 py-1 disabled:opacity-40 hover:bg-gray-800 transition-colors"
        >
          {adding ? "保存中..." : "添加映射"}
        </button>
      </div>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
      Loading...
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
      {text}
    </div>
  );
}

export default function AdminContributionsPage() {
  const [tab, setTab] = useState<Tab>("skill");

  const tabs: [Tab, string][] = [
    ["skill", "Skill 贡献"],
    ["kb", "知识库贡献"],
    ["opencode", "OpenCode 用量"],
  ];

  return (
    <PageShell title="使用统计" icon={ICONS.contrib}>
      <div className="flex border-b-2 border-[#1A202C] mb-4">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-r-2 border-[#1A202C] transition-colors ${
              tab === key
                ? "bg-[#1A202C] text-[#00D1FF]"
                : "bg-white text-gray-400 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "skill" && <SkillTab />}
      {tab === "kb" && <KbTab />}
      {tab === "opencode" && <OpenCodeTab />}
    </PageShell>
  );
}
