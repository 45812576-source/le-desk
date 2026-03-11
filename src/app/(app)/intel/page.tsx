"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS, PixelIcon } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────
interface IntelEntry {
  id: number;
  source_id: number | null;
  title: string;
  content: string;
  url: string | null;
  tags: string[];
  industry: string | null;
  platform: string | null;
  depth: number;
  status: "pending" | "approved" | "rejected";
  auto_collected: boolean;
  created_at: string;
  approved_at: string | null;
}

interface IntelEntriesResponse {
  total: number;
  page: number;
  page_size: number;
  items: IntelEntry[];
}

interface IntelSource {
  id: number;
  name: string;
  source_type: string;
  config: Record<string, unknown>;
  schedule: string | null;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  managed_by: number | null;
  authorized_user_ids: number[];
}

interface IntelTask {
  id: number;
  source_id: number | null;
  status: "queued" | "running" | "completed" | "failed";
  total_urls: number;
  crawled_urls: number;
  new_entries: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
}

interface IntelTasksResponse {
  total: number;
  page: number;
  page_size: number;
  items: IntelTask[];
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function EntryDetailModal({
  entry,
  isAdmin,
  onClose,
  onApprove,
  onReject,
}: {
  entry: IntelEntry;
  isAdmin: boolean;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-[#1A202C] w-[700px] max-w-[95vw] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b-2 border-[#1A202C] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold leading-snug">{entry.title}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <StatusBadge status={entry.status} />
              {entry.industry && (
                <PixelBadge color="cyan">{entry.industry}</PixelBadge>
              )}
              {entry.platform && (
                <PixelBadge color="purple">{entry.platform}</PixelBadge>
              )}
              {entry.tags?.map((t) => (
                <PixelBadge key={t} color="gray">{t}</PixelBadge>
              ))}
              {entry.depth > 0 && (
                <PixelBadge color="yellow">深度 {entry.depth}</PixelBadge>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 border-2 border-[#1A202C] flex items-center justify-center text-[10px] font-bold hover:bg-red-400 hover:text-white hover:border-red-400 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Meta */}
        <div className="px-5 py-2 border-b border-gray-200 bg-[#F0F4F8] flex-shrink-0 flex items-center gap-4 flex-wrap">
          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
            {entry.auto_collected ? "自动采集" : "手动创建"}
          </span>
          <span className="text-[9px] text-gray-400">
            {new Date(entry.created_at).toLocaleString("zh-CN")}
          </span>
          {entry.url && (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[9px] text-[#00A3C4] font-bold hover:underline truncate max-w-xs"
            >
              {entry.url}
            </a>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <pre className="text-[10px] text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
            {entry.content || "（无内容）"}
          </pre>
        </div>

        {/* Admin actions */}
        {isAdmin && entry.status === "pending" && (
          <div className="px-5 py-3 border-t-2 border-[#1A202C] flex items-center gap-2 flex-shrink-0 bg-[#F0F4F8]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mr-2">
              审核操作：
            </span>
            <PixelButton
              size="sm"
              onClick={() => { onApprove(entry.id); onClose(); }}
            >
              ✓ 通过
            </PixelButton>
            <PixelButton
              size="sm"
              variant="danger"
              onClick={() => { onReject(entry.id); onClose(); }}
            >
              ✕ 拒绝
            </PixelButton>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <PixelBadge color="green">已通过</PixelBadge>;
  if (status === "pending")
    return <PixelBadge color="yellow">待审核</PixelBadge>;
  return <PixelBadge color="red">已拒绝</PixelBadge>;
}

function TaskStatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return <PixelBadge color="green">已完成</PixelBadge>;
  if (status === "running")
    return <PixelBadge color="cyan">运行中</PixelBadge>;
  if (status === "queued")
    return <PixelBadge color="yellow">排队中</PixelBadge>;
  return <PixelBadge color="red">失败</PixelBadge>;
}

// ─── Entry Card ───────────────────────────────────────────────────────────────
function EntryCard({
  entry,
  isAdmin,
  onApprove,
  onReject,
  onClick,
}: {
  entry: IntelEntry;
  isAdmin: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onClick: (entry: IntelEntry) => void;
}) {
  return (
    <div
      className="border-2 border-[#1A202C] bg-white p-4 cursor-pointer hover:border-[#00A3C4] hover:bg-[#F0F4F8] transition-colors group"
      onClick={() => onClick(entry)}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[11px] font-bold leading-snug line-clamp-2 group-hover:text-[#00A3C4] transition-colors">
            {entry.title}
          </h3>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1">
          <StatusBadge status={entry.status} />
          {entry.depth > 0 && (
            <PixelBadge color="yellow">L{entry.depth}</PixelBadge>
          )}
        </div>
      </div>

      <p className="text-[9px] text-gray-500 line-clamp-2 leading-relaxed mb-3">
        {entry.content || "（无内容摘要）"}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap">
        {entry.industry && (
          <PixelBadge color="cyan">{entry.industry}</PixelBadge>
        )}
        {entry.platform && (
          <PixelBadge color="purple">{entry.platform}</PixelBadge>
        )}
        {entry.tags?.slice(0, 3).map((t) => (
          <PixelBadge key={t} color="gray">{t}</PixelBadge>
        ))}
        <span className="ml-auto text-[8px] text-gray-400">
          {new Date(entry.created_at).toLocaleDateString("zh-CN")}
        </span>
      </div>

      {/* Admin quick actions */}
      {isAdmin && entry.status === "pending" && (
        <div
          className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[8px] text-gray-400 mr-1 uppercase tracking-widest">
            快速审核：
          </span>
          <button
            onClick={() => onApprove(entry.id)}
            className="px-2 py-0.5 border-2 border-green-400 text-green-600 text-[8px] font-bold uppercase hover:bg-green-400 hover:text-white transition-colors"
          >
            ✓ 通过
          </button>
          <button
            onClick={() => onReject(entry.id)}
            className="px-2 py-0.5 border-2 border-red-300 text-red-400 text-[8px] font-bold uppercase hover:bg-red-400 hover:text-white transition-colors"
          >
            ✕ 拒绝
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Create Source Modal ──────────────────────────────────────────────────────
function CreateSourceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState("crawler");
  const [url, setUrl] = useState("");
  const [schedule, setSchedule] = useState("");
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(20);
  const [includeExternal, setIncludeExternal] = useState(false);
  const [urlPatterns, setUrlPatterns] = useState("");
  const [waitSelector, setWaitSelector] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    try {
      const config: Record<string, unknown> = { url: url.trim() };
      if (sourceType === "deep_crawl") {
        config.max_depth = maxDepth;
        config.max_pages = maxPages;
        config.include_external = includeExternal;
        if (urlPatterns.trim()) {
          config.url_patterns = urlPatterns.split("\n").map(p => p.trim()).filter(Boolean);
        }
      }
      if (sourceType === "crawler" && waitSelector.trim()) {
        config.wait_selector = waitSelector.trim();
      }

      await apiFetch("/intel/sources", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          source_type: sourceType,
          config,
          schedule: schedule.trim() || null,
          is_active: true,
        }),
      });
      onCreated();
      onClose();
    } catch {
      alert("创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white border-2 border-[#1A202C] w-[500px] max-w-[95vw] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b-2 border-[#1A202C] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest">新建数据源</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 border-2 border-[#1A202C] flex items-center justify-center text-[10px] font-bold hover:bg-red-400 hover:text-white hover:border-red-400 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* 名称 */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="数据源名称"
              className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
            />
          </div>

          {/* 类型 */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">类型</label>
            <div className="flex gap-1">
              {[
                { value: "rss", label: "RSS" },
                { value: "crawler", label: "爬虫" },
                { value: "deep_crawl", label: "深度爬虫" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setSourceType(t.value)}
                  className={`px-3 py-1 border-2 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                    sourceType === t.value
                      ? "border-[#1A202C] bg-[#1A202C] text-white"
                      : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
            />
          </div>

          {/* Crawler: wait_selector */}
          {sourceType === "crawler" && (
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">
                等待选择器（可选）
              </label>
              <input
                type="text"
                value={waitSelector}
                onChange={(e) => setWaitSelector(e.target.value)}
                placeholder="如 .article-content"
                className="w-full border-2 border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:border-[#00D1FF]"
              />
              <p className="text-[8px] text-gray-400 mt-0.5">页面加载后等待该 CSS 选择器出现</p>
            </div>
          )}

          {/* Deep Crawl 配置 */}
          {sourceType === "deep_crawl" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">最大深度</label>
                  <input
                    type="number"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    min={1}
                    max={5}
                    className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">最大页数</label>
                  <input
                    type="number"
                    value={maxPages}
                    onChange={(e) => setMaxPages(Number(e.target.value))}
                    min={1}
                    max={100}
                    className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeExternal"
                  checked={includeExternal}
                  onChange={(e) => setIncludeExternal(e.target.checked)}
                  className="w-3 h-3"
                />
                <label htmlFor="includeExternal" className="text-[9px] font-bold text-gray-600">
                  包含外部链接
                </label>
              </div>

              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">
                  URL 过滤规则（可选，每行一个）
                </label>
                <textarea
                  value={urlPatterns}
                  onChange={(e) => setUrlPatterns(e.target.value)}
                  placeholder={"如:\n/blog/*\n/news/*"}
                  rows={3}
                  className="w-full border-2 border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:border-[#00D1FF] resize-none"
                />
              </div>
            </>
          )}

          {/* 定时计划 */}
          <div>
            <label className="text-[9px] font-bold uppercase tracking-widest text-gray-500 block mb-1">
              定时计划（可选，cron 表达式）
            </label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="如 0 8 * * *（每天8点）"
              className="w-full border-2 border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:border-[#00D1FF]"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t-2 border-[#1A202C] flex justify-end gap-2 bg-[#F0F4F8]">
          <PixelButton size="sm" variant="secondary" onClick={onClose}>取消</PixelButton>
          <PixelButton size="sm" onClick={handleSubmit} disabled={saving || !name.trim() || !url.trim()}>
            {saving ? "创建中..." : "创建"}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─── Sources Tab (Admin) ──────────────────────────────────────────────────────
function SourcesTab() {
  const [sources, setSources] = useState<IntelSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<IntelSource[]>("/intel/sources");
      setSources(Array.isArray(data) ? data : []);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  async function handleTrigger(id: number) {
    try {
      const res = await apiFetch<{ ok: boolean; task_id: number }>(`/intel/sources/${id}/run`, { method: "POST" });
      alert(`采集任务已启动（任务ID: ${res.task_id}）`);
    } catch {
      alert("触发失败");
    }
  }

  async function handleToggle(source: IntelSource) {
    try {
      await apiFetch(`/intel/sources/${source.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: !source.is_active }),
      });
      fetchSources();
    } catch {
      alert("操作失败");
    }
  }

  const SOURCE_TYPE_LABELS: Record<string, string> = {
    rss: "RSS",
    crawler: "爬虫",
    deep_crawl: "深度爬虫",
    webhook: "Webhook",
    manual: "手动",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
        <PixelButton size="sm" onClick={() => setShowCreate(true)}>
          + 新建数据源
        </PixelButton>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 bg-[#EBF4F7] border-2 border-[#1A202C] flex items-center justify-center mb-4">
            <PixelIcon {...ICONS.intelSource} size={20} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            暂无数据源
          </p>
        </div>
      ) : (
        <div className="border-2 border-[#1A202C]">
          <table className="w-full">
            <thead>
              <tr className="bg-[#EBF4F7] border-b-2 border-[#1A202C]">
                {["名称", "类型", "计划", "状态", "最近运行", "操作"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] px-4 py-2.5"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sources.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FBFD]"}`}
                >
                  <td className="px-4 py-2.5 text-[10px] font-bold">{s.name}</td>
                  <td className="px-4 py-2.5">
                    <PixelBadge color="cyan">
                      {SOURCE_TYPE_LABELS[s.source_type] ?? s.source_type}
                    </PixelBadge>
                  </td>
                  <td className="px-4 py-2.5 text-[9px] text-gray-500 font-mono">
                    {s.schedule ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {s.is_active ? (
                      <PixelBadge color="green">活跃</PixelBadge>
                    ) : (
                      <PixelBadge color="gray">停用</PixelBadge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[9px] text-gray-400">
                    {s.last_run_at
                      ? new Date(s.last_run_at).toLocaleString("zh-CN")
                      : "未运行"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTrigger(s.id)}
                        className="px-2 py-0.5 border-2 border-[#1A202C] text-[8px] font-bold uppercase hover:bg-[#1A202C] hover:text-white transition-colors"
                      >
                        ▶ 立即采集
                      </button>
                      <button
                        onClick={() => handleToggle(s)}
                        className={`px-2 py-0.5 border-2 text-[8px] font-bold uppercase transition-colors ${
                          s.is_active
                            ? "border-red-300 text-red-400 hover:bg-red-400 hover:text-white"
                            : "border-green-400 text-green-600 hover:bg-green-400 hover:text-white"
                        }`}
                      >
                        {s.is_active ? "停用" : "启用"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateSourceModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchSources}
        />
      )}
    </div>
  );
}

// ─── Tasks Tab (Admin) ────────────────────────────────────────────────────────
function TasksTab() {
  const [tasks, setTasks] = useState<IntelTask[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiFetch<IntelTasksResponse>("/intel/tasks?page_size=50");
      setTasks(data.items ?? []);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    // 有运行中的任务时轮询
    pollRef.current = setInterval(fetchTasks, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 bg-[#EBF4F7] border-2 border-[#1A202C] flex items-center justify-center mb-4">
          <PixelIcon {...ICONS.intel} size={20} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          暂无采集任务
        </p>
      </div>
    );
  }

  return (
    <div className="border-2 border-[#1A202C]">
      <table className="w-full">
        <thead>
          <tr className="bg-[#EBF4F7] border-b-2 border-[#1A202C]">
            {["ID", "状态", "进度", "新增条目", "错误", "开始时间", "完成时间"].map((h) => (
              <th
                key={h}
                className="text-left text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] px-4 py-2.5"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => {
            const progress = t.total_urls > 0 ? Math.round((t.crawled_urls / t.total_urls) * 100) : 0;
            return (
              <tr
                key={t.id}
                className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FBFD]"}`}
              >
                <td className="px-4 py-2.5 text-[10px] font-bold">#{t.id}</td>
                <td className="px-4 py-2.5">
                  <TaskStatusBadge status={t.status} />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-gray-200 border border-gray-300">
                      <div
                        className={`h-full transition-all ${
                          t.status === "failed" ? "bg-red-400" : "bg-[#00D1FF]"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-500 font-mono">
                      {t.crawled_urls}/{t.total_urls}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[10px] font-bold text-[#00A3C4]">
                  {t.new_entries}
                </td>
                <td className="px-4 py-2.5 text-[9px] text-red-400 max-w-[200px] truncate">
                  {t.error_message || "—"}
                </td>
                <td className="px-4 py-2.5 text-[9px] text-gray-400">
                  {t.started_at ? new Date(t.started_at).toLocaleString("zh-CN") : "—"}
                </td>
                <td className="px-4 py-2.5 text-[9px] text-gray-400">
                  {t.finished_at ? new Date(t.finished_at).toLocaleString("zh-CN") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Entries Tab ──────────────────────────────────────────────────────────────
function EntriesTab({ isAdmin }: { isAdmin: boolean }) {
  const [entries, setEntries] = useState<IntelEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState<string>(
    isAdmin ? "" : "approved"
  );
  const [filterIndustry, setFilterIndustry] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [inputQ, setInputQ] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<IntelEntry | null>(null);
  const PAGE_SIZE = 24;

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterIndustry) params.set("industry", filterIndustry);
      if (filterPlatform) params.set("platform", filterPlatform);
      if (searchQ.trim()) params.set("q", searchQ.trim());
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      const data = await apiFetch<IntelEntriesResponse>(
        `/intel/entries?${params}`
      );
      setEntries(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setEntries([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterIndustry, filterPlatform, searchQ, page]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterStatus, filterIndustry, filterPlatform, searchQ]);

  async function handleApprove(id: number) {
    try {
      await apiFetch(`/intel/entries/${id}/approve`, { method: "PATCH" });
      fetchEntries();
    } catch { /* ignore */ }
  }

  async function handleReject(id: number) {
    try {
      await apiFetch(`/intel/entries/${id}/reject`, { method: "PATCH" });
      fetchEntries();
    } catch { /* ignore */ }
  }

  async function handleOpenDetail(entry: IntelEntry) {
    // Fetch full content
    try {
      const full = await apiFetch<IntelEntry>(`/intel/entries/${entry.id}`);
      setSelectedEntry(full);
    } catch {
      setSelectedEntry(entry);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const STATUS_OPTIONS = isAdmin
    ? [
        { value: "", label: "全部" },
        { value: "pending", label: "待审核" },
        { value: "approved", label: "已通过" },
        { value: "rejected", label: "已拒绝" },
      ]
    : [{ value: "approved", label: "已通过" }];

  return (
    <div>
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="搜索标题 / 内容..."
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") setSearchQ(inputQ); }}
          className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold w-56 focus:outline-none focus:border-[#00D1FF]"
        />
        <PixelButton
          size="sm"
          onClick={() => setSearchQ(inputQ)}
          disabled={loading}
        >
          搜索
        </PixelButton>

        <div className="flex items-center gap-1 ml-2">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setFilterStatus(o.value)}
              className={`px-2 py-1 border-2 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                filterStatus === o.value
                  ? "border-[#1A202C] bg-[#1A202C] text-white"
                  : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="行业筛选"
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
          className="border-2 border-gray-300 px-2 py-1 text-[10px] w-28 focus:outline-none focus:border-[#00D1FF]"
        />
        <input
          type="text"
          placeholder="平台筛选"
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="border-2 border-gray-300 px-2 py-1 text-[10px] w-28 focus:outline-none focus:border-[#00D1FF]"
        />

        <span className="ml-auto text-[9px] text-gray-400 font-bold uppercase tracking-widest">
          共 {total} 条
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
            Loading...
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-10 h-10 bg-[#EBF4F7] border-2 border-[#1A202C] flex items-center justify-center mb-4">
            <PixelIcon {...ICONS.intel} size={20} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            暂无情报数据
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              isAdmin={isAdmin}
              onApprove={handleApprove}
              onReject={handleReject}
              onClick={handleOpenDetail}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 mt-5 justify-center">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border-2 border-[#1A202C] text-[9px] font-bold uppercase disabled:opacity-30 hover:bg-[#1A202C] hover:text-white transition-colors"
          >
            ← 上一页
          </button>
          <span className="text-[9px] font-bold text-gray-500 px-2">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border-2 border-[#1A202C] text-[9px] font-bold uppercase disabled:opacity-30 hover:bg-[#1A202C] hover:text-white transition-colors"
          >
            下一页 →
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          isAdmin={isAdmin}
          onClose={() => setSelectedEntry(null)}
          onApprove={(id) => { handleApprove(id); fetchEntries(); }}
          onReject={(id) => { handleReject(id); fetchEntries(); }}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = "entries" | "sources" | "tasks";

export default function IntelPage() {
  const { user } = useAuth();
  const isAdmin =
    user?.role === "super_admin" || user?.role === "dept_admin";
  const [tab, setTab] = useState<Tab>("entries");

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="border-b-2 border-[#1A202C] bg-white px-6 h-12 flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-2 mr-4">
          <PixelIcon {...ICONS.intel} size={16} />
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">
            行业情报
          </h1>
        </div>
        <div className="flex gap-1">
          <PixelButton
            variant={tab === "entries" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab("entries")}
          >
            情报列表
          </PixelButton>
          {isAdmin && (
            <>
              <PixelButton
                variant={tab === "sources" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTab("sources")}
              >
                数据源
              </PixelButton>
              <PixelButton
                variant={tab === "tasks" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTab("tasks")}
              >
                采集任务
              </PixelButton>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {tab === "entries" ? (
          <EntriesTab isAdmin={isAdmin} />
        ) : tab === "sources" ? (
          <SourcesTab />
        ) : (
          <TasksTab />
        )}
      </div>
    </div>
  );
}
