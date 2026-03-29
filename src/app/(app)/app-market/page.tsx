"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Zap, Wrench, Download } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS, PixelIcon } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { SkillDetail, Department, McpSource } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AppEntry {
  id: number;
  name: string;
  description: string | null;
  creator_name: string;
  is_mine: boolean;
  created_at: string | null;
  has_backend: boolean;
  status: string;
  share_url: string | null;
  publish_scope?: string;
}

interface ToolEntry {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  tool_type: string | null;
  scope: string;
}

interface RankItem {
  rank: number;
  skill_id: number;
  name: string;
  description: string | null;
  conv_count_recent: number;
  user_count_recent: number;
  conv_count_total: number;
  current_version: number;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function SkillIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.skills} size={size} />;
  return <Zap size={size} className="text-muted-foreground" />;
}

function ToolIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.tools} size={size} />;
  return <Wrench size={size} className="text-muted-foreground" />;
}

// ─── Skill Rank Board ─────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="w-6 h-6 bg-yellow-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>;
  if (rank === 2) return <span className="w-6 h-6 bg-gray-300 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>;
  if (rank === 3) return <span className="w-6 h-6 bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>;
  return <span className="w-6 h-6 border-2 border-gray-300 text-gray-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{rank}</span>;
}

function HeatBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#E2E8F0]">
        <div className="h-full bg-[#00D1FF] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-bold text-[#00A3C4] w-6 text-right">{value}</span>
    </div>
  );
}

