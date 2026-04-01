"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type { KnowledgeDetail } from "@/lib/types";

// Extracted components
import FileRow from "@/components/knowledge/FileRow";
import FolderNode, { type Folder } from "@/components/knowledge/FolderNode";
import TaxonomyTreeView from "@/components/knowledge/TaxonomyTreeView";
import PreviewPanel from "@/components/knowledge/PreviewPanel";
import SearchTab from "@/components/knowledge/SearchTab";
import SkeletonLoader from "@/components/knowledge/SkeletonLoader";
import ContextMenu from "@/components/knowledge/ContextMenu";
import DropZone from "@/components/knowledge/DropZone";
import UploadProgress, { type UploadingFile } from "@/components/knowledge/UploadProgress";
import RecentFiles, { addRecentFile } from "@/components/knowledge/RecentFiles";
import CommentPanel from "@/components/knowledge/CommentPanel";

type Tab = "files" | "search";
type TreeMode = "user" | "rag";

function buildTree(folders: Folder[]): Map<number | null, Folder[]> {
  const map = new Map<number | null, Folder[]>();
  for (const f of folders) {
    const key = f.parent_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return map;
}

// Simple XHR upload with progress
function uploadFileXHR(file: File, onProgress: (pct: number) => void, folderId?: number | null): Promise<{ id: number }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("title", file.name);
    form.append("category", "experience");
    form.append("industry_tags", "[]");
    form.append("platform_tags", "[]");
    form.append("topic_tags", "[]");
    if (folderId) form.append("folder_id", String(folderId));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/proxy/knowledge/upload");

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(95, Math.round((e.loaded / e.total) * 95)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({ id: 0 }); }
      } else {
        let msg = `上传失败 (${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.detail || msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("网络错误"));
    xhr.timeout = 120_000;
    xhr.ontimeout = () => reject(new Error("上传超时"));
    xhr.send(form);
  });
}

// Toast component
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-6 right-6 z-[9999] bg-[#1A202C] text-white text-[10px] font-bold px-4 py-2 border-2 border-[#00CC99] animate-fade-in">
      {message}
    </div>
  );
}

// ─── File Manager Tab ─────────────────────────────────────────────────────────
function FileManagerTab() {
  const { user: currentUser } = useAuth();
  const [treeMode, setTreeMode] = useState<TreeMode>("user");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [entries, setEntries] = useState<KnowledgeDetail[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<number | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const [draggingEntryId, setDraggingEntryId] = useState<number | null>(null);
  const [rootDropTarget, setRootDropTarget] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: KnowledgeDetail } | null>(null);
  const [, setRenamingId] = useState<number | null>(null);

  // Lasso selection
  const treeRef = useRef<HTMLDivElement>(null);
  const [lasso, setLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const lassoStart = useRef<{ x: number; y: number } | null>(null);

  // Sidebar filter
  const [filterText, setFilterText] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [batchMode, setBatchMode] = useState(false);
  const [batchSuggestions, setBatchSuggestions] = useState<Record<number, { id: number; suggested_folder_id: number | null; suggested_folder_path: string; confidence: number; reason: string } | null>>({});
  const [batchLoading, setBatchLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [autoFilingRunning, setAutoFilingRunning] = useState(false);
  const [autoFilingResult, setAutoFilingResult] = useState<{ filed: number; skipped: number; low_confidence: number; batch_id: string; suggestions: Array<{ id: number; knowledge_id: number; title: string; suggested_folder_id: number; confidence: number; reason: string }> } | null>(null);
  const [pendingSuggestions, setPendingSuggestions] = useState<Array<{ id: number; knowledge_id: number; title: string; suggested_folder_id: number; suggested_folder_path: string; confidence: number; reason: string }>>([]);
  const [showPendingSuggestions, setShowPendingSuggestions] = useState(false);

  const handleSelectEntry = useCallback(async (e: KnowledgeDetail) => {
    setSelectedEntry(e);
    addRecentFile(e.id);
    try {
      const full = await apiFetch<KnowledgeDetail>(`/knowledge/${e.id}`);
      setSelectedEntry(full);
    } catch {}
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fds, ens] = await Promise.all([
        apiFetch<Folder[]>("/knowledge/folders"),
        apiFetch<KnowledgeDetail[]>("/knowledge"),
      ]);
      setFolders(Array.isArray(fds) ? fds : []);
      setEntries(Array.isArray(ens) ? ens : []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Lasso handlers
  function handleTreeMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-entry-id]") || target.closest("button") || target.closest("input")) return;
    lassoStart.current = { x: e.clientX, y: e.clientY };
    setLasso({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    setSelectedIds(new Set());
  }

  function handleTreeMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!lassoStart.current) return;
    const rect = { x1: Math.min(lassoStart.current.x, e.clientX), y1: Math.min(lassoStart.current.y, e.clientY), x2: Math.max(lassoStart.current.x, e.clientX), y2: Math.max(lassoStart.current.y, e.clientY) };
    setLasso(rect);
    if (!treeRef.current) return;
    const newIds = new Set<number>();
    treeRef.current.querySelectorAll<HTMLElement>("[data-entry-id]").forEach((el) => {
      const b = el.getBoundingClientRect();
      if (b.left < rect.x2 && b.right > rect.x1 && b.top < rect.y2 && b.bottom > rect.y1) {
        const id = parseInt(el.dataset.entryId!);
        if (!isNaN(id)) newIds.add(id);
      }
    });
    setSelectedIds(newIds);
  }

  function handleTreeMouseUp() {
    lassoStart.current = null;
    setLasso(null);
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`确认删除选中的 ${selectedIds.size} 个文件？`)) return;
    for (const id of selectedIds) {
      await apiFetch(`/knowledge/${id}`, { method: "DELETE" });
    }
    setSelectedIds(new Set());
    setSelectedEntry((prev) => prev && selectedIds.has(prev.id) ? null : prev);
    fetchAll();
  }

  // 权限过滤由后端完成，前端不再二次过滤
  const myEntries = entries; // was: currentUser

  // Apply sidebar filters
  const filteredEntries = myEntries.filter((e) => {
    // Text filter
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      const matchText = (e.ai_title || e.title || "").toLowerCase().includes(q) ||
                         (e.source_file || "").toLowerCase().includes(q);
      if (!matchText) return false;
    }
    // Source filter
    if (filterSource !== "all") {
      if (filterSource === "upload" && e.source_type !== "upload") return false;
      if (filterSource === "lark_doc" && e.source_type !== "lark_doc") return false;
      if (filterSource === "manual" && e.source_type !== "manual") return false;
    }
    // Status filter
    if (filterStatus !== "all") {
      if (filterStatus === "ready" && e.doc_render_status !== "ready") return false;
      if (filterStatus === "processing" && e.doc_render_status !== "processing" && e.doc_render_status !== "pending") return false;
      if (filterStatus === "failed" && e.doc_render_status !== "failed") return false;
      if (filterStatus === "sync_error" && e.sync_status !== "error") return false;
      if (filterStatus === "unfiled" && e.folder_id != null) return false;
    }
    return true;
  });

  const tree = buildTree(folders);
  const rootFiles = filteredEntries.filter((e) => !e.folder_id);

  function openNewFolder() {
    setNewFolderParentId(null);
    setNewFolderName("");
    setTimeout(() => newFolderInputRef.current?.focus(), 30);
  }

  async function submitNewFolder() {
    if (!newFolderName.trim()) { setNewFolderParentId(undefined); return; }
    await apiFetch("/knowledge/folders", {
      method: "POST",
      body: JSON.stringify({ name: newFolderName.trim(), parent_id: newFolderParentId ?? null }),
    });
    setNewFolderParentId(undefined);
    setNewFolderName("");
    fetchAll();
  }

  async function handleRename(id: number, name: string) {
    await apiFetch(`/knowledge/folders/${id}/rename`, { method: "PATCH", body: JSON.stringify({ name }) });
    fetchAll();
  }

  async function handleDelete(id: number) {
    if (!confirm("删除文件夹？其中的文件会移到上级。")) return;
    await apiFetch(`/knowledge/folders/${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function handleRenameEntry(id: number, title: string) {
    await apiFetch(`/knowledge/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
    fetchAll();
    setSelectedEntry((prev) => prev?.id === id ? { ...prev, title } : prev);
  }

  async function handleDeleteEntry(id: number) {
    if (!confirm("确认删除该文件？")) return;
    await apiFetch(`/knowledge/${id}`, { method: "DELETE" });
    setSelectedEntry((prev) => prev?.id === id ? null : prev);
    fetchAll();
  }

  async function handleUpdateContent(id: number, content: string, contentHtml?: string): Promise<void> {
    const body: Record<string, string> = { content };
    if (contentHtml !== undefined) body.content_html = contentHtml;
    await apiFetch(`/knowledge/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setSelectedEntry((prev) => prev?.id === id ? { ...prev, content, content_html: contentHtml ?? prev.content_html } : prev);
  }

  async function handleMoveEntry(entryId: number, folderId: number | null) {
    const url = folderId !== null
      ? `/knowledge/${entryId}/folder?folder_id=${folderId}`
      : `/knowledge/${entryId}/folder`;
    await apiFetch(url, { method: "PATCH" });
    setSelectedEntry((prev) => prev?.id === entryId ? { ...prev, folder_id: folderId } : prev);
    fetchAll();
  }

  async function handleUploadFiles(files: FileList | File[], folderId?: number | null) {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;

    // Initialize progress state
    const initFiles: UploadingFile[] = fileArr.map((f) => ({
      name: f.name,
      size: f.size,
      progress: 0,
      status: "uploading",
      ext: f.name.includes(".") ? `.${f.name.split(".").pop()}` : "",
    }));
    setUploadingFiles(initFiles);

    // Upload with max 3 concurrent
    const CONCURRENCY = 3;
    let lastUploadedId = 0;
    const results: { file: File; id: number }[] = [];

    async function uploadOne(file: File, idx: number) {
      try {
        const result = await uploadFileXHR(file, (pct) => {
          setUploadingFiles((prev) => prev.map((f, i) => i === idx ? { ...f, progress: pct } : f));
        }, folderId);
        setUploadingFiles((prev) => prev.map((f, i) => i === idx ? { ...f, progress: 100, status: "done" } : f));
        results.push({ file, id: result.id });
        lastUploadedId = result.id;
      } catch {
        setUploadingFiles((prev) => prev.map((f, i) => i === idx ? { ...f, status: "error" } : f));
      }
    }

    // Process in batches
    for (let i = 0; i < fileArr.length; i += CONCURRENCY) {
      const batch = fileArr.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((f, j) => uploadOne(f, i + j)));
    }

    // Done
    await fetchAll();
    setTimeout(() => setUploadingFiles([]), 1500);

    const doneCount = results.length;
    if (doneCount > 0) {
      setToast(`已上传 ${doneCount} 个文件`);
      // Auto-select last uploaded
      if (lastUploadedId) {
        try {
          const full = await apiFetch<KnowledgeDetail>(`/knowledge/${lastUploadedId}`);
          setSelectedEntry(full);
          addRecentFile(lastUploadedId);
        } catch {}
      }
    }
  }

  function handleContextMenu(e: React.MouseEvent, entry: KnowledgeDetail) {
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  }

  async function handleDownload(entry: KnowledgeDetail) {
    if (!entry.oss_key) return;
    try {
      const res = await fetch(`/api/proxy/knowledge/${entry.id}/file-url`);
      if (res.ok) {
        const data = await res.json();
        window.open(data.url, "_blank");
      }
    } catch {}
  }

  function handleCopyLink(entry: KnowledgeDetail) {
    const url = `${window.location.origin}/knowledge/${entry.id}`;
    navigator.clipboard.writeText(url).then(() => setToast("链接已复制"));
  }

  return (
    <div className="flex h-full border-2 border-[#1A202C]">
      {/* Left: file tree */}
      <div
        className={`w-80 flex-shrink-0 border-r-2 border-[#1A202C] flex flex-col transition-colors ${treeMode === "user" && dragging ? "bg-[#CCF2FF]/20" : "bg-[#F0F4F8]"}`}
        onDragOver={(e) => { if (treeMode === "user" && !draggingEntryId) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={(e) => { if (treeMode !== "user" || draggingEntryId) return; e.preventDefault(); setDragging(false); handleUploadFiles(e.dataTransfer.files); }}
        onDragEnd={() => setDraggingEntryId(null)}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b-2 border-[#1A202C]">
          {/* Mode toggle */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setTreeMode("user")}
              className={`flex-1 py-1 text-[8px] font-bold uppercase tracking-widest transition-colors ${treeMode === "user" ? "bg-[#1A202C] text-white" : "bg-white text-gray-500 hover:bg-[#F0F4F8]"}`}
            >
              我的整理
            </button>
            <button
              onClick={() => setTreeMode("rag")}
              className={`flex-1 py-1 text-[8px] font-bold uppercase tracking-widest transition-colors ${treeMode === "rag" ? "bg-[#1A202C] text-white" : "bg-white text-gray-500 hover:bg-[#F0F4F8]"}`}
            >
              系统归档
            </button>
          </div>

          {/* Filter + Actions */}
          {treeMode === "user" && (
            <div className="px-2 py-1.5 space-y-1.5">
              <input
                type="text"
                placeholder="搜索文件..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full text-[10px] border border-gray-300 px-2 py-1 focus:outline-none focus:border-[#00D1FF] bg-white"
              />
              <div className="flex items-center gap-1">
                <select
                  value={filterSource}
                  onChange={(e) => setFilterSource(e.target.value)}
                  className="text-[9px] border border-gray-200 px-1 py-0.5 bg-white focus:outline-none focus:border-[#00D1FF] flex-1"
                >
                  <option value="all">全部来源</option>
                  <option value="upload">本地上传</option>
                  <option value="lark_doc">飞书同步</option>
                  <option value="manual">手动创建</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-[9px] border border-gray-200 px-1 py-0.5 bg-white focus:outline-none focus:border-[#00D1FF] flex-1"
                >
                  <option value="all">全部状态</option>
                  <option value="ready">可预览</option>
                  <option value="processing">处理中</option>
                  <option value="failed">转换失败</option>
                  <option value="sync_error">同步异常</option>
                  <option value="unfiled">未归档</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
                  知识文件
                </span>
                <div className="flex items-center gap-1">
                  {selectedIds.size > 0 && (
                    <>
                      <button
                        onClick={handleBatchDelete}
                        className="flex items-center gap-1 px-2 py-0.5 border-2 border-red-400 bg-red-50 text-red-500 text-[9px] font-bold uppercase hover:bg-red-400 hover:text-white transition-colors"
                      >
                        删除 {selectedIds.size}
                      </button>
                      <button
                        onClick={async () => {
                          setBatchMode(true);
                          setBatchLoading(true);
                          try {
                            const res = await apiFetch<{ suggestions: Array<{ knowledge_id: number; suggestion: { id: number; suggested_folder_id: number | null; suggested_folder_path: string; confidence: number; reason: string } | null }> }>("/knowledge/batch/suggest-folders", {
                              method: "POST",
                              body: JSON.stringify({ entry_ids: Array.from(selectedIds) }),
                            });
                            const map: typeof batchSuggestions = {};
                            for (const s of res.suggestions) {
                              map[s.knowledge_id] = s.suggestion;
                            }
                            setBatchSuggestions(map);
                          } catch { }
                          setBatchLoading(false);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 border-2 border-[#00CC99] bg-[#00CC99]/10 text-[#00CC99] text-[9px] font-bold uppercase hover:bg-[#00CC99] hover:text-white transition-colors"
                      >
                        归档 {selectedIds.size}
                      </button>
                    </>
                  )}
                  <button
                    onClick={openNewFolder}
                    className="flex items-center gap-1 px-2 py-0.5 border-2 border-[#1A202C] bg-white text-[9px] font-bold uppercase hover:bg-[#1A202C] hover:text-white transition-colors"
                  >
                    + 文件夹
                  </button>
                </div>
              </div>
            </div>
          )}
          {treeMode === "rag" && (
            <div className="px-3 py-1.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">系统归档树</span>
                <div className="flex items-center gap-1">
                  <button disabled={autoFilingRunning} onClick={async () => { setAutoFilingRunning(true); setAutoFilingResult(null); try { const res = await apiFetch<{ filed: number; skipped: number; low_confidence: number; batch_id: string; suggestions: Array<{ id: number; knowledge_id: number; title: string; suggested_folder_id: number; confidence: number; reason: string }> }>("/knowledge/filing/auto-run", { method: "POST" }); setAutoFilingResult(res); const msg = res.suggestions.length > 0 ? `已归档 ${res.filed} 个，${res.suggestions.length} 个待审阅` : `已自动归档 ${res.filed} 个文件`; setToast(msg); fetchAll(); } catch { setToast("自动归档失败"); } setAutoFilingRunning(false); }} className="flex items-center gap-1 px-2 py-0.5 border-2 border-[#00CC99] bg-[#00CC99]/10 text-[#00CC99] text-[9px] font-bold uppercase hover:bg-[#00CC99] hover:text-white transition-colors disabled:opacity-50">{autoFilingRunning ? "归档中..." : "一键归档"}</button>
                  <button onClick={async () => { setShowPendingSuggestions(!showPendingSuggestions); if (!showPendingSuggestions) { try { const res = await apiFetch<Array<{ id: number; knowledge_id: number; title: string; suggested_folder_id: number; suggested_folder_path: string; confidence: number; reason: string }>>("/knowledge/filing/suggestions?status=pending"); setPendingSuggestions(res); } catch { setToast("加载待审建议失败"); } } }} className={`px-2 py-0.5 border-2 text-[9px] font-bold uppercase transition-colors ${showPendingSuggestions ? "border-amber-500 bg-amber-500 text-white" : "border-amber-400 text-amber-500 hover:bg-amber-50"}`}>待审</button>
                  <button onClick={async () => { try { await apiFetch("/knowledge/filing/ensure-system-tree", { method: "POST" }); setToast("系统归档树已刷新"); } catch { setToast("刷新失败"); } }} className="px-2 py-0.5 border-2 border-gray-300 text-gray-500 text-[9px] font-bold uppercase hover:bg-gray-100 transition-colors" title="初始化/刷新系统归档树">刷新树</button>
                </div>
              </div>
              {autoFilingResult && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] bg-[#00CC99]/10 px-2 py-1 border border-[#00CC99]/30">
                    <span className="text-[#00CC99] font-medium">
                      已归档 {autoFilingResult.filed} / 待审 {autoFilingResult.suggestions.length} / 跳过 {autoFilingResult.skipped}
                    </span>
                    <button onClick={async () => { try { const res = await apiFetch<{ undone: number }>("/knowledge/filing/undo", { method: "POST", body: JSON.stringify({ batch_id: autoFilingResult.batch_id }) }); setToast(`已撤销 ${res.undone} 个归档`); setAutoFilingResult(null); fetchAll(); } catch { setToast("撤销失败"); } }} className="text-red-400 hover:text-red-500 font-bold uppercase">撤销</button>
                  </div>
                  {autoFilingResult.suggestions.length > 0 && (
                    <div className="border border-amber-300 bg-amber-50 px-2 py-1 space-y-1 max-h-[200px] overflow-y-auto">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">低置信度待审阅</span>
                      {autoFilingResult.suggestions.map((s) => (
                        <div key={s.id} className="flex items-center gap-1.5 text-[9px] border-b border-amber-200 pb-1">
                          <span className="flex-1 truncate font-medium text-gray-700">{s.title}</span>
                          <span className="text-amber-600 text-[8px]">{Math.round(s.confidence * 100)}%</span>
                          <span className="text-gray-400 truncate max-w-[100px] text-[8px]">{s.reason}</span>
                          <button
                            onClick={async () => {
                              try {
                                await apiFetch(`/knowledge/${s.knowledge_id}/filing-suggestion/accept`, { method: "POST", body: JSON.stringify({ suggestion_id: s.id }) });
                                setAutoFilingResult(prev => prev ? { ...prev, suggestions: prev.suggestions.filter(x => x.id !== s.id), filed: prev.filed + 1 } : null);
                                fetchAll();
                              } catch { setToast("接受失败"); }
                            }}
                            className="px-1.5 py-0.5 bg-[#00CC99] text-white font-bold uppercase text-[8px] hover:bg-[#00CC99]/80"
                          >接受</button>
                          <button
                            onClick={async () => {
                              try {
                                await apiFetch(`/knowledge/${s.knowledge_id}/filing-suggestion/reject`, { method: "POST", body: JSON.stringify({ suggestion_id: s.id }) });
                                setAutoFilingResult(prev => prev ? { ...prev, suggestions: prev.suggestions.filter(x => x.id !== s.id) } : null);
                              } catch { setToast("拒绝失败"); }
                            }}
                            className="px-1.5 py-0.5 border border-gray-300 text-gray-500 font-bold uppercase text-[8px] hover:bg-gray-100"
                          >跳过</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {showPendingSuggestions && (
                <div className="border border-amber-300 bg-amber-50 px-2 py-1 space-y-1 max-h-[300px] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">
                      待审归档建议 ({pendingSuggestions.length})
                    </span>
                    {pendingSuggestions.length > 0 && (
                      <button
                        onClick={async () => {
                          for (const s of pendingSuggestions) {
                            try { await apiFetch(`/knowledge/${s.knowledge_id}/filing-suggestion/accept`, { method: "POST", body: JSON.stringify({ suggestion_id: s.id }) }); } catch {}
                          }
                          setPendingSuggestions([]);
                          setToast(`已全部接受 ${pendingSuggestions.length} 条建议`);
                          fetchAll();
                        }}
                        className="text-[8px] text-[#00CC99] font-bold uppercase hover:underline"
                      >全部接受</button>
                    )}
                  </div>
                  {pendingSuggestions.length === 0 && (
                    <p className="text-[9px] text-gray-400 py-2 text-center">暂无待审建议</p>
                  )}
                  {pendingSuggestions.map((s) => (
                    <div key={s.id} className="flex items-center gap-1.5 text-[9px] border-b border-amber-200 pb-1">
                      <span className="flex-1 truncate font-medium text-gray-700">{s.title}</span>
                      <span className="text-amber-600 text-[8px]">{Math.round(s.confidence * 100)}%</span>
                      <span className="text-gray-400 truncate max-w-[80px] text-[8px]">{s.reason}</span>
                      <button
                        onClick={async () => {
                          try {
                            await apiFetch(`/knowledge/${s.knowledge_id}/filing-suggestion/accept`, { method: "POST", body: JSON.stringify({ suggestion_id: s.id }) });
                            setPendingSuggestions(prev => prev.filter(x => x.id !== s.id));
                            fetchAll();
                          } catch { setToast("接受失败"); }
                        }}
                        className="px-1.5 py-0.5 bg-[#00CC99] text-white font-bold uppercase text-[8px] hover:bg-[#00CC99]/80"
                      >接受</button>
                      <button
                        onClick={async () => {
                          try {
                            await apiFetch(`/knowledge/${s.knowledge_id}/filing-suggestion/reject`, { method: "POST", body: JSON.stringify({ suggestion_id: s.id }) });
                            setPendingSuggestions(prev => prev.filter(x => x.id !== s.id));
                          } catch { setToast("拒绝失败"); }
                        }}
                        className="px-1.5 py-0.5 border border-gray-300 text-gray-500 font-bold uppercase text-[8px] hover:bg-gray-100"
                      >跳过</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RAG taxonomy view */}
        {treeMode === "rag" && (
          loading ? <SkeletonLoader variant="tree" /> : (
            <TaxonomyTreeView entries={entries} selectedEntry={selectedEntry} onSelectEntry={handleSelectEntry} />
          )
        )}

        {/* User tree body */}
        {treeMode === "user" && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Recent files */}
            <RecentFiles entries={entries} onSelect={handleSelectEntry} selectedId={selectedEntry?.id} />

            {/* Upload progress */}
            <UploadProgress files={uploadingFiles} />

            {/* File tree with lasso */}
            <div
              ref={treeRef}
              className="flex-1 relative"
              onMouseDown={handleTreeMouseDown}
              onMouseMove={handleTreeMouseMove}
              onMouseUp={handleTreeMouseUp}
              onMouseLeave={handleTreeMouseUp}
            >
              {lasso && (
                <div
                  className="fixed border border-[#00D1FF] bg-[#00D1FF]/10 pointer-events-none z-50"
                  style={{
                    left: Math.min(lasso.x1, lasso.x2),
                    top: Math.min(lasso.y1, lasso.y2),
                    width: Math.abs(lasso.x2 - lasso.x1),
                    height: Math.abs(lasso.y2 - lasso.y1),
                  }}
                />
              )}

              {loading ? (
                <SkeletonLoader variant="tree" />
              ) : (
                <>
                  {newFolderParentId === null && (
                    <div className="flex items-center gap-1 px-2 py-1 border-b border-[#CBD5E0]">
                      <input
                        ref={newFolderInputRef}
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitNewFolder(); if (e.key === "Escape") setNewFolderParentId(undefined); }}
                        placeholder="文件夹名称"
                        className="flex-1 text-[10px] border-2 border-[#00D1FF] px-1.5 py-0.5 focus:outline-none font-bold bg-white"
                      />
                      <button onClick={submitNewFolder} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4]">✓</button>
                      <button onClick={() => setNewFolderParentId(undefined)} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-400">✕</button>
                    </div>
                  )}

                  {(tree.get(null) ?? []).map((f) => (
                    <FolderNode
                      key={f.id}
                      folder={f}
                      tree={tree}
                      entries={filteredEntries}
                      selectedEntry={selectedEntry}
                      selectedIds={selectedIds}
                      onSelectEntry={handleSelectEntry}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onNewSubfolder={(pid, name) => { void apiFetch("/knowledge/folders", { method: "POST", body: JSON.stringify({ name, parent_id: pid }) }).then(fetchAll); }}
                      onMoveEntry={handleMoveEntry}
                      onRenameEntry={handleRenameEntry}
                      onDeleteEntry={handleDeleteEntry}
                      draggingEntryId={draggingEntryId}
                      onDragStart={setDraggingEntryId}
                      depth={0}
                      onContextMenu={handleContextMenu}
                      onUploadFiles={(files, fid) => handleUploadFiles(Array.from(files), fid)}
                    />
                  ))}

                  {/* Root-level files */}
                  <div
                    className={`min-h-[4px] transition-colors ${rootDropTarget && draggingEntryId !== null ? "bg-[#CCF2FF]" : ""}`}
                    onDragOver={(e) => { if (draggingEntryId !== null) { e.preventDefault(); setRootDropTarget(true); } }}
                    onDragLeave={() => setRootDropTarget(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setRootDropTarget(false);
                      const id = parseInt(e.dataTransfer.getData("entryId"));
                      if (!isNaN(id)) handleMoveEntry(id, null);
                    }}
                  >
                    {rootDropTarget && draggingEntryId !== null && (
                      <div className="mx-2 my-1 border-2 border-dashed border-[#00D1FF] px-2 py-1 text-center text-[9px] font-bold text-[#00A3C4] uppercase tracking-widest">移出文件夹</div>
                    )}
                    {rootFiles.map((e) => (
                      <FileRow
                        key={e.id}
                        entry={e}
                        selected={selectedEntry?.id === e.id}
                        multiSelected={selectedIds.has(e.id)}
                        depth={0}
                        onClick={() => handleSelectEntry(e)}
                        onDragStart={setDraggingEntryId}
                        isDragging={draggingEntryId === e.id}
                        onRenameEntry={handleRenameEntry}
                        onDeleteEntry={handleDeleteEntry}
                        onContextMenu={handleContextMenu}
                      />
                    ))}
                  </div>

                  {/* Batch filing panel */}
                  {batchMode && (
                    <div className="mx-2 my-2 border-2 border-[#00CC99] bg-[#00CC99]/5 p-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99]">
                          {batchLoading ? "生成归档建议中..." : `归档建议 (${Object.keys(batchSuggestions).length})`}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={async () => {
                              const toAccept = Object.entries(batchSuggestions).filter(([, s]) => s?.suggested_folder_id);
                              if (toAccept.length === 0) return;
                              for (const [kid, s] of toAccept) {
                                if (!s) continue;
                                await apiFetch(`/knowledge/${kid}/filing-suggestion/accept`, {
                                  method: "POST",
                                  body: JSON.stringify({ suggestion_id: s.id }),
                                });
                              }
                              setToast(`已归档 ${toAccept.length} 个文件`);
                              setBatchMode(false);
                              setBatchSuggestions({});
                              setSelectedIds(new Set());
                              fetchAll();
                            }}
                            className="px-2 py-0.5 border-2 border-[#00CC99] bg-[#00CC99] text-white text-[9px] font-bold uppercase hover:opacity-80"
                          >
                            全部接受
                          </button>
                          <button
                            onClick={() => { setBatchMode(false); setBatchSuggestions({}); }}
                            className="px-2 py-0.5 border-2 border-gray-300 text-gray-500 text-[9px] font-bold uppercase hover:border-red-400 hover:text-red-400"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                      {!batchLoading && Object.entries(batchSuggestions).map(([kid, suggestion]) => {
                        const entry = entries.find(e => e.id === Number(kid));
                        if (!entry) return null;
                        return (
                          <div key={kid} className="flex items-center gap-2 text-[9px] border-b border-gray-200 pb-1">
                            <span className="flex-1 truncate font-bold">{entry.ai_title || entry.title}</span>
                            {suggestion ? (
                              <>
                                <span className="text-[#00A3C4] truncate max-w-[120px]">→ {suggestion.suggested_folder_path}</span>
                                <span className="text-gray-400">({Math.round(suggestion.confidence * 100)}%)</span>
                              </>
                            ) : (
                              <span className="text-gray-400">无建议</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Empty state */}
                  {(tree.get(null) ?? []).length === 0 && rootFiles.length === 0 && myEntries.length === 0 && uploadingFiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-48 gap-3 text-[9px] text-gray-400 uppercase tracking-widest">
                      <div className="opacity-30"><Upload size={32} /></div>
                      <p>还没有知识文件</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drop zone at bottom */}
            <div className="flex-shrink-0 pb-2">
              <DropZone onFiles={handleUploadFiles} dragging={dragging} />
            </div>
          </div>
        )}
      </div>

      {/* Right: preview */}
      <PreviewPanel
        entry={selectedEntry}
        currentUser={currentUser}
        onUpdateContent={handleUpdateContent}
        onDelete={handleDeleteEntry}
        onRename={handleRenameEntry}
        folders={treeMode === "rag" && currentUser?.role === "super_admin" ? folders : folders}
        onMoveToFolder={treeMode === "rag" && currentUser?.role === "super_admin" ? handleMoveEntry : undefined}
      />

      {/* Comment toggle strip */}
      {selectedEntry && (
        <button
          onClick={() => setShowComments(!showComments)}
          className={`w-6 flex-shrink-0 border-l border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors ${showComments ? "bg-[#E0F7FF] text-[#00A3C4]" : "text-gray-400"}`}
          title={showComments ? "关闭评论" : "打开评论"}
        >
          <span className="[writing-mode:vertical-lr] text-[9px] font-bold uppercase tracking-widest">评论</span>
        </button>
      )}

      {/* Comment panel */}
      {showComments && selectedEntry && currentUser && (
        <CommentPanel
          knowledgeId={selectedEntry.id}
          currentUserId={currentUser.id}
          canEdit={selectedEntry.created_by === currentUser.id || currentUser.role === "super_admin"}
          onToast={(msg) => setToast(msg)}
          onRestoreSuccess={() => {
            // 恢复快照后刷新正文
            if (selectedEntry) {
              handleSelectEntry(selectedEntry);
            }
          }}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          onClose={() => setContextMenu(null)}
          onRename={handleRenameEntry}
          onDelete={handleDeleteEntry}
          onDownload={handleDownload}
          onCopyLink={handleCopyLink}
          onStartRename={(id) => setRenamingId(id)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("files");

  return (
    <div className="h-full flex flex-col">
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center gap-4 flex-shrink-0" style={{ backgroundColor: "var(--card)" }}>
        <div className="flex items-center gap-2 mr-4">
          <ThemedPageIcon icon={ICONS.knowledgeMy} size={16} />
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">我的知识</h1>
        </div>
        <div className="flex gap-1">
          <PixelButton variant={tab === "files" ? "primary" : "secondary"} size="sm" onClick={() => setTab("files")}>知识文件</PixelButton>
          <PixelButton variant={tab === "search" ? "primary" : "secondary"} size="sm" onClick={() => setTab("search")}>知识搜索</PixelButton>
        </div>
      </div>
      {tab === "files" ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <FileManagerTab />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6">
          <SearchTab />
        </div>
      )}
    </div>
  );
}
