"use client";

import React, { useState, useEffect } from "react";
import type { DashboardStats } from "./shared/types";
import { fetchDashboardStats } from "./shared/api";

export default function RiskSummaryPanel() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-gray-400 animate-pulse">
        加载风险摘要...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full text-[10px] text-gray-400 uppercase tracking-widest">
        无法加载风险摘要
      </div>
    );
  }

  const items = [
    { label: "未归档数据表", value: stats.unfiled_count, color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
    { label: "高风险数据表", value: stats.high_risk_count, color: "text-red-500", bg: "bg-red-50 border-red-200" },
    { label: "待审批请求", value: stats.pending_approval_count, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200" },
    { label: "同步失败", value: stats.sync_failed_count, color: "text-red-400", bg: "bg-red-50 border-red-200" },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-4">全局风险摘要</div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {items.map((item) => (
          <div key={item.label} className={`border p-3 text-center ${item.bg}`}>
            <div className={`text-[24px] font-bold ${item.color}`}>{item.value}</div>
            <div className="text-[8px] text-gray-500 font-bold uppercase mt-1">{item.label}</div>
          </div>
        ))}
      </div>
      <p className="text-[8px] text-gray-400 mt-4">选择左侧数据表查看详情</p>
    </div>
  );
}
