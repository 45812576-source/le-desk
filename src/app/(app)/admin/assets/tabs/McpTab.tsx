"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { McpToken } from "@/lib/types";

export default function McpTab() {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchTokens = useCallback(() => {
    setLoading(true);
    apiFetch<McpToken[]>("/mcp-tokens").then(setTokens).catch(() => setTokens([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  async function handleCreate(scope: string) {
    setCreating(true);
    try {
      const data = await apiFetch<{ token: string }>("/mcp-tokens", { method: "POST", body: JSON.stringify({ scope }) });
      setNewToken(data.token);
      fetchTokens();
    } catch { /* ignore */ } finally { setCreating(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除该 Token？")) return;
    await apiFetch(`/mcp-tokens/${id}`, { method: "DELETE" }).catch(() => {});
    fetchTokens();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <PixelButton size="sm" onClick={() => handleCreate("user")} disabled={creating}>+ User Token</PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={() => handleCreate("admin")} disabled={creating}>+ Admin Token</PixelButton>
      </div>

      {newToken && (
        <div className="bg-[#C6F6D5] border-2 border-[#38A169] p-3 mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#38A169] mb-1">新 Token（仅显示一次，请立即复制）</div>
            <code className="text-xs font-bold select-all break-all">{newToken}</code>
          </div>
          <PixelButton size="sm" variant="secondary" onClick={() => setNewToken(null)}>关闭</PixelButton>
        </div>
      )}

      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div>
      ) : tokens.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">暂无 Token</div>
      ) : (
        <table className="w-full border-2 border-[#1A202C]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["前缀", "范围", "创建时间", "最后使用", "过期时间", "操作"].map((h) => (
                <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tokens.map((t) => (
              <tr key={t.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2 text-xs font-bold font-mono">{t.prefix}</td>
                <td className="px-3 py-2"><PixelBadge color={t.scope === "admin" ? "purple" : "cyan"}>{t.scope}</PixelBadge></td>
                <td className="px-3 py-2 text-[10px] text-gray-500">{new Date(t.created_at).toLocaleString("zh-CN")}</td>
                <td className="px-3 py-2 text-[10px] text-gray-500">{t.last_used_at ? new Date(t.last_used_at).toLocaleString("zh-CN") : "-"}</td>
                <td className="px-3 py-2 text-[10px] text-gray-500">{t.expires_at ? new Date(t.expires_at).toLocaleDateString("zh-CN") : "永不"}</td>
                <td className="px-3 py-2"><PixelButton size="sm" variant="danger" onClick={() => handleDelete(t.id)}>删除</PixelButton></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
