"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch, getToken } from "@/lib/api";
import type { SkillDetail, SkillVersion } from "@/lib/types";

const STATUS_COLOR: Record<string, "cyan" | "green" | "yellow" | "red" | "gray"> = {
  draft: "gray",
  published: "green",
  archived: "red",
};

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

interface Suggestion {
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

interface UploadResult {
  filename: string;
  action?: string;
  id?: number;
  name?: string;
  version?: number;
  error?: string;
}

// ─── Diff viewer ─────────────────────────────────────────────────────────────

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

// ─── Comments panel ───────────────────────────────────────────────────────────

function CommentsPanel({ skillId, onIterateDone }: { skillId: number; onIterateDone: () => void }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [iterating, setIterating] = useState(false);
  const [diffPreview, setDiffPreview] = useState<DiffPreview | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  // 部分采纳选文模式：当前正在选文的 suggestion id
  const [selectingId, setSelectingId] = useState<number | null>(null);
  // 选中的文字片段 { id, text, rect }
  const [selectionPopup, setSelectionPopup] = useState<{ id: number; text: string; top: number; left: number } | null>(null);
  const selectionContainerRef = useRef<HTMLDivElement | null>(null);

  const fetchSuggestions = useCallback(() => {
    setLoading(true);
    apiFetch<Suggestion[]>(`/skills/${skillId}/comments`)
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [skillId]);

  useEffect(() => {
    fetchSuggestions();
    setSelected(new Set());
    setDiffPreview(null);
    setError("");
    setSelectingId(null);
    setSelectionPopup(null);
  }, [fetchSuggestions]);

  // Auto-select adopted suggestions
  useEffect(() => {
    const adoptedIds = suggestions
      .filter((s) => s.status === "adopted" || s.status === "partial")
      .map((s) => s.id);
    setSelected(new Set(adoptedIds));
  }, [suggestions]);

  // 点击其他地方时关闭选文弹出
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

        {/* Change note */}
        <div className="border border-[#805AD5] bg-[#FAF5FF] px-3 py-2">
          <div className="text-[9px] font-bold uppercase text-[#805AD5] mb-1">修改说明</div>
          <div className="text-[10px] text-[#1A202C]">{diffPreview.change_note}</div>
        </div>

        {/* Diffs */}
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
        <button
          onClick={handleIterate}
          disabled={iterating || selected.size === 0}
          className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#805AD5] text-[#805AD5] hover:bg-[#FAF5FF] disabled:opacity-40 transition-colors"
        >
          {iterating ? "AI 生成中..." : `✦ AI 迭代 (${selected.size})`}
        </button>
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
                  {/* Checkbox */}
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

                    {/* 正文（选文模式下可选中） */}
                    <div
                      className={`text-[10px] font-bold text-[#1A202C] mb-1 leading-snug ${
                        isInSelectMode ? "select-text cursor-text bg-yellow-50 px-1 rounded" : "select-none"
                      }`}
                      onMouseUp={() => handleTextMouseUp(s.id)}
                    >
                      {s.problem_desc}
                    </div>
                    {s.expected_direction && s.expected_direction !== "来自对话消息的用户评论" && (
                      <div
                        className={`text-[9px] text-gray-600 mb-1 ${isInSelectMode ? "select-text cursor-text" : "select-none"}`}
                        onMouseUp={() => handleTextMouseUp(s.id)}
                      >
                        期望：{s.expected_direction}
                      </div>
                    )}
                    {s.case_example && (
                      <div
                        className={`text-[9px] text-gray-500 bg-gray-50 px-2 py-1 border-l-2 border-gray-300 ${isInSelectMode ? "select-text cursor-text" : "select-none"}`}
                        onMouseUp={() => handleTextMouseUp(s.id)}
                      >
                        示例：{s.case_example}
                      </div>
                    )}

                    {/* 已部分采纳：显示选中片段 */}
                    {s.status === "partial" && s.review_note && (
                      <div className="text-[9px] text-[#ED8936] bg-orange-50 px-2 py-1 border-l-2 border-[#ED8936] mt-1">
                        已采纳片段：「{s.review_note}」
                      </div>
                    )}

                    {/* 选文模式提示 */}
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

                    {/* Review actions for pending */}
                    {s.status === "pending" && !isInSelectMode && (
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => reviewSuggestion(s.id, "adopted")}
                          disabled={reviewing === s.id}
                          className="px-2 py-1 text-[9px] font-bold border border-[#00CC99] text-[#00CC99] hover:bg-[#F0FFF4] disabled:opacity-50 transition-colors"
                        >
                          采纳
                        </button>
                        <button
                          onClick={() => { setSelectingId(s.id); setSelectionPopup(null); }}
                          disabled={reviewing === s.id}
                          className="px-2 py-1 text-[9px] font-bold border border-[#ED8936] text-[#ED8936] hover:bg-[#FFFAF0] disabled:opacity-50 transition-colors"
                        >
                          部分采纳…
                        </button>
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [activeTab, setActiveTab] = useState<"versions" | "comments" | "usage">("versions");
  const [usageData, setUsageData] = useState<{
    skill_name: string;
    total_conv_count: number;
    total_user_count: number;
    by_user: { user_id: number; display_name: string; conv_count: number; msg_count: number }[];
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSkills = useCallback(() => {
    setLoading(true);
    apiFetch<SkillDetail[]>("/skills")
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  async function loadDetail(id: number) {
    setDetailLoading(true);
    setActiveTab("versions");
    setUsageData(null);
    try {
      const data = await apiFetch<SkillDetail & { versions: SkillVersion[] }>(`/skills/${id}`);
      setSelected(data);
      setVersions(data.versions || []);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleStatusChange(id: number, status: string) {
    try {
      await apiFetch(`/skills/${id}/status?status=${status}`, { method: "PATCH" });
      fetchSkills();
      if (selected?.id === id) {
        setSelected((prev) => (prev ? { ...prev, status } : null));
      }
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除该 Skill？")) return;
    try {
      await apiFetch(`/skills/${id}`, { method: "DELETE" });
      fetchSkills();
      if (selected?.id === id) setSelected(null);
    } catch {
      // ignore
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadResults(null);

    const formData = new FormData();
    const isBatch = files.length > 1;

    if (isBatch) {
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
    } else {
      formData.append("file", files[0]);
    }

    try {
      const token = getToken();
      const endpoint = isBatch ? "/skills/batch-upload-md" : "/skills/upload-md";
      const res = await fetch(`/api/proxy${endpoint}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setUploadResults([{ filename: files[0]?.name || "unknown", error: data.detail || "上传失败" }]);
        return;
      }

      if (isBatch) {
        setUploadResults(data.results);
      } else {
        setUploadResults([{
          filename: files[0].name,
          action: data.action,
          id: data.id,
          name: data.name,
          version: data.version,
        }]);
      }
      fetchSkills();
    } catch {
      setUploadResults([{ filename: "unknown", error: "网络错误" }]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function loadUsage(id: number) {
    setUsageLoading(true);
    try {
      const data = await apiFetch<typeof usageData>(`/skills/${id}/usage`);
      setUsageData(data);
    } catch {
      setUsageData(null);
    } finally {
      setUsageLoading(false);
    }
  }

  // After apply iterate, reload detail to show new version
  function handleIterateDone() {
    if (selected) {
      loadDetail(selected.id);
      fetchSkills();
      setActiveTab("versions");
    }
  }

  return (
    <PageShell
      title="Skill 管理"
      icon={ICONS.skillsAdmin}
      actions={
        <div className="flex gap-2">
          <PixelButton
            variant="primary"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "上传中..." : "上传 .md"}
          </PixelButton>
          <input
            ref={fileRef}
            type="file"
            accept=".md"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      }
    >
      <div className="flex flex-col h-full gap-0">
        {/* Upload results banner */}
        {uploadResults && (
          <div className="mb-4 flex-shrink-0 border-2 border-[#1A202C] bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
                上传结果
              </span>
              <button
                onClick={() => setUploadResults(null)}
                className="text-[9px] font-bold text-gray-400 hover:text-[#1A202C]"
              >
                x 关闭
              </button>
            </div>
            <div className="space-y-1">
              {uploadResults.map((r, i) => (
                <div key={i} className="text-[10px] font-bold flex items-center gap-2">
                  <span className="text-gray-500 truncate max-w-[200px]">{r.filename}</span>
                  {r.error ? (
                    <span className="text-red-500">{r.error}</span>
                  ) : (
                    <span className="text-green-600">
                      {r.action === "created" ? "新建" : "更新"} [{r.name}] v{r.version}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6 flex-1 min-h-0">
          {/* Left: list */}
          <div className="w-80 flex-shrink-0 space-y-2 overflow-y-auto">
            {loading ? (
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
                Loading...
              </div>
            ) : skills.length === 0 ? (
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
                暂无 Skill
              </div>
            ) : (
              skills.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadDetail(s.id)}
                  className={`w-full text-left border-2 p-3 transition-colors ${
                    selected?.id === s.id
                      ? "border-[#00D1FF] bg-[#CCF2FF]"
                      : "border-[#1A202C] bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold truncate">{s.name}</span>
                    <PixelBadge color={STATUS_COLOR[s.status] || "gray"}>{s.status}</PixelBadge>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">{s.description || "无描述"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] text-gray-400">v{s.current_version}</span>
                    <span className="text-[8px] text-gray-400">{s.mode}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-y-auto">
            {!selected ? (
              <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-gray-400">
                选择一个 Skill 查看详情
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
                Loading...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-white border-2 border-[#1A202C] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold">{selected.name}</h2>
                    <div className="flex gap-1">
                      {selected.status !== "published" && (
                        <PixelButton
                          size="sm"
                          onClick={() => handleStatusChange(selected.id, "published")}
                        >
                          发布
                        </PixelButton>
                      )}
                      {selected.status === "published" && (
                        <PixelButton
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusChange(selected.id, "archived")}
                        >
                          归档
                        </PixelButton>
                      )}
                      <PixelButton
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(selected.id)}
                      >
                        删除
                      </PixelButton>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-600 mb-3">{selected.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <PixelBadge color={STATUS_COLOR[selected.status] || "gray"}>
                      {selected.status}
                    </PixelBadge>
                    <PixelBadge color="cyan">{selected.mode}</PixelBadge>
                    <PixelBadge color="purple">v{selected.current_version}</PixelBadge>
                    {selected.auto_inject && <PixelBadge color="green">自动注入</PixelBadge>}
                  </div>
                  {selected.knowledge_tags && selected.knowledge_tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selected.knowledge_tags.map((t) => (
                        <span key={t} className="text-[8px] text-[#00A3C4] font-bold uppercase">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex border-b-2 border-[#1A202C]">
                  {(["versions", "comments", "usage"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === "usage" && selected && !usageData && !usageLoading) {
                          loadUsage(selected.id);
                        }
                      }}
                      className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wide border-r-2 border-[#1A202C] transition-colors ${
                        activeTab === tab
                          ? "bg-[#1A202C] text-white"
                          : "bg-white text-[#1A202C] hover:bg-[#CCF2FF]"
                      }`}
                    >
                      {tab === "versions" ? "版本历史" : tab === "comments" ? "用户意见" : "使用统计"}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="bg-white border-2 border-[#1A202C] p-4">
                  {activeTab === "usage" ? (
                    usageLoading ? (
                      <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-8 animate-pulse">加载中...</div>
                    ) : !usageData ? (
                      <div className="text-[10px] text-gray-400 text-center py-8">暂无使用数据</div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {/* 汇总 */}
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: "总对话数", value: usageData.total_conv_count },
                            { label: "活跃用户数", value: usageData.total_user_count },
                            { label: "人均对话", value: usageData.total_user_count ? (usageData.total_conv_count / usageData.total_user_count).toFixed(1) : "—" },
                          ].map(({ label, value }) => (
                            <div key={label} className="border-2 border-[#1A202C] p-3 text-center">
                              <div className="text-[20px] font-bold text-[#1A202C]">{value}</div>
                              <div className="text-[8px] font-bold uppercase text-gray-400 mt-0.5">{label}</div>
                            </div>
                          ))}
                        </div>
                        {/* 按用户明细 */}
                        {usageData.by_user.length === 0 ? (
                          <div className="text-[10px] text-gray-400 text-center py-4">暂无用户使用记录</div>
                        ) : (
                          <table className="w-full border border-[#E2E8F0] text-[10px]">
                            <thead>
                              <tr className="bg-[#F0F4F8]">
                                <th className="text-left px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">#</th>
                                <th className="text-left px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">用户</th>
                                <th className="text-right px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">对话数</th>
                                <th className="text-right px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">消息数</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usageData.by_user.map((row, i) => (
                                <tr key={row.user_id} className="border-t border-[#E2E8F0] hover:bg-[#F0F4F8]">
                                  <td className="px-3 py-2 text-gray-400 font-bold">{i + 1}</td>
                                  <td className="px-3 py-2 font-bold text-[#1A202C]">{row.display_name}</td>
                                  <td className="px-3 py-2 text-right font-bold text-[#00A3C4]">{row.conv_count}</td>
                                  <td className="px-3 py-2 text-right text-gray-500">{row.msg_count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )
                  ) : activeTab === "versions" ? (
                    <>
                      {versions.length === 0 ? (
                        <p className="text-[10px] text-gray-400">无版本记录</p>
                      ) : (
                        <div className="space-y-3">
                          {versions.map((v) => (
                            <div key={v.id} className="border border-gray-200 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold">v{v.version}</span>
                                <span className="text-[8px] text-gray-400">
                                  {new Date(v.created_at).toLocaleDateString("zh-CN")}
                                </span>
                              </div>
                              {v.change_note && (
                                <p className="text-[10px] text-gray-600 mb-1">{v.change_note}</p>
                              )}
                              {v.system_prompt && (
                                <pre className="text-[10px] bg-gray-50 border border-gray-200 p-2 max-h-40 overflow-auto whitespace-pre-wrap">
                                  {v.system_prompt}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <CommentsPanel
                      skillId={selected.id}
                      onIterateDone={handleIterateDone}
                    />
                  )}
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
