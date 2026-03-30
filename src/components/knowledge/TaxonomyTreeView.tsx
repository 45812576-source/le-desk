"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { PixelIcon, ICONS } from "@/components/pixel";
import { useTheme } from "@/lib/theme";
import type { KnowledgeDetail } from "@/lib/types";
import FileTypeIcon from "./FileTypeIcon";

const BOARD_LABELS: Record<string, string> = {
  A: "A. 渠道与平台",
  B: "B. 投放策略与方法论",
  C: "C. 行业与客户知识",
  D: "D. 产品与工具知识",
  E: "E. 运营与管理",
  F: "F. 外部资料与研究",
};

const BOARD_ORDER = ["A", "B", "C", "D", "E", "F"];

function ThemedFolderIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon pattern={ICONS.knowledgeMy.pattern} colors={ICONS.knowledgeMy.colors} size={size} />;
  return <BookOpen size={size} className="text-muted-foreground" />;
}

function groupByPrefix(boardEntries: KnowledgeDetail[]): Map<string, { label: string; entries: KnowledgeDetail[] }> {
  const map = new Map<string, { label: string; entries: KnowledgeDetail[] }>();
  for (const e of boardEntries) {
    if (!e.taxonomy_code) {
      const key = "__no_code__";
      if (!map.has(key)) map.set(key, { label: "其他", entries: [] });
      map.get(key)!.entries.push(e);
      continue;
    }
    const prefix = e.taxonomy_code.split(".")[0];
    const label = (e.taxonomy_path && e.taxonomy_path[1]) ? e.taxonomy_path[1] : prefix;
    if (!map.has(prefix)) map.set(prefix, { label, entries: [] });
    map.get(prefix)!.entries.push(e);
  }
  return map;
}

interface TaxonomyTreeViewProps {
  entries: KnowledgeDetail[];
  selectedEntry: KnowledgeDetail | null;
  onSelectEntry: (e: KnowledgeDetail) => void;
}

export default function TaxonomyTreeView({ entries, selectedEntry, onSelectEntry }: TaxonomyTreeViewProps) {
  const [openBoards, setOpenBoards] = useState<Set<string>>(new Set(["A"]));
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set());

  function toggleBoard(b: string) {
    setOpenBoards((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  }

  function toggleCode(code: string) {
    setOpenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

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

  return (
    <div className="flex-1 overflow-y-auto">
      {BOARD_ORDER.map((board) => {
        const boardEntries = byBoard[board] ?? [];
        const isOpen = openBoards.has(board);
        const grouped = groupByPrefix(boardEntries);

        return (
          <div key={board}>
            <div
              className="flex items-center gap-1 py-1 hover:bg-white group select-none cursor-pointer"
              style={{ paddingLeft: "8px", paddingRight: "8px" }}
              onClick={() => toggleBoard(board)}
            >
              <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{isOpen ? "▾" : "▸"}</span>
              <span className="mr-1 flex-shrink-0"><ThemedFolderIcon size={12} /></span>
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
                      <div
                        className="flex items-center gap-1 py-1 hover:bg-white select-none cursor-pointer"
                        style={{ paddingLeft: "24px", paddingRight: "8px" }}
                        onClick={() => toggleCode(codeKey)}
                      >
                        <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{isCodeOpen ? "▾" : "▸"}</span>
                        <span className="flex-1 text-[9px] font-bold truncate text-gray-600">{group.label}</span>
                        <span className="text-[8px] text-gray-400 flex-shrink-0">{group.entries.length}</span>
                      </div>
                      {isCodeOpen && group.entries.map((e) => {
                        const ext = e.file_ext || (e.source_file?.includes(".") ? `.${e.source_file.split(".").pop()}` : "");
                        const extLabel = ext.replace(/^\./, "").toUpperCase() || "TXT";
                        const isSelected = selectedEntry?.id === e.id;
                        return (
                          <div
                            key={e.id}
                            onClick={() => onSelectEntry(e)}
                            className={`flex items-center gap-2 py-1.5 select-none border-b border-gray-100 cursor-pointer transition-colors ${
                              isSelected ? "bg-[#CCF2FF]" : "hover:bg-white"
                            }`}
                            style={{ paddingLeft: "44px", paddingRight: "8px" }}
                          >
                            <FileTypeIcon ext={ext} size={14} />
                            <span className="flex-1 text-xs truncate">{e.title || e.source_file}</span>
                            <span className={`text-[7px] font-bold px-1 border flex-shrink-0 ${
                              e.status === "approved" ? "border-green-400 text-green-600" :
                              e.status === "pending" ? "border-yellow-400 text-yellow-600" :
                              "border-gray-300 text-gray-400"
                            }`}>{extLabel}</span>
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
              <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{isOpen ? "▾" : "▸"}</span>
              <span className="mr-1 flex-shrink-0"><ThemedFolderIcon size={12} /></span>
              <span className="flex-1 text-[10px] font-bold truncate text-gray-400">未分类</span>
              <span className="text-[8px] text-gray-400 flex-shrink-0">{unclassified.length}</span>
            </div>
            {isOpen && unclassified.map((e) => {
              const ext = e.file_ext || (e.source_file?.includes(".") ? `.${e.source_file.split(".").pop()}` : "");
              const extLabel = ext.replace(/^\./, "").toUpperCase() || "TXT";
              const isSelected = selectedEntry?.id === e.id;
              return (
                <div
                  key={e.id}
                  onClick={() => onSelectEntry(e)}
                  className={`flex items-center gap-2 py-1.5 select-none border-b border-gray-100 cursor-pointer transition-colors ${
                    isSelected ? "bg-[#CCF2FF]" : "hover:bg-white"
                  }`}
                  style={{ paddingLeft: "28px", paddingRight: "8px" }}
                >
                  <FileTypeIcon ext={ext} size={14} />
                  <span className="flex-1 text-xs truncate">{e.title || e.source_file}</span>
                  <span className={`text-[7px] font-bold px-1 border flex-shrink-0 ${
                    e.status === "approved" ? "border-green-400 text-green-600" :
                    e.status === "pending" ? "border-yellow-400 text-yellow-600" :
                    "border-gray-300 text-gray-400"
                  }`}>{extLabel}</span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
