"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrgMemorySource } from "@/lib/types";
import {
  ingestOrgMemorySource,
  loadOrgMemorySources,
  ORG_MEMORY_PARSE_STATUS_LABELS,
  ORG_MEMORY_PARSE_STATUS_STYLES,
  ORG_MEMORY_SOURCE_TYPE_LABELS,
} from "@/lib/org-memory";

export default function OrgMemorySourcesTab({
  onSnapshotReady,
}: {
  onSnapshotReady?: (snapshotId: number | null) => void;
}) {
  const [sources, setSources] = useState<OrgMemorySource[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("导入资料后会自动生成快照，并同步派生一版治理版本。");
  const [draft, setDraft] = useState({
    title: "组织事实资料包",
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
    setMessage("正在导入资料，并生成快照与治理版本...");
    try {
      const result = await ingestOrgMemorySource({
        ...draft,
        title: `${draft.title} ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`,
      });
      await refreshSources(result.source_id);
      onSnapshotReady?.(result.snapshot_id);
      setMessage(
        `已完成资料导入 #${result.source_id}，生成快照 ${result.snapshot_version || "#—"}，治理版本 #${result.governance_version_id ?? "—"} 已就绪。`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入资料失败");
    }
    setCreating(false);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">资料接入</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              资料包是组织事实的唯一事实源。页面只保留导入入口，不再要求业务用户理解 baseline、objects、tags 或 schema。
            </p>
          </div>
          {fallbackMode && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              演示数据
            </span>
          )}
        </div>
        {loadError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">资料标题</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-0"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">资料类型</span>
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
            <span className="text-xs text-muted-foreground">资料链接</span>
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

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleIngest}
            disabled={creating}
            className="rounded bg-[#00A3C4] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "导入中..." : "导入并生成快照"}
          </button>
          <span className="text-sm text-muted-foreground">{message}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="px-2 pb-3 pt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            已接入资料
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
                <InfoItem label="资料类型" value={ORG_MEMORY_SOURCE_TYPE_LABELS[selected.source_type] || selected.source_type} />
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

              <div className="mt-5 rounded-lg border border-border bg-background px-4 py-4">
                <div className="text-sm font-medium text-foreground">接入约束</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>如果资料导入成功，则系统会在同一链路内生成快照与治理版本。</li>
                  <li>如果当前资料未直接服务主链路，则本轮不继续延展到旧治理工具页。</li>
                  <li>如果后续要让 Skill 用数，则运行时只认当前 effective 的治理版本。</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">暂无资料。</div>
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
