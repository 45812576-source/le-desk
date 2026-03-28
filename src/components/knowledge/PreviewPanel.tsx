"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Eye, Download, Save, Cloud, CloudOff } from "lucide-react";
import { PixelIcon, ICONS, PixelBadge } from "@/components/pixel";
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

// Media types that use native viewers (not editable in RichEditor)
const MEDIA_EXTS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".svg",
  ".mp3", ".wav", ".m4a", ".ogg", ".flac",
  ".mp4", ".webm", ".mov",
]);

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
  onUpdateContent: (id: number, content: string, contentHtml?: string) => Promise<void>;
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
  const [htmlVal, setHtmlVal] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleVal, setTitleVal] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty">("saved");
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const folderPickerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const entryIdRef = useRef<number | null>(null);

  // Determine if this entry uses RichEditor (cloud doc) or native viewer
  const ext = (entry?.file_ext || "").toLowerCase();
  const isMediaFile = entry?.oss_key && MEDIA_EXTS.has(ext);

  // Init content on entry switch
  useEffect(() => {
    setEditingTitle(false);
    setTitleVal(entry?.title ?? "");
    setSaveState("saved");
    entryIdRef.current = entry?.id ?? null;
    // Use content_html if available, otherwise convert content to HTML
    const html = entry?.content_html || toHtml(entry?.content ?? "");
    setHtmlVal(html);
    // Clear any pending auto-save from previous entry
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, [entry?.id]);

  // Auto-save with debounce
  const doSave = useCallback(async (id: number, html: string) => {
    setSaveState("saving");
    try {
      // Strip HTML to get plain text for AI/vector
      const tempDiv = typeof document !== "undefined" ? document.createElement("div") : null;
      let plainText = html;
      if (tempDiv) {
        tempDiv.innerHTML = html;
        plainText = tempDiv.textContent || tempDiv.innerText || "";
      }
      await onUpdateContent(id, plainText, html);
      // Only mark saved if we're still on the same entry
      if (entryIdRef.current === id) setSaveState("saved");
    } catch {
      if (entryIdRef.current === id) setSaveState("dirty");
    }
  }, [onUpdateContent]);

  const handleContentChange = useCallback((newHtml: string) => {
    setHtmlVal(newHtml);
    setSaveState("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const id = entryIdRef.current;
    if (id != null) {
      saveTimerRef.current = setTimeout(() => doSave(id, newHtml), 2000);
    }
  }, [doSave]);

  // Manual save
  const handleManualSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const id = entryIdRef.current;
    if (id != null) doSave(id, htmlVal);
  }, [doSave, htmlVal]);

  // Keyboard shortcut: Ctrl/Cmd+S
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleManualSave();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleManualSave]);

  // Folder picker outside click
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
      <div className="flex items-center gap-2 px-5 pt-3 pb-2 border-b border-gray-200 flex-shrink-0 flex-wrap">
        {editingTitle ? (
          <input
            autoFocus
            value={titleVal}
            onChange={(e) => setTitleVal(e.target.value)}
            onBlur={() => { if (titleVal.trim() !== entry.title) onRename(entry.id, titleVal.trim()); setEditingTitle(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { if (titleVal.trim() !== entry.title) onRename(entry.id, titleVal.trim()); setEditingTitle(false); } if (e.key === "Escape") setEditingTitle(false); }}
            className="flex-1 text-base font-bold border-b-2 border-[#00D1FF] px-1 py-0.5 focus:outline-none bg-transparent"
          />
        ) : (
          <h2 className="text-base font-bold cursor-text hover:text-[#00A3C4] flex-1 truncate transition-colors" onClick={() => { setEditingTitle(true); setTitleVal(entry.title); }}>
            {entry.title}
          </h2>
        )}

        {/* Save status indicator */}
        {!isMediaFile && (
          <div className="flex items-center gap-1 text-[10px]">
            {saveState === "saved" && <><Cloud size={12} className="text-green-400" /><span className="text-gray-400">已保存</span></>}
            {saveState === "saving" && <><Cloud size={12} className="text-[#00D1FF] animate-pulse" /><span className="text-gray-400">保存中…</span></>}
            {saveState === "dirty" && (
              <button onClick={handleManualSave} className="flex items-center gap-1 text-orange-400 hover:text-orange-500">
                <CloudOff size={12} /><span>未保存</span>
              </button>
            )}
          </div>
        )}

        <PixelBadge color={entry.status === "approved" ? "green" : entry.status === "pending" ? "yellow" : "gray"}>
          {entry.status === "approved" ? "已通过" : entry.status === "pending" ? "待审核" : entry.status}
        </PixelBadge>

        {entry.file_ext && (
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
            {entry.file_ext.replace(".", "").toUpperCase()}
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {onMoveToFolder && folders && folders.length > 0 && (
            <div className="relative" ref={folderPickerRef}>
              <button
                onClick={() => setShowFolderPicker((v) => !v)}
                className="px-2 py-1 rounded-md text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
              >
                {entry.folder_id ? "移动到…" : "归入文件夹"}
              </button>
              {showFolderPicker && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[180px] max-h-60 overflow-y-auto">
                  <div className="text-[10px] font-semibold text-gray-400 px-3 py-2 border-b border-gray-100">选择文件夹</div>
                  {entry.folder_id && (
                    <button
                      onClick={() => { onMoveToFolder(entry.id, null); setShowFolderPicker(false); }}
                      className="w-full text-left px-3 py-2 text-[11px] text-gray-500 hover:bg-gray-50 border-b border-gray-50"
                    >
                      移出文件夹
                    </button>
                  )}
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => { onMoveToFolder(entry.id, f.id); setShowFolderPicker(false); }}
                      className={`w-full text-left px-3 py-2 text-[11px] hover:bg-[#F0F9FF] transition-colors ${entry.folder_id === f.id ? "text-[#00A3C4] bg-[#F0FAFF]" : "text-gray-700"}`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Download button for files with OSS */}
          {entry.oss_key && (
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
              className="p-1.5 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="下载原始文件"
            >
              <Download size={14} />
            </button>
          )}

          <button
            onClick={() => onDelete(entry.id)}
            className="px-2 py-1 rounded-md text-[10px] font-medium text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            删除
          </button>
        </div>
      </div>

      {/* AI summary (collapsed by default, minimal) */}
      {(entry.ai_summary || entry.ai_tags) && (
        <AiSummaryBar entry={entry} />
      )}

      {/* Document area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isMediaFile ? (
          <div className="h-full overflow-y-auto">
            <DocumentViewer entry={entry} />
          </div>
        ) : (
          <RichEditor
            key={entry.id}
            content={htmlVal}
            onChange={handleContentChange}
            editable={true}
          />
        )}
      </div>
    </div>
  );
}

// Collapsible AI summary bar
function AiSummaryBar({ entry }: { entry: KnowledgeDetail }) {
  const [expanded, setExpanded] = useState(false);
  const allTags = [
    ...(entry.ai_tags?.industry || []),
    ...(entry.ai_tags?.platform || []),
    ...(entry.ai_tags?.topic || []),
  ];

  return (
    <div className="border-b border-gray-100 flex-shrink-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-1.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-[9px] font-semibold text-[#00A3C4] uppercase tracking-wider">AI</span>
        {!expanded && allTags.length > 0 && (
          <div className="flex gap-1 overflow-hidden flex-1">
            {allTags.slice(0, 4).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-[#F0F9FF] text-[8px] text-[#00A3C4] rounded-sm whitespace-nowrap">{tag}</span>
            ))}
            {allTags.length > 4 && <span className="text-[8px] text-gray-400">+{allTags.length - 4}</span>}
          </div>
        )}
        <span className="text-[8px] text-gray-400 ml-auto">{expanded ? "收起" : "展开"}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-2.5 space-y-2">
          {entry.ai_summary && (
            <p className="text-[11px] text-gray-600 leading-relaxed">{entry.ai_summary}</p>
          )}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-[#F0F9FF] border border-[#00D1FF]/20 text-[9px] text-[#00A3C4] rounded-sm">{tag}</span>
              ))}
            </div>
          )}
          {entry.quality_score != null && (
            <div className="text-[9px] text-gray-400">质量分 {(entry.quality_score * 100).toFixed(0)}%</div>
          )}
        </div>
      )}
    </div>
  );
}
