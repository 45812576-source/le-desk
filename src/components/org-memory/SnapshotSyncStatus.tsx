"use client";

import type {
  SnapshotTabKey,
  WorkspaceSnapshotAggregateSyncStatus,
  WorkspaceSnapshotTabSyncResult,
} from "@/lib/types";
import { SNAPSHOT_TAB_LABELS } from "@/lib/types";

export default function SnapshotSyncStatus({
  syncStatus,
  tabSyncStatus,
}: {
  syncStatus: WorkspaceSnapshotAggregateSyncStatus | null;
  tabSyncStatus?: Partial<Record<SnapshotTabKey, WorkspaceSnapshotTabSyncResult>>;
}) {
  const tabEntries = Object.entries(tabSyncStatus || {}) as [SnapshotTabKey, WorkspaceSnapshotTabSyncResult][];
  const failedSections = syncStatus?.failed_sections ?? [];
  const parserWarnings = syncStatus?.parser_warnings ?? [];

  if (!syncStatus && tabEntries.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-foreground">同步状态</div>

      {syncStatus && (
        <div className="flex flex-wrap gap-2">
          <StatusBadge
            tone={syncStatus.markdown_saved ? "success" : "neutral"}
            label={syncStatus.markdown_saved ? "Markdown 已保存" : "尚未保存"}
          />
          <StatusBadge
            tone={syncStatus.structured_updated ? "success" : failedSections.length > 0 ? "warning" : "neutral"}
            label={syncStatus.structured_updated ? "结构化已更新" : "结构化待同步"}
          />
          {failedSections.length > 0 && (
            <StatusBadge tone="danger" label={`失败段落 ${failedSections.length}`} />
          )}
          {parserWarnings.length > 0 && (
            <StatusBadge tone="warning" label={`解析告警 ${parserWarnings.length}`} />
          )}
        </div>
      )}

      {tabEntries.length > 0 && (
        <div className="space-y-2">
          {tabEntries.map(([key, result]) => (
            <div key={key} className="flex items-center justify-between rounded border border-border/70 px-3 py-2">
              <span className="text-xs text-foreground">{SNAPSHOT_TAB_LABELS[key]}</span>
              <StatusBadge
                tone={
                  result.status === "synced"
                    ? "success"
                    : result.status === "partial_sync"
                      ? "warning"
                      : "danger"
                }
                label={
                  result.status === "synced"
                    ? "已同步"
                    : result.status === "partial_sync"
                      ? "部分同步"
                      : "失败"
                }
              />
            </div>
          ))}
        </div>
      )}

      {failedSections.length > 0 && (
        <div className="space-y-2">
          {failedSections.map((item, index) => (
            <div key={`${item.section}-${index}`} className="rounded border border-red-200 bg-red-50 px-3 py-2">
              <div className="text-[11px] font-medium text-red-800">{item.section}</div>
              <div className="mt-1 text-[11px] text-red-700">{item.reason}</div>
            </div>
          ))}
        </div>
      )}

      {parserWarnings.length > 0 && (
        <div className="space-y-2">
          {parserWarnings.map((warning, index) => (
            <div key={`${warning}-${index}`} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              {warning}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
}) {
  const classes = tone === "success"
    ? "bg-green-100 text-green-700"
    : tone === "warning"
      ? "bg-amber-100 text-amber-700"
      : tone === "danger"
        ? "bg-red-100 text-red-700"
        : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${classes}`}>
      {label}
    </span>
  );
}
