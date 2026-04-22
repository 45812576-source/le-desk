"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrgMemorySource, WorkspaceSnapshotMissingItem } from "@/lib/types";
import { loadOrgMemorySources } from "@/lib/org-memory";
import SnapshotMissingItemsForm from "./SnapshotMissingItemsForm";

export default function SnapshotEventDrawer({
  open,
  onClose,
  mode,
  missingItems,
  generating,
  onSubmitGenerate,
}: {
  open: boolean;
  onClose: () => void;
  mode: "generate" | "append";
  missingItems: WorkspaceSnapshotMissingItem[];
  generating: boolean;
  onSubmitGenerate: (
    sourceIds?: number[],
    missingAnswers?: Record<string, string | string[] | boolean>,
  ) => void;
}) {
  const [sources, setSources] = useState<OrgMemorySource[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<number>>(new Set());
  const [loadingSources, setLoadingSources] = useState(false);

  const refreshSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const result = await loadOrgMemorySources();
      setSources(result.data);
      // 默认全选
      setSelectedSourceIds(new Set(result.data.map((s) => s.id)));
    } catch {
      setSources([]);
    }
    setLoadingSources(false);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active && open) void refreshSources();
    });
    return () => {
      active = false;
    };
  }, [open, refreshSources]);

  function toggleSource(id: number) {
    setSelectedSourceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const showMissingForm = missingItems.length > 0;

  if (!open) return null;

  return (
    <>
      {/* overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* drawer */}
      <div className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-lg flex-col border-l border-border bg-card shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="text-sm font-semibold text-foreground">
            {mode === "generate" ? "生成 / 更新快照" : "追加资料"}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* 资料选择 */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-foreground">
              {mode === "generate" ? "选择参与生成的资料" : "选择要追加的资料"}
            </div>

            {loadingSources ? (
              <div className="text-xs text-muted-foreground">加载中...</div>
            ) : sources.length === 0 ? (
              <div className="text-xs text-muted-foreground">暂无资料，请先到「资料接入」添加。</div>
            ) : (
              <div className="space-y-2">
                {sources.map((source) => (
                  <label
                    key={source.id}
                    className="flex cursor-pointer items-start gap-3 rounded border border-border bg-background px-3 py-3 hover:bg-muted/20"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSourceIds.has(source.id)}
                      onChange={() => toggleSource(source.id)}
                      className="mt-0.5 h-3.5 w-3.5 accent-[#00A3C4]"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-foreground">{source.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {source.owner_name} · {source.latest_snapshot_version || "未生成快照"}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* 缺失项补齐 */}
          {showMissingForm && (
            <div className="mt-6 border-t border-border pt-4">
              <SnapshotMissingItemsForm
                items={missingItems}
                onSubmit={(answers) => {
                  onSubmitGenerate(
                    Array.from(selectedSourceIds),
                    answers,
                  );
                }}
                onSkip={() => {
                  onSubmitGenerate(Array.from(selectedSourceIds));
                }}
                submitting={generating}
              />
            </div>
          )}
        </div>

        {/* footer */}
        {!showMissingForm && (
          <div className="border-t border-border px-5 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => onSubmitGenerate(Array.from(selectedSourceIds))}
                disabled={generating || selectedSourceIds.size === 0}
                className="rounded bg-[#00A3C4] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? "生成中..." : mode === "generate" ? "开始生成" : "追加并更新"}
              </button>
              <button
                onClick={onClose}
                className="rounded border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30"
              >
                取消
              </button>
              <span className="text-[11px] text-muted-foreground">
                已选 {selectedSourceIds.size} / {sources.length} 份资料
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
