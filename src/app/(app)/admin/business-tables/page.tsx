"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { BusinessTable } from "@/lib/types";

const VISIBILITY_LABEL: Record<string, string> = {
  detail: "明细",
  desensitized: "脱敏",
  stats: "仅统计",
};

const VISIBILITY_COLOR: Record<string, string> = {
  detail: "bg-green-100 text-green-700 border-green-300",
  desensitized: "bg-yellow-100 text-yellow-700 border-yellow-300",
  stats: "bg-gray-100 text-gray-600 border-gray-300",
};

const ACCESS_SCOPE_LABEL: Record<string, string> = {
  self: "仅自己",
  users: "指定人员",
  roles: "指定角色",
  departments: "指定部门",
  projects: "指定项目组",
  company: "全公司",
};

const ACCESS_SCOPE_COLOR: Record<string, string> = {
  self: "bg-red-50 text-red-600 border-red-200",
  users: "bg-orange-50 text-orange-600 border-orange-200",
  roles: "bg-purple-50 text-purple-600 border-purple-200",
  departments: "bg-blue-50 text-blue-600 border-blue-200",
  projects: "bg-teal-50 text-teal-600 border-teal-200",
  company: "bg-green-50 text-green-600 border-green-200",
};

function matchTable(bt: BusinessTable, q: string): boolean {
  const s = q.toLowerCase();
  if (bt.display_name.toLowerCase().includes(s)) return true;
  if (bt.table_name.toLowerCase().includes(s)) return true;
  if (bt.description?.toLowerCase().includes(s)) return true;
  if (bt.owner_name?.toLowerCase().includes(s)) return true;
  if (bt.department_name?.toLowerCase().includes(s)) return true;
  if (bt.ownership?.owner_field.toLowerCase().includes(s)) return true;
  if (bt.ownership?.department_field?.toLowerCase().includes(s)) return true;
  if (bt.ownership?.visibility_level && VISIBILITY_LABEL[bt.ownership.visibility_level]?.includes(s)) return true;
  if (bt.referenced_skills?.some((sk) => sk.toLowerCase().includes(s))) return true;
  return false;
}

