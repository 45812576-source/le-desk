"use client";

import { useEffect, useRef, useState } from "react";
import type { KnowledgeDetail } from "@/lib/types";
import { formatFileSize, formatRelativeDate } from "@/lib/format";
import FileTypeIcon from "./FileTypeIcon";

interface FileRowProps {
  entry: KnowledgeDetail;
  selected: boolean;
  multiSelected?: boolean;
  depth: number;
  onClick: () => void;
  onDragStart: (id: number) => void;
  isDragging: boolean;
  onRenameEntry: (id: number, title: string) => void;
  onDeleteEntry: (id: number) => void;
  onContextMenu?: (e: React.MouseEvent, entry: KnowledgeDetail) => void;
}

export default function FileRow({
  entry,
  selected,
  multiSelected,
  depth,
  onClick,
  onDragStart,
  isDragging,
  onRenameEntry,
  onDeleteEntry,
  onContextMenu,
}: FileRowProps) {
  const ext = entry.file_ext || (entry.source_file?.includes(".") ? `.${entry.source_file.split(".").pop()}` : "");
  const extLabel = ext.replace(/^\./, "").toUpperCase() || "TXT";
  const displayTitle = entry.ai_title || entry.title || entry.source_file || "未命名";
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(entry.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  function submitRename() {
    if (nameVal.trim() && nameVal.trim() !== entry.title) onRenameEntry(entry.id, nameVal.trim());
    setRenaming(false);
  }

  const meta = [formatFileSize(entry.file_size), formatRelativeDate(entry.created_at)].filter(Boolean).join(" · ");

  const BOARD_LABELS: Record<string, string> = {
    A: "A. 渠道与平台", B: "B. 投放策略与方法论", C: "C. 行业与客户知识",
    D: "D. 素材与创意", E: "E. 数据与分析", F: "F. 产品与运营",
  };
  const archivePath = (() => {
    const parts: string[] = [];
    if (entry.taxonomy_board) parts.push(BOARD_LABELS[entry.taxonomy_board] || entry.taxonomy_board);
    if (entry.taxonomy_path?.length) parts.push(...entry.taxonomy_path);
    return parts.join(" › ");
  })();

  return (
    <div
      data-entry-id={entry.id}
      draggable={!renaming}
      onClick={renaming ? undefined : onClick}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e, entry); } : undefined}
      onDragStart={(e) => { e.dataTransfer.setData("entryId", String(entry.id)); onDragStart(entry.id); }}
      className={`flex items-center gap-2 py-1.5 select-none border-b border-gray-100 transition-opacity group ${
        isDragging ? "opacity-40 cursor-grabbing" :
        renaming ? "bg-white" :
        multiSelected ? "bg-red-100 cursor-pointer" :
        selected ? "bg-[#CCF2FF] cursor-pointer" :
        "hover:bg-white cursor-pointer"
      }`}
      style={{ paddingLeft: `${12 + depth * 16 + 20}px`, paddingRight: "8px" }}
    >
      <FileTypeIcon ext={ext} size={14} />
      {renaming ? (
        <input
          ref={inputRef}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(false); }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-xs border border-[#00D1FF] px-1 focus:outline-none"
        />
      ) : (
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate font-medium">{displayTitle}</div>
          {meta && <div className="text-[10px] text-gray-400 truncate mt-0.5">{meta}</div>}
          {archivePath && <div className="text-[9px] text-gray-400/70 truncate mt-0.5 font-mono">{archivePath}</div>}
        </div>
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
        }`}>{extLabel}</span>
      )}
    </div>
  );
}
