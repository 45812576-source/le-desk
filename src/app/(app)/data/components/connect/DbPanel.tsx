"use client";

import React, { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import PreviewTable from "../shared/PreviewTable";
import { ProbeResult } from "../shared/types";

function DbPanel({ onAdded }: { onAdded: () => void }) {
  const [dbUrl, setDbUrl] = useState("");
  const [tableName, setTableName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleProbe() {
    if (!dbUrl.trim() || !tableName.trim()) { setError("请填写数据库地址和表名"); return; }
    setError(""); setProbing(true); setProbeResult(null); setSaved(false);
    try {
      const data = await apiFetch<ProbeResult>("/business-tables/probe", {
        method: "POST",
        body: JSON.stringify({ db_url: dbUrl.trim(), table_name: tableName.trim() }),
      });
      setProbeResult(data);
      if (!displayName.trim()) setDisplayName(data.table_name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setProbing(false);
    }
  }

  async function handleAdd() {
    if (!probeResult) return;
    setSaving(true); setError("");
    try {
      await apiFetch("/business-tables/import-external", {
        method: "POST",
        body: JSON.stringify({
          db_url: dbUrl.trim(),
          table_name: tableName.trim(),
          display_name: displayName.trim() || probeResult.table_name,
        }),
      });
      setSaved(true);
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-[#1A202C] bg-white">
        <div className="px-4 py-2.5 bg-[#EBF4F7] border-b-2 border-[#1A202C]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— 数据库连接</span>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">数据库地址</label>
            <input value={dbUrl} onChange={(e) => setDbUrl(e.target.value)}
              placeholder="mysql+pymysql://user:pass@host:3306/dbname"
              className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-[#00D1FF]" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">表名</label>
              <input value={tableName} onChange={(e) => setTableName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleProbe()}
                placeholder="例：orders"
                className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] font-mono focus:outline-none focus:border-[#00D1FF]" />
            </div>
            <div className="flex-1">
              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">显示名称（可选）</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="留空则用表名"
                className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] focus:outline-none focus:border-[#00D1FF]" />
            </div>
          </div>
          {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <PixelButton onClick={handleProbe} disabled={probing}>
              {probing ? "连接中..." : "▶ 连接并预览"}
            </PixelButton>
            {probeResult && !saved && (
              <PixelButton variant="secondary" onClick={handleAdd} disabled={saving}>
                {saving ? "导入中..." : "+ 导入到本地"}
              </PixelButton>
            )}
            {saved && <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">✓ 已添加</span>}
          </div>
        </div>
      </div>
      {probeResult && (
        <PreviewTable title={probeResult.table_name} columns={probeResult.columns} rows={probeResult.preview_rows} />
      )}
    </div>
  );
}

export default DbPanel;
