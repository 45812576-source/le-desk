"use client";

import React from "react";
import type { TableDetail } from "../shared/types";

interface Props {
  detail: TableDetail;
}

export default function HeaderBar({ detail }: Props) {
  const usageCount = new Set([
    ...detail.bindings.map((binding) => binding.skill_id),
    ...detail.skill_grants.map((grant) => grant.skill_id),
  ]).size;

  const syncStatusLabel = (() => {
    switch (detail.sync_status) {
      case "ok":
      case "success":
        return "已同步";
      case "syncing":
        return "同步中";
      case "failed":
        return "同步失败";
      default:
        return detail.sync_status || "未同步";
    }
  })();

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
        <span>{usageCount} 关联 Skill</span>
        <span>{syncStatusLabel}</span>
        {detail.last_synced_at && (
          <span>更新于 {new Date(detail.last_synced_at).toLocaleString("zh-CN")}</span>
        )}
        {detail.sync_error && (
          <span className="text-red-500">有异常</span>
        )}
      </div>
    </div>
  );
}
