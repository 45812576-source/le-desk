"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";
import type { Department } from "@/lib/types";

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  role: string;
  department_id: number | null;
  department_name: string | null;
  position_id: number | null;
  position_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface Position {
  id: number;
  name: string;
  department_id: number | null;
}

interface FormData {
  username: string;
  password: string;
  display_name: string;
  role: string;
  department_id: string;
  position_id: string;
  is_active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "超管",
  dept_admin: "部门管理员",
  employee: "员工",
};
const ROLE_COLORS: Record<string, "red" | "yellow" | "cyan"> = {
  super_admin: "red",
  dept_admin: "yellow",
  employee: "cyan",
};

const EMPTY_FORM: FormData = {
  username: "",
  password: "",
  display_name: "",
  role: "employee",
  department_id: "",
  position_id: "",
  is_active: true,
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterRole, setFilterRole] = useState("");

  const fetchAll = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDept) params.set("department_id", filterDept);
    if (filterRole) params.set("role", filterRole);
    Promise.all([
      apiFetch<UserRow[]>(`/admin/users?${params}`),
      apiFetch<Department[]>("/admin/departments"),
      apiFetch<Position[]>("/admin/permissions/positions"),
    ])
      .then(([u, d, p]) => {
        setUsers(u);
        setDepartments(d);
        setPositions(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterDept, filterRole]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  function openCreate() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  }

  function openEdit(u: UserRow) {
    setEditingUser(u);
    setForm({
      username: u.username,
      password: "",
      display_name: u.display_name,
      role: u.role,
      department_id: u.department_id ? String(u.department_id) : "",
      position_id: u.position_id ? String(u.position_id) : "",
      is_active: u.is_active,
    });
    setError("");
    setShowForm(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        display_name: form.display_name,
        role: form.role,
        department_id: form.department_id ? Number(form.department_id) : null,
        position_id: form.position_id ? Number(form.position_id) : null,
        is_active: form.is_active,
      };
      if (editingUser) {
        if (form.password) payload.password = form.password;
        await apiFetch(`/admin/users/${editingUser.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        payload.username = form.username;
        payload.password = form.password;
        await apiFetch("/admin/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      fetchAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(u: UserRow) {
    if (!confirm(`确认停用用户「${u.display_name}」？`)) return;
    try {
      await apiFetch(`/admin/users/${u.id}`, { method: "DELETE" });
      fetchAll();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  async function handleReactivate(u: UserRow) {
    try {
      await apiFetch(`/admin/users/${u.id}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: true }),
      });
      fetchAll();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  // 筛选部门时同步过滤岗位选项
  const filteredPositions = form.department_id
    ? positions.filter((p) => p.department_id === Number(form.department_id) || p.department_id === null)
    : positions;

  return (
    <PageShell title="用户管理" icon={ICONS.users}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <PixelSelect
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="w-auto"
        >
          <option value="">全部部门</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </PixelSelect>
        <PixelSelect
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="w-auto"
        >
          <option value="">全部角色</option>
          <option value="super_admin">超管</option>
          <option value="dept_admin">部门管理员</option>
          <option value="employee">员工</option>
        </PixelSelect>
        <span className="text-[10px] text-gray-400 font-bold">共 {users.length} 人</span>
        <div className="ml-auto">
          <PixelButton variant="primary" size="sm" onClick={openCreate}>
            + 新建用户
          </PixelButton>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : users.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无用户数据
        </div>
      ) : (
        <table className="w-full border-2 border-[#1A202C]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["ID", "用户名", "姓名", "角色", "部门", "岗位", "状态", "操作"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-gray-200 hover:bg-gray-50 ${!u.is_active ? "opacity-50" : ""}`}
              >
                <td className="px-3 py-2 text-xs text-gray-400">{u.id}</td>
                <td className="px-3 py-2 text-xs font-bold font-mono">{u.username}</td>
                <td className="px-3 py-2 text-xs">{u.display_name}</td>
                <td className="px-3 py-2">
                  <PixelBadge color={ROLE_COLORS[u.role] || "cyan"}>
                    {ROLE_LABELS[u.role] || u.role}
                  </PixelBadge>
                </td>
                <td className="px-3 py-2 text-xs">{u.department_name || "-"}</td>
                <td className="px-3 py-2 text-xs">{u.position_name || "-"}</td>
                <td className="px-3 py-2">
                  <PixelBadge color={u.is_active ? "green" : "red"}>
                    {u.is_active ? "活跃" : "停用"}
                  </PixelBadge>
                </td>
                <td className="px-3 py-2 flex gap-1">
                  <PixelButton size="sm" variant="secondary" onClick={() => openEdit(u)}>
                    编辑
                  </PixelButton>
                  {u.is_active ? (
                    <PixelButton size="sm" variant="danger" onClick={() => handleDeactivate(u)}>
                      停用
                    </PixelButton>
                  ) : (
                    <PixelButton size="sm" variant="secondary" onClick={() => handleReactivate(u)}>
                      启用
                    </PixelButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border-2 border-[#1A202C] w-[480px] max-h-[90vh] overflow-y-auto">
            <div className="bg-[#EBF4F7] border-b-2 border-[#1A202C] px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest">
                {editingUser ? "编辑用户" : "新建用户"}
              </span>
              <button
                onClick={() => setShowForm(false)}
                className="text-xs font-bold text-gray-400 hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              {!editingUser && (
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">用户名 *</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00D1FF]"
                    placeholder="登录账号（仅限字母数字下划线）"
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">
                  {editingUser ? "密码（留空则不修改）" : "密码 *"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs focus:outline-none focus:border-[#00D1FF]"
                  placeholder="••••••"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">姓名 *</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs focus:outline-none focus:border-[#00D1FF]"
                  placeholder="显示名称"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">系统角色</label>
                <PixelSelect
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="employee">员工</option>
                  <option value="dept_admin">部门管理员</option>
                  <option value="super_admin">超管</option>
                </PixelSelect>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">部门</label>
                <PixelSelect
                  value={form.department_id}
                  onChange={(e) => setForm({ ...form, department_id: e.target.value, position_id: "" })}
                >
                  <option value="">未分配</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </PixelSelect>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">
                  业务岗位 <span className="text-gray-400 normal-case font-normal">（决定数据权限）</span>
                </label>
                <PixelSelect
                  value={form.position_id}
                  onChange={(e) => setForm({ ...form, position_id: e.target.value })}
                >
                  <option value="">未分配岗位</option>
                  {filteredPositions.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </PixelSelect>
                <p className="text-[9px] text-gray-400 mt-1">岗位控制该员工调用 Skill 时的数据范围和脱敏规则</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="border-2 border-[#1A202C]"
                />
                <label htmlFor="is_active" className="text-xs font-bold">账号启用</label>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-400 px-3 py-2 text-xs text-red-700 font-bold">
                  {error}
                </div>
              )}
            </div>
            <div className="border-t-2 border-[#1A202C] px-4 py-3 flex gap-2 justify-end">
              <PixelButton variant="secondary" size="sm" onClick={() => setShowForm(false)}>
                取消
              </PixelButton>
              <PixelButton
                variant="primary"
                size="sm"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? "保存中..." : "保存"}
              </PixelButton>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
