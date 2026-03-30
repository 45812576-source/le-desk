"use client";

import React, { useState } from "react";
import type { AccessScope, ScopeValue, Department, UserRow, ProjectGroup } from "./types";
import { ROLE_OPTIONS } from "./types";

export function AccessScopeSelector({
  label,
  accessScope,
  userIds,
  roleIds,
  deptIds,
  projectIds,
  departments,
  users,
  projects,
  onChange,
}: {
  label: string;
  accessScope: AccessScope;
  userIds: number[];
  roleIds: string[];
  deptIds: number[];
  projectIds: number[];
  departments: Department[];
  users: UserRow[];
  projects: ProjectGroup[];
  onChange: (patch: {
    access_scope: AccessScope;
    access_user_ids?: number[];
    access_role_ids?: string[];
    access_department_ids?: number[];
    access_project_ids?: number[];
  }) => void;
}) {
  const [userSearch, setUserSearch] = useState("");

  const SCOPE_OPTS: { value: AccessScope; label: string; desc: string }[] = [
    { value: "self", label: "仅自己", desc: "仅创建者和超管可见" },
    { value: "users", label: "指定人员", desc: "多选指定用户可见" },
    { value: "roles", label: "指定角色", desc: "指定岗位角色可见" },
    { value: "departments", label: "指定部门", desc: "仅选中部门成员可见" },
    { value: "projects", label: "指定项目组", desc: "指定项目组成员可见" },
    { value: "company", label: "全公司", desc: "所有人可见" },
  ];

  function toggleUser(id: number) {
    const next = userIds.includes(id) ? userIds.filter((u) => u !== id) : [...userIds, id];
    onChange({ access_scope: "users", access_user_ids: next });
  }

  function toggleRole(role: string) {
    const next = roleIds.includes(role) ? roleIds.filter((r) => r !== role) : [...roleIds, role];
    onChange({ access_scope: "roles", access_role_ids: next });
  }

  function toggleDept(id: number) {
    const next = deptIds.includes(id) ? deptIds.filter((d) => d !== id) : [...deptIds, id];
    onChange({ access_scope: "departments", access_department_ids: next });
  }

  function toggleProject(id: number) {
    const next = projectIds.includes(id) ? projectIds.filter((p) => p !== id) : [...projectIds, id];
    onChange({ access_scope: "projects", access_project_ids: next });
  }

  function handleScopeChange(s: AccessScope) {
    const patch: Parameters<typeof onChange>[0] = { access_scope: s };
    if (s === "users") patch.access_user_ids = userIds;
    else if (s === "roles") patch.access_role_ids = roleIds;
    else if (s === "departments") patch.access_department_ids = deptIds;
    else if (s === "projects") patch.access_project_ids = projectIds;
    onChange(patch);
  }

  const filteredUsers = userSearch
    ? users.filter((u) => u.display_name.includes(userSearch) || u.username.includes(userSearch))
    : users;

  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {SCOPE_OPTS.map((o) => (
          <button
            key={o.value}
            title={o.desc}
            onClick={() => handleScopeChange(o.value)}
            className={`px-2.5 py-1 border-2 text-[9px] font-bold uppercase tracking-wide transition-colors ${
              accessScope === o.value
                ? "border-[#1A202C] bg-[#1A202C] text-white"
                : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* 指定人员 */}
      {accessScope === "users" && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="搜索用户..."
            className="w-full border-2 border-gray-200 px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-[#00D1FF]"
          />
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => toggleUser(u.id)}
                className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                  userIds.includes(u.id)
                    ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                    : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
                }`}
              >
                {userIds.includes(u.id) ? "✓ " : ""}{u.display_name}
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <span className="text-[9px] text-gray-400">无匹配用户</span>
            )}
          </div>
          {userIds.length > 0 && (
            <div className="text-[8px] text-gray-400">已选 {userIds.length} 人</div>
          )}
        </div>
      )}

      {/* 指定角色 */}
      {accessScope === "roles" && (
        <div className="flex flex-wrap gap-1">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => toggleRole(r.value)}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                roleIds.includes(r.value)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {roleIds.includes(r.value) ? "✓ " : ""}{r.label}
            </button>
          ))}
        </div>
      )}

      {/* 指定部门 */}
      {accessScope === "departments" && departments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => toggleDept(d.id)}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                deptIds.includes(d.id)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {deptIds.includes(d.id) ? "✓ " : ""}{d.name}
            </button>
          ))}
        </div>
      )}

      {/* 指定项目组 */}
      {accessScope === "projects" && (
        <div className="flex flex-wrap gap-1">
          {projects.length > 0 ? projects.map((p) => (
            <button
              key={p.id}
              onClick={() => toggleProject(p.id)}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                projectIds.includes(p.id)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {projectIds.includes(p.id) ? "✓ " : ""}{p.name}
            </button>
          )) : (
            <span className="text-[9px] text-gray-400">暂无项目组</span>
          )}
        </div>
      )}
    </div>
  );
}

// Legacy wrapper for backward compatibility (column_scope / row_scope)
export function ScopeSelector({
  label,
  scope,
  deptIds,
  departments,
  onChange,
}: {
  label: string;
  scope: ScopeValue;
  deptIds: number[];
  departments: Department[];
  onChange: (scope: ScopeValue, deptIds: number[]) => void;
}) {
  const SCOPE_OPTS: { value: ScopeValue; label: string; desc: string }[] = [
    { value: "all", label: "全公司", desc: "所有人可见" },
    { value: "department", label: "指定部门", desc: "仅选中部门成员可见" },
    { value: "private", label: "仅管理员", desc: "普通用户不可见" },
  ];

  function toggleDept(id: number) {
    const next = deptIds.includes(id) ? deptIds.filter((d) => d !== id) : [...deptIds, id];
    onChange(scope, next);
  }

  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">{label}</div>
      <div className="flex gap-1.5 mb-2">
        {SCOPE_OPTS.map((o) => (
          <button
            key={o.value}
            title={o.desc}
            onClick={() => onChange(o.value, o.value === "department" ? deptIds : [])}
            className={`px-2.5 py-1 border-2 text-[9px] font-bold uppercase tracking-wide transition-colors ${
              scope === o.value
                ? "border-[#1A202C] bg-[#1A202C] text-white"
                : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {scope === "department" && departments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {departments.map((d) => (
            <button
              key={d.id}
              onClick={() => toggleDept(d.id)}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                deptIds.includes(d.id)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {deptIds.includes(d.id) ? "✓ " : ""}{d.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
