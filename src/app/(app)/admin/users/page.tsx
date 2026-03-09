"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { Department } from "@/lib/types";

export default function AdminUsersPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDepts = useCallback(() => {
    setLoading(true);
    apiFetch<Department[]>("/admin/departments")
      .then(setDepartments)
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDepts();
  }, [fetchDepts]);

  return (
    <PageShell title="用户管理" icon={ICONS.users}>
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">
        部门列表
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : departments.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无部门数据
        </div>
      ) : (
        <table className="w-full border-2 border-[#1A202C] mb-6">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["ID", "名称", "类别", "BU", "上级部门"].map((h) => (
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
            {departments.map((d) => (
              <tr key={d.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2 text-xs">{d.id}</td>
                <td className="px-3 py-2 text-xs font-bold">{d.name}</td>
                <td className="px-3 py-2">
                  {d.category && <PixelBadge color="cyan">{d.category}</PixelBadge>}
                </td>
                <td className="px-3 py-2 text-xs">{d.business_unit || "-"}</td>
                <td className="px-3 py-2 text-xs">{d.parent_id ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="p-3 bg-[#FEFCBF] border-2 border-[#B7791F] text-[10px] text-[#B7791F] font-bold">
        用户列表管理功能需要后端新增 /api/admin/users 端点后启用
      </div>
    </PageShell>
  );
}
