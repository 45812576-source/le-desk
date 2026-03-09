"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";
import type { McpSource } from "@/lib/types";

interface RemoteSkill {
  id: string;
  name: string;
  description: string;
}

export default function AdminSkillMarketPage() {
  const [sources, setSources] = useState<McpSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSource, setSelectedSource] = useState<number | null>(null);
  const [remoteSkills, setRemoteSkills] = useState<RemoteSkill[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [githubUrl, setGithubUrl] = useState("");
  const [githubImporting, setGithubImporting] = useState(false);
  const [githubResult, setGithubResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [batchResult, setBatchResult] = useState<{ imported: number; skipped: number; errors: number; results: { name?: string; raw_url?: string; status: string; reason?: string; id?: number }[] } | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);

  const fetchSources = useCallback(() => {
    setLoading(true);
    apiFetch<McpSource[]>("/skill-market/sources")
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  async function handleSearch() {
    if (!selectedSource) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ source_id: String(selectedSource) });
      if (searchQ) params.set("q", searchQ);
      const data = await apiFetch<RemoteSkill[]>(`/skill-market/search?${params}`);
      setRemoteSkills(Array.isArray(data) ? data : []);
    } catch {
      setRemoteSkills([]);
    } finally {
      setSearching(false);
    }
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
    } catch {
      // ignore — may already be imported
    } finally {
      setImporting(null);
    }
  }

  async function handleSaveToMine(upstreamId: string, skillName: string) {
    if (saved.has(upstreamId) || saving === upstreamId) return;
    setSaving(upstreamId);
    try {
      // 先查本地是否已有同名 skill
      const skills = await apiFetch<{ id: number; name: string }[]>(`/skills?scope=company`);
      const match = Array.isArray(skills) ? skills.find((s) => s.name === skillName) : null;
      if (match) {
        await apiFetch("/skills/save-from-market", {
          method: "POST",
          body: JSON.stringify({ skill_id: match.id }),
        });
      }
      setSaved((prev) => new Set(prev).add(upstreamId));
    } catch {
      setSaved((prev) => new Set(prev).add(upstreamId));
    } finally {
      setSaving(null);
    }
  }

  async function handleBatchImport() {
    if (!githubUrl.trim() || batchImporting) return;
    setBatchImporting(true);
    setBatchResult(null);
    setGithubResult(null);
    try {
      const data = await apiFetch<{ imported: number; skipped: number; errors: number; results: { name?: string; status: string; reason?: string; id?: number }[] }>(
        "/skill-market/import-github-batch",
        { method: "POST", body: JSON.stringify({ github_url: githubUrl.trim() }) }
      );
      setBatchResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setGithubResult({ ok: false, msg });
    } finally {
      setBatchImporting(false);
    }
  }

  async function handleGithubImport() {
    if (!githubUrl.trim() || githubImporting) return;
    setGithubImporting(true);
    setGithubResult(null);
    try {
      const data = await apiFetch<{ id: number; name: string; description: string }>(
        "/skill-market/import-github",
        { method: "POST", body: JSON.stringify({ github_url: githubUrl.trim() }) }
      );
      setGithubResult({ ok: true, msg: `已导入「${data.name}」(id=${data.id})，状态为草稿，请前往 Skill 管理发布` });
      setGithubUrl("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setGithubResult({ ok: false, msg });
    } finally {
      setGithubImporting(false);
    }
  }

  return (
    <PageShell title="外部 Skill 市场" icon={ICONS.skillMarket}>
      {/* GitHub 导入 */}
      <div className="bg-white border-2 border-[#1A202C] p-4 mb-6">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">
          从 GitHub 导入 Skill
        </div>
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
            {batchImporting ? "批量导入中..." : "批量导入文件夹"}
          </PixelButton>
        </div>
        <p className="text-[9px] text-gray-400 mt-1.5">
          「导入单个」：URL 指向具体 skill 文件夹 &nbsp;|&nbsp; 「批量导入文件夹」：URL 指向含多个 skill 的父文件夹
        </p>
        {githubResult && (
          <div className={`mt-2 px-3 py-2 border-2 text-[10px] font-bold ${
            githubResult.ok
              ? "border-[#00CC99] bg-[#00CC99]/10 text-[#00664D]"
              : "border-red-400 bg-red-50 text-red-700"
          }`}>
            {githubResult.msg}
          </div>
        )}
        {batchResult && (
          <div className="mt-2 border-2 border-[#1A202C]">
            <div className="flex gap-4 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[10px] font-bold">
              <span className="text-[#00CC99]">✓ 已导入 {batchResult.imported}</span>
              <span className="text-gray-400">跳过 {batchResult.skipped}</span>
              {batchResult.errors > 0 && <span className="text-red-500">失败 {batchResult.errors}</span>}
              <span className="text-gray-400 ml-auto">导入完成，状态为草稿，请前往 Skill 管理发布</span>
            </div>
            <div className="max-h-40 overflow-y-auto">
              {batchResult.results.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 last:border-0 text-[10px] ${
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

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-6">
        <PixelSelect
          value={selectedSource ?? ""}
          onChange={(e) => setSelectedSource(Number(e.target.value) || null)}
          className="w-48"
        >
          <option value="">选择数据源...</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
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

      {/* Sources overview */}
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : sources.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无外部数据源
        </div>
      ) : (
        <>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
            数据源
          </div>
          <div className="flex gap-2 mb-6 flex-wrap">
            {sources.map((s) => (
              <div
                key={s.id}
                className={`bg-white border-2 p-3 min-w-48 cursor-pointer transition-colors ${
                  selectedSource === s.id ? "border-[#00D1FF] bg-[#CCF2FF]" : "border-[#1A202C]"
                }`}
                onClick={() => setSelectedSource(s.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">{s.name}</span>
                  <PixelBadge color={s.is_active ? "green" : "red"}>
                    {s.is_active ? "活跃" : "停用"}
                  </PixelBadge>
                </div>
                <p className="text-[10px] text-gray-500 truncate">{s.url}</p>
                <p className="text-[9px] text-gray-400 mt-1">
                  {s.last_synced_at
                    ? `同步：${new Date(s.last_synced_at).toLocaleDateString("zh-CN")}`
                    : "未同步"}
                </p>
              </div>
            ))}
          </div>

          {/* Search results */}
          {remoteSkills.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
                搜索结果
              </div>
              <div className="space-y-2">
                {remoteSkills.map((rs) => (
                  <div
                    key={rs.id}
                    className="bg-white border-2 border-[#1A202C] p-3 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold">{rs.name}</span>
                      <p className="text-[10px] text-gray-500">{rs.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <PixelButton
                        size="sm"
                        variant={saved.has(rs.id) ? "secondary" : "secondary"}
                        onClick={() => handleSaveToMine(rs.id, rs.name)}
                        disabled={saved.has(rs.id) || saving === rs.id}
                      >
                        {saved.has(rs.id) ? "已保存" : saving === rs.id ? "保存中..." : "保存到我的"}
                      </PixelButton>
                      <PixelButton
                        size="sm"
                        onClick={() => handleImport(rs.id)}
                        disabled={importing === rs.id}
                      >
                        {importing === rs.id ? "导入中..." : "导入"}
                      </PixelButton>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </PageShell>
  );
}
