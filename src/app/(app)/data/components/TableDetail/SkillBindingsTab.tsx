"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type {
  Department,
  DisclosureLevel,
  SkillBindingDetail,
  SkillDataGrant,
  TableCapabilities,
  TableDetail,
  TablePermissionPolicy,
  TableRoleGroup,
} from "../shared/types";
import { DISCLOSURE_LABELS } from "../shared/types";

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
  capabilities?: TableCapabilities;
}

interface SkillUsageProjection {
  skillId: number;
  skillName: string;
  binding: SkillBindingDetail | null;
  grant: SkillDataGrant | null;
  roleGroups: TableRoleGroup[];
  policy: TablePermissionPolicy | null;
}

const ROW_SCOPE_LABELS: Record<string, string> = {
  none: "不可见",
  all: "全部数据行",
  owner: "仅负责人",
  department: "仅本部门",
  rule: "按规则过滤",
};

const ACTION_LABELS: Record<string, string> = {
  read: "读取",
  export: "导出",
  quote: "引用",
  write: "写入",
};

function summarizeFieldScope(detail: TableDetail, projection: SkillUsageProjection): string {
  const view = projection.binding?.view_id
    ? detail.views.find((item) => item.id === projection.binding?.view_id)
    : null;

  if (view?.visible_field_ids?.length) {
    const names = detail.fields
      .filter((field) => field.id !== null && view.visible_field_ids.includes(field.id))
      .map((field) => field.display_name || field.field_name);
    return names.length > 4 ? `${names.slice(0, 4).join("、")} 等 ${names.length} 个字段` : names.join("、");
  }

  if (projection.policy?.field_access_mode === "allowlist" && projection.policy.allowed_field_ids.length > 0) {
    const names = detail.fields
      .filter((field) => field.id !== null && projection.policy?.allowed_field_ids.includes(field.id))
      .map((field) => field.display_name || field.field_name);
    return names.length > 4 ? `${names.slice(0, 4).join("、")} 等 ${names.length} 个字段` : names.join("、");
  }

  if (projection.policy?.field_access_mode === "blocklist" && projection.policy.blocked_field_ids.length > 0) {
    const names = detail.fields
      .filter((field) => field.id !== null && projection.policy?.blocked_field_ids.includes(field.id))
      .map((field) => field.display_name || field.field_name);
    return `整表字段，排除 ${names.join("、") || "部分敏感字段"}`;
  }

  if (projection.grant?.field_rule_override_json && Object.keys(projection.grant.field_rule_override_json).length > 0) {
    return "字段范围由 SkillStudio 覆盖规则控制";
  }

  return "整表字段";
}

function summarizeRowScope(detail: TableDetail, projection: SkillUsageProjection): string {
  const view = projection.binding?.view_id
    ? detail.views.find((item) => item.id === projection.binding?.view_id)
    : null;
  const parts: string[] = [];

  if (projection.policy?.row_access_mode) {
    parts.push(ROW_SCOPE_LABELS[projection.policy.row_access_mode] || projection.policy.row_access_mode);
  }
  if (view?.config.filters?.length) {
    parts.push(`${view.config.filters.length} 条视图筛选`);
  }
  if (projection.grant?.row_rule_override_json && Object.keys(projection.grant.row_rule_override_json).length > 0) {
    parts.push("SkillStudio 行规则覆盖");
  }

  return parts.join(" · ") || "未单独限定";
}

function summarizeMasking(projection: SkillUsageProjection): string {
  const maskingKeys = projection.policy?.masking_rule_json ? Object.keys(projection.policy.masking_rule_json) : [];
  const disclosure = projection.grant?.max_disclosure_level || projection.policy?.disclosure_level;
  const disclosureText = disclosure ? DISCLOSURE_LABELS[disclosure as DisclosureLevel] || disclosure : "未声明";

  if (maskingKeys.length > 0) {
    return `${disclosureText} · ${maskingKeys.join("、")} 脱敏`;
  }
  if (projection.grant?.approval_required) {
    return `${disclosureText} · 需经 SkillStudio 审批`;
  }
  return `${disclosureText} · 运行时策略以 SkillStudio 为准`;
}

