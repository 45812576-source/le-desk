"use client";

import React, { useState, useMemo } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { TableDetail, DisclosureLevel } from "../../shared/types";
import { DISCLOSURE_LABELS } from "../../shared/types";

interface ExplainResult {
  denied: boolean;
  deny_reasons: string[];
  matched_role_groups: { id: number; name: string; group_type: string }[];
  effective_policy: {
    row_access_mode: string;
    disclosure_level: string;
    field_access_mode: string;
    masking_rules: Record<string, unknown>;
    export_permission: boolean;
    tool_permission_mode: string;
    source: string;
  };
  disclosure_capabilities: Record<string, boolean>;
  visible_fields: { id: number; field_name: string; display_name: string }[];
  effective_grant: Record<string, unknown> | null;
}

interface Props {
  detail: TableDetail;
}

export default function PermissionPreview({ detail }: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    detail.role_groups.length > 0 ? detail.role_groups[0].id : null
  );
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null);

  // 后端 explain 结果
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  const preview = useMemo(() => {
    if (!selectedGroupId) return null;
    const group = detail.role_groups.find((rg) => rg.id === selectedGroupId);
    if (!group) return null;

    const viewPolicy = selectedViewId
      ? detail.permission_policies.find((p) => p.role_group_id === selectedGroupId && p.view_id === selectedViewId)
      : null;
    const tablePolicy = detail.permission_policies.find(
      (p) => p.role_group_id === selectedGroupId && !p.view_id
    );
    const policy = viewPolicy || tablePolicy;

    if (!policy) {
      return {
        group,
        hasPolicy: false,
        visibleFields: [] as string[],
        maskedFields: [] as string[],
        rowAccess: "禁止（无策略）",
        disclosureLevel: "L0" as DisclosureLevel,
        canExport: false,
        canUseTools: false,
      };
    }

    let visibleFields: string[] = [];
    let maskedFields: string[] = [];

    if (policy.field_access_mode === "all") {
      visibleFields = detail.fields.map((f) => f.display_name || f.field_name);
    } else if (policy.field_access_mode === "allowlist") {
      visibleFields = detail.fields
        .filter((f) => f.id && policy.allowed_field_ids.includes(f.id))
        .map((f) => f.display_name || f.field_name);
    } else if (policy.field_access_mode === "blocklist") {
      visibleFields = detail.fields
        .filter((f) => !f.id || !policy.blocked_field_ids.includes(f.id))
        .map((f) => f.display_name || f.field_name);
    }

    const sensitiveFields = detail.fields.filter((f) => f.is_sensitive);
    if (policy.masking_rule_json && Object.keys(policy.masking_rule_json).length > 0) {
      maskedFields = sensitiveFields.map((f) => f.display_name || f.field_name);
    }

    const rowLabels: Record<string, string> = {
      none: "禁止",
      all: "全部行",
      owner: "仅归属人的行",
      department: "仅本部门的行",
      rule: "自定义规则",
    };

    return {
      group,
      hasPolicy: true,
      visibleFields,
      maskedFields,
      rowAccess: rowLabels[policy.row_access_mode] || policy.row_access_mode,
      disclosureLevel: policy.disclosure_level,
      canExport: policy.export_permission,
      canUseTools: policy.tool_permission_mode !== "deny",
    };
  }, [selectedGroupId, selectedViewId, detail]);

  async function handleExplain() {
    setExplainLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedViewId) params.set("view_id", String(selectedViewId));
      const result = await apiFetch<ExplainResult>(
        `/data-assets/tables/${detail.id}/permission-explain?${params.toString()}`
      );
      setExplainResult(result);
      setShowExplain(true);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "查询失败");
    } finally {
      setExplainLoading(false);
    }
  }

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">生效预览</span>
        <PixelButton size="sm" onClick={handleExplain} disabled={explainLoading}>
          {explainLoading ? "查询中..." : "查看后端生效结果"}
        </PixelButton>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-1">角色组</label>
          <select
            value={selectedGroupId ?? ""}
            onChange={(e) => { setSelectedGroupId(e.target.value ? Number(e.target.value) : null); setShowExplain(false); }}
            className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
          >
            <option value="">选择角色组</option>
            {detail.role_groups.map((rg) => (
              <option key={rg.id} value={rg.id}>{rg.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-1">视图（可选）</label>
          <select
            value={selectedViewId ?? ""}
            onChange={(e) => { setSelectedViewId(e.target.value ? Number(e.target.value) : null); setShowExplain(false); }}
            className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
          >
            <option value="">表级（不限视图）</option>
            {detail.views.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 后端 explain 结果 */}
      {showExplain && explainResult && (
        <div className={`mb-3 px-3 py-2 border text-[9px] ${
          explainResult.denied
            ? "bg-red-50 border-red-200"
            : "bg-green-50 border-green-200"
        }`}>
          <div className="font-bold mb-1">
            {explainResult.denied ? "后端判定: 拒绝" : "后端判定: 允许"}
            <span className="text-[8px] text-gray-400 font-normal ml-2">
              来源: {explainResult.effective_policy.source}
            </span>
          </div>

          {explainResult.denied && explainResult.deny_reasons.length > 0 && (
            <div className="bg-red-100 px-2 py-1 mt-1 text-red-700">
              <div className="font-bold text-[8px] uppercase mb-0.5">拒绝原因</div>
              <ul className="list-disc list-inside text-[8px]">
                {explainResult.deny_reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {!explainResult.denied && (
            <>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <span className="text-[7px] text-gray-400 uppercase block">行权限</span>
                  <span className="font-bold">{explainResult.effective_policy.row_access_mode}</span>
                </div>
                <div>
                  <span className="text-[7px] text-gray-400 uppercase block">披露</span>
                  <span className="font-bold">{DISCLOSURE_LABELS[explainResult.effective_policy.disclosure_level as DisclosureLevel] || explainResult.effective_policy.disclosure_level}</span>
                </div>
                <div>
                  <span className="text-[7px] text-gray-400 uppercase block">可见字段</span>
                  <span className="font-bold">{explainResult.visible_fields.length} 个</span>
                </div>
              </div>
              <div className="mt-1">
                <span className="text-[7px] text-gray-400 uppercase">匹配角色组: </span>
                {explainResult.matched_role_groups.map((rg) => (
                  <span key={rg.id} className="text-[8px] px-1 py-px bg-white border border-gray-200 rounded mr-1">{rg.name}</span>
                ))}
              </div>
            </>
          )}

          {explainResult.denied && (
            <div className="mt-2 text-[8px] text-gray-500 bg-white px-2 py-1 border border-gray-200">
              请联系管理员配置对应的角色组和权限策略
            </div>
          )}
        </div>
      )}

      {/* 前端预览 */}
      {!preview ? (
        <div className="text-[9px] text-gray-400 py-4 text-center">请选择角色组查看生效权限</div>
      ) : !preview.hasPolicy ? (
        <div className="bg-red-50 border border-red-200 px-3 py-2 text-[9px] text-red-600 font-bold">
          该角色组无任何策略配置 — 默认拒绝所有访问
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">行权限</span>
              <span className="text-[10px] font-bold">{preview.rowAccess}</span>
            </div>
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">披露级别</span>
              <span className="text-[10px] font-bold">{DISCLOSURE_LABELS[preview.disclosureLevel]}</span>
            </div>
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">导出</span>
              <span className={`text-[10px] font-bold ${preview.canExport ? "text-green-500" : "text-red-400"}`}>
                {preview.canExport ? "允许" : "禁止"}
              </span>
            </div>
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block">Tool 调用</span>
              <span className={`text-[10px] font-bold ${preview.canUseTools ? "text-green-500" : "text-red-400"}`}>
                {preview.canUseTools ? "允许" : "禁止"}
              </span>
            </div>
          </div>

          <div>
            <span className="text-[8px] text-gray-400 font-bold uppercase block mb-1">可见字段 ({preview.visibleFields.length})</span>
            <div className="flex flex-wrap gap-1">
              {preview.visibleFields.slice(0, 20).map((f) => (
                <span key={f} className="text-[8px] px-1.5 py-px bg-gray-50 border border-gray-200 rounded">{f}</span>
              ))}
              {preview.visibleFields.length > 20 && (
                <span className="text-[8px] text-gray-400">+{preview.visibleFields.length - 20}</span>
              )}
            </div>
          </div>

          {preview.maskedFields.length > 0 && (
            <div>
              <span className="text-[8px] text-gray-400 font-bold uppercase block mb-1">脱敏字段 ({preview.maskedFields.length})</span>
              <div className="flex flex-wrap gap-1">
                {preview.maskedFields.map((f) => (
                  <span key={f} className="text-[8px] px-1.5 py-px bg-red-50 border border-red-200 text-red-500 rounded">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
