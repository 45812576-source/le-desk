"use client";

import React, { useState, useEffect } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch, ApiError } from "@/lib/api";
import type { TableViewDetail } from "../../shared/types";

interface SkillItem {
  id: number;
  name: string;
}

interface Props {
  tableId: number;
  views: TableViewDetail[];
  onCreated: () => void;
  onCancel: () => void;
}

export default function SkillBindingCreator({ tableId, views, onCreated, onCancel }: Props) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchSkills() {
      try {
        const data = await apiFetch<SkillItem[]>("/skills");
        if (!cancelled) setSkills(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSkills([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSkills();
    return () => { cancelled = true; };
  }, []);

  async function handleCreate() {
    if (!selectedSkillId) return;
    setSaving(true);
    setError("");
    try {
      await apiFetch(`/data-assets/tables/${tableId}/bindings`, {
        method: "POST",
        body: JSON.stringify({
          skill_id: selectedSkillId,
          view_id: selectedViewId,
        }),
      });
      onCreated();
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "绑定失败");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-3 border-2 border-[#00D1FF] bg-[#F0FBFF] text-[9px] text-gray-400">
        加载 Skill 列表...
      </div>
    );
  }

  return (
    <div className="p-3 border-2 border-[#00D1FF] bg-[#F0FBFF] space-y-2">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">绑定新 Skill</div>

      <div>
        <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-1">选择 Skill</label>
        <select
          value={selectedSkillId ?? ""}
          onChange={(e) => setSelectedSkillId(e.target.value ? Number(e.target.value) : null)}
          className="w-full text-[9px] border border-gray-300 px-1.5 py-1 bg-white"
        >
          <option value="">请选择...</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {views.length > 0 && (
        <div>
          <label className="text-[8px] text-gray-400 font-bold uppercase tracking-widest block mb-1">绑定视图（可选）</label>
          <select
            value={selectedViewId ?? ""}
            onChange={(e) => setSelectedViewId(e.target.value ? Number(e.target.value) : null)}
            className="w-full text-[9px] border border-gray-300 px-1.5 py-1 bg-white"
          >
            <option value="">不绑定视图</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="text-[8px] text-red-500 bg-red-50 px-2 py-1 border border-red-200">{error}</div>
      )}

      <div className="flex items-center gap-2">
        <PixelButton size="sm" onClick={handleCreate} disabled={!selectedSkillId || saving}>
          {saving ? "绑定中..." : "确认绑定"}
        </PixelButton>
        <button onClick={onCancel} className="text-[8px] text-gray-400 hover:text-[#1A202C]">取消</button>
      </div>
    </div>
  );
}
