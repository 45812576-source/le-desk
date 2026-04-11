"use client";

import { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import type { StudioSummary } from "../types";

export function SummaryCard({
  summary,
  onConfirm,
  onConfirmEdited,
  onDiscard,
}: {
  summary: StudioSummary;
  onConfirm: () => void;
  onConfirmEdited: (editedItems: { label: string; value: string }[]) => void;
  onDiscard: () => void;
}) {
  const [editedItems, setEditedItems] = useState(() =>
    summary.items.map((item) => ({ ...item }))
  );
  const hasEdits = editedItems.some((item, i) => item.value !== summary.items[i]?.value);

  return (
    <div className="mx-3 my-2 border-2 border-[#00CC99] bg-[#F0FFF9] flex-shrink-0">
      <div className="px-3 py-2 border-b border-[#CCFFF0] flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99] flex-1">
          ◈ {summary.title || "需求理解摘要"}
        </span>
        <span className="text-[8px] text-gray-400">可直接编辑后确认</span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {editedItems.map((item, i) => (
          <div key={i} className="flex gap-2 text-[9px] items-start">
            <span className="font-bold text-[#00CC99] flex-shrink-0 w-16 truncate pt-0.5">{item.label}</span>
            <input
              type="text"
              value={item.value}
              onChange={(e) => {
                const next = [...editedItems];
                next[i] = { ...next[i], value: e.target.value };
                setEditedItems(next);
              }}
              className="flex-1 border border-gray-200 px-1.5 py-0.5 text-[9px] font-mono focus:outline-none focus:border-[#00CC99] bg-white"
            />
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-[#CCFFF0] flex gap-2">
        <PixelButton
          size="sm"
          onClick={() => hasEdits ? onConfirmEdited(editedItems) : onConfirm()}
          className="flex-1"
        >
          {hasEdits ? "✓ 按修改后的理解生成" : "✓ 确认，开始生成"}
        </PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={onDiscard}>重新描述</PixelButton>
      </div>
    </div>
  );
}
