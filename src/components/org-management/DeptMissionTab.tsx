"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { DeptMissionDetail, Department } from "@/lib/types";
import { Upload, Pencil, Save, X, ArrowRight, ArrowLeft } from "lucide-react";
import ImportWizard from "./ImportWizard";

const API = "/org-management/dept-missions";

export default function DeptMissionTab() {
  const [missions, setMissions] = useState<DeptMissionDetail[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<DeptMissionDetail>>({});
  const [saving, setSaving] = useState(false);

  const deptName = useCallback(
    (id: number) => departments.find((d) => d.id === id)?.name ?? `部门#${id}`,
    [departments],
  );

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<DeptMissionDetail[]>(API).catch(() => []),
      apiFetch<Department[]>("/org-management/departments").catch(() => []),
    ]).then(([m, d]) => {
      setMissions(m);
      setDepartments(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(m: DeptMissionDetail) {
    setEditingId(m.department_id);
    setEditForm({
      mission_summary: m.mission_summary ?? "",
      core_functions: [...m.core_functions],
      upstream_deps: [...m.upstream_deps],
      downstream_deliveries: [...m.downstream_deliveries],
      owned_data_types: [...m.owned_data_types],
    });
  }

  async function handleSave(deptId: number) {
    setSaving(true);
    try {
      await apiFetch(`${API}/${deptId}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      setEditingId(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (showImport) {
    return (
      <ImportWizard
        importType="dept_mission"
        onClose={() => { setShowImport(false); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono uppercase">部门使命</h2>
        <PixelButton onClick={() => setShowImport(true)}>
          <Upload className="w-4 h-4 mr-1 inline-block" />
          导入
        </PixelButton>
      </div>

      {loading ? (
        <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>
      ) : missions.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-mono">暂无部门使命数据</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {missions.map((m) => {
            const isEditing = editingId === m.department_id;
            return (
              <div
                key={m.id}
                className="border-2 border-[#1A202C] bg-white p-4 space-y-3"
              >
                {/* 卡片头部 */}
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#00A3C4]">
                    {deptName(m.department_id)}
                  </span>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <PixelButton size="sm" onClick={() => handleSave(m.department_id)} disabled={saving}>
                        <Save className="w-3 h-3 mr-1 inline-block" />
                        {saving ? "保存中..." : "保存"}
                      </PixelButton>
                      <PixelButton size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="w-3 h-3" />
                      </PixelButton>
                    </div>
                  ) : (
                    <PixelButton size="sm" variant="ghost" onClick={() => startEdit(m)}>
                      <Pencil className="w-3 h-3" />
                    </PixelButton>
                  )}
                </div>

                {/* 使命摘要 */}
                <div>
                  <p className="text-xs font-mono text-gray-500 uppercase mb-1">使命摘要</p>
                  {isEditing ? (
                    <textarea
                      className="w-full border-2 border-[#1A202C] p-2 font-mono text-sm"
                      rows={2}
                      value={editForm.mission_summary ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, mission_summary: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{m.mission_summary || "暂无"}</p>
                  )}
                </div>

                {/* 核心职能 */}
                <div>
                  <p className="text-xs font-mono text-gray-500 uppercase mb-1">核心职能</p>
                  {m.core_functions.length === 0 ? (
                    <p className="text-sm text-gray-400">暂无</p>
                  ) : (
                    <ul className="space-y-1">
                      {m.core_functions.map((f, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-bold">{f.name}</span>
                          {f.description && (
                            <span className="text-gray-500 ml-1">— {f.description}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* 上游依赖 */}
                {m.upstream_deps.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-gray-500 uppercase mb-1">
                      <ArrowLeft className="w-3 h-3 inline-block mr-1" />
                      上游依赖
                    </p>
                    <ul className="space-y-1">
                      {m.upstream_deps.map((d, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-bold text-[#00A3C4]">{deptName(d.dept_id)}</span>
                          <span className="text-gray-500 ml-1">→ {d.what_receive}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 下游交付 */}
                {m.downstream_deliveries.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-gray-500 uppercase mb-1">
                      <ArrowRight className="w-3 h-3 inline-block mr-1" />
                      下游交付
                    </p>
                    <ul className="space-y-1">
                      {m.downstream_deliveries.map((d, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-bold text-[#00A3C4]">{deptName(d.dept_id)}</span>
                          <span className="text-gray-500 ml-1">→ {d.what_deliver}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
