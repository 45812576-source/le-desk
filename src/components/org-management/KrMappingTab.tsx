"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { KrResourceMappingItem } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

const API = "/org-management/kr-mappings";

const RELEVANCE_COLOR: Record<string, "green" | "yellow" | "gray"> = {
  direct: "green",
  indirect: "yellow",
  supporting: "gray",
};

const RELEVANCE_LABEL: Record<string, string> = {
  direct: "直接",
  indirect: "间接",
  supporting: "支撑",
};

export default function KrMappingTab() {
  const [mappings, setMappings] = useState<KrResourceMappingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 新建表单
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    kr_id: "",
    target_type: "resource_library",
    target_code: "",
    relevance: "direct" as "direct" | "indirect" | "supporting",
    description: "",
  });
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<KrResourceMappingItem[]>(API)
      .then(setMappings)
      .catch(() => setMappings([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.kr_id.trim() || !form.target_code.trim()) return;
    setCreating(true);
    try {
      await apiFetch(API, {
        method: "POST",
        body: JSON.stringify({
          kr_id: Number(form.kr_id),
          target_type: form.target_type,
          target_code: form.target_code,
          relevance: form.relevance,
          description: form.description || null,
        }),
      });
      setShowCreate(false);
      setForm({ kr_id: "", target_type: "resource_library", target_code: "", relevance: "direct", description: "" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除此映射？")) return;
    setDeleting(id);
    try {
      await apiFetch(`${API}/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono uppercase">KR → 资源库映射</h2>
        <PixelButton onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1 inline-block" />
          新建映射
        </PixelButton>
      </div>

      {/* 新建表单 */}
      {showCreate && (
        <div className="border-2 border-[#1A202C] bg-white p-4 space-y-3">
          <p className="font-mono font-bold">新建 KR 映射</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="KR ID"
              type="number"
              value={form.kr_id}
              onChange={(e) => setForm({ ...form, kr_id: e.target.value })}
            />
            <select
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              value={form.target_type}
              onChange={(e) => setForm({ ...form, target_type: e.target.value })}
            >
              <option value="resource_library">资源库</option>
              <option value="data_asset">数据资产</option>
              <option value="process">流程</option>
              <option value="tool">工具</option>
            </select>
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="目标编码"
              value={form.target_code}
              onChange={(e) => setForm({ ...form, target_code: e.target.value })}
            />
            <select
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              value={form.relevance}
              onChange={(e) => setForm({ ...form, relevance: e.target.value as "direct" | "indirect" | "supporting" })}
            >
              <option value="direct">直接</option>
              <option value="indirect">间接</option>
              <option value="supporting">支撑</option>
            </select>
          </div>
          <textarea
            className="w-full border-2 border-[#1A202C] p-2 font-mono text-sm"
            rows={2}
            placeholder="描述（选填）"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2">
            <PixelButton onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "创建"}
            </PixelButton>
            <PixelButton variant="ghost" onClick={() => setShowCreate(false)}>取消</PixelButton>
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>
      ) : mappings.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-mono">暂无 KR 映射</p>
      ) : (
        <div className="border-2 border-[#1A202C] overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-[#F0F4F8] border-b-2 border-[#1A202C]">
                <th className="text-left p-3">KR ID</th>
                <th className="text-center p-3">目标类型</th>
                <th className="text-left p-3">目标编码</th>
                <th className="text-center p-3">相关性</th>
                <th className="text-left p-3">描述</th>
                <th className="text-center p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id} className="border-b border-gray-200 hover:bg-[#F0F4F8]">
                  <td className="p-3 font-bold">#{m.kr_id}</td>
                  <td className="p-3 text-center">
                    <PixelBadge color="cyan">{m.target_type}</PixelBadge>
                  </td>
                  <td className="p-3">{m.target_code}</td>
                  <td className="p-3 text-center">
                    <PixelBadge color={RELEVANCE_COLOR[m.relevance] ?? "gray"}>
                      {RELEVANCE_LABEL[m.relevance] ?? m.relevance}
                    </PixelBadge>
                  </td>
                  <td className="p-3 text-gray-500">{m.description ?? "—"}</td>
                  <td className="p-3 text-center">
                    <PixelButton
                      variant="danger"
                      onClick={() => handleDelete(m.id)}
                      disabled={deleting === m.id}
                    >
                      <Trash2 className="w-3 h-3 mr-1 inline-block" />
                      {deleting === m.id ? "删除中..." : "删除"}
                    </PixelButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
