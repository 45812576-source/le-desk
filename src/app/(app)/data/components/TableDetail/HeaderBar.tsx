"use client";

import React from "react";
import type { TableDetail, TableDetailV2 } from "../shared/types";
import { RISK_LEVEL_LABELS, RISK_LEVEL_COLORS } from "../shared/types";

interface Props {
  detail: TableDetail;
}

export default function HeaderBar({ detail }: Props) {
  const v2 = detail as TableDetailV2;
  const riskLevel = v2.risk_assessment?.overall_level;
  const sensitiveCount = detail.fields.filter((f) => f.is_sensitive).length;

  return (
    <div className="px-4 py-2 border-b-2 border-[#1A202C] flex-shrink-0">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-bold truncate flex-1">{detail.display_name}</h2>
        {detail.publish_status === "published" ? (
          <span className="text-[7px] font-bold px-1.5 py-0.5 bg-green-50 text-green-600 border border-green-200 rounded">已发布</span>
        ) : (
          <span className="text-[7px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded">草稿</span>
        )}
        <span className="text-[8px] font-mono text-gray-400">{detail.table_name}</span>
      </div>
      {detail.description && (
        <p className="text-[9px] text-gray-500 truncate mb-1.5">{detail.description}</p>
      )}
      {/* 总览条 */}
      <div className="flex items-center gap-3 text-[8px] text-gray-400">
        <span>{detail.fields.length} 字段</span>
        {detail.record_count !== null && <span>{detail.record_count} 行</span>}
        <span>{detail.views.length} 视图</span>
        <span>{detail.bindings.length} Skill</span>
        <span>{detail.role_groups?.length || 0} 角色组</span>
        {sensitiveCount > 0 && (
          <span className="text-orange-500">{sensitiveCount} 敏感字段</span>
        )}
        {riskLevel && (
          <span className={`font-bold px-1.5 py-px rounded ${RISK_LEVEL_COLORS[riskLevel]}`}>
            {RISK_LEVEL_LABELS[riskLevel]}
          </span>
        )}
        {detail.risk_warnings.length > 0 && (
          <span className="text-yellow-500">{detail.risk_warnings.length} 警告</span>
        )}
      </div>
    </div>
  );
}
