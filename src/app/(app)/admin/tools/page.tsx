"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS, PixelIcon } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { ToolEntry } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  builtin: "内置",
  mcp: "MCP",
  http: "HTTP",
};

const TYPE_COLOR: Record<string, "cyan" | "green" | "purple" | "gray"> = {
  mcp: "cyan",
  builtin: "green",
  http: "purple",
};

const ALL_TYPES = ["all", "builtin", "mcp", "http"] as const;

export default function AdminToolsPage() {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testTargetName, setTestTargetName] = useState("");
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const fetchTools = useCallback(() => {
    setLoading(true);
    apiFetch<ToolEntry[]>("/tools")
      .then(setTools)
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  async function handleToggle(id: number, is_active: boolean) {
    try {
      await apiFetch(`/tools/${id}`, { method: "PUT", body: JSON.stringify({ is_active: !is_active }) });
      fetchTools();
    } catch { /* ignore */ }
  }

  async function handleTest(tool: ToolEntry) {
    setTestingId(tool.id);
    setTestTargetName(tool.display_name);
    setTestResult(null);
    try {
      const result = await apiFetch<Record<string, unknown>>(`/tools/${tool.id}/test`, {
        method: "POST",
        body: JSON.stringify({ params: {} }),
      });
      setTestResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除？")) return;
    try {
      await apiFetch(`/tools/${id}`, { method: "DELETE" });
      fetchTools();
    } catch { /* ignore */ }
  }

  // Filter
  const filtered = tools.filter((t) => {
    const matchQ = !q.trim() ||
      t.display_name.toLowerCase().includes(q.toLowerCase()) ||
      t.name.toLowerCase().includes(q.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(q.toLowerCase());
    const matchType = filterType === "all" || t.tool_type === filterType;
    return matchQ && matchType;
  });

  // Group counts
  const counts: Record<string, number> = { all: tools.length };
  for (const t of tools) {
    counts[t.tool_type ?? "other"] = (counts[t.tool_type ?? "other"] ?? 0) + 1;
  }

  return (
    <PageShell title="工具管理" icon={ICONS.tools}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-0 border-2 border-[#1A202C] bg-white flex-1 min-w-[180px] max-w-xs">
          <span className="px-2 opacity-40">
            <PixelIcon {...ICONS.knowledgeMy} size={12} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索工具名称 / 描述..."
            className="flex-1 py-1.5 text-[10px] font-bold focus:outline-none bg-transparent pr-2"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1">
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2.5 py-1 border-2 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                filterType === type
                  ? "border-[#1A202C] bg-[#1A202C] text-white"
                  : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
              }`}
            >
              {type === "all" ? "全部" : TYPE_LABELS[type] ?? type}
              <span className="ml-1 opacity-60">{counts[type] ?? 0}</span>
            </button>
          ))}
        </div>

        <span className="ml-auto text-[9px] text-gray-400 font-bold uppercase tracking-widest">
          {filtered.length} / {tools.length}
        </span>
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 bg-[#EBF4F7] border-2 border-[#1A202C] flex items-center justify-center mb-4 opacity-40">
            <PixelIcon {...ICONS.tools} size={20} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {tools.length === 0 ? "暂无工具" : "无匹配结果"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <ToolCard
              key={t.id}
              tool={t}
              testing={testingId === t.id}
              onToggle={handleToggle}
              onTest={handleTest}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Test result panel */}
      {testResult && (
        <div className="fixed bottom-4 right-4 w-[420px] bg-white border-2 border-[#1A202C] shadow-lg z-50 flex flex-col max-h-[60vh]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-[#1A202C] bg-[#EBF4F7] flex-shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
              测试结果 — {testTargetName}
            </span>
            <button
              onClick={() => setTestResult(null)}
              className="w-5 h-5 flex items-center justify-center border-2 border-[#1A202C] text-[9px] font-bold hover:bg-red-400 hover:text-white hover:border-red-400 transition-colors"
            >
              ✕
            </button>
          </div>
          <pre className="flex-1 overflow-auto text-[9px] p-4 bg-gray-50 whitespace-pre-wrap font-mono leading-relaxed">
            {testResult}
          </pre>
        </div>
      )}
    </PageShell>
  );
}

// ─── Tool Card ────────────────────────────────────────────────────────────────
interface SkillOption { id: number; name: string; }

function ToolCard({
  tool: t,
  testing,
  onToggle,
  onTest,
  onDelete,
}: {
  tool: ToolEntry;
  testing: boolean;
  onToggle: (id: number, is_active: boolean) => void;
  onTest: (tool: ToolEntry) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [bindOpen, setBindOpen] = useState(false);
  const [boundSkills, setBoundSkills] = useState<SkillOption[]>([]);
  const [allSkills, setAllSkills] = useState<SkillOption[]>([]);
  const [bindLoading, setBindLoading] = useState(false);
  const typeColor = TYPE_COLOR[t.tool_type ?? ""] ?? "gray";

  async function openBindPanel() {
    if (bindOpen) { setBindOpen(false); return; }
    setBindLoading(true);
    setBindOpen(true);
    try {
      const [bound, all] = await Promise.all([
        apiFetch<SkillOption[]>(`/tools/tool-bindings/${t.id}`),
        apiFetch<{ id: number; name: string }[]>("/skills"),
      ]);
      setBoundSkills(bound);
      setAllSkills(all);
    } catch {
      setBoundSkills([]);
      setAllSkills([]);
    } finally {
      setBindLoading(false);
    }
  }

  async function handleBind(skillId: number) {
    try {
      await apiFetch(`/tools/skill/${skillId}/tools/${t.id}`, { method: "POST" });
      setBoundSkills((prev) => {
        const skill = allSkills.find((s) => s.id === skillId);
        if (!skill || prev.some((s) => s.id === skillId)) return prev;
        return [...prev, skill];
      });
    } catch { /* ignore */ }
  }

  async function handleUnbind(skillId: number) {
    try {
      await apiFetch(`/tools/skill/${skillId}/tools/${t.id}`, { method: "DELETE" });
      setBoundSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch { /* ignore */ }
  }

  const unboundSkills = allSkills.filter((s) => !boundSkills.some((b) => b.id === s.id));

  // Count input params
  const paramCount = t.input_schema
    ? Object.keys((t.input_schema as { properties?: Record<string, unknown> }).properties ?? {}).length
    : 0;

  return (
    <div className={`border-2 bg-white flex flex-col transition-colors ${
      t.is_active ? "border-[#1A202C]" : "border-gray-200 opacity-60"
    }`}>
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 flex-1">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-[11px] font-bold leading-tight">{t.display_name}</span>
              {t.tool_type && (
                <PixelBadge color={typeColor}>{TYPE_LABELS[t.tool_type] ?? t.tool_type}</PixelBadge>
              )}
              <PixelBadge color={t.is_active ? "green" : "gray"}>
                {t.is_active ? "启用" : "禁用"}
              </PixelBadge>
            </div>
            <p className="text-[9px] text-gray-400 font-mono">{t.name}</p>
          </div>
        </div>

        {t.description && (
          <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-2">
            {t.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {paramCount > 0 && (
            <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
              {paramCount} 个参数
            </span>
          )}
          {t.output_format && (
            <span className="text-[8px] text-[#00A3C4] font-bold uppercase tracking-widest border border-[#00A3C4]/30 px-1.5 py-0.5">
              输出: {t.output_format}
            </span>
          )}
        </div>

        {/* Schema expand */}
        {t.input_schema && paramCount > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] transition-colors"
            >
              {expanded ? "▾ 收起参数" : "▸ 查看参数"}
            </button>
            {expanded && (
              <pre className="mt-1.5 text-[8px] bg-[#F0F4F8] border border-gray-200 p-2 max-h-32 overflow-auto font-mono text-gray-600 leading-relaxed">
                {JSON.stringify(t.input_schema, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Card actions */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-1.5 bg-[#FAFCFD]">
        <PixelButton size="sm" variant="secondary" onClick={() => onTest(t)} disabled={testing}>
          {testing ? "测试中..." : "▶ 测试"}
        </PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={() => onToggle(t.id, t.is_active)}>
          {t.is_active ? "禁用" : "启用"}
        </PixelButton>
        <PixelButton size="sm" variant={bindOpen ? "primary" : "secondary"} onClick={openBindPanel}>
          绑定 Skill
        </PixelButton>
        <button
          onClick={() => onDelete(t.id)}
          className="ml-auto px-2 py-0.5 border-2 border-red-200 text-red-400 text-[8px] font-bold uppercase hover:bg-red-400 hover:text-white hover:border-red-400 transition-colors"
        >
          删除
        </button>
      </div>

      {/* Bind panel */}
      {bindOpen && (
        <div className="border-t-2 border-[#1A202C] bg-[#F8FAFC] px-4 py-3">
          {bindLoading ? (
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">加载中...</div>
          ) : (
            <>
              {/* Already bound */}
              {boundSkills.length > 0 && (
                <div className="mb-3">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">已绑定</div>
                  <div className="flex flex-wrap gap-1.5">
                    {boundSkills.map((s) => (
                      <div key={s.id} className="flex items-center gap-1 border-2 border-[#00A3C4] bg-[#CCF2FF] px-2 py-0.5">
                        <span className="text-[9px] font-bold text-[#00A3C4]">{s.name}</span>
                        <button
                          onClick={() => handleUnbind(s.id)}
                          className="text-[#00A3C4] hover:text-red-500 text-[9px] font-bold leading-none ml-0.5"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add binding */}
              {unboundSkills.length > 0 ? (
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">添加绑定</div>
                  <div className="flex flex-wrap gap-1.5">
                    {unboundSkills.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleBind(s.id)}
                        className="text-[9px] font-bold border-2 border-[#1A202C] bg-white px-2 py-0.5 hover:bg-[#CCF2FF] hover:border-[#00A3C4] transition-colors"
                      >
                        + {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : boundSkills.length === 0 ? (
                <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">暂无可绑定的 Skill</div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
