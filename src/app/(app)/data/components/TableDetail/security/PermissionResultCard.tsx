"use client";

import React from "react";
import type { TableDetail, TablePermissionPolicy, TableRoleGroup, DisclosureLevel } from "../../shared/types";
import { DISCLOSURE_LABELS } from "../../shared/types";

interface Props {
  group: TableRoleGroup;
  policy: TablePermissionPolicy | null;
  detail: TableDetail;
}

export default function PermissionResultCard({ group, policy, detail }: Props) {
  if (!policy) {
    return (
      <div className="border-2 border-red-200 bg-red-50 p-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold">{group.name}</span>
          <span className="text-[7px] font-bold px-1 py-px bg-red-100 text-red-500 rounded">{group.group_type === "skill_role" ? "Skill" : "人员"}</span>
        </div>
        <div className="text-[9px] text-red-600 font-bold">无策略 — 默认拒绝所有访问</div>
      </div>
    );
  }

  // 计算可见字段
  let visibleFields: string[] = [];
  const allFields = detail.fields;
  if (policy.field_access_mode === "all") {
    visibleFields = allFields.map((f) => f.display_name || f.field_name);
  } else if (policy.field_access_mode === "allowlist") {
    visibleFields = allFields
      .filter((f) => f.id && policy.allowed_field_ids.includes(f.id))
      .map((f) => f.display_name || f.field_name);
  } else if (policy.field_access_mode === "blocklist") {
    visibleFields = allFields
      .filter((f) => !f.id || !policy.blocked_field_ids.includes(f.id))
      .map((f) => f.display_name || f.field_name);
  }

  // 脱敏字段
  const hasMasking = policy.masking_rule_json && Object.keys(policy.masking_rule_json).length > 0;
  const maskedFields = hasMasking
    ? allFields.filter((f) => f.is_sensitive).map((f) => f.display_name || f.field_name)
    : [];

  const rowLabels: Record<string, string> = {
    none: "不可访问任何行",
    all: "可访问全部行",
    owner: "仅可访问归属自己的行",
    department: "仅可访问本部门的行",
    rule: "按自定义规则过滤行",
  };

  const dlLevel = policy.disclosure_level as DisclosureLevel;

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-bold">{group.name}</span>
        <span className="text-[7px] font-bold px-1 py-px bg-gray-100 text-gray-500 rounded">
          {group.group_type === "skill_role" ? "Skill" : group.group_type === "mixed" ? "混合" : "人员"}
        </span>
        {policy.view_id && (
          <span className="text-[7px] font-bold px-1 py-px bg-blue-50 text-blue-500 rounded">
            视图级
          </span>
        )}
      </div>

      {/* 业务语言摘要 */}
      <div className="space-y-1.5 text-[9px]">
        <div className="flex items-start gap-2">
          <span className="text-gray-400 w-16 flex-shrink-0 font-bold">能看什么</span>
          <span>
            {visibleFields.length === allFields.length
              ? "全部字段"
              : `${visibleFields.length}/${allFields.length} 个字段`}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-gray-400 w-16 flex-shrink-0 font-bold">行范围</span>
          <span>{rowLabels[policy.row_access_mode] || policy.row_access_mode}</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-gray-400 w-16 flex-shrink-0 font-bold">被打码</span>
          <span>
            {maskedFields.length > 0 ? (
              <span className="text-orange-500">{maskedFields.length} 个敏感字段脱敏</span>
            ) : (
              <span className="text-gray-400">无脱敏</span>
            )}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-gray-400 w-16 flex-shrink-0 font-bold">披露级别</span>
          <span className={`font-bold ${dlLevel <= "L1" ? "text-green-500" : dlLevel <= "L2" ? "text-yellow-500" : "text-orange-500"}`}>
            {DISCLOSURE_LABELS[dlLevel] || policy.disclosure_level}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-gray-400 w-16 flex-shrink-0 font-bold">能否导出</span>
          <span className={policy.export_permission ? "text-green-500 font-bold" : "text-red-400"}>
            {policy.export_permission ? "允许导出" : "禁止导出"}
          </span>
        </div>
      </div>

      {/* 策略来源 */}
      <div className="mt-2 text-[7px] text-gray-400">
        策略 #{policy.id} · {policy.view_id ? `视图 #${policy.view_id}` : "表级"}
      </div>
    </div>
  );
}
