"use client";

import React, { useState, useRef, useEffect } from "react";
import type { DataAssetFolder } from "./shared/types";
import { apiFetch } from "@/lib/api";

interface Props {
  folders: DataAssetFolder[];
  selectedFolderId: number | null;
  onSelectFolder: (id: number | null) => void;
  onFoldersChange: () => void;
}

function FolderItem({
  folder,
  depth,
  selectedId,
  onSelect,
  onFoldersChange,
}: {
  folder: DataAssetFolder;
  depth: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onFoldersChange: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (renaming) inputRef.current?.focus();
  }, [renaming]);

  const isSelected = selectedId === folder.id;
  const hasChildren = folder.children.length > 0;

  async function handleRename() {
    const val = renameVal.trim();
    if (val && val !== folder.name) {
      await apiFetch(`/data-assets/folders/${folder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: val }),
      });
      onFoldersChange();
    }
    setRenaming(false);
  }

  async function handleDelete() {
    if (!confirm(`确认删除目录「${folder.name}」？其中的表将移到根目录。`)) return;
    await apiFetch(`/data-assets/folders/${folder.id}`, { method: "DELETE" });
    if (isSelected) onSelect(null);
    onFoldersChange();
  }

  async function handleAddSub() {
    const name = prompt("子目录名称");
    if (!name?.trim()) return;
    await apiFetch("/data-assets/folders", {
      method: "POST",
      body: JSON.stringify({ name: name.trim(), parent_id: folder.id }),
    });
    setExpanded(true);
    onFoldersChange();
  }

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1 cursor-pointer text-[10px] font-bold hover:bg-[#EBF4F7] transition-colors group ${
          isSelected ? "bg-[#CCF2FF] text-[#00A3C4]" : "text-[#1A202C]"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(folder.id)}
        onContextMenu={(e) => { e.preventDefault(); setShowMenu(true); }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className={`w-3 text-[8px] text-gray-400 flex-shrink-0 ${hasChildren ? "" : "invisible"}`}
        >
          {expanded ? "▾" : "▸"}
        </button>
        <span className="text-[9px] flex-shrink-0">📁</span>
        {renaming ? (
          <input
            ref={inputRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-[10px] border border-[#00D1FF] px-1 py-0 focus:outline-none font-bold bg-white min-w-0"
          />
        ) : (
          <span className="truncate flex-1">{folder.name}</span>
        )}
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); handleAddSub(); }} className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5" title="新建子目录">+</button>
          <button onClick={(e) => { e.stopPropagation(); setRenaming(true); setRenameVal(folder.name); }} className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-0.5" title="重命名">✎</button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="text-[8px] text-gray-400 hover:text-red-400 px-0.5" title="删除">✕</button>
        </div>
      </div>
      {showMenu && (
        <div className="fixed z-50 bg-white border-2 border-[#1A202C] shadow-lg py-1 w-28" onClick={() => setShowMenu(false)}>
          <button onClick={() => { setRenaming(true); setRenameVal(folder.name); setShowMenu(false); }} className="w-full text-left px-3 py-1 text-[9px] font-bold hover:bg-[#F0F4F8]">重命名</button>
          <button onClick={() => { handleAddSub(); setShowMenu(false); }} className="w-full text-left px-3 py-1 text-[9px] font-bold hover:bg-[#F0F4F8]">新建子目录</button>
          <button onClick={() => { handleDelete(); setShowMenu(false); }} className="w-full text-left px-3 py-1 text-[9px] font-bold text-red-500 hover:bg-red-50">删除</button>
        </div>
      )}
      {expanded && folder.children.map((child) => (
        <FolderItem key={child.id} folder={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} onFoldersChange={onFoldersChange} />
      ))}
    </div>
  );
}

export default function FolderTree({ folders, selectedFolderId, onSelectFolder, onFoldersChange }: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const newRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) newRef.current?.focus();
  }, [creating]);

  async function handleCreate() {
    const val = newName.trim();
    if (!val) { setCreating(false); return; }
    await apiFetch("/data-assets/folders", {
      method: "POST",
      body: JSON.stringify({ name: val }),
    });
    setCreating(false);
    setNewName("");
    onFoldersChange();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b-2 border-[#1A202C] flex-shrink-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">目录</span>
        <button
          onClick={() => { setCreating(true); setNewName(""); }}
          className="flex items-center gap-1 px-2 py-0.5 border-2 border-[#1A202C] bg-white text-[9px] font-bold uppercase tracking-widest hover:bg-[#1A202C] hover:text-white transition-colors"
        >
          + 新建
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {/* 全部 */}
        <div
          className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer text-[10px] font-bold hover:bg-[#EBF4F7] transition-colors ${
            selectedFolderId === null ? "bg-[#CCF2FF] text-[#00A3C4]" : "text-[#1A202C]"
          }`}
          onClick={() => onSelectFolder(null)}
        >
          <span className="text-[9px]">📋</span>
          <span>全部数据表</span>
        </div>
        {creating && (
          <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-200">
            <input
              ref={newRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder="目录名称"
              className="flex-1 text-[10px] border-2 border-[#00D1FF] px-1.5 py-0.5 focus:outline-none font-bold bg-white"
            />
            <button onClick={handleCreate} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-[#1A202C] bg-[#1A202C] text-white">✓</button>
            <button onClick={() => setCreating(false)} className="text-[9px] font-bold px-1.5 py-0.5 border-2 border-gray-300 text-gray-500">✕</button>
          </div>
        )}
        {folders.map((f) => (
          <FolderItem key={f.id} folder={f} depth={0} selectedId={selectedFolderId} onSelect={onSelectFolder} onFoldersChange={onFoldersChange} />
        ))}
      </div>
    </div>
  );
}
