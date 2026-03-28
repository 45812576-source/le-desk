"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { PixelIcon, ICONS, PixelBadge } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { useTheme } from "@/lib/theme";
import type { KnowledgeDetail } from "@/lib/types";
import { RichEditor } from "@/components/knowledge/RichEditor";
import DocumentViewer from "@/components/knowledge/DocumentViewer";

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
}

function ThemedEyeIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon pattern={ICONS.eyePreview.pattern} colors={ICONS.eyePreview.colors} size={size} />;
  return <Eye size={size} className="text-muted-foreground" />;
}

function toHtml(raw: string): string {
  if (!raw) return "";
  if (/^</.test(raw.trim())) return raw;
  return raw.split("\n").map((l) => `<p>${l || "<br>"}</p>`).join("");
}

// Breadcrumbs component
function Breadcrumbs({ folders, entry }: { folders: Folder[]; entry: KnowledgeDetail }) {
  if (!entry.folder_id) return null;
  const path: Folder[] = [];
  let cur: number | null = entry.folder_id;
  const map = new Map(folders.map((f) => [f.id, f]));
  while (cur !== null) {
    const f = map.get(cur);
    if (!f) break;
    path.unshift(f);
    cur = f.parent_id;
  }
  if (path.length === 0) return null;
  return (
    <div className="flex items-center gap-1 px-5 py-1.5 text-[9px] text-gray-400 border-b border-gray-100 flex-shrink-0 flex-wrap">
      <span>根目录</span>
      {path.map((f) => (
        <span key={f.id} className="flex items-center gap-1">
          <span className="text-gray-300">›</span>
          <span className="text-gray-500 font-medium">{f.name}</span>
        </span>
      ))}
      <span className="text-gray-300">›</span>
      <span className="text-[#1A202C] font-bold truncate max-w-[200px]">{entry.title || entry.source_file}</span>
    </div>
  );
}

interface PreviewPanelProps {
  entry: KnowledgeDetail | null;
  onUpdateContent: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
  folders?: Folder[];
  onMoveToFolder?: (entryId: number, folderId: number | null) => void;
}

