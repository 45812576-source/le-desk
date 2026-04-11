"use client";

import { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { DiffViewer } from "../DiffViewer";
import type { StudioDraft } from "../types";

export function DraftCard({
  draft,
  currentPrompt,
  onApply,
  onDiscard,
}: {
  draft: StudioDraft;
  currentPrompt: string;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const hasDiff = currentPrompt !== draft.system_prompt;

  return (
    <div className="mx-3 my-2 border-2 border-[#00A3C4] bg-[#F0FAFF] flex-shrink-0">
      <div className="px-3 py-2 border-b border-[#CCE8F4] flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] flex-1">
          ✦ 待采纳草稿{draft.name ? `：${draft.name}` : ""}
        </span>
        {hasDiff && (
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="text-[8px] font-bold uppercase text-gray-400 hover:text-[#00A3C4]"
          >
            {showPreview ? "收起" : "预览变更"}
          </button>
        )}
      </div>
      {draft.change_note && (
        <div className="px-3 py-1.5 text-[9px] text-gray-600 border-b border-[#CCE8F4]">{draft.change_note}</div>
      )}
      {showPreview && hasDiff && (
        <div className="max-h-48 overflow-auto border-b border-[#CCE8F4]">
          <DiffViewer oldText={currentPrompt} newText={draft.system_prompt} />
        </div>
      )}
      <div className="px-3 py-2 flex gap-2">
        <PixelButton size="sm" onClick={onApply} className="flex-1">✓ 应用到编辑框</PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={onDiscard}>丢弃</PixelButton>
      </div>
    </div>
  );
}
