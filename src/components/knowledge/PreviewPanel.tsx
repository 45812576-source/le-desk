"use client";

import { Component, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { Eye, Download, Cloud, CloudOff, Lock, Send, Clock, RefreshCw, AlertTriangle, Loader2, Link2 } from "lucide-react";
import { PixelIcon, ICONS, PixelBadge } from "@/components/pixel";
import { useTheme } from "@/lib/theme";
import type { EditPermissionCheck, KnowledgeDetail, User } from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { RichEditor } from "@/components/knowledge/RichEditor";
import { CollabEditor } from "@/components/knowledge/CollabEditor";
import DocumentViewer from "@/components/knowledge/DocumentViewer";

// ─── ErrorBoundary for editor fallback ──────────────────────────────────────
class EditorErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { /* logged by browser */ }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

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
  currentUser: User | null;
  onUpdateContent: (id: number, content: string, contentHtml?: string) => Promise<void>;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
  folders?: Folder[];
  onMoveToFolder?: (entryId: number, folderId: number | null) => void;
}

export default function PreviewPanel({
  entry,
  currentUser,
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

  // API-based permission state
  const [permCheck, setPermCheck] = useState<EditPermissionCheck | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [requestingEdit, setRequestingEdit] = useState(false);

  const entryId = entry?.id ?? null;

  const ext = (entry?.file_ext || "").toLowerCase();
  const isMediaFile = entry?.oss_key && MEDIA_EXTS.has(ext);
  const isLarkDoc = entry?.source_type === "lark_doc";

  // Fetch edit permission from backend when entry changes
  useEffect(() => {
    if (!entry) {
      setPermCheck(null); // eslint-disable-line react-hooks/set-state-in-effect -- reset on null entry
      return;
    }
    let cancelled = false;
    setPermLoading(true);
    apiFetch<EditPermissionCheck>(`/knowledge/${entry.id}/edit-permission`)
      .then((data) => { if (!cancelled) setPermCheck(data); })
      .catch(() => { if (!cancelled) setPermCheck(null); })
      .finally(() => { if (!cancelled) setPermLoading(false); });
    return () => { cancelled = true; };
  }, [entry, entryId]);

  const canEdit = permCheck?.can_edit ?? false;

  // Init content on entry switch
  useEffect(() => {
    setEditingTitle(false); // eslint-disable-line react-hooks/set-state-in-effect -- synchronize local state with entry prop
    setTitleVal(entry?.title ?? "");
    setSaveState("saved");
    entryIdRef.current = entry?.id ?? null;
    // Use content_html if available, otherwise convert content to HTML
    const html = entry?.content_html || toHtml(entry?.content ?? "");
    setHtmlVal(html);
    // Clear any pending auto-save from previous entry
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, [entry, entryId]);

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
    if (!canEdit) return;
    setHtmlVal(newHtml);
    setSaveState("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const id = entryIdRef.current;
    if (id != null) {
      saveTimerRef.current = setTimeout(() => doSave(id, newHtml), 2000);
    }
  }, [doSave, canEdit]);

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
          <h2
            className={`text-base font-bold flex-1 truncate transition-colors ${canEdit ? "cursor-text hover:text-[#00A3C4]" : ""}`}
            onClick={canEdit ? () => { setEditingTitle(true); setTitleVal(entry.title); } : undefined}
          >
            {entry.title}
          </h2>
        )}

        {/* Save status indicator / read-only badge / request edit */}
        {!isMediaFile && !isLarkDoc && (
          <div className="flex items-center gap-1.5 text-[10px]">
            {!canEdit && !permCheck?.pending_request && (
              <>
                <Lock size={12} className="text-gray-400" />
                <span className="text-gray-400">只读</span>
                {!permCheck?.is_owner && !permLoading && (
                  <button
                    disabled={requestingEdit}
                    onClick={async () => {
                      if (!entry) return;
                      setRequestingEdit(true);
                      try {
                        await apiFetch(`/knowledge/${entry.id}/request-edit`, { method: "POST" });
                        // Refresh permission state
                        const updated = await apiFetch<EditPermissionCheck>(`/knowledge/${entry.id}/edit-permission`);
                        setPermCheck(updated);
                      } catch { /* ignore */ }
                      setRequestingEdit(false);
                    }}
                    className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#00D1FF]/10 text-[#00A3C4] hover:bg-[#00D1FF]/20 transition-colors font-medium"
                  >
                    <Send size={10} />
                    {requestingEdit ? "申请中…" : "申请编辑权限"}
                  </button>
                )}
              </>
            )}
            {!canEdit && permCheck?.pending_request && (
              <span className="flex items-center gap-1 text-amber-500">
                <Clock size={12} className="animate-pulse" />
                审批中…
              </span>
            )}
            {canEdit && saveState === "saved" && <><Cloud size={12} className="text-green-400" /><span className="text-gray-400">已保存</span></>}
            {canEdit && saveState === "saving" && <><Cloud size={12} className="text-[#00D1FF] animate-pulse" /><span className="text-gray-400">保存中…</span></>}
            {canEdit && saveState === "dirty" && (
              <button onClick={handleManualSave} className="flex items-center gap-1 text-orange-400 hover:text-orange-500">
                <CloudOff size={12} /><span>未保存</span>
              </button>
            )}
          </div>
        )}

        {isLarkDoc && (
          <div className="flex items-center gap-1 text-[10px]">
            <Lock size={12} className="text-[#00A3C4]" />
            <span className="text-[#00A3C4]">飞书只读</span>
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

          {canEdit && (
            <button
              onClick={() => onDelete(entry.id)}
              className="px-2 py-1 rounded-md text-[10px] font-medium text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              删除
            </button>
          )}
        </div>
      </div>

      {/* AI summary (collapsed by default, minimal) */}
      {(entry.ai_summary || entry.ai_tags) && (
        <AiSummaryBar entry={entry} />
      )}

      {/* 飞书同步状态栏 */}
      {isLarkDoc && (
        <LarkSyncBar entry={entry} />
      )}

      {/* Document area — 多级渲染 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <DocumentRenderResolver
          entry={entry}
          htmlVal={htmlVal}
          canEdit={canEdit && !isLarkDoc}
          onContentChange={handleContentChange}
          currentUser={currentUser}
          onUpdateContent={onUpdateContent}
        />
      </div>
    </div>
  );
}

// 预览失败 fallback
function ViewerFallback({ entry }: { entry: KnowledgeDetail }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
      <AlertTriangle size={20} />
      <p className="text-[10px]">预览加载失败</p>
      {entry.oss_key && (
        <button
          onClick={async () => {
            try {
              const res = await fetch(`/api/proxy/knowledge/${entry.id}/file-url`);
              if (res.ok) { const data = await res.json(); window.open(data.url, "_blank"); }
            } catch {}
          }}
          className="flex items-center gap-1 text-[10px] text-[#00A3C4] hover:underline"
        >
          <Download size={12} /> 下载原始文件
        </button>
      )}
    </div>
  );
}

// ─── 多级渲染 Resolver ────────────────────────────────────────────────────────
function DocumentRenderResolver({
  entry,
  htmlVal,
  canEdit,
  onContentChange,
  currentUser,
  onUpdateContent,
}: {
  entry: KnowledgeDetail;
  htmlVal: string;
  canEdit: boolean;
  onContentChange: (html: string) => void;
  currentUser: User | null;
  onUpdateContent: (id: number, content: string, contentHtml?: string) => Promise<void>;
}) {
  const ext = (entry.file_ext || "").toLowerCase();
  const renderStatus = entry.doc_render_status;
  const isMedia = entry.oss_key && MEDIA_EXTS.has(ext);

  // 1. 正在转换中 — 显示进度提示，同时允许编辑正文 fallback
  if (renderStatus === "processing" || renderStatus === "pending") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-2 bg-[#F0F9FF] border-b border-[#00D1FF]/20 flex-shrink-0">
          <Loader2 size={14} className="text-[#00D1FF] animate-spin" />
          <span className="text-[10px] text-[#00A3C4] font-medium">云文档转换中，转换完成后可在线预览和协同编辑</span>
        </div>
        {/* 转换中也允许编辑正文 */}
        {(entry.content || htmlVal) ? (
          <RichEditor key={entry.id} content={htmlVal} onChange={onContentChange} editable={canEdit} />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <Loader2 size={24} className="text-[#00D1FF] animate-spin" />
            <p className="text-[9px]">正在解析文档内容...</p>
          </div>
        )}
      </div>
    );
  }

  // 2. 转换失败 — 显示原因 + 回退编辑
  if (renderStatus === "failed") {
    return (
      <div className="flex flex-col h-full">
        <RenderFailedBanner entry={entry} />
        {/* 回退到下层渲染：即使转换失败也允许编辑 */}
        {isMedia ? (
          <div className="flex-1 overflow-y-auto">
            <DocumentViewer entry={entry} />
          </div>
        ) : (entry.content || htmlVal) ? (
          <RichEditor key={entry.id} content={htmlVal} onChange={onContentChange} editable={canEdit} />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <AlertTriangle size={20} />
            <p className="text-[10px]">云文档转换失败，暂无可编辑内容</p>
          </div>
        )}
      </div>
    );
  }

  // 3. content_html ready → CollabEditor（协同）或 RichEditor（非媒体文件）
  if (renderStatus === "ready" && entry.content_html && !isMedia) {
    if (currentUser && canEdit) {
      return (
        <EditorErrorBoundary fallback={<RichEditor key={entry.id} content={htmlVal} onChange={onContentChange} editable={canEdit} />}>
          <CollabEditor
            key={`collab-${entry.id}`}
            knowledgeId={entry.id}
            initialHtml={htmlVal}
            editable
            userName={currentUser.username || currentUser.display_name || "用户"}
            onSave={(html, text) => onUpdateContent(entry.id, text, html)}
          />
        </EditorErrorBoundary>
      );
    }
    return <RichEditor key={entry.id} content={htmlVal} onChange={onContentChange} editable={canEdit} />;
  }

  // 4. 媒体文件（PDF/图片/音视频）→ 原生预览
  if (isMedia) {
    return (
      <EditorErrorBoundary fallback={<ViewerFallback entry={entry} />}>
        <div className="h-full overflow-y-auto">
          <DocumentViewer entry={entry} />
        </div>
      </EditorErrorBoundary>
    );
  }

  // 5. OnlyOffice 可打开的 Office 文件
  if (entry.can_open_onlyoffice && entry.oss_key) {
    return (
      <EditorErrorBoundary fallback={<ViewerFallback entry={entry} />}>
        <div className="h-full overflow-y-auto">
          <DocumentViewer entry={entry} />
        </div>
      </EditorErrorBoundary>
    );
  }

  // 6. 非媒体、非 OnlyOffice → 直接进编辑器
  // 即使 content 为空（如新建空白文档），也必须打开编辑器让用户输入
  if (currentUser && canEdit) {
    return (
      <EditorErrorBoundary fallback={<RichEditor key={entry.id} content={htmlVal} onChange={onContentChange} editable={canEdit} />}>
        <CollabEditor
          key={`collab-${entry.id}`}
          knowledgeId={entry.id}
          initialHtml={htmlVal}
          editable
          userName={currentUser.username || currentUser.display_name || "用户"}
          onSave={(html, text) => onUpdateContent(entry.id, text, html)}
        />
      </EditorErrorBoundary>
    );
  }

  // 7. 只读 — 有内容则展示
  if (entry.content || htmlVal) {
    return <RichEditor key={entry.id} content={htmlVal} onChange={onContentChange} editable={false} />;
  }

  // 8. 兜底 — 真正无内容且只读
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
      <AlertTriangle size={24} />
      <p className="text-[11px]">此文档暂无可预览内容</p>
      {entry.oss_key && (
        <button
          onClick={async () => {
            try {
              const res = await fetch(`/api/proxy/knowledge/${entry.id}/file-url`);
              if (res.ok) { const data = await res.json(); window.open(data.url, "_blank"); }
            } catch {}
          }}
          className="flex items-center gap-1 text-[10px] text-[#00A3C4] hover:underline"
        >
          <Download size={12} /> 下载原始文件
        </button>
      )}
    </div>
  );
}

