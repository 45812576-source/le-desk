"use client";

import React, { useEffect, useRef, useState } from "react";
import { formatCellValue } from "./CellFormatters";
import type { FieldMeta } from "./types";

export default function EditableCell({
  value,
  fieldMeta,
  onSave,
  readOnly,
}: {
  value: unknown;
  fieldMeta?: FieldMeta;
  onSave: (v: string) => void;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState<{ source: unknown; text: string }>({ source: value, text: formatCellValue(value) });
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  // Reset edit value when the prop changes (instead of setState in effect)
  if (editVal.source !== value) {
    setEditVal({ source: value, text: formatCellValue(value) });
  }
  const val = editVal.text;
  const setVal = (text: string) => setEditVal({ source: value, text });

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
        onDoubleClick={() => { setVal(formatCellValue(value)); setEditing(true); }}
        title="双击编辑"
      >
        {value === null || value === undefined ? <span className="text-gray-200">—</span> : formatCellValue(value)}
      </span>
    );
  }

  function commit() {
    setEditing(false);
    if (val !== formatCellValue(value)) onSave(val);
  }

  const ft = fieldMeta?.field_type;

  if (ft === "select" && fieldMeta?.options?.length) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        className="border border-[#00D1FF] text-[9px] px-1 py-0.5 bg-white focus:outline-none"
      >
        <option value="">—</option>
        {fieldMeta.options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  if (ft === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={val === "1" || val === "true"}
        onChange={(e) => { const v = e.target.checked ? "1" : "0"; setVal(v); onSave(v); setEditing(false); }}
        className="w-3 h-3"
      />
    );
  }

  if (ft === "date") {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="datetime-local"
        value={val.slice(0, 16)}
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
      type={ft === "number" ? "number" : "text"}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      className="border border-[#00D1FF] text-[9px] px-1 py-0.5 min-w-[60px] max-w-[200px] focus:outline-none bg-white"
    />
  );
}
