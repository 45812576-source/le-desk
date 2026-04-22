"use client";

import type { SnapshotTabKey, WorkspaceSnapshotTabSyncResult } from "@/lib/types";
import { SNAPSHOT_TAB_KEYS, SNAPSHOT_TAB_LABELS } from "@/lib/types";

export default function SnapshotTabBar({
  activeTab,
  onTabChange,
  syncStatus,
}: {
  activeTab: SnapshotTabKey;
  onTabChange: (tab: SnapshotTabKey) => void;
  syncStatus?: Partial<Record<SnapshotTabKey, WorkspaceSnapshotTabSyncResult>> | null;
}) {
  return (
    <div className="flex gap-1 border-b border-border">
      {SNAPSHOT_TAB_KEYS.map((key) => {
        const isActive = key === activeTab;
        const tabSync = syncStatus?.[key];
        const syncDot = tabSync
          ? tabSync.status === "synced"
            ? "bg-green-500"
            : tabSync.status === "partial_sync"
              ? "bg-amber-500"
              : "bg-red-500"
          : null;

        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className={`relative px-4 py-2.5 text-xs font-medium transition-colors ${
              isActive
                ? "border-b-2 border-[#00A3C4] text-[#00A3C4]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {SNAPSHOT_TAB_LABELS[key]}
            {syncDot && (
              <span className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${syncDot}`} />
            )}
          </button>
        );
      })}
    </div>
  );
}
