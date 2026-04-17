"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrgMemorySource } from "@/lib/types";
import {
  createOrgMemorySnapshot,
  ingestOrgMemorySource,
  loadOrgMemorySources,
  ORG_MEMORY_PARSE_STATUS_LABELS,
  ORG_MEMORY_PARSE_STATUS_STYLES,
  ORG_MEMORY_SOURCE_TYPE_LABELS,
} from "@/lib/org-memory";

export default function OrgMemorySourcesTab() {
  const [sources, setSources] = useState<OrgMemorySource[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [message, setMessage] = useState("点击即可导入源文档，并继续为当前文档生成快照。");
  const [draft, setDraft] = useState({
    title: "组织 Memory 源文档",
    source_type: "feishu_doc" as OrgMemorySource["source_type"],
    source_uri: "https://example.feishu.cn/docx/org-memory-template",
    owner_name: "组织运营组",
  });

  const refreshSources = useCallback(async (preferredId?: number) => {
    return loadOrgMemorySources().then((result) => {
      setSources(result.data);
      setSelectedId((current) => {
        if (preferredId && result.data.some((item) => item.id === preferredId)) return preferredId;
        if (current && result.data.some((item) => item.id === current)) return current;
        return result.data[0]?.id ?? null;
      });
      setFallbackMode(result.fallback);
      setLoadError("");
      return result;
    });
  }, []);

  useEffect(() => {
    let active = true;
    loadOrgMemorySources()
      .then((result) => {
        if (!active) return;
        setSources(result.data);
        setSelectedId(result.data[0]?.id ?? null);
        setFallbackMode(result.fallback);
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setSources([]);
        setSelectedId(null);
        setFallbackMode(false);
        setLoadError(error instanceof Error ? error.message : "源文档加载失败");
      });
    return () => {
      active = false;
    };
  }, [refreshSources]);

  const selected = useMemo(
    () => sources.find((item) => item.id === selectedId) || sources[0] || null,
    [selectedId, sources],
  );

  async function handleIngest() {
    setCreating(true);
    setMessage("正在导入源文档...");
    try {
      const result = await ingestOrgMemorySource({
        ...draft,
        title: `${draft.title} ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      });
      await refreshSources(result.source_id);
      setMessage(`已导入源文档 #${result.source_id}，现在可直接为它生成快照。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入源文档失败");
    }
    setCreating(false);
  }

  async function handleSync(sourceId: number) {
    setSyncingId(sourceId);
    setMessage("正在生成结构化快照...");
    try {
      const result = await createOrgMemorySnapshot(sourceId);
      await refreshSources(sourceId);
      setMessage(`已为源文档 #${sourceId} 生成快照 #${result.snapshot_id}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成快照失败");
    }
    setSyncingId(null);
  }

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">源文档</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              源文档是组织 Memory 的唯一事实源。系统不直接维护组织对象，只记录导入、同步、解析与版本状态。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {fallbackMode && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                演示数据
              </span>
            )}
            <button
              onClick={handleIngest}
              disabled={creating}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? "导入中..." : "导入源文档"}
            </button>
            <button
              onClick={() => selected && handleSync(selected.id)}
              disabled={!selected || syncingId !== null}
              className="rounded bg-[#00A3C4] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncingId === selected?.id ? "生成中..." : "生成快照"}
            </button>
          </div>
        </div>
        {loadError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </div>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">标题</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-0"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">来源类型</span>
            <select
              value={draft.source_type}
              onChange={(event) => setDraft((current) => ({ ...current, source_type: event.target.value as OrgMemorySource["source_type"] }))}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-0"
            >
              {Object.entries(ORG_MEMORY_SOURCE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">来源链接</span>
            <input
              value={draft.source_uri}
              onChange={(event) => setDraft((current) => ({ ...current, source_uri: event.target.value }))}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-0"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">归属团队</span>
            <input
              value={draft.owner_name}
              onChange={(event) => setDraft((current) => ({ ...current, owner_name: event.target.value }))}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-0"
            />
          </label>
        </div>
        <div className="mt-3 text-sm text-muted-foreground">{message}</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="px-2 pb-3 pt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            文档列表
          </div>
          <div className="space-y-2">
            {sources.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  selected?.id === item.id
                    ? "border-[#00A3C4] bg-[#00D1FF]/5"
                    : "border-border bg-background hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ORG_MEMORY_SOURCE_TYPE_LABELS[item.source_type] || item.source_type} · {item.owner_name}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ORG_MEMORY_PARSE_STATUS_STYLES[item.ingest_status]}`}>
                    {ORG_MEMORY_PARSE_STATUS_LABELS[item.ingest_status] || item.ingest_status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">{selected.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{selected.source_uri}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${ORG_MEMORY_PARSE_STATUS_STYLES[selected.ingest_status]}`}>
                  {ORG_MEMORY_PARSE_STATUS_LABELS[selected.ingest_status] || selected.ingest_status}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoItem label="来源类型" value={ORG_MEMORY_SOURCE_TYPE_LABELS[selected.source_type] || selected.source_type} />
                <InfoItem label="归属团队" value={selected.owner_name} />
                <InfoItem label="外部版本" value={selected.external_version || "待同步"} />
                <InfoItem label="最近快照" value={selected.latest_snapshot_version || "未生成"} />
                <InfoItem label="最近同步" value={selected.fetched_at ? new Date(selected.fetched_at).toLocaleString("zh-CN") : "未同步"} />
              </div>

              {selected.latest_parse_note && (
                <div className="mt-5 rounded-lg border border-dashed border-border bg-background px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">解析备注</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{selected.latest_parse_note}</div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleSync(selected.id)}
                  disabled={syncingId !== null}
                  className="rounded bg-[#00A3C4] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {syncingId === selected.id ? "生成中..." : "为当前源生成快照"}
                </button>
                <span className="text-sm text-muted-foreground">
                  已导入后即可生成结构化快照，供后续统一草案消费。
                </span>
              </div>

              <div className="mt-5 rounded-lg border border-border bg-background px-4 py-4">
                <div className="text-sm font-medium text-foreground">源文档约束</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>必须提供组织架构、花名册、部门职责、岗位职责、OKR、业务流程六类关键信息。</li>
                  <li>系统只做解析与版本化，不在这里编辑组织对象。</li>
                  <li>后续所有分类规则、共享边界和 Skill 挂载都只消费解析后的快照与草案。</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">暂无源文档。</div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background px-4 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
