"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { TableDetail, Department, UserRow, ProjectGroup } from "../shared/types";
import { AccessScopeSelector, ScopeSelector } from "../shared";
import type { AccessScope, ScopeValue } from "../shared/types";

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
}

export default function PermissionsTab({ detail, onRefresh }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectGroup[]>([]);

  useEffect(() => {
    apiFetch<Department[]>("/admin/departments").then((d) => setDepartments(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch<UserRow[]>("/admin/users").then(setAllUsers).catch(() => {});
    apiFetch<ProjectGroup[]>("/admin/projects").then(setAllProjects).catch(() => {});
  }, []);

  const ap = detail.access_policy;

  async function handleScopeChange(patch: Record<string, unknown>) {
    await apiFetch(`/business-tables/${detail.id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    onRefresh();
  }

  if (detail.field_profile_status === "pending" && detail.fields.length === 0) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 text-[9px] text-yellow-700 font-bold mb-4">
          <span>⚠</span>
          <span>字段画像待分析，权限配置可能受限。同步完成后将自动分析字段信息。</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">数据表访问权限</div>
        <AccessScopeSelector
          label="谁可以访问这张表"
          accessScope={(ap.access_scope as AccessScope) ?? "self"}
          userIds={ap.access_user_ids}
          roleIds={ap.access_role_ids}
          deptIds={ap.access_department_ids}
          projectIds={ap.access_project_ids}
          departments={departments}
          users={allUsers}
          projects={allProjects}
          onChange={(patch) => handleScopeChange(patch)}
        />
        <div className="text-[8px] text-gray-400 mt-2">超管始终可见</div>
      </div>

      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">列/行可见范围（细粒度）</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          <ScopeSelector
            label="列数据可见范围"
            scope={(ap.column_scope as ScopeValue) ?? "private"}
            deptIds={ap.column_department_ids}
            departments={departments}
            onChange={(s, ids) => handleScopeChange({ column_scope: s, column_department_ids: ids })}
          />
          <ScopeSelector
            label="行数据可见范围"
            scope={(ap.row_scope as ScopeValue) ?? "private"}
            deptIds={ap.row_department_ids}
            departments={departments}
            onChange={(s, ids) => handleScopeChange({ row_scope: s, row_department_ids: ids })}
          />
        </div>
      </div>

      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">隐藏字段</div>
        {ap.hidden_fields.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {ap.hidden_fields.map((f) => (
              <span key={f} className="text-[9px] font-bold px-2 py-0.5 border border-gray-200 bg-gray-50 text-gray-400">{f}</span>
            ))}
          </div>
        ) : (
          <span className="text-[9px] text-gray-400">无隐藏字段</span>
        )}
      </div>
    </div>
  );
}
