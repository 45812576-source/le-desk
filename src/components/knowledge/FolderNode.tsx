"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { PixelIcon, ICONS } from "@/components/pixel";
import { useTheme } from "@/lib/theme";
import type { KnowledgeDetail } from "@/lib/types";
import FileRow from "./FileRow";

interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  is_system?: number;
  taxonomy_board?: string | null;
  taxonomy_code?: string | null;
}

function ThemedFolderIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon pattern={ICONS.knowledgeMy.pattern} colors={ICONS.knowledgeMy.colors} size={size} />;
  return <BookOpen size={size} className="text-muted-foreground" />;
}

interface FolderNodeProps {
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
  onContextMenu?: (e: React.MouseEvent, entry: KnowledgeDetail) => void;
  onUploadFiles?: (files: FileList, folderId: number) => void;
}

export default function FolderNode({
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
  onContextMenu,
  onUploadFiles,
}: FolderNodeProps) {
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
      <div
        className={`flex items-center gap-1 py-1 group select-none transition-colors ${
          dropTarget && draggingEntryId !== null ? "bg-[#CCF2FF] border-l-2 border-[#00D1FF]" : "hover:bg-white"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: "8px" }}
        onDragOver={(e) => { e.preventDefault(); setDropTarget(true); }}
        onDragLeave={() => setDropTarget(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropTarget(false);
          // 拖拽已有条目
          const id = parseInt(e.dataTransfer.getData("entryId"));
          if (!isNaN(id)) { onMoveEntry(id, folder.id); setOpen(true); return; }
          // 拖拽外部文件 → 上传到此文件夹
          if (e.dataTransfer.files?.length && onUploadFiles) {
            onUploadFiles(e.dataTransfer.files, folder.id);
            setOpen(true);
          }
        }}
      >
        <span
          className="text-[10px] w-4 text-gray-400 flex-shrink-0 cursor-pointer hover:text-[#00A3C4] text-center"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          {open ? "▾" : "▸"}
        </span>
        <span className="mr-1 flex-shrink-0">
          <ThemedFolderIcon size={12} />
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
              onContextMenu={onContextMenu}
              onUploadFiles={onUploadFiles}
            />
          ))}
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
          {folderFiles.map((e) => (
            <FileRow
              key={e.id}
              entry={e}
              selected={selectedEntry?.id === e.id}
              multiSelected={selectedIds.has(e.id)}
              depth={depth}
              onClick={() => onSelectEntry(e)}
              onDragStart={onDragStart}
              isDragging={draggingEntryId === e.id}
              onRenameEntry={onRenameEntry}
              onDeleteEntry={onDeleteEntry}
              onContextMenu={onContextMenu}
            />
          ))}
        </>
      )}
    </div>
  );
}

export type { Folder };
