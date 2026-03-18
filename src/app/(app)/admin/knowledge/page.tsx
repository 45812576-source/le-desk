"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { KnowledgeDetail } from "@/lib/types";

const STAGE_BADGE: Record<
  string,
  { color: "cyan" | "green" | "yellow" | "red" | "purple" | "gray"; label: string }
> = {
  auto_approved: { color: "green", label: "自动通过" },
  pending_dept: { color: "yellow", label: "待部门审核" },
  dept_approved_pending_super: { color: "purple", label: "待超管确认" },
  approved: { color: "green", label: "已通过" },
  rejected: { color: "red", label: "已拒绝" },
};

export default function AdminKnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("pending_dept");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const fetchEntries = useCallback(() => {
    Promise.resolve().then(() => setLoading(true));
    const params = new URLSearchParams();
    if (stageFilter) params.set("review_stage", stageFilter);
    apiFetch<KnowledgeDetail[]>(`/knowledge?${params}`)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [stageFilter]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  async function handleReview(id: number, action: "approve" | "reject") {
    try {
      await apiFetch(`/knowledge/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, note: reviewNote }),
      });
      setReviewNote("");
      setExpanded(null);
      fetchEntries();
    } catch {
      // ignore
    }
  }

  async function handleSuperReview(id: number, action: "approve" | "reject") {
    try {
      await apiFetch(`/knowledge/${id}/super-review`, {
        method: "POST",
        body: JSON.stringify({ action, note: reviewNote }),
      });
      setReviewNote("");
      setExpanded(null);
      fetchEntries();
    } catch {
      // ignore
    }
  }

  return (
    <PageShell title="知识审核" icon={ICONS.review}>
      {/* Filter bar */}
      <div className="flex gap-1 mb-4">
        {[
          { key: "pending_dept", label: "待部门审核" },
          { key: "dept_approved_pending_super", label: "待超管确认" },
          { key: "", label: "全部" },
        ].map((f) => (
          <PixelButton
            key={f.key}
            variant={stageFilter === f.key ? "primary" : "secondary"}
            size="sm"
            onClick={() => setStageFilter(f.key)}
          >
            {f.label}
          </PixelButton>
        ))}
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : entries.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          无待审核条目
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const stage = STAGE_BADGE[entry.review_stage] || STAGE_BADGE.pending_dept;
            const isExpanded = expanded === entry.id;
            return (
              <div key={entry.id} className="bg-white border-2 border-[#1A202C]">
                <button
                  onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold">{entry.title}</span>
                      <PixelBadge color={stage.color}>{stage.label}</PixelBadge>
                      <PixelBadge color="purple">{entry.category}</PixelBadge>
                      <PixelBadge color="cyan">L{entry.review_level}</PixelBadge>
                    </div>
                    <span className="text-[8px] text-gray-400 flex-shrink-0">
                      {new Date(entry.created_at).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{entry.content}</p>
                  {entry.sensitivity_flags && entry.sensitivity_flags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {entry.sensitivity_flags.map((f) => (
                        <PixelBadge key={f} color="red">
                          {f}
                        </PixelBadge>
                      ))}
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t-2 border-[#1A202C] p-4">
                    <pre className="text-[10px] bg-gray-50 border border-gray-200 p-3 max-h-60 overflow-auto whitespace-pre-wrap mb-3">
                      {entry.content}
                    </pre>
                    {entry.auto_review_note && (
                      <div className="text-[10px] text-gray-500 mb-2">
                        <span className="font-bold">AI 审核意见：</span>
                        {entry.auto_review_note}
                      </div>
                    )}
                    <input
                      type="text"
                      placeholder="审核备注（可选）"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold mb-2 focus:outline-none focus:border-[#00D1FF]"
                    />
                    <div className="flex gap-2">
                      {entry.review_stage === "pending_dept" && (
                        <>
                          <PixelButton size="sm" onClick={() => handleReview(entry.id, "approve")}>
                            通过
                          </PixelButton>
                          <PixelButton
                            size="sm"
                            variant="danger"
                            onClick={() => handleReview(entry.id, "reject")}
                          >
                            拒绝
                          </PixelButton>
                        </>
                      )}
                      {entry.review_stage === "dept_approved_pending_super" && (
                        <>
                          <PixelButton
                            size="sm"
                            onClick={() => handleSuperReview(entry.id, "approve")}
                          >
                            超管确认
                          </PixelButton>
                          <PixelButton
                            size="sm"
                            variant="danger"
                            onClick={() => handleSuperReview(entry.id, "reject")}
                          >
                            拒绝
                          </PixelButton>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
