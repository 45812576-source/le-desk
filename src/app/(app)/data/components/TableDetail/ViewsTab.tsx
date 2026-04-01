"use client";

import React, { useState } from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { TableDetail, TableViewDetail, DisclosureLevel, ViewKind } from "../shared/types";
import { DISCLOSURE_LABELS, VIEW_KIND_LABELS } from "../shared/types";

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
}

interface ViewForm {
  name: string;
  view_kind: ViewKind;
  disclosure_ceiling: DisclosureLevel | "";
  visible_field_ids: number[];
  allowed_role_group_ids: number[];
  config: { filters: unknown[]; sorts: unknown[] };
}

const EMPTY_FORM: ViewForm = {
  name: "",
  view_kind: "list",
  disclosure_ceiling: "",
  visible_field_ids: [],
  allowed_role_group_ids: [],
  config: { filters: [], sorts: [] },
};

function ViewFormPanel({
  detail,
  initial,
  onSave,
  onCancel,
  saving,
}: {
  detail: TableDetail;
  initial: ViewForm;
  onSave: (form: ViewForm) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ViewForm>(initial);

  return (
    <div className="border-2 border-[#00D1FF] bg-white p-3 mb-2">
      <div className="space-y-2">
        <div>
          <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-0.5">名称</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 focus:outline-none focus:border-[#00D1FF]"
            placeholder="视图名称"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-0.5">视图类型</label>
            <select
              value={form.view_kind}
              onChange={(e) => setForm({ ...form, view_kind: e.target.value as ViewKind })}
              className="w-full text-[9px] border border-gray-300 px-1 py-0.5 bg-white"
            >
              {Object.entries(VIEW_KIND_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-0.5">披露上限</label>
            <select
              value={form.disclosure_ceiling}
              onChange={(e) => setForm({ ...form, disclosure_ceiling: e.target.value as DisclosureLevel | "" })}
              className="w-full text-[9px] border border-gray-300 px-1 py-0.5 bg-white"
            >
              <option value="">不限</option>
              {Object.entries(DISCLOSURE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-0.5">
            可见字段 ({form.visible_field_ids.length}/{detail.fields.length})
          </label>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {detail.fields.filter((f) => !f.is_system).map((f) => {
              const checked = form.visible_field_ids.includes(f.id!);
              return (
                <label key={f.id} className={`text-[8px] px-1.5 py-0.5 border rounded cursor-pointer transition-colors ${
                  checked ? "border-[#00D1FF] bg-[#F0FBFF] text-[#00A3C4]" : "border-gray-200 text-gray-400"
                }`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const ids = checked
                        ? form.visible_field_ids.filter((id) => id !== f.id)
                        : [...form.visible_field_ids, f.id!];
                      setForm({ ...form, visible_field_ids: ids });
                    }}
                    className="hidden"
                  />
                  {f.display_name || f.field_name}
                </label>
              );
            })}
          </div>
        </div>
        {detail.role_groups.length > 0 && (
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-0.5">允许角色组</label>
            <div className="flex flex-wrap gap-1">
              {detail.role_groups.map((rg) => {
                const checked = form.allowed_role_group_ids.includes(rg.id);
                return (
                  <label key={rg.id} className={`text-[8px] px-1.5 py-0.5 border rounded cursor-pointer transition-colors ${
                    checked ? "border-[#00D1FF] bg-[#F0FBFF] text-[#00A3C4]" : "border-gray-200 text-gray-400"
                  }`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const ids = checked
                          ? form.allowed_role_group_ids.filter((id) => id !== rg.id)
                          : [...form.allowed_role_group_ids, rg.id];
                        setForm({ ...form, allowed_role_group_ids: ids });
                      }}
                      className="hidden"
                    />
                    {rg.name}
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <PixelButton size="sm" onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
          {saving ? "保存中..." : "保存"}
        </PixelButton>
        <button onClick={onCancel} className="text-[8px] text-gray-400 hover:text-[#1A202C]">取消</button>
      </div>
    </div>
  );
}

export default function ViewsTab({ detail, onRefresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function handleCreate(form: ViewForm) {
    setSaving(true);
    try {
      await apiFetch(`/data-assets/tables/${detail.id}/views`, {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          view_kind: form.view_kind,
          disclosure_ceiling: form.disclosure_ceiling || null,
          visible_field_ids: form.visible_field_ids,
          allowed_role_group_ids: form.allowed_role_group_ids,
          config: form.config,
        }),
      });
      setCreating(false);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(viewId: number, form: ViewForm) {
    setSaving(true);
    try {
      await apiFetch(`/data-assets/views/${viewId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name,
          view_kind: form.view_kind,
          disclosure_ceiling: form.disclosure_ceiling || null,
          visible_field_ids: form.visible_field_ids,
          allowed_role_group_ids: form.allowed_role_group_ids,
          config: form.config,
        }),
      });
      setEditingId(null);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(viewId: number) {
    setDeleting(viewId);
    try {
      // 先检查影响
      const impact = await apiFetch<{ binding_count: number; grant_count: number; policy_count: number }>(
        `/data-assets/views/${viewId}/impact`
      );
      if (impact.binding_count > 0 || impact.grant_count > 0) {
        alert(`此视图被 ${impact.binding_count} 个 Skill 绑定和 ${impact.grant_count} 个数据授权引用，请先解除后再删除`);
        return;
      }
      if (!confirm("确认删除此视图？关联的视图级策略也会被删除。")) return;
      await apiFetch(`/data-assets/views/${viewId}`, { method: "DELETE" });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2 border-b-2 border-[#1A202C] bg-[#EBF4F7]">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">视图 ({detail.views.length})</span>
        <PixelButton size="sm" onClick={() => setCreating(true)} disabled={creating}>
          + 新建视图
        </PixelButton>
      </div>

      {creating && (
        <div className="px-4 pt-2">
          <ViewFormPanel
            detail={detail}
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
            saving={saving}
          />
        </div>
      )}

      {detail.views.length === 0 && !creating ? (
        <div className="flex items-center justify-center h-32 text-[10px] text-gray-400 uppercase tracking-widest">
          暂无视图
        </div>
      ) : (
        detail.views.map((v) => {
          const bindingCount = detail.bindings.filter((b) => b.view_id === v.id).length;
          const grantCount = detail.skill_grants?.filter((g) => g.view_id === v.id).length || 0;
          const isEditing = editingId === v.id;

          return (
            <div key={v.id}>
              {isEditing ? (
                <div className="px-4 pt-2">
                  <ViewFormPanel
                    detail={detail}
                    initial={{
                      name: v.name,
                      view_kind: v.view_kind,
                      disclosure_ceiling: v.disclosure_ceiling || "",
                      visible_field_ids: v.visible_field_ids || [],
                      allowed_role_group_ids: v.allowed_role_group_ids || [],
                      config: { filters: v.config.filters || [], sorts: v.config.sorts || [] },
                    }}
                    onSave={(form) => handleEdit(v.id, form)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-[#F0FBFF] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold">{v.name}</span>
                      {v.is_default && <PixelBadge color="cyan">默认</PixelBadge>}
                      {v.is_system && <PixelBadge color="gray">系统</PixelBadge>}
                      <span className="text-[7px] font-bold px-1 py-px bg-gray-50 text-gray-400 rounded">
                        {VIEW_KIND_LABELS[v.view_kind] || v.view_kind}
                      </span>
                      {v.disclosure_ceiling && (
                        <span className="text-[7px] font-bold px-1 py-px bg-orange-50 text-orange-500 rounded">
                          上限 {v.disclosure_ceiling}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[8px] text-gray-400">
                      <span>{v.view_type}</span>
                      {v.view_purpose && <span>· {v.view_purpose}</span>}
                      <span>· {v.visibility_scope}</span>
                      {v.visible_field_ids?.length > 0 && (
                        <span>· {v.visible_field_ids.length} 字段</span>
                      )}
                      {v.allowed_role_group_ids?.length > 0 && (
                        <span>· {v.allowed_role_group_ids.length} 角色组</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {bindingCount > 0 && (
                      <span className="text-[8px] text-[#00A3C4] font-bold">{bindingCount} 绑定</span>
                    )}
                    {grantCount > 0 && (
                      <span className="text-[8px] text-green-500 font-bold">{grantCount} 授权</span>
                    )}
                    {v.config.filters?.length > 0 && (
                      <span className="text-[8px] text-gray-400">{v.config.filters.length} 筛选</span>
                    )}
                    {!v.is_system && (
                      <>
                        <button
                          onClick={() => setEditingId(v.id)}
                          className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-1"
                          title="编辑"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          disabled={deleting === v.id}
                          className="text-[8px] text-gray-400 hover:text-red-500 px-1"
                          title="删除"
                        >
                          {deleting === v.id ? "..." : "删除"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
