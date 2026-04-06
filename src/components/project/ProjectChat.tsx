"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch, getToken } from "@/lib/api";
import { streamChat } from "@/lib/stream";
import { useEventStream } from "@/lib/event-stream";
import type { Message, Skill } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProjectConv {
  id: number;
  owner_id: number;
  owner_name: string | null;
  last_message: string | null;
  updated_at: string;
}

interface ExtractedTask {
  id: number;
  title: string;
  type: string;
  priority: string;
}

interface ProjectChatProps {
  projectId: string;
  className?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ALLOWED_EXTS = [".txt", ".pdf", ".docx", ".pptx", ".md", ".xlsx", ".xls", ".csv",
  ".jpg", ".jpeg", ".png", ".webp", ".bmp"];

function isAllowed(f: File) {
  return ALLOWED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)) || f.type.startsWith("image/");
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

// ── SimpleMarkdown: 仅渲染换行和粗体 ──────────────────────────────────────────

function SimpleText({ text }: { text: string }) {
  // 粗体 **...** 和换行
  const parts = text.split(/(\*\*[^*]+\*\*|\n)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i}>{p.slice(2, -2)}</strong>;
        }
        if (p === "\n") return <br key={i} />;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

// ── MessageRow ─────────────────────────────────────────────────────────────────

