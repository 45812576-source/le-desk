"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Suggestion {
  id: number;
  skill_id: number;
  submitted_by: number;
  submitter_name: string | null;
  problem_desc: string;
  expected_direction: string;
  case_example: string | null;
  status: string;
  review_note: string | null;
  reaction_type: string | null;
  created_at: string;
}

interface DiffPreview {
  skill_id: number;
  skill_name: string;
  current_version: number;
  proposed: Record<string, unknown>;
  diff: Record<string, { old: unknown; new: unknown }>;
  change_note: string;
  suggestion_ids?: number[];
}

const SUGGESTION_STATUS_COLOR: Record<string, string> = {
  pending: "#A0AEC0",
  adopted: "#00CC99",
  partial: "#ED8936",
  rejected: "#E53E3E",
};
const SUGGESTION_STATUS_LABEL: Record<string, string> = {
  pending: "待处理",
  adopted: "已采纳",
  partial: "部分采纳",
  rejected: "已驳回",
};

// ─── DiffBlock ──────────────────────────────────────────────────────────────

function DiffBlock({ label, oldVal, newVal }: { label: string; oldVal: unknown; newVal: unknown }) {
  const fmt = (v: unknown) =>
    typeof v === "string" ? v : JSON.stringify(v, null, 2);
  return (
    <div className="mb-4">
      <div className="text-[9px] font-bold uppercase text-[#805AD5] mb-1">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[8px] font-bold text-red-400 mb-1">旧版本</div>
          <pre className="text-[9px] bg-red-50 border border-red-200 p-2 whitespace-pre-wrap max-h-48 overflow-auto leading-relaxed">
            {fmt(oldVal)}
          </pre>
        </div>
        <div>
          <div className="text-[8px] font-bold text-green-600 mb-1">新版本</div>
          <pre className="text-[9px] bg-green-50 border border-green-200 p-2 whitespace-pre-wrap max-h-48 overflow-auto leading-relaxed">
            {fmt(newVal)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── CommentsPanel ──────────────────────────────────────────────────────────

export interface CommentsPanelProps {
  skillId: number;
  onIterateDone: () => void;
  /** 采纳时的回调（可选）。返回 true 表示由调用方处理，不执行默认 review 逻辑 */
  onAdopt?: (suggestion: Suggestion) => boolean | void;
  /** 是否隐藏 AI 迭代功能（在 SkillStudio 简洁模式下使用） */
  hideIterate?: boolean;
  /** 仅显示指定状态的意见 */
  statusFilter?: string;
}

export function CommentsPanel({ skillId, onIterateDone, onAdopt, hideIterate, statusFilter }: CommentsPanelProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [iterating, setIterating] = useState(false);
  const [diffPreview, setDiffPreview] = useState<DiffPreview | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [selectingId, setSelectingId] = useState<number | null>(null);
  const [selectionPopup, setSelectionPopup] = useState<{ id: number; text: string; top: number; left: number } | null>(null);
  const selectionContainerRef = useRef<HTMLDivElement | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchSuggestions = useCallback(() => {
    setLoading(true);
    const url = statusFilter
      ? `/skills/${skillId}/comments?status=${statusFilter}`
      : `/skills/${skillId}/comments`;
    apiFetch<Suggestion[]>(url)
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [skillId, statusFilter]);

  useEffect(() => {
    fetchSuggestions();
    setSelected(new Set());
    setDiffPreview(null);
    setError("");
    setSelectingId(null);
    setSelectionPopup(null);
  }, [fetchSuggestions]);

  useEffect(() => {
    const adoptedIds = suggestions
      .filter((s) => s.status === "adopted" || s.status === "partial")
      .map((s) => s.id);
    setSelected(new Set(adoptedIds));
  }, [suggestions]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (selectionPopup && !(e.target as Element).closest("[data-selection-popup]")) {
        setSelectionPopup(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [selectionPopup]);

  async function reviewSuggestion(id: number, status: string, reviewNote?: string) {
    setReviewing(id);
    try {
      await apiFetch(`/skill-suggestions/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ status, review_note: reviewNote }),
      });
      fetchSuggestions();
    } catch {
      // ignore
    } finally {
      setReviewing(null);
      setSelectingId(null);
      setSelectionPopup(null);
    }
  }

  function handleAdopt(s: Suggestion) {
    if (onAdopt) {
      const handled = onAdopt(s);
      if (handled) return;
    }
    reviewSuggestion(s.id, "adopted");
  }

  function handleTextMouseUp(suggestionId: number) {
    if (selectingId !== suggestionId) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !sel || sel.rangeCount === 0) {
      setSelectionPopup(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = selectionContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    setSelectionPopup({
      id: suggestionId,
      text,
      top: rect.bottom - containerRect.top + 6,
      left: rect.left - containerRect.left,
    });
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleIterate() {
    if (selected.size === 0) { setError("请选择至少一条 Comment"); return; }
    setError("");
    setIterating(true);
    setDiffPreview(null);
    try {
      const preview = await apiFetch<DiffPreview>(`/skills/${skillId}/iterate`, {
        method: "POST",
        body: JSON.stringify({ suggestion_ids: Array.from(selected) }),
      });
      setDiffPreview(preview);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败，请重试");
    } finally {
      setIterating(false);
    }
  }

  async function handleApply() {
    if (!diffPreview) return;
    setApplying(true);
    setError("");
    try {
      await apiFetch(`/skills/${skillId}/iterate/apply`, {
        method: "POST",
        body: JSON.stringify({
          proposed: diffPreview.proposed,
          change_note: diffPreview.change_note,
          suggestion_ids: diffPreview.suggestion_ids || Array.from(selected),
        }),
      });
      setDiffPreview(null);
      onIterateDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="text-[10px] text-gray-400 font-bold uppercase py-8 text-center animate-pulse">
        加载中...
      </div>
    );
  }

  // ── Diff 预览模式 ──
  if (diffPreview) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-[#1A202C]">AI 迭代方案预览</div>
            <div className="text-[9px] text-gray-500 mt-0.5">
              基于 {diffPreview.suggestion_ids?.length ?? selected.size} 条意见 · 当前 v{diffPreview.current_version} → v{diffPreview.current_version + 1}
            </div>
          </div>
          <button
            onClick={() => setDiffPreview(null)}
            className="text-[9px] font-bold text-gray-400 hover:text-[#1A202C]"
          >
            ← 返回
          </button>
        </div>

        <div className="border border-[#805AD5] bg-[#FAF5FF] px-3 py-2">
          <div className="text-[9px] font-bold uppercase text-[#805AD5] mb-1">修改说明</div>
          <div className="text-[10px] text-[#1A202C]">{diffPreview.change_note}</div>
        </div>

        {Object.keys(diffPreview.diff).length === 0 ? (
          <div className="text-[10px] text-gray-400 text-center py-4">
            LLM 认为无需修改（内容与当前版本相同）
          </div>
        ) : (
          Object.entries(diffPreview.diff).map(([field, { old: oldVal, new: newVal }]) => (
            <DiffBlock key={field} label={field} oldVal={oldVal} newVal={newVal} />
          ))
        )}

        {error && (
          <div className="text-[10px] text-red-500 border border-red-200 px-3 py-2 bg-red-50">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setDiffPreview(null)}
            className="px-4 py-2 text-[10px] font-bold uppercase border-2 border-gray-400 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleApply}
            disabled={applying || Object.keys(diffPreview.diff).length === 0}
            className="flex-1 py-2 text-[10px] font-bold uppercase border-2 border-[#00CC99] bg-[#00CC99] text-white hover:bg-[#00A87A] disabled:opacity-50 transition-colors"
          >
            {applying ? "保存中..." : "✓ 确认保存新版本"}
          </button>
        </div>
      </div>
    );
  }

  // ── Comment 列表模式 ──
  const adoptedIds = suggestions.filter((s) => s.status === "adopted" || s.status === "partial").map((s) => s.id);

  return (
    <div className="flex flex-col gap-3 relative" ref={selectionContainerRef}>
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-bold uppercase text-gray-500">
          {suggestions.length} 条意见 · {adoptedIds.length} 条已采纳
        </div>
        {!hideIterate && (
          <button
            onClick={handleIterate}
            disabled={iterating || selected.size === 0}
            className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#805AD5] text-[#805AD5] hover:bg-[#FAF5FF] disabled:opacity-40 transition-colors"
          >
            {iterating ? "AI 生成中..." : `✦ AI 迭代 (${selected.size})`}
          </button>
        )}
      </div>

      {error && (
        <div className="text-[10px] text-red-500 border border-red-200 px-3 py-2 bg-red-50">
          {error}
        </div>
      )}

      {/* 选文确认气泡 */}
      {selectionPopup && (
        <div
          data-selection-popup
          className="absolute z-50 bg-[#1A202C] text-white px-3 py-2 flex items-center gap-2 shadow-lg"
          style={{ top: selectionPopup.top, left: selectionPopup.left }}
        >
          <span className="text-[9px] max-w-[200px] truncate opacity-70">
            「{selectionPopup.text}」
          </span>
          <button
            onClick={() => reviewSuggestion(selectionPopup.id, "partial", selectionPopup.text)}
            disabled={reviewing === selectionPopup.id}
            className="text-[9px] font-bold px-2 py-0.5 bg-[#ED8936] text-white hover:bg-[#C05621] disabled:opacity-50 transition-colors flex-shrink-0"
          >
            {reviewing === selectionPopup.id ? "保存中..." : "确认部分采纳"}
          </button>
          <button
            onClick={() => { setSelectionPopup(null); setSelectingId(null); window.getSelection()?.removeAllRanges(); }}
            className="text-[9px] opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {suggestions.length === 0 ? (
        <div className="text-[10px] text-gray-400 text-center py-8">暂无用户意见</div>
      ) : (
        <div className="flex flex-col gap-2">
          {suggestions.map((s) => {
            const isSelectable = s.status === "adopted" || s.status === "partial";
            const isSelected = selected.has(s.id);
            const isInSelectMode = selectingId === s.id;
            const isExpanded = expandedIds.has(s.id);
            return (
              <div
                key={s.id}
                className={`border-2 p-3 transition-colors ${
                  isInSelectMode
                    ? "border-[#ED8936] bg-[#FFFAF0]"
                    : isSelected
                    ? "border-[#805AD5] bg-[#FAF5FF]"
                    : "border-[#E2E8F0] bg-white"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!hideIterate && (
                    <button
                      onClick={() => isSelectable && toggleSelect(s.id)}
                      disabled={!isSelectable}
                      className={`mt-0.5 w-4 h-4 border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        isSelectable
                          ? isSelected
                            ? "border-[#805AD5] bg-[#805AD5]"
                            : "border-gray-400 hover:border-[#805AD5]"
                          : "border-gray-200 opacity-40 cursor-not-allowed"
                      }`}
                    >
                      {isSelected && (
                        <span className="text-white text-[8px] font-bold">✓</span>
                      )}
                    </button>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 border flex-shrink-0"
                        style={{
                          color: SUGGESTION_STATUS_COLOR[s.status],
                          borderColor: SUGGESTION_STATUS_COLOR[s.status],
                        }}
                      >
                        {SUGGESTION_STATUS_LABEL[s.status]}
                      </span>
                      {s.reaction_type && (
                        <span className="text-[8px] text-gray-400 uppercase">{s.reaction_type}</span>
                      )}
                      <span className="text-[8px] text-gray-400 ml-auto">
                        {s.submitter_name} · {s.created_at?.slice(0, 10)}
                      </span>
                    </div>

                    <div
                      className={`text-[10px] font-bold text-[#1A202C] mb-1 leading-snug ${
                        isInSelectMode ? "select-text cursor-text bg-yellow-50 px-1 rounded whitespace-pre-wrap break-words" : "select-none whitespace-pre-wrap break-words"
                      }`}
                      onMouseUp={() => handleTextMouseUp(s.id)}
                    >
                      {s.problem_desc}
                    </div>
                    {s.expected_direction && s.expected_direction !== "来自对话消息的用户评论" && (
                      <div
                        className={`text-[9px] text-gray-600 mb-1 whitespace-pre-wrap break-words ${isInSelectMode ? "select-text cursor-text" : "select-none"}`}
                        onMouseUp={() => handleTextMouseUp(s.id)}
                      >
                        期望：{s.expected_direction}
                      </div>
                    )}
                    {(s.case_example || s.review_note) && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(s.id)}
                        className="mb-1 text-[8px] font-bold uppercase tracking-widest text-[#805AD5] hover:text-[#6B46C1]"
                      >
                        {isExpanded ? "收起完整解释" : "查看完整解释"}
                      </button>
                    )}
                    {isExpanded && s.case_example && (
                      <div
                        className={`text-[9px] text-gray-500 bg-gray-50 px-2 py-1 border-l-2 border-gray-300 whitespace-pre-wrap break-words ${isInSelectMode ? "select-text cursor-text" : "select-none"}`}
                        onMouseUp={() => handleTextMouseUp(s.id)}
                      >
                        示例：{s.case_example}
                      </div>
                    )}

                    {isExpanded && s.review_note && s.status !== "partial" && (
                      <div className="text-[9px] text-gray-600 bg-[#FAF5FF] px-2 py-1 border-l-2 border-[#805AD5] mt-1 whitespace-pre-wrap break-words">
                        处理说明：{s.review_note}
                      </div>
                    )}

                    {s.status === "partial" && s.review_note && (
                      <div className="text-[9px] text-[#ED8936] bg-orange-50 px-2 py-1 border-l-2 border-[#ED8936] mt-1 whitespace-pre-wrap break-words">
                        已采纳片段：「{s.review_note}」
                      </div>
                    )}

                    {isInSelectMode && (
                      <div className="text-[8px] text-[#ED8936] font-bold mt-1 flex items-center gap-2">
                        ↑ 拖选上方文字后确认
                        <button
                          onClick={() => { setSelectingId(null); setSelectionPopup(null); window.getSelection()?.removeAllRanges(); }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          取消
                        </button>
                      </div>
                    )}

                    {s.status === "pending" && !isInSelectMode && (
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => handleAdopt(s)}
                          disabled={reviewing === s.id}
                          className="px-2 py-1 text-[9px] font-bold border border-[#00CC99] text-[#00CC99] hover:bg-[#F0FFF4] disabled:opacity-50 transition-colors"
                        >
                          采纳
                        </button>
                        {!hideIterate && (
                          <button
                            onClick={() => { setSelectingId(s.id); setSelectionPopup(null); }}
                            disabled={reviewing === s.id}
                            className="px-2 py-1 text-[9px] font-bold border border-[#ED8936] text-[#ED8936] hover:bg-[#FFFAF0] disabled:opacity-50 transition-colors"
                          >
                            部分采纳…
                          </button>
                        )}
                        <button
                          onClick={() => reviewSuggestion(s.id, "rejected")}
                          disabled={reviewing === s.id}
                          className="px-2 py-1 text-[9px] font-bold border border-[#E53E3E] text-[#E53E3E] hover:bg-[#FFF5F5] disabled:opacity-50 transition-colors"
                        >
                          驳回
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
