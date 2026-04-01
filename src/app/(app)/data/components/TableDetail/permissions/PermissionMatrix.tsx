"use client";

import React, { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { TableRoleGroup, TablePermissionPolicy, TableViewDetail, DisclosureLevel } from "../../shared/types";
import { DISCLOSURE_LABELS } from "../../shared/types";

const ROW_ACCESS_LABELS: Record<string, string> = {
  none: "禁止",
  all: "全部",
  owner: "仅归属人",
  department: "仅本部门",
  rule: "规则",
};

const FIELD_ACCESS_LABELS: Record<string, string> = {
  all: "全部字段",
  allowlist: "白名单",
  blocklist: "黑名单",
};

const TOOL_LABELS: Record<string, string> = {
  deny: "禁止",
  readonly: "只读",
  readwrite: "读写",
};

const DISCLOSURE_ORDER: Record<string, number> = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 };

interface Props {
  tableId: number;
  roleGroups: TableRoleGroup[];
  policies: TablePermissionPolicy[];
  views?: TableViewDetail[];
  onRefresh: () => void;
}

interface PolicyDraft {
  role_group_id: number;
  row_access_mode: string;
  field_access_mode: string;
  disclosure_level: DisclosureLevel;
  tool_permission_mode: string;
  export_permission: boolean;
}

