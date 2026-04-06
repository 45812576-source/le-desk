"use client";

import { memo, useRef, useState, useMemo } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ContentBlock, Message, SkillDetail } from "@/lib/types";
import { MarkdownBlock } from "./blocks/MarkdownBlock";
import { ThinkingBlock } from "./blocks/ThinkingBlock";
import { ToolCallCard } from "./blocks/ToolCallCard";
import { ToolResultCard } from "./blocks/ToolResultCard";
import { FileRefCard } from "./blocks/FileRefCard";
import { KnowledgeRefCard } from "./blocks/KnowledgeRefCard";

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

interface MessageBubbleProps {
  message: Message;
  onQuote?: (text: string) => void;
  onQuickReply?: (text: string) => void;
}

function stripToolCallBlocks(content: string): string {
  return content.replace(/```tool_call[\s\S]*?```/g, "").trim();
}

function parseQuickReplies(content: string): string[] {
  const lines = content.split("\n");
  const pattern = /^\s*(?:\d+[.)]\s*|[A-Za-z][.)]\s*|[-•·]\s+)(.+)$/;
  const options: string[] = [];
  for (const line of lines) {
    const m = line.match(pattern);
    if (m) options.push(m[1].trim());
  }
  return options.length >= 2 && options.length <= 6 ? options : [];
}

function renderContentBlocks(blocks: ContentBlock[]) {
  return blocks.filter((b): b is ContentBlock => b != null).map((block, i) => {
    switch (block.type) {
      case "text":
        return <MarkdownBlock key={i} text={block.text} />;
      case "thinking":
        return <ThinkingBlock key={i} text={block.text} />;
      case "tool_call":
        return <ToolCallCard key={i} block={block} />;
      case "tool_result":
        return <ToolResultCard key={i} block={block} />;
      case "file_ref":
        return <FileRefCard key={i} block={block} />;
      case "knowledge_ref":
        return <KnowledgeRefCard key={i} block={block} />;
    }
  });
}

