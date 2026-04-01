"use client";

import React, { useState, useEffect } from "react";
import type { DashboardStats } from "./shared/types";
import { fetchDashboardStats } from "./shared/api";

const KPI_ITEMS: { key: keyof DashboardStats; label: string; color: string; icon: string }[] = [
  { key: "unfiled_count", label: "未归档", color: "text-orange-500", icon: "📭" },
  { key: "high_risk_count", label: "高风险", color: "text-red-500", icon: "🔴" },
  { key: "pending_approval_count", label: "待审批", color: "text-yellow-600", icon: "⏳" },
  { key: "sync_failed_count", label: "同步失败", color: "text-red-400", icon: "⚡" },
];

export default function DashboardKpi() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) return null;

  // 全部为 0 时不显示
  const hasAny = Object.values(stats).some((v) => v > 0);
  if (!hasAny) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-1.5 border-b border-gray-200 bg-[#F8FBFD]">
      {KPI_ITEMS.map((item) => {
        const val = stats[item.key];
        if (val === 0) return null;
        return (
          <div key={item.key} className="flex items-center gap-1.5">
            <span className="text-[10px]">{item.icon}</span>
            <span className={`text-[11px] font-bold ${item.color}`}>{val}</span>
            <span className="text-[8px] text-gray-400">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
