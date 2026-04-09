"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { Department, DeptCollabLink } from "@/lib/types";
import { Upload } from "lucide-react";
import ImportWizard from "./ImportWizard";

const API = "/org-management/collab-matrix";

interface CollabMatrixResponse {
  departments: Department[];
  matrix: DeptCollabLink[];
}

const FREQ_VALUE: Record<string, number> = { high: 3, medium: 2, low: 1 };

function cellColor(freq: number): string {
  if (freq >= 3) return "bg-red-400 text-white";
  if (freq === 2) return "bg-yellow-300 text-gray-800";
  if (freq === 1) return "bg-green-300 text-gray-800";
  return "bg-gray-100 text-gray-400";
}

function freqLabel(freq: number): string {
  if (freq >= 3) return "高";
  if (freq === 2) return "中";
  if (freq === 1) return "低";
  return "—";
}

export default function CollabMatrixTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [matrix, setMatrix] = useState<DeptCollabLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [hoverCell, setHoverCell] = useState<{ a: number; b: number } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<CollabMatrixResponse>(API)
      .then((res) => {
        setDepartments(res.departments);
        setMatrix(res.matrix);
      })
      .catch(() => {
        setDepartments([]);
        setMatrix([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // 查找两个部门之间的协作链接
  function findLink(aId: number, bId: number): DeptCollabLink | undefined {
    return matrix.find(
      (l) => (l.dept_a_id === aId && l.dept_b_id === bId) || (l.dept_a_id === bId && l.dept_b_id === aId),
    );
  }

  if (showImport) {
    return (
      <ImportWizard
        importType="collab_matrix"
        onClose={() => { setShowImport(false); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono uppercase">协作矩阵</h2>
        <PixelButton onClick={() => setShowImport(true)}>
          <Upload className="w-4 h-4 mr-1 inline-block" />
          导入
        </PixelButton>
      </div>

      {/* 图例 */}
      <div className="flex gap-4 text-xs font-mono">
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-red-400 border border-[#1A202C] inline-block" /> 高频
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-yellow-300 border border-[#1A202C] inline-block" /> 中频
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-green-300 border border-[#1A202C] inline-block" /> 低频
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 bg-gray-100 border border-[#1A202C] inline-block" /> 无
        </span>
      </div>

      {loading ? (
        <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>
      ) : departments.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-mono">暂无协作矩阵数据</p>
      ) : (
        <div className="overflow-auto relative">
          <table className="border-collapse text-xs font-mono">
            <thead>
              <tr>
                <th className="p-2 border-2 border-[#1A202C] bg-[#F0F4F8] sticky left-0 z-10" />
                {departments.map((d) => (
                  <th
                    key={d.id}
                    className="p-2 border-2 border-[#1A202C] bg-[#F0F4F8] whitespace-nowrap"
                    style={{ writingMode: "vertical-rl", textOrientation: "mixed", minWidth: 36 }}
                  >
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((rowDept) => (
                <tr key={rowDept.id}>
                  <td className="p-2 border-2 border-[#1A202C] bg-[#F0F4F8] font-bold whitespace-nowrap sticky left-0 z-10">
                    {rowDept.name}
                  </td>
                  {departments.map((colDept) => {
                    const link = findLink(rowDept.id, colDept.id);
                    const freq = link ? FREQ_VALUE[link.frequency] ?? 0 : 0;
                    const isHovered = hoverCell?.a === rowDept.id && hoverCell?.b === colDept.id;
                    const isSelf = rowDept.id === colDept.id;

                    return (
                      <td
                        key={colDept.id}
                        className={`p-2 border border-[#1A202C] text-center relative cursor-default ${
                          isSelf ? "bg-gray-200" : cellColor(freq)
                        }`}
                        onMouseEnter={() => !isSelf && setHoverCell({ a: rowDept.id, b: colDept.id })}
                        onMouseLeave={() => setHoverCell(null)}
                      >
                        {isSelf ? "—" : freqLabel(freq)}

                        {/* 悬浮提示 */}
                        {isHovered && link && link.scenarios.length > 0 && (
                          <div className="absolute z-20 left-1/2 -translate-x-1/2 top-full mt-1 bg-[#1A202C] text-white p-2 text-xs whitespace-nowrap border-2 border-[#00D1FF] shadow-lg">
                            <p className="font-bold mb-1">协作场景</p>
                            <ul>
                              {link.scenarios.map((s, i) => (
                                <li key={i}>• {s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
