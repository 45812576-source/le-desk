"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SnapshotTabKey, WorkspaceSnapshotTabSyncResult } from "@/lib/types";
import { SNAPSHOT_TAB_LABELS } from "@/lib/types";
import { saveWorkspaceSnapshotTabMarkdown } from "@/lib/org-memory";

export default function SnapshotMarkdownEditor({
  snapshotId,
  tabKey,
  initialMarkdown,
  onSaved,
}: {
  snapshotId: number;
  tabKey: SnapshotTabKey;
  initialMarkdown: string;
  onSaved?: (result: WorkspaceSnapshotTabSyncResult) => void;
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<WorkspaceSnapshotTabSyncResult | null>(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 当 tab 或 initialMarkdown 变化时重置
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      setMarkdown(initialMarkdown);
      setDirty(false);
      setSaveResult(null);
      setError("");
    });
    return () => {
      active = false;
    };
  }, [initialMarkdown, tabKey, snapshotId]);

  function handleChange(value: string) {
    setMarkdown(value);
    setDirty(true);
    setSaveResult(null);
    setError("");
  }

  const handleSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await saveWorkspaceSnapshotTabMarkdown(snapshotId, tabKey, markdown);
      setSaveResult(result);
      setDirty(false);
      onSaved?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
    setSaving(false);
  }, [snapshotId, tabKey, markdown, saving, onSaved]);

  // Ctrl+S / Cmd+S 保存
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) {
          void handleSave();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dirty, handleSave]);

  const failedSectionLabels = saveResult?.failed_sections.map((item) => item.section).filter(Boolean) ?? [];

  return (
    <div className="space-y-3">
      {/* 编辑头 */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {SNAPSHOT_TAB_LABELS[tabKey]} · Markdown
          {dirty && <span className="ml-2 text-amber-600">未保存</span>}
        </div>
        <div className="flex items-center gap-2">
          {saveResult && (
            <span
              className={`text-[11px] font-medium ${
                saveResult.status === "synced"
                  ? "text-green-600"
                  : saveResult.status === "partial_sync"
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {saveResult.status === "synced"
                ? "已保存并同步"
                : saveResult.status === "partial_sync"
                  ? `部分同步（失败: ${failedSectionLabels.join("、") || "结构化同步"}）`
                  : "同步失败"}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="rounded bg-[#00A3C4] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      {/* 编辑区 */}
      <textarea
        ref={textareaRef}
        value={markdown}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={`在此编辑${SNAPSHOT_TAB_LABELS[tabKey]}的 Markdown 内容...`}
        className="min-h-[400px] w-full resize-y rounded border border-border bg-background px-4 py-3 font-mono text-sm leading-7 text-foreground outline-none focus:border-[#00A3C4]"
        spellCheck={false}
      />

      {/* 错误提示 */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {!error && saveResult?.parser_warnings && saveResult.parser_warnings.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {saveResult.parser_warnings.join("；")}
        </div>
      )}

      {/* 提示 */}
      <div className="text-[11px] text-muted-foreground">
        Ctrl+S / Cmd+S 快捷保存。保存后会自动触发 JSON/YAML 结构化同步。
      </div>
    </div>
  );
}
