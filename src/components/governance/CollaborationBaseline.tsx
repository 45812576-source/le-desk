"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  CollaborationBaselineResponse,
  CollaborationBaselineLibrary,
} from "@/app/(app)/data/components/shared/types";

export default function CollaborationBaseline() {
  const [data, setData] = useState<CollaborationBaselineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<CollaborationBaselineResponse>("/knowledge-governance/collaboration-baseline");
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedLibrary = useMemo(() => {
    if (!data || !selectedLibraryId) return null;
    return data.libraries.find((l) => l.library_id === selectedLibraryId) ?? null;
  }, [data, selectedLibraryId]);

  if (loading && !data) {
    return <div className="p-4 text-[9px] text-gray-400">加载协同基线数据...</div>;
  }
  if (!data) {
    return <div className="p-4 text-[9px] text-gray-400">暂无基线数据</div>;
  }

  const { summary, libraries, object_types } = data;

  return (
    <div className="flex flex-col h-full">
      {/* 顶部汇总条 */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-200 bg-[#FAFCFE]">
        <SummaryBadge label="资源库" value={summary.total_libraries} />
        <SummaryBadge label="字段覆盖" value={`${(summary.avg_field_coverage * 100).toFixed(0)}%`} color={summary.avg_field_coverage >= 0.6 ? "text-emerald-600" : "text-amber-600"} />
        <SummaryBadge label="更新达标" value={`${(summary.update_compliance_rate * 100).toFixed(0)}%`} color={summary.update_compliance_rate >= 0.7 ? "text-emerald-600" : "text-red-600"} />
        <SummaryBadge label="跨部门对象" value={summary.total_cross_dept_objects} />
        <button
          onClick={() => void load()}
          disabled={loading}
          className="ml-auto px-2 py-1 text-[8px] font-bold border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          刷新
        </button>
      </div>

      {/* 主体区域：左右分栏 */}
      <div className="flex flex-1 min-h-0">
        {/* 左栏：资源库列表 */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
          {libraries.map((lib) => (
            <LibraryRow
              key={lib.library_id}
              lib={lib}
              isSelected={selectedLibraryId === lib.library_id}
              onClick={() => setSelectedLibraryId(lib.library_id)}
            />
          ))}
          {libraries.length === 0 && (
            <div className="p-4 text-[9px] text-gray-400">暂无资源库</div>
          )}
        </div>

        {/* 右栏：详情 */}
        <div className="flex-1 overflow-y-auto p-4">
          {selectedLibrary ? (
            <LibraryDetail lib={selectedLibrary} objectTypes={object_types} allLibraries={libraries} />
          ) : (
            <div className="text-[9px] text-gray-400 mt-8 text-center">选择左侧资源库查看详情</div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryBadge({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-[14px] font-bold ${color || "text-[#0077B6]"}`}>{value}</span>
      <span className="text-[8px] text-gray-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function LibraryRow({ lib, isSelected, onClick }: { lib: CollaborationBaselineLibrary; isSelected: boolean; onClick: () => void }) {
  const compliance = lib.update_compliance;
  const complianceColor = compliance === null || compliance === undefined ? "text-gray-400" : compliance >= 0.8 ? "text-emerald-600" : compliance >= 0.5 ? "text-amber-600" : "text-red-600";

  return (
    <div
      onClick={onClick}
      className={`px-3 py-2 border-b border-gray-100 cursor-pointer transition-colors ${isSelected ? "bg-[#EAF7FF]" : "hover:bg-gray-50"}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-gray-700 flex-1 truncate">{lib.library_name}</span>
        <span className="text-[8px] text-gray-400">{lib.object_type}</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[8px] text-gray-500">文档 {lib.doc_count}</span>
        <span className="text-[8px] text-gray-500">表 {lib.table_count}</span>
        {lib.consumer_departments.length > 0 && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
            {lib.consumer_departments.length} 部门
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {/* 覆盖率进度条 */}
        <div className="flex-1 h-1.5 bg-gray-200 rounded overflow-hidden">
          <div
            className={`h-full rounded ${lib.field_coverage >= 0.6 ? "bg-emerald-400" : "bg-amber-400"}`}
            style={{ width: `${Math.min(lib.field_coverage * 100, 100)}%` }}
          />
        </div>
        <span className="text-[8px] text-gray-500">{(lib.field_coverage * 100).toFixed(0)}%</span>
        {compliance !== null && compliance !== undefined && (
          <span className={`text-[8px] font-bold ${complianceColor}`}>
            {lib.default_update_cycle || "manual"}
          </span>
        )}
      </div>
    </div>
  );
}

function LibraryDetail({
  lib,
  objectTypes,
  allLibraries,
}: {
  lib: CollaborationBaselineLibrary;
  objectTypes: CollaborationBaselineResponse["object_types"];
  allLibraries: CollaborationBaselineLibrary[];
}) {
  const ot = objectTypes.find((o) => o.object_type_code === lib.object_type);
  const dependencies = allLibraries.filter((l) => lib.dependency_library_codes.includes(l.library_code));
  const dependents = allLibraries.filter((l) => (l.dependency_library_codes || []).includes(lib.library_code));

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] font-bold text-gray-800">{lib.library_name}</div>
        <div className="text-[9px] text-gray-500 mt-0.5">
          {lib.library_code} · {lib.object_type} · 更新周期 {lib.default_update_cycle || "手动"}
        </div>
      </div>

      {/* 字段覆盖矩阵 */}
      <section>
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">字段覆盖矩阵</div>
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-[8px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-2 py-1 text-gray-500 font-semibold">字段</th>
                <th className="text-center px-2 py-1 text-gray-500 font-semibold">必填</th>
                <th className="text-center px-2 py-1 text-gray-500 font-semibold">权限</th>
                <th className="text-center px-2 py-1 text-gray-500 font-semibold">更新周期</th>
              </tr>
            </thead>
            <tbody>
              {lib.field_templates.map((ft) => (
                <tr key={ft.field_key} className="border-t border-gray-100">
                  <td className="px-2 py-1 text-gray-700">{ft.field_label}</td>
                  <td className="text-center px-2 py-1">
                    {ft.is_required ? (
                      <span className="text-emerald-600 font-bold">*</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="text-center px-2 py-1">
                    <span className={`px-1 py-0.5 rounded ${
                      ft.visibility_mode === "edit" ? "bg-blue-50 text-blue-600" :
                      ft.visibility_mode === "restricted" ? "bg-red-50 text-red-600" :
                      "bg-gray-50 text-gray-500"
                    }`}>
                      {ft.visibility_mode === "edit" ? "读写" : ft.visibility_mode === "restricted" ? "受限" : "只读"}
                    </span>
                  </td>
                  <td className="text-center px-2 py-1 text-gray-500">{ft.update_cycle || "-"}</td>
                </tr>
              ))}
              {lib.field_templates.length === 0 && (
                <tr><td colSpan={4} className="px-2 py-2 text-gray-400 text-center">暂无字段模板</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 对象类型维度 */}
      {ot && (
        <section>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">对象类型维度</div>
          <div className="flex flex-wrap gap-1">
            {ot.dimension_schema.map((dim) => (
              <span key={dim} className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[8px] text-slate-600">
                {dim}
              </span>
            ))}
            {ot.dimension_schema.length === 0 && <span className="text-[8px] text-gray-400">暂无维度定义</span>}
          </div>
          <div className="mt-1 text-[8px] text-gray-500">
            活跃对象 {ot.active_object_count} · Facet {ot.facet_count}
          </div>
        </section>
      )}

      {/* 依赖链路 */}
      {(dependencies.length > 0 || dependents.length > 0) && (
        <section>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">依赖链路</div>
          {dependencies.length > 0 && (
            <div className="mb-2">
              <span className="text-[8px] text-gray-500 mr-2">上游依赖:</span>
              {dependencies.map((d) => (
                <span key={d.library_code} className="inline-block px-1.5 py-0.5 mr-1 rounded border border-blue-200 bg-blue-50 text-[8px] text-blue-600">
                  {d.library_name}
                </span>
              ))}
            </div>
          )}
          {dependents.length > 0 && (
            <div>
              <span className="text-[8px] text-gray-500 mr-2">下游消费:</span>
              {dependents.map((d) => (
                <span key={d.library_code} className="inline-block px-1.5 py-0.5 mr-1 rounded border border-emerald-200 bg-emerald-50 text-[8px] text-emerald-600">
                  {d.library_name}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 消费部门 */}
      {lib.consumer_departments.length > 0 && (
        <section>
          <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-2">消费部门</div>
          <div className="flex flex-wrap gap-1">
            {lib.consumer_departments.map((deptId) => (
              <span key={deptId} className="px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-[8px] text-violet-600">
                部门 #{deptId}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
