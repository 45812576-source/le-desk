"use client";

import { useEffect, useRef } from "react";
import { Pencil, Download, Trash2, Copy } from "lucide-react";
import type { KnowledgeDetail } from "@/lib/types";

interface ContextMenuProps {
  x: number;
  y: number;
  entry: KnowledgeDetail;
  onClose: () => void;
  onRename: (id: number, title: string) => void;
  onDelete: (id: number) => void;
  onDownload: (entry: KnowledgeDetail) => void;
  onCopyLink: (entry: KnowledgeDetail) => void;
  onStartRename: (id: number) => void;
}

export default function ContextMenu({
  x,
  y,
  entry,
  onClose,
  onDelete,
  onDownload,
  onCopyLink,
  onStartRename,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Adjust position to stay within viewport
  const menuWidth = 180;
  const menuHeight = 200;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 8);

  const items = [
    { icon: Pencil, label: "重命名", onClick: () => { onStartRename(entry.id); onClose(); } },
    { icon: Download, label: "下载原始文件", onClick: () => { onDownload(entry); onClose(); }, disabled: !entry.oss_key },
    { icon: Copy, label: "复制链接", onClick: () => { onCopyLink(entry); onClose(); } },
    null, // divider
    { icon: Trash2, label: "删除", onClick: () => { onDelete(entry.id); onClose(); }, danger: true },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[9999] bg-white border-2 border-[#1A202C] shadow-lg py-1 min-w-[180px]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3 py-1.5 border-b border-gray-100 text-[9px] font-bold text-gray-500 uppercase tracking-widest truncate max-w-[180px]">
        {entry.title || entry.ai_title || "文件"}
      </div>
      {items.map((item, i) => {
        if (item === null) {
          return <div key={`div-${i}`} className="my-1 border-t border-gray-100" />;
        }
        const { icon: Icon, label, onClick, danger, disabled } = item as { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean; disabled?: boolean };
        return (
          <button
            key={label}
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold text-left transition-colors ${
              disabled ? "opacity-30 cursor-not-allowed" :
              danger ? "text-red-500 hover:bg-red-50" :
              "text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