function QuickReplies({ content, onQuickReply }: { content: string; onQuickReply: (text: string) => void }) {
  const options = useMemo(() => parseQuickReplies(content), [content]);
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {options.map((opt, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onQuickReply(opt)}
          className="text-[9px] font-bold border-2 border-[#1A202C] bg-white px-2.5 py-1 hover:bg-[#CCF2FF] hover:border-[#00A3C4] transition-colors text-left leading-snug max-w-[280px] truncate"
          title={opt}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export const MessageBubble = memo(function MessageBubble({ message, onQuote, onQuickReply }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [hovered, setHovered] = useState(false);
  const skillName = message.metadata?.skill_name as string | null | undefined;
  const skillId = message.metadata?.skill_id as number | null | undefined;
  const isFileUpload = message.metadata?.file_upload as boolean | undefined;
  const downloadUrl = message.metadata?.download_url as string | undefined;
  const downloadFilename = message.metadata?.download_filename as string | undefined;

  const [panelOpen, setPanelOpen] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<"like" | "comment" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 选中文字引用
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const bubbleRef = useRef<HTMLDivElement>(null);

  function handleMouseUp() {
    if (!onQuote) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setSelectionPos(null); return; }
    const text = sel.toString().trim();
    if (!text) { setSelectionPos(null); return; }
    // 确认选区在本气泡内
    const range = sel.getRangeAt(0);
    if (!bubbleRef.current?.contains(range.commonAncestorContainer)) { setSelectionPos(null); return; }
    const rect = range.getBoundingClientRect();
    const bubbleRect = bubbleRef.current!.getBoundingClientRect();
    setSelectedText(text);
    setSelectionPos({ x: rect.left - bubbleRect.left + rect.width / 2, y: rect.top - bubbleRect.top - 6 });
  }

  function handleSelectionQuote() {
    onQuote?.(selectedText);
    setSelectionPos(null);
    window.getSelection()?.removeAllRanges();
  }

  async function react(type: "like" | "comment") {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      await apiFetch(`/messages/${message.id}/react`, {
        method: "POST",
        body: JSON.stringify({
          reaction_type: type,
          ...(type === "comment" ? { comment: commentText.trim() } : {}),
        }),
      });
      setSubmitted(type);
      setPanelOpen(false);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  const { user } = useAuth();
  const showSkillTag = !isUser && (skillName || skillId);

  // ── 存为 Skill ───────────────────────────────────────────────────────────────
  // ── 用户评分 ─────────────────────────────────────────────────────────────
  const [userRating, setUserRating] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  async function handleRate(rating: number) {
    if (ratingSubmitting || userRating !== null) return;
    setRatingSubmitting(true);
    try {
      const convId = message.metadata?.conversation_id ?? (message as unknown as Record<string, unknown>).conversation_id;
      // 使用消息的 conversation_id 从 URL 推导
      const pathMatch = window.location.pathname.match(/\/chat\/(\d+)/);
      const cid = convId ?? (pathMatch ? Number(pathMatch[1]) : null);
      if (!cid) return;
      await apiFetch(`/conversations/${cid}/messages/${message.id}/rating`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      });
      setUserRating(rating);
    } catch {
      // ignore
    } finally {
      setRatingSubmitting(false);
    }
  }

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function handleSaveAsSkill() {
    if (!saveName.trim() || saving) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await apiFetch("/skills", {
        method: "POST",
        body: JSON.stringify({
          name: saveName.trim(),
          description: saveDesc.trim(),
          system_prompt: message.content,
          mode: "hybrid",
          variables: [],
          auto_inject: true,
        }),
      });
      setSaveMsg("已保存到「我的 Skill」");
      setSaveName("");
      setSaveDesc("");
      setTimeout(() => { setSaveOpen(false); setSaveMsg(null); }, 1500);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setSaveMsg(msg || "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  // ── 更新 Skill ──────────────────────────────────────────────────────────────
  const [updating, setUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  async function handleUpdateSkill() {
    if (!skillId || updating) return;
    setUpdating(true);
    setUpdateMsg(null);
    try {
      const skill = await apiFetch<SkillDetail>(`/skills/${skillId}`);
      if (skill.created_by !== user?.id) {
        setUpdateMsg("无权限：只有创建者可以更新此 Skill");
        return;
      }
      await apiFetch(`/skills/${skillId}/versions`, {
        method: "POST",
        body: JSON.stringify({ system_prompt: message.content, change_note: "来自 Chat 更新" }),
      });
      setUpdateMsg("已保存新版本");
      setTimeout(() => setUpdateMsg(null), 2000);
    } catch {
      setUpdateMsg("更新失败，请重试");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setSelectionPos(null); }}
    >
      <div className="max-w-[75%] relative">
        {/* 悬停操作按钮区 (assistant only) */}
        {!isUser && hovered && (
          <div className="absolute -top-3 right-0 z-10 flex gap-1">
            {onQuote && (
              <button
                onClick={() => onQuote(message.content)}
                className="text-[8px] font-bold uppercase tracking-widest border border-[#1A202C] bg-white px-1.5 py-0.5 hover:bg-[#CCF2FF] transition-colors"
              >
                引用
              </button>
            )}
            <button
              onClick={() => { setSaveOpen((v) => !v); setUpdateMsg(null); }}
              className="text-[8px] font-bold uppercase tracking-widest border border-[#1A202C] bg-white px-1.5 py-0.5 hover:bg-[#CCF2FF] transition-colors"
            >
              存为 Skill
            </button>
            {skillId && (
              <button
                onClick={handleUpdateSkill}
                disabled={updating}
                className="text-[8px] font-bold uppercase tracking-widest border border-[#1A202C] bg-white px-1.5 py-0.5 hover:bg-[#CCF2FF] transition-colors disabled:opacity-50"
              >
                {updating ? "更新中..." : "更新 Skill"}
              </button>
            )}
          </div>
        )}
        {/* 引用按钮 — user 气泡专用 */}
        {isUser && onQuote && hovered && (
          <button
            onClick={() => onQuote(message.content)}
            className="absolute -top-3 left-0 z-10 text-[8px] font-bold uppercase tracking-widest border border-[#1A202C] bg-white px-1.5 py-0.5 hover:bg-[#CCF2FF] transition-colors"
          >
            引用
          </button>
        )}
        <div
          ref={bubbleRef}
          className={`px-4 py-3 relative ${
            isUser
              ? "bg-[#1A202C] text-white border-2 border-[#1A202C]"
              : "bg-white border-2 border-[#1A202C] text-[#1A202C]"
          }`}
          onMouseUp={handleMouseUp}
        >
          {/* 选中文字引用浮动按钮 */}
          {selectionPos && (
            <button
              onMouseDown={(e) => { e.preventDefault(); handleSelectionQuote(); }}
              style={{ left: selectionPos.x, top: selectionPos.y, transform: "translate(-50%, -100%)" }}
              className="absolute z-20 text-[8px] font-bold uppercase tracking-widest border border-[#1A202C] bg-white text-[#1A202C] px-1.5 py-0.5 hover:bg-[#CCF2FF] whitespace-nowrap shadow-sm"
            >
              引用选中
            </button>
          )}
          {message.content_blocks?.length
            ? renderContentBlocks(message.content_blocks)
            : (
              <div className="text-xs whitespace-pre-wrap break-words leading-relaxed select-text">
                {stripToolCallBlocks(message.content)}
              </div>
            )
          }

          <div className={`mt-2 flex items-center gap-2 flex-wrap ${isUser ? "justify-end" : "justify-start"}`}>
            {/* Skill 标注 — 可点击打开面板 */}
            {showSkillTag && (
              <button
                onClick={() => !submitted && setPanelOpen((p) => !p)}
                className={`text-[8px] font-bold uppercase tracking-widest flex items-center gap-1 transition-colors ${
                  submitted
                    ? "text-gray-300 cursor-default"
                    : "text-[#00A3C4] hover:text-[#00D1FF] cursor-pointer"
                }`}
              >
                <span className="w-1 h-1 bg-[#00D1FF] inline-block" />
                via {skillName ?? `Skill #${skillId}`}
                {submitted === "like" && " · 👍"}
                {submitted === "comment" && " · 已提交"}
              </button>
            )}
            {/* 文件上传标注 */}
            {!isUser && isFileUpload && (
              <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">
                📎 FOE摘要
              </span>
            )}
            {/* 下载按钮 */}
            {!isUser && !!downloadUrl && (
              <a
                href={`/api/proxy${downloadUrl}`}
                download={downloadFilename}
                className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 bg-[#00D1FF] text-[#1A202C] border-2 border-[#1A202C] hover:bg-[#00A3C4] transition-colors"
              >
                ⬇ 下载文件
              </a>
            )}
            {/* 时间 */}
            <span className={`text-[8px] font-bold uppercase tracking-widest ${isUser ? "text-gray-400" : "text-gray-300"}`}>
              {formatTime(message.created_at)}
            </span>
            {/* 用户评分 */}
            {!isUser && skillId && (
              <span className="flex items-center gap-0.5 ml-1">
                {userRating !== null ? (
                  <span className="text-[8px] font-bold text-[#00A3C4]">
                    {userRating >= 4 ? "👍" : "👎"} 已评
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleRate(5)}
                      disabled={ratingSubmitting}
                      className="text-[9px] opacity-40 hover:opacity-100 transition-opacity disabled:opacity-20"
                      title="好"
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleRate(1)}
                      disabled={ratingSubmitting}
                      className="text-[9px] opacity-40 hover:opacity-100 transition-opacity disabled:opacity-20"
                      title="差"
                    >
                      👎
                    </button>
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* 快捷回复 chips */}
        {!isUser && onQuickReply && <QuickReplies content={message.content} onQuickReply={onQuickReply} />}

        {/* 更新 Skill 状态提示 */}
        {updateMsg && (
          <div className="border-2 border-t-0 border-[#1A202C] bg-[#F0F4F8] px-4 py-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">{updateMsg}</span>
          </div>
        )}

        {/* 存为 Skill 表单 */}
        {saveOpen && (
          <div className="border-2 border-t-0 border-[#1A202C] bg-[#F8FAFC] px-4 py-3">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
              存为新 Skill
            </div>
            <input
              type="text"
              placeholder="Skill 名称"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full border-2 border-[#1A202C] px-2 py-1 text-xs font-bold mb-2 focus:outline-none focus:border-[#00D1FF]"
            />
            <input
              type="text"
              placeholder="描述（可选）"
              value={saveDesc}
              onChange={(e) => setSaveDesc(e.target.value)}
              className="w-full border-2 border-[#1A202C] px-2 py-1 text-xs font-bold mb-3 focus:outline-none focus:border-[#00D1FF]"
            />
            {saveMsg ? (
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">{saveMsg}</span>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveAsSkill}
                  disabled={saving || !saveName.trim()}
                  className="text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] px-3 py-1 bg-[#00D1FF] text-[#1A202C] hover:bg-[#00A3C4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "保存中..." : "确认保存"}
                </button>
                <button
                  onClick={() => { setSaveOpen(false); setSaveName(""); setSaveDesc(""); }}
                  className="text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] px-3 py-1 bg-white hover:bg-[#F0F4F8] transition-colors"
                >
                  取消
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reaction panel — 紧贴气泡底部展开 */}
        {panelOpen && !submitted && (
          <div className="border-2 border-t-0 border-[#1A202C] bg-[#F8FAFC] px-4 py-3">
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              纳入改动建议
            </div>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => react("like")}
                disabled={submitting}
                className="text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] px-3 py-1 bg-white hover:bg-[#CCF2FF] transition-colors disabled:opacity-50"
              >
                👍 有用
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="描述问题或改进方向..."
                rows={2}
                className="w-full border-2 border-[#1A202C] px-2 py-1 text-[10px] font-mono bg-white resize-none focus:outline-none focus:border-[#00A3C4]"
              />
              <button
                onClick={() => react("comment")}
                disabled={submitting || !commentText.trim()}
                className="self-end text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] px-3 py-1 bg-[#00D1FF] text-[#1A202C] hover:bg-[#00A3C4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "提交中..." : "💬 提交评论"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
