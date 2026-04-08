"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";

interface Snapshot {
  id: number;
  snapshot_type: string;
  preview_text: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string | null;
}

interface SnapshotHistoryProps {
  knowledgeId: number;
  currentUserId: number;
  /** 是否可执行恢复操作（权限控制） */
  canRestore: boolean;
  onToast?: (msg: string) => void;
  /** 恢复成功后的回调（刷新正文 + 评论等） */
  onRestoreSuccess?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  manual: "手动保存",
  autosave: "自动保存",
  import: "导入",
  restore: "恢复",
};

const TYPE_STYLES: Record<string, string> = {
  manual: "bg-blue-100 text-blue-600",
  autosave: "bg-gray-100 text-gray-500",
  import: "bg-green-100 text-green-600",
  restore: "bg-amber-100 text-amber-600",
};

export default function SnapshotHistory({
  knowledgeId,
  currentUserId,
  canRestore,
  onToast,
  onRestoreSuccess,
}: SnapshotHistoryProps) {
  const toast = (msg: string) => onToast?.(msg);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const loadSnapshots = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await apiFetch<Snapshot[]>(`/knowledge/${knowledgeId}/snapshots`);
      setSnapshots(res);
    } catch (e: unknown) {
      const msg = e instanceof ApiError
        ? (e.status >= 500 ? "服务器错误，请稍后重试" : e.message)
        : "网络错误，请检查连接";
      setLoadError(msg);
      toast(msg);
    }
  }, [knowledgeId, toast]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoadError(null);
        const res = await apiFetch<Snapshot[]>(`/knowledge/${knowledgeId}/snapshots`);
        if (!cancelled) setSnapshots(res);
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof ApiError
          ? (e.status >= 500 ? "服务器错误，请稍后重试" : e.message)
          : "网络错误，请检查连接";
        setLoadError(msg);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [knowledgeId]);

  const handleCreateSnapshot = async () => {
    setCreating(true);
    try {
      await apiFetch(`/knowledge/${knowledgeId}/snapshots`, {
        method: "POST",
        body: JSON.stringify({ snapshot_type: "manual" }),
      });
      toast("快照已创建");
      loadSnapshots();
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        toast(e.status === 403 ? "无权创建快照" : e.status >= 500 ? "服务器错误" : e.message);
      } else {
        toast("网络错误，创建失败");
      }
    }
    setCreating(false);
  };

  const handleRestore = async (snapshotId: number) => {
    if (!confirm("确定恢复到此版本？当前内容将被覆盖。")) return;
    setRestoringId(snapshotId);
    try {
      await apiFetch(`/knowledge/${knowledgeId}/snapshots/${snapshotId}/restore`, {
        method: "POST",
      });
      toast("已恢复到该版本");
      await loadSnapshots();
      onRestoreSuccess?.();
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        toast(
          e.status === 403 ? "无权恢复此快照"
          : e.status === 404 ? "快照不存在或内容为空，无法恢复"
          : e.status >= 500 ? "服务器错误，恢复失败"
          : `恢复失败: ${e.message}`
        );
      } else {
        toast("网络错误，恢复失败");
      }
    }
    setRestoringId(null);
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <p className="text-[11px] text-red-400">{loadError}</p>
        <button onClick={loadSnapshots} className="text-[10px] text-[#00A3C4] hover:underline">
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {snapshots.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-8">暂无快照历史</p>
        )}
        {snapshots.map((s) => {
          const isRestoring = restoringId === s.id;
          return (
            <div
              key={s.id}
              className={`border border-gray-100 rounded-lg p-2.5 transition-colors group ${
                isRestoring ? "bg-amber-50 border-amber-200" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    TYPE_STYLES[s.snapshot_type] || "bg-gray-100 text-gray-500"
                  }`}
                >
                  {TYPE_LABELS[s.snapshot_type] || s.snapshot_type}
                </span>
                <span className="text-[9px] text-gray-400 flex-1 truncate">
                  {s.created_by_name && <>{s.created_by_name} · </>}
                  {s.created_at ? new Date(s.created_at).toLocaleString("zh-CN") : ""}
                </span>
                {canRestore && (
                  <button
                    onClick={() => handleRestore(s.id)}
                    disabled={restoringId !== null}
                    className={`flex items-center gap-0.5 text-[9px] text-[#00A3C4] font-bold uppercase transition-all hover:underline disabled:opacity-40 ${
                      isRestoring ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {isRestoring ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <RotateCcw size={10} />
                    )}
                    {isRestoring ? "恢复中..." : "恢复"}
                  </button>
                )}
              </div>
              {s.preview_text && (
                <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{s.preview_text}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={handleCreateSnapshot}
          disabled={creating}
          className="w-full py-1.5 text-[10px] font-bold text-[#00A3C4] border border-[#00D1FF] rounded hover:bg-[#E0F7FF] transition-colors disabled:opacity-40"
        >
          {creating ? "创建中..." : "创建手动快照"}
        </button>
      </div>
    </div>
  );
}
