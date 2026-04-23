"use client";

import { useEffect, useState } from "react";
import { FileCode } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { SkillDetail } from "@/lib/types";
import { useStudioStore } from "@/lib/studio-store";
import type { StagedEdit } from "./types";
import { DiffViewer, LineNumberedEditor } from "./DiffViewer";
import { isTextFile, getFileCategory, inferCategory, CATEGORY_CONFIG, resolveDiffPreviewContent } from "./utils";

export function AssetFileEditor({
  skill,
  filename,
  onDeleted,
  onFileSaved,
  onContentChange,
  onBaselineChange,
  onLoadStart,
  onLoadSuccess,
  onLoadError,
  adoptedPreviewEdit,
}: {
  skill: SkillDetail;
  filename: string;
  onDeleted: () => void;
  onFileSaved?: (filename: string, contentSize: number) => void;
  onContentChange?: (content: string) => void;
  onBaselineChange?: (content: string) => void;
  onLoadStart?: (filename: string) => void;
  onLoadSuccess?: (filename: string) => void;
  onLoadError?: (filename: string, message: string) => void;
  adoptedPreviewEdit?: StagedEdit | null;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [diffBase, setDiffBase] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const isReadOnly = skill.status === "published" || skill.status === "archived";
  const isText = isTextFile(filename);
  const hasDiff = diffBase !== null && diffBase !== content;
  const pendingFileStagedEdit = useStudioStore((s) => s.stagedEdits.find((e) =>
    e.status === "pending" && e.fileType === "source_file" && e.filename === filename && e.diff?.length > 0
  ));
  const adoptedFilePreviewEdit = adoptedPreviewEdit?.status === "adopted"
    && adoptedPreviewEdit.fileType === "source_file"
    && adoptedPreviewEdit.filename === filename
    && adoptedPreviewEdit.diff?.length > 0
    ? adoptedPreviewEdit
    : null;
  const activePreviewEdit = pendingFileStagedEdit || adoptedFilePreviewEdit;
  const stagedPreview = activePreviewEdit?.diff?.length
    ? resolveDiffPreviewContent(content, activePreviewEdit)
    : null;

  useEffect(() => {
    setLoading(true);
    setMsg(null);
    setDiffBase(null);
    setShowDiff(false);
    onLoadStart?.(filename);
    if (!isText) {
      setLoading(false);
      onLoadSuccess?.(filename);
      return;
    }
    apiFetch<{ content: string }>(`/skills/${skill.id}/files/${encodeURIComponent(filename)}`)
      .then((d) => {
        setContent(d.content);
        setDiffBase(d.content);
        onContentChange?.(d.content);
        onBaselineChange?.(d.content);
        onLoadSuccess?.(filename);
      })
      .catch(() => {
        const message = "加载失败";
        setMsg(message);
        onLoadError?.(filename, message);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.id, filename]);

  function handleContentChange(next: string) {
    setContent(next);
    onContentChange?.(next);
  }

  async function handleSave() {
    setSaving(true); setMsg(null);
    try {
      await apiFetch(`/skills/${skill.id}/files/${encodeURIComponent(filename)}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      setMsg("✓ 已保存");
      setDiffBase(content);
      setShowDiff(false);
      onBaselineChange?.(content);
      onFileSaved?.(filename, new Blob([content]).size);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "保存失败");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`确认删除文件 ${filename}？`)) return;
    await apiFetch(`/skills/${skill.id}/files/${encodeURIComponent(filename)}`, { method: "DELETE" });
    onDeleted();
  }

  const fileInfo = (skill.source_files ?? []).find((f) => f.filename === filename);
  const fileCategory = fileInfo ? getFileCategory(fileInfo) : inferCategory(filename);
  const categoryHint = CATEGORY_CONFIG[fileCategory]?.hint;

  return (
    <div className="flex-1 h-full min-h-0 flex flex-col bg-white overflow-hidden min-w-0">
      {isReadOnly && (
        <div className="px-4 py-2 bg-amber-50 border-b-2 border-amber-300 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">已发布（只读）</span>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-[#1A202C] flex items-center gap-3 flex-shrink-0">
        {(() => { const CatIcon = CATEGORY_CONFIG[fileCategory]?.icon || FileCode; return <CatIcon size={12} className="text-[#00A3C4] flex-shrink-0" />; })()}
        <span className="text-xs font-bold font-mono flex-1 truncate">{filename}</span>
        {fileInfo && (
          <span className="text-[8px] text-gray-400 font-mono flex-shrink-0">
            {fileInfo.size > 1024 ? `${(fileInfo.size / 1024).toFixed(1)} KB` : `${fileInfo.size} B`}
          </span>
        )}
        {!isReadOnly && (
          <button onClick={handleDelete} className="text-[8px] font-bold uppercase text-red-400 hover:text-red-600 flex-shrink-0">
            删除
          </button>
        )}
      </div>

      {/* Category hint bar */}
      {categoryHint && (
        <div className="px-4 py-1.5 bg-[#F0F4F8] border-b border-gray-200 flex-shrink-0">
          <span className="text-[9px] text-gray-500">{categoryHint}</span>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 flex flex-col px-4 py-3 overflow-hidden min-h-0">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            {isText ? "文件内容" : "附属文件（二进制）"}
          </span>
          {hasDiff && isText && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              className={`text-[8px] font-bold uppercase tracking-widest transition-colors ${
                showDiff ? "text-[#00CC99]" : "text-gray-400 hover:text-[#00CC99]"
              }`}
            >
              {showDiff ? "◼ 编辑模式" : "◈ 查看变更"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[9px] text-gray-400 animate-pulse">加载中...</div>
        ) : !isText ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <FileCode size={32} className="text-gray-300" />
            <p className="text-[9px] text-gray-400">二进制文件，不支持文本预览</p>
            {fileInfo && (
              <a
                href={`/api/proxy/${fileInfo.path}`}
                download={filename}
                className="text-[9px] text-[#00A3C4] hover:underline font-bold"
              >
                下载文件
              </a>
            )}
          </div>
        ) : stagedPreview !== null && stagedPreview.oldText !== stagedPreview.newText ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-2 py-1 bg-[#F0FFF9] border border-[#00CC99]/40 text-[8px] font-mono text-[#007A5E] mb-1 flex-shrink-0">
              {activePreviewEdit?.status === "adopted" ? "已采纳治理修改" : "待确认治理修改"}：
              {activePreviewEdit?.changeNote || (activePreviewEdit?.status === "adopted" ? "查看本次采纳后的文件 diff" : "查看 diff 后在治理卡片中采纳或拒绝")}
            </div>
            <DiffViewer oldText={stagedPreview.oldText} newText={stagedPreview.newText} />
          </div>
        ) : showDiff && diffBase !== null ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <DiffViewer oldText={diffBase} newText={content} />
          </div>
        ) : (
          <LineNumberedEditor
            value={content}
            onChange={handleContentChange}
            disabled={isReadOnly}
            placeholder="文件内容..."
          />
        )}
      </div>

      {/* Toolbar */}
      {!isReadOnly && isText && (
        <div className="px-4 py-3 border-t-2 border-[#1A202C] flex items-center gap-2 flex-shrink-0">
          <PixelButton size="sm" variant="secondary" onClick={handleSave} disabled={saving || loading}>
            {saving ? "保存中..." : "保存文件"}
          </PixelButton>
          {msg && (
            <span className={`text-[9px] font-bold ${msg.startsWith("✓") ? "text-[#00CC99]" : "text-red-500"}`}>{msg}</span>
          )}
        </div>
      )}
    </div>
  );
}
