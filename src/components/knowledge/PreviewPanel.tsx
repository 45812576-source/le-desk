"use client";

import { Component, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { Eye, Download, Cloud, CloudOff, Lock, Send, Clock, RefreshCw, AlertTriangle, Loader2, Link2 } from "lucide-react";
import { PixelIcon, ICONS, PixelBadge } from "@/components/pixel";
import { useTheme } from "@/lib/theme";
import type {
  EditPermissionCheck,
  GovernanceBlueprintPayload,
  GovernanceObjective,
  GovernanceResourceLibrary,
  GovernanceSuggestionTask,
  KnowledgeDetail,
  KnowledgeShareLink,
  User,
} from "@/lib/types";
import { apiFetch } from "@/lib/api";
import { RichEditor } from "@/components/knowledge/RichEditor";
import { CollabEditor } from "@/components/knowledge/CollabEditor";
import DocumentViewer from "@/components/knowledge/DocumentViewer";
import GovernanceReviewCard from "@/components/governance/GovernanceReviewCard";

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
  onRetryRender?: () => void;
}

export default function PreviewPanel({
  entry,
  currentUser,
  onUpdateContent,
  onDelete,
  onRename,
  folders,
  onMoveToFolder,
  onRetryRender,
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
  const [shareLink, setShareLink] = useState<KnowledgeShareLink | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [showSharePanel, setShowSharePanel] = useState(false);
  const [governanceBlueprint, setGovernanceBlueprint] = useState<GovernanceBlueprintPayload | null>(null);
  const [governanceSuggestions, setGovernanceSuggestions] = useState<GovernanceSuggestionTask[]>([]);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [governanceActionLoading, setGovernanceActionLoading] = useState(false);

  const entryId = entry?.id ?? null;

  const ext = (entry?.file_ext || "").toLowerCase();
  const isMediaFile = entry?.oss_key && MEDIA_EXTS.has(ext);
  const isLarkDoc = entry?.source_type === "lark_doc";
  const isDetachedLarkCopy = isLarkDoc && entry?.external_edit_mode === "detached_copy";

  // Fetch edit permission from backend when entry changes
  useEffect(() => {
    if (!entry) {
      setPermCheck(null); // eslint-disable-line react-hooks/set-state-in-effect -- reset on null entry
      setShareLink(null); // eslint-disable-line react-hooks/set-state-in-effect -- reset on null entry
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

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    apiFetch<KnowledgeShareLink[]>(`/knowledge/${entry.id}/share-links`)
      .then((data) => {
        if (!cancelled) setShareLink(data.find((item) => item.is_active) || null);
      })
      .catch(() => {
        if (!cancelled) setShareLink(null);
      });
    return () => { cancelled = true; };
  }, [entry]);

  useEffect(() => {
    if (!entry || !currentUser || (currentUser.role !== "super_admin" && currentUser.role !== "dept_admin")) {
      setGovernanceSuggestions([]);
      return;
    }
    let cancelled = false;
    setGovernanceLoading(true);
    Promise.all([
      apiFetch<GovernanceBlueprintPayload>("/knowledge-governance/blueprint"),
      apiFetch<GovernanceSuggestionTask[]>(`/knowledge-governance/suggestions?subject_type=knowledge&subject_id=${entry.id}`),
    ])
      .then(([blueprint, suggestions]) => {
        if (cancelled) return;
        setGovernanceBlueprint(blueprint);
        setGovernanceSuggestions(suggestions);
      })
      .catch(() => {
        if (cancelled) return;
        setGovernanceBlueprint(null);
        setGovernanceSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setGovernanceLoading(false);
      });
    return () => { cancelled = true; };
  }, [entry, currentUser]);

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
        {!isMediaFile && (
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
            <Link2 size={12} className="text-[#00A3C4]" />
            <span className="text-[#00A3C4]">来源: 飞书</span>
          </div>
        )}

        {isDetachedLarkCopy && (
          <div className="flex items-center gap-1 text-[10px]">
            <Cloud size={12} className="text-[#00CC99]" />
            <span className="text-[#00CC99]">模式: 工作台副本</span>
          </div>
        )}

        <PixelBadge color={entry.status === "approved" ? "green" : entry.status === "pending" ? "yellow" : "gray"}>
          {entry.status === "approved" ? "已通过" : entry.status === "pending" ? "待审核" : entry.status}
        </PixelBadge>

        {currentUser?.role === "super_admin" && entry.visibility_scope && (
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
            可见性: {entry.visibility_scope.scope}
          </span>
        )}

        {entry.business_unit && (
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-600 border border-sky-200">
            事业部: {entry.business_unit}
          </span>
        )}

        {entry.doc_render_mode === "pdf_vision_ocr" && (
          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 border border-violet-200">
            已通过视觉模型提取
          </span>
        )}

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
          {entry && (
            <div className="relative">
              <button
                onClick={async () => {
                  setShowSharePanel((v) => !v);
                  if (!shareLink && !shareLoading) {
                    setShareLoading(true);
                    try {
                      const created = await apiFetch<KnowledgeShareLink>(`/knowledge/${entry.id}/share-links`, { method: "POST" });
                      setShareLink(created);
                    } catch {}
                    setShareLoading(false);
                  }
                }}
                className="px-2 py-1 rounded-md text-[10px] font-medium text-[#00A3C4] hover:bg-[#F0F9FF] transition-colors"
              >
                分享链接
              </button>
              {showSharePanel && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[280px] p-3 space-y-2">
                  <div className="text-[10px] font-semibold text-gray-500">
                    {shareLink ? "当前分享已开启" : shareLoading ? "生成链接中..." : "暂无分享链接"}
                  </div>
                  <div className="text-[10px] break-all text-gray-600 bg-gray-50 border border-gray-100 rounded px-2 py-2">
                    {shareLink?.share_url || "点击上方按钮生成分享链接"}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!shareLink}
                      onClick={async () => {
                        if (!shareLink?.share_url) return;
                        await navigator.clipboard.writeText(shareLink.share_url);
                      }}
                      className="px-2 py-1 text-[9px] font-bold border border-[#00A3C4] text-[#00A3C4] hover:bg-[#F0F9FF] disabled:opacity-50"
                    >
                      复制链接
                    </button>
                    <button
                      disabled={!shareLink}
                      onClick={() => {
                        if (!shareLink?.share_url) return;
                        window.open(shareLink.share_url, "_blank");
                      }}
                      className="px-2 py-1 text-[9px] font-bold border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      浏览器打开
                    </button>
                    <button
                      disabled={!shareLink}
                      onClick={async () => {
                        if (!shareLink) return;
                        await apiFetch(`/knowledge/share-links/${shareLink.id}`, { method: "DELETE" });
                        setShareLink(null);
                        setShowSharePanel(false);
                      }}
                      className="ml-auto px-2 py-1 text-[9px] font-bold border border-red-300 text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      关闭分享
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI summary (collapsed by default, minimal) */}
      {(entry.ai_summary || entry.ai_tags || entry.understanding_status) && (
        <AiSummaryBar entry={entry} />
      )}

      {entry.is_in_my_knowledge && entry.status === "pending" && (
        <div className="px-5 py-2 border-b border-yellow-200 bg-yellow-50 text-[10px] text-yellow-700">
          该文档已进入「我的知识」，当前状态为待审核。审核通过前，其他员工不会按全员可见规则看到它。
        </div>
      )}

      {entry && currentUser && (currentUser.role === "super_admin" || currentUser.role === "dept_admin") && (
        <div className="px-5 py-3 border-b border-gray-100 bg-[#F8FCFF]">
          <GovernanceReviewCard
          subjectType="knowledge"
          subjectId={entry.id}
          subjectLabel={`知识文档 #${entry.id}`}
          state={entry}
          blueprint={governanceBlueprint}
          suggestions={governanceSuggestions}
          loading={governanceLoading}
          actionLoading={governanceActionLoading}
          onGenerate={async () => {
            setGovernanceActionLoading(true);
            try {
              await apiFetch(`/knowledge-governance/knowledge/${entry.id}/suggest`, { method: "POST" });
              const [blueprint, suggestions] = await Promise.all([
                apiFetch<GovernanceBlueprintPayload>("/knowledge-governance/blueprint"),
                apiFetch<GovernanceSuggestionTask[]>(`/knowledge-governance/suggestions?subject_type=knowledge&subject_id=${entry.id}`),
              ]);
              setGovernanceBlueprint(blueprint);
              setGovernanceSuggestions(suggestions);
            } finally {
              setGovernanceActionLoading(false);
            }
          }}
          onApply={async (objectiveId, resourceLibraryId, note) => {
            setGovernanceActionLoading(true);
            try {
              await apiFetch("/knowledge-governance/apply", {
                method: "POST",
                body: JSON.stringify({
                  subject_type: "knowledge",
                  subject_id: entry.id,
                  objective_id: objectiveId,
                  resource_library_id: resourceLibraryId,
                  governance_status: "aligned",
                  governance_note: note,
                }),
              });
              const [blueprint, suggestions] = await Promise.all([
                apiFetch<GovernanceBlueprintPayload>("/knowledge-governance/blueprint"),
                apiFetch<GovernanceSuggestionTask[]>(`/knowledge-governance/suggestions?subject_type=knowledge&subject_id=${entry.id}`),
              ]);
              setGovernanceBlueprint(blueprint);
              setGovernanceSuggestions(suggestions);
            } finally {
              setGovernanceActionLoading(false);
            }
          }}
          onBound={async () => {
            const full = await apiFetch<KnowledgeDetail>(`/knowledge/${entry.id}`);
            setGovernanceSuggestions(await apiFetch<GovernanceSuggestionTask[]>(`/knowledge-governance/suggestions?subject_type=knowledge&subject_id=${entry.id}`));
            setGovernanceBlueprint(await apiFetch<GovernanceBlueprintPayload>("/knowledge-governance/blueprint"));
            setHtmlVal(full.content_html || toHtml(full.content ?? ""));
          }}
          />
        </div>
      )}

      {currentUser?.role === "super_admin" && entry.visibility_scope && (
        <div className="px-5 py-2 border-b border-gray-100 text-[10px] text-gray-500 bg-amber-50/50">
          {entry.visibility_scope.reason === "approved"
            ? "该文档当前按已审批文档规则可被其他员工看到。"
            : `该文档当前仅按未审批规则对创建者/本部门可见。owner=${entry.visibility_scope.owner_id ?? "-"} dept=${entry.visibility_scope.department_id ?? "-"}`}
          {entry.raw_title && entry.raw_title !== entry.title && (
            <span className="ml-2 text-gray-400">原始标题: {entry.raw_title}</span>
          )}
          {entry.business_unit && (
            <span className="ml-2 text-gray-500">文档事业部: {entry.business_unit}</span>
          )}
          {entry.folder_business_unit && (
            <span className="ml-2 text-gray-500">目录事业部: {entry.folder_business_unit}</span>
          )}
          {entry.business_unit && entry.folder_business_unit && entry.business_unit !== entry.folder_business_unit && (
            <span className="ml-2 text-red-500 font-semibold">跨事业部错挂风险</span>
          )}
        </div>
      )}

      {/* 飞书同步状态栏 */}
      {isLarkDoc && (
        <LarkSyncBar entry={entry} />
      )}

      {/* Document area — 多级渲染 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {permLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="text-[#00D1FF] animate-spin" />
          </div>
        ) : (
          <DocumentRenderResolver
            entry={entry}
            htmlVal={htmlVal}
            canEdit={canEdit}
            onContentChange={handleContentChange}
            currentUser={currentUser}
            onUpdateContent={onUpdateContent}
            onRetry={onRetryRender}
          />
        )}
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
  onRetry,
}: {
  entry: KnowledgeDetail;
  htmlVal: string;
  canEdit: boolean;
  onContentChange: (html: string) => void;
  currentUser: User | null;
  onUpdateContent: (id: number, content: string, contentHtml?: string) => Promise<void>;
  onRetry?: () => void;
}) {
  const ext = (entry.file_ext || "").toLowerCase();
  const renderStatus = entry.doc_render_status;
  const isMedia = entry.oss_key && MEDIA_EXTS.has(ext);

  // 1. 正在转换中 — 显示进度提示，同时允许编辑正文 fallback
  if (renderStatus === "processing" || renderStatus === "pending") {
    const hasFallback = !!(entry.content || htmlVal);
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-2 bg-[#F0F9FF] border-b border-[#00D1FF]/20 flex-shrink-0">
          <Loader2 size={14} className="text-[#00D1FF] animate-spin" />
          <span className="text-[10px] text-[#00A3C4] font-medium">
            {hasFallback ? "已生成可编辑副本，云文档转换中" : "正在解析文档内容..."}
          </span>
        </div>
        {/* 转换中也允许编辑正文 */}
        {hasFallback ? (
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
        <RenderFailedBanner entry={entry} onRetry={onRetry} />
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
function RenderFailedBanner({ entry, onRetry }: { entry: KnowledgeDetail; onRetry?: () => void }) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await apiFetch(`/knowledge/${entry.id}/render`, { method: "POST" });
      onRetry?.();
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
      <span className="text-[#00A3C4] font-medium">飞书来源</span>

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
        {syncing ? "刷新中..." : "从飞书刷新"}
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

  const ct = entry.understanding_content_tags;
  const contentTagList = ct ? [ct.subject_tag, ct.object_tag, ct.scenario_tag, ct.action_tag, ct.industry_or_domain_tag].filter(Boolean) as string[] : [];
  const dataHits = entry.understanding_data_type_hits || [];

  const DOC_TYPE_LABELS: Record<string, string> = {
    policy: "制度/政策", sop: "SOP", contract: "合同/协议", proposal: "方案/提案", report: "报告",
    meeting_note: "会议纪要", customer_material: "客户材料", product_doc: "产品文档", finance_doc: "财务文档",
    hr_doc: "人事文档", case_study: "案例/复盘", training_material: "培训材料", external_intel: "外部情报",
    data_export: "数据导出", form_template: "表单/模板", media_plan: "媒介方案", creative_brief: "创意简报",
    pitch_deck: "比稿方案", campaign_review: "项目复盘", vendor_material: "供应商材料", legal_doc: "法务文档", other: "其他",
  };
  const PERM_DOMAIN_LABELS: Record<string, string> = {
    public: "全员可见", department: "部门内可见", team: "团队可见",
    owner_only: "仅创建者", confidential: "机密-需审批",
  };
  const DESENS_LABELS: Record<string, string> = { D0: "公开", D1: "内部", D2: "敏感", D3: "机密", D4: "绝密" };
  const DESENS_COLORS: Record<string, string> = {
    D0: "bg-green-50 text-green-600 border-green-200",
    D1: "bg-blue-50 text-blue-600 border-blue-200",
    D2: "bg-yellow-50 text-yellow-600 border-yellow-200",
    D3: "bg-orange-50 text-orange-600 border-orange-200",
    D4: "bg-red-50 text-red-600 border-red-200",
  };

  return (
    <div className="border-b border-gray-100 flex-shrink-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-1.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-[9px] font-semibold text-[#00A3C4] uppercase tracking-wider">AI</span>
        {!expanded && (
          <div className="flex gap-1 overflow-hidden flex-1 items-center">
            {entry.understanding_document_type && DOC_TYPE_LABELS[entry.understanding_document_type] && (
              <span className="px-1.5 py-0.5 bg-indigo-50 text-[8px] text-indigo-500 rounded-sm whitespace-nowrap border border-indigo-100">{DOC_TYPE_LABELS[entry.understanding_document_type]}</span>
            )}
            {entry.understanding_desensitization_level && (
              <span className={`px-1.5 py-0.5 text-[8px] rounded-sm whitespace-nowrap border ${DESENS_COLORS[entry.understanding_desensitization_level] || ""}`}>{entry.understanding_desensitization_level} {DESENS_LABELS[entry.understanding_desensitization_level] || ""}</span>
            )}
            {contentTagList.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-[#F0F9FF] text-[8px] text-[#00A3C4] rounded-sm whitespace-nowrap">{tag}</span>
            ))}
            {allTags.length > 0 && contentTagList.length === 0 && allTags.slice(0, 4).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 bg-[#F0F9FF] text-[8px] text-[#00A3C4] rounded-sm whitespace-nowrap">{tag}</span>
            ))}
          </div>
        )}
        <span className="text-[8px] text-gray-400 ml-auto flex-shrink-0">{expanded ? "收起" : "展开"}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-2.5 space-y-2">
          {/* 文档理解摘要 */}
          {entry.understanding_summary_short && (
            <p className="text-[11px] text-gray-600 leading-relaxed">{entry.understanding_summary_short}</p>
          )}
          {!entry.understanding_summary_short && entry.ai_summary && (
            <p className="text-[11px] text-gray-600 leading-relaxed">{entry.ai_summary}</p>
          )}

          {/* 文档类型 + 脱敏级别 */}
          {(entry.understanding_document_type || entry.understanding_desensitization_level) && (
            <div className="flex items-center gap-2 flex-wrap">
              {entry.understanding_document_type && DOC_TYPE_LABELS[entry.understanding_document_type] && (
                <span className="px-2 py-0.5 bg-indigo-50 text-[9px] text-indigo-600 rounded border border-indigo-100">
                  文档类型: {DOC_TYPE_LABELS[entry.understanding_document_type]}
                </span>
              )}
              {entry.understanding_desensitization_level && (
                <span className={`px-2 py-0.5 text-[9px] rounded border ${DESENS_COLORS[entry.understanding_desensitization_level] || ""}`}>
                  脱敏级别: {entry.understanding_desensitization_level} ({DESENS_LABELS[entry.understanding_desensitization_level] || ""})
                </span>
              )}
              {entry.understanding_permission_domain && (
                <span className="px-2 py-0.5 bg-teal-50 text-[9px] text-teal-600 rounded border border-teal-100">
                  权限域: {PERM_DOMAIN_LABELS[entry.understanding_permission_domain] || entry.understanding_permission_domain}
                </span>
              )}
              {entry.understanding_visibility_recommendation && (
                <span className="px-2 py-0.5 bg-gray-50 text-[9px] text-gray-500 rounded border border-gray-200">
                  建议可见性: {PERM_DOMAIN_LABELS[entry.understanding_visibility_recommendation] || entry.understanding_visibility_recommendation}
                </span>
              )}
            </div>
          )}

          {/* 5维内容标签 */}
          {contentTagList.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-gray-400 font-medium">内容标签</div>
              <div className="flex flex-wrap gap-1">
                {ct?.subject_tag && <span className="px-1.5 py-0.5 bg-purple-50 border border-purple-100 text-[9px] text-purple-600 rounded-sm">主体: {ct.subject_tag}</span>}
                {ct?.object_tag && <span className="px-1.5 py-0.5 bg-sky-50 border border-sky-100 text-[9px] text-sky-600 rounded-sm">对象: {ct.object_tag}</span>}
                {ct?.scenario_tag && <span className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-100 text-[9px] text-emerald-600 rounded-sm">场景: {ct.scenario_tag}</span>}
                {ct?.action_tag && <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-100 text-[9px] text-amber-600 rounded-sm">动作: {ct.action_tag}</span>}
                {ct?.industry_or_domain_tag && <span className="px-1.5 py-0.5 bg-rose-50 border border-rose-100 text-[9px] text-rose-600 rounded-sm">领域: {ct.industry_or_domain_tag}</span>}
              </div>
            </div>
          )}

          {/* 数据类型命中 */}
          {dataHits.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-gray-400 font-medium">检测到的数据类型</div>
              <div className="flex flex-wrap gap-1">
                {dataHits.map((hit, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-red-50 border border-red-100 text-[9px] text-red-600 rounded-sm">
                    {hit.label} ×{hit.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 检索摘要 */}
          {entry.understanding_summary_search && (
            <div className="space-y-1">
              <div className="text-[9px] text-gray-400 font-medium">检索摘要</div>
              <p className="text-[10px] text-gray-500 leading-relaxed bg-gray-50 rounded p-2">{entry.understanding_summary_search}</p>
            </div>
          )}

          {/* 建议标签（低置信度/词表外） */}
          {(entry.understanding_suggested_tags?.length ?? 0) > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-gray-400 font-medium">建议标签</div>
              <div className="flex flex-wrap gap-1">
                {entry.understanding_suggested_tags!.map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-gray-50 border border-gray-200 border-dashed text-[9px] text-gray-500 rounded-sm">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {entry.quality_score != null && (
            <div className="text-[9px] text-gray-400">质量分 {(entry.quality_score * 100).toFixed(0)}%</div>
          )}

          {/* 理解状态 + 重跑按钮 */}
          <div className="flex items-center gap-2">
            {entry.understanding_status && entry.understanding_status !== "success" && (
              <span className="text-[8px] text-gray-400">
                理解状态: {entry.understanding_status === "running" ? "处理中..." : entry.understanding_status === "partial" ? "部分完成" : entry.understanding_status === "failed" ? "失败" : entry.understanding_status}
              </span>
            )}
            {entry.understanding_status && entry.understanding_status !== "running" && (
              <button
                onClick={async () => {
                  try {
                    await apiFetch(`/knowledge/${entry.id}/understand`, { method: "POST" });
                  } catch {}
                }}
                className="text-[8px] text-[#00A3C4] hover:underline"
              >
                {entry.understanding_status === "success" ? "重新理解" : "重跑理解"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
