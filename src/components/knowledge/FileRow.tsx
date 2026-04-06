"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
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
  // 标题统一读 title（后端已收口为 display_title 口径）
  const displayTitle = entry.title || "未命名";
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

  // 来源标签
  const sourceLabel = entry.source_type === "lark_doc" ? "飞书" : entry.source_type === "upload" ? "上传" : entry.source_type === "manual" ? "手动" : null;

  // 渲染/同步状态
  const renderStatus = entry.doc_render_status;
  const syncStatus = entry.sync_status;

  // 文档理解标签
  const docType = entry.understanding_document_type;
  const desensLevel = entry.understanding_desensitization_level;
  const summaryShort = entry.understanding_summary_short;

  const DOC_TYPE_LABELS: Record<string, string> = {
    policy: "制度", sop: "SOP", contract: "合同", proposal: "方案", report: "报告",
    meeting_note: "会议", customer_material: "客户", product_doc: "产品", finance_doc: "财务",
    hr_doc: "人事", case_study: "案例", training_material: "培训", external_intel: "情报",
    data_export: "导出", form_template: "模板", media_plan: "媒介", creative_brief: "创意",
    pitch_deck: "比稿", campaign_review: "复盘", vendor_material: "供应商", legal_doc: "法务", other: "其他",
  };
  const DESENS_COLORS: Record<string, string> = {
    D0: "bg-green-50 text-green-600 border-green-200",
    D1: "bg-blue-50 text-blue-600 border-blue-200",
    D2: "bg-yellow-50 text-yellow-600 border-yellow-200",
    D3: "bg-orange-50 text-orange-600 border-orange-200",
    D4: "bg-red-50 text-red-600 border-red-200",
  };

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
          <div className="flex items-center gap-1">
            <span className="text-xs truncate font-medium">{displayTitle}</span>
            {sourceLabel && (
              <span className={`text-[7px] px-1 py-px rounded flex-shrink-0 ${
                entry.source_type === "lark_doc" ? "bg-blue-50 text-blue-500" : "bg-gray-50 text-gray-400"
              }`}>{sourceLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {docType && DOC_TYPE_LABELS[docType] && (
              <span className="text-[7px] px-1 py-px rounded bg-indigo-50 text-indigo-500 flex-shrink-0 border border-indigo-100">{DOC_TYPE_LABELS[docType]}</span>
            )}
            {desensLevel && desensLevel !== "D0" && (
              <span className={`text-[7px] px-1 py-px rounded flex-shrink-0 border ${DESENS_COLORS[desensLevel] || "bg-gray-50 text-gray-400 border-gray-200"}`}>{desensLevel}</span>
            )}
            {entry.governance_status && entry.governance_status !== "ungoverned" && (
              <span className={`text-[7px] px-1 py-px rounded flex-shrink-0 border ${
                entry.governance_status === "aligned" ? "bg-green-50 text-green-600 border-green-200" :
                entry.governance_status === "suggested" || entry.governance_status === "needs_review" ? "bg-yellow-50 text-yellow-600 border-yellow-200" :
                "bg-gray-50 text-gray-400 border-gray-200"
              }`}>{entry.governance_status === "aligned" ? "已治理" : "待审"}</span>
            )}
            {meta && <span className="text-[10px] text-gray-400 truncate">{meta}</span>}
            {(renderStatus === "processing" || renderStatus === "pending") && entry.oss_key ? (
              <span className="inline-flex items-center gap-0.5 text-[8px] text-blue-400 flex-shrink-0">
                <Loader2 size={8} className="animate-spin" />转换中
              </span>
            ) : renderStatus === "failed" ? (
              <span className="inline-flex items-center gap-0.5 text-[8px] text-red-400 flex-shrink-0">
                <AlertTriangle size={8} />转换失败
              </span>
            ) : null}
            {syncStatus === "syncing" ? (
              <span className="text-[8px] text-blue-400 flex-shrink-0">同步中</span>
            ) : syncStatus === "error" ? (
              <span className="text-[8px] text-red-400 flex-shrink-0">同步异常</span>
            ) : null}
          </div>
          {archivePath && <div className="text-[9px] text-gray-400/70 truncate mt-0.5 font-mono">{archivePath}</div>}
          {summaryShort && <div className="text-[9px] text-gray-400 truncate mt-0.5">{summaryShort}</div>}
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
