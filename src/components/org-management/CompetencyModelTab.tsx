"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { PositionCompetencyModel } from "@/lib/types";
import { Pencil, Save, X } from "lucide-react";

const API = "/org-management/competency-models";

export default function CompetencyModelTab() {
  const [models, setModels] = useState<PositionCompetencyModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editJson, setEditJson] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<PositionCompetencyModel[]>(API)
      .then(setModels)
      .catch(() => setModels([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(model: PositionCompetencyModel) {
    setEditingId(model.position_id);
    const { responsibilities, competencies, output_standards, career_path } = model;
    setEditJson(JSON.stringify({ responsibilities, competencies, output_standards, career_path }, null, 2));
  }

  async function handleSave(positionId: number) {
    setSaving(true);
    try {
      const parsed = JSON.parse(editJson);
      await apiFetch(`${API}/${positionId}`, {
        method: "PUT",
        body: JSON.stringify(parsed),
      });
      setEditingId(null);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>;
  }

  if (models.length === 0) {
    return <p className="text-center py-8 text-gray-500 font-mono">暂无岗位能力模型</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold font-mono uppercase">岗位能力模型</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map((m) => (
          <div key={m.id} className="border-2 border-[#1A202C] bg-white p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-[#1A202C] pb-2">
              <span className="font-mono font-bold text-sm">岗位 #{m.position_id}</span>
              {editingId === m.position_id ? (
                <div className="flex gap-1">
                  <PixelButton onClick={() => handleSave(m.position_id)} disabled={saving}>
                    <Save className="w-3 h-3 mr-1 inline-block" />
                    {saving ? "保存中..." : "保存"}
                  </PixelButton>
                  <PixelButton variant="ghost" onClick={() => setEditingId(null)}>
                    <X className="w-3 h-3 mr-1 inline-block" />
                    取消
                  </PixelButton>
                </div>
              ) : (
                <PixelButton variant="secondary" onClick={() => startEdit(m)}>
                  <Pencil className="w-3 h-3 mr-1 inline-block" />
                  编辑
                </PixelButton>
              )}
            </div>

            {editingId === m.position_id ? (
              <textarea
                className="w-full border-2 border-[#1A202C] p-2 font-mono text-xs"
                rows={16}
                value={editJson}
                onChange={(e) => setEditJson(e.target.value)}
              />
            ) : (
              <>
                {/* 职责 */}
                {m.responsibilities.length > 0 && (
                  <div>
                    <p className="font-mono text-xs font-bold uppercase text-gray-500 mb-1">职责</p>
                    <ul className="list-disc list-inside text-sm font-mono space-y-0.5">
                      {m.responsibilities.map((r, i) => (
                        <li key={i}>
                          <span className="font-bold">{r.name}</span>
                          {r.description && <span className="text-gray-500"> — {r.description}</span>}
                          {r.priority && <PixelBadge color="cyan">{r.priority}</PixelBadge>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 能力 */}
                {m.competencies.length > 0 && (
                  <div>
                    <p className="font-mono text-xs font-bold uppercase text-gray-500 mb-1">能力要求</p>
                    <div className="flex flex-wrap gap-2">
                      {m.competencies.map((c, i) => (
                        <div key={i} className="flex items-center gap-1 text-sm font-mono">
                          <span>{c.name}</span>
                          <PixelBadge color="purple">{c.level_required}</PixelBadge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 产出标准 */}
                {m.output_standards.length > 0 && (
                  <div>
                    <p className="font-mono text-xs font-bold uppercase text-gray-500 mb-1">产出标准</p>
                    <ul className="list-disc list-inside text-sm font-mono space-y-0.5">
                      {m.output_standards.map((o, i) => (
                        <li key={i}>
                          <span className="font-bold">{o.deliverable}</span>
                          <span className="text-gray-500"> — {o.quality_criteria}</span>
                          {o.frequency && <PixelBadge color="green">{o.frequency}</PixelBadge>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
