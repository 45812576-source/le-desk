"use client";

import { useState } from "react";
import { MessageSquare, Clock } from "lucide-react";
import CommentList from "./CommentList";
import SnapshotHistory from "./SnapshotHistory";

interface CommentPanelProps {
  knowledgeId: number;
  currentUserId: number;
  /** 当前用户是否为文档所有者或管理员（控制恢复等写操作） */
  canEdit?: boolean;
  onToast?: (msg: string) => void;
  /** 点击评论锚点时跳转到对应 block */
  onScrollToBlock?: (blockKey: string) => void;
  /** 恢复快照成功后，父组件刷新正文 */
  onRestoreSuccess?: () => void;
}

type PanelTab = "comments" | "history";

export default function CommentPanel({
  knowledgeId,
  currentUserId,
  canEdit = false,
  onToast,
  onScrollToBlock,
  onRestoreSuccess,
}: CommentPanelProps) {
  const [tab, setTab] = useState<PanelTab>("comments");

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white w-[280px]">
      {/* Tab header */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => setTab("comments")}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            tab === "comments"
              ? "text-[#00A3C4] border-b-2 border-[#00D1FF]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <MessageSquare size={12} className="inline mr-1" />
          评论
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${
            tab === "history"
              ? "text-[#00A3C4] border-b-2 border-[#00D1FF]"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Clock size={12} className="inline mr-1" />
          版本历史
        </button>
      </div>

      {tab === "comments" && (
        <CommentList
          knowledgeId={knowledgeId}
          currentUserId={currentUserId}
          onToast={onToast}
          onScrollToBlock={onScrollToBlock}
        />
      )}

      {tab === "history" && (
        <SnapshotHistory
          knowledgeId={knowledgeId}
          canRestore={canEdit}
          onToast={onToast}
          onRestoreSuccess={onRestoreSuccess}
        />
      )}
    </div>
  );
}
