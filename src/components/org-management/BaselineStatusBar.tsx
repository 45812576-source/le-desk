"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { OrgBaselineStatus } from "@/lib/types";

export function BaselineStatusBar() {
  const [status, setStatus] = useState<OrgBaselineStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<OrgBaselineStatus>("/org-management/baseline-status")
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg bg-muted/10 px-4 py-3 animate-pulse">
        <div className="h-5 w-64 rounded bg-muted/20" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-lg bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
        无法加载基线状态
      </div>
    );
  }

  const isActive = status.baseline_status === "active";

  return (
    <div className="flex items-center gap-4 rounded-lg bg-muted/10 px-4 py-3 text-sm flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">基线版本</span>
        <span className="font-mono font-semibold">
          {status.baseline_version ?? "—"}
        </span>
      </div>

      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          isActive
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        }`}
      >
        {isActive ? "生效中" : "暂无数据"}
      </span>

      <div className="flex items-center gap-1 text-muted-foreground">
        <span>快照时间</span>
        <span className="font-mono">
          {status.baseline_created_at
            ? new Date(status.baseline_created_at).toLocaleString("zh-CN")
            : "—"}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-4 text-muted-foreground">
        <span>
          部门 <span className="font-semibold text-foreground">{status.department_count}</span>
        </span>
        <span>
          人员 <span className="font-semibold text-foreground">{status.user_count}</span>
        </span>
        <span>
          导入 <span className="font-semibold text-foreground">{status.import_count}</span>
        </span>
      </div>
    </div>
  );
}
