"use client";

import React, { useEffect, useRef, useState } from "react";
import { PixelIcon, ICONS } from "@/components/pixel";
import { useTheme } from "@/lib/theme";
import { Table2 } from "lucide-react";
import { BusinessTable, VirtualFolder } from "../shared/types";

function ThemedIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.data} size={size} />;
  return <Table2 size={size} className="text-muted-foreground" />;
}

// Table row in tree
export function TableRow({
  table,
  selected,
  depth,
  onClick,
  onDragStart,
  isDragging,
}: {
  table: BusinessTable;
  selected: boolean;
  depth: number;
  onClick: () => void;
  onDragStart: (id: number) => void;
  isDragging: boolean;
}) {
  return (
    <div
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.dataTransfer.setData("tableId", String(table.id));
        onDragStart(table.id);
      }}
      className={`flex items-center gap-2 py-1.5 select-none border-b border-gray-100 cursor-pointer transition-opacity group ${
        isDragging
          ? "opacity-40 cursor-grabbing"
          : selected
          ? "bg-[#CCF2FF]"
          : "hover:bg-white"
      }`}
      style={{ paddingLeft: `${8 + depth * 16 + 20}px`, paddingRight: "8px" }}
    >
      <ThemedIcon size={12} />
      <span className="flex-1 text-[10px] font-bold truncate">
        {table.display_name}
      </span>
      <span className="text-[8px] font-mono text-gray-400 hidden group-hover:inline">
        {table.table_name}
      </span>
    </div>
  );
}

// Folder node
export default function FolderNode({
  folder,
  subFolders: childFolders,
  tables,
  selectedId,
  onSelectTable,
  onRenameFolder,
  onDeleteFolder,
  onNewSubfolder,
  onDropTable,
  draggingTableId,
  onDragStart,
  depth,
}: {
  folder: VirtualFolder;
  subFolders: VirtualFolder[];
  tables: BusinessTable[];
  selectedId: number | null;
  onSelectTable: (t: BusinessTable) => void;
  onRenameFolder: (id: number, name: string) => void;
  onDeleteFolder: (id: number) => void;
  onNewSubfolder: (parentId: number, name: string) => void;
  onDropTable: (tableId: number, folderId: number | null) => void;
  draggingTableId: number | null;
  onDragStart: (id: number) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [addingChild, setAddingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const childRef = useRef<HTMLInputElement>(null);
  const [dropTarget, setDropTarget] = useState(false);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  function submitRename() {
    if (nameVal.trim() && nameVal.trim() !== folder.name) onRenameFolder(folder.id, nameVal.trim());
    setRenaming(false);
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 group select-none transition-colors ${
          dropTarget && draggingTableId !== null
            ? "bg-[#CCF2FF] border-l-2 border-[#00D1FF]"
            : "hover:bg-white"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px`, paddingRight: "8px" }}
        onDragOver={(e) => { if (draggingTableId !== null) { e.preventDefault(); setDropTarget(true); } }}
        onDragLeave={() => setDropTarget(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropTarget(false);
          const id = parseInt(e.dataTransfer.getData("tableId"));
          if (!isNaN(id)) { onDropTable(id, folder.id); setOpen(true); }
        }}
      >
        <span
          className="text-[10px] w-4 text-gray-400 flex-shrink-0 cursor-pointer hover:text-[#00A3C4] text-center"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        >
          {open ? "▾" : "▸"}
        </span>
        <span className="mr-1 flex-shrink-0 text-[9px]">📁</span>
        {renaming ? (
          <input
            ref={inputRef}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-[10px] font-bold border border-[#00D1FF] px-1 focus:outline-none bg-white"
          />
        ) : (
          <span
            className="flex-1 text-[10px] font-bold truncate cursor-pointer"
            onClick={() => setOpen((v) => !v)}
          >
            {folder.name}
          </span>
        )}
        {!renaming && (
          <span className="hidden group-hover:flex items-center gap-1 ml-1 flex-shrink-0">
            <button
              className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5"
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setNameVal(folder.name); }}
              title="重命名"
            >✎</button>
            <button
              className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5"
              onClick={(e) => {
                e.stopPropagation();
                setAddingChild(true);
                setChildName("");
                setOpen(true);
                setTimeout(() => childRef.current?.focus(), 30);
              }}
              title="新建子文件夹"
            >+</button>
            <button
              className="text-[8px] text-gray-400 hover:text-red-400 px-0.5"
              onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
              title="删除"
            >✕</button>
          </span>
        )}
      </div>

      {open && (
        <>
          {childFolders.map((cf) => (
            <FolderNode
              key={cf.id}
              folder={cf}
              subFolders={[]}
              tables={tables.filter((t) => (t.validation_rules?.folder_id ?? null) === cf.id)}
              selectedId={selectedId}
              onSelectTable={onSelectTable}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onNewSubfolder={onNewSubfolder}
              onDropTable={onDropTable}
              draggingTableId={draggingTableId}
              onDragStart={onDragStart}
              depth={depth + 1}
            />
          ))}
          {addingChild && (
            <div
              className="flex items-center gap-1 py-1"
              style={{ paddingLeft: `${8 + (depth + 1) * 16}px`, paddingRight: "8px" }}
            >
              <input
                ref={childRef}
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { if (childName.trim()) onNewSubfolder(folder.id, childName.trim()); setAddingChild(false); }
                  if (e.key === "Escape") setAddingChild(false);
                }}
                placeholder="文件夹名称"
                className="flex-1 text-[10px] border-2 border-[#00D1FF] px-1.5 py-0.5 focus:outline-none font-bold bg-white"
              />
              <button
                onClick={() => { if (childName.trim()) onNewSubfolder(folder.id, childName.trim()); setAddingChild(false); }}
                className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4]"
              >✓</button>
              <button
                onClick={() => setAddingChild(false)}
                className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-400"
              >✕</button>
            </div>
          )}
          {tables.map((t) => (
            <TableRow
              key={t.id}
              table={t}
              selected={selectedId === t.id}
              depth={depth}
              onClick={() => onSelectTable(t)}
              onDragStart={onDragStart}
              isDragging={draggingTableId === t.id}
            />
          ))}
        </>
      )}
    </div>
  );
}
