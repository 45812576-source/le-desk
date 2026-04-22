"use client";

import type { SnapshotScopeOption, WorkspaceSnapshotRunStatus, WorkspaceSnapshotSummary } from "@/lib/types";
import { SNAPSHOT_RUN_STATUS_LABELS, SNAPSHOT_RUN_STATUS_STYLES, SNAPSHOT_SCOPE_LABELS } from "@/lib/org-memory";

export default function SnapshotToolbar({
  snapshot,
  scope,
  onScopeChange,
  versions,
  selectedVersionId,
  onVersionChange,
  missingCount,
  conflictCount,
  runStatus,
  onGenerate,
  onAppendSources,
  generating,
}: {
  snapshot: WorkspaceSnapshotSummary | null;
  scope: SnapshotScopeOption;
  onScopeChange: (scope: SnapshotScopeOption) => void;
  versions: WorkspaceSnapshotSummary[];
  selectedVersionId: number | null;
  onVersionChange: (id: number) => void;
  missingCount: number;
  conflictCount: number;
  runStatus: WorkspaceSnapshotRunStatus;
  onGenerate: () => void;
  onAppendSources: () => void;
  generating: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* 左侧: 标题 + 版本 + 时间 */}
      <div className="mr-auto flex items-center gap-3">
        <div className="text-sm font-semibold text-foreground">
          {snapshot ? snapshot.version : "组织治理快照"}
        </div>
        {snapshot && (
          <span className="text-xs text-muted-foreground">
            {new Date(snapshot.updated_at).toLocaleString("zh-CN")}
          </span>
        )}
      </div>

      {/* 范围下拉 */}
      <select
        value={scope}
        onChange={(e) => onScopeChange(e.target.value as SnapshotScopeOption)}
        className="rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none"
      >
        {(Object.keys(SNAPSHOT_SCOPE_LABELS) as SnapshotScopeOption[]).map((key) => (
          <option key={key} value={key}>
            {SNAPSHOT_SCOPE_LABELS[key]}
          </option>
        ))}
      </select>

      {/* 版本选择 */}
      {versions.length > 1 && (
        <select
          value={selectedVersionId ?? ""}
          onChange={(e) => onVersionChange(Number(e.target.value))}
          className="rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.version}
            </option>
          ))}
        </select>
      )}

      {/* 状态指示 */}
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${SNAPSHOT_RUN_STATUS_STYLES[runStatus] || "bg-slate-100 text-slate-700"}`}>
        {SNAPSHOT_RUN_STATUS_LABELS[runStatus] || runStatus}
      </span>

      {/* 缺失项 / 冲突项 */}
      {missingCount > 0 && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          缺失 {missingCount}
        </span>
      )}
      {conflictCount > 0 && (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
          冲突 {conflictCount}
        </span>
      )}

      {/* 操作按钮 */}
      <button
        onClick={onAppendSources}
        className="rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/30"
      >
        追加资料
      </button>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="rounded bg-[#00A3C4] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {generating ? "生成中..." : snapshot ? "更新快照" : "生成快照"}
      </button>
    </div>
  );
}