// 转换失败提示栏
function RenderFailedBanner({ entry }: { entry: KnowledgeDetail }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await apiFetch(`/knowledge/${entry.id}/render`, { method: "POST" });
      window.location.reload();
    } catch {}
    setRetrying(false);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex-shrink-0">
      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-amber-700 font-medium">云文档转换失败</p>
        {entry.doc_render_error && (
          <p className="text-[9px] text-amber-500 truncate">{entry.doc_render_error}</p>
        )}
      </div>
      <button
        onClick={handleRetry}
        disabled={retrying}
        className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-amber-600 border border-amber-300 hover:bg-amber-100 transition-colors disabled:opacity-50"
      >
        <RefreshCw size={10} className={retrying ? "animate-spin" : ""} />
        {retrying ? "重试中..." : "重试转换"}
      </button>
      {entry.oss_key && (
        <button
          onClick={async () => {
            try {
              const res = await fetch(`/api/proxy/knowledge/${entry.id}/file-url`);
              if (res.ok) { const data = await res.json(); window.open(data.url, "_blank"); }
            } catch {}
          }}
          className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-gray-500 border border-gray-300 hover:bg-gray-100 transition-colors"
        >
          <Download size={10} /> 下载原文件
        </button>
      )}
    </div>
  );
}

// 飞书同步状态栏
function LarkSyncBar({ entry }: { entry: KnowledgeDetail }) {
  const [syncing, setSyncing] = useState(false);

  const lastSynced = entry.lark_last_synced_at
    ? new Date(entry.lark_last_synced_at * 1000).toLocaleString("zh-CN")
    : null;

  async function handleSync() {
    setSyncing(true);
    try {
      await apiFetch(`/knowledge/${entry.id}/sync`, { method: "POST" });
      window.location.reload();
    } catch {}
    setSyncing(false);
  }

  return (
    <div className="flex items-center gap-2 px-5 py-1.5 border-b border-gray-100 flex-shrink-0 text-[10px]">
      <Link2 size={12} className="text-[#00A3C4]" />
      <span className="text-[#00A3C4] font-medium">飞书同步</span>

      {entry.sync_status === "ok" && (
        <span className="text-green-500">正常</span>
      )}
      {entry.sync_status === "syncing" && (
        <span className="text-blue-500 flex items-center gap-1">
          <Loader2 size={10} className="animate-spin" /> 同步中...
        </span>
      )}
      {entry.sync_status === "error" && (
        <span className="text-red-500 flex items-center gap-1">
          <AlertTriangle size={10} /> 同步异常
          {entry.sync_error && <span className="text-[8px] text-red-400 truncate max-w-[200px]">({entry.sync_error})</span>}
        </span>
      )}

      {lastSynced && (
        <span className="text-gray-400">上次同步: {lastSynced}</span>
      )}

      <button
        onClick={handleSync}
        disabled={syncing}
        className="ml-auto flex items-center gap-1 px-2 py-0.5 text-[9px] text-[#00A3C4] hover:bg-[#F0F9FF] rounded transition-colors disabled:opacity-50"
      >
        <RefreshCw size={10} className={syncing ? "animate-spin" : ""} />
        {syncing ? "同步中..." : "手动同步"}
      </button>

      {entry.lark_doc_url && (
        <a
          href={entry.lark_doc_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-gray-400 hover:text-[#00A3C4] transition-colors"
        >
          查看原文
        </a>
      )}
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
