"use client";

import React from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { TableDetail } from "../shared/types";

const SOURCE_LABELS: Record<string, string> = {
  lark_bitable: "飞书多维表",
  mysql: "MySQL 数据库",
  imported: "CSV/Excel 导入",
  blank: "手动创建",
};

const SYNC_COLORS: Record<string, string> = {
  idle: "bg-gray-100 text-gray-500",
  syncing: "bg-blue-50 text-blue-500",
  success: "bg-green-50 text-green-500",
  partial_success: "bg-yellow-50 text-yellow-500",
  failed: "bg-red-50 text-red-500",
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 w-20 flex-shrink-0">{label}</span>
      <div className="text-[10px] text-[#1A202C] flex-1">{children}</div>
    </div>
  );
}

interface Props {
  detail: TableDetail;
  onRefresh: () => void;
}

export default function OverviewTab({ detail, onRefresh }: Props) {
  async function triggerSync() {
    try {
      await apiFetch(`/data-assets/tables/${detail.id}/sync`, { method: "POST" });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "同步失败");
    }
  }

  const syncColor = SYNC_COLORS[detail.sync_status] || SYNC_COLORS.idle;

  return (
    <div className="p-4 space-y-4">
      {/* 风险提醒 */}
      {detail.risk_warnings.length > 0 && (
        <div className="space-y-1">
          {detail.risk_warnings.map((w) => (
            <div key={w.code} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-[9px] text-yellow-700 font-bold">
              <span>⚠</span>
              <span>{w.message}</span>
              <span className="text-[8px] text-yellow-400 font-mono ml-auto">{w.code}</span>
            </div>
          ))}
        </div>
      )}

      {/* 基本信息 */}
      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">基本信息</div>
        <InfoRow label="来源">{SOURCE_LABELS[detail.source_type] || detail.source_type}</InfoRow>
        <InfoRow label="记录数">{detail.record_count ?? "未统计"}</InfoRow>
        <InfoRow label="字段数">{detail.fields.length}</InfoRow>
        <InfoRow label="视图数">{detail.views.length}</InfoRow>
        <InfoRow label="Skill 绑定">{detail.bindings.length}</InfoRow>
        <InfoRow label="创建时间">{detail.created_at ? new Date(detail.created_at).toLocaleString("zh-CN") : "-"}</InfoRow>
      </div>

      {/* 同步状态 */}
      {detail.source_type !== "blank" && (
        <div className="border-2 border-[#1A202C] p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">同步状态</div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${syncColor}`}>
              {detail.sync_status}
            </span>
          </div>
          {detail.sync_error && (
            <div className="text-[9px] text-red-500 mb-2 bg-red-50 px-2 py-1 border border-red-200">{detail.sync_error}</div>
          )}
          <InfoRow label="上次同步">{detail.last_synced_at ? new Date(detail.last_synced_at).toLocaleString("zh-CN") : "从未同步"}</InfoRow>
          {detail.source_type === "lark_bitable" && detail.source_ref.app_token && (
            <InfoRow label="飞书表">
              <span className="font-mono text-[9px]">{detail.source_ref.app_token} / {detail.source_ref.table_id}</span>
            </InfoRow>
          )}
          <div className="mt-2">
            <PixelButton size="sm" onClick={triggerSync} variant="secondary">
              {detail.sync_status === "syncing" ? "同步中..." : "立即同步"}
            </PixelButton>
          </div>
        </div>
      )}

      {/* 字段画像状态 */}
      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">字段画像</div>
        <InfoRow label="状态">
          <span className={detail.field_profile_status === "ready" ? "text-green-500" : detail.field_profile_status === "failed" ? "text-red-500" : "text-yellow-500"}>
            {detail.field_profile_status === "ready" ? "已完成" : detail.field_profile_status === "failed" ? "失败" : "待分析"}
          </span>
        </InfoRow>
        {detail.field_profile_error && (
          <div className="text-[9px] text-red-500 mt-1">{detail.field_profile_error}</div>
        )}
      </div>

      {/* 最近同步记录 */}
      {detail.recent_sync_jobs.length > 0 && (
        <div className="border-2 border-[#1A202C] p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">最近同步记录</div>
          <div className="space-y-1">
            {detail.recent_sync_jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-3 text-[9px] py-1 border-b border-gray-100 last:border-0">
                <span className={`font-bold ${job.status === "success" ? "text-green-500" : job.status === "failed" ? "text-red-500" : "text-gray-400"}`}>
                  {job.status}
                </span>
                <span className="text-gray-400">{job.job_type}</span>
                <span className="text-gray-400">{job.trigger_source}</span>
                <span className="text-gray-400 ml-auto font-mono">
                  {job.started_at ? new Date(job.started_at).toLocaleString("zh-CN") : "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