function summarizePermissions(projection: SkillUsageProjection): string {
  const actions = (projection.grant?.allowed_actions || []).map((action) => ACTION_LABELS[action] || action);
  const mode = projection.grant?.grant_mode === "deny" ? "拒绝" : "允许";

  if (actions.length > 0) {
    return `${mode} ${actions.join("、")}`;
  }
  return projection.grant ? `${mode} 访问` : "未回传具体操作";
}

function summarizeDepartments(
  detail: TableDetail,
  projection: SkillUsageProjection,
  departmentMap: Map<number, string>,
): string {
  const names = new Set<string>();

  if (detail.department_id) {
    const tableDepartment = departmentMap.get(detail.department_id);
    if (tableDepartment) names.add(tableDepartment);
  }

  for (const roleGroup of projection.roleGroups) {
    for (const departmentId of roleGroup.department_ids || []) {
      const departmentName = departmentMap.get(departmentId);
      if (departmentName) names.add(departmentName);
    }
  }

  return Array.from(names).join("、") || "未标注部门";
}

function ProjectionCard({
  detail,
  projection,
  departmentMap,
}: {
  detail: TableDetail;
  projection: SkillUsageProjection;
  departmentMap: Map<number, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const viewName = projection.binding?.view_name || projection.grant?.view_name || "未绑定视图";
  const roleNames = projection.roleGroups.map((group) => group.name);
  const departmentText = summarizeDepartments(detail, projection, departmentMap);
  const permissionSummary = summarizePermissions(projection);
  const fieldScopeSummary = summarizeFieldScope(detail, projection);
  const rowScopeSummary = summarizeRowScope(detail, projection);
  const maskingSummary = summarizeMasking(projection);
  const updatedAt = projection.grant?.updated_at || projection.grant?.created_at || null;

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="px-4 py-3 hover:bg-[#F0FBFF] transition-colors">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold">{projection.skillName}</span>
              {projection.binding?.status === "legacy_unbound" ? (
                <PixelBadge color="yellow">待补视图</PixelBadge>
              ) : (
                <PixelBadge color="green">已挂载</PixelBadge>
              )}
              {projection.grant?.approval_required && <PixelBadge color="yellow">需审批</PixelBadge>}
              {projection.grant?.max_disclosure_level && (
                <span className="text-[7px] font-bold px-1 py-px rounded bg-gray-100 text-gray-500">
                  {projection.grant.max_disclosure_level}
                </span>
              )}
            </div>
            <div className="text-[8px] text-gray-400 mt-0.5">
              视图：{viewName} · 部门：{departmentText}
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-[8px] text-gray-600">
              <div><span className="text-gray-400">字段范围：</span>{fieldScopeSummary}</div>
              <div><span className="text-gray-400">数据行范围：</span>{rowScopeSummary}</div>
              <div><span className="text-gray-400">角色 / 角色组：</span>{roleNames.join("、") || "未回传"}</div>
              <div><span className="text-gray-400">权限设置：</span>{permissionSummary}</div>
              <div><span className="text-gray-400">脱敏 / 摘要：</span>{maskingSummary}</div>
              <div><span className="text-gray-400">最后更新时间：</span>{updatedAt ? new Date(updatedAt).toLocaleString("zh-CN") : "未回传"}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setExpanded((value) => !value)}
              className="text-[8px] text-[#00A3C4] hover:underline"
            >
              {expanded ? "收起详情" : "展开详情"}
            </button>
            <Link
              href={`/skill-studio?skill_id=${projection.skillId}`}
              className="text-[8px] text-[#00CC99] hover:text-[#00A87A] font-bold"
            >
              去 SkillStudio
            </Link>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mx-4 mb-3 border border-[#00D1FF] bg-[#F8FBFD] p-3 text-[8px] text-gray-600">
          <div className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">只读投影</div>
          <div className="space-y-1">
            <div>Skill：{projection.skillName}</div>
            <div>视图：{viewName}</div>
            <div>角色组：{roleNames.join("、") || "未回传"}</div>
            <div>授权模式：{projection.grant?.grant_mode || "未回传"}</div>
            <div>允许操作：{(projection.grant?.allowed_actions || []).join("、") || "未回传"}</div>
            <div>审计级别：{projection.grant?.audit_level || "未回传"}</div>
            <div>提示：这里只做展示，具体角色、权限、脱敏修改统一去 SkillStudio。</div>
          </div>
        </div>
      )}
    </div>
  );
}

