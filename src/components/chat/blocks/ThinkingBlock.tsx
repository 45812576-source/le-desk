"use client";

import { useEffect, useRef, useState } from "react";

export function ThinkingBlock({ text, streaming }: { text: string; streaming?: boolean }) {
  const [open, setOpen] = useState(!!streaming);
  const prevStreaming = useRef(streaming);

  // Auto-collapse when streaming ends
  useEffect(() => {
    if (prevStreaming.current && !streaming) {
      Promise.resolve().then(() => setOpen(false));
    }
    prevStreaming.current = streaming;
  }, [streaming]);

  return (
    <div className="mb-2 border border-gray-200 bg-[#F8FAFC]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span className={`text-[#00A3C4] ${streaming ? "animate-pulse" : ""}`}>◈</span>
          AI 思考过程
          {streaming && (
            <span className="text-[8px] text-[#00A3C4] animate-pulse ml-1">思考中...</span>
          )}
        </span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 text-[10px] text-gray-400 font-mono whitespace-pre-wrap leading-relaxed border-t border-gray-100">
          {text}
          {streaming && (
            <span className="inline-block w-1.5 h-3 bg-[#00A3C4] ml-0.5 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}
