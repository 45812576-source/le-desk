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
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center text-sm">
        加载中...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center text-sm">
        {error || "链接已失效"}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* 顶栏 */}
      <header className="sticky top-0 z-10 h-12 border-b border-border bg-card flex items-center px-6 shrink-0">
        <span className="text-sm font-bold tracking-wide opacity-60">Le Desk</span>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground truncate max-w-[300px]">{detail.title}</span>
      </header>

      {/* 内容区 */}
      <main className="flex-1 flex justify-center">
        <div className="w-full max-w-[960px] px-8 md:px-12 py-10">
          {/* 文档头 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <span className="px-2 py-0.5 rounded bg-accent text-accent-foreground">
                {detail.source_origin_label || "工作台"}
              </span>
              {isEditable && (
                <span className="px-2 py-0.5 rounded bg-[#00CC99]/10 text-[#00CC99]">可编辑</span>
              )}
              {detail.updated_at && (
                <span>更新于 {new Date(detail.updated_at).toLocaleString("zh-CN")}</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-bold leading-tight">{detail.title}</h1>
              {isEditable && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="shrink-0 px-4 py-1.5 text-xs font-semibold rounded-md border border-primary text-primary hover:bg-accent disabled:opacity-50 transition-colors"
                >
                  {saving ? "保存中..." : saveStatus === "saved" ? "已保存" : saveStatus === "error" ? "保存失败" : "保存"}
                </button>
              )}
            </div>
          </div>

          {/* 分隔线 */}
          <div className="border-b border-border mb-8" />

          {/* 文档正文 */}
          {isEditable ? (
            <div>
              <RichEditor
                content={detail.content_html || toHtml(detail.content || "")}
                onChange={handleEditorChange}
                editable={true}
              />
            </div>
          ) : (
            <article
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: detail.content_html || toHtml(detail.content || "") }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
