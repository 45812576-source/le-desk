"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Send, MapPin } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";

export interface Comment {
  id: number;
  block_key: string | null;
  anchor_from: number | null;
  anchor_to: number | null;
  content: string;
  status: string;
  created_by: number;
  created_by_name: string;
  resolved_by: number | null;
  resolved_by_name: string | null;
  created_at: string | null;
  resolved_at: string | null;
}

interface CommentListProps {
  knowledgeId: number;
  currentUserId: number;
  onToast?: (msg: string) => void;
  /** 点击评论锚点时，跳转到对应 block */
  onScrollToBlock?: (blockKey: string) => void;
}

export default function CommentList({
  knowledgeId,
  currentUserId,
  onToast,
  onScrollToBlock,
}: CommentListProps) {
  const toast = (msg: string) => onToast?.(msg);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await apiFetch<Comment[]>(`/knowledge/${knowledgeId}/comments`);
      setComments(res);
    } catch (e: unknown) {
      const msg = e instanceof ApiError
        ? (e.status === 404 ? "文档不存在" : e.status >= 500 ? "服务器错误，请稍后重试" : e.message)
        : "网络错误，请检查连接";
      setLoadError(msg);
      toast(msg);
    }
  }, [knowledgeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadComments(); }, [loadComments]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/knowledge/${knowledgeId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: newComment.trim() }),
      });
      setNewComment("");
      loadComments();
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        toast(e.status === 403 ? "无权评论此文档" : e.status === 422 ? "评论内容无效" : e.message);
      } else {
        toast("网络错误，发送失败");
      }
    }
    setSending(false);
  };

  const handleResolve = async (commentId: number) => {
    setResolvingId(commentId);
    try {
      await apiFetch(`/knowledge/${knowledgeId}/comments/${commentId}/resolve`, {
        method: "POST",
      });
      loadComments();
    } catch (e: unknown) {
      if (e instanceof ApiError) {
        toast(e.status === 403 ? "无权解决此评论" : e.status === 404 ? "评论不存在" : e.message);
      } else {
        toast("网络错误，操作失败");
      }
    }
    setResolvingId(null);
  };

  /** 当前用户可否 resolve 此评论：评论创建者或当前用户都可以 */
  const canResolve = (c: Comment) => c.created_by === currentUserId;

  const openComments = comments.filter((c) => c.status === "open");
  const resolvedComments = comments.filter((c) => c.status === "resolved");

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2">
        <p className="text-[11px] text-red-400">{loadError}</p>
        <button onClick={loadComments} className="text-[10px] text-[#00A3C4] hover:underline">
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {openComments.length === 0 && resolvedComments.length === 0 && (
          <p className="text-[11px] text-gray-400 text-center py-8">暂无评论</p>
        )}

        {openComments.map((c) => (
          <div key={c.id} className="bg-[#FFFBEB] border border-amber-200 rounded-lg p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* 块锚点标识 */}
                {c.block_key && (
                  <button
                    onClick={() => onScrollToBlock?.(c.block_key!)}
                    className="inline-flex items-center gap-0.5 text-[9px] text-[#00A3C4] bg-[#E0F7FF] px-1.5 py-0.5 rounded mb-1 hover:bg-[#B8ECFF] transition-colors"
                    title={`定位到 ${c.block_key}${c.anchor_from != null ? ` (字符 ${c.anchor_from}-${c.anchor_to})` : ""}`}
                  >
                    <MapPin size={9} />
                    <span className="truncate max-w-[120px]">{c.block_key}</span>
                  </button>
                )}
                <p className="text-[12px] text-gray-700 leading-relaxed">{c.content}</p>
              </div>
              {canResolve(c) && (
                <button
                  onClick={() => handleResolve(c.id)}
                  disabled={resolvingId === c.id}
                  className="flex-shrink-0 p-1 rounded hover:bg-green-100 text-green-500 transition-colors disabled:opacity-40"
                  title="标记为已解决"
                >
                  <Check size={14} />
                </button>
              )}
            </div>
            <div className="text-[9px] text-gray-400 mt-1.5">
              {c.created_by_name} · {c.created_at ? new Date(c.created_at).toLocaleString("zh-CN") : ""}
            </div>
          </div>
        ))}

        {resolvedComments.length > 0 && (
          <>
            <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider pt-2">
              已解决
            </div>
            {resolvedComments.map((c) => (
              <div key={c.id} className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 opacity-60">
                {c.block_key && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded mb-1">
                    <MapPin size={9} />
                    <span className="truncate max-w-[120px]">{c.block_key}</span>
                  </span>
                )}
                <p className="text-[12px] text-gray-500 line-through">{c.content}</p>
                <div className="text-[9px] text-gray-400 mt-1">
                  {c.resolved_by_name ? `${c.resolved_by_name} 解决于` : "解决于"}{" "}
                  {c.resolved_at ? new Date(c.resolved_at).toLocaleString("zh-CN") : ""}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* New comment input */}
      <div className="p-3 border-t border-gray-100 flex-shrink-0">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAddComment();
              }
            }}
            placeholder="添加评论..."
            className="flex-1 text-[11px] border border-gray-200 px-2.5 py-1.5 rounded focus:outline-none focus:border-[#00D1FF]"
          />
          <button
            onClick={handleAddComment}
            disabled={sending || !newComment.trim()}
            className="px-2.5 py-1.5 bg-[#00D1FF] text-white rounded hover:bg-[#00A3C4] transition-colors disabled:opacity-40"
          >
            <Send size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
