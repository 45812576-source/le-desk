"use client";

import { useState } from "react";
import type { ContentBlock } from "@/lib/types";

type ToolResultBlock = Extract<ContentBlock, { type: "tool_result" }>;

export function ToolResultCard({ block }: { block: ToolResultBlock }) {
  const [expanded, setExpanded] = useState(false);
  const summary = block.output.length > 100 ? block.output.slice(0, 100) + "..." : block.output;

  return (
    <div className={`my-1 border-l-4 ${block.ok ? "border-l-[#00CC99] bg-[#F0FFF8]" : "border-l-red-400 bg-red-50"} border border-gray-200`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={block.ok ? "text-[#00CC99]" : "text-red-500"}>{block.ok ? "✓" : "✗"}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500 shrink-0">
            工具结果
          </span>
          {!expanded && (
            <span className="text-[9px] text-gray-400 truncate min-w-0">{summary}</span>
          )}
        </div>
        <span className="text-[8px] text-gray-400 shrink-0 ml-2">{expanded ? "收起" : "展开"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 border-t border-gray-100">
          <pre className="text-[9px] font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap mt-1">
            {block.output}
          </pre>
        </div>
      )}
    </div>
  );
}
