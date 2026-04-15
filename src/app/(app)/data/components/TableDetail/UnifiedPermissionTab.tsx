"use client";

import React, { useState, useMemo } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type {
  TableDetail,
  TableRoleGroup,
  TablePermissionPolicy,
  SkillBindingDetail,
  SkillDataGrant,
  DisclosureLevel,
  RowAccessMode,
  FieldAccessMode,
  TableCapabilities,
} from "../shared/types";
import { DISCLOSURE_LABELS } from "../shared/types";
import MemberEditor from "./permissions/MemberEditor";
import SkillBindingCreator from "./permissions/SkillBindingCreator";
import PermissionPreview from "./permissions/PermissionPreview";

// ── 类型定义 ──

type SelectionType = "skill" | "role_group";

interface Selection {
  type: SelectionType;
  id: number;
  skillId?: number; // 角色组所属的 Skill（可选）
}

interface SkillNode {
  skillId: number;
  skillName: string;
  binding: SkillBindingDetail;
  grant?: SkillDataGrant;
  roleGroups: TableRoleGroup[];
}

// ── 常量 ──

const ROW_ACCESS_LABELS: Record<string, string> = {
  none: "禁止", all: "全部", owner: "仅归属人", department: "仅本部门", rule: "规则",
};
const FIELD_ACCESS_LABELS: Record<string, string> = {
  all: "全部字段", allowlist: "白名单", blocklist: "黑名单",
};
const TOOL_LABELS: Record<string, string> = {
  deny: "禁止", readonly: "只读", readwrite: "读写",
};
const GROUP_TYPE_LABELS: Record<string, { label: string; color: "cyan" | "green" | "yellow" }> = {
  human_role: { label: "人员", color: "cyan" },
  skill_role: { label: "Skill", color: "green" },
  mixed: { label: "混合", color: "yellow" },
};

// ── Props ──

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
  capabilities?: TableCapabilities;
}

