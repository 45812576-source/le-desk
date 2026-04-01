"use client";

import React from "react";
import type { SourceProfile } from "../../shared/types";

interface Props {
  profile: SourceProfile | null;
}

/** C2 降级告警条 — 数据源不健康时顶部显示 */
export default function DegradationAlert({ profile }: Props) {
  if (!profile || profile.connection_status === "healthy") return null;

  const isFailed = profile.connection_status === "failed";

  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-[9px] font-bold ${
      isFailed
        ? "bg-red-50 border border-red-200 text-red-700"
        : "bg-yellow-50 border border-yellow-200 text-yellow-700"
    }`}>
      <span>{isFailed ? "✕" : "⚠"}</span>
      <span>
        {isFailed
          ? `数据源连接失败 — ${profile.source_type} 不可用，数据可能不是最新`
          : `数据源降级 — ${profile.source_type} 响应延迟 ${profile.latency_ms ?? "未知"}ms，错误率 ${(profile.error_rate * 100).toFixed(1)}%`
        }
      </span>
      {profile.last_check_at && (
        <span className="text-[8px] opacity-60 ml-auto">
          检查于 {new Date(profile.last_check_at).toLocaleString("zh-CN")}
        </span>
      )}
    </div>
  );
}
