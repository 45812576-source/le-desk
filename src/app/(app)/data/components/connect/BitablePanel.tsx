"use client";

import React, { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import PreviewTable from "../shared/PreviewTable";
import { BitableProbeResult, WikiTable } from "../shared/types";

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

  const [syncStage, setSyncStage] = useState("");

  async function handleSync() {
    if (!probeResult) return;
    setSyncing(true);
    setError("");
    setSyncMsg("");

    setSyncStage("读取字段中");
    const t1 = setTimeout(() => setSyncStage("拉取记录中"), 1500);
    const t2 = setTimeout(() => setSyncStage("创建本地表中"), 4000);
    const t3 = setTimeout(() => setSyncStage("写入记录中"), 6000);

    try {
      const res = await apiFetch<{ ok: boolean; inserted: number; total_fields: number; degraded?: boolean; effective_page_size?: number }>("/business-tables/sync-bitable", {
        method: "POST",
        body: JSON.stringify({
          app_token: probeResult.app_token,
          table_id: probeResult.table_id,
          display_name: displayName.trim(),
        }),
      });
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      const degradedMsg = res.degraded ? `（分页已降级到 ${res.effective_page_size}）` : "";
      setSyncMsg(`✓ 同步完成${degradedMsg}`);
      setSyncStage("");
      onAdded();
    } catch (e: unknown) {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setSyncStage("");
      if (e instanceof Error) {
        try {
          const errData = JSON.parse(e.message);
          setError(`${errData.stage || "同步"}失败: ${errData.error}\n${errData.suggestion || ""}`);
        } catch {
          setError(e.message);
        }
      } else {
        setError("同步失败");
      }
    } finally {
      setSyncing(false);
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
