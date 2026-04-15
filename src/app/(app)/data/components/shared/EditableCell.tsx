"use client";

import React, { useEffect, useRef, useState } from "react";
import { formatCellValue } from "./CellFormatters";
import type { FieldMeta } from "./types";
import {
  normalizeCellValueForField,
  normalizeFieldType,
  normalizeOptionValues,
  serializeCellValueForField,
} from "./value-normalization";

export default function EditableCell({
  value,
  fieldMeta,
  onSave,
  readOnly,
}: {
  value: unknown;
  fieldMeta?: FieldMeta;
  onSave: (v: unknown) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState<{ source: unknown; value: unknown }>({
    source: value,
    value: normalizeCellValueForField(value, fieldMeta),
  });
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const fieldType = normalizeFieldType(fieldMeta?.field_type);

  // Reset edit value when the prop changes (instead of setState in effect)
  if (editVal.source !== value) {
    setEditVal({
      source: value,
      value: normalizeCellValueForField(value, fieldMeta),
    });
  }
  const val = editVal.value;
  const setVal = (next: unknown) => setEditVal({ source: value, value: next });

  useEffect(() => { if (editing) (inputRef.current as HTMLElement | null)?.focus(); }, [editing]);

  if (readOnly) {
    return (
      <span className="text-gray-700 font-mono">
        {value === null || value === undefined ? <span className="text-gray-300">NULL</span> : formatCellValue(value)}
      </span>
    );
  }

  if (!editing) {
    return (
      <span
        className="text-gray-700 font-mono cursor-text hover:bg-[#F0F8FF] px-0.5 rounded min-w-[20px] inline-block"
        onDoubleClick={() => { setVal(normalizeCellValueForField(value, fieldMeta)); setEditing(true); }}
        title="双击编辑"
      >
        {value === null || value === undefined ? <span className="text-gray-200">—</span> : formatCellValue(value)}
      </span>
    );
  }

  function commit() {
    setEditing(false);
    const nextValue = serializeCellValueForField(val, fieldMeta);
    const currentValue = serializeCellValueForField(value, fieldMeta);
    if (JSON.stringify(nextValue) !== JSON.stringify(currentValue)) onSave(nextValue);
  }

  if (fieldType === "single_select" && fieldMeta?.options?.length) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={String(val ?? "")}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        className="border border-[#00D1FF] text-[9px] px-1 py-0.5 bg-white focus:outline-none"
      >
        <option value="">—</option>
        {fieldMeta.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (fieldType === "multi_select" && fieldMeta?.options?.length) {
    const selected = normalizeOptionValues(val);
    return (
      <div className="border border-[#00D1FF] bg-white p-1 min-w-[120px]">
        <div className="max-h-28 overflow-y-auto space-y-0.5">
          {fieldMeta.options.map((option) => {
            const checked = selected.includes(option);
            return (
              <label key={option} className="flex items-center gap-1 text-[8px] text-gray-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selected.filter((item) => item !== option)
                      : [...selected, option];
                    setVal(next);
                  }}
                  className="w-3 h-3"
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <button onClick={commit} className="text-[8px] font-bold text-[#00A3C4]">保存</button>
          <button onClick={() => setEditing(false)} className="text-[8px] text-gray-400">取消</button>
        </div>
      </div>
    );
  }

  if (fieldType === "boolean") {
    return (
      <input
        type="checkbox"
        checked={Boolean(val)}
        onChange={(e) => { const next = e.target.checked; setVal(next); onSave(serializeCellValueForField(next, fieldMeta)); setEditing(false); }}
        className="w-3 h-3"
      />
    );
  }

  if (fieldType === "date") {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="datetime-local"
        value={String(val ?? "").slice(0, 16)}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        className="border border-[#00D1FF] text-[9px] px-1 py-0.5 focus:outline-none"
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={fieldType === "number" ? "number" : "text"}
      value={String(val ?? "")}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      className="border border-[#00D1FF] text-[9px] px-1 py-0.5 min-w-[60px] max-w-[200px] focus:outline-none bg-white"
    />
  );
}
