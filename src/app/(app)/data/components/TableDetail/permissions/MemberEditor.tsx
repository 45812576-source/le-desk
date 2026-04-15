"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { TableRoleGroup } from "../../shared/types";

interface UserItem {
  id: number;
  username: string;
  display_name: string;
  role: string;
  department_id: number | null;
}

interface DepartmentItem {
  id: number;
  name: string;
  parent_id: number | null;
}

interface SkillItem {
  id: number;
  name: string;
}

interface Props {
  roleGroup: TableRoleGroup;
  onSaved: () => void;
  readOnly?: boolean;
}

export default function MemberEditor({ roleGroup, onSaved, readOnly = false }: Props) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [apiFailed, setApiFailed] = useState(false);

  const [selectedUserIds, setSelectedUserIds] = useState<number[]>(roleGroup.user_ids || []);
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>(roleGroup.department_ids || []);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>(roleGroup.skill_ids || []);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [deptSearch, setDeptSearch] = useState("");
  const [skillSearch, setSkillSearch] = useState("");

  // Reset selections when roleGroup changes
  useEffect(() => {
    setSelectedUserIds(roleGroup.user_ids || []);
    setSelectedDeptIds(roleGroup.department_ids || []);
    setSelectedSkillIds(roleGroup.skill_ids || []);
    setDirty(false);
  }, [roleGroup.id, roleGroup.user_ids, roleGroup.department_ids, roleGroup.skill_ids]);

  // Fetch reference data
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [usersRes, deptsRes, skillsRes] = await Promise.allSettled([
          apiFetch<UserItem[]>("/admin/users").catch(() => []),
          apiFetch<DepartmentItem[]>("/admin/departments").catch(() => []),
          apiFetch<SkillItem[]>("/skills").catch(() => []),
        ]);

        if (cancelled) return;

        setUsers(usersRes.status === "fulfilled" ? usersRes.value : []);
        setDepartments(deptsRes.status === "fulfilled" ? deptsRes.value : []);
        setSkills(skillsRes.status === "fulfilled" ? skillsRes.value : []);
      } catch {
        if (!cancelled) setApiFailed(true);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  const toggleUser = useCallback((id: number) => {
    setSelectedUserIds((prev) => {
      const next = prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id];
      setDirty(true);
      return next;
    });
  }, []);

  const toggleDept = useCallback((id: number) => {
    setSelectedDeptIds((prev) => {
      const next = prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id];
      setDirty(true);
      return next;
    });
  }, []);

  const toggleSkill = useCallback((id: number) => {
    setSelectedSkillIds((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      setDirty(true);
      return next;
    });
  }, []);

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    try {
      await apiFetch(`/data-assets/role-groups/${roleGroup.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          user_ids: selectedUserIds,
          department_ids: selectedDeptIds,
          skill_ids: selectedSkillIds,
        }),
      });
      setDirty(false);
      onSaved();
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 404) {
        setApiFailed(true);
      } else {
        alert(e instanceof Error ? e.message : "保存失败");
      }
    } finally {
      setSaving(false);
    }
  }

  if (apiFailed) {
    return (
      <div className="border-2 border-dashed border-gray-300 p-3 bg-gray-50">
        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">成员管理</div>
        <div className="text-[9px] text-gray-400 text-center py-2">成员管理 API 待实现</div>
      </div>
    );
  }

  const filteredUsers = userSearch
    ? users.filter((u) => u.display_name.includes(userSearch) || u.username.includes(userSearch))
    : users;

  const filteredDepts = deptSearch
    ? departments.filter((d) => d.name.includes(deptSearch))
    : departments;

  const filteredSkills = skillSearch
    ? skills.filter((s) => s.name.includes(skillSearch))
    : skills;

  const showSkillSection = roleGroup.group_type === "skill_role" || roleGroup.group_type === "mixed";

  return (
    <div className="space-y-3">
      {readOnly && (
        <div className="text-[8px] text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-1.5">
          当前角色组为只读状态，无法修改成员。
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">成员管理</span>
        {dirty && !readOnly && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-2.5 py-1 border-2 border-[#1A202C] bg-[#1A202C] text-white text-[8px] font-bold uppercase tracking-widest hover:bg-[#00A3C4] hover:border-[#00A3C4] transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存成员"}
          </button>
        )}
      </div>

      {/* 用户选择器 */}
      <div>
        <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mb-1">
          用户 ({selectedUserIds.length} 已选)
        </div>
        <input
          type="text"
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          placeholder="搜索用户..."
          disabled={readOnly}
          className="w-full border-2 border-gray-200 px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-[#00D1FF] mb-1.5"
        />
        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
          {filteredUsers.map((u) => (
            <button
              key={u.id}
              onClick={() => toggleUser(u.id)}
              disabled={readOnly}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                selectedUserIds.includes(u.id)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {selectedUserIds.includes(u.id) ? "✓ " : ""}{u.display_name}
            </button>
          ))}
          {filteredUsers.length === 0 && (
            <span className="text-[9px] text-gray-400">无匹配用户</span>
          )}
        </div>
      </div>

      {/* 部门选择器 */}
      <div>
        <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mb-1">
          部门 ({selectedDeptIds.length} 已选)
        </div>
        <input
          type="text"
          value={deptSearch}
          onChange={(e) => setDeptSearch(e.target.value)}
          placeholder="搜索部门..."
          disabled={readOnly}
          className="w-full border-2 border-gray-200 px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-[#00D1FF] mb-1.5"
        />
        <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
          {filteredDepts.map((d) => (
            <button
              key={d.id}
              onClick={() => toggleDept(d.id)}
              disabled={readOnly}
              className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                selectedDeptIds.includes(d.id)
                  ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                  : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
              }`}
            >
              {selectedDeptIds.includes(d.id) ? "✓ " : ""}{d.name}
            </button>
          ))}
          {filteredDepts.length === 0 && (
            <span className="text-[9px] text-gray-400">无匹配部门</span>
          )}
        </div>
      </div>

      {/* Skill 选择器（仅 skill_role / mixed 类型） */}
      {showSkillSection && (
        <div>
          <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mb-1">
            Skill ({selectedSkillIds.length} 已选)
          </div>
          <input
            type="text"
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            placeholder="搜索 Skill..."
            disabled={readOnly}
            className="w-full border-2 border-gray-200 px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-[#00D1FF] mb-1.5"
          />
          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
            {filteredSkills.map((s) => (
              <button
                key={s.id}
                onClick={() => toggleSkill(s.id)}
                disabled={readOnly}
                className={`px-2 py-0.5 border-2 text-[9px] font-bold transition-colors ${
                  selectedSkillIds.includes(s.id)
                    ? "border-[#00A3C4] bg-[#CCF2FF] text-[#1A202C]"
                    : "border-gray-300 bg-white text-gray-500 hover:border-[#00A3C4]"
                }`}
              >
                {selectedSkillIds.includes(s.id) ? "✓ " : ""}{s.name}
              </button>
            ))}
            {filteredSkills.length === 0 && (
              <span className="text-[9px] text-gray-400">无匹配 Skill</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
