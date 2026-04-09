"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { CollabProtocolItem, Department } from "@/lib/types";
import { Plus, Pencil, Trash2, X, Save } from "lucide-react";

const API = "/org-management/collab-protocols";

export default function CollabProtocolTab() {
  const [protocols, setProtocols] = useState<CollabProtocolItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // 新建/编辑
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    provider_department_id: "",
    consumer_department_id: "",
    data_object: "",
    trigger_event: "",
    sync_frequency: "",
    latency_tolerance: "",
    sla_description: "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const deptName = useCallback(
    (id: number) => departments.find((d) => d.id === id)?.name ?? `部门#${id}`,
    [departments],
  );

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<CollabProtocolItem[]>(API).catch(() => []),
      apiFetch<Department[]>("/org-management/departments").catch(() => []),
    ]).then(([p, d]) => {
      setProtocols(p);
      setDepartments(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm({ provider_department_id: "", consumer_department_id: "", data_object: "", trigger_event: "", sync_frequency: "", latency_tolerance: "", sla_description: "" });
  }

  function startEdit(p: CollabProtocolItem) {
    setEditingId(p.id);
    setShowCreate(false);
    setForm({
      provider_department_id: String(p.provider_department_id),
      consumer_department_id: String(p.consumer_department_id),
      data_object: p.data_object,
      trigger_event: p.trigger_event ?? "",
      sync_frequency: p.sync_frequency,
      latency_tolerance: p.latency_tolerance ?? "",
      sla_description: p.sla_description ?? "",
    });
  }

  function buildBody() {
    return JSON.stringify({
      provider_department_id: Number(form.provider_department_id),
      consumer_department_id: Number(form.consumer_department_id),
      data_object: form.data_object,
      trigger_event: form.trigger_event || null,
      sync_frequency: form.sync_frequency,
      latency_tolerance: form.latency_tolerance || null,
      sla_description: form.sla_description || null,
    });
  }

  async function handleCreate() {
    if (!form.provider_department_id || !form.consumer_department_id || !form.data_object.trim() || !form.sync_frequency.trim()) return;
    setSaving(true);
    try {
      await apiFetch(API, { method: "POST", body: buildBody() });
      setShowCreate(false);
      resetForm();
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editingId) return;
    setSaving(true);
    try {
      await apiFetch(`${API}/${editingId}`, { method: "PUT", body: buildBody() });
      setEditingId(null);
      resetForm();
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除此协同协议？")) return;
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

  const FREQ_COLOR: Record<string, "green" | "yellow" | "cyan" | "gray"> = {
    "实时": "green",
    "每日": "cyan",
    "每周": "yellow",
    "每月": "gray",
  };

  const formFields = (
    <div className="border-2 border-[#1A202C] bg-white p-4 space-y-3">
      <p className="font-mono font-bold">{editingId ? "编辑协同协议" : "新建协同协议"}</p>
      <div className="grid grid-cols-2 gap-3">
        <select
          className="border-2 border-[#1A202C] p-2 font-mono text-sm"
          value={form.provider_department_id}
          onChange={(e) => setForm({ ...form, provider_department_id: e.target.value })}
        >
          <option value="">选择提供方部门</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          className="border-2 border-[#1A202C] p-2 font-mono text-sm"
          value={form.consumer_department_id}
          onChange={(e) => setForm({ ...form, consumer_department_id: e.target.value })}
        >
          <option value="">选择消费方部门</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          className="border-2 border-[#1A202C] p-2 font-mono text-sm"
          placeholder="协同对象"
          value={form.data_object}
          onChange={(e) => setForm({ ...form, data_object: e.target.value })}
        />
        <input
          className="border-2 border-[#1A202C] p-2 font-mono text-sm"
          placeholder="触发事件（选填）"
          value={form.trigger_event}
          onChange={(e) => setForm({ ...form, trigger_event: e.target.value })}
        />
        <input
          className="border-2 border-[#1A202C] p-2 font-mono text-sm"
          placeholder="同步频率（如：实时/每日/每周）"
          value={form.sync_frequency}
          onChange={(e) => setForm({ ...form, sync_frequency: e.target.value })}
        />
        <input
          className="border-2 border-[#1A202C] p-2 font-mono text-sm"
          placeholder="延迟容忍度（选填）"
          value={form.latency_tolerance}
          onChange={(e) => setForm({ ...form, latency_tolerance: e.target.value })}
        />
      </div>
      <textarea
        className="w-full border-2 border-[#1A202C] p-2 font-mono text-sm"
        rows={2}
        placeholder="SLA 描述（选填）"
        value={form.sla_description}
        onChange={(e) => setForm({ ...form, sla_description: e.target.value })}
      />
      <div className="flex gap-2">
        <PixelButton onClick={editingId ? handleUpdate : handleCreate} disabled={saving}>
          <Save className="w-3 h-3 mr-1 inline-block" />
          {saving ? "保存中..." : "保存"}
        </PixelButton>
        <PixelButton variant="ghost" onClick={() => { setShowCreate(false); setEditingId(null); resetForm(); }}>
          <X className="w-3 h-3 mr-1 inline-block" />
          取消
        </PixelButton>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono uppercase">协同协议</h2>
        <PixelButton onClick={() => { setShowCreate(true); setEditingId(null); resetForm(); }}>
          <Plus className="w-4 h-4 mr-1 inline-block" />
          新建
        </PixelButton>
      </div>

      {(showCreate || editingId) && formFields}

      {loading ? (
        <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>
      ) : protocols.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-mono">暂无协同协议</p>
      ) : (
        <div className="border-2 border-[#1A202C] overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-[#F0F4F8] border-b-2 border-[#1A202C]">
                <th className="text-left p-3">提供方部门</th>
                <th className="text-left p-3">消费方部门</th>
                <th className="text-left p-3">协同对象</th>
                <th className="text-left p-3">触发事件</th>
                <th className="text-center p-3">同步频率</th>
                <th className="text-center p-3">延迟容忍度</th>
                <th className="text-left p-3">SLA</th>
                <th className="text-center p-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {protocols.map((p) => (
                <tr key={p.id} className="border-b border-gray-200 hover:bg-[#F0F4F8]">
                  <td className="p-3 font-bold">{deptName(p.provider_department_id)}</td>
                  <td className="p-3">{deptName(p.consumer_department_id)}</td>
                  <td className="p-3">{p.data_object}</td>
                  <td className="p-3 text-gray-500">{p.trigger_event ?? "—"}</td>
                  <td className="p-3 text-center">
                    <PixelBadge color={FREQ_COLOR[p.sync_frequency] ?? "cyan"}>
                      {p.sync_frequency}
                    </PixelBadge>
                  </td>
                  <td className="p-3 text-center">{p.latency_tolerance ?? "—"}</td>
                  <td className="p-3 text-gray-500">{p.sla_description ?? "—"}</td>
                  <td className="p-3 text-center">
                    <div className="flex gap-1 justify-center">
                      <PixelButton variant="secondary" onClick={() => startEdit(p)}>
                        <Pencil className="w-3 h-3 mr-1 inline-block" />
                        编辑
                      </PixelButton>
                      <PixelButton variant="danger" onClick={() => handleDelete(p.id)} disabled={deleting === p.id}>
                        <Trash2 className="w-3 h-3 mr-1 inline-block" />
                        {deleting === p.id ? "..." : "删除"}
                      </PixelButton>
                    </div>
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
