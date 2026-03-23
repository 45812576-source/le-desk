"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, BookOpen, Eye, Upload } from "lucide-react";
import { PageShell, ThemedPageIcon } from "@/components/layout/PageShell";
import { ICONS, PixelIcon } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { useTheme } from "@/lib/theme";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ChunkSearchResult, KnowledgeChunkDetail, KnowledgeDetail } from "@/lib/types";
import { RichEditor } from "@/components/knowledge/RichEditor";

// 局部主题感知 icon 包装
function ThemedIcon({
  pixelIcon,
  LucideIcon,
  size,
}: {
  pixelIcon: React.ComponentProps<typeof PixelIcon>;
  LucideIcon: React.ElementType;
  size: number;
}) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...pixelIcon} size={size} />;
  return <LucideIcon size={size} className="text-muted-foreground" />;
}

type Tab = "files" | "search";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
}

// ─── Taxonomy (A-F) ───────────────────────────────────────────────────────────
const TAXONOMY_OPTIONS = [
  { value: "", label: "全部", color: "gray" as const },
  { value: "A", label: "A 渠道", color: "cyan" as const },
  { value: "B", label: "B 行业", color: "green" as const },
  { value: "C", label: "C 消费者", color: "yellow" as const },
  { value: "D", label: "D 方法论", color: "purple" as const },
  { value: "E", label: "E 公司", color: "gray" as const },
  { value: "F", label: "F 合规", color: "red" as const },
];

// ─── File Tree helpers ────────────────────────────────────────────────────────
function buildTree(folders: Folder[]): Map<number | null, Folder[]> {
  const map = new Map<number | null, Folder[]>();
  for (const f of folders) {
    const key = f.parent_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(f);
  }
  return map;
}

// ─── FileRow ──────────────────────────────────────────────────────────────────
function FileRow({
  entry,
  selected,
  multiSelected,
  depth,
  onClick,
  onDragStart,
  isDragging,
  onRenameEntry,
  onDeleteEntry,
}: {
  entry: KnowledgeDetail;
  selected: boolean;
  multiSelected?: boolean;
  depth: number;
  onClick: () => void;
  onDragStart: (id: number) => void;
  isDragging: boolean;
  onRenameEntry: (id: number, title: string) => void;
  onDeleteEntry: (id: number) => void;
}) {
  const ext = entry.source_file?.split(".").pop()?.toUpperCase() ?? "TXT";
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(entry.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  function submitRename() {
    if (nameVal.trim() && nameVal.trim() !== entry.title) onRenameEntry(entry.id, nameVal.trim());
    setRenaming(false);
  }

  return (
    <div
      data-entry-id={entry.id}
      draggable={!renaming}
      onClick={renaming ? undefined : onClick}
      onDragStart={(e) => { e.dataTransfer.setData("entryId", String(entry.id)); onDragStart(entry.id); }}
      className={`flex items-center gap-2 py-1 select-none border-b border-gray-100 transition-opacity group ${
        isDragging ? "opacity-40 cursor-grabbing" : renaming ? "bg-white" : multiSelected ? "bg-red-100 cursor-pointer" : selected ? "bg-[#CCF2FF] cursor-pointer" : "hover:bg-white cursor-pointer"
      }`}
      style={{ paddingLeft: `${8 + depth * 16 + 20}px`, paddingRight: "8px" }}
    >
      <ThemedIcon pixelIcon={ICONS.files} LucideIcon={FileText} size={12} />
      {renaming ? (
        <input
          ref={inputRef}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(false); }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-[10px] border border-[#00D1FF] px-1 focus:outline-none"
        />
      ) : (
        <span className="flex-1 text-[10px] truncate">{entry.title || entry.source_file}</span>
      )}
      {!renaming && (
        <span className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
          <button className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5" onClick={(e) => { e.stopPropagation(); setRenaming(true); setNameVal(entry.title); }} title="重命名">✎</button>
          <button className="text-[8px] text-gray-400 hover:text-red-400 px-0.5" onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id); }} title="删除">✕</button>
        </span>
      )}
      {!renaming && (
        <span className={`text-[7px] font-bold px-1 border flex-shrink-0 ${
          entry.status === "approved" ? "border-green-400 text-green-600" :
          entry.status === "pending" ? "border-yellow-400 text-yellow-600" :
          "border-gray-300 text-gray-400"
        }`}>{ext}</span>
      )}
    </div>
  );
}

