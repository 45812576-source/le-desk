"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useChatStore, subscribeConvStream, getConvStreamSnapshot } from "@/lib/chat-store";
import { connectionManager } from "@/lib/connection";
import type { ConnectionState } from "@/lib/connection";
import type { ContentBlock } from "@/lib/types";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { DevStudio } from "@/components/chat/DevStudio";
import { SkillStudio } from "@/components/chat/SkillStudio";
import { useTheme } from "@/lib/theme";

// Module-level workspace cache — survives route navigation
type WorkspaceData = { workspace_type?: string; welcome_message?: string; skills: { id: number; name: string; description?: string }[]; tools: { id: number; name: string; display_name: string; description?: string; tool_type?: string }[] };
const _wsCache = new Map<number, WorkspaceData>();

const STAGE_LABELS: Record<string, string> = {
  matching_skill: "识别意图...",
  checking_context: "检索知识 & 校验输入...",
  compiling_prompt: "组装提示词...",
  preparing: "匹配 Skill & 组装上下文...",
  generating: "生成中...",
  tool_calling: "调用工具中...",
  uploading: "上传文件中...",
  parsing: "解析文件内容...",
  summarizing: "生成 FOE 结构化摘要...",
  pev_start: "分析任务复杂度...",
  replanning: "重新规划中...",
};

function _parsePevStage(stage: string | null): string {
  if (!stage) return "思考中...";
  if (stage.startsWith("executing:")) return `执行：${stage.slice(10)}`;
  if (stage.startsWith("retrying:")) return `重试：${stage.slice(9)}`;
  return STAGE_LABELS[stage] || "思考中...";
}

const FILE_STAGES: { minSec: number; label: string }[] = [
  { minSec: 0,  label: "解析文件中..." },
  { minSec: 4,  label: "提取文本内容..." },
  { minSec: 10, label: "生成 FOE 结构化摘要..." },
  { minSec: 30, label: "校验 Input 是否充分..." },
  { minSec: 50, label: "调用 Skill 生成回复..." },
];

const ALLOWED_EXTS = [".txt", ".pdf", ".docx", ".pptx", ".md", ".xlsx", ".xls", ".csv",
  ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".mp3", ".wav", ".m4a", ".ogg", ".flac"];
const isAllowedFile = (f: File) =>
  ALLOWED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)) || f.type.startsWith("image/");

/* ── Status Indicator ── */

function StatusIndicator({ stage, isFileUpload }: { stage: string | null; isFileUpload: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    Promise.resolve().then(() => setElapsed(0));
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [stage, isFileUpload]);

  let label: string;
  if (isFileUpload) {
    label = [...FILE_STAGES].reverse().find((s) => elapsed >= s.minSec)?.label ?? FILE_STAGES[0].label;
  } else {
    label = _parsePevStage(stage);
  }

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white border-2 border-[#1A202C] px-4 py-3 flex items-center gap-3">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-[#00A3C4] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-[#00A3C4] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-[#00A3C4] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-[9px] font-bold tracking-widest text-gray-400 transition-all">
          {label}
          {isFileUpload && <span className="ml-1 text-gray-300">({elapsed}s)</span>}
        </span>
      </div>
    </div>
  );
}

import { ToolCallCard } from "@/components/chat/blocks/ToolCallCard";
import { MarkdownBlock } from "@/components/chat/blocks/MarkdownBlock";
import { ThinkingBlock } from "@/components/chat/blocks/ThinkingBlock";
import { ToolResultCard } from "@/components/chat/blocks/ToolResultCard";

/* ── Agent Loop Progress ── */

