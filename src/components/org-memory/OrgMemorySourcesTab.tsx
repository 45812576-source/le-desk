"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrgMemorySource } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import {
  batchCreateSnapshots,
  deleteOrgMemorySource,
  ingestOrgMemorySource,
  loadOrgMemorySources,
  ORG_MEMORY_PARSE_STATUS_LABELS,
  ORG_MEMORY_PARSE_STATUS_STYLES,
  ORG_MEMORY_SOURCE_TYPE_LABELS,
} from "@/lib/org-memory";
import { formatCellValue } from "@/app/(app)/data/components/shared/CellFormatters";

interface WikiTable {
  table_id: string;
  name: string;
}

interface ProbeColumn {
  name: string;
  type: number;
  nullable: boolean;
  comment: string;
}

interface ProbeResult {
  app_token: string;
  table_id: string;
  columns: ProbeColumn[];
  preview_rows: Record<string, unknown>[];
}

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
  const [snapshotting, setSnapshotting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState("粘贴飞书多维表格链接，自动解析数据后添加为资料。");

  // 飞书链接解析状态
  const [urlInput, setUrlInput] = useState("");
  const [titleInput, setTitleInput] = useState("");
  const [ownerInput, setOwnerInput] = useState("组织运营组");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [appToken, setAppToken] = useState("");
  const [tableId, setTableId] = useState("");
  const [wikiTables, setWikiTables] = useState<WikiTable[] | null>(null);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

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

  // 解析飞书链接
  async function probeBitable(token: string, tid: string, displayName?: string) {
    setParsing(true);
    setParseError("");
    try {
      const result = await apiFetch<ProbeResult>("/business-tables/probe-bitable", {
        method: "POST",
        body: JSON.stringify({
          app_token: token,
          table_id: tid,
          display_name: displayName || titleInput || "飞书多维表格",
        }),
      });
      setProbeResult(result);
      setAppToken(result.app_token);
      setTableId(result.table_id);
      setMessage(`解析成功：${result.columns.length} 个字段、${result.preview_rows.length} 行预览数据。确认后点击"添加资料"。`);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "数据探查失败");
      setProbeResult(null);
    }
    setParsing(false);
  }

  async function parseUrl(url: string) {
    if (!url.trim()) return;
    setParsing(true);
    setParseError("");
    setProbeResult(null);
    setWikiTables(null);
    setAppToken("");
    setTableId("");

    const tableParam = url.match(/[?&]table=([A-Za-z0-9]+)/);

    try {
      // wiki 格式：/wiki/{wikiToken}
      const wikiMatch = url.match(/\/wiki\/([A-Za-z0-9]+)/);
      if (wikiMatch) {
        const wikiToken = wikiMatch[1];
        const resolved = await apiFetch<{ app_token: string; title: string; tables: WikiTable[] }>(
          "/business-tables/resolve-wiki",
          { method: "POST", body: JSON.stringify({ wiki_token: wikiToken }) },
        );
        setAppToken(resolved.app_token);
        if (!titleInput) setTitleInput(resolved.title || "飞书多维表格");

        if (resolved.tables.length === 0) {
          setParseError("该文档下没有找到数据表。");
          setParsing(false);
          return;
        }

        // 如果 URL 里有 table= 参数且匹配，直接 probe
        if (tableParam) {
          const matched = resolved.tables.find((t) => t.table_id === tableParam[1]);
          if (matched) {
            setParsing(false);
            await probeBitable(resolved.app_token, matched.table_id, matched.name);
            return;
          }
        }

        // 只有一个表，直接 probe
        if (resolved.tables.length === 1) {
          setParsing(false);
          await probeBitable(resolved.app_token, resolved.tables[0].table_id, resolved.tables[0].name);
          return;
        }

        // 多个表，显示选择器
        setWikiTables(resolved.tables);
        setMessage("该多维表格包含多个数据表，请选择一个。");
        setParsing(false);
        return;
      }

      // base 格式：/base/{appToken}
      const baseMatch = url.match(/\/base\/([A-Za-z0-9]+)/);
      if (baseMatch) {
        const token = baseMatch[1];
        setAppToken(token);

        // URL 里有 table= 参数，直接 probe
        if (tableParam) {
          setParsing(false);
          await probeBitable(token, tableParam[1]);
          return;
        }

        // 没有 table 参数，列出所有表
        const listed = await apiFetch<{ tables: WikiTable[] }>(
          "/business-tables/list-bitable-tables",
          { method: "POST", body: JSON.stringify({ app_token: token }) },
        );

        if (listed.tables.length === 0) {
          setParseError("该多维表格下没有找到数据表。");
          setParsing(false);
          return;
        }

        if (listed.tables.length === 1) {
          setParsing(false);
          await probeBitable(token, listed.tables[0].table_id, listed.tables[0].name);
          return;
        }

        setWikiTables(listed.tables);
        setMessage("该多维表格包含多个数据表，请选择一个。");
        setParsing(false);
        return;
      }

      setParseError("无法识别飞书链接格式，请粘贴包含 /base/ 或 /wiki/ 的完整链接。");
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "链接解析失败");
    }
    setParsing(false);
  }

  function handleUrlChange(value: string) {
    setUrlInput(value);
    // 清空之前的解析结果
    if (probeResult || wikiTables || parseError) {
      setProbeResult(null);
      setWikiTables(null);
      setParseError("");
      setAppToken("");
      setTableId("");
    }
  }

  function handleUrlBlurOrEnter() {
    if (urlInput.trim() && !probeResult && !parsing) {
      void parseUrl(urlInput);
    }
  }

  async function handleAdd() {
    if (!probeResult) {
      setMessage("请先粘贴飞书链接并等待解析完成。");
      return;
    }
    setCreating(true);
    setMessage("正在添加资料...");
    try {
      const result = await ingestOrgMemorySource({
        source_type: "feishu_doc",
        source_uri: urlInput,
        title: titleInput || "飞书多维表格",
        owner_name: ownerInput || "组织运营组",
        bitable_app_token: appToken,
        bitable_table_id: tableId,
        raw_fields: probeResult.columns,
        raw_records: probeResult.preview_rows,
      });
      await refreshSources(result.source_id);
      setMessage(`资料 #${result.source_id} 已添加。可继续添加更多资料，或点击下方「生成快照」。`);
      // 重置输入
      setUrlInput("");
      setTitleInput("");
      setProbeResult(null);
      setWikiTables(null);
      setAppToken("");
      setTableId("");
      setParseError("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "添加资料失败");
    }
    setCreating(false);
  }

  async function handleDelete(sourceId: number) {
    setDeletingId(sourceId);
    try {
      await deleteOrgMemorySource(sourceId);
      await refreshSources();
      setMessage(`资料 #${sourceId} 已删除。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    }
    setDeletingId(null);
  }

  async function handleBatchSnapshot() {
    const ids = sources.map((s) => s.id);
    if (ids.length === 0) {
      setMessage("没有可用的资料。");
      return;
    }
    setSnapshotting(true);
    setMessage("正在为所有资料生成快照...");
    try {
      const result = await batchCreateSnapshots(ids);
      await refreshSources();
      const lastSnapshot = result.snapshots[result.snapshots.length - 1];
      if (lastSnapshot) {
        onSnapshotReady?.(lastSnapshot.snapshot_id);
      }
      setMessage(`已为 ${result.snapshots.length} 份资料生成快照，可在下方查看结果。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成快照失败");
    }
    setSnapshotting(false);
  }

  return (
    <div className="space-y-4">
      {/* 添加资料区 */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">添加资料</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              粘贴飞书多维表格链接，自动解析字段和数据后添加为资料。
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

        {/* 链接输入 */}
        <div className="mt-4 space-y-3">
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">飞书多维表格链接</span>
            <div className="flex gap-2">
              <input
                value={urlInput}
                onChange={(e) => handleUrlChange(e.target.value)}
                onBlur={handleUrlBlurOrEnter}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUrlBlurOrEnter();
                }}
                placeholder="粘贴飞书多维表格链接（支持 /base/ 和 /wiki/ 格式）"
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-0"
              />
              <button
                onClick={() => parseUrl(urlInput)}
                disabled={parsing || !urlInput.trim()}
                className="shrink-0 rounded bg-[#00A3C4] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {parsing ? "解析中..." : "解析"}
              </button>
            </div>
          </label>

          {parseError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {parseError}
            </div>
          )}

          {/* 子表选择器 */}
          {wikiTables && wikiTables.length > 0 && (
            <div className="rounded border border-border bg-background px-4 py-3">
              <div className="text-xs text-muted-foreground mb-2">该多维表格包含多个数据表，请选择：</div>
              <div className="flex flex-wrap gap-2">
                {wikiTables.map((t) => (
                  <button
                    key={t.table_id}
                    onClick={() => {
                      setTableId(t.table_id);
                      setWikiTables(null);
                      void probeBitable(appToken, t.table_id, t.name);
                    }}
                    className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                      tableId === t.table_id
                        ? "border-[#00A3C4] bg-[#CCF2FF] text-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted/30"
                    }`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 数据预览 */}
          {probeResult && (
            <div className="rounded border border-border bg-background overflow-hidden">
              <div className="flex items-center gap-3 bg-muted/30 px-4 py-2.5 border-b border-border">
                <span className="text-xs font-semibold text-foreground">数据预览</span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                  {probeResult.columns.length} 个字段
                </span>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                  {probeResult.preview_rows.length} 行预览
                </span>
              </div>
              {/* 字段标签 */}
              <div className="px-4 py-3 border-b border-border">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">字段结构</div>
                <div className="flex flex-wrap gap-1.5">
                  {probeResult.columns.map((c) => (
                    <span
                      key={c.name}
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] font-medium bg-background"
                    >
                      {c.name}
                      <span className="text-[10px] text-[#00A3C4] font-mono">{c.type}</span>
                    </span>
                  ))}
                </div>
              </div>
              {/* 数据表 */}
              {probeResult.preview_rows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-muted/30">
                        {probeResult.columns.map((c) => (
                          <th
                            key={c.name}
                            className="text-left px-3 py-2 font-semibold text-muted-foreground border-r border-border whitespace-nowrap"
                          >
                            {c.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {probeResult.preview_rows.map((row, i) => (
                        <tr key={i} className={`border-t border-border ${i % 2 === 0 ? "bg-background" : "bg-muted/10"}`}>
                          {probeResult.columns.map((c) => (
                            <td
                              key={c.name}
                              className="px-3 py-1.5 border-r border-border text-foreground max-w-[160px] truncate"
                              title={formatCellValue(row[c.name])}
                            >
                              {row[c.name] === null || row[c.name] === undefined ? (
                                <span className="text-muted-foreground/40">NULL</span>
                              ) : (
                                formatCellValue(row[c.name])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 标题和归属团队 */}
          {probeResult && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">资料标题</span>
                <input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="自动从飞书解析"
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-0"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">归属团队</span>
                <input
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-0"
                />
              </label>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleAdd}
            disabled={creating || !probeResult}
            className="rounded bg-[#00A3C4] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? "添加中..." : "添加资料"}
          </button>
          <span className="text-sm text-muted-foreground">{message}</span>
        </div>
      </div>

      {/* 资料列表 + 详情 */}
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="px-2 pb-3 pt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            已接入资料（{sources.length}）
          </div>
          <div className="space-y-2">
            {sources.map((item) => (
              <div
                key={item.id}
                className={`group relative w-full rounded-lg border px-3 py-3 text-left transition-colors cursor-pointer ${
                  selected?.id === item.id
                    ? "border-[#00A3C4] bg-[#00D1FF]/5"
                    : "border-border bg-background hover:bg-muted/30"
                }`}
                onClick={() => setSelectedId(item.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ORG_MEMORY_SOURCE_TYPE_LABELS[item.source_type] || item.source_type} · {item.owner_name}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ORG_MEMORY_PARSE_STATUS_STYLES[item.ingest_status]}`}>
                      {ORG_MEMORY_PARSE_STATUS_LABELS[item.ingest_status] || item.ingest_status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      disabled={deletingId === item.id}
                      className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                      title="删除"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {sources.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">暂无资料，请先添加。</div>
            )}
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
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">备注</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">{selected.latest_parse_note}</div>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground">暂无资料。</div>
          )}
        </div>
      </div>

      {/* 生成快照按钮 */}
      {sources.length > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-[#00A3C4]/30 bg-[#00D1FF]/5 px-5 py-4">
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">
              确认所有资料版本无误？
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              将为以上 {sources.length} 份资料统一生成结构化快照，并同步派生治理版本。
            </div>
          </div>
          <button
            onClick={handleBatchSnapshot}
            disabled={snapshotting}
            className="shrink-0 rounded bg-[#00CC99] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00b386] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {snapshotting ? "生成中..." : "生成快照"}
          </button>
        </div>
      )}
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
