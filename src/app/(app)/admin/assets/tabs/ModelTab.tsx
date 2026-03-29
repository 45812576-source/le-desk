"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { ModelConfig, ModelSlot } from "@/lib/types";

const EMPTY: ModelConfig = {
  id: 0, name: "", provider: "", model_id: "", api_base: "", api_key_env: "",
  max_tokens: 4096, temperature: "0.7", is_default: false,
};

const FALLBACK_LABELS: Record<string, string> = {
  default: "DB 默认模型",
  lite: "轻量模型 (ARK deepseek-v3.2)",
  preflight_exec: "Preflight 执行 (doubao-seed-2.0-pro)",
  preflight_score: "Preflight 评分 (kimi-k2.5)",
};

const RESTRICTED_MODEL_KEYS = ["lemondata/gpt-5.4"];
const MODEL_LABELS: Record<string, string> = { "lemondata/gpt-5.4": "GPT-5.4 (LemonData)" };

interface Grant {
  id: number; user_id: number; display_name: string; model_key: string;
  granted_by: number | null; granted_at: string | null;
}
interface User { id: number; display_name: string; username: string; }

type SubTab = "models" | "assignments" | "grants";

export default function ModelTab() {
  const [subTab, setSubTab] = useState<SubTab>("models");
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [slots, setSlots] = useState<ModelSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ModelConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);

  // Grants state
  const [grants, setGrants] = useState<Grant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<number | "">("");
  const [selectedModel, setSelectedModel] = useState(RESTRICTED_MODEL_KEYS[0]);
  const [grantSaving, setGrantSaving] = useState(false);

  const fetchModels = useCallback(() => {
    setLoading(true);
    apiFetch<ModelConfig[]>("/admin/models").then(setModels).catch(() => setModels([])).finally(() => setLoading(false));
  }, []);

  const fetchSlots = useCallback(() => {
    apiFetch<ModelSlot[]>("/admin/model-assignments").then(setSlots).catch(() => setSlots([]));
  }, []);

  const fetchGrants = useCallback(() => {
    setGrantsLoading(true);
    apiFetch<Grant[]>("/admin/model-grants").then(setGrants).catch(() => setGrants([])).finally(() => setGrantsLoading(false));
  }, []);

  useEffect(() => {
    fetchModels(); fetchSlots(); fetchGrants();
    apiFetch<User[]>("/admin/users").then(setUsers).catch(() => {});
  }, [fetchModels, fetchSlots, fetchGrants]);

  async function handleSave() {
    if (!editing || saving) return;
    setSaving(true);
    try {
      const { id, ...body } = editing;
      if (id === 0) await apiFetch("/admin/models", { method: "POST", body: JSON.stringify(body) });
      else await apiFetch(`/admin/models/${id}`, { method: "PUT", body: JSON.stringify(body) });
      setEditing(null); fetchModels(); fetchSlots();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除？")) return;
    await apiFetch(`/admin/models/${id}`, { method: "DELETE" }).catch(() => {});
    fetchModels(); fetchSlots();
  }

  function updateField(field: keyof ModelConfig, value: string | number | boolean) {
    setEditing((prev) => (prev ? { ...prev, [field]: value } : null));
  }

  async function handleSlotChange(slotKey: string, modelConfigId: number | null) {
    setSavingSlot(slotKey);
    try {
      if (modelConfigId === null) await apiFetch(`/admin/model-assignments/${slotKey}`, { method: "DELETE" });
      else await apiFetch(`/admin/model-assignments/${slotKey}`, { method: "PUT", body: JSON.stringify({ model_config_id: modelConfigId }) });
      fetchSlots();
    } catch { /* ignore */ } finally { setSavingSlot(null); }
  }

  async function handleGrant() {
    if (!selectedUser || grantSaving) return;
    setGrantSaving(true);
    try {
      await apiFetch(`/admin/model-grants/${selectedUser}?model_key=${encodeURIComponent(selectedModel)}`, { method: "POST" });
      setSelectedUser(""); fetchGrants();
    } catch { /* ignore */ } finally { setGrantSaving(false); }
  }

  async function handleRevoke(userId: number, modelKey: string) {
    if (!confirm("确认撤销该用户的模型授权？")) return;
    await apiFetch(`/admin/model-grants/${userId}?model_key=${encodeURIComponent(modelKey)}`, { method: "DELETE" }).catch(() => {});
    fetchGrants();
  }

  const groupedSlots = slots.reduce<Record<string, ModelSlot[]>>((acc, s) => { (acc[s.category] ??= []).push(s); return acc; }, {});
  const CATEGORY_ORDER = ["对话", "Skill", "知识", "项目", "PEV", "沙箱", "工具", "其他"];
  const sortedCategories = CATEGORY_ORDER.filter((c) => groupedSlots[c]);

  return (
    <div>
      {/* Sub tabs */}
      <div className="flex gap-0 mb-4 border-b-2 border-[#1A202C]">
        {([["models", "模型列表"], ["assignments", "调用点配置"], ["grants", "模型授权"]] as [SubTab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-2 border-b-0 -mb-[2px] transition-colors ${
              subTab === key ? "bg-white border-[#1A202C] text-[#1A202C]" : "bg-[#EBF4F7] border-transparent text-[#00A3C4] hover:bg-white"
            }`}
          >{label}</button>
        ))}
        {subTab === "models" && (
          <div className="ml-auto flex items-center">
            <PixelButton size="sm" onClick={() => setEditing({ ...EMPTY })}>+ 新增模型</PixelButton>
          </div>
        )}
      </div>

      {/* Models */}
      {subTab === "models" && (
        <>
          {editing && (
            <div className="bg-white border-2 border-[#1A202C] p-4 mb-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">
                {editing.id === 0 ? "新增模型" : "编辑模型"}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {(["name", "provider", "model_id", "api_base", "api_key_env"] as const).map((f) => (
                  <input key={f} type="text" placeholder={f} value={editing[f]}
                    onChange={(e) => updateField(f, e.target.value)}
                    className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]" />
                ))}
                <input type="number" placeholder="max_tokens" value={editing.max_tokens}
                  onChange={(e) => updateField("max_tokens", Number(e.target.value))}
                  className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]" />
                <input type="text" placeholder="temperature" value={editing.temperature}
                  onChange={(e) => updateField("temperature", e.target.value)}
                  className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]" />
                <label className="flex items-center gap-2 text-xs font-bold col-span-2">
                  <input type="checkbox" checked={editing.is_default} onChange={(e) => updateField("is_default", e.target.checked)} />
                  设为默认模型
                </label>
              </div>
              <div className="flex gap-2">
                <PixelButton onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "保存"}</PixelButton>
                <PixelButton variant="secondary" onClick={() => setEditing(null)}>取消</PixelButton>
              </div>
            </div>
          )}
          {loading ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div>
          ) : models.length === 0 ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">暂无模型配置</div>
          ) : (
            <table className="w-full border-2 border-[#1A202C]">
              <thead>
                <tr className="bg-[#EBF4F7]">
                  {["名称", "Provider", "Model ID", "Max Tokens", "温度", "默认", "操作"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">{h}</th>
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
                    <td className="px-3 py-2">{m.is_default && <PixelBadge color="green">默认</PixelBadge>}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <PixelButton size="sm" variant="secondary" onClick={() => setEditing({ ...m })}>编辑</PixelButton>
                        <PixelButton size="sm" variant="danger" onClick={() => handleDelete(m.id)}>删除</PixelButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Assignments */}
      {subTab === "assignments" && (
        <div className="space-y-6">
          {slots.length === 0 ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">加载中...</div>
          ) : (
            sortedCategories.map((category) => (
              <div key={category}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2 px-1">{category}</div>
                <div className="border-2 border-[#1A202C] divide-y divide-gray-200">
                  {groupedSlots[category].map((slot) => (
                    <div key={slot.slot_key} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{slot.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{slot.desc}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <select value={slot.model_config_id ?? ""} disabled={savingSlot === slot.slot_key}
                          onChange={(e) => { const v = e.target.value; handleSlotChange(slot.slot_key, v === "" ? null : Number(v)); }}
                          className="border-2 border-[#1A202C] px-2 py-1 text-xs font-bold bg-white focus:outline-none focus:border-[#00D1FF] min-w-[180px]"
                        >
                          <option value="">默认 — {FALLBACK_LABELS[slot.fallback] || slot.fallback}</option>
                          {models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.model_id})</option>)}
                        </select>
                        {slot.model_config_id && <PixelBadge color="cyan">已绑定</PixelBadge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Grants */}
      {subTab === "grants" && (
        <>
          <div className="bg-white border-2 border-[#1A202C] p-4 mb-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">新增授权</div>
            <div className="flex items-center gap-3 flex-wrap">
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value ? Number(e.target.value) : "")}
                className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF] min-w-[180px]"
              >
                <option value="">选择用户</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.display_name} (@{u.username})</option>)}
              </select>
              <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
                className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
              >
                {RESTRICTED_MODEL_KEYS.map((k) => <option key={k} value={k}>{MODEL_LABELS[k] ?? k}</option>)}
              </select>
              <PixelButton onClick={handleGrant} disabled={!selectedUser || grantSaving}>
                {grantSaving ? "授权中..." : "授权"}
              </PixelButton>
            </div>
          </div>
          {grantsLoading ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div>
          ) : grants.length === 0 ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">暂无授权记录</div>
          ) : (
            <table className="w-full border-2 border-[#1A202C]">
              <thead>
                <tr className="bg-[#EBF4F7]">
                  {["用户", "模型", "授权时间", "操作"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grants.map((g) => (
                  <tr key={g.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs font-bold">{g.display_name}</td>
                    <td className="px-3 py-2"><PixelBadge color="yellow">{MODEL_LABELS[g.model_key] ?? g.model_key}</PixelBadge></td>
                    <td className="px-3 py-2 text-xs text-gray-500">{g.granted_at ? new Date(g.granted_at).toLocaleString("zh-CN") : "-"}</td>
                    <td className="px-3 py-2"><PixelButton size="sm" variant="danger" onClick={() => handleRevoke(g.user_id, g.model_key)}>撤销</PixelButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
