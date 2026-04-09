"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { OrgDepartment, OrgRosterUser } from "@/lib/types";
import ImportWizard from "./ImportWizard";

const EMP_STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  probation: "bg-blue-100 text-blue-800",
  resigned: "bg-red-100 text-red-800",
  transferred: "bg-yellow-100 text-yellow-800",
};

const EMP_STATUS_LABEL: Record<string, string> = {
  active: "在职",
  probation: "试用期",
  resigned: "已离职",
  transferred: "已调动",
};

const STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "active", label: "在职" },
  { value: "probation", label: "试用期" },
  { value: "resigned", label: "已离职" },
  { value: "transferred", label: "已调动" },
];

export default function RosterTab() {
  const [roster, setRoster] = useState<OrgRosterUser[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrgRosterUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 筛选
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const deptMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of departments) m.set(d.id, d.name);
    return m;
  }, [departments]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rosterData, deptData] = await Promise.all([
        apiFetch<OrgRosterUser[]>("/api/org-management/roster"),
        apiFetch<OrgDepartment[]>("/api/org-management/departments"),
      ]);
      setRoster(rosterData);
      setDepartments(deptData);
    } catch (e) {
      console.error("加载花名册失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return roster.filter((u) => {
      if (deptFilter && u.department_id !== Number(deptFilter)) return false;
      if (statusFilter && u.employee_status !== statusFilter) return false;
      return true;
    });
  }, [roster, deptFilter, statusFilter]);

  const handleRowClick = async (user: OrgRosterUser) => {
    if (expandedId === user.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(user.id);
    setDetailLoading(true);
    try {
      const data = await apiFetch<OrgRosterUser>(`/api/org-management/roster/${user.id}`);
      setDetail(data);
    } catch {
      setDetail(user);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 顶部筛选栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
          >
            <option value="">全部部门</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border px-3 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          导入
        </button>
      </div>

      {/* 花名册表格 */}
      {loading ? (
        <div className="py-10 text-center text-gray-500">加载中...</div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 font-medium">工号</th>
                <th className="px-4 py-2 font-medium">姓名</th>
                <th className="px-4 py-2 font-medium">部门</th>
                <th className="px-4 py-2 font-medium">岗位</th>
                <th className="px-4 py-2 font-medium">职级</th>
                <th className="px-4 py-2 font-medium">职称</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">入职日期</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    暂无员工数据
                  </td>
                </tr>
              )}
              {filtered.map((user) => (
                <>
                  <tr
                    key={user.id}
                    onClick={() => handleRowClick(user)}
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-2">{user.employee_no || "-"}</td>
                    <td className="px-4 py-2 font-medium">{user.display_name}</td>
                    <td className="px-4 py-2">
                      {user.department_id ? deptMap.get(user.department_id) || "-" : "-"}
                    </td>
                    <td className="px-4 py-2">{user.job_title || "-"}</td>
                    <td className="px-4 py-2">{user.job_level || "-"}</td>
                    <td className="px-4 py-2">{user.role || "-"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${EMP_STATUS_BADGE[user.employee_status || ""] || "bg-gray-100 text-gray-600"}`}
                      >
                        {EMP_STATUS_LABEL[user.employee_status || ""] || user.employee_status || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2">{user.entry_date || "-"}</td>
                  </tr>

                  {/* 展开详情行 */}
                  {expandedId === user.id && (
                    <tr key={`${user.id}-detail`} className="border-t border-gray-100 bg-gray-50">
                      <td colSpan={8} className="px-6 py-4">
                        {detailLoading ? (
                          <span className="text-gray-400">加载详情...</span>
                        ) : detail ? (
                          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
                            <div>
                              <span className="text-gray-500">用户名：</span>
                              {detail.username}
                            </div>
                            <div>
                              <span className="text-gray-500">工号：</span>
                              {detail.employee_no || "-"}
                            </div>
                            <div>
                              <span className="text-gray-500">岗位：</span>
                              {detail.job_title || "-"}
                            </div>
                            <div>
                              <span className="text-gray-500">职级：</span>
                              {detail.job_level || "-"}
                            </div>
                            <div>
                              <span className="text-gray-500">入职日期：</span>
                              {detail.entry_date || "-"}
                            </div>
                            <div>
                              <span className="text-gray-500">离职日期：</span>
                              {detail.exit_date || "-"}
                            </div>
                            <div>
                              <span className="text-gray-500">汇报上级ID：</span>
                              {detail.report_to_id ?? "-"}
                            </div>
                            <div>
                              <span className="text-gray-500">账号状态：</span>
                              {detail.is_active ? "启用" : "停用"}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 导入向导 */}
      {showImport && (
        <ImportWizard importType="roster" onClose={() => setShowImport(false)} onComplete={load} />
      )}
    </div>
  );
}
