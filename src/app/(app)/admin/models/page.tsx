"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { ModelConfig } from "@/lib/types";

const EMPTY: ModelConfig = {
  id: 0,
  name: "",
  provider: "",
  model_id: "",
  api_base: "",
  api_key_env: "",
  max_tokens: 4096,
  temperature: "0.7",
  is_default: false,
};

export default function AdminModelsPage() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ModelConfig | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchModels = useCallback(() => {
    setLoading(true);
    apiFetch<ModelConfig[]>("/admin/models")
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  async function handleSave() {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const { id, ...body } = editing;
      if (id === 0) {
        await apiFetch("/admin/models", { method: "POST", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/admin/models/${id}`, { method: "PUT", body: JSON.stringify(body) });
      }
      setEditing(null);
      fetchModels();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除？")) return;
    try {
      await apiFetch(`/admin/models/${id}`, { method: "DELETE" });
      fetchModels();
    } catch {
      // ignore
    }
  }

  function updateField(field: keyof ModelConfig, value: string | number | boolean) {
    setEditing((prev) => (prev ? { ...prev, [field]: value } : null));
  }

  return (
    <PageShell
      title="模型配置"
      icon={ICONS.models}
      actions={
        <PixelButton onClick={() => setEditing({ ...EMPTY })}>+ 新增模型</PixelButton>
      }
    >
      {/* Edit form */}
      {editing && (
        <div className="bg-white border-2 border-[#1A202C] p-4 mb-6">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">
            {editing.id === 0 ? "新增模型" : "编辑模型"}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {(["name", "provider", "model_id", "api_base", "api_key_env"] as const).map((f) => (
              <input
                key={f}
                type="text"
                placeholder={f}
                value={editing[f]}
                onChange={(e) => updateField(f, e.target.value)}
                className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
              />
            ))}
            <input
              type="number"
              placeholder="max_tokens"
              value={editing.max_tokens}
              onChange={(e) => updateField("max_tokens", Number(e.target.value))}
              className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
            />
            <input
              type="text"
              placeholder="temperature"
              value={editing.temperature}
              onChange={(e) => updateField("temperature", e.target.value)}
              className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
            />
            <label className="flex items-center gap-2 text-xs font-bold col-span-2">
              <input
                type="checkbox"
                checked={editing.is_default}
                onChange={(e) => updateField("is_default", e.target.checked)}
              />
              设为默认模型
            </label>
          </div>
          <div className="flex gap-2">
            <PixelButton onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </PixelButton>
            <PixelButton variant="secondary" onClick={() => setEditing(null)}>
              取消
            </PixelButton>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : models.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无模型配置
        </div>
      ) : (
        <table className="w-full border-2 border-[#1A202C]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["名称", "Provider", "Model ID", "Max Tokens", "温度", "默认", "操作"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2 text-xs font-bold">{m.name}</td>
                <td className="px-3 py-2 text-xs">{m.provider}</td>
                <td className="px-3 py-2 text-xs font-mono">{m.model_id}</td>
                <td className="px-3 py-2 text-xs">{m.max_tokens}</td>
                <td className="px-3 py-2 text-xs">{m.temperature}</td>
                <td className="px-3 py-2">
                  {m.is_default && <PixelBadge color="green">默认</PixelBadge>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <PixelButton size="sm" variant="secondary" onClick={() => setEditing({ ...m })}>
                      编辑
                    </PixelButton>
                    <PixelButton size="sm" variant="danger" onClick={() => handleDelete(m.id)}>
                      删除
                    </PixelButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
