"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { TableDetail, TableViewDetail, DisclosureLevel, ViewKind, TableCapabilities } from "../shared/types";
import { DISCLOSURE_LABELS, VIEW_KIND_LABELS } from "../shared/types";
import { useV2DataAssets } from "../shared/feature-flags";

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
  capabilities?: TableCapabilities;
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

/** V2 只读画像卡片 */
function ViewProfileCard({ view, detail }: { view: TableViewDetail; detail: TableDetail }) {
  const [expanded, setExpanded] = useState(false);

  // 绑定的 Skill
  const boundSkills = detail.bindings.filter((b) => b.view_id === view.id);
  // 绑定的 Grant
  const boundGrants = detail.skill_grants?.filter((g) => g.view_id === view.id) || [];
  // 可见字段名
  const fieldNames = view.visible_field_ids?.length > 0
    ? detail.fields.filter((f) => f.id && view.visible_field_ids.includes(f.id)).map((f) => f.display_name || f.field_name)
    : [];
  // 允许的角色组名
  const roleGroupNames = view.allowed_role_group_ids?.length > 0
    ? detail.role_groups.filter((rg) => view.allowed_role_group_ids.includes(rg.id)).map((rg) => rg.name)
    : [];

  return (
    <div className="border border-gray-200 bg-[#F8FBFD] p-2 mt-1 text-[8px]">
      <button onClick={() => setExpanded(!expanded)} className="text-[7px] text-[#00A3C4] hover:underline mb-1">
        {expanded ? "收起画像" : "展开画像"}
      </button>
      {expanded && (
        <div className="space-y-1.5">
          {/* 面向谁 */}
          <div>
            <span className="text-gray-400 font-bold uppercase">使用范围:</span>{" "}
            {roleGroupNames.length > 0 ? roleGroupNames.join(", ") : <span className="text-gray-400">默认可复用</span>}
          </div>
          {/* 用途 */}
          <div>
            <span className="text-gray-400 font-bold uppercase">适用场景:</span>{" "}
            {view.view_purpose || <span className="text-gray-400">未说明</span>}
          </div>
          {/* 字段列表 */}
          <div>
            <span className="text-gray-400 font-bold uppercase">字段 ({fieldNames.length}):</span>
            {fieldNames.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {fieldNames.slice(0, 15).map((f) => (
                  <span key={f} className="px-1 py-px bg-white border border-gray-200 rounded text-[7px]">{f}</span>
                ))}
                {fieldNames.length > 15 && <span className="text-gray-400">+{fieldNames.length - 15}</span>}
              </div>
            ) : (
              <span className="text-gray-400 ml-1">全部字段</span>
            )}
          </div>
          {/* 筛选规则 */}
          {view.config.filters?.length > 0 && (
            <div>
              <span className="text-gray-400 font-bold uppercase">筛选:</span>{" "}
              <span>{view.config.filters.length} 条规则</span>
            </div>
          )}
          {/* 披露上限 */}
          {view.disclosure_ceiling && (
            <div>
              <span className="text-gray-400 font-bold uppercase">披露上限:</span>{" "}
              <span className="text-orange-500 font-bold">{view.disclosure_ceiling}</span>
            </div>
          )}
          {/* 绑定的 Skill */}
          {boundSkills.length > 0 && (
            <div>
              <span className="text-gray-400 font-bold uppercase">绑定 Skill:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {boundSkills.map((b) => (
                  <span key={b.skill_id} className="px-1 py-px bg-green-50 border border-green-200 text-green-600 rounded text-[7px]">
                    {b.skill_name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* 影响范围 */}
          <div className="text-[7px] text-gray-400 pt-1 border-t border-gray-200">
            当前被 {boundSkills.length} 个 Skill 使用 · {boundGrants.length} 条授权投影
            {view.row_limit !== null && ` · 行上限 ${view.row_limit}`}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ViewsTab({ detail, onRefresh, capabilities }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const isV2 = useV2DataAssets();

  const canManageViews = capabilities?.can_manage_views ?? false;

  async function handleCreate(form: ViewForm) {
    if (!canManageViews) {
      alert(detail.publish_status === "published" ? "已发布数据表的视图需由管理员维护" : "只有草稿表创建者可新建视图");
      return;
    }
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
    if (!canManageViews) {
      alert(detail.publish_status === "published" ? "已发布数据表的视图需由管理员维护" : "只有草稿表创建者可编辑视图");
      return;
    }
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
    if (!canManageViews) {
      alert(detail.publish_status === "published" ? "已发布数据表的视图需由管理员维护" : "只有草稿表创建者可删除视图");
      return;
    }
    setDeleting(viewId);
    try {
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
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">视图范围 ({detail.views.length})</span>
        <PixelButton size="sm" onClick={() => setCreating(true)} disabled={creating || !canManageViews}>
          + 新建视图
        </PixelButton>
      </div>

      {!canManageViews && (
        <div className="px-4 py-2 text-[8px] text-yellow-700 bg-yellow-50 border-b border-yellow-200">
          {detail.publish_status === "published"
            ? "已发布数据表的视图调整需由管理员处理。"
            : "这里只有 Skill 编辑阶段的使用范围视图；运行时权限仍由 SkillStudio 控制。"}
        </div>
      )}

      {creating && canManageViews && (
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
                <div>
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
                        {v.view_purpose && <span>· 场景: {v.view_purpose}</span>}
                        <span>· {v.visibility_scope}</span>
                        {v.visible_field_ids?.length > 0 && (
                          <span>· {v.visible_field_ids.length} 字段</span>
                        )}
                        {v.allowed_role_group_ids?.length > 0 && (
                          <span>· {v.allowed_role_group_ids.length} 使用组</span>
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
                      <button
                        onClick={() => router.push(`/dev-studio?view_id=${v.id}`)}
                        className="text-[8px] text-[#00CC99] hover:text-[#00A87A] font-bold px-1"
                        title="在 OpenCode 中使用此视图"
                      >
                        在 OpenCode 中使用
                      </button>
                      {!v.is_system && canManageViews && (
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
                  {/* V2: 只读画像 */}
                  {isV2 && <ViewProfileCard view={v} detail={detail} />}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
