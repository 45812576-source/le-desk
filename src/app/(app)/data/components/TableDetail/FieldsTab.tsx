"use client";

import React from "react";
import type { TableDetail, TableFieldDetail } from "../shared/types";

const TYPE_COLORS: Record<string, string> = {
  text: "bg-gray-50 text-gray-500",
  number: "bg-blue-50 text-blue-500",
  single_select: "bg-purple-50 text-purple-600",
  multi_select: "bg-purple-50 text-purple-500",
  date: "bg-orange-50 text-orange-500",
  datetime: "bg-orange-50 text-orange-500",
  boolean: "bg-green-50 text-green-600",
  person: "bg-cyan-50 text-cyan-600",
  url: "bg-indigo-50 text-indigo-500",
  email: "bg-indigo-50 text-indigo-500",
  phone: "bg-teal-50 text-teal-500",
  json: "bg-yellow-50 text-yellow-600",
  attachment: "bg-pink-50 text-pink-500",
};

function FieldRow({ field }: { field: TableFieldDetail }) {
  const typeColor = TYPE_COLORS[field.field_type] || TYPE_COLORS.text;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 hover:bg-[#F0FBFF] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold">{field.display_name || field.field_name}</span>
          {field.is_system && (
            <span className="text-[7px] font-bold px-1 py-px bg-gray-100 text-gray-400 rounded">SYS</span>
          )}
        </div>
        {field.display_name && field.display_name !== field.field_name && (
          <span className="text-[8px] font-mono text-gray-400">{field.field_name}</span>
        )}
        {field.description && (
          <p className="text-[8px] text-gray-400 mt-0.5 truncate">{field.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${typeColor}`}>{field.field_type}</span>
        {field.enum_values.length > 0 && (
          <span className="text-[8px] text-purple-500" title={field.enum_values.join(", ")}>
            {field.enum_values.length} 选项
            {field.enum_source === "observed" && <span className="text-[7px] text-gray-400 ml-0.5">(推断)</span>}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {field.is_filterable && <span className="text-[7px] px-1 py-px bg-blue-50 text-blue-400 rounded" title="可筛选">F</span>}
        {field.is_groupable && <span className="text-[7px] px-1 py-px bg-green-50 text-green-400 rounded" title="可分组">G</span>}
        {field.is_sortable && <span className="text-[7px] px-1 py-px bg-orange-50 text-orange-400 rounded" title="可排序">S</span>}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0 text-[8px] text-gray-400 w-32 justify-end">
        {field.distinct_count !== null && (
          <span title="唯一值数">{field.distinct_count} 种</span>
        )}
        {field.null_ratio !== null && (
          <span title="空值率">{(field.null_ratio * 100).toFixed(1)}% null</span>
        )}
      </div>
    </div>
  );
}

interface Props {
  detail: TableDetail;
}

export default function FieldsTab({ detail }: Props) {
  if (detail.fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[10px] text-gray-400 uppercase tracking-widest">
        {detail.field_profile_status === "pending" ? "字段画像待分析" : "暂无字段信息"}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 px-4 py-2 border-b-2 border-[#1A202C] bg-[#EBF4F7] text-[8px] font-bold uppercase tracking-widest text-gray-400">
        <span className="flex-1">字段</span>
        <span className="w-20">类型</span>
        <span className="w-12">能力</span>
        <span className="w-32 text-right">统计</span>
      </div>
      {detail.fields.map((f) => (
        <FieldRow key={f.id ?? f.field_name} field={f} />
      ))}
    </div>
  );
}