export default function AdminBusinessTablesPage() {
  const [tables, setTables] = useState<BusinessTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const fetchTables = useCallback(() => {
    Promise.resolve().then(() => setLoading(true));
    apiFetch<BusinessTable[]>("/business-tables")
      .then(setTables)
      .catch(() => setTables([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  function handleExpand(id: number) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除？")) return;
    try {
      await apiFetch(`/business-tables/${id}`, { method: "DELETE" });
      fetchTables();
    } catch {
      // ignore
    }
  }

  return (
    <PageShell title="业务表管理" icon={ICONS.bizTable}>
      {/* Search bar */}
      <div className="mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索数据源名称 / Skill 名称 / 归属信息..."
          className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] font-mono bg-white placeholder-gray-400 focus:outline-none focus:border-[#00A3C4]"
        />
      </div>
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : tables.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无业务表
        </div>
      ) : query.trim() && tables.filter((bt) => matchTable(bt, query.trim())).length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          无匹配结果
        </div>
      ) : (
        <div className="space-y-2">
          {(query.trim() ? tables.filter((bt) => matchTable(bt, query.trim())) : tables).map((bt) => {
            const isOpen = expandedId === bt.id;
            return (
              <div key={bt.id} className="bg-white border-2 border-[#1A202C]">
                {/* Row */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold">{bt.display_name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{bt.table_name}</span>
                    </div>
                    <p className="text-[10px] text-gray-500">{bt.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <PixelButton size="sm" variant="secondary" onClick={() => handleExpand(bt.id)}>
                      {isOpen ? "收起" : "详情"}
                    </PixelButton>
                    <PixelButton size="sm" variant="danger" onClick={() => handleDelete(bt.id)}>
                      删除
                    </PixelButton>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t-2 border-[#1A202C] p-4 space-y-4">

                    {/* Section 1: Owner / dept */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
                        归属信息
                      </div>
                      <div className="flex flex-wrap gap-6 text-[10px]">
                        <div>
                          <span className="text-gray-400 mr-1">Owner</span>
                          <span className="font-bold">{bt.owner_name ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 mr-1">部门</span>
                          <span className="font-bold">{bt.department_name ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 mr-1">创建时间</span>
                          <span className="font-mono">{bt.created_at ? bt.created_at.slice(0, 10) : "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Access scope (new 6-level) */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
                        访问权限
                      </div>
                      {(() => {
                        const vr = bt.validation_rules as Record<string, unknown> | undefined;
                        const scope = (vr?.access_scope as string) ?? "self";
                        const userCount = (vr?.access_user_ids as number[] | undefined)?.length ?? 0;
                        const roleIds = (vr?.access_role_ids as string[] | undefined) ?? [];
                        const deptCount = (vr?.access_department_ids as number[] | undefined)?.length ?? 0;
                        const projectCount = (vr?.access_project_ids as number[] | undefined)?.length ?? 0;
                        const skillViews = (vr?.skill_data_views as { view_id: string }[] | undefined) ?? [];
                        return (
                          <div className="flex flex-wrap gap-3 items-center text-[10px]">
                            <span
                              className={`inline-block border px-2 py-0.5 font-bold text-[9px] uppercase tracking-wider ${
                                ACCESS_SCOPE_COLOR[scope] ?? ACCESS_SCOPE_COLOR.self
                              }`}
                            >
                              {ACCESS_SCOPE_LABEL[scope] ?? scope}
                            </span>
                            {scope === "users" && userCount > 0 && (
                              <span className="text-gray-500">{userCount} 人</span>
                            )}
                            {scope === "roles" && roleIds.length > 0 && (
                              <span className="text-gray-500">{roleIds.join("、")}</span>
                            )}
                            {scope === "departments" && deptCount > 0 && (
                              <span className="text-gray-500">{deptCount} 个部门</span>
                            )}
                            {scope === "projects" && projectCount > 0 && (
                              <span className="text-gray-500">{projectCount} 个项目组</span>
                            )}
                            {skillViews.length > 0 && (
                              <span className="text-gray-400 text-[9px]">
                                {skillViews.length} 个 Skill 数据视图
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Section 2b: Visibility / Ownership rule (legacy) */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
                        数据可见范围
                      </div>
                      {bt.ownership ? (
                        <div className="flex flex-wrap gap-3 items-center text-[10px]">
                          <span
                            className={`inline-block border px-2 py-0.5 font-bold text-[9px] uppercase tracking-wider ${
                              VISIBILITY_COLOR[bt.ownership.visibility_level] ?? VISIBILITY_COLOR.detail
                            }`}
                          >
                            {VISIBILITY_LABEL[bt.ownership.visibility_level] ?? bt.ownership.visibility_level}
                          </span>
                          <span>
                            <span className="text-gray-400 mr-1">归属字段</span>
                            <span className="font-mono font-bold">{bt.ownership.owner_field}</span>
                          </span>
                          {bt.ownership.department_field && (
                            <span>
                              <span className="text-gray-400 mr-1">部门字段</span>
                              <span className="font-mono font-bold">{bt.ownership.department_field}</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">未配置</span>
                      )}
                    </div>

                    {/* Section 3: Referenced skills */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
                        引用此表的 Skill
                      </div>
                      {bt.referenced_skills && bt.referenced_skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {bt.referenced_skills.map((name) => (
                            <span
                              key={name}
                              className="inline-block border border-[#1A202C] bg-[#EBF4F7] px-2 py-0.5 text-[9px] font-mono font-bold"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">无</span>
                      )}
                    </div>

                    {/* Section 4: Columns */}
                    {bt.columns && bt.columns.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
                          列定义
                        </div>
                        <table className="w-full border border-gray-200">
                          <thead>
                            <tr className="bg-gray-50">
                              {["列名", "类型", "可空", "备注"].map((h) => (
                                <th key={h} className="text-left text-[9px] font-bold text-gray-500 px-2 py-1">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bt.columns.map((col) => (
                              <tr key={col.name} className="border-t border-gray-100">
                                <td className="px-2 py-1 text-[10px] font-mono font-bold">{col.name}</td>
                                <td className="px-2 py-1 text-[10px]">{col.type}</td>
                                <td className="px-2 py-1 text-[10px]">{col.nullable ? "YES" : "NO"}</td>
                                <td className="px-2 py-1 text-[10px] text-gray-500">{col.comment}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Section 5: DDL */}
                    {bt.ddl_sql && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">DDL</div>
                        <pre className="text-[9px] bg-gray-50 border border-gray-200 p-2 max-h-40 overflow-auto">
                          {bt.ddl_sql}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