export default function PermissionMatrix({ tableId, roleGroups, policies, views, onRefresh }: Props) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null);

  // 当前视图的 disclosure_ceiling（用于限制下拉选项）
  const selectedView = views?.find((v) => v.id === selectedViewId);
  const disclosureCeiling = selectedView?.disclosure_ceiling || null;

  // 过滤出当前作用域（表级或视图级）的策略
  const scopedPolicies = policies.filter((p) =>
    selectedViewId ? p.view_id === selectedViewId : !p.view_id
  );

  // Build drafts from existing policies, one per role group
  const [drafts, setDrafts] = useState<Map<number, PolicyDraft>>(() => buildDrafts(roleGroups, scopedPolicies));

  function buildDrafts(rgs: TableRoleGroup[], pols: TablePermissionPolicy[]): Map<number, PolicyDraft> {
    const m = new Map<number, PolicyDraft>();
    for (const rg of rgs) {
      const existing = pols.find((p) => p.role_group_id === rg.id);
      m.set(rg.id, {
        role_group_id: rg.id,
        row_access_mode: existing?.row_access_mode || "none",
        field_access_mode: existing?.field_access_mode || "all",
        disclosure_level: existing?.disclosure_level || "L0",
        tool_permission_mode: existing?.tool_permission_mode || "deny",
        export_permission: existing?.export_permission || false,
      });
    }
    return m;
  }

  function handleViewChange(viewId: number | null) {
    setSelectedViewId(viewId);
    const scoped = policies.filter((p) =>
      viewId ? p.view_id === viewId : !p.view_id
    );
    setDrafts(buildDrafts(roleGroups, scoped));
    setDirty(false);
  }

  function updateDraft(rgId: number, patch: Partial<PolicyDraft>) {
    setDrafts((prev) => {
      const next = new Map(prev);
      const current = next.get(rgId)!;
      next.set(rgId, { ...current, ...patch });
      return next;
    });
    setDirty(true);
  }

  // 获取可用的 disclosure 选项（受 ceiling 限制）
  function getAvailableDisclosureLevels(): [string, string][] {
    return Object.entries(DISCLOSURE_LABELS).filter(([k]) => {
      if (!disclosureCeiling) return true;
      return DISCLOSURE_ORDER[k] <= DISCLOSURE_ORDER[disclosureCeiling];
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const policyItems = Array.from(drafts.values()).map((d) => ({
        role_group_id: d.role_group_id,
        row_access_mode: d.row_access_mode,
        field_access_mode: d.field_access_mode,
        disclosure_level: d.disclosure_level,
        tool_permission_mode: d.tool_permission_mode,
        export_permission: d.export_permission,
      }));

      if (selectedViewId) {
        // 视图级策略
        await apiFetch(`/data-assets/views/${selectedViewId}/permission-policies`, {
          method: "PUT",
          body: JSON.stringify({ policies: policyItems }),
        });
      } else {
        // 表级策略
        await apiFetch(`/data-assets/tables/${tableId}/permission-policies`, {
          method: "PUT",
          body: JSON.stringify({ policies: policyItems }),
        });
      }
      setDirty(false);
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (roleGroups.length === 0) {
    return (
      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">权限矩阵</div>
        <div className="text-[9px] text-gray-400 py-4 text-center">请先创建角色组</div>
      </div>
    );
  }

  const availableDisclosure = getAvailableDisclosureLevels();

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">权限矩阵</span>
          {views && views.length > 0 && (
            <select
              value={selectedViewId ?? ""}
              onChange={(e) => handleViewChange(e.target.value ? Number(e.target.value) : null)}
              className="text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
            >
              <option value="">表级策略</option>
              {views.map((v) => (
                <option key={v.id} value={v.id}>{v.name}{v.disclosure_ceiling ? ` (上限 ${v.disclosure_ceiling})` : ""}</option>
              ))}
            </select>
          )}
        </div>
        {dirty && (
          <PixelButton size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存策略"}
          </PixelButton>
        )}
      </div>

      {disclosureCeiling && (
        <div className="text-[8px] text-orange-500 bg-orange-50 px-2 py-1 mb-2 border border-orange-200">
          此视图的披露上限为 {DISCLOSURE_LABELS[disclosureCeiling]}，策略不能超过此级别
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[9px]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              <th className="text-left px-2 py-1.5 font-bold uppercase tracking-widest text-gray-400 border-b-2 border-[#1A202C]">角色组</th>
              <th className="text-left px-2 py-1.5 font-bold uppercase tracking-widest text-gray-400 border-b-2 border-[#1A202C]">行权限</th>
              <th className="text-left px-2 py-1.5 font-bold uppercase tracking-widest text-gray-400 border-b-2 border-[#1A202C]">字段权限</th>
              <th className="text-left px-2 py-1.5 font-bold uppercase tracking-widest text-gray-400 border-b-2 border-[#1A202C]">披露级别</th>
              <th className="text-left px-2 py-1.5 font-bold uppercase tracking-widest text-gray-400 border-b-2 border-[#1A202C]">Tool</th>
              <th className="text-left px-2 py-1.5 font-bold uppercase tracking-widest text-gray-400 border-b-2 border-[#1A202C]">导出</th>
            </tr>
          </thead>
          <tbody>
            {roleGroups.map((rg) => {
              const draft = drafts.get(rg.id)!;
              return (
                <tr key={rg.id} className="border-b border-gray-100 hover:bg-[#F0FBFF]">
                  <td className="px-2 py-2 font-bold">{rg.name}</td>
                  <td className="px-2 py-2">
                    <select
                      value={draft.row_access_mode}
                      onChange={(e) => updateDraft(rg.id, { row_access_mode: e.target.value })}
                      className="text-[9px] border border-gray-300 px-1 py-0.5 bg-white w-full"
                    >
                      {Object.entries(ROW_ACCESS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={draft.field_access_mode}
                      onChange={(e) => updateDraft(rg.id, { field_access_mode: e.target.value })}
                      className="text-[9px] border border-gray-300 px-1 py-0.5 bg-white w-full"
                    >
                      {Object.entries(FIELD_ACCESS_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={draft.disclosure_level}
                      onChange={(e) => updateDraft(rg.id, { disclosure_level: e.target.value as DisclosureLevel })}
                      className="text-[9px] border border-gray-300 px-1 py-0.5 bg-white w-full"
                    >
                      {availableDisclosure.map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={draft.tool_permission_mode}
                      onChange={(e) => updateDraft(rg.id, { tool_permission_mode: e.target.value })}
                      className="text-[9px] border border-gray-300 px-1 py-0.5 bg-white w-full"
                    >
                      {Object.entries(TOOL_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={draft.export_permission}
                      onChange={(e) => updateDraft(rg.id, { export_permission: e.target.checked })}
                      className="w-3 h-3"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[8px] text-gray-400">
        {selectedViewId ? "编辑此视图的独立策略" : "表级策略，适用于未配置视图级策略的访问"}
        {" · "}未配置策略时默认拒绝 · 披露级别 L3/L4 可开放引用
      </div>
    </div>
  );
}
