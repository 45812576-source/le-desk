"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { PublicKnowledgeDetail } from "@/lib/types";
import { RichEditor } from "@/components/knowledge/RichEditor";

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
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const htmlRef = useRef("");

  const isEditable = detail?.share_meta?.access_scope === "public_editable";

  useEffect(() => {
    if (!token) return;
    apiFetch<PublicKnowledgeDetail>(`/knowledge/public/share/${token}`, { headers: {} })
      .then((data) => {
        setDetail(data);
        htmlRef.current = data.content_html || toHtml(data.content || "");
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "链接已失效");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleEditorChange = useCallback((html: string) => {
    htmlRef.current = html;
    setSaveStatus("idle");
  }, []);

  const handleSave = useCallback(async () => {
    if (!token || saving) return;
    setSaving(true);
    try {
      await apiFetch(`/knowledge/public/share/${token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_html: htmlRef.current }),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, [token, saving]);

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
            {isEditable && <span className="px-2 py-0.5 rounded bg-[#00CC99]/10 text-[#00CC99]">可编辑</span>}
            {detail.updated_at && <span>更新于 {new Date(detail.updated_at).toLocaleString("zh-CN")}</span>}
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold leading-tight">{detail.title}</h1>
            {isEditable && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 text-[11px] font-semibold rounded border border-[#00A3C4] text-[#00A3C4] hover:bg-[#F0F9FF] disabled:opacity-50 transition-colors"
              >
                {saving ? "保存中..." : saveStatus === "saved" ? "已保存" : saveStatus === "error" ? "保存失败" : "保存"}
              </button>
            )}
          </div>
        </div>
        {isEditable ? (
          <div className="px-6 py-6">
            <RichEditor
              content={detail.content_html || toHtml(detail.content || "")}
              onChange={handleEditorChange}
              editable={true}
            />
          </div>
        ) : (
          <article
            className="px-6 py-6 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: detail.content_html || toHtml(detail.content || "") }}
          />
        )}
      </div>
    </main>
  );
}