function buildProjections(detail: TableDetail): SkillUsageProjection[] {
  const skillIds = new Set<number>([
    ...detail.bindings.map((binding) => binding.skill_id),
    ...detail.skill_grants.map((grant) => grant.skill_id),
  ]);

  return Array.from(skillIds)
    .map((skillId) => {
      const binding = detail.bindings.find((item) => item.skill_id === skillId) || null;
      const grant = detail.skill_grants.find((item) => item.skill_id === skillId) || null;
      const roleGroups = detail.role_groups.filter((group) => group.skill_ids.includes(skillId) || (grant?.role_group_id ? group.id === grant.role_group_id : false));
      const policy = grant?.role_group_id
        ? detail.permission_policies.find((item) => item.role_group_id === grant.role_group_id && (item.view_id === grant.view_id || item.view_id === null)) || null
        : null;

      return {
        skillId,
        skillName: binding?.skill_name || grant?.skill_name || `Skill #${skillId}`,
        binding,
        grant,
        roleGroups,
        policy,
      };
    })
    .sort((left, right) => {
      if (left.binding?.status === "legacy_unbound" && right.binding?.status !== "legacy_unbound") return 1;
      if (left.binding?.status !== "legacy_unbound" && right.binding?.status === "legacy_unbound") return -1;
      return left.skillName.localeCompare(right.skillName, "zh-CN");
    });
}

function BindingRelationSummary({ projections }: { projections: SkillUsageProjection[] }) {
  return (
    <div className="px-4 py-2 border-b border-gray-100 bg-[#F8FBFD]">
      <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">使用概览</div>
      <div className="flex flex-wrap gap-2">
        {projections.map((projection) => (
          <div key={projection.skillId} className="flex items-center gap-2 text-[8px] px-2 py-1 border border-gray-200 bg-white rounded">
            <span className="font-bold text-[#1A202C]">{projection.skillName}</span>
            <span className="text-gray-300">→</span>
            <span className="text-[#00A3C4]">{projection.binding?.view_name || projection.grant?.view_name || "未绑定视图"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SkillBindingsTab({ detail }: Props) {
  const projections = useMemo(() => buildProjections(detail), [detail]);
  const [departmentMap, setDepartmentMap] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function loadDepartments() {
      const candidates = ["/org-management/departments", "/admin/departments"];

      for (const path of candidates) {
        try {
          const data = await apiFetch<Department[] | { items: Department[] }>(path);
          const departments = Array.isArray(data) ? data : data.items;
          if (!Array.isArray(departments)) continue;

          if (!cancelled) {
            setDepartmentMap(new Map(departments.map((department) => [department.id, department.name])));
          }
          return;
        } catch {
        }
      }
    }

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, []);

  if (projections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <div className="text-[10px] text-gray-400 uppercase tracking-widest">暂无关联 Skill</div>
        <div className="text-[8px] text-gray-300">在 SkillStudio 挂载数据表后，这里会展示该 Skill 对本表的角色、权限和脱敏投影。</div>
      </div>
    );
  }

  return (
    <div>
      <BindingRelationSummary projections={projections} />
      <div className="px-4 py-2 text-[8px] text-gray-500 bg-[#FFFBEA] border-b border-yellow-200">
        这里是只读投影页：展示 Skill 如何使用这张表；具体权限、脱敏和审批配置统一在 SkillStudio 维护。
      </div>
      {projections.map((projection) => (
        <ProjectionCard key={projection.skillId} detail={detail} projection={projection} departmentMap={departmentMap} />
      ))}
    </div>
  );
}
