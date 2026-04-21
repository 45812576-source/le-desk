"use client";

import { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { DiffViewer } from "../DiffViewer";
import { CATEGORY_CONFIG } from "../utils";
import type { StudioFileSplit } from "../types";

export function FileSplitCard({
  split,
  currentPrompt,
  skillId,
  splitting,
  onConfirm,
  onDiscard,
}: {
  split: StudioFileSplit;
  currentPrompt: string;
  skillId: number | null;
  splitting: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const hasDiff = currentPrompt !== split.main_prompt_after_split;

  return (
    <div className="mx-3 my-2 border border-[#E9D5FF] rounded-lg overflow-hidden bg-[#FAF5FF] flex-shrink-0">
      <div className="px-3 py-2 border-b border-[#E9D5FF] flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1] flex-1">
          ✦ 文件拆分建议
        </span>
        <span className="text-[8px] text-gray-400">{split.files.length} 个文件待拆出</span>
      </div>
      {split.change_note && (
        <div className="px-3 py-1.5 text-[9px] text-gray-600 border-b border-[#E9D5FF]">{split.change_note}</div>
      )}
      <div className="px-3 py-2 space-y-1.5">
        {split.files.map((f, i) => {
          const cfg = CATEGORY_CONFIG[f.category] || CATEGORY_CONFIG.other;
          const CatIcon = cfg.icon;
          return (
            <div key={i} className="flex items-start gap-2">
              <CatIcon size={10} className="text-[#6B46C1] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-bold text-gray-800">{f.filename}</span>
                  <span className="text-[7px] px-1 py-0.5 bg-[#6B46C1]/10 text-[#6B46C1] font-bold">{cfg.label}</span>
                </div>
                <div className="text-[8px] text-gray-500 mt-0.5">{f.reason}</div>
              </div>
            </div>
          );
        })}
      </div>
      {hasDiff && (
        <div className="px-3 py-1 border-t border-[#E9D5FF]">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#6B46C1]"
          >
            {showPreview ? "收起主文件变更" : "预览主文件变更"}
          </button>
        </div>
      )}
      {showPreview && hasDiff && (
        <div className="max-h-48 overflow-auto border-t border-[#E9D5FF]">
          <DiffViewer oldText={currentPrompt} newText={split.main_prompt_after_split} />
        </div>
      )}
      <div className="px-3 py-2 border-t border-[#E9D5FF] flex gap-2">
        <PixelButton size="sm" onClick={onConfirm} disabled={splitting || !skillId} className="flex-1">
          {splitting ? "拆分中..." : "✓ 确认拆分"}
        </PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={onDiscard} disabled={splitting}>不拆分</PixelButton>
      </div>
    </div>
  );
}
