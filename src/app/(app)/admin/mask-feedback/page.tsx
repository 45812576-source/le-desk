"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { KnowledgeMaskFeedback } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = { pending: "待审核", approved: "已批准", rejected: "已驳回" };
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};
const DESENS_COLORS: Record<string, string> = {
  D0: "text-gray-500", D1: "text-blue-600", D2: "text-yellow-600", D3: "text-orange-600", D4: "text-red-600",
};

export default function MaskFeedbackPage() {
  const [items, setItems] = useState<KnowledgeMaskFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewAction, setReviewAction] = useState("update_file");

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (filter) params.set("status", filter);
      const data = await apiFetch<{ items: KnowledgeMaskFeedback[]; total: number }>(
        `/knowledge/mask-feedback?${params}`
      );
      setItems(data.items);
      setTotal(data.total);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleAction(id: number, action: "approve" | "reject") {
    try {
      await apiFetch(`/knowledge/mask-feedback/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ review_note: reviewNote, review_action: action === "approve" ? reviewAction : undefined }),
      });
      setReviewingId(null);
      setReviewNote("");
      fetchList();
    } catch { /* silent */ }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[12px] font-bold uppercase tracking-widest text-[#1A202C]">脱敏纠错审查台</h1>
        <div className="flex gap-1">
          {["", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => { setFilter(s); setPage(1); }}
              className={`px-2 py-0.5 text-[8px] rounded border ${filter === s ? "bg-[#00A3C4] text-white border-[#00A3C4]" : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"}`}
            >
              {s ? STATUS_LABELS[s] : "全部"}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="text-[9px] text-gray-400 text-center py-8">加载中...</div>}

      {!loading && items.length === 0 && (
        <div className="text-[9px] text-gray-400 text-center py-12">暂无纠错建议</div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((fb) => (
            <div key={fb.id} className="border border-gray-200 rounded-lg bg-white">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
                <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded border ${STATUS_COLORS[fb.status]}`}>
                  {STATUS_LABELS[fb.status]}
                </span>
                <span className="text-[9px] font-medium text-gray-700">{fb.knowledge_title || `知识 #${fb.knowledge_id}`}</span>
                <span className="ml-auto text-[8px] text-gray-400">{fb.submitter_name} · {fb.created_at?.slice(0, 10)}</span>
              </div>
              <div className="px-4 py-2 space-y-1.5">
                {/* 等级对比 */}
                <div className="flex items-center gap-2 text-[9px]">
                  <span className="text-gray-400">当前:</span>
                  <span className={`font-bold ${DESENS_COLORS[fb.current_desensitization_level || ""] || "text-gray-500"}`}>
                    {fb.current_desensitization_level || "-"}
                  </span>
                  <span className="text-gray-300">→</span>
                  <span className="text-gray-400">建议:</span>
                  <span className={`font-bold ${DESENS_COLORS[fb.suggested_desensitization_level] || "text-gray-500"}`}>
                    {fb.suggested_desensitization_level}
                  </span>
                </div>
                {/* 原因 */}
                <div className="text-[9px] text-gray-600"><span className="text-gray-400">原因:</span> {fb.reason}</div>
                {/* 证据 */}
                {fb.evidence_snippet && (
                  <div className="text-[8px] text-gray-500 bg-gray-50 p-1.5 rounded border border-gray-100 font-mono whitespace-pre-wrap">
                    {fb.evidence_snippet}
                  </div>
                )}
                {/* 审核结果 */}
                {fb.review_note && (
                  <div className="text-[8px] text-gray-500"><span className="text-gray-400">审核备注:</span> {fb.review_note}</div>
                )}
              </div>

              {/* 操作区 */}
              {fb.status === "pending" && (
                <div className="px-4 py-2 border-t border-gray-100">
                  {reviewingId === fb.id ? (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <select
                          value={reviewAction}
                          onChange={(e) => setReviewAction(e.target.value)}
                          className="text-[9px] border border-gray-300 rounded px-1.5 py-0.5"
                        >
                          <option value="update_file">仅更新当前文件</option>
                          <option value="update_rule">记录规则版本</option>
                        </select>
                      </div>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="审核备注（可选）"
                        className="w-full text-[9px] border border-gray-300 rounded px-2 py-1 h-10 resize-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setReviewingId(null)} className="px-2 py-0.5 text-[8px] text-gray-500 border border-gray-300 rounded hover:bg-gray-50">取消</button>
                        <button onClick={() => handleAction(fb.id, "reject")} className="px-2 py-0.5 text-[8px] text-red-600 border border-red-300 rounded hover:bg-red-50">驳回</button>
                        <button onClick={() => handleAction(fb.id, "approve")} className="px-2 py-0.5 text-[8px] text-white bg-[#00A3C4] rounded hover:bg-[#008DAA]">批准</button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReviewingId(fb.id); setReviewNote(""); }}
                      className="text-[8px] text-[#00A3C4] hover:underline"
                    >
                      审核
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {total > 20 && (
        <div className="flex justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-0.5 text-[8px] border border-gray-300 rounded disabled:opacity-30">上一页</button>
          <span className="text-[8px] text-gray-400 py-0.5">第 {page} 页 / 共 {Math.ceil(total / 20)} 页</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)} className="px-2 py-0.5 text-[8px] border border-gray-300 rounded disabled:opacity-30">下一页</button>
        </div>
      )}
    </div>
  );
}
