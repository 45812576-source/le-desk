"use client";

import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Message } from "@/lib/types";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatContext } from "../layout";

const FILE_STAGES: { minSec: number; label: string }[] = [
  { minSec: 0,  label: "解析文件中..." },
  { minSec: 4,  label: "提取文本内容..." },
  { minSec: 10, label: "生成 FOE 结构化摘要..." },
  { minSec: 30, label: "校验 Input 是否充分..." },
  { minSec: 50, label: "调用 Skill 生成回复..." },
];

const IDLE_QUIPS = [
  "在削铅笔...",
  "在找尺子...",
  "在调颜色...",
  "在摸鱼...",
  "在喝咖啡...",
  "在翻字典...",
  "在整理思路...",
  "在发呆...",
  "在问同事...",
  "在重新理解需求...",
  "在找灵感...",
  "在打草稿...",
  "在选字体...",
  "在对齐像素...",
  "在拖进度条...",
];

const ALLOWED_EXTS = [".txt", ".pdf", ".docx", ".pptx", ".md", ".xlsx", ".xls", ".csv",
  ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".mp3", ".wav", ".m4a", ".ogg", ".flac"];
const isAllowedFile = (f: File) =>
  ALLOWED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)) || f.type.startsWith("image/");

function TypingIndicator({ isFileUpload }: { isFileUpload: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  const [quipIdx, setQuipIdx] = useState(() => Math.floor(Math.random() * IDLE_QUIPS.length));

  useEffect(() => {
    setElapsed(0);
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [isFileUpload]);

  // 每 3 秒换一条俏皮话
  useEffect(() => {
    const rotate = setInterval(() => {
      setQuipIdx((i) => (i + 1) % IDLE_QUIPS.length);
    }, 3000);
    return () => clearInterval(rotate);
  }, []);

  const stageLabel = isFileUpload
    ? [...FILE_STAGES].reverse().find((s) => elapsed >= s.minSec)?.label ?? FILE_STAGES[0].label
    : null;

  const label = stageLabel ?? IDLE_QUIPS[quipIdx];

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

export default function ChatDetailPage() {
  const params = useParams();
  const convId = Number(params.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isFileUpload, setIsFileUpload] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [quote, setQuote] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<string | null>(null);
  const [workspaceSkills, setWorkspaceSkills] = useState<{ id: number; name: string; description?: string }[]>([]);
  const [workspaceTools, setWorkspaceTools] = useState<{ id: number; name: string; display_name: string; description?: string; tool_type?: string }[]>([]);
  const [activeSkill, setActiveSkill] = useState<{ id: number; name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onTitleUpdate } = useContext(ChatContext);

  // 拉 conv → workspace → skills
  useEffect(() => {
    apiFetch<{ id: number; workspace_id: number | null; skill_id: number | null }[]>("/conversations")
      .then(async (convs) => {
        const conv = convs.find((c) => c.id === convId);
        if (!conv?.workspace_id) return;
        const ws = await apiFetch<{ skills: { id: number; name: string; description?: string }[]; tools: { id: number; name: string; display_name: string; description?: string; tool_type?: string }[] }>(`/workspaces/${conv.workspace_id}`);
        setWorkspaceSkills(ws.skills ?? []);
        setWorkspaceTools(ws.tools ?? []);
        if (conv.skill_id) {
          const sk = ws.skills?.find((s) => s.id === conv.skill_id);
          if (sk) setActiveSkill({ id: sk.id, name: sk.name });
        }
      })
      .catch(() => {});
  }, [convId]);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await apiFetch<Message[]>(`/conversations/${convId}/messages`);
      setMessages(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [convId]);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // 全局阻止浏览器打开文件（在捕获阶段最早拦截）
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

  async function handleSend(content: string, file?: File, toolId?: number) {
    if (sending) return;

    if (file) {
      await handleFileUpload(content, file, toolId);
      return;
    }

    setSending(true);
    setIsFileUpload(false);
    const tempId = Date.now();
    setMessages((prev) => [...prev, { id: tempId, role: "user", content, created_at: new Date().toISOString() }]);

    try {
      const body: Record<string, unknown> = { content };
      if (toolId) body.tool_id = toolId;
      const resp = await apiFetch<Message>(`/conversations/${convId}/messages`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== tempId);
        return [...without,
          { id: tempId, role: "user", content, created_at: new Date().toISOString() },
          { id: resp.id, role: "assistant" as const, content: resp.content, created_at: new Date().toISOString(), metadata: resp.metadata },
        ];
      });
      if (messages.length === 0) onTitleUpdate(convId, content.slice(0, 60));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  async function handleFileUpload(text: string, file: File, toolId?: number) {
    setSending(true);
    setIsFileUpload(true);

    const optimisticContent = text ? `${text}\n\n[文件: ${file.name}]` : `[文件: ${file.name}]`;
    const tempId = Date.now();
    setMessages((prev) => [...prev, {
      id: tempId,
      role: "user",
      content: optimisticContent,
      created_at: new Date().toISOString(),
    }]);

    try {
      const form = new FormData();
      if (text) form.append("message", text);
      form.append("file", file);
      if (toolId) form.append("tool_id", String(toolId));

      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const resp = await fetch(`/api/proxy/conversations/${convId}/messages/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });

      if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
      const result = await resp.json();

      setMessages((prev) => {
        const without = prev.filter((m) => m.id !== tempId);
        return [...without,
          { id: tempId, role: "user", content: optimisticContent, created_at: new Date().toISOString() },
          {
            id: result.id,
            role: "assistant" as const,
            content: result.content,
            created_at: new Date().toISOString(),
            metadata: {
              skill_id: result.skill_id ?? null,
              skill_name: result.skill_name ?? null,
              file_upload: true,
              filename: file.name,
            },
          },
        ];
      });
      if (messages.length === 0) onTitleUpdate(convId, `[文件] ${file.name}`.slice(0, 60));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
      setIsFileUpload(false);
    }
  }

  // 拖放处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(isAllowedFile);
    if (files.length > 0) handleFileUpload("", files[0]);
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

  return (
    <div
      className={`h-full flex flex-col relative transition-colors ${isDragOver ? "bg-[#CCF2FF]/20" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
        {messages.length === 0 && !sending && (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-8 h-8 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-3">
              <span className="text-[#00A3C4] text-xs font-bold">?</span>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              开始你的对话
            </p>
            <p className="text-[9px] text-gray-300 mt-1">
              拖放文件到此处，或点击 📎 上传
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onQuote={(text) => { setQuote(text); }} onQuickReply={(text) => { setPrefill(text); }} />
        ))}
        {sending && <TypingIndicator isFileUpload={isFileUpload} />}
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={sending}
        quote={quote}
        onClearQuote={() => setQuote(null)}
        workspaceSkills={workspaceSkills}
        activeSkill={activeSkill}
        onSelectSkill={handleSelectSkill}
        workspaceTools={workspaceTools}
        prefill={prefill}
        onClearPrefill={() => setPrefill(null)}
      />
    </div>
  );
}
