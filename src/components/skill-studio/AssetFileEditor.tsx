"use client";

import { useEffect, useState } from "react";
import { FileCode } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { SkillDetail } from "@/lib/types";
import { useStudioStore } from "@/lib/studio-store";
import type { DiffOp } from "./types";
import { DiffViewer, LineNumberedEditor } from "./DiffViewer";
import { isTextFile, getFileCategory, inferCategory, CATEGORY_CONFIG } from "./utils";

function applyDiffOpsForPreview(text: string, ops: DiffOp[]) {
  let next = text;
  for (const op of ops) {
    if (op.type === "replace" && op.old) next = next.replace(op.old, op.new || "");
    else if (op.type === "delete" && op.old) next = next.replace(op.old, "");
    else if (op.type === "append") next += op.content || op.new || "";
    else if (op.type === "insert_after") {
      const anchor = op.anchor || op.old || "";
      const insert = op.content || op.new || "";
      if (anchor && next.includes(anchor)) {
        const idx = next.indexOf(anchor) + anchor.length;
        next = next.slice(0, idx) + insert + next.slice(idx);
      } else {
        next += `\n${insert}`;
      }
    } else if (op.type === "insert_before") {
      const anchor = op.anchor || op.old || "";
      const insert = op.content || op.new || "";
      next = anchor && next.includes(anchor) ? next.replace(anchor, `${insert}${anchor}`) : `${insert}\n${next}`;
    }
  }
  return next;
}

export function AssetFileEditor({
  skill,
  filename,
  onDeleted,
  onFileSaved,
}: {
  skill: SkillDetail;
  filename: string;
  onDeleted: () => void;
  onFileSaved?: (filename: string, contentSize: number) => void;
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
  const stagedPreviewContent = pendingFileStagedEdit?.diff?.length
    ? applyDiffOpsForPreview(content, pendingFileStagedEdit.diff)
    : null;

  useEffect(() => {
    setLoading(true);
    setMsg(null);
    setDiffBase(null);
    setShowDiff(false);
    if (!isText) { setLoading(false); return; }
    apiFetch<{ content: string }>(`/skills/${skill.id}/files/${encodeURIComponent(filename)}`)
      .then((d) => { setContent(d.content); setDiffBase(d.content); })
      .catch(() => setMsg("加载失败"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.id, filename]);

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
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
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
        ) : stagedPreviewContent !== null && stagedPreviewContent !== content ? (
          <>
            <div className="px-2 py-1 bg-[#F0FFF9] border border-[#00CC99]/40 text-[8px] font-mono text-[#007A5E] mb-1 flex-shrink-0">
              待确认治理修改：{pendingFileStagedEdit?.changeNote || "查看 diff 后在治理卡片中采纳或拒绝"}
            </div>
            <DiffViewer oldText={content} newText={stagedPreviewContent} />
          </>
        ) : showDiff && diffBase !== null ? (
          <DiffViewer oldText={diffBase} newText={content} />
        ) : (
          <LineNumberedEditor
            value={content}
            onChange={setContent}
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
