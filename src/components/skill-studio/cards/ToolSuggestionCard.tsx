"use client";

import { useState } from "react";
import { Package, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { StudioToolSuggestion } from "../types";

export function ToolSuggestionCard({
  suggestion,
  skillId,
  onBound,
  onDevStudio,
}: {
  suggestion: StudioToolSuggestion;
  skillId: number | null;
  onBound: () => void;
  onDevStudio: (desc: string) => void;
}) {
  const [binding, setBinding] = useState<number | null>(null);

  async function handleBind(toolId: number) {
    if (!skillId) return;
    setBinding(toolId);
    try {
      await apiFetch(`/tools/skill/${skillId}/tools/${toolId}`, { method: "POST" });
      onBound();
    } catch (err) {
      console.error("Bind failed", err);
    } finally { setBinding(null); }
  }

  return (
    <div className="border border-[#6B46C1] rounded-lg overflow-hidden bg-[#6B46C1]/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Package size={10} className="text-[#6B46C1]" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">工具建议</span>
      </div>
      {suggestion.suggestions.map((s, i) => (
        <div key={i} className="flex items-start gap-2 pl-1">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-gray-800">{s.name}</div>
            <div className="text-[9px] text-gray-500 mt-0.5">{s.reason}</div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {s.action === "bind_existing" && s.tool_id ? (
              <button
                onClick={() => handleBind(s.tool_id!)}
                disabled={binding === s.tool_id}
                className="text-[8px] font-bold px-2 py-1 bg-[#6B46C1] text-white disabled:opacity-50"
              >
                {binding === s.tool_id ? "..." : "绑定"}
              </button>
            ) : (
              <button
                onClick={() => onDevStudio(s.name + "：" + s.reason)}
                className="text-[8px] font-bold px-2 py-1 bg-[#6B46C1] text-white flex items-center gap-1"
              >
                <ExternalLink size={7} />
                Dev Studio
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