function MessageRow({
  msg,
  senderName,
  isAI,
}: {
  msg: Message;
  senderName?: string;
  isAI: boolean;
}) {
  const label = isAI ? "AI" : (senderName || "成员");
  const initial = label[0]?.toUpperCase() || "?";

  return (
    <div className={`flex gap-2 ${isAI ? "flex-row" : "flex-row"} mb-3`}>
      {/* 头像 */}
      <div
        className={`flex-shrink-0 w-6 h-6 flex items-center justify-center text-[9px] font-bold border-2 border-[#1A202C] ${
          isAI ? "bg-[#00D1FF] text-[#1A202C]" : "bg-[#805AD5] text-white"
        }`}
      >
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[9px] font-bold text-[#1A202C]">{label}</span>
          <span className="text-[8px] text-gray-400">{timeLabel(msg.created_at)}</span>
        </div>
        <div
          className={`text-[10px] leading-relaxed px-2.5 py-2 border-2 ${
            isAI
              ? "bg-[#F0F4F8] border-[#E2E8F0] text-[#1A202C]"
              : "bg-white border-[#1A202C] text-[#1A202C]"
          }`}
        >
          <SimpleText text={msg.content} />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ProjectChat({ projectId, className = "" }: ProjectChatProps) {
  // ── state ────────────────────────────────────────────────────────────────────
  const [convId, setConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allConvs, setAllConvs] = useState<ProjectConv[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [knowledgeCount, setKnowledgeCount] = useState<number | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState<ExtractedTask[] | null>(null);
  const [error, setError] = useState("");

  // Gap 6: 事件流驱动实时同步
  const { events: streamEvents } = useEventStream({ project_id: Number(projectId), enabled: !!projectId });

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── init: 创建/复用项目对话 ──────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // 创建/复用自己的项目对话
        const conv = await apiFetch<{ id: number }>("/conversations", {
          method: "POST",
          body: JSON.stringify({ project_id: Number(projectId) }),
        });
        setConvId(conv.id);

        // 加载自己的消息
        const msgs = await apiFetch<Message[]>(`/conversations/${conv.id}/messages`);
        setMessages(msgs);

        // 拉取该项目所有成员对话（群组视图）
        await loadAllConvs();

        // 拉取项目知识库数量
        await loadKnowledgeCount();
      } catch (e) {
        setError(e instanceof Error ? e.message : "初始化失败");
      }
    }

    async function loadSkills() {
      try {
        const data = await apiFetch<Skill[]>("/skills?scope=company");
        setSkills(data);
      } catch {
        // ignore
      }
    }

    init();
    loadSkills();

    // Gap 6: 保留轮询作为 fallback（30s），主要依赖事件流
    pollRef.current = setInterval(loadAllConvs, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      abortRef.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Gap 6: 事件流驱动刷新
  useEffect(() => {
    if (streamEvents.length === 0) return;
    const last = streamEvents[streamEvents.length - 1];
    const refreshTypes = ["context_updated", "task_completed", "task_created", "skill_executed"];
    if (refreshTypes.includes(last.event_type)) {
      loadAllConvs();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamEvents.length]);

  // ── 滚动到底部 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // ── helpers ──────────────────────────────────────────────────────────────────
  async function loadAllConvs() {
    try {
      const data = await apiFetch<ProjectConv[]>(`/projects/${projectId}/conversations`);
      setAllConvs(data);
    } catch {
      // ignore
    }
  }

  async function loadKnowledgeCount() {
    try {
      // 通过项目详情拿 knowledge_shares 数量
      const proj = await apiFetch<{ knowledge_shares?: unknown[] }>(`/projects/${projectId}`);
      setKnowledgeCount(proj.knowledge_shares?.length ?? 0);
    } catch {
      // ignore
    }
  }

  async function loadOwnMessages() {
    if (!convId) return;
    try {
      const msgs = await apiFetch<Message[]>(`/conversations/${convId}/messages`);
      setMessages(msgs);
    } catch {
      // ignore
    }
  }

  // ── 发送消息 ─────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!convId || !text.trim() || sending) return;
    const content = text.trim();
    setText("");
    setError("");

    // 乐观更新
    const tempMsg: Message = {
      id: Date.now(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    setSending(true);
    setStreamingText("");

    const abort = new AbortController();
    abortRef.current = abort;

    let accumulated = "";
    let finalId: number | null = null;

    try {
      for await (const event of streamChat(convId, content, {
        signal: abort.signal,
        activeSkillIds: activeSkill ? [activeSkill.id] : undefined,
      })) {
        if (event.type === "delta") {
          accumulated += event.data.text as string;
          setStreamingText(accumulated);
        } else if (event.type === "replace") {
          accumulated = event.data.text as string;
          setStreamingText(accumulated);
        } else if (event.type === "done") {
          finalId = event.data.message_id as number;
        } else if (event.type === "error") {
          setError((event.data.message as string) || "发送失败");
        }
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "发送失败");
      }
    } finally {
      setSending(false);
      setStreamingText("");
      // 重新拉取消息（含 AI 回复）
      await loadOwnMessages();
    }
    void finalId;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, text, sending, activeSkill]);

  // ── 上传文件到项目知识库 ─────────────────────────────────────────────────────
  async function handleFileUpload(file: File) {
    if (!isAllowed(file)) {
      setError("不支持的文件格式");
      return;
    }
    setUploading(true);
    setUploadMsg("");
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      const token = getToken();
      const res = await fetch(`/api/proxy/projects/${projectId}/knowledge/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setUploadMsg(`已上传《${data.title}》到项目知识库`);
      setKnowledgeCount((n) => (n ?? 0) + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
      setUploadFile(null);
    }
  }

  // ── 提取任务 ─────────────────────────────────────────────────────────────────
  async function handleExtractTasks() {
    if (!convId) return;
    setExtracting(true);
    setExtractedTasks(null);
    setError("");
    try {
      const result = await apiFetch<{ tasks: ExtractedTask[] }>(
        `/projects/${projectId}/extract-tasks`,
        {
          method: "POST",
          body: JSON.stringify({ conversation_id: convId }),
        }
      );
      setExtractedTasks(result.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提取失败");
    } finally {
      setExtracting(false);
    }
  }

  // ── 合并所有成员消息（群组视图）──────────────────────────────────────────────
  // 自己的消息已在 messages state，其他成员的 last_message 摘要在 allConvs
  // 实际展示只显示自己对话的消息 + AI 回复，群组视图在侧边栏显示其他成员活跃状态

  const PRIORITY_LABEL: Record<string, string> = {
    urgent_important: "紧急重要",
    important: "重要",
    urgent: "紧急",
    neither: "普通",
  };
  const TYPE_LABEL: Record<string, string> = {
    task: "任务",
    bug: "Bug",
    milestone: "节点",
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col border-l-2 border-[#1A202C] bg-white h-full ${className}`}>
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b-2 border-[#1A202C] bg-[#F0F4F8] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#00D1FF]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            项目对话
          </span>
          {knowledgeCount !== null && (
            <span className="text-[8px] text-gray-400 font-bold">
              📚 {knowledgeCount} 条知识
            </span>
          )}
        </div>
        <button
          onClick={handleExtractTasks}
          disabled={extracting || !convId}
          className="text-[8px] font-bold uppercase px-2 py-1 border border-[#805AD5] text-[#805AD5] hover:bg-[#805AD5]/10 disabled:opacity-50 transition-colors"
        >
          {extracting ? "提取中..." : "提取任务"}
        </button>
      </div>

      {/* 成员活跃状态（其他人最近消息） */}
      {allConvs.length > 1 && (
        <div className="px-3 py-1.5 border-b border-[#E2E8F0] bg-[#FAFBFC] flex-shrink-0 overflow-x-auto">
          <div className="flex gap-3">
            {allConvs.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-4 h-4 bg-[#805AD5] flex items-center justify-center text-[8px] font-bold text-white border border-[#1A202C]">
                  {(c.owner_name || "?")[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-[8px] font-bold text-[#1A202C]">{c.owner_name || "成员"}</div>
                  {c.last_message && (
                    <div className="text-[8px] text-gray-400 max-w-[80px] truncate">{c.last_message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 提取的任务展示 */}
      {extractedTasks && (
        <div className="px-3 py-2 border-b border-[#E2E8F0] bg-[#FFF5F5] flex-shrink-0 max-h-32 overflow-y-auto">
          <div className="text-[8px] font-bold uppercase text-[#805AD5] mb-1">
            已提取 {extractedTasks.length} 个任务
          </div>
          {extractedTasks.length === 0 ? (
            <div className="text-[9px] text-gray-400">未发现可提取的任务</div>
          ) : (
            extractedTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 py-0.5">
                <span className="text-[8px] px-1 border border-[#805AD5] text-[#805AD5] font-bold">
                  {TYPE_LABEL[t.type] ?? t.type}
                </span>
                <span className="text-[9px] text-[#1A202C] font-bold">{t.title}</span>
                <span className="text-[8px] text-gray-400">{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
              </div>
            ))
          )}
          <button
            onClick={() => setExtractedTasks(null)}
            className="mt-1 text-[8px] text-gray-400 hover:text-gray-600"
          >
            收起
          </button>
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
        {messages.length === 0 && !streamingText && (
          <div className="text-[10px] text-gray-400 text-center py-8">
            在这里与 AI 讨论项目相关内容
            <br />
            <span className="text-[9px]">AI 会自动检索项目知识库</span>
          </div>
        )}
        {messages.map((msg) => (
          <MessageRow
            key={msg.id}
            msg={msg}
            isAI={msg.role === "assistant"}
            senderName={msg.metadata?.sender_name as string | undefined}
          />
        ))}
        {/* 流式输出中 */}
        {streamingText && (
          <MessageRow
            msg={{
              id: 0,
              role: "assistant",
              content: streamingText,
              created_at: new Date().toISOString(),
            }}
            isAI={true}
          />
        )}
        <div ref={bottomRef} />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="px-3 py-1.5 bg-red-50 border-t border-red-200 flex-shrink-0">
          <span className="text-[9px] font-bold text-red-500">{error}</span>
          <button onClick={() => setError("")} className="ml-2 text-[8px] text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* 上传提示 */}
      {uploadMsg && (
        <div className="px-3 py-1.5 bg-green-50 border-t border-green-200 flex-shrink-0">
          <span className="text-[9px] font-bold text-green-600">{uploadMsg}</span>
          <button onClick={() => setUploadMsg("")} className="ml-2 text-[8px] text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {/* Skill 选择器 */}
      {showSkillPicker && skills.length > 0 && (
        <div className="border-t border-[#E2E8F0] bg-white flex-shrink-0 max-h-40 overflow-y-auto">
          <div className="px-3 py-1.5 flex items-center justify-between border-b border-[#E2E8F0]">
            <span className="text-[9px] font-bold uppercase text-gray-500">选择 Skill</span>
            <button onClick={() => setShowSkillPicker(false)} className="text-[9px] text-gray-400 hover:text-gray-600">✕</button>
          </div>
          {activeSkill && (
            <button
              onClick={() => { setActiveSkill(null); setShowSkillPicker(false); }}
              className="w-full text-left px-3 py-1.5 text-[9px] text-red-500 hover:bg-red-50 border-b border-[#E2E8F0]"
            >
              取消 Skill
            </button>
          )}
          {skills.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActiveSkill(s); setShowSkillPicker(false); }}
              className={`w-full text-left px-3 py-1.5 hover:bg-[#F0F4F8] transition-colors ${
                activeSkill?.id === s.id ? "bg-[#CCF2FF]" : ""
              }`}
            >
              <div className="text-[10px] font-bold text-[#1A202C]">{s.name}</div>
              {s.description && (
                <div className="text-[8px] text-gray-400 truncate">{s.description}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="border-t-2 border-[#1A202C] flex-shrink-0 bg-white">
        {/* 激活的 Skill 标签 */}
        {activeSkill && (
          <div className="px-3 pt-2 flex items-center gap-1.5">
            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-[#00D1FF] text-[#1A202C] border border-[#1A202C]">
              ⚡ {activeSkill.name}
            </span>
            <button
              onClick={() => setActiveSkill(null)}
              className="text-[8px] text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        )}
        {/* 待上传文件标签 */}
        {uploadFile && (
          <div className="px-3 pt-2 flex items-center gap-1.5">
            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-[#E9D8FD] text-[#805AD5] border border-[#805AD5]">
              📎 {uploadFile.name}
            </span>
            <button
              onClick={() => setUploadFile(null)}
              className="text-[8px] text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <button
              onClick={() => handleFileUpload(uploadFile)}
              disabled={uploading}
              className="text-[8px] font-bold px-2 py-0.5 border border-[#805AD5] text-[#805AD5] hover:bg-[#805AD5]/10 disabled:opacity-50"
            >
              {uploading ? "上传中..." : "上传到知识库"}
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 p-2">
          {/* 附件按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center border-2 border-[#1A202C] text-[#1A202C] hover:bg-[#F0F4F8] transition-colors"
            title="上传文件到项目知识库"
          >
            <span className="text-[11px]">📎</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ALLOWED_EXTS.join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setUploadFile(f);
              e.target.value = "";
            }}
          />

          {/* Skill 选择按钮 */}
          <button
            onClick={() => setShowSkillPicker((v) => !v)}
            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center border-2 transition-colors ${
              activeSkill
                ? "border-[#00A3C4] bg-[#CCF2FF] text-[#00A3C4]"
                : "border-[#1A202C] text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
            title="选择 Skill"
          >
            <span className="text-[11px]">⚡</span>
          </button>

          {/* 文本输入框 */}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            rows={2}
            disabled={sending}
            className="flex-1 border-2 border-[#1A202C] px-2 py-1.5 text-[10px] bg-white focus:outline-none focus:border-[#00A3C4] resize-none leading-relaxed disabled:opacity-50"
          />

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="flex-shrink-0 px-3 py-1.5 text-[9px] font-bold uppercase border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4] disabled:opacity-50 transition-colors self-end"
          >
            {sending ? "···" : "发送"}
          </button>
        </div>
      </div>
    </div>
  );
}
