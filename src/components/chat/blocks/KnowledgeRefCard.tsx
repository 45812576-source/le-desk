import type { ContentBlock } from "@/lib/types";

type KnowledgeRefBlock = Extract<ContentBlock, { type: "knowledge_ref" }>;

export function KnowledgeRefCard({ block }: { block: KnowledgeRefBlock }) {
  return (
    <div className="my-1 flex items-start gap-2 border border-[#00A3C4] bg-[#F0FAFF] px-3 py-1.5">
      <span className="text-[#00A3C4] text-xs mt-0.5">◎</span>
      <div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
          知识引用 #{block.id}
        </div>
        <div className="text-[10px] font-semibold text-[#1A202C]">{block.title}</div>
        {block.snippet && (
          <div className="text-[9px] text-gray-400 mt-0.5 line-clamp-2">{block.snippet}</div>
        )}
      </div>
    </div>
  );
}
