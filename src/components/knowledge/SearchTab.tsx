"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { PixelIcon, ICONS, PixelBadge } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { useTheme } from "@/lib/theme";
import { apiFetch } from "@/lib/api";
import type { ChunkSearchResult, KnowledgeChunkDetail } from "@/lib/types";

const TAXONOMY_OPTIONS = [
  { value: "", label: "全部", color: "gray" as const },
  { value: "A", label: "A 渠道", color: "cyan" as const },
  { value: "B", label: "B 行业", color: "green" as const },
  { value: "C", label: "C 消费者", color: "yellow" as const },
  { value: "D", label: "D 方法论", color: "purple" as const },
  { value: "E", label: "E 公司", color: "gray" as const },
  { value: "F", label: "F 合规", color: "red" as const },
];

function ThemedBookIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon pattern={ICONS.knowledgeMy.pattern} colors={ICONS.knowledgeMy.colors} size={size} />;
  return <BookOpen size={size} className="text-muted-foreground" />;
}

export default function SearchTab() {
  const [q, setQ] = useState("");
  const [taxonomyBoard, setTaxonomyBoard] = useState("");
  const [results, setResults] = useState<ChunkSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<ChunkSearchResult | null>(null);
  const [preview, setPreview] = useState<KnowledgeChunkDetail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function handleSearch() {
    if (loading) return;
    setLoading(true);
    setSearched(true);
    setSelectedChunk(null);
    setPreview(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (taxonomyBoard) params.set("taxonomy_board", taxonomyBoard);
      params.set("limit", "30");
      const data = await apiFetch<ChunkSearchResult[]>(`/knowledge/chunks/search?${params}`);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectChunk(chunk: ChunkSearchResult) {
    setSelectedChunk(chunk);
    if (preview?.id === chunk.knowledge_id) return;
    setPreviewLoading(true);
    setPreview(null);
    try {
      const data = await apiFetch<KnowledgeChunkDetail>(`/knowledge/${chunk.knowledge_id}/chunks`);
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="输入关键词搜索知识切片..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1 border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
        />
        <PixelButton onClick={handleSearch} disabled={loading}>
          {loading ? "搜索中..." : "搜索"}
        </PixelButton>
      </div>

      <div className="flex items-center gap-1 flex-wrap mb-5">
        {TAXONOMY_OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => setTaxonomyBoard(o.value)}
            className={`px-2 py-0.5 border-2 text-[9px] font-bold uppercase tracking-widest transition-colors ${
              taxonomyBoard === o.value
                ? "border-[#1A202C] bg-[#1A202C] text-white"
                : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {!searched ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
            <ThemedBookIcon size={20} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">输入关键词搜索知识切片</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">搜索中...</div>
        </div>
      ) : (
        <div className="flex gap-4 h-[calc(100vh-300px)]">
          <div className="w-80 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">未找到匹配结果</p>
                <p className="text-[9px] text-gray-400">尝试不同的关键词或切换分类</p>
              </div>
            ) : (
              results.map((chunk, idx) => {
                const isSelected = selectedChunk?.knowledge_id === chunk.knowledge_id && selectedChunk?.chunk_index === chunk.chunk_index;
                const board = chunk.taxonomy_board ?? "";
                const taxOpt = TAXONOMY_OPTIONS.find((o) => o.value === board);
                return (
                  <div
                    key={`${chunk.knowledge_id}-${chunk.chunk_index}-${idx}`}
                    onClick={() => handleSelectChunk(chunk)}
                    className={`border-2 p-3 cursor-pointer transition-colors ${isSelected ? "border-[#00D1FF] bg-[#CCF2FF]" : "border-[#1A202C] bg-white hover:border-[#00A3C4]"}`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold truncate max-w-[140px]">{chunk.title}</span>
                      {taxOpt?.value && <PixelBadge color={taxOpt.color}>{taxOpt.label}</PixelBadge>}
                      <span className="text-[8px] text-gray-400 ml-auto">{Math.round(chunk.score * 100)}%</span>
                    </div>
                    {chunk.heading_path && (
                      <p className="text-[8px] text-gray-400 mb-1 truncate">📍 {chunk.heading_path}</p>
                    )}
                    <p className="text-[9px] text-gray-500 line-clamp-3 leading-relaxed">{chunk.text}</p>
                    {chunk.source_file && <p className="text-[8px] text-[#00A3C4] mt-1 truncate">{chunk.source_file}</p>}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex-1 border-2 border-[#1A202C] bg-white overflow-y-auto">
            {!selectedChunk ? (
              <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-gray-400">点击左侧结果预览</div>
            ) : previewLoading ? (
              <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">加载中...</div>
            ) : preview ? (
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h2 className="text-sm font-bold">{preview.title}</h2>
                  {preview.source_type && <PixelBadge color="gray">{preview.source_type}</PixelBadge>}
                </div>
                {preview.source_file && <p className="text-[9px] text-[#00A3C4] mb-4">来源文件：{preview.source_file}</p>}
                {selectedChunk?.heading_path && (
                  <div className="flex items-center gap-1 mb-3 px-2 py-1.5 bg-[#F0F9FF] border border-[#00D1FF]/30 text-[9px] text-[#00A3C4]">
                    <span className="font-bold">定位:</span>
                    <span>{selectedChunk.heading_path}</span>
                  </div>
                )}
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">全文内容</div>
                <div className="space-y-3">
                  {preview.chunks.map((c) => {
                    const isHit = selectedChunk?.chunk_index === c.index;
                    return (
                      <div
                        key={c.index}
                        id={`chunk-${c.index}`}
                        ref={isHit ? (el) => { el?.scrollIntoView({ behavior: "smooth", block: "center" }); } : undefined}
                        className={`border-l-2 pl-3 py-1 text-[10px] leading-relaxed whitespace-pre-wrap transition-colors ${isHit ? "border-[#00D1FF] bg-[#CCF2FF]/30 text-[#1A202C]" : "border-gray-200 text-gray-500"}`}
                      >
                        {c.text}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-red-400">加载失败</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
