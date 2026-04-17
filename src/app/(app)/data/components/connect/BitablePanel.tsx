"use client";

import React, { useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import { useJobPoller } from "@/lib/useJobPoller";
import PreviewTable from "../shared/PreviewTable";
import { BitableProbeResult, WikiTable } from "../shared/types";

const STAGE_LABELS: Record<string, string> = {
  queued: "排队中",
  fetch_fields: "读取字段中",
  fetch_records: "拉取记录中",
  create_table: "创建本地表中",
  insert_records: "写入记录中",
  register: "注册表信息",
  done: "完成",
  failed: "失败",
};

function BitablePanel({ onAdded }: { onAdded: () => void }) {
  const [linkInput, setLinkInput] = useState("");
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
  const [syncStage, setSyncStage] = useState("");
  const [parseNotice, setParseNotice] = useState("");

  const { jobStatus, startPolling, stopPolling } = useJobPoller("/business-tables/sync-bitable/jobs");

  // 监听 job 状态变化
  useEffect(() => {
    if (!jobStatus) return;
    const label = STAGE_LABELS[jobStatus.stage || ""] || jobStatus.stage || "";
    setSyncStage(label);

    if (jobStatus.status === "success") {
      setSyncing(false);
      setSyncStage("");
      const degraded = jobStatus.stats?.degraded;
      const pageSize = jobStatus.stats?.effective_page_size;
      const degradedMsg = degraded ? `（分页已降级到 ${pageSize}）` : "";
      setSyncMsg(`✓ 同步完成${degradedMsg}`);
      onAdded();
    } else if (jobStatus.status === "partial_success") {
      setSyncing(false);
      setSyncStage("");
      const truncated = jobStatus.stats?.truncated;
      const totalRecords = jobStatus.stats?.total_records;
      const limit = jobStatus.stats?.max_records_limit;
      if (truncated) {
        setError(`⚠ 同步已完成前 ${totalRecords?.toLocaleString()} 条记录（上限 ${limit?.toLocaleString()}），该表数据量超大，已截断`);
      } else {
        setError("⚠ 部分同步成功，部分记录未能同步，数据不完整，请重试或检查飞书权限");
      }
    } else if (jobStatus.status === "failed") {
      setSyncing(false);
      setSyncStage("");
      setError(`${label || "同步"}失败: ${jobStatus.error || "未知错误"}`);
    }
  }, [jobStatus, onAdded, stopPolling]);

  async function probeBitable(nextAppToken: string, nextTableId: string, nextDisplayName: string) {
    if (!nextAppToken.trim() || !nextTableId.trim()) {
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
        body: JSON.stringify({
          app_token: nextAppToken.trim(),
          table_id: nextTableId.trim(),
          display_name: nextDisplayName.trim(),
        }),
      });
      setProbeResult(data);
      const fieldCount = data.columns.length;
      const rowCount = data.preview_rows.length;
      setParseNotice(
        rowCount > 0
          ? `已读到 ${fieldCount} 个字段 / ${rowCount} 行样例，可以继续同步。`
          : `已读到 ${fieldCount} 个字段，但样例为空；可能是源表为空、Table ID 选错，或飞书应用缺少记录读取权限。`
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "预览失败");
      setParseNotice("链接已解析，但没有读到字段和样例；请检查飞书应用权限或表链接。");
    } finally {
      setProbing(false);
    }
  }

  // Parse app_token + table_id from a pasted URL
  async function parseUrl(url: string) {
    const nextUrl = url.trim();
    if (!nextUrl) return;
    setParseNotice("正在解析链接...");
    setProbeResult(null);
    setSyncMsg("");
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
        const nextDisplayName = displayName || res.title;
        setAppToken(res.app_token);
        if (!displayName) setDisplayName(res.title);
        if (res.tables.length === 1) {
          setTableId(res.tables[0].table_id);
          await probeBitable(res.app_token, res.tables[0].table_id, nextDisplayName);
        } else if (tableParam) {
          const matched = res.tables.find((t) => t.table_id === tableParam[1]);
          if (matched) {
            setTableId(matched.table_id);
            await probeBitable(res.app_token, matched.table_id, nextDisplayName);
          } else {
            setWikiTables(res.tables);
            setParseNotice("这个 Wiki 链接里有多个数据表，请先选择一个表再预览。");
          }
        } else {
          setWikiTables(res.tables);
          setParseNotice("这个 Wiki 链接里有多个数据表，请先选择一个表再预览。");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Wiki 解析失败");
        setParseNotice("Wiki 链接解析失败，请确认系统飞书应用能访问该文档。");
      } finally {
        setResolvingWiki(false);
      }
      return;
    }
    setError("");
    setWikiTables(null);
    const m = url.match(/\/base\/([A-Za-z0-9]+)/);
    if (m) {
      setAppToken(m[1]);
      const t = url.match(/[?&]table=([A-Za-z0-9]+)/);
      if (t) {
        setTableId(t[1]);
        await probeBitable(m[1], t[1], displayName);
      } else {
        try {
          const res = await apiFetch<{ tables: WikiTable[] }>(
            "/business-tables/list-bitable-tables",
            { method: "POST", body: JSON.stringify({ app_token: m[1] }) }
          );
          if (res.tables.length === 1) {
            setTableId(res.tables[0].table_id);
            await probeBitable(m[1], res.tables[0].table_id, displayName);
          } else if (res.tables.length > 1) {
            setWikiTables(res.tables);
            setParseNotice("这个多维表格里有多个数据表，请先选择一个表再预览。");
          } else {
            setParseNotice("已识别 App Token，但没有读到数据表列表；请检查飞书应用权限。");
          }
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : "获取表列表失败");
          setParseNotice("已识别 App Token，但无法读取表列表；请检查飞书应用权限。");
        }
      }
    } else {
      const t = url.match(/[?&]table=([A-Za-z0-9]+)/);
      if (t) {
        setTableId(t[1]);
        setParseNotice("只识别到 Table ID，还需要 App Token 才能预览字段和数据。");
      } else {
        setParseNotice("未识别到 /base/ 或 /wiki/ 链接，请确认复制的是飞书多维表格链接。");
      }
    }
  }

  async function handleProbe() {
    await probeBitable(appToken, tableId, displayName);
  }

  async function handleSync() {
    if (!probeResult) return;
    setSyncing(true);
    setError("");
    setSyncMsg("");
    setSyncStage("提交任务中");

    try {
      const res = await apiFetch<{ job_id: number }>("/business-tables/sync-bitable/jobs", {
        method: "POST",
        body: JSON.stringify({
          app_token: probeResult.app_token,
          table_id: probeResult.table_id,
          display_name: displayName.trim(),
        }),
      });
      startPolling(res.job_id);
    } catch (e: unknown) {
      setSyncStage("");
      setSyncing(false);
      setError(e instanceof Error ? e.message : "同步失败");
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
              value={linkInput}
              placeholder="支持 /base/ 或 /wiki/ 链接，粘贴后自动解析"
              onChange={(e) => setLinkInput(e.target.value)}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text) {
                  e.preventDefault();
                  setLinkInput(text);
                  void parseUrl(text);
                }
              }}
              onBlur={(e) => { if (e.target.value) void parseUrl(e.target.value); }}
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
          {parseNotice && (
            <p className={`text-[10px] font-bold ${
              parseNotice.includes("已读到") && !parseNotice.includes("样例为空")
                ? "text-green-600"
                : "text-amber-600"
            }`}>
              {parseNotice}
            </p>
          )}
          {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
          {syncMsg && <p className={`text-[10px] font-bold ${syncMsg.startsWith("⚠") ? "text-amber-600" : "text-green-600"}`}>{syncMsg}</p>}

          {wikiTables && wikiTables.length > 0 && (
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                该多维表格包含多个数据表，请选择：
              </p>
              <div className="flex flex-wrap gap-1.5">
                {wikiTables.map((t) => (
                  <button
                    key={t.table_id}
                    onClick={() => {
                      setTableId(t.table_id);
                      setWikiTables(null);
                      void probeBitable(appToken, t.table_id, displayName);
                    }}
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
                {syncing ? (syncStage || "同步中...") : "⟳ 全量同步到本地"}
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

export default BitablePanel;
