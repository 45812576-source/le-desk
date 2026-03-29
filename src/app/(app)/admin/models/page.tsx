"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { ModelConfig, ModelSlot } from "@/lib/types";

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

const FALLBACK_LABELS: Record<string, string> = {
  default: "DB 默认模型",
  lite: "轻量模型 (ARK deepseek-v3.2)",
  preflight_exec: "Preflight 执行 (doubao-seed-2.0-pro)",
  preflight_score: "Preflight 评分 (kimi-k2.5)",
};

type Tab = "models" | "assignments";

export default function AdminModelsPage() {
  const [tab, setTab] = useState<Tab>("models");
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [slots, setSlots] = useState<ModelSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ModelConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  const fetchModels = useCallback(() => {
    setLoading(true);
    apiFetch<ModelConfig[]>("/admin/models")
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  const fetchSlots = useCallback(() => {
    apiFetch<ModelSlot[]>("/admin/model-assignments")
      .then(setSlots)
      .catch(() => setSlots([]));
  }, []);

  useEffect(() => {
    fetchModels();
    fetchSlots();
  }, [fetchModels, fetchSlots]);

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
      fetchSlots();
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
      fetchSlots();
    } catch {
      // ignore
    }
  }

  function updateField(field: keyof ModelConfig, value: string | number | boolean) {
    setEditing((prev) => (prev ? { ...prev, [field]: value } : null));
  }

  async function handleSlotChange(slotKey: string, modelConfigId: number | null) {
    setSavingSlot(slotKey);
    try {
      if (modelConfigId === null) {
        await apiFetch(`/admin/model-assignments/${slotKey}`, { method: "DELETE" });
      } else {
        await apiFetch(`/admin/model-assignments/${slotKey}`, {
          method: "PUT",
          body: JSON.stringify({ model_config_id: modelConfigId }),
        });
      }
      fetchSlots();
    } catch {
      // ignore
    } finally {
      setSavingSlot(null);
    }
  }

  // 按 category 分组 slots
  const groupedSlots = slots.reduce<Record<string, ModelSlot[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  const CATEGORY_ORDER = ["对话", "Skill", "知识", "项目", "PEV", "沙箱", "工具", "其他"];
  const sortedCategories = CATEGORY_ORDER.filter((c) => groupedSlots[c]);

  return (
    <PageShell
      title="模型配置"
      icon={ICONS.models}
      actions={
        tab === "models" ? (
          <PixelButton onClick={() => setEditing({ ...EMPTY })}>+ 新增模型</PixelButton>
        ) : undefined
      }
    >
      {/* Tab bar */}
      <div className="flex gap-0 mb-6 border-b-2 border-[#1A202C]">
        {([
          ["models", "模型列表"],
          ["assignments", "调用点配置"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-2 border-b-0 -mb-[2px] transition-colors ${
              tab === key
                ? "bg-white border-[#1A202C] text-[#1A202C]"
                : "bg-[#EBF4F7] border-transparent text-[#00A3C4] hover:bg-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: 模型列表 ── */}
      {tab === "models" && (
        <>
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
        </>
      )}

      {/* ── Tab: 调用点配置 ── */}
      {tab === "assignments" && (
        <div className="space-y-6">
          {slots.length === 0 ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
              加载中...
            </div>
          ) : (
            sortedCategories.map((category) => (
              <div key={category}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2 px-1">
                  {category}
                </div>
                <div className="border-2 border-[#1A202C] divide-y divide-gray-200">
                  {groupedSlots[category].map((slot) => (
                    <div
                      key={slot.slot_key}
                      className="flex items-center justify-between px-3 py-2 hover:bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{slot.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{slot.desc}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <select
                          value={slot.model_config_id ?? ""}
                          disabled={savingSlot === slot.slot_key}
                          onChange={(e) => {
                            const v = e.target.value;
                            handleSlotChange(slot.slot_key, v === "" ? null : Number(v));
                          }}
                          className="border-2 border-[#1A202C] px-2 py-1 text-xs font-bold bg-white focus:outline-none focus:border-[#00D1FF] min-w-[180px]"
                        >
                          <option value="">
                            默认 — {FALLBACK_LABELS[slot.fallback] || slot.fallback}
                          </option>
                          {models.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.model_id})
                            </option>
                          ))}
                        </select>
                        {slot.model_config_id && (
                          <PixelBadge color="cyan">已绑定</PixelBadge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </PageShell>
  );
}
