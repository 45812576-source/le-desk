"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { PositionAccessRule } from "@/lib/types";
import { Upload } from "lucide-react";
import ImportWizard from "./ImportWizard";

const API = "/org-management/access-matrix";

interface Position {
  id: number;
  name: string;
}

interface AccessMatrixResponse {
  positions: Position[];
  data_domains: string[];
  matrix: PositionAccessRule[];
}

const ACCESS_RANGE_OPTIONS = [
  { value: "none", label: "无" },
  { value: "own", label: "本人" },
  { value: "department", label: "本部门" },
  { value: "all", label: "全部" },
];

function badgeColor(range: string): string {
  switch (range) {
    case "all": return "bg-red-100 text-red-700 border-red-300";
    case "department": return "bg-yellow-100 text-yellow-700 border-yellow-300";
    case "own": return "bg-green-100 text-green-700 border-green-300";
    default: return "bg-gray-100 text-gray-400 border-gray-300";
  }
}

function rangeLabel(range: string): string {
  return ACCESS_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? range;
}

export default function AccessMatrixTab() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [dataDomains, setDataDomains] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<PositionAccessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [editingCell, setEditingCell] = useState<{ positionId: number; domain: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<AccessMatrixResponse>(API)
      .then((res) => {
        setPositions(res.positions);
        setDataDomains(res.data_domains);
        setMatrix(res.matrix);
      })
      .catch(() => {
        setPositions([]);
        setDataDomains([]);
        setMatrix([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function findRule(positionId: number, domain: string): PositionAccessRule | undefined {
    return matrix.find((r) => r.position_id === positionId && r.data_domain === domain);
  }

  async function handleUpdateAccess(positionId: number, domain: string, newRange: string) {
    setSaving(true);
    try {
      const existing = findRule(positionId, domain);
      if (existing) {
        await apiFetch(`${API}/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify({ access_range: newRange }),
        });
      } else {
        await apiFetch(API, {
          method: "POST",
          body: JSON.stringify({
            position_id: positionId,
            data_domain: domain,
            access_range: newRange,
            excluded_fields: [],
          }),
        });
      }
      setEditingCell(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新失败");
    } finally {
      setSaving(false);
    }
  }

  if (showImport) {
    return (
      <ImportWizard
        importType="access_matrix"
        onClose={() => { setShowImport(false); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono uppercase">权限矩阵</h2>
        <PixelButton onClick={() => setShowImport(true)}>
          <Upload className="w-4 h-4 mr-1 inline-block" />
          导入
        </PixelButton>
      </div>

      {/* 图例 */}
      <div className="flex gap-4 text-xs font-mono">
        {ACCESS_RANGE_OPTIONS.map((o) => (
          <span key={o.value} className="flex items-center gap-1">
            <span className={`px-2 py-0.5 border text-xs ${badgeColor(o.value)}`}>{o.label}</span>
          </span>
        ))}
      </div>

      {loading ? (
        <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>
      ) : positions.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-mono">暂无权限矩阵数据</p>
      ) : (
        <div className="overflow-auto">
          <table className="border-collapse text-xs font-mono">
            <thead>
              <tr>
                <th className="p-2 border-2 border-[#1A202C] bg-[#F0F4F8] sticky left-0 z-10 text-left">
                  岗位 / 数据域
                </th>
                {dataDomains.map((d) => (
                  <th
                    key={d}
                    className="p-2 border-2 border-[#1A202C] bg-[#F0F4F8] whitespace-nowrap text-center"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id}>
                  <td className="p-2 border-2 border-[#1A202C] bg-[#F0F4F8] font-bold whitespace-nowrap sticky left-0 z-10">
                    {pos.name}
                  </td>
                  {dataDomains.map((domain) => {
                    const rule = findRule(pos.id, domain);
                    const range = rule?.access_range ?? "none";
                    const isEditing =
                      editingCell?.positionId === pos.id && editingCell?.domain === domain;

                    return (
                      <td
                        key={domain}
                        className="p-2 border border-[#1A202C] text-center cursor-pointer hover:bg-[#F0F4F8]"
                        onClick={() => !saving && setEditingCell({ positionId: pos.id, domain })}
                      >
                        {isEditing ? (
                          <select
                            className="border-2 border-[#00D1FF] p-1 text-xs font-mono bg-white"
                            value={range}
                            autoFocus
                            onChange={(e) => handleUpdateAccess(pos.id, domain, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                          >
                            {ACCESS_RANGE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 border text-xs inline-block ${badgeColor(range)}`}>
                            {rangeLabel(range)}
                          </span>
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
