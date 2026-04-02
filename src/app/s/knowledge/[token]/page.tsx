"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { PublicKnowledgeDetail } from "@/lib/types";

function toHtml(raw: string): string {
  if (!raw) return "";
  if (/^</.test(raw.trim())) return raw;
  return raw.split("\n").map((l) => `<p>${l || "<br>"}</p>`).join("");
}

export default function PublicKnowledgeSharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [detail, setDetail] = useState<PublicKnowledgeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<PublicKnowledgeDetail>(`/knowledge/public/share/${token}`, { headers: {} })
      .then((data) => {
        setDetail(data);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "链接已失效");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <div className="min-h-screen bg-[#FAFAF7] text-[#1A202C] flex items-center justify-center text-sm">加载中...</div>;
  }

  if (error || !detail) {
    return <div className="min-h-screen bg-[#FAFAF7] text-[#1A202C] flex items-center justify-center text-sm">{error || "链接已失效"}</div>;
  }

  return (
    <main className="min-h-screen bg-[#FAFAF7] text-[#1A202C] px-4 py-8">
      <div className="max-w-3xl mx-auto bg-white border border-[#E5E7EB] shadow-sm">
        <div className="px-6 py-5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-2">
            <span className="px-2 py-0.5 rounded bg-[#F0F9FF] text-[#00A3C4]">{detail.source_origin_label || "工作台"}</span>
            {detail.updated_at && <span>更新于 {new Date(detail.updated_at).toLocaleString("zh-CN")}</span>}
          </div>
          <h1 className="text-2xl font-bold leading-tight">{detail.title}</h1>
        </div>
        <article
          className="px-6 py-6 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: detail.content_html || toHtml(detail.content || "") }}
        />
      </div>
    </main>
  );
}
