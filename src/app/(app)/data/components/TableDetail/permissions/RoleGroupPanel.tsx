"use client";

import React, { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { TableRoleGroup } from "../../shared/types";

const GROUP_TYPE_LABELS: Record<string, { label: string; color: "cyan" | "green" | "yellow" }> = {
  human_role: { label: "人员", color: "cyan" },
  skill_role: { label: "Skill", color: "green" },
  mixed: { label: "混合", color: "yellow" },
};

interface Props {
  tableId: number;
  roleGroups: TableRoleGroup[];
  onRefresh: () => void;
  canManage?: boolean;
  published?: boolean;
}

export default function RoleGroupPanel({ tableId, roleGroups, onRefresh, canManage = true, published = false }: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [groupType, setGroupType] = useState("human_role");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    if (!canManage) {
      alert(published ? "已发布数据表的角色组需由管理员维护" : "只有草稿表创建者可新建角色组");
      return;
    }
    try {
      await apiFetch(`/data-assets/tables/${tableId}/role-groups`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), group_type: groupType }),
      });
      setName("");
      setCreating(false);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "创建失败");
    }
  }

  async function handleRename(groupId: number) {
    if (!editName.trim()) return;
    if (!canManage) {
      alert(published ? "已发布数据表的角色组需由管理员维护" : "只有草稿表创建者可编辑角色组");
      return;
    }
    try {
      await apiFetch(`/data-assets/role-groups/${groupId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      setEditingId(null);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "重命名失败");
    }
  }

  async function handleDelete(groupId: number, groupName: string) {
    if (!canManage) {
      alert(published ? "已发布数据表的角色组需由管理员维护" : "只有草稿表创建者可删除角色组");
      return;
    }
    if (!confirm(`确认删除角色组「${groupName}」？关联的权限策略将一并删除。`)) return;
    try {
      await apiFetch(`/data-assets/role-groups/${groupId}`, { method: "DELETE" });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">角色组</span>
        <PixelButton size="sm" variant="secondary" onClick={() => setCreating(true)} disabled={!canManage}>+ 新建</PixelButton>
      </div>

      {!canManage && (
        <div className="mb-3 px-2 py-1.5 text-[8px] text-yellow-700 bg-yellow-50 border border-yellow-200">
          {published ? "已发布数据表的角色组需由管理员维护。" : "只有草稿表创建者可维护角色组。"}
        </div>
      )}

      {creating && canManage && (
        <div className="flex items-center gap-2 mb-3 p-2 border border-[#00D1FF] bg-[#F0FBFF]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
            placeholder="角色组名称"
            className="flex-1 text-[9px] border border-gray-300 px-1.5 py-0.5 focus:outline-none focus:border-[#00D1FF]"
            autoFocus
          />
          <select
            value={groupType}
            onChange={(e) => setGroupType(e.target.value)}
            className="text-[9px] border border-gray-300 px-1 py-0.5"
          >
            <option value="human_role">人员角色</option>
            <option value="skill_role">Skill 角色</option>
            <option value="mixed">混合</option>
          </select>
          <PixelButton size="sm" onClick={handleCreate}>创建</PixelButton>
          <button onClick={() => setCreating(false)} className="text-[8px] text-gray-400 hover:text-[#1A202C]">✕</button>
        </div>
      )}

      {roleGroups.length === 0 ? (
        <div className="text-[9px] text-gray-400 py-4 text-center">暂无角色组，点击「新建」创建第一个</div>
      ) : (
        <div className="space-y-1">
          {roleGroups.map((rg) => {
            const typeInfo = GROUP_TYPE_LABELS[rg.group_type] || GROUP_TYPE_LABELS.human_role;
            const memberCount = (rg.user_ids?.length || 0) + (rg.department_ids?.length || 0) + (rg.skill_ids?.length || 0);
            return (
              <div key={rg.id} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 hover:bg-[#F0FBFF] transition-colors group">
                {editingId === rg.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => handleRename(rg.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(rg.id); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 text-[10px] font-bold border border-[#00D1FF] px-1 py-0 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <span className="text-[10px] font-bold flex-1">{rg.name}</span>
                )}
                <PixelBadge color={typeInfo.color}>{typeInfo.label}</PixelBadge>
                {rg.is_system && <PixelBadge color="gray">系统</PixelBadge>}
                <span className="text-[8px] text-gray-400">{memberCount} 成员</span>
                {!rg.is_system && canManage && (
                  <div className="hidden group-hover:flex items-center gap-1">
                    <button
                      onClick={() => { setEditingId(rg.id); setEditName(rg.name); }}
                      className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5"
                      title="重命名"
                    >✎</button>
                    <button
                      onClick={() => handleDelete(rg.id, rg.name)}
                      className="text-[8px] text-gray-400 hover:text-red-400 px-0.5"
                      title="删除"
                    >✕</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
