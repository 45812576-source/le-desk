"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface ChangeTimelineProps {
  entityType?: string;
  entityId?: number;
  limit?: number;
}

interface FieldChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

interface ChangeEvent {
  id: number;
  entity_type: string;
  entity_id: number;
  change_type: "created" | "updated" | "deleted" | "imported";
  field_changes: FieldChange[];
  created_at: string;
  operator?: string;
}

const CHANGE_TYPE_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  created: { label: "新建", color: "bg-green-500" },
  updated: { label: "更新", color: "bg-blue-500" },
  deleted: { label: "删除", color: "bg-red-500" },
  imported: { label: "导入", color: "bg-orange-500" },
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ChangeTimeline({
  entityType,
  entityId,
  limit = 20,
}: ChangeTimelineProps) {
  const [events, setEvents] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true);
      setError(null);
      try {
        let path: string;
        if (entityType && entityId !== undefined) {
          path = `/org-management/change-events/${encodeURIComponent(entityType)}/${entityId}`;
        } else {
          const params = new URLSearchParams();
          if (limit) params.set("limit", String(limit));
          if (entityType) params.set("entity_type", entityType);
          path = `/org-management/change-events?${params.toString()}`;
        }
        const data = await apiFetch<ChangeEvent[]>(path);
        setEvents(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "加载变更记录失败");
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, [entityType, entityId, limit]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            className="opacity-25"
          />
          <path
            d="M4 12a8 8 0 018-8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-75"
          />
        </svg>
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-400">
        暂无变更记录
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      {/* 垂直连接线 */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />

      {events.map((event) => {
        const config =
          CHANGE_TYPE_CONFIG[event.change_type] ??
          CHANGE_TYPE_CONFIG.updated;
        const visibleChanges = (event.field_changes ?? []).slice(0, 3);
        const hasMore = (event.field_changes ?? []).length > 3;

        return (
          <div key={event.id} className="relative mb-5 last:mb-0">
            {/* 彩色圆点 */}
            <div
              className={`absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white ${config.color}`}
            />

            <div className="rounded border border-gray-100 bg-gray-50 p-3">
              {/* 头部 */}
              <div className="mb-1 flex items-center gap-2 text-sm">
                <span className="font-semibold text-[#1A202C]">
                  {event.entity_type}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium text-white ${config.color}`}
                >
                  {config.label}
                </span>
                {event.operator && (
                  <span className="text-xs text-gray-400">
                    {event.operator}
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-400">
                  {formatTime(event.created_at)}
                </span>
              </div>

              {/* 字段变更摘要 */}
              {visibleChanges.length > 0 && (
                <div className="mt-2 space-y-1">
                  {visibleChanges.map((fc, i) => (
                    <div
                      key={i}
                      className="flex gap-2 text-xs text-gray-600"
                    >
                      <span className="shrink-0 font-medium">
                        {fc.field}:
                      </span>
                      <span className="text-red-400 line-through">
                        {formatValue(fc.old_value)}
                      </span>
                      <span>&rarr;</span>
                      <span className="text-green-600">
                        {formatValue(fc.new_value)}
                      </span>
                    </div>
                  ))}
                  {hasMore && (
                    <div className="text-xs text-gray-400">
                      ...还有 {(event.field_changes?.length ?? 0) - 3} 项变更
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
