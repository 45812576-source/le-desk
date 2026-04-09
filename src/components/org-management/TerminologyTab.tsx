"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { BizTerminology } from "@/lib/types";
import { Upload, Plus, Search } from "lucide-react";
import ImportWizard from "./ImportWizard";

const API = "/org-management/terminologies";

export default function TerminologyTab() {
  const [terms, setTerms] = useState<BizTerminology[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  // 新建表单
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ term: "", aliases: "", definition: "", resource_library_code: "" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQ) params.set("q", searchQ);
    apiFetch<BizTerminology[]>(`${API}?${params}`)
      .then(setTerms)
      .catch(() => setTerms([]))
      .finally(() => setLoading(false));
  }, [searchQ]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.term.trim()) return;
    setCreating(true);
    try {
      await apiFetch(API, {
        method: "POST",
        body: JSON.stringify({
          term: form.term,
          aliases: form.aliases ? form.aliases.split(",").map((a) => a.trim()).filter(Boolean) : [],
          definition: form.definition || null,
          resource_library_code: form.resource_library_code || null,
        }),
      });
      setShowCreate(false);
      setForm({ term: "", aliases: "", definition: "", resource_library_code: "" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  if (showImport) {
    return (
      <ImportWizard
        importType="terminology"
        onClose={() => { setShowImport(false); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono uppercase">业务术语</h2>
        <div className="flex gap-2">
          <PixelButton onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-1 inline-block" />
            导入
          </PixelButton>
          <PixelButton onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1 inline-block" />
            新建
          </PixelButton>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full border-2 border-[#1A202C] p-2 pl-9 font-mono text-sm"
          placeholder="搜索术语..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
      </div>

      {/* 新建表单 */}
      {showCreate && (
        <div className="border-2 border-[#1A202C] bg-white p-4 space-y-3">
          <p className="font-mono font-bold">新建术语</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="术语名称"
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
            />
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="别名（逗号分隔）"
              value={form.aliases}
              onChange={(e) => setForm({ ...form, aliases: e.target.value })}
            />
          </div>
          <textarea
            className="w-full border-2 border-[#1A202C] p-2 font-mono text-sm"
            rows={2}
            placeholder="定义"
            value={form.definition}
            onChange={(e) => setForm({ ...form, definition: e.target.value })}
          />
          <input
            className="w-full border-2 border-[#1A202C] p-2 font-mono text-sm"
            placeholder="资源库编码（选填）"
            value={form.resource_library_code}
            onChange={(e) => setForm({ ...form, resource_library_code: e.target.value })}
          />
          <div className="flex gap-2">
            <PixelButton onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "创建"}
            </PixelButton>
            <PixelButton variant="ghost" onClick={() => setShowCreate(false)}>取消</PixelButton>
          </div>
        </div>
      )}

      {/* 术语列表 */}
      {loading ? (
        <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>
      ) : terms.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-mono">暂无术语数据</p>
      ) : (
        <div className="border-2 border-[#1A202C] overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-[#F0F4F8] border-b-2 border-[#1A202C]">
                <th className="text-left p-3">术语</th>
                <th className="text-left p-3">别名</th>
                <th className="text-left p-3">定义</th>
                <th className="text-left p-3">资源库编码</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id} className="border-b border-gray-200 hover:bg-[#F0F4F8]">
                  <td className="p-3 font-bold">{t.term}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {t.aliases.map((a, i) => (
                        <PixelBadge key={i} color="cyan">{a}</PixelBadge>
                      ))}
                      {t.aliases.length === 0 && <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="p-3 text-gray-600 max-w-[300px] truncate">{t.definition || "—"}</td>
                  <td className="p-3 text-gray-500">{t.resource_library_code || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
