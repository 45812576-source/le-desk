"use client";

import React, { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import { FieldType, FIELD_TYPE_LABELS, FIELD_TYPE_OPTIONS } from "../shared/types";

export default function AddColumnModal({ tableId, onDone, onClose }: { tableId: number; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<FieldType>("text");
  const [options, setOptions] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!name.trim()) { setError("字段名不能为空"); return; }
    setSaving(true); setError("");
    try {
      await apiFetch(`/business-tables/${tableId}/columns`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          field_type: fieldType,
          options: options.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      onDone();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white border-2 border-[#1A202C] w-80 p-4 space-y-3">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">新增列</div>
        <div>
          <label className="block text-[9px] font-bold text-gray-500 mb-1">字段名称 *</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-[#00D1FF]"
            placeholder="例：备注" autoFocus />
        </div>
        <div>
          <label className="block text-[9px] font-bold text-gray-500 mb-1">类型</label>
          <select value={fieldType} onChange={(e) => setFieldType(e.target.value as FieldType)}
            className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[10px] bg-white focus:outline-none">
            {FIELD_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        {(fieldType === "select" || fieldType === "single_select" || fieldType === "multi_select") && (
          <div>
            <label className="block text-[9px] font-bold text-gray-500 mb-1">选项（逗号分隔）</label>
            <input value={options} onChange={(e) => setOptions(e.target.value)}
              placeholder="选项1,选项2,选项3"
              className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[11px] focus:outline-none focus:border-[#00D1FF]" />
          </div>
        )}
        {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}
        <div className="flex gap-2 pt-1">
          <PixelButton onClick={handleAdd} disabled={saving}>{saving ? "添加中..." : "✓ 添加"}</PixelButton>
          <PixelButton variant="secondary" onClick={onClose}>取消</PixelButton>
        </div>
      </div>
    </div>
  );
}
