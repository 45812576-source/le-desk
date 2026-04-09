"use client";

import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import type { Department } from "@/lib/types";
import { ROLE_LABELS, ROLE_COLORS } from "../constants";

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: string;
  department_id: number | null;
  department_name: string | null;
  is_active: boolean;
}

interface UserListProps {
  users: UserRow[];
  departments: Department[];
  loading: boolean;
  selectedId: number | null;
  search: string;
  filterRole: string;
  filterDept: string;
  onSearchChange: (v: string) => void;
  onFilterRole: (v: string) => void;
  onFilterDept: (v: string) => void;
  onSelect: (user: UserRow) => void;
}

export function UserList({
  users,
  departments,
  loading,
  selectedId,
  search,
  filterRole,
  filterDept,
  onSearchChange,
  onFilterRole,
  onFilterDept,
  onSelect,
}: UserListProps) {
  const filtered = users.filter((u) => {
    const matchSearch =
      !search || u.display_name.includes(search) || u.username.includes(search);
    const matchRole = !filterRole || u.role === filterRole;
    const matchDept = !filterDept || String(u.department_id) === filterDept;
    return matchSearch && matchRole && matchDept;
  });

  return (
    <div className="w-72 shrink-0 flex flex-col border-2 border-[#1A202C] bg-white">
      <div className="bg-muted border-b-2 border-border p-3 flex flex-col gap-2">
        <input
          type="text"
          placeholder="搜索姓名或用户名…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="border-2 border-border bg-background text-foreground px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#00D1FF] w-full"
        />
        <div className="flex gap-2">
          <PixelSelect
            pixelSize="sm"
            value={filterRole}
            onChange={(e) => onFilterRole(e.target.value)}
            className="flex-1 text-[10px]"
          >
            <option value="">全部角色</option>
            <option value="super_admin">超管</option>
            <option value="dept_admin">部门管理员</option>
            <option value="employee">员工</option>
          </PixelSelect>
          <PixelSelect
            pixelSize="sm"
            value={filterDept}
            onChange={(e) => onFilterDept(e.target.value)}
            className="flex-1 text-[10px]"
          >
            <option value="">全部部门</option>
            {departments.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
          </PixelSelect>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse p-4">
            加载中…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-400 p-4 text-center">无匹配用户</p>
        ) : (
          filtered.map((u) => (
            <button
              key={u.id}
              onClick={() => onSelect(u)}
              className={`w-full text-left px-3 py-2.5 border-b border-border hover:bg-muted transition-colors ${
                selectedId === u.id
                  ? "bg-accent border-l-4 border-l-[#00D1FF]"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold font-mono text-foreground truncate">
                  {u.display_name}
                </span>
                <PixelBadge color={ROLE_COLORS[u.role] || "cyan"}>
                  {ROLE_LABELS[u.role] || u.role}
                </PixelBadge>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                {u.username}
                {u.department_name ? ` · ${u.department_name}` : ""}
              </div>
              {!u.is_active && (
                <span className="text-[9px] text-red-500 font-bold">已停用</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