export default function PreviewPanel({
  entry,
  onUpdateContent,
  onDelete,
  onRename,
  folders,
  onMoveToFolder,
}: PreviewPanelProps) {
  const [editing, setEditing] = useState(false);
  const [contentVal, setContentVal] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const folderPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFolderPicker) return;
    function onOutsideClick(e: MouseEvent) {
      if (folderPickerRef.current && !folderPickerRef.current.contains(e.target as Node)) {
        setShowFolderPicker(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [showFolderPicker]);

  useEffect(() => {
    setEditing(false);
    setEditingTitle(false);
    setContentVal(entry?.content ?? "");
    setTitleVal(entry?.title ?? "");
  }, [entry?.id]);

  async function handleSave() {
    if (!entry || saving) return;
    setSaving(true);
    try {
      await onUpdateContent(entry.id, contentVal);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (!entry) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-white flex flex-col items-center justify-center gap-3 text-[9px] text-gray-400 uppercase tracking-widest">
        <div className="opacity-30"><ThemedEyeIcon size={40} /></div>
        <p>选择左侧文件进行预览</p>
        <p className="text-[8px] opacity-60 normal-case tracking-normal">支持 PDF / Word / Excel / 图片 / 音视频 / Markdown / 代码</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-white flex flex-col overflow-hidden">
      {/* Breadcrumbs */}
      {folders && <Breadcrumbs folders={folders} entry={entry} />}

      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b-2 border-[#1A202C] flex-shrink-0 flex-wrap">
        {editingTitle ? (
          <input
            autoFocus
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={() => { if (titleVal.trim() !== entry.title) onRename(entry.id, titleVal.trim()); setEditingTitle(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { if (titleVal.trim() !== entry.title) onRename(entry.id, titleVal.trim()); setEditingTitle(false); } if (e.key === "Escape") setEditingTitle(false); }}
            className="flex-1 text-sm font-bold border-2 border-[#00D1FF] px-2 py-0.5 focus:outline-none"
          />
        ) : (
          <h2 className="text-sm font-bold cursor-pointer hover:text-[#00A3C4] flex-1 truncate" onClick={() => { setEditingTitle(true); setTitleVal(entry.title); }}>{entry.title}</h2>
        )}
        <PixelBadge color={entry.status === "approved" ? "green" : entry.status === "pending" ? "yellow" : "gray"}>
          {entry.status === "approved" ? "已通过" : entry.status === "pending" ? "待审核" : entry.status}
        </PixelBadge>
        {entry.ai_title && entry.ai_title !== entry.title && (
          <span className="text-[8px] text-[#00CC99] font-bold truncate max-w-[200px]" title="AI 建议标题">🤖 {entry.ai_title}</span>
        )}
        {entry.file_ext && (
          <span className="text-[7px] font-bold px-1 border border-[#00D1FF] text-[#00A3C4]">
            {entry.file_ext.replace(".", "").toUpperCase()}
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {onMoveToFolder && folders && folders.length > 0 && (
            <div className="relative" ref={folderPickerRef}>
              <button
                onClick={() => setShowFolderPicker((v) => !v)}
                className="px-2 py-0.5 border-2 border-[#00CC99] text-[#00CC99] text-[9px] font-bold uppercase hover:bg-[#00CC99] hover:text-white transition-colors"
              >
                {entry.folder_id ? "移动到…" : "↗ 归入文件夹"}
              </button>
              {showFolderPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border-2 border-[#1A202C] shadow-lg min-w-[160px] max-h-60 overflow-y-auto">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 px-3 py-1.5 border-b border-gray-100">选择文件夹</div>
                  {entry.folder_id && (
                    <button
                      onClick={() => { onMoveToFolder(entry.id, null); setShowFolderPicker(false); }}
                      className="w-full text-left px-3 py-1.5 text-[9px] font-bold text-gray-500 hover:bg-[#F0F4F8] border-b border-gray-100"
                    >
                      ✕ 移出文件夹
                    </button>
                  )}
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { onMoveToFolder(entry.id, f.id); setShowFolderPicker(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[9px] font-bold hover:bg-[#CCF2FF] transition-colors ${entry.folder_id === f.id ? "text-[#00A3C4] bg-[#F0FAFF]" : "text-[#1A202C]"}`}
                    >
                      📁 {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="px-2 py-0.5 border-2 border-[#1A202C] bg-[#1A202C] text-white text-[9px] font-bold uppercase hover:bg-[#00A3C4] hover:border-[#00A3C4] disabled:opacity-50">
                {saving ? "保存中..." : "保存"}
              </button>
              <button onClick={() => { setEditing(false); setContentVal(entry.content); }} className="px-2 py-0.5 border-2 border-gray-300 text-gray-500 text-[9px] font-bold uppercase hover:border-red-400 hover:text-red-400">取消</button>
            </>
          ) : (
            <button onClick={() => { setEditing(true); setContentVal(entry.content); }} className="px-2 py-0.5 border-2 border-[#1A202C] text-[9px] font-bold uppercase hover:bg-[#1A202C] hover:text-white">编辑</button>
          )}
          <button onClick={() => onDelete(entry.id)} className="px-2 py-0.5 border-2 border-red-300 text-red-400 text-[9px] font-bold uppercase hover:bg-red-400 hover:text-white">删除</button>
        </div>
      </div>

      {/* AI 摘要和标签 */}
      {(entry.ai_summary || entry.ai_tags) && !editing && (
        <div className="px-5 py-3 bg-[#F0FAFF] border-b border-[#00D1FF]/30 flex-shrink-0">
          {entry.ai_summary && (
            <div className="mb-2">
              <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">AI 摘要</span>
              <p className="text-[10px] text-[#1A202C] mt-0.5 leading-relaxed">{entry.ai_summary}</p>
            </div>
          )}
          {entry.ai_tags && (
            <div className="flex flex-wrap gap-1">
              {[...(entry.ai_tags.industry || []), ...(entry.ai_tags.platform || []), ...(entry.ai_tags.topic || [])].map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-[#00D1FF]/10 border border-[#00D1FF]/30 text-[8px] font-bold text-[#00A3C4]">{tag}</span>
              ))}
            </div>
          )}
          {entry.quality_score != null && (
            <div className="mt-1 text-[8px] text-gray-400">质量分: {(entry.quality_score * 100).toFixed(0)}%</div>
          )}
        </div>
      )}

      {/* 下载按钮（有 OSS 文件时显示） */}
      {entry.oss_key && !editing && (
        <div className="px-5 py-2 border-b border-gray-100 flex-shrink-0">
          <button
            onClick={async () => {
              try {
                const res = await fetch(`/api/proxy/knowledge/${entry.id}/file-url`);
                if (res.ok) {
                  const data = await res.json();
                  window.open(data.url, "_blank");
                }
              } catch {}
            }}
            className="text-[9px] font-bold text-[#00D1FF] hover:text-[#00A3C4] uppercase"
          >
            ⬇ 下载原始文件
            {entry.source_file && ` (${entry.source_file})`}
            {entry.file_size && ` · ${(entry.file_size / 1024 / 1024).toFixed(1)}MB`}
          </button>
        </div>
      )}

      {/* 文档预览/编辑区域 */}
      <div className={editing ? "flex-1 min-h-0 overflow-hidden" : "flex-1 min-h-0 overflow-y-auto"}>
        {editing ? (
          <RichEditor
            key={`${entry.id}-edit`}
            content={toHtml(contentVal)}
            onChange={setContentVal}
            editable={true}
          />
        ) : entry.oss_key ? (
          <DocumentViewer entry={entry} />
        ) : (
          <RichEditor
            key={entry.id}
            content={toHtml(contentVal)}
            onChange={setContentVal}
            editable={false}
          />
        )}
      </div>
    </div>
  );
}
