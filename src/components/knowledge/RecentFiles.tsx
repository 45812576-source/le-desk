"use client";

import { useState } from "react";
import type { KnowledgeDetail } from "@/lib/types";
import FileTypeIcon from "./FileTypeIcon";

const LS_KEY = "le_desk_recent_knowledge";
const MAX_RECENT = 5;

export function addRecentFile(id: number) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const ids: number[] = raw ? JSON.parse(raw) : [];
    const deduped = [id, ...ids.filter((x) => x !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(LS_KEY, JSON.stringify(deduped));
  } catch {}
}

export function getRecentIds(): number[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

interface RecentFilesProps {
  entries: KnowledgeDetail[];
  onSelect: (e: KnowledgeDetail) => void;
  selectedId?: number;
}

export default function RecentFiles({ entries, onSelect, selectedId }: RecentFilesProps) {
  const [open, setOpen] = useState(true);
  const recentIds = getRecentIds();
  const recentEntries = recentIds
    .map((id) => entries.find((e) => e.id === id))
    .filter(Boolean) as KnowledgeDetail[];

  if (recentEntries.length === 0) return null;

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>最近访问</span>
      </button>
      {open && (
        <div>
          {recentEntries.map((e) => {
            const ext = e.file_ext || (e.source_file?.includes(".") ? `.${e.source_file.split(".").pop()}` : "");
            return (
              <div
                key={e.id}
                onClick={() => onSelect(e)}
                className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer transition-colors border-b border-gray-50 ${
                  selectedId === e.id ? "bg-[#CCF2FF]" : "hover:bg-white"
                }`}
              >
                <FileTypeIcon ext={ext} size={12} />
                <span className="text-[10px] truncate flex-1">{e.title || e.ai_title || "未命名"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
