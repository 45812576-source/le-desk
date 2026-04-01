"use client";

import React from "react";
import type { SourceProfile } from "../../shared/types";

interface Props {
  profile: SourceProfile;
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  healthy: { label: "健康", color: "bg-green-50 text-green-600" },
  degraded: { label: "降级", color: "bg-yellow-50 text-yellow-600" },
  failed: { label: "故障", color: "bg-red-50 text-red-600" },
};

const CAPABILITY_LABELS: Record<string, string> = {
  filter_pushdown: "筛选下推",
  sort_pushdown: "排序下推",
  limit_pushdown: "分页下推",
  aggregation_pushdown: "聚合下推",
  incremental_sync: "增量同步",
  schema_detection: "Schema 探测",
};

export default function SourceProfilePanel({ profile }: Props) {
  const status = STATUS_STYLES[profile.connection_status] || STATUS_STYLES.healthy;
  const capabilities = profile.metadata?.capabilities as Record<string, boolean> | undefined;
  const pushdownRatio = profile.metadata?.pushdown_ratio as number | undefined;

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">数据源画像</div>
        <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded ${status.color}`}>{status.label}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-[9px] mb-3">
        <div>
          <span className="text-[7px] text-gray-400 uppercase block">源类型</span>
          <span className="font-bold">{profile.source_type}</span>
        </div>
        <div>
          <span className="text-[7px] text-gray-400 uppercase block">延迟</span>
          <span className="font-bold">{profile.latency_ms !== null ? `${profile.latency_ms}ms` : "-"}</span>
        </div>
        <div>
          <span className="text-[7px] text-gray-400 uppercase block">错误率</span>
          <span className={`font-bold ${profile.error_rate > 0.1 ? "text-red-500" : profile.error_rate > 0.01 ? "text-yellow-500" : "text-green-500"}`}>
            {(profile.error_rate * 100).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* 能力矩阵 */}
      {capabilities && Object.keys(capabilities).length > 0 && (
        <div className="mb-3">
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">能力矩阵</div>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(CAPABILITY_LABELS).map(([key, label]) => {
              const supported = capabilities[key];
              if (supported === undefined) return null;
              return (
                <div key={key} className="flex items-center gap-1 text-[8px]">
                  <span className={supported ? "text-green-500" : "text-gray-300"}>
                    {supported ? "●" : "○"}
                  </span>
                  <span className={supported ? "text-[#1A202C]" : "text-gray-400"}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 下推比例 */}
      {pushdownRatio !== undefined && (
        <div className="mb-2">
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">查询下推比例</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-[#00D1FF] rounded transition-all"
                style={{ width: `${pushdownRatio * 100}%` }}
              />
            </div>
            <span className="text-[8px] font-bold">{(pushdownRatio * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* 上次检查时间 */}
      {profile.last_check_at && (
        <div className="text-[8px] text-gray-400 mt-1">
          上次检查: {new Date(profile.last_check_at).toLocaleString("zh-CN")}
        </div>
      )}
    </div>
  );
}