export default function UnifiedPermissionTab({ detail, onRefresh, capabilities }: Props) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showBindingCreator, setShowBindingCreator] = useState(false);
  const [creatingRoleGroupForSkill, setCreatingRoleGroupForSkill] = useState<number | null>(null);
  const [newRoleGroupName, setNewRoleGroupName] = useState("");
  const [newRoleGroupType, setNewRoleGroupType] = useState("human_role");
  const bindingDisabledReason = !capabilities?.can_manage_bindings
    ? (detail.publish_status === "published" ? "已发布数据表仅管理员可维护 Skill 绑定" : "草稿数据表需先申请发布后才能绑定 Skill")
    : null;
  const roleGroupDisabledReason = !capabilities?.can_manage_role_groups
    ? (detail.publish_status === "published" ? "已发布数据表的角色组需由管理员维护" : "只有草稿表创建者可维护角色组")
    : null;

  // 构建 Skill 树
  const { skillNodes, orphanRoleGroups } = useMemo(() => {
    const nodes: SkillNode[] = [];
    const assignedRoleGroupIds = new Set<number>();

    // 按 skill 聚合 bindings
    const skillMap = new Map<number, SkillNode>();
    for (const b of detail.bindings) {
      if (!skillMap.has(b.skill_id)) {
        const grant = detail.skill_grants?.find((g) => g.skill_id === b.skill_id);
        skillMap.set(b.skill_id, {
          skillId: b.skill_id,
          skillName: b.skill_name,
          binding: b,
          grant,
          roleGroups: [],
        });
      }
    }

    // 分配角色组到 Skill（通过 skill_ids 字段）
    for (const rg of detail.role_groups) {
      for (const sid of (rg.skill_ids || [])) {
        if (skillMap.has(sid)) {
          skillMap.get(sid)!.roleGroups.push(rg);
          assignedRoleGroupIds.add(rg.id);
        }
      }
    }

    nodes.push(...skillMap.values());

    // 未关联任何 Skill 的角色组
    const orphans = detail.role_groups.filter((rg) => !assignedRoleGroupIds.has(rg.id));

    return { skillNodes: nodes, orphanRoleGroups: orphans };
  }, [detail.bindings, detail.role_groups, detail.skill_grants]);

  // ── 创建角色组 ──
  async function handleCreateRoleGroup(skillId?: number) {
    if (roleGroupDisabledReason) {
      alert(roleGroupDisabledReason);
      return;
    }
    if (!newRoleGroupName.trim()) return;
    try {
      await apiFetch(`/data-assets/tables/${detail.id}/role-groups`, {
        method: "POST",
        body: JSON.stringify({
          name: newRoleGroupName.trim(),
          group_type: newRoleGroupType,
          skill_ids: skillId ? [skillId] : [],
        }),
      });
      setNewRoleGroupName("");
      setCreatingRoleGroupForSkill(null);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "创建失败");
    }
  }

  // ── 删除绑定 ──
  async function handleDeleteBinding(bindingId: number) {
    if (bindingDisabledReason) {
      alert(bindingDisabledReason);
      return;
    }
    if (!confirm("确认解除此绑定？")) return;
    await apiFetch(`/data-assets/bindings/${bindingId}`, { method: "DELETE" });
    onRefresh();
  }

  // ── 选中的对象 ──
  const selectedRoleGroup = selection?.type === "role_group"
    ? detail.role_groups.find((rg) => rg.id === selection.id)
    : null;

  const selectedSkillNode = selection?.type === "skill"
    ? skillNodes.find((n) => n.skillId === selection.id)
    : null;

  const selectedPolicy = selectedRoleGroup
    ? detail.permission_policies.find((p) => p.role_group_id === selectedRoleGroup.id && !p.view_id)
    : null;

  return (
    <div className="flex h-full">
      {/* ── 左栏：Skill 列表 + 角色组树 ── */}
      <div className="w-64 flex-shrink-0 border-r-2 border-[#1A202C] overflow-y-auto">
        <div className="p-2 border-b border-gray-200">
          <PixelButton
            size="sm"
            variant="secondary"
            onClick={() => setShowBindingCreator(true)}
            className="w-full"
            disabled={!capabilities?.can_manage_bindings}
          >
            + 绑定 Skill
          </PixelButton>
        </div>

        {bindingDisabledReason && (
          <div className="px-2 py-1.5 border-b border-yellow-200 bg-yellow-50 text-[8px] text-yellow-700">
            {bindingDisabledReason}
          </div>
        )}

        {showBindingCreator && (
          <div className="p-2 border-b border-gray-200">
            <SkillBindingCreator
              tableId={detail.id}
              views={detail.views}
              disabledReason={bindingDisabledReason}
              onCreated={() => { setShowBindingCreator(false); onRefresh(); }}
              onCancel={() => setShowBindingCreator(false)}
            />
          </div>
        )}

        {/* Skill 节点 */}
        {skillNodes.map((node) => (
          <div key={node.skillId}>
            {/* Skill 行 */}
            <button
              onClick={() => setSelection({ type: "skill", id: node.skillId })}
              className={`w-full text-left px-3 py-2 border-b border-gray-100 text-[9px] hover:bg-[#F0FBFF] transition-colors flex items-center gap-2 ${
                selection?.type === "skill" && selection.id === node.skillId ? "bg-[#F0FBFF] border-l-2 border-l-[#00D1FF]" : ""
              }`}
            >
              <span className="text-[8px] text-gray-400">▼</span>
              <span className="font-bold flex-1 truncate">{node.skillName}</span>
              <PixelBadge color="green">已绑定</PixelBadge>
            </button>

            {/* 该 Skill 下的角色组 */}
            {node.roleGroups.map((rg) => {
              const memberCount = (rg.user_ids?.length || 0) + (rg.department_ids?.length || 0) + (rg.skill_ids?.length || 0);
              return (
                <button
                  key={rg.id}
                  onClick={() => setSelection({ type: "role_group", id: rg.id, skillId: node.skillId })}
                  className={`w-full text-left pl-8 pr-3 py-1.5 border-b border-gray-50 text-[9px] hover:bg-[#F0FBFF] transition-colors flex items-center gap-1.5 ${
                    selection?.type === "role_group" && selection.id === rg.id ? "bg-[#F0FBFF] border-l-2 border-l-[#00A3C4]" : ""
                  }`}
                >
                  <span className="text-gray-300">├</span>
                  <span className="flex-1 truncate">{rg.name}</span>
                  <span className="text-[7px] text-gray-400">{memberCount}人</span>
                </button>
              );
            })}

            {/* 新建角色组按钮 */}
            {creatingRoleGroupForSkill === node.skillId ? (
              <div className="pl-8 pr-3 py-1.5 border-b border-gray-100 flex items-center gap-1">
                <input
                  value={newRoleGroupName}
                  onChange={(e) => setNewRoleGroupName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateRoleGroup(node.skillId); if (e.key === "Escape") setCreatingRoleGroupForSkill(null); }}
                  placeholder="角色组名称"
                  className="flex-1 text-[8px] border border-gray-300 px-1 py-0.5 focus:outline-none focus:border-[#00D1FF]"
                  autoFocus
                />
                <select
                  value={newRoleGroupType}
                  onChange={(e) => setNewRoleGroupType(e.target.value)}
                  className="text-[7px] border border-gray-300 px-0.5 py-0.5"
                >
                  <option value="human_role">人员</option>
                  <option value="skill_role">Skill</option>
                  <option value="mixed">混合</option>
                </select>
                <button onClick={() => handleCreateRoleGroup(node.skillId)} className="text-[8px] text-[#00A3C4] font-bold">✓</button>
                <button onClick={() => setCreatingRoleGroupForSkill(null)} className="text-[8px] text-gray-400">✕</button>
              </div>
            ) : (
              <button
                onClick={() => { setCreatingRoleGroupForSkill(node.skillId); setNewRoleGroupName(""); }}
                disabled={!capabilities?.can_manage_role_groups}
                className="w-full text-left pl-8 pr-3 py-1 text-[8px] text-gray-400 hover:text-[#00A3C4] border-b border-gray-100"
              >
                └ + 新建角色组
              </button>
            )}
          </div>
        ))}

        {/* 未关联 Skill 的角色组 */}
        {orphanRoleGroups.length > 0 && (
          <>
            <div className="px-3 py-1.5 bg-gray-50 text-[7px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200">
              未关联 Skill 的角色组
            </div>
            {orphanRoleGroups.map((rg) => {
              const memberCount = (rg.user_ids?.length || 0) + (rg.department_ids?.length || 0) + (rg.skill_ids?.length || 0);
              const typeInfo = GROUP_TYPE_LABELS[rg.group_type] || GROUP_TYPE_LABELS.human_role;
              return (
                <button
                  key={rg.id}
                  onClick={() => setSelection({ type: "role_group", id: rg.id })}
                  className={`w-full text-left px-3 py-2 border-b border-gray-100 text-[9px] hover:bg-[#F0FBFF] transition-colors flex items-center gap-2 ${
                    selection?.type === "role_group" && selection.id === rg.id ? "bg-[#F0FBFF] border-l-2 border-l-[#00A3C4]" : ""
                  }`}
                >
                  <span className="flex-1 truncate font-bold">{rg.name}</span>
                  <PixelBadge color={typeInfo.color}>{typeInfo.label}</PixelBadge>
                  {rg.is_system && <PixelBadge color="gray">系统</PixelBadge>}
                  <span className="text-[7px] text-gray-400">{memberCount}人</span>
                </button>
              );
            })}
          </>
        )}

        {/* 底部：新建未关联角色组 */}
        {creatingRoleGroupForSkill === -1 ? (
          <div className="px-3 py-2 flex items-center gap-1">
            <input
              value={newRoleGroupName}
              onChange={(e) => setNewRoleGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateRoleGroup(); if (e.key === "Escape") setCreatingRoleGroupForSkill(null); }}
              placeholder="角色组名称"
              className="flex-1 text-[8px] border border-gray-300 px-1 py-0.5 focus:outline-none focus:border-[#00D1FF]"
              autoFocus
            />
            <select
              value={newRoleGroupType}
              onChange={(e) => setNewRoleGroupType(e.target.value)}
              className="text-[7px] border border-gray-300 px-0.5 py-0.5"
            >
              <option value="human_role">人员</option>
              <option value="skill_role">Skill</option>
              <option value="mixed">混合</option>
            </select>
            <button onClick={() => handleCreateRoleGroup()} className="text-[8px] text-[#00A3C4] font-bold">✓</button>
            <button onClick={() => setCreatingRoleGroupForSkill(null)} className="text-[8px] text-gray-400">✕</button>
          </div>
        ) : (
          <button
            onClick={() => { setCreatingRoleGroupForSkill(-1); setNewRoleGroupName(""); }}
            disabled={!capabilities?.can_manage_role_groups}
            className="w-full text-left px-3 py-2 text-[8px] text-gray-400 hover:text-[#00A3C4]"
          >
            + 新建角色组
          </button>
        )}
      </div>

      {/* ── 右栏：详情/编辑面板 ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!selection ? (
          <div className="flex flex-col items-center justify-center h-full text-[10px] text-gray-400 gap-2">
            <div className="text-[9px] font-bold uppercase tracking-widest">选择左侧的 Skill 或角色组</div>
            <div className="text-[8px]">查看详情或编辑权限配置</div>
          </div>
        ) : selection.type === "skill" && selectedSkillNode ? (
          <SkillDetailPanel
            node={selectedSkillNode}
            onDeleteBinding={handleDeleteBinding}
            canManageBindings={capabilities?.can_manage_bindings ?? false}
          />
        ) : selection.type === "role_group" && selectedRoleGroup ? (
          <RoleGroupDetailPanel
            roleGroup={selectedRoleGroup}
            policy={selectedPolicy || null}
            detail={detail}
            onRefresh={onRefresh}
            canManageRoleGroups={capabilities?.can_manage_role_groups ?? false}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[9px] text-gray-400">
            所选项不存在
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 右栏子面板：Skill 详情
// ═══════════════════════════════════════════════════════════════════════════════

function SkillDetailPanel({
  node,
  onDeleteBinding,
  canManageBindings,
}: {
  node: SkillNode;
  onDeleteBinding: (bindingId: number) => void;
  canManageBindings: boolean;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* 基础信息 */}
      <div className="border-2 border-[#1A202C] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">Skill 绑定详情</span>
          {node.binding.binding_id && canManageBindings && (
            <button
              onClick={() => onDeleteBinding(node.binding.binding_id!)}
              className="text-[8px] text-gray-400 hover:text-red-500 px-1"
            >
              解除绑定
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-[9px]">
          <div>
            <span className="text-[8px] text-gray-400 font-bold uppercase block">Skill 名称</span>
            <span className="font-bold">{node.skillName}</span>
          </div>
          <div>
            <span className="text-[8px] text-gray-400 font-bold uppercase block">状态</span>
            {node.binding.status === "legacy_unbound" ? (
              <PixelBadge color="yellow">待迁移</PixelBadge>
            ) : (
              <PixelBadge color="green">已绑定</PixelBadge>
            )}
          </div>
          <div>
            <span className="text-[8px] text-gray-400 font-bold uppercase block">绑定类型</span>
            <span>{node.binding.binding_type || "—"}</span>
          </div>
          <div>
            <span className="text-[8px] text-gray-400 font-bold uppercase block">绑定视图</span>
            <span>{node.binding.view_name || "未绑定"}</span>
          </div>
          {node.binding.alias && (
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">别名</span>
              <span>{node.binding.alias}</span>
            </div>
          )}
        </div>
      </div>

      {/* 数据授权 Grant */}
      {node.grant && (
        <div className="border-2 border-[#00D1FF] p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">数据授权</div>
          <div className="grid grid-cols-3 gap-3 text-[9px]">
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">授权模式</span>
              <span className={`font-bold ${node.grant.grant_mode === "deny" ? "text-red-500" : "text-green-500"}`}>
                {node.grant.grant_mode === "deny" ? "拒绝" : "允许"}
              </span>
            </div>
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">最高披露</span>
              <span className="font-bold">
                {DISCLOSURE_LABELS[node.grant.max_disclosure_level as DisclosureLevel] || node.grant.max_disclosure_level}
              </span>
            </div>
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">需审批</span>
              <span className={`font-bold ${node.grant.approval_required ? "text-orange-500" : "text-gray-400"}`}>
                {node.grant.approval_required ? "是" : "否"}
              </span>
            </div>
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">允许操作</span>
              <span>{(node.grant.allowed_actions || []).join(", ") || "无"}</span>
            </div>
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">审计级别</span>
              <span>{node.grant.audit_level}</span>
            </div>
          </div>
        </div>
      )}

      {/* 关联角色组摘要 */}
      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
          关联角色组 ({node.roleGroups.length})
        </div>
        {node.roleGroups.length === 0 ? (
          <div className="text-[9px] text-gray-400 text-center py-2">暂无角色组关联此 Skill</div>
        ) : (
          <div className="space-y-1">
            {node.roleGroups.map((rg) => {
              const memberCount = (rg.user_ids?.length || 0) + (rg.department_ids?.length || 0);
              const typeInfo = GROUP_TYPE_LABELS[rg.group_type] || GROUP_TYPE_LABELS.human_role;
              return (
                <div key={rg.id} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 text-[9px]">
                  <span className="font-bold flex-1">{rg.name}</span>
                  <PixelBadge color={typeInfo.color}>{typeInfo.label}</PixelBadge>
                  <span className="text-[8px] text-gray-400">{memberCount} 成员</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// 右栏子面板：角色组详情（成员管理 + 权限配置 + 权限预览）
// ═══════════════════════════════════════════════════════════════════════════════

function RoleGroupDetailPanel({
  roleGroup,
  policy,
  detail,
  onRefresh,
  canManageRoleGroups,
}: {
  roleGroup: TableRoleGroup;
  policy: TablePermissionPolicy | null;
  detail: TableDetail;
  onRefresh: () => void;
  canManageRoleGroups: boolean;
}) {
  const typeInfo = GROUP_TYPE_LABELS[roleGroup.group_type] || GROUP_TYPE_LABELS.human_role;

  // 权限策略编辑状态
  const [policyDraft, setPolicyDraft] = useState({
    row_access_mode: policy?.row_access_mode || "none",
    field_access_mode: policy?.field_access_mode || "all",
    disclosure_level: (policy?.disclosure_level || "L0") as DisclosureLevel,
    tool_permission_mode: policy?.tool_permission_mode || "deny",
    export_permission: policy?.export_permission || false,
  });
  const [policyDirty, setPolicyDirty] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);

  function updatePolicyDraft(patch: Partial<typeof policyDraft>) {
    setPolicyDraft((prev) => ({ ...prev, ...patch }));
    setPolicyDirty(true);
  }

  async function handleSavePolicy() {
    if (!canManageRoleGroups) {
      alert(detail.publish_status === "published" ? "已发布数据表的权限策略需由管理员维护" : "只有草稿表创建者可维护权限策略");
      return;
    }
    setPolicySaving(true);
    try {
      await apiFetch(`/data-assets/tables/${detail.id}/permission-policies`, {
        method: "PUT",
        body: JSON.stringify({
          policies: [{
            role_group_id: roleGroup.id,
            ...policyDraft,
          }],
        }),
      });
      setPolicyDirty(false);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPolicySaving(false);
    }
  }

  async function handleDeleteRoleGroup() {
    if (!canManageRoleGroups) {
      alert(detail.publish_status === "published" ? "已发布数据表的角色组需由管理员维护" : "只有草稿表创建者可删除角色组");
      return;
    }
    if (!confirm(`确认删除角色组「${roleGroup.name}」？关联的权限策略将一并删除。`)) return;
    try {
      await apiFetch(`/data-assets/role-groups/${roleGroup.id}`, { method: "DELETE" });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">{roleGroup.name}</span>
          <PixelBadge color={typeInfo.color}>{typeInfo.label}</PixelBadge>
          {roleGroup.is_system && <PixelBadge color="gray">系统</PixelBadge>}
        </div>
        {!roleGroup.is_system && canManageRoleGroups && (
          <button
            onClick={handleDeleteRoleGroup}
            className="text-[8px] text-gray-400 hover:text-red-500"
          >
            删除角色组
          </button>
        )}
      </div>

      {/* 成员管理 */}
      <div className="border-2 border-[#1A202C] p-3">
        <MemberEditor roleGroup={roleGroup} onSaved={onRefresh} readOnly={!canManageRoleGroups} />
      </div>

      {/* 权限配置（内联表单） */}
      <div className="border-2 border-[#1A202C] p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">权限配置</span>
          {policyDirty && canManageRoleGroups && (
            <PixelButton size="sm" onClick={handleSavePolicy} disabled={policySaving}>
              {policySaving ? "保存中..." : "保存策略"}
            </PixelButton>
          )}
        </div>

        {!canManageRoleGroups && (
          <div className="mb-3 text-[8px] text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1.5">
            {detail.publish_status === "published" ? "已发布数据表的权限策略需由管理员维护。" : "只有草稿表创建者可维护角色组和权限策略。"}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-1">行权限</label>
            <select
              value={policyDraft.row_access_mode}
              onChange={(e) => updatePolicyDraft({ row_access_mode: e.target.value as RowAccessMode })}
              disabled={!canManageRoleGroups}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-1 bg-white"
            >
              {Object.entries(ROW_ACCESS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-1">字段权限</label>
            <select
              value={policyDraft.field_access_mode}
              onChange={(e) => updatePolicyDraft({ field_access_mode: e.target.value as FieldAccessMode })}
              disabled={!canManageRoleGroups}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-1 bg-white"
            >
              {Object.entries(FIELD_ACCESS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-1">披露级别</label>
            <select
              value={policyDraft.disclosure_level}
              onChange={(e) => updatePolicyDraft({ disclosure_level: e.target.value as DisclosureLevel })}
              disabled={!canManageRoleGroups}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-1 bg-white"
            >
              {Object.entries(DISCLOSURE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Tool 权限</label>
            <select
              value={policyDraft.tool_permission_mode}
              onChange={(e) => updatePolicyDraft({ tool_permission_mode: e.target.value })}
              disabled={!canManageRoleGroups}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-1 bg-white"
            >
              {Object.entries(TOOL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={policyDraft.export_permission}
              onChange={(e) => updatePolicyDraft({ export_permission: e.target.checked })}
              disabled={!canManageRoleGroups}
              className="w-3 h-3"
            />
            <label className="text-[9px] font-bold">允许导出</label>
          </div>
        </div>
      </div>

      {/* 权限预览 */}
      <PermissionPreview detail={detail} />
    </div>
  );
}