function RankBoard({
  title, color, items, loading, extraHeader,
}: {
  title: string; color: string; items: RankItem[]; loading: boolean; extraHeader?: React.ReactNode;
}) {
  const max = items[0]?.conv_count_recent ?? 1;
  return (
    <div className="border-2 border-[#1A202C] bg-white flex flex-col">
      <div className="px-4 py-2.5 flex items-center justify-between flex-shrink-0" style={{ background: color }}>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">{title}</span>
        {extraHeader}
      </div>
      {loading ? (
        <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-8 animate-pulse">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-[10px] text-gray-400 text-center py-8">暂无数据</div>
      ) : (
        <div className="divide-y divide-[#F0F4F8]">
          {items.map((item) => (
            <div key={item.skill_id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#F0F4F8] transition-colors">
              <RankBadge rank={item.rank} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-bold text-[#1A202C] truncate">{item.name}</span>
                  {item.current_version > 0 && (
                    <span className="text-[8px] font-bold text-gray-400">v{item.current_version}</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-[9px] text-gray-500 truncate mb-1">{item.description}</p>
                )}
                <HeatBar value={item.conv_count_recent} max={max} />
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-[9px] text-gray-400">{item.user_count_recent} 人用</div>
                <div className="text-[8px] text-gray-300">共 {item.conv_count_total} 次</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Skill Tab ────────────────────────────────────────────────────────────────
function SkillTab() {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [companyRank, setCompanyRank] = useState<RankItem[]>([]);
  const [deptRank, setDeptRank] = useState<RankItem[]>([]);
  const [rankLoading, setRankLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | "">("");
  const [rankDays, setRankDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    apiFetch<SkillDetail[]>("/skills?scope=company")
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
    apiFetch<Department[]>("/admin/departments").then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    setRankLoading(true);
    const deptParam = selectedDept ? `&department_id=${selectedDept}` : "";
    Promise.all([
      apiFetch<RankItem[]>(`/skills/ranking?scope=company&days=${rankDays}&limit=10`),
      apiFetch<RankItem[]>(`/skills/ranking?scope=department&days=${rankDays}&limit=10${deptParam}`),
    ])
      .then(([company, dept]) => { setCompanyRank(company); setDeptRank(dept); })
      .catch(() => { setCompanyRank([]); setDeptRank([]); })
      .finally(() => setRankLoading(false));
  }, [rankDays, selectedDept]);

  const filtered = searchQ
    ? skills.filter((s) =>
        s.name.toLowerCase().includes(searchQ.toLowerCase()) ||
        (s.description || "").toLowerCase().includes(searchQ.toLowerCase()))
    : skills;

  async function handleSave(skillId: number) {
    if (saved.has(skillId) || saving === skillId) return;
    setSaving(skillId);
    try {
      await apiFetch("/skills/save-from-market", { method: "POST", body: JSON.stringify({ skill_id: skillId }) });
      setSaved((prev) => new Set(prev).add(skillId));
    } catch { setSaved((prev) => new Set(prev).add(skillId)); }
    finally { setSaving(null); }
  }

  return (
    <div className="space-y-6">
      {/* 热榜 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— 热门排行榜</div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-400 font-bold">近</span>
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setRankDays(d)}
                className={`px-2 py-1 text-[9px] font-bold border transition-colors ${
                  rankDays === d ? "border-[#1A202C] bg-[#1A202C] text-white" : "border-gray-300 text-gray-500 hover:border-[#1A202C]"
                }`}
              >{d}天</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <RankBoard title="通用榜" color="#00A3C4" items={companyRank} loading={rankLoading} />
          <RankBoard
            title="专业榜" color="#805AD5" items={deptRank} loading={rankLoading}
            extraHeader={
              <PixelSelect value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value === "" ? "" : Number(e.target.value))}
                pixelSize="sm" className="w-auto bg-white/20 text-white border border-white/40"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="" className="text-[#1A202C] bg-white">全部部门</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="text-[#1A202C] bg-white">{d.name}</option>
                ))}
              </PixelSelect>
            }
          />
        </div>
      </div>

      {/* Skill 列表 */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— 全部 Skill</div>
          <input type="text" placeholder="搜索..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            className="ml-auto max-w-xs border-2 border-[#1A202C] px-3 py-1 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
          />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">Loading...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-[10px] text-gray-400 text-center py-16">暂无公司 Skill</div>
        ) : (
          <div className="space-y-2">
            {filtered.map((skill) => {
              const isSaved = saved.has(skill.id);
              const inRank = companyRank.find((r) => r.skill_id === skill.id);
              return (
                <div key={skill.id} className="bg-white border-2 border-[#1A202C] p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <SkillIcon size={12} />
                      <span className="text-xs font-bold uppercase">{skill.name}</span>
                      <PixelBadge color="green">公司</PixelBadge>
                      {(skill.current_version ?? 0) > 0 && <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>}
                      {inRank && inRank.rank <= 3 && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 bg-yellow-100 border border-yellow-400 text-yellow-700">
                          通用榜 #{inRank.rank}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-gray-500 line-clamp-2">{skill.description || "无描述"}</p>
                    {inRank && (
                      <span className="text-[8px] text-gray-400 mt-1 block">近30天 {inRank.conv_count_recent} 次对话</span>
                    )}
                  </div>
                  <PixelButton size="sm" variant={isSaved ? "secondary" : "primary"}
                    onClick={() => handleSave(skill.id)} disabled={isSaved || saving === skill.id}
                  >
                    {isSaved ? "已保存" : saving === skill.id ? "保存中..." : "保存"}
                  </PixelButton>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tool & WebApp Tab ────────────────────────────────────────────────────────
const TOOL_TYPE_LABEL: Record<string, string> = { builtin: "内置", mcp: "MCP", http: "HTTP" };
const TOOL_TYPE_COLOR: Record<string, "cyan" | "green" | "purple" | "gray"> = {
  mcp: "cyan", builtin: "green", http: "purple",
};
const SCOPE_LABEL: Record<string, string> = { company: "全公司", dept: "指定部门", personal: "指定个人" };

function ToolAndWebAppTab() {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<ToolEntry[]>("/tools?scope=company").catch(() => [] as ToolEntry[]),
      apiFetch<AppEntry[]>("/web-apps/market").catch(() => [] as AppEntry[]),
    ]).then(([t, a]) => { setTools(t); setApps(a); }).finally(() => setLoading(false));
  }, []);

  const filteredTools = search
    ? tools.filter((t) => t.display_name.toLowerCase().includes(search.toLowerCase()) || (t.description || "").toLowerCase().includes(search.toLowerCase()))
    : tools;

  const filteredApps = search
    ? apps.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || (a.description || "").toLowerCase().includes(search.toLowerCase()))
    : apps;

  return (
    <div className="space-y-6">
      {/* 搜索 */}
      <div className="flex items-center gap-2 border-2 border-[#1A202C] px-3 py-2 bg-white">
        <Search size={12} className="text-gray-400 shrink-0" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索工具、应用名称、描述..."
          className="flex-1 text-[11px] font-mono outline-none bg-transparent"
        />
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse text-center py-16">Loading...</div>
      ) : (
        <>
          {/* Tools */}
          {filteredTools.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">— 工具</div>
              <div className="space-y-2">
                {filteredTools.map((tool) => {
                  const typeColor = TOOL_TYPE_COLOR[tool.tool_type ?? ""] ?? "gray";
                  const typeLabel = TOOL_TYPE_LABEL[tool.tool_type ?? ""] ?? tool.tool_type ?? "未知";
                  return (
                    <div key={tool.id} className="bg-white border-2 border-[#1A202C] p-4 flex items-start gap-3">
                      <ToolIcon size={14} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold uppercase">{tool.display_name}</span>
                          <PixelBadge color={typeColor}>{typeLabel}</PixelBadge>
                          <PixelBadge color="green">公司</PixelBadge>
                        </div>
                        <p className="text-[9px] text-gray-500 line-clamp-2">{tool.description || "无描述"}</p>
                        <p className="text-[8px] text-gray-400 mt-1 font-mono">{tool.name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Web Apps */}
          {filteredApps.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1] mb-3">— Web App</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredApps.map((app) => (
                  <div key={app.id} className="border-2 border-[#1A202C] bg-white flex flex-col">
                    <div className="border-b-2 border-[#1A202C] px-4 py-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-bold text-[#1A202C] font-mono">{app.name}</div>
                        <div className="text-[9px] text-gray-400 mt-0.5">
                          {app.creator_name}
                          {app.is_mine && <span className="ml-1 text-[#00A3C4]">· 我的</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                        {app.has_backend && (
                          <span className="text-[8px] font-bold uppercase tracking-widest border border-[#00A3C4] text-[#00A3C4] px-1.5 py-0.5">后端</span>
                        )}
                        {app.publish_scope && app.publish_scope !== "company" && (
                          <span className="text-[8px] font-bold uppercase tracking-widest border border-[#6B46C1] text-[#6B46C1] px-1.5 py-0.5">
                            {SCOPE_LABEL[app.publish_scope] ?? app.publish_scope}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="px-4 py-3 flex-1">
                      <p className="text-[10px] text-gray-500 font-mono line-clamp-3">{app.description || "暂无描述"}</p>
                    </div>
                    <div className="border-t-2 border-[#1A202C] px-4 py-2 flex items-center justify-between">
                      <span className="text-[9px] text-gray-400 font-mono">
                        {app.created_at ? new Date(app.created_at + "Z").toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) : ""}
                      </span>
                      <div className="flex gap-2">
                        <a href={`/web-app-preview/${app.id}`} target="_blank" rel="noopener noreferrer"
                          className="text-[9px] font-bold uppercase tracking-widest text-white bg-[#00A3C4] px-2 py-0.5 hover:bg-[#007A99] transition-colors"
                        >
                          预览
                        </a>
                        {app.share_url && (
                          <a href={app.share_url} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] font-bold uppercase tracking-widest text-white bg-[#6B46C1] px-2 py-0.5 hover:bg-[#553C9A] transition-colors"
                          >
                            分享
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredTools.length === 0 && filteredApps.length === 0 && (
            <div className="text-[10px] text-gray-400 text-center py-16">
              {search ? "没有匹配的内容" : "暂无已发布的工具或应用"}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Import External Skill Modal ─────────────────────────────────────────────

interface RemoteSkill {
  id: string;
  name: string;
  description: string;
}

function ImportExternalSkillModal({ onClose }: { onClose: () => void }) {
  const [sources, setSources] = useState<McpSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [remoteSkills, setRemoteSkills] = useState<RemoteSkill[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubImporting, setGithubImporting] = useState(false);
  const [githubResult, setGithubResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [batchResult, setBatchResult] = useState<{ imported: number; skipped: number; errors: number; results: { name?: string; raw_url?: string; status: string; reason?: string }[] } | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);

  const fetchSources = useCallback(() => {
    setLoading(true);
    apiFetch<McpSource[]>("/skill-market/sources")
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  async function handleSearch() {
    if (!selectedSource) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ source_id: String(selectedSource) });
      if (searchQ) params.set("q", searchQ);
      const data = await apiFetch<RemoteSkill[]>(`/skill-market/search?${params}`);
      setRemoteSkills(Array.isArray(data) ? data : []);
    } catch { setRemoteSkills([]); }
    finally { setSearching(false); }
  }

  async function handleImport(upstreamId: string) {
    if (!selectedSource) return;
    setImporting(upstreamId);
    try {
      await apiFetch("/skill-market/import", {
        method: "POST",
        body: JSON.stringify({ source_id: selectedSource, upstream_id: upstreamId }),
      });
      setRemoteSkills((prev) => prev.filter((s) => s.id !== upstreamId));
    } catch { /* ignore */ }
    finally { setImporting(null); }
  }

  async function handleGithubImport() {
    if (!githubUrl.trim() || githubImporting) return;
    setGithubImporting(true);
    setGithubResult(null);
    try {
      const data = await apiFetch<{ id: number; name: string }>(
        "/skill-market/import-github",
        { method: "POST", body: JSON.stringify({ github_url: githubUrl.trim() }) }
      );
      setGithubResult({ ok: true, msg: `已导入「${data.name}」(id=${data.id})，状态为草稿，请前往 Skill 管理发布` });
      setGithubUrl("");
    } catch (e: unknown) {
      setGithubResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally { setGithubImporting(false); }
  }

  async function handleBatchImport() {
    if (!githubUrl.trim() || batchImporting) return;
    setBatchImporting(true);
    setBatchResult(null);
    setGithubResult(null);
    try {
      const data = await apiFetch<{ imported: number; skipped: number; errors: number; results: { name?: string; raw_url?: string; status: string; reason?: string }[] }>(
        "/skill-market/import-github-batch",
        { method: "POST", body: JSON.stringify({ github_url: githubUrl.trim() }) }
      );
      setBatchResult(data);
    } catch (e: unknown) {
      setGithubResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally { setBatchImporting(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-white border-2 border-[#1A202C] w-[720px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b-2 border-[#1A202C] bg-[#EBF4F7] flex-shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#00A3C4]">导入外部 Skill</span>
          <button onClick={onClose} className="text-gray-400 hover:text-[#1A202C] text-sm font-bold px-1">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* GitHub 导入 */}
          <div className="border-2 border-[#1A202C] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">从 GitHub 导入</div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="https://github.com/owner/repo/tree/main/skill-name"
                value={githubUrl}
                onChange={(e) => { setGithubUrl(e.target.value); setGithubResult(null); setBatchResult(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleGithubImport()}
                className="flex-1 border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
              />
              <PixelButton size="sm" onClick={handleGithubImport} disabled={!githubUrl.trim() || githubImporting || batchImporting}>
                {githubImporting ? "导入中..." : "导入单个"}
              </PixelButton>
              <PixelButton size="sm" variant="secondary" onClick={handleBatchImport} disabled={!githubUrl.trim() || githubImporting || batchImporting}>
                {batchImporting ? "批量导入中..." : "批量导入"}
              </PixelButton>
            </div>
            <p className="text-[9px] text-gray-400 mt-1.5">
              「导入单个」：URL 指向具体 skill 文件夹 &nbsp;|&nbsp; 「批量导入」：URL 指向含多个 skill 的父文件夹
            </p>
            {githubResult && (
              <div className={`mt-2 px-3 py-2 border-2 text-[10px] font-bold ${
                githubResult.ok ? "border-[#00CC99] bg-[#00CC99]/10 text-[#00664D]" : "border-red-400 bg-red-50 text-red-700"
              }`}>{githubResult.msg}</div>
            )}
            {batchResult && (
              <div className="mt-2 border-2 border-[#1A202C]">
                <div className="flex gap-4 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-bold">
                  <span className="text-[#00CC99]">✓ 已导入 {batchResult.imported}</span>
                  <span className="text-gray-400">跳过 {batchResult.skipped}</span>
                  {batchResult.errors > 0 && <span className="text-red-500">失败 {batchResult.errors}</span>}
                </div>
                <div className="max-h-32 overflow-y-auto">
                  {batchResult.results.map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 px-3 py-1 border-b border-gray-100 last:border-0 text-[10px] ${
                      r.status === "ok" ? "text-[#1A202C]" : r.status === "skipped" ? "text-gray-400" : "text-red-500"
                    }`}>
                      <span className="shrink-0">{r.status === "ok" ? "✓" : r.status === "skipped" ? "—" : "✗"}</span>
                      <span className="font-bold truncate">{r.name ?? r.raw_url ?? "?"}</span>
                      {r.reason && <span className="text-gray-400 ml-auto shrink-0">{r.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MCP Source 导入 */}
          <div className="border-2 border-[#1A202C] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">从 MCP 数据源导入</div>
            <div className="flex items-center gap-3 mb-3">
              <PixelSelect
                value={selectedSource ?? ""}
                onChange={(e) => setSelectedSource(Number(e.target.value) || null)}
                className="w-48"
              >
                <option value="">选择数据源...</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </PixelSelect>
              <input
                type="text"
                placeholder="搜索 Skill..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold w-48 focus:outline-none focus:border-[#00D1FF]"
              />
              <PixelButton size="sm" onClick={handleSearch} disabled={!selectedSource || searching}>
                {searching ? "搜索中..." : "搜索"}
              </PixelButton>
            </div>
            {loading ? (
              <div className="text-[10px] text-[#00A3C4] font-bold animate-pulse py-4 text-center">Loading...</div>
            ) : remoteSkills.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {remoteSkills.map((rs) => (
                  <div key={rs.id} className="border border-gray-200 p-2 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-bold">{rs.name}</span>
                      <p className="text-[9px] text-gray-500 truncate">{rs.description}</p>
                    </div>
                    <PixelButton size="sm" onClick={() => handleImport(rs.id)} disabled={importing === rs.id}>
                      {importing === rs.id ? "导入中..." : "导入"}
                    </PixelButton>
                  </div>
                ))}
              </div>
            ) : sources.length > 0 ? (
              <div className="text-[10px] text-gray-400 text-center py-4">选择数据源后点击搜索</div>
            ) : (
              <div className="text-[10px] text-gray-400 text-center py-4">暂无外部数据源</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AppMarketPage() {
  const [tab, setTab] = useState<"skill" | "tool">("skill");
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "dept_admin";
  const [showImport, setShowImport] = useState(false);

  return (
    <PageShell title="应用市场" icon={ICONS.devStudio} actions={
      <PixelButton variant="secondary" onClick={() => { window.location.href = "/skills"; }}>
        ← 工作台配置
      </PixelButton>
    }>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6">
        <button
          onClick={() => setTab("skill")}
          className={`px-4 py-2 text-[9px] font-bold uppercase tracking-widest border-2 transition-colors ${
            tab === "skill"
              ? "border-[#1A202C] bg-[#1A202C] text-white"
              : "border-gray-300 text-gray-500 hover:border-[#1A202C]"
          }`}
        >
          Skill
        </button>
        <button
          onClick={() => setTab("tool")}
          className={`px-4 py-2 text-[9px] font-bold uppercase tracking-widest border-2 transition-colors ${
            tab === "tool"
              ? "border-[#1A202C] bg-[#1A202C] text-white"
              : "border-gray-300 text-gray-500 hover:border-[#1A202C]"
          }`}
        >
          工具 & Web App
        </button>
        {isAdmin && (
          <button
            onClick={() => setShowImport(true)}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 text-[9px] font-bold uppercase tracking-widest border-2 border-[#00A3C4] text-[#00A3C4] hover:bg-[#00A3C4] hover:text-white transition-colors"
          >
            <Download size={12} />
            导入外部 Skill
          </button>
        )}
      </div>

      {tab === "skill" ? <SkillTab /> : <ToolAndWebAppTab />}

      {showImport && <ImportExternalSkillModal onClose={() => setShowImport(false)} />}
    </PageShell>
  );
}