function AgentLoopProgress({ round, maxRounds }: { round: number; maxRounds: number }) {
  if (round <= 0 || maxRounds <= 0) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 mb-2">
      <div className="flex gap-1">
        {Array.from({ length: maxRounds }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 border border-[#1A202C] transition-all ${
              i < round
                ? "bg-[#00A3C4]"
                : i === round
                ? "bg-[#00D1FF] animate-pulse"
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">
        Agent 轮次 {round}/{maxRounds}
      </span>
    </div>
  );
}

/* ── Streaming Blocks Bubble ── */

function StreamingBlocksBubble({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%]">
        <div className="px-4 py-3 bg-white border-2 border-[#1A202C] text-[#1A202C]">
          {blocks.filter((b): b is ContentBlock => b != null).map((block, i) => {
            if (block.type === "text") {
              return (
                <div key={i}>
                  <MarkdownBlock text={block.text} />
                  {i === blocks.length - 1 && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#00A3C4] ml-0.5 animate-pulse" />
                  )}
                </div>
              );
            }
            if (block.type === "thinking") {
              return <ThinkingBlock key={i} text={block.text} streaming={true} />;
            }
            if (block.type === "tool_call") {
              return <ToolCallCard key={i} block={block} />;
            }
            if (block.type === "tool_result") {
              return <ToolResultCard key={i} block={block} />;
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Streaming Bubble ── */

function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%]">
        <div className="px-4 py-3 bg-white border-2 border-[#1A202C] text-[#1A202C]">
          <div className="text-xs whitespace-pre-wrap break-words leading-relaxed select-text">
            {text}
            <span className="inline-block w-1.5 h-3.5 bg-[#00A3C4] ml-0.5 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */

export default function ChatDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const convId = Number(params.id);
  const { theme } = useTheme();

  // If URL carries ws=skill_studio hint, render immediately without waiting for API
  const wsHint = searchParams.get("ws");

  // Store state — messages via zustand, stream state via out-of-store subscription
  const storeMessages = useChatStore((s) => s.messagesMap.get(convId));
  const messages = useMemo(() => storeMessages ?? [], [storeMessages]);
  const [convStream, setConvStream] = useState(() => getConvStreamSnapshot(convId));
  useEffect(() => {
    setConvStream(getConvStreamSnapshot(convId));
    return subscribeConvStream(convId, () => setConvStream({ ...getConvStreamSnapshot(convId) }));
  }, [convId]);

  const streamingText = convStream.streamingText;
  const streamBlocks = convStream.streamingBlocks;
  const streamStage = convStream.streamStage;
  const isSending = convStream.isSending;
  const isFileUpload = convStream.isFileUpload;
  const currentRound = convStream.currentRound;
  const maxRounds = convStream.maxRounds;
  const streamError = convStream.streamError;
  const tokenUsage = convStream.tokenUsage;

  // UI-only state
  const [loading, setLoading] = useState(true);
  const [isOpencode, setIsOpencode] = useState(false);
  const [opencodeWorkspaceId, setOpencodeWorkspaceId] = useState<number | null>(null);
  const [isSkillStudio, setIsSkillStudio] = useState(wsHint === "skill_studio");
  const [isDragOver, setIsDragOver] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<string | null>(null);
  const [workspaceSkills, setWorkspaceSkills] = useState<{ id: number; name: string; description?: string }[]>([]);
  const [workspaceTools, setWorkspaceTools] = useState<{ id: number; name: string; display_name: string; description?: string; tool_type?: string }[]>([]);
  const [activeSkill, setActiveSkill] = useState<{ id: number; name: string } | null>(null);
  const [enabledSkillIds, setEnabledSkillIds] = useState<Set<number> | null>(null);
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [workspaceType, setWorkspaceType] = useState<string | null | undefined>(undefined);
  const [sandboxSkills, setSandboxSkills] = useState<{ id: number; name: string; status: string }[]>([]);
  const [sandboxSkillId, setSandboxSkillId] = useState<number | null>(null);
  const [sandboxLoaded, setSandboxLoaded] = useState(false);

  // Connection state
  const [connState, setConnState] = useState<ConnectionState>(connectionManager.getState());
  useEffect(() => connectionManager.subscribe(setConnState), []);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages + workspace concurrently
  useEffect(() => {
    // ── Messages ──────────────────────────────────────────────────
    const cached = useChatStore.getState().messagesMap.get(convId);
    if (cached) {
      setLoading(false);
    } else {
      setLoading(true);
      useChatStore.getState().loadMessages(convId).finally(() => setLoading(false));
    }

    // Reset sandbox state on conv change
    setSandboxLoaded(false);
    setSandboxSkills([]);
    setSandboxSkillId(null);
    // 有 wsHint 时不重置这些状态，避免 API 返回前 SkillStudio 被 unmount 再重挂
    if (wsHint !== "skill_studio") {
      setWorkspaceType(null);
      setIsSkillStudio(false);
    }

    // ── Workspace (concurrent, doesn't block messages) ────────────
    const loadWorkspace = async () => {
      let convs = useChatStore.getState().conversations;
      if (convs.length === 0) {
        try { convs = await apiFetch<typeof convs>("/conversations"); } catch { return; }
      }
      const conv = convs.find((c) => c.id === convId) as { id: number; workspace_id?: number | null; skill_id?: number | null } | undefined;
      if (!conv?.workspace_id) { setWorkspaceType(null); return; }

      let ws = _wsCache.get(conv.workspace_id);
      if (!ws) {
        try {
          ws = await apiFetch<WorkspaceData>(`/workspaces/${conv.workspace_id}`);
          _wsCache.set(conv.workspace_id, ws);
        } catch { return; }
      }

      if (ws.workspace_type === "opencode") {
        setIsOpencode(true);
        setOpencodeWorkspaceId(conv.workspace_id);
        return;
      }
      if (ws.workspace_type === "skill_studio") {
        setIsSkillStudio(true);
        return;
      }
      setWorkspaceType(ws.workspace_type ?? null);
      setWelcomeMessage(ws.welcome_message ?? null);
      if (ws.workspace_type === "sandbox") {
        apiFetch<{ id: number; name: string; status: string }[]>("/skills?mine=true").then((skills) => {
          const unpublished = skills.filter(s => s.status === "draft" || s.status === "reviewing");
          setSandboxSkills(unpublished);
          if (unpublished.length > 0) setSandboxSkillId(unpublished[0].id);
        }).catch(() => {}).finally(() => setSandboxLoaded(true));
      } else {
        setWorkspaceSkills(ws.skills ?? []);
        setWorkspaceTools(ws.tools ?? []);
      }
      if ((conv as { skill_id?: number | null }).skill_id) {
        const sk = ws.skills?.find((s) => s.id === (conv as { skill_id?: number | null }).skill_id);
        if (sk) setActiveSkill({ id: sk.id, name: sk.name });
      }
    };
    loadWorkspace();
  }, [convId, wsHint]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isSending, streamingText, streamBlocks]);

  // Prevent browser file drop
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent, true);
    window.addEventListener("drop", prevent, true);
    return () => {
      window.removeEventListener("dragover", prevent, true);
      window.removeEventListener("drop", prevent, true);
    };
  }, []);

  async function handleSelectSkill(skill: { id: number; name: string } | null) {
    setActiveSkill(skill);
    await apiFetch(`/conversations/${convId}`, {
      method: "PATCH",
      body: JSON.stringify({ skill_id: skill ? skill.id : -1 }),
    }).catch(() => {});
  }

  function handleStop() {
    useChatStore.getState().stopGeneration(convId);
  }

  // Esc to stop generation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isSending) {
        e.preventDefault();
        handleStop();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSending]);

  /* ── Send message via store ── */

  async function handleSend(content: string, files?: File[], toolId?: number, multiFiles?: Record<string, File>) {
    await useChatStore.getState().sendMessage(convId, content, {
      activeSkillIds: enabledSkillIds !== null ? Array.from(enabledSkillIds) : undefined,
      toolId,
      files,
      multiFiles,
      forceSkillId: workspaceType === "sandbox" && sandboxSkillId ? sandboxSkillId : undefined,
    });
  }

  const handleQuote = useCallback((text: string) => setQuote(text), []);
  const handleQuickReply = useCallback((text: string) => setPrefill(text), []);

  /* ── Retry on error ── */
  function handleRetry() {
    useChatStore.getState().clearStreamError(convId);
    // Find the last user message and resend
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      handleSend(lastUserMsg.content);
    }
  }

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isAllowedFile);
    if (droppedFiles.length > 0) handleSend("", droppedFiles);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
          Loading messages...
        </div>
      </div>
    );
  }

  if (isOpencode) {
    const fromSkillId = searchParams.get("from_skill") ? Number(searchParams.get("from_skill")) : undefined;
    const initialViewId = searchParams.get("view_id") ? Number(searchParams.get("view_id")) : undefined;
    return <DevStudio convId={convId} workspaceId={opencodeWorkspaceId ?? undefined} fromSkillId={fromSkillId} initialViewId={initialViewId} />;
  }

  if (isSkillStudio) {
    return <SkillStudio convId={convId} />;
  }

  return (
    <div
      className={`h-full flex flex-col relative transition-colors ${isDragOver ? "bg-[#CCF2FF]/20" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Connection status bar */}
      {connState === "failed" && (
        <div className="bg-red-50 border-b-2 border-red-300 px-4 py-1.5 text-[9px] font-bold text-red-500 flex items-center justify-between">
          <span>连接已断开</span>
          <button
            onClick={() => connectionManager.connect()}
            className="px-2 py-0.5 border border-red-300 bg-white text-red-500 hover:bg-red-50 transition-colors"
          >
            重新连接
          </button>
        </div>
      )}

      {/* Token usage warning */}
      {tokenUsage && tokenUsage.used > tokenUsage.limit * 0.8 && (
        <div className="text-[8px] font-bold text-amber-500 px-4 py-1 bg-amber-50 border-b border-amber-200">
          上下文已使用 {Math.round(tokenUsage.used / tokenUsage.limit * 100)}%，建议新建对话
        </div>
      )}

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 border-4 border-dashed border-[#00D1FF] bg-[#CCF2FF]/50 pointer-events-none flex items-center justify-center">
          <div className="bg-white border-2 border-[#1A202C] px-6 py-3 flex items-center gap-2">
            <span className="text-lg">📎</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#1A202C]">松开以上传文件</span>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !isSending && workspaceType !== undefined && (
          <div className="h-full flex flex-col items-center justify-center px-8">
            {workspaceType === "sandbox" ? (
              <div className={`max-w-md w-full border-2 border-[#00CC99] p-5 ${theme === "dark" ? "bg-[#0D2B22]" : "bg-[#F0FFF9]"}`}>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99] mb-3">
                  🧪 Skill / Tool 沙盒测试
                </div>
                {!sandboxLoaded ? (
                  <div className="text-[11px] text-gray-400 leading-relaxed">加载中...</div>
                ) : sandboxSkills.length > 0 ? (
                  <div className="text-[11px] text-[#1A202C] leading-relaxed">
                    在下方选择要测试的 Skill，然后直接发送任意消息触发测试。
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500 leading-relaxed">
                    你还没有待测试的 Skill。去「Skills &amp; Tools」页面点击「▶ 沙盒测试」来发起测试。
                  </div>
                )}
              </div>
            ) : welcomeMessage ? (
              <div className="max-w-lg w-full border-2 border-[#00A3C4] bg-[#F0FAFF] p-5">
                <div className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">欢迎</div>
                <div className="text-[11px] text-[#1A202C] leading-relaxed whitespace-pre-wrap">
                  {welcomeMessage}
                </div>
              </div>
            ) : (
              <>
                <div className="w-8 h-8 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-3">
                  <span className="text-[#00A3C4] text-xs font-bold">?</span>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  开始你的对话
                </p>
                <p className="text-[9px] text-gray-300 mt-1">
                  拖放文件到此处，或点击 📎 上传
                </p>
              </>
            )}
          </div>
        )}
        {/* 不显示消息时的沙盒 skill 选择提示 — 已在 welcome 卡片展示 */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onQuote={handleQuote} onQuickReply={handleQuickReply} />
        ))}

        {/* Agent Loop progress */}
        {isSending && currentRound > 0 && (
          <AgentLoopProgress round={currentRound} maxRounds={maxRounds} />
        )}

        {/* Streaming: show block-level progress or plain text bubble */}
        {isSending && streamBlocks.length > 0 && (
          <StreamingBlocksBubble blocks={streamBlocks} />
        )}
        {isSending && streamBlocks.length === 0 && streamingText && (
          <StreamingBubble text={streamingText} />
        )}
        {isSending && streamBlocks.length === 0 && !streamingText && (
          <StatusIndicator stage={streamStage} isFileUpload={isFileUpload} />
        )}

        {/* Stream error with retry */}
        {streamError && !isSending && (
          <div className="flex justify-start mb-3">
            <div className="bg-red-50 border-2 border-red-300 px-4 py-3 max-w-[75%]">
              <div className="text-[10px] font-bold text-red-500 mb-1">
                {streamError.type === "rate_limit" ? "请求频率超限" :
                 streamError.type === "context_overflow" ? "上下文长度超限" :
                 streamError.type === "network" ? "网络连接错误" :
                 "服务端错误"}
              </div>
              <div className="text-[9px] text-red-400 mb-2">{streamError.message}</div>
              <button
                onClick={handleRetry}
                className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-red-300 bg-white text-red-500 hover:bg-red-50 transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stop generation button */}
      {isSending && !isFileUpload && (
        <div className="flex justify-center py-1.5 border-t border-gray-100 bg-white/80">
          <button
            onClick={handleStop}
            className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8] transition-colors flex items-center gap-1.5"
          >
            <span className="w-2 h-2 bg-[#1A202C]" />
            停止生成
          </button>
        </div>
      )}

      {/* Sandbox skill selector */}
      {workspaceType === "sandbox" && sandboxSkills.length > 0 && (
        <div className={`border-t-2 border-[#00CC99] px-4 py-2 space-y-1.5 ${theme === "dark" ? "bg-[#0D2B22]" : "bg-[#F0FFF9]"}`}>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#00CC99]">选择测试对象</span>
            {sandboxSkillId && (
              <span className="text-[8px] text-[#00CC99]/60">— 选好后发消息即可触发测试</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sandboxSkills.map((sk) => (
              <button
                key={sk.id}
                onClick={() => setSandboxSkillId(sk.id)}
                className={`px-2 py-0.5 text-[9px] font-bold border-2 transition-colors ${
                  sandboxSkillId === sk.id
                    ? "border-[#00CC99] bg-[#00CC99] text-white"
                    : "border-[#00CC99] text-[#00CC99] bg-transparent hover:bg-[#00CC99]/20"
                }`}
              >
                {sk.name}
                {sk.status === "draft" && (
                  <span className="ml-1 text-[7px] opacity-60">草稿</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workspace Skill filter panel */}
      {workspaceSkills.length > 1 && (
        <div className="border-t border-gray-200 bg-[#F8FCFE]">
          <button
            onClick={() => setSkillPanelOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-[#00D1FF]">▣</span>
              工作空间 Skill
              {enabledSkillIds !== null && (
                <span className="ml-1 px-1 py-0.5 bg-[#1A202C] text-[#00D1FF] text-[8px] font-bold">
                  {enabledSkillIds.size}/{workspaceSkills.length}
                </span>
              )}
            </span>
            <span>{skillPanelOpen ? "▲" : "▼"}</span>
          </button>
          {skillPanelOpen && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => setEnabledSkillIds(null)}
                className={`px-2 py-1 text-[9px] font-bold border-2 transition-colors ${
                  enabledSkillIds === null
                    ? "border-[#1A202C] bg-[#1A202C] text-white"
                    : "border-gray-300 text-gray-400 hover:border-[#1A202C] hover:text-[#1A202C]"
                }`}
              >
                全部
              </button>
              {workspaceSkills.map((sk) => {
                const enabled = enabledSkillIds === null || enabledSkillIds.has(sk.id);
                return (
                  <button
                    key={sk.id}
                    title={sk.description || sk.name}
                    onClick={() => {
                      setEnabledSkillIds((prev) => {
                        const base = prev ?? new Set(workspaceSkills.map((s) => s.id));
                        const next = new Set(base);
                        if (next.has(sk.id)) { next.delete(sk.id); } else { next.add(sk.id); }
                        if (next.size === workspaceSkills.length) return null;
                        return next;
                      });
                    }}
                    className={`px-2 py-1 text-[9px] font-bold border-2 transition-colors ${
                      enabled
                        ? "border-[#00A3C4] bg-[#CCF2FF] text-[#00A3C4]"
                        : "border-gray-200 bg-white text-gray-300"
                    }`}
                  >
                    <span className="text-[#00D1FF]">#</span> {sk.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isSending}
        quote={quote}
        onClearQuote={() => setQuote(null)}
        workspaceSkills={enabledSkillIds !== null ? workspaceSkills.filter((s) => enabledSkillIds.has(s.id)) : workspaceSkills}
        activeSkill={activeSkill}
        onSelectSkill={handleSelectSkill}
        workspaceTools={workspaceTools}
        prefill={prefill}
        onClearPrefill={() => setPrefill(null)}
      />
    </div>
  );
}
