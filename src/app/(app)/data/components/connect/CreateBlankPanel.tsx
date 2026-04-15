"use client";

import React, { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import { FieldMeta, FieldType, FIELD_TYPE_LABELS, FIELD_TYPE_OPTIONS } from "../shared/types";

function CreateBlankPanel({ onAdded }: { onAdded: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldMeta[]>([
    { name: "名称", field_type: "text", options: [], nullable: true, comment: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addField() {
    setFields((prev) => [...prev, { name: "", field_type: "text", options: [], nullable: true, comment: "" }]);
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateField(i: number, patch: Partial<FieldMeta>) {
    setFields((prev) => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }

  async function handleCreate() {
    if (!displayName.trim()) { setError("请填写表名称"); return; }
    const invalid = fields.find((f) => !f.name.trim());
    if (invalid !== undefined) { setError("字段名称不能为空"); return; }
    setError(""); setSaving(true);
    try {
      await apiFetch("/business-tables/create-blank", {
        method: "POST",
        body: JSON.stringify({ display_name: displayName.trim(), description: description.trim(), fields }),
      });
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="border-2 border-[#1A202C] bg-white">
        <div className="px-4 py-2.5 bg-[#EBF4F7] border-b-2 border-[#1A202C]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— 新建空白表</span>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">表名称 *</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例：客户线索表"
              className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] focus:outline-none focus:border-[#00D1FF]"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">描述（可选）</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这张表用来记录..."
              className="w-full border-2 border-[#1A202C] px-3 py-2 text-[11px] focus:outline-none focus:border-[#00D1FF]"
            />
          </div>

          {/* Field designer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">字段定义</span>
              <button
                onClick={addField}
                className="text-[9px] font-bold px-2 py-0.5 border-2 border-[#1A202C] bg-white hover:bg-[#1A202C] hover:text-white transition-colors"
              >
                + 添加字段
              </button>
            </div>
            {/* System fields hint */}
            <div className="flex gap-1 flex-wrap mb-2">
              {["id (自增主键)", "created_at (创建时间)", "updated_at (更新时间)"].map((f) => (
                <span key={f} className="text-[8px] text-gray-400 border border-gray-200 px-1.5 py-0.5 bg-gray-50">{f}</span>
              ))}
            </div>
            <div className="space-y-1.5">
              {fields.map((f, i) => (
                <div key={i} className="flex items-center gap-2 border border-gray-200 p-2 bg-white">
                  <input
                    value={f.name}
                    onChange={(e) => updateField(i, { name: e.target.value })}
                    placeholder="字段名称"
                    className="flex-1 border-2 border-gray-200 px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-[#00D1FF]"
                  />
                  <select
                    value={f.field_type}
                    onChange={(e) => updateField(i, { field_type: e.target.value as FieldType })}
                    className="border-2 border-gray-200 px-2 py-1 text-[10px] focus:outline-none focus:border-[#00D1FF] bg-white"
                  >
                    {FIELD_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                  {(f.field_type === "select" || f.field_type === "single_select" || f.field_type === "multi_select") && (
                    <input
                      value={f.options.join(",")}
                      onChange={(e) => updateField(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="选项1,选项2"
                      className="w-28 border-2 border-gray-200 px-2 py-1 text-[10px] focus:outline-none focus:border-[#00D1FF]"
                    />
                  )}
                  <button
                    onClick={() => removeField(i)}
                    className="text-[10px] text-gray-300 hover:text-red-400 px-1"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
          <PixelButton onClick={handleCreate} disabled={saving}>
            {saving ? "创建中..." : "✓ 创建数据表"}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

export default CreateBlankPanel;