// ─── FolderNode ───────────────────────────────────────────────────────────────
function FolderNode({
  folder,
  tree,
  entries,
  selectedEntry,
  selectedIds,
  onSelectEntry,
  onRename,
  onDelete,
  onNewSubfolder,
  onMoveEntry,
  onRenameEntry,
  onDeleteEntry,
  draggingEntryId,
  onDragStart,
  depth,
}: {
  folder: Folder;
  tree: Map<number | null, Folder[]>;
  entries: KnowledgeDetail[];
  selectedEntry: KnowledgeDetail | null;
  selectedIds: Set<number>;
  onSelectEntry: (e: KnowledgeDetail) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onNewSubfolder: (parentId: number, name: string) => void;
  onMoveEntry: (entryId: number, folderId: number | null) => void;
  onRenameEntry: (id: number, title: string) => void;
  onDeleteEntry: (id: number) => void;
  draggingEntryId: number | null;
  onDragStart: (id: number) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const childInputRef = useRef<HTMLInputElement>(null);
  const [dropTarget, setDropTarget] = useState(false);

  const children = tree.get(folder.id) ?? [];
  const folderFiles = entries.filter((e) => e.folder_id === folder.id);
  const hasContent = children.length > 0 || folderFiles.length > 0;

  function handleRenameSubmit() {
    if (nameVal.trim() && nameVal.trim() !== folder.name) {
      onRename(folder.id, nameVal.trim());
    }
    setRenaming(false);
  }

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  return (
    <div>
      {/* Folder row */}
      <div
        className={`flex items-center gap-1 py-1 group select-none transition-colors ${
          dropTarget && draggingEntryId !== null ? "bg-[#CCF2FF] border-l-2 border-[#00D1FF]" : "hover:bg-white"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: "8px" }}
        onDragOver={(e) => { if (draggingEntryId !== null) { e.preventDefault(); setDropTarget(true); } }}
        onDragLeave={() => setDropTarget(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropTarget(false);
          const id = parseInt(e.dataTransfer.getData("entryId"));
          if (!isNaN(id)) { onMoveEntry(id, folder.id); setOpen(true); }
        }}
      >
        <span
          className="text-[10px] w-4 text-gray-400 flex-shrink-0 cursor-pointer hover:text-[#00A3C4] text-center"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          {open ? "▾" : "▸"}
        </span>
        <span className="mr-1 flex-shrink-0">
          <ThemedIcon pixelIcon={ICONS.knowledgeMy} LucideIcon={BookOpen} size={12} />
        </span>
        {renaming ? (
          <input
            ref={inputRef}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit(); if (e.key === "Escape") setRenaming(false); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-[10px] font-bold border border-[#00D1FF] px-1 focus:outline-none bg-white"
          />
        ) : (
          <span className="flex-1 text-[10px] font-bold truncate cursor-pointer" onClick={() => setOpen((v) => !v)}>{folder.name}</span>
        )}
        {!renaming && (folderFiles.length > 0 || children.length > 0) && (
          <span className="text-[8px] text-gray-400 flex-shrink-0">{folderFiles.length}</span>
        )}
        <span className="hidden group-hover:flex items-center gap-1 ml-1 flex-shrink-0">
          <button className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5" onClick={(e) => { e.stopPropagation(); setRenaming(true); setNameVal(folder.name); }} title="重命名">✎</button>
          <button className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5" onClick={(e) => { e.stopPropagation(); setAddingChild(true); setChildName(""); setOpen(true); setTimeout(() => childInputRef.current?.focus(), 30); }} title="新建子文件夹">+</button>
          <button className="text-[8px] text-gray-400 hover:text-red-400 px-0.5" onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }} title="删除">✕</button>
        </span>
      </div>

      {open && (
        <>
          {/* Child folders first */}
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              tree={tree}
              entries={entries}
              selectedEntry={selectedEntry}
              selectedIds={selectedIds}
              onSelectEntry={onSelectEntry}
              onRename={onRename}
              onDelete={onDelete}
              onNewSubfolder={onNewSubfolder}
              onMoveEntry={onMoveEntry}
              onRenameEntry={onRenameEntry}
              onDeleteEntry={onDeleteEntry}
              draggingEntryId={draggingEntryId}
              onDragStart={onDragStart}
              depth={depth + 1}
            />
          ))}
          {/* Inline new-subfolder input */}
          {addingChild && (
            <div className="flex items-center gap-1 py-1" style={{ paddingLeft: `${8 + (depth + 1) * 16}px`, paddingRight: "8px" }}>
              <input
                ref={childInputRef}
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { if (childName.trim()) onNewSubfolder(folder.id, childName.trim()); setAddingChild(false); }
                  if (e.key === "Escape") setAddingChild(false);
                }}
                placeholder="文件夹名称"
                className="flex-1 text-[10px] border-2 border-[#00D1FF] px-1.5 py-0.5 focus:outline-none font-bold bg-white"
              />
              <button onClick={() => { if (childName.trim()) onNewSubfolder(folder.id, childName.trim()); setAddingChild(false); }} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4]">✓</button>
              <button onClick={() => setAddingChild(false)} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-400">✕</button>
            </div>
          )}
          {/* Files in this folder */}
          {folderFiles.map((e) => (
            <FileRow key={e.id} entry={e} selected={selectedEntry?.id === e.id} multiSelected={selectedIds.has(e.id)} depth={depth} onClick={() => onSelectEntry(e)} onDragStart={onDragStart} isDragging={draggingEntryId === e.id} onRenameEntry={onRenameEntry} onDeleteEntry={onDeleteEntry} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Preview Panel ────────────────────────────────────────────────────────────
function PreviewPanel({
  entry,
  onUpdateContent,
  onDelete,
  onRename,
  folders,
  onMoveToFolder,
}: {
  entry: KnowledgeDetail | null;
  onUpdateContent: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => void;
  onRename: (id: number, title: string) => void;
  folders?: Folder[];
  onMoveToFolder?: (entryId: number, folderId: number | null) => void;
}) {
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

  // Plain text → wrap in <p> tags so Tiptap treats it as HTML
  function toHtml(raw: string): string {
    if (!raw) return "";
    // If already looks like HTML, pass through
    if (/^</.test(raw.trim())) return raw;
    // Otherwise wrap plain text lines in <p>
    return raw.split("\n").map((l) => `<p>${l || "<br>"}</p>`).join("");
  }

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
      <div className="flex-1 min-h-0 overflow-y-auto bg-white flex flex-col items-center justify-center text-[9px] text-gray-400 uppercase tracking-widest">
        <div className="mb-3 opacity-40"><ThemedIcon pixelIcon={ICONS.eyePreview} LucideIcon={Eye} size={32} /></div>
        选择文件预览
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 bg-white flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b-2 border-[#1A202C] flex-shrink-0 flex-wrap">
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
          <h2 className="text-sm font-bold cursor-pointer hover:text-[#00A3C4] flex-1" onClick={() => { setEditingTitle(true); setTitleVal(entry.title); }}>{entry.title}</h2>
        )}
        <PixelBadge color={entry.status === "approved" ? "green" : entry.status === "pending" ? "yellow" : "gray"}>
          {entry.status === "approved" ? "已通过" : entry.status === "pending" ? "待审核" : entry.status}
        </PixelBadge>
        {entry.source_file && (
          <span className="text-[8px] text-[#00A3C4] font-bold truncate max-w-[160px]">📎 {entry.source_file}</span>
        )}
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {/* 移入文件夹（系统归档视图提供文件夹列表时显示） */}
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
                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 px-3 py-1.5 border-b border-gray-100">
                    选择文件夹
                  </div>
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

      {/* Rich text editor / viewer */}
      <div className={editing ? "flex-1 min-h-0 overflow-hidden" : "flex-shrink-0"}>
        <RichEditor
          key={entry.id}
          content={toHtml(contentVal)}
          onChange={setContentVal}
          editable={editing}
        />
      </div>
    </div>
  );
}

// ─── Taxonomy constants (mirrors backend knowledge_taxonomy.py) ───────────────
const BOARD_LABELS: Record<string, string> = {
  A: "A. 渠道与平台",
  B: "B. 投放策略与方法论",
  C: "C. 行业与客户知识",
  D: "D. 产品与工具知识",
  E: "E. 运营与管理",
  F: "F. 外部资料与研究",
};

const BOARD_ORDER = ["A", "B", "C", "D", "E", "F"];

// ─── TaxonomyTreeView ─────────────────────────────────────────────────────────
function TaxonomyTreeView({
  entries,
  selectedEntry,
  onSelectEntry,
}: {
  entries: KnowledgeDetail[];
  selectedEntry: KnowledgeDetail | null;
  onSelectEntry: (e: KnowledgeDetail) => void;
}) {
  // openBoards: which board A-F are expanded
  const [openBoards, setOpenBoards] = useState<Set<string>>(new Set(["A"]));
  // openCodes: which taxonomy_code subtrees are expanded (e.g. "A1")
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set());

  function toggleBoard(b: string) {
    setOpenBoards((prev) => {
      const next = new Set(prev);
      next.has(b) ? next.delete(b) : next.add(b);
      return next;
    });
  }

  function toggleCode(code: string) {
    setOpenCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  }

  // Group entries by board + code
  // For entries without taxonomy_board → "unclassified"
  const byBoard: Record<string, KnowledgeDetail[]> = {};
  const unclassified: KnowledgeDetail[] = [];

  for (const e of entries) {
    if (!e.taxonomy_board) {
      unclassified.push(e);
    } else {
      if (!byBoard[e.taxonomy_board]) byBoard[e.taxonomy_board] = [];
      byBoard[e.taxonomy_board].push(e);
    }
  }

  // Within a board, group by taxonomy_code prefix (e.g. "A1" from "A1.1")
  function groupByPrefix(boardEntries: KnowledgeDetail[]): Map<string, { label: string; entries: KnowledgeDetail[] }> {
    const map = new Map<string, { label: string; entries: KnowledgeDetail[] }>();
    for (const e of boardEntries) {
      if (!e.taxonomy_code) {
        const key = "__no_code__";
        if (!map.has(key)) map.set(key, { label: "其他", entries: [] });
        map.get(key)!.entries.push(e);
        continue;
      }
      // prefix = first segment before ".", e.g. "A1" from "A1.1"
      const prefix = e.taxonomy_code.split(".")[0];
      // label from taxonomy_path[1] e.g. "A1.国内付费渠道"
      const label = (e.taxonomy_path && e.taxonomy_path[1]) ? e.taxonomy_path[1] : prefix;
      if (!map.has(prefix)) map.set(prefix, { label, entries: [] });
      map.get(prefix)!.entries.push(e);
    }
    return map;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Boards A-F */}
      {BOARD_ORDER.map((board) => {
        const boardEntries = byBoard[board] ?? [];
        const isOpen = openBoards.has(board);
        const grouped = groupByPrefix(boardEntries);

        return (
          <div key={board}>
            {/* Board header */}
            <div
              className="flex items-center gap-1 py-1 hover:bg-white group select-none cursor-pointer"
              style={{ paddingLeft: "8px", paddingRight: "8px" }}
              onClick={() => toggleBoard(board)}
            >
              <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">
                {isOpen ? "▾" : "▸"}
              </span>
              <span className="mr-1 flex-shrink-0">
                <ThemedIcon pixelIcon={ICONS.knowledgeMy} LucideIcon={BookOpen} size={12} />
              </span>
              <span className="flex-1 text-[10px] font-bold truncate">{BOARD_LABELS[board]}</span>
              <span className="text-[8px] text-gray-400 flex-shrink-0">{boardEntries.length}</span>
            </div>

            {isOpen && (
              <>
                {grouped.size === 0 && (
                  <div className="text-[9px] text-gray-400 px-8 py-1">暂无文件</div>
                )}
                {Array.from(grouped.entries()).map(([prefix, group]) => {
                  const codeKey = `${board}:${prefix}`;
                  const isCodeOpen = openCodes.has(codeKey);
                  return (
                    <div key={prefix}>
                      {/* Sub-group header */}
                      <div
                        className="flex items-center gap-1 py-1 hover:bg-white select-none cursor-pointer"
                        style={{ paddingLeft: "24px", paddingRight: "8px" }}
                        onClick={() => toggleCode(codeKey)}
                      >
                        <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">
                          {isCodeOpen ? "▾" : "▸"}
                        </span>
                        <span className="flex-1 text-[9px] font-bold truncate text-gray-600">{group.label}</span>
                        <span className="text-[8px] text-gray-400 flex-shrink-0">{group.entries.length}</span>
                      </div>

                      {isCodeOpen && group.entries.map((e) => {
                        const ext = e.source_file?.split(".").pop()?.toUpperCase() ?? "TXT";
                        const isSelected = selectedEntry?.id === e.id;
                        return (
                          <div
                            key={e.id}
                            onClick={() => onSelectEntry(e)}
                            className={`flex items-center gap-2 py-1 select-none border-b border-gray-100 cursor-pointer transition-colors ${
                              isSelected ? "bg-[#CCF2FF]" : "hover:bg-white"
                            }`}
                            style={{ paddingLeft: "44px", paddingRight: "8px" }}
                          >
                            <ThemedIcon pixelIcon={ICONS.files} LucideIcon={FileText} size={12} />
                            <span className="flex-1 text-[10px] truncate">{e.title || e.source_file}</span>
                            <span className={`text-[7px] font-bold px-1 border flex-shrink-0 ${
                              e.status === "approved" ? "border-green-400 text-green-600" :
                              e.status === "pending" ? "border-yellow-400 text-yellow-600" :
                              "border-gray-300 text-gray-400"
                            }`}>{ext}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        );
      })}

      {/* Unclassified */}
      {(() => {
        const isOpen = openBoards.has("__unclassified__");
        return (
          <div>
            <div
              className="flex items-center gap-1 py-1 hover:bg-white group select-none cursor-pointer"
              style={{ paddingLeft: "8px", paddingRight: "8px" }}
              onClick={() => toggleBoard("__unclassified__")}
            >
              <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">
                {isOpen ? "▾" : "▸"}
              </span>
              <span className="mr-1 flex-shrink-0">
                <ThemedIcon pixelIcon={ICONS.knowledgeMy} LucideIcon={BookOpen} size={12} />
              </span>
              <span className="flex-1 text-[10px] font-bold truncate text-gray-400">未分类</span>
              <span className="text-[8px] text-gray-400 flex-shrink-0">{unclassified.length}</span>
            </div>
            {isOpen && unclassified.map((e) => {
              const ext = e.source_file?.split(".").pop()?.toUpperCase() ?? "TXT";
              const isSelected = selectedEntry?.id === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => onSelectEntry(e)}
                  className={`flex items-center gap-2 py-1 select-none border-b border-gray-100 cursor-pointer transition-colors ${
                    isSelected ? "bg-[#CCF2FF]" : "hover:bg-white"
                  }`}
                  style={{ paddingLeft: "28px", paddingRight: "8px" }}
                >
                  <ThemedIcon pixelIcon={ICONS.files} LucideIcon={FileText} size={12} />
                  <span className="flex-1 text-[10px] truncate">{e.title || e.source_file}</span>
                  <span className={`text-[7px] font-bold px-1 border flex-shrink-0 ${
                    e.status === "approved" ? "border-green-400 text-green-600" :
                    e.status === "pending" ? "border-yellow-400 text-yellow-600" :
                    "border-gray-300 text-gray-400"
                  }`}>{ext}</span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ─── File Manager Tab ─────────────────────────────────────────────────────────
type TreeMode = "user" | "rag";

function FileManagerTab() {
  const { user: currentUser } = useAuth();
  const [treeMode, setTreeMode] = useState<TreeMode>("user");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [entries, setEntries] = useState<KnowledgeDetail[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<number | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const [draggingEntryId, setDraggingEntryId] = useState<number | null>(null);
  const [rootDropTarget, setRootDropTarget] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<string[]>([]);

  // ── Lasso selection ──────────────────────────────────────────────────────────
  const treeRef = useRef<HTMLDivElement>(null);
  const [lasso, setLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const lassoStart = useRef<{ x: number; y: number } | null>(null);

  const handleSelectEntry = useCallback(async (e: KnowledgeDetail) => {
    setSelectedEntry(e); // 先显示截断版（即时响应）
    try {
      const full = await apiFetch<KnowledgeDetail>(`/knowledge/${e.id}`);
      setSelectedEntry(full);
    } catch {
      // ignore, keep truncated version
    }
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
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Lasso mouse handlers ─────────────────────────────────────────────────────
  function handleTreeMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    // Only start lasso on the tree background, not on file/folder rows
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

  // 「我的整理」只显示当前用户自己上传的文件
  const myEntries = currentUser
    ? entries.filter((e) => e.created_by === currentUser.id)
    : entries;

  const tree = buildTree(folders);
  // files with no folder (root-level)，仅用 myEntries
  const rootFiles = myEntries.filter((e) => !e.folder_id);

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

  async function handleUpdateContent(id: number, content: string): Promise<void> {
    await apiFetch(`/knowledge/${id}`, { method: "PATCH", body: JSON.stringify({ content }) });
    fetchAll();
    setSelectedEntry((prev) => prev?.id === id ? { ...prev, content } : prev);
  }

  async function handleMoveEntry(entryId: number, folderId: number | null) {
    const url = folderId !== null
      ? `/knowledge/${entryId}/folder?folder_id=${folderId}`
      : `/knowledge/${entryId}/folder`;
    await apiFetch(url, { method: "PATCH" });
    setSelectedEntry((prev) => prev?.id === entryId ? { ...prev, folder_id: folderId } : prev);
    fetchAll();
  }

  async function handleUploadFiles(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    setUploading(true);
    setPendingFiles(fileArr.map((f) => f.name));
    try {
      for (const file of fileArr) {
        const form = new FormData();
        form.append("file", file);
        form.append("title", file.name);
        form.append("category", "experience");
        form.append("industry_tags", "[]");
        form.append("platform_tags", "[]");
        form.append("topic_tags", "[]");
        try {
          await apiFetch<{ id: number }>("/knowledge/upload", { method: "POST", body: form });
        } catch (err) {
          console.error("upload failed", err);
        } finally {
          setPendingFiles((prev) => prev.filter((n) => n !== file.name));
        }
      }
    } finally {
      setUploading(false);
      setPendingFiles([]);
      fetchAll();
    }
  }

  return (
    <div className="flex h-full border-2 border-[#1A202C]">
      {/* Left: unified file tree (drop zone) */}
      <div
        className={`w-80 flex-shrink-0 border-r-2 border-[#1A202C] flex flex-col transition-colors ${treeMode === "user" && dragging ? "bg-[#CCF2FF]" : "bg-[#F0F4F8]"}`}
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
              className={`flex-1 py-1 text-[8px] font-bold uppercase tracking-widest transition-colors ${
                treeMode === "user"
                  ? "bg-[#1A202C] text-white"
                  : "bg-white text-gray-500 hover:bg-[#F0F4F8]"
              }`}
            >
              我的整理
            </button>
            <button
              onClick={() => setTreeMode("rag")}
              className={`flex-1 py-1 text-[8px] font-bold uppercase tracking-widest transition-colors ${
                treeMode === "rag"
                  ? "bg-[#1A202C] text-white"
                  : "bg-white text-gray-500 hover:bg-[#F0F4F8]"
              }`}
            >
              系统归档
            </button>
          </div>
          {/* Actions row — only in user mode */}
          {treeMode === "user" && (
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
                {uploading ? "上传中..." : "知识文件"}
              </span>
              <div className="flex items-center gap-1.5">
                {selectedIds.size > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="flex items-center gap-1 px-2 py-1 border-2 border-red-400 bg-red-50 text-red-500 text-[9px] font-bold uppercase tracking-widest hover:bg-red-400 hover:text-white transition-colors"
                  >
                    删除 {selectedIds.size} 个
                  </button>
                )}
                <label className="cursor-pointer">
                  <input type="file" multiple className="hidden" onChange={(e) => handleUploadFiles(e.target.files ?? [])} />
                  <span className="flex items-center gap-1 px-2 py-1 border-2 border-[#1A202C] bg-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#00D1FF] hover:border-[#00D1FF] transition-colors">
                    ↑ 上传
                  </span>
                </label>
                <button
                  onClick={openNewFolder}
                  className="flex items-center gap-1 px-2 py-1 border-2 border-[#1A202C] bg-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#1A202C] hover:text-white transition-colors"
                >
                  + 文件夹
                </button>
              </div>
            </div>
          )}
          {treeMode === "rag" && (
            <div className="flex items-center px-3 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
                RAG 自动归档
              </span>
            </div>
          )}
        </div>

        {/* Drop overlay hint — user mode only */}
        {treeMode === "user" && dragging && (
          <div className="mx-3 mt-2 border-2 border-dashed border-[#00D1FF] px-2 py-2 text-center text-[9px] font-bold text-[#00A3C4] uppercase tracking-widest flex-shrink-0">
            松开以上传（无文件夹）
          </div>
        )}

        {/* RAG taxonomy view — 用全量 entries（后端已按权限过滤） */}
        {treeMode === "rag" && (
          loading ? (
            <div className="text-[9px] text-gray-400 px-3 py-4">Loading...</div>
          ) : (
            <TaxonomyTreeView
              entries={entries}
              selectedEntry={selectedEntry}
              onSelectEntry={handleSelectEntry}
            />
          )
        )}

        {/* User tree body — lasso + folder tree */}
        {treeMode === "user" && (
          <div
            ref={treeRef}
            className="flex-1 overflow-y-auto relative"
            onMouseDown={handleTreeMouseDown}
            onMouseMove={handleTreeMouseMove}
            onMouseUp={handleTreeMouseUp}
            onMouseLeave={handleTreeMouseUp}
          >
            {/* Lasso rect */}
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
            <div>
            {loading ? (
              <div className="text-[9px] text-gray-400 px-3 py-4">Loading...</div>
            ) : (
              <>
                {/* Inline new-root-folder input */}
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

                {/* Root-level folders */}
                {(tree.get(null) ?? []).map((f) => (
                  <FolderNode
                    key={f.id}
                    folder={f}
                    tree={tree}
                    entries={myEntries}
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
                  />
                ))}

                {/* Root-level files (no folder) — also a drop target to "remove from folder" */}
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
                    <div className="mx-2 my-1 border-2 border-dashed border-[#00D1FF] px-2 py-1 text-center text-[9px] font-bold text-[#00A3C4] uppercase tracking-widest">
                      移出文件夹
                    </div>
                  )}
                  {rootFiles.map((e) => (
                    <FileRow key={e.id} entry={e} selected={selectedEntry?.id === e.id} multiSelected={selectedIds.has(e.id)} depth={0} onClick={() => handleSelectEntry(e)} onDragStart={setDraggingEntryId} isDragging={draggingEntryId === e.id} onRenameEntry={handleRenameEntry} onDeleteEntry={handleDeleteEntry} />
                  ))}
                </div>

                {/* Pending upload placeholders */}
                {pendingFiles.map((name) => (
                  <div key={name} className="flex items-center gap-2 py-1 px-3 border-b border-gray-100 opacity-60 animate-pulse">
                    <ThemedIcon pixelIcon={ICONS.files} LucideIcon={FileText} size={12} />
                    <span className="flex-1 text-[10px] truncate">{name}</span>
                    <span className="text-[7px] font-bold px-1 border border-[#00D1FF] text-[#00A3C4]">上传中</span>
                  </div>
                ))}

                {/* Empty state */}
                {(tree.get(null) ?? []).length === 0 && rootFiles.length === 0 && myEntries.length === 0 && pendingFiles.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-48 text-[9px] text-gray-400 uppercase tracking-widest">
                    <div className="mb-3 opacity-40">
                      <ThemedIcon pixelIcon={ICONS.uploadArrow} LucideIcon={Upload} size={28} />
                    </div>
                    拖拽文件上传
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        )}
      </div>

      {/* Right: preview + edit */}
      <PreviewPanel
        entry={selectedEntry}
        onUpdateContent={handleUpdateContent}
        onDelete={handleDeleteEntry}
        onRename={handleRenameEntry}
        folders={treeMode === "rag" && currentUser?.role === "super_admin" ? folders : undefined}
        onMoveToFolder={treeMode === "rag" && currentUser?.role === "super_admin" ? handleMoveEntry : undefined}
      />
    </div>
  );
}

// ─── Search Tab ───────────────────────────────────────────────────────────────
function SearchTab() {
  const [q, setQ] = useState("");
  const [taxonomyBoard, setTaxonomyBoard] = useState("");
  const [results, setResults] = useState<ChunkSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<ChunkSearchResult | null>(null);
  const [preview, setPreview] = useState<KnowledgeChunkDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function handleSearch() {
    if (loading) return;
    setLoading(true);
    setSearched(true);
    setSelectedChunk(null);
    setPreview(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (taxonomyBoard) params.set("taxonomy_board", taxonomyBoard);
      params.set("limit", "30");
      const data = await apiFetch<ChunkSearchResult[]>(`/knowledge/chunks/search?${params}`);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectChunk(chunk: ChunkSearchResult) {
    setSelectedChunk(chunk);
    if (preview?.id === chunk.knowledge_id) return;
    setPreviewLoading(true);
    setPreview(null);
    try {
      const data = await apiFetch<KnowledgeChunkDetail>(`/knowledge/${chunk.knowledge_id}/chunks`);
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="输入关键词搜索知识切片..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1 border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
        />
        <PixelButton onClick={handleSearch} disabled={loading}>
          {loading ? "搜索中..." : "搜索"}
        </PixelButton>
      </div>

      <div className="flex items-center gap-1 flex-wrap mb-5">
        {TAXONOMY_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setTaxonomyBoard(o.value)}
            className={`px-2 py-0.5 border-2 text-[9px] font-bold uppercase tracking-widest transition-colors ${
              taxonomyBoard === o.value
                ? "border-[#1A202C] bg-[#1A202C] text-white"
                : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {!searched ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
          <ThemedIcon pixelIcon={ICONS.knowledgeMy} LucideIcon={BookOpen} size={20} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            输入关键词搜索知识切片
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
            Loading...
          </div>
        </div>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-300px)]">
          <div className="w-80 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">未找到匹配结果</p>
              </div>
            ) : (
              results.map((chunk, idx) => {
                const isSelected = selectedChunk?.knowledge_id === chunk.knowledge_id && selectedChunk?.chunk_index === chunk.chunk_index;
                const board = chunk.taxonomy_board ?? "";
                const taxOpt = TAXONOMY_OPTIONS.find((o) => o.value === board);
                return (
                  <div
                    key={`${chunk.knowledge_id}-${chunk.chunk_index}-${idx}`}
                    onClick={() => handleSelectChunk(chunk)}
                    className={`border-2 p-3 cursor-pointer transition-colors ${isSelected ? "border-[#00D1FF] bg-[#CCF2FF]" : "border-[#1A202C] bg-white hover:border-[#00A3C4]"}`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold truncate max-w-[140px]">{chunk.title}</span>
                      {taxOpt?.value && <PixelBadge color={taxOpt.color}>{taxOpt.label}</PixelBadge>}
                      <span className="text-[8px] text-gray-400 ml-auto">{Math.round(chunk.score * 100)}%</span>
                    </div>
                    <p className="text-[9px] text-gray-500 line-clamp-3 leading-relaxed">{chunk.text}</p>
                    {chunk.source_file && <p className="text-[8px] text-[#00A3C4] mt-1 truncate">{chunk.source_file}</p>}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex-1 border-2 border-[#1A202C] bg-white overflow-y-auto">
            {!selectedChunk ? (
              <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-gray-400">点击左侧结果预览</div>
            ) : previewLoading ? (
              <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">Loading...</div>
            ) : preview ? (
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h2 className="text-sm font-bold">{preview.title}</h2>
                  {preview.source_type && <PixelBadge color="gray">{preview.source_type}</PixelBadge>}
                </div>
                {preview.source_file && <p className="text-[9px] text-[#00A3C4] mb-4">来源文件：{preview.source_file}</p>}
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">全文内容</div>
                <div className="space-y-3">
                  {preview.chunks.map((c) => (
                    <div key={c.index} className={`border-l-2 pl-3 py-1 text-[10px] leading-relaxed whitespace-pre-wrap ${selectedChunk.chunk_index === c.index ? "border-[#00D1FF] text-[#1A202C]" : "border-gray-200 text-gray-500"}`}>
                      {c.text}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-red-400">加载失败</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function KnowledgePage() {
  const [tab, setTab] = useState<Tab>("files");

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
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
      {/* Content — fills remaining height, no extra padding for files tab */}
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
