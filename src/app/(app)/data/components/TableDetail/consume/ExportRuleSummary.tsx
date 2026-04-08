"use client";

import React, { useState, useEffect } from "react";
import type { ExportRule } from "../../shared/types";
import { fetchExportRules } from "../../shared/api";

interface Props {
  tableId: number;
}

const FORMAT_LABELS: Record<string, string> = {
  csv: "CSV",
  excel: "Excel",
  json: "JSON",
};

export default function ExportRuleSummary({ tableId }: Props) {
  const [rules, setRules] = useState<ExportRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchExportRules(tableId);
        if (!cancelled) setRules(data);
      } catch {
        if (!cancelled) setRules([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [tableId]);

  if (loading) {
    return <div className="p-4 text-[9px] text-gray-400 animate-pulse">加载导出规则...</div>;
  }

  if (rules.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[10px] text-gray-400 uppercase tracking-widest">
        暂无导出规则
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center px-4 py-2 border-b-2 border-[#1A202C] bg-[#EBF4F7]">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
          导出规则 ({rules.length})
        </span>
        <span className="text-[7px] text-gray-400 ml-2">只读摘要 · 编辑请前往安全治理</span>
      </div>
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-bold">{rule.role_group_name}</div>
            <div className="flex items-center gap-2 mt-0.5 text-[8px] text-gray-400">
              <span>格式: {rule.allowed_formats.map((f) => FORMAT_LABELS[f] || f).join(", ")}</span>
              {rule.max_rows !== null && <span>· 上限 {rule.max_rows} 行</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {rule.requires_approval && (
              <span className="text-[7px] font-bold px-1 py-px bg-orange-50 text-orange-500 rounded">需审批</span>
            )}
            {rule.watermark && (
              <span className="text-[7px] font-bold px-1 py-px bg-blue-50 text-blue-500 rounded">水印</span>
            )}
            {rule.strip_sensitive && (
              <span className="text-[7px] font-bold px-1 py-px bg-red-50 text-red-500 rounded">剥离敏感</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
