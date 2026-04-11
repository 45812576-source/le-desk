"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch, getToken, dispatchAuthExpired } from "@/lib/api";
import type { SkillDetail, SkillMemo } from "@/lib/types";
import { SkillMemoPanel } from "@/components/skill/SkillMemoPanel";
import { useStudioStore } from "@/lib/studio-store";
import { SummaryCard } from "./cards/SummaryCard";
import { DraftCard } from "./cards/DraftCard";
import { ToolSuggestionCard } from "./cards/ToolSuggestionCard";
import { FileSplitCard } from "./cards/FileSplitCard";
import { GovernanceTimeline } from "./GovernanceTimeline";
import { RouteStatusBar } from "./RouteStatusBar";
import { AssistSkillsBar } from "./AssistSkillsBar";
import { applyOps, estimateMessagesTokens, TOKEN_COMPRESS_THRESHOLD } from "./utils";
import type {
  ChatMessage,
  StudioDraft,
  StudioDiff,
  DiffOp,
  StudioSummary,
  StudioToolSuggestion,
  StudioFileSplit,
  V2SessionState,
  StudioRouteInfo,
  AuditResult,
  GovernanceActionCard,
  GovernanceCardData,
  PhaseProgress,
  StagedEdit,
  ArchitectPhaseStatus,
  ArchitectQuestion,
  ArchitectPhaseSummary,
  ArchitectStructure,
  ArchitectPriorityMatrix,
  ArchitectOodaDecision,
  ArchitectReadyForDraft,
} from "./types";

// ─── StudioChat ───────────────────────────────────────────────────────────────

export function StudioChat({
  convId,
  skillId,
  currentPrompt,
  editorIsDirty,
  allSkills,
  memo,
  onApplyDraft,
  onNewSession,
  onToolBound,
  onDevStudio,
  onFileSplitDone,
  onMemoRefresh,
  onOpenSandbox,
  selectedSourceFile,
  onEditorTarget,
  clearRef,
  setInputRef,
  onViewReport,
  sandboxReportId,
  fromSandbox,
  onExpandEditor,
  editorExpanded,
}: {
  convId: number;
  skillId: number | null;
  currentPrompt: string;
  editorIsDirty: boolean;
  selectedSourceFile: string | null;
  allSkills: SkillDetail[];
  memo: SkillMemo | null;
  onApplyDraft: (draft: StudioDraft) => void;
  onNewSession: () => void;
  onToolBound: () => void;
  onDevStudio: (desc: string) => void;
  onFileSplitDone: () => void;
  onMemoRefresh: () => void;
  onOpenSandbox: (skillId: number) => void;
  onEditorTarget: (fileType: string, filename: string) => void;
  clearRef?: { current: (() => void) | null };
  setInputRef?: { current: ((text: string) => void) | null };
  onViewReport?: () => void;
  sandboxReportId?: string;
  fromSandbox?: boolean;
  onExpandEditor?: () => void;
  editorExpanded?: boolean;
}) {
  const _storageKey = `studio_msgs_${convId}`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [backendLoaded, setBackendLoaded] = useState(false);
  const [backendFailed, setBackendFailed] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamStage, setStreamStage] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<StudioDraft | null>(null);
  const [pendingSummary, setPendingSummary] = useState<StudioSummary | null>(null);
  const [pendingToolSuggestion, setPendingToolSuggestion] = useState<StudioToolSuggestion | null>(null);
  const [pendingFileSplit, setPendingFileSplit] = useState<StudioFileSplit | null>(null);
  const [splitting, setSplitting] = useState(false);

  // ── 治理抽屉状态 ──
  const drawerStorageKey = skillId ? `studio_drawer_${skillId}` : null;
  const [drawerOpen, setDrawerOpen] = useState(() => {
    if (fromSandbox) return true;
    if (drawerStorageKey) {
      try { return localStorage.getItem(drawerStorageKey) !== "closed"; } catch { return false; }
    }
    return false;
  });
  const [drawerWidth, setDrawerWidth] = useState<"narrow" | "medium" | "wide">("medium");

  useEffect(() => {
    if (!drawerStorageKey) return;
    try { localStorage.setItem(drawerStorageKey, drawerOpen ? "open" : "closed"); } catch { /* ignore */ }
  }, [drawerOpen, drawerStorageKey]);

  const drawerAutoOpened = useRef(false);
  useEffect(() => {
    if (memo && !drawerAutoOpened.current && (memo.lifecycle_stage === "fixing" || memo.persistent_notices?.some(n => n.status === "active"))) {
      drawerAutoOpened.current = true;
      setDrawerOpen(true);
    }
  }, [memo]);

  // 聚焦整改模式
  const fixContextSent = useRef(false);
  useEffect(() => {
    if (!fromSandbox || fixContextSent.current || !memo || !skillId) return;
    if (memo.lifecycle_stage !== "fixing" || !memo.latest_test) return;
    fixContextSent.current = true;

    if (memo.current_task) {
      const targetFile = memo.current_task.target_files[0];
      if (targetFile) {
        if (targetFile === "SKILL.md" || memo.current_task.target_kind === "skill_prompt") {
          onEditorTarget("prompt", "SKILL.md");
        } else {
          onEditorTarget("asset", targetFile);
        }
      }
    }

    const parts: string[] = [];
    parts.push(`当前整改目标：${memo.latest_test.summary}`);
    if (memo.latest_test.details?.blocking_reasons?.length) {
      parts.push(`未通过维度：${memo.latest_test.details.blocking_reasons.join("、")}`);
    }
    if (memo.current_task) {
      parts.push(`当前任务：${memo.current_task.title}`);
    }
    if (sandboxReportId) {
      parts.push(`来源报告 #${sandboxReportId}`);
    }
    parts.push("请帮我逐项修复上述问题。");

    setInput(parts.join("\n"));
    setTimeout(() => inputRef.current?.focus(), 100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromSandbox, memo, skillId]);

  const hasDrawerContent = !!(memo || pendingSummary || pendingDraft || pendingToolSuggestion || pendingFileSplit);
  const drawerWidthClass = drawerWidth === "narrow" ? "w-[240px]" : drawerWidth === "wide" ? "w-[400px]" : "w-[320px]";

  // V2 会话状态
  const [sessionState, setSessionState] = useState<V2SessionState | null>(null);
  const [reconciledFacts, setReconciledFacts] = useState<{ type: string; text: string }[]>([]);
  const [, setDirectionShift] = useState<{ from: string; to: string } | null>(null);
  const [, setFileNeedStatus] = useState<{ status: string; forbidden_countdown: number } | null>(null);
  const [, setRepeatBlocked] = useState<string | null>(null);

  // AI 编排层状态
  const [routeInfo, setRouteInfo] = useState<StudioRouteInfo | null>(null);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [pendingGovernanceActions, setPendingGovernanceActions] = useState<GovernanceActionCard[]>([]);
  const [phaseProgress, setPhaseProgress] = useState<PhaseProgress[]>([]);
  const [architectPhase, setArchitectPhase] = useState<ArchitectPhaseStatus | null>(null);
  const [architectQuestions, setArchitectQuestions] = useState<ArchitectQuestion[]>([]);
  const [architectStructures, setArchitectStructures] = useState<ArchitectStructure[]>([]);
  const [architectPriorities, setArchitectPriorities] = useState<ArchitectPriorityMatrix | null>(null);
  const [oodaDecisions, setOodaDecisions] = useState<ArchitectOodaDecision[]>([]);
  const [architectReady, setArchitectReady] = useState<ArchitectReadyForDraft | null>(null);
  const [answeredQuestionIdx, setAnsweredQuestionIdx] = useState(-1);
  const [pendingPhaseSummary, setPendingPhaseSummary] = useState<ArchitectPhaseSummary | null>(null);
  const [confirmedPhases, setConfirmedPhases] = useState<string[]>([]);

  // Store-driven governance
  const storeGovernanceCards = useStudioStore((s) => s.governanceCards);
  const addGovernanceCard = useStudioStore((s) => s.addGovernanceCard);
  const updateCardStatus = useStudioStore((s) => s.updateCardStatus);
  const addStagedEdit = useStudioStore((s) => s.addStagedEdit);
  const storeStagedEdits = useStudioStore((s) => s.stagedEdits);
  const adoptStagedEdit = useStudioStore((s) => s.adoptStagedEdit);
  const rejectStagedEdit = useStudioStore((s) => s.rejectStagedEdit);
  const setStoreSessionMode = useStudioStore((s) => s.setSessionMode);
  const storeAssistSkills = useStudioStore((s) => s.activeAssistSkills);
  const setActiveAssistSkills = useStudioStore((s) => s.setActiveAssistSkills);
  const setEditorVisibility = useStudioStore((s) => s.setEditorVisibility);

  // ── Staged edit adopt/reject handlers ──

  async function handleAdoptStagedEdit(editId: string) {
    if (!skillId) return;
    try {
      await apiFetch(`/skills/${skillId}/studio/staged-edits/${editId}/adopt`, { method: "POST" });
      adoptStagedEdit(editId);
      // Apply diff ops to prompt
      const edit = storeStagedEdits.find((e) => e.id === editId);
      if (edit?.diff && edit.diff.length > 0) {
        const newPrompt = applyOps(currentPrompt, edit.diff);
        onApplyDraft({ system_prompt: newPrompt, change_note: edit.changeNote || "采纳编辑" });
      }
      // Auto-collapse if no more pending staged edits
      const remaining = storeStagedEdits.filter((e) => e.id !== editId && e.status === "pending");
      if (remaining.length === 0) {
        setEditorVisibility("collapsed");
      }
    } catch (err) {
      console.error("Adopt staged edit failed:", err);
      setMessages((prev) => [...prev,
        { role: "assistant", text: `采纳失败：${err instanceof Error ? err.message : "未知错误"}`, loading: false },
      ]);
    }
  }

  async function handleRejectStagedEdit(editId: string) {
    if (!skillId) return;
    try {
      await apiFetch(`/skills/${skillId}/studio/staged-edits/${editId}/reject`, { method: "POST" });
      rejectStagedEdit(editId);
      // Auto-collapse if no more pending staged edits
      const remaining = storeStagedEdits.filter((e) => e.id !== editId && e.status === "pending");
      if (remaining.length === 0) {
        setEditorVisibility("collapsed");
      }
    } catch (err) {
      console.error("Reject staged edit failed:", err);
    }
  }

  // ── Memo action handlers ──
  async function handleMemoStartTask(taskId: string) {
    if (!skillId) return;
    try {
      const result = await apiFetch<{ ok: boolean; editor_target?: { mode: string; file_type: string; filename: string } }>(`/skills/${skillId}/memo/tasks/${taskId}/start`, {
        method: "POST",
        body: JSON.stringify({ source: "studio_chat" }),
      });
      onMemoRefresh();
      if (result.editor_target?.filename) {
        onEditorTarget(result.editor_target.file_type || "asset", result.editor_target.filename);
      }
    } catch (err) {
      console.error("handleMemoStartTask failed:", err);
      setMessages((prev) => [...prev,
        { role: "assistant", text: `任务启动失败：${err instanceof Error ? err.message : "未知错误"}`, loading: false },
      ]);
    }
  }

  async function handleMemoDirectTest() {
    if (!skillId) return;
    try {
      await apiFetch(`/skills/${skillId}/memo/direct-test`, {
        method: "POST",
        body: JSON.stringify({ source: "persistent_notice" }),
      });
      onMemoRefresh();
      onOpenSandbox(skillId);
    } catch (err) {
      console.error("handleMemoDirectTest failed:", err);
      setMessages((prev) => [...prev,
        { role: "assistant", text: `操作失败：${err instanceof Error ? err.message : "未知错误"}`, loading: false },
      ]);
    }
  }

  const [hashQuery, setHashQuery] = useState<string | null>(null);
  const [hashActiveIdx, setHashActiveIdx] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (clearRef) {
      clearRef.current = () => {
        abortRef.current?.abort();
        setMessages([]);
        setStreaming(false);
        setStreamStage(null);
        setPendingDraft(null);
        setPendingSummary(null);
        setPendingFileSplit(null);
        setArchitectPhase(null);
        setArchitectQuestions([]);
        setArchitectStructures([]);
        setArchitectPriorities(null);
        setOodaDecisions([]);
        setArchitectReady(null);
        setPendingPhaseSummary(null);
        setConfirmedPhases([]);
        setAnsweredQuestionIdx(-1);
        setPhaseProgress([]);
        try { localStorage.removeItem(_storageKey); } catch { /* ignore */ }
        apiFetch(`/conversations/${convId}/messages`, { method: "DELETE" }).catch(() => {});
      };
    }
    return () => { if (clearRef) clearRef.current = null; };
  }, [clearRef, _storageKey, convId]);

  useEffect(() => {
    if (setInputRef) {
      setInputRef.current = (text: string) => {
        setInput(text);
        setTimeout(() => inputRef.current?.focus(), 50);
      };
    }
    return () => { if (setInputRef) setInputRef.current = null; };
  }, [setInputRef]);

  // convId 切换时从后端加载历史
  useEffect(() => {
    setBackendLoaded(false);
    setBackendFailed(false);
    setPendingDraft(null);
    setPendingSummary(null);
    setPendingFileSplit(null);

    try {
      const raw = localStorage.getItem(_storageKey);
      if (raw) setMessages(JSON.parse(raw) as ChatMessage[]);
      else setMessages([]);
    } catch { setMessages([]); }

    const url = `/conversations/${convId}/messages`;

    apiFetch<{ id: number; role: string; content: string; metadata?: Record<string, unknown> }[]>(url)
      .then((dbMsgs) => {
        const mapped: ChatMessage[] = dbMsgs.map((m) => ({
          role: m.role as "user" | "assistant",
          text: m.content,
          loading: false,
        }));
        setMessages(mapped);
        try { localStorage.setItem(_storageKey, JSON.stringify(mapped)); } catch { /* ignore */ }
        setBackendLoaded(true);
      })
      .catch(() => {
        setBackendFailed(true);
        setBackendLoaded(true);
      });
  }, [convId, _storageKey]);

  useEffect(() => {
    if (!backendLoaded) return;
    try { localStorage.setItem(_storageKey, JSON.stringify(messages)); } catch { /* quota exceeded */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, backendLoaded]);

  // 18w token 自动压缩
  const [compressing, setCompressing] = useState(false);
  useEffect(() => {
    if (streaming || compressing || messages.length < 6) return;
    const totalTokens = estimateMessagesTokens(messages);
    if (totalTokens < TOKEN_COMPRESS_THRESHOLD) return;
    setCompressing(true);
    apiFetch<{ messages: ChatMessage[] }>(`/conversations/${convId}/messages/compress`, {
      method: "POST",
      body: JSON.stringify({ skill_id: skillId, messages }),
    })
      .then((res) => {
        if (res.messages && res.messages.length > 0) {
          setMessages(res.messages);
        }
      })
      .catch(() => { /* 压缩失败静默忽略 */ })
      .finally(() => setCompressing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streaming]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const filteredSkills = hashQuery !== null
    ? allSkills.filter((s) => s.name.toLowerCase().includes(hashQuery.toLowerCase()))
    : [];

  function handleInputChange(v: string, cursorPos: number) {
    setInput(v);
    const before = v.slice(0, cursorPos);
    const hashIdx = before.lastIndexOf("#");
    if (hashIdx !== -1) {
      const q = before.slice(hashIdx + 1);
      if (!q.includes(" ") && !q.includes("\n")) {
        setHashQuery(q);
        setHashActiveIdx(0);
        return;
      }
    }
    setHashQuery(null);
  }

  function selectHashSkill(skill: SkillDetail) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? input.length;
    const before = input.slice(0, cursor);
    const hashIdx = before.lastIndexOf("#");
    const newVal = input.slice(0, hashIdx) + `#${skill.name} ` + input.slice(cursor);
    setInput(newVal);
    setHashQuery(null);
    setTimeout(() => {
      el?.focus();
      const pos = hashIdx + skill.name.length + 2;
      el?.setSelectionRange(pos, pos);
    }, 0);
  }

  const CONTENT_MAX = 6000;

  async function ingestLongText(userText: string) {
    let msgIdx = -1;
    setMessages((prev) => {
      msgIdx = prev.length + 1;
      return [...prev,
        { role: "user", text: userText.slice(0, 300) + `…\n\n_（共 ${userText.length.toLocaleString()} 字符，正在分析…）_` },
        { role: "assistant", text: "", loading: true },
      ];
    });
    setStreaming(true);
    setStreamStage("ingest_parsing");
    setInput("");

    try {
      const token = getToken();
      const resp = await fetch(`/api/proxy/skills/${skillId}/ingest-paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: userText }),
      });
      if (!resp.ok) {
        let errMsg = `长文本分析失败 (${resp.status})`;
        try {
          const errData = await resp.json();
          if (errData.detail) errMsg = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
        } catch { /* use default */ }
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: errMsg, loading: false } : m
        ));
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) {
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: "无法读取响应", loading: false } : m
        ));
        return;
      }
      const decoder = new TextDecoder();
      let buf = "", curEvt = "stage";
      let savedFiles: string[] = [];
      let summary = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { curEvt = line.slice(7).trim(); }
          else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (curEvt === "stage") {
                setStreamStage(data.stage);
              } else if (curEvt === "ingest_files_saved") {
                savedFiles = data.files;
                onFileSplitDone();
              } else if (curEvt === "ingest_result") {
                summary = data.summary;
              } else if (curEvt === "error") {
                setMessages((prev) => prev.map((m, i) =>
                  i === msgIdx ? { ...m, text: data.message || "长文本分析失败", loading: false } : m
                ));
                return;
              }
            } catch { /* skip */ }
            curEvt = "stage";
          }
        }
      }

      const fileList = savedFiles.map(f => `\`${f}\``).join("、");
      setMessages((prev) => prev.map((m, i) =>
        i === msgIdx ? { ...m, text: `已存储 ${savedFiles.length} 个子文件（${fileList}），正在分析与 Skill 的关系…`, loading: false } : m
      ));
      setStreaming(false);
      setStreamStage(null);

      onMemoRefresh();

      if (skillId && savedFiles.length > 0) {
        try {
          const now = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
          const fileListMd = savedFiles.map(f => `- \`${f}\``).join("\n");
          const newEntry = `## ${now} 长文本粘贴\n\n${summary || "用户粘贴了长文本内容"}\n\n存储文件：\n${fileListMd}\n\n---\n`;

          let existing = "";
          try {
            const res = await apiFetch<{ content: string }>(`/skills/${skillId}/files/_memo.md`);
            existing = res.content || "";
          } catch { /* 文件不存在 */ }

          const header = existing ? "" : `# Skill Memo - Ingest Log\n\n`;
          const content = header + newEntry + existing.replace(/^# Skill Memo.*\n\n/, "");

          await apiFetch(`/skills/${skillId}/files/${encodeURIComponent("_memo.md")}`, {
            method: "PUT",
            body: JSON.stringify({ content }),
          });
        } catch { /* memo 写入失败不阻塞 */ }
      }

      if (summary) {
        send(summary);
      }
    } catch {
      setMessages((prev) => prev.map((m, i) =>
        i === msgIdx ? { ...m, text: "长文本分析失败，请重试", loading: false } : m
      ));
    } finally {
      setStreaming(false);
      setStreamStage(null);
    }
  }

  async function send(userText: string) {
    if (!userText.trim() || streaming) return;

    if (userText.length > CONTENT_MAX) {
      if (!skillId) {
        setMessages((prev) => [...prev,
          { role: "user", text: userText.slice(0, 200) + "…" },
          { role: "assistant", text: `文本较长（${userText.length.toLocaleString()} 字符）。请先选中一个 Skill，系统会自动分析并存储为子文件。`, loading: false },
        ]);
        setInput("");
        return;
      }
      return ingestLongText(userText);
    }

    let msgIdx = -1;
    setMessages((prev) => {
      msgIdx = prev.length + 1;
      return [...prev,
        { role: "user", text: userText },
        { role: "assistant", text: "", loading: true },
      ];
    });
    setStreaming(true);
    setInput("");
    setReconciledFacts([]);
    setDirectionShift(null);
    setRepeatBlocked(null);
    setPendingGovernanceActions([]);
    setAuditResult(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const token = getToken();
    let accText = "";

    setStreamStage("connecting");
    const timeout = setTimeout(() => ctrl.abort(), 30_000);

    try {
      const resp = await fetch(`/api/proxy/conversations/${convId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          content: userText,
          selected_skill_id: skillId ?? undefined,
          editor_prompt: currentPrompt || undefined,
          editor_is_dirty: editorIsDirty,
          selected_source_filename: selectedSourceFile || undefined,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        if (resp.status === 401) {
          dispatchAuthExpired();
        }
        let errText = `发送失败 (${resp.status})`;
        if (resp.status === 401) {
          errText = "登录已过期，请重新登录";
        } else if (resp.status === 422) {
          try {
            const errData = await resp.json();
            const detail = errData.detail;
            errText = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg).join("；") : `请求参数错误 (422)`;
          } catch { errText = "请求参数错误 (422)"; }
        }
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: errText, loading: false } : m
        ));
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) {
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: "无法读取响应", loading: false } : m
        ));
        return;
      }
      const decoder = new TextDecoder();
      let buf = "", curEvt = "delta";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { curEvt = line.slice(7).trim(); }
          else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (curEvt === "status" && data.stage) {
                setStreamStage(data.stage as string);
              } else if (curEvt === "studio_summary") {
                setPendingSummary(data as StudioSummary);
              } else if (curEvt === "studio_draft") {
                setPendingDraft(data as StudioDraft);
                onExpandEditor?.();
              } else if (curEvt === "studio_diff") {
                const diff = data as StudioDiff;
                if (diff.ops && diff.ops.length > 0) {
                  const newPrompt = applyOps(currentPrompt, diff.ops);
                  setPendingDraft({ system_prompt: newPrompt, change_note: diff.change_note || "AI 局部修改" });
                } else if (diff.system_prompt?.new) {
                  setPendingDraft({ system_prompt: diff.system_prompt.new, change_note: "AI 建议修改" });
                }
                onExpandEditor?.();
              } else if (curEvt === "studio_tool_suggestion") {
                setPendingToolSuggestion(data as StudioToolSuggestion);
              } else if (curEvt === "studio_file_split") {
                setPendingFileSplit(data as StudioFileSplit);
              } else if (curEvt === "studio_memo_status" || curEvt === "studio_task_focus" || curEvt === "studio_persistent_notices") {
                onMemoRefresh();
              } else if (curEvt === "studio_state_update") {
                setSessionState(data as V2SessionState);
              } else if (curEvt === "studio_reconciled_facts") {
                setReconciledFacts((data as { facts: typeof reconciledFacts }).facts || []);
              } else if (curEvt === "studio_direction_shift") {
                setDirectionShift(data as { from: string; to: string });
              } else if (curEvt === "studio_file_need_status") {
                setFileNeedStatus(data as { status: string; forbidden_countdown: number });
              } else if (curEvt === "studio_repeat_blocked") {
                setRepeatBlocked((data as { reason: string }).reason || null);
              } else if (curEvt === "studio_route") {
                // 旧协议，复用 route_status 逻辑
                const rs = data as StudioRouteInfo & { workflow_mode?: string; initial_phase?: string };
                setRouteInfo(rs);
                const mode = rs.session_mode;
                setStoreSessionMode(mode === "create_new_skill" ? "create" : mode === "optimize_existing_skill" ? "optimize" : mode === "audit_imported_skill" ? "audit" : null);
              } else if (curEvt === "studio_audit") {
                setAuditResult(data as AuditResult);
              } else if (curEvt === "studio_governance_action") {
                setPendingGovernanceActions((prev) => [...prev, data as GovernanceActionCard]);
              } else if (curEvt === "studio_phase_progress") {
                setPhaseProgress((prev) => [...prev, data as PhaseProgress]);
              } else if (curEvt === "governance_card") {
                // 兼容两种格式：
                // 1) 完整 GovernanceCardData（后端已组装好 id/type/actions）
                // 2) 简化格式 {title, description, severity, category, suggested_action}
                const raw = data as Record<string, unknown>;
                if (raw.id && raw.type && raw.actions) {
                  addGovernanceCard(data as GovernanceCardData);
                } else {
                  const card: GovernanceCardData = {
                    id: `gov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: raw.suggested_action === "staged_edit" ? "staged_edit" : "followup_prompt",
                    title: (raw.title as string) || "治理建议",
                    content: { description: raw.description, severity: raw.severity, category: raw.category },
                    status: "pending",
                    actions: raw.suggested_action === "staged_edit"
                      ? [{ label: "查看修改", type: "view_diff" as const }, { label: "采纳", type: "adopt" as const }]
                      : [{ label: "查看", type: "view_diff" as const }, { label: "忽略", type: "reject" as const }],
                  };
                  addGovernanceCard(card);
                }
              } else if (curEvt === "staged_edit_notice") {
                // 兼容两种格式：
                // 1) 完整 StagedEdit（前端 camelCase：id/fileType/filename/diff/changeNote/status）
                // 2) 后端 snake_case：{id, target_type, target_key, summary, risk_level, diff_ops, status}
                const raw = data as Record<string, unknown>;
                let se: StagedEdit;
                if (raw.fileType || raw.diff) {
                  // 已经是前端格式
                  se = {
                    id: (raw.id as string) || `se-${Date.now()}`,
                    fileType: (raw.fileType as string) || "prompt",
                    filename: (raw.filename as string) || "",
                    diff: (raw.diff as DiffOp[]) || [],
                    changeNote: (raw.changeNote as string) || (raw.change_note as string),
                    status: (raw.status as StagedEdit["status"]) || "pending",
                  };
                } else {
                  // 后端 snake_case 格式
                  se = {
                    id: String(raw.id ?? Date.now()),
                    fileType: (raw.target_type as string) || "system_prompt",
                    filename: (raw.target_key as string) || "",
                    diff: ((raw.diff_ops as DiffOp[]) || []).map((op) => ({
                      type: (op as unknown as { op?: string }).op === "replace" ? "replace" : (op as unknown as { op?: string }).op === "insert" ? "insert_after" : "delete",
                      old: op.old,
                      new: op.new || op.content,
                    } as DiffOp)),
                    changeNote: raw.summary as string,
                    status: (raw.status as StagedEdit["status"]) || "pending",
                  };
                }
                addStagedEdit(se);
                onExpandEditor?.();
              } else if (curEvt === "assist_skills_status") {
                // 后端发 string[]（skill name），转为前端需要的 {id, name, status}[]
                const rawSkills = (data as { skills: unknown[] }).skills || [];
                const normalized = rawSkills.map((s, i) =>
                  typeof s === "string" ? { id: i, name: s, status: "active" } : (s as { id: number; name: string; status: string })
                );
                setActiveAssistSkills(normalized);
              } else if (curEvt === "route_status") {
                // 新协议：与 conversations.py 对齐
                const rs = data as StudioRouteInfo & { workflow_mode?: string; initial_phase?: string };
                setRouteInfo(rs);
                const mode = rs.session_mode;
                setStoreSessionMode(mode === "create_new_skill" ? "create" : mode === "optimize_existing_skill" ? "optimize" : mode === "audit_imported_skill" ? "audit" : null);
              } else if (curEvt === "architect_phase_status") {
                setArchitectPhase(data as ArchitectPhaseStatus);
              } else if (curEvt === "architect_question") {
                setArchitectQuestions((prev) => [...prev, data as ArchitectQuestion]);
              } else if (curEvt === "architect_phase_summary") {
                // 阶段总结 → 存为待确认状态，用户确认后再转为 PhaseProgress
                // 兼容后端格式 {phase, outputs: {summary?, deliverables?, ...}, confirmed}
                // 和前端格式 {phase, summary, deliverables, confidence, ready_for_next}
                const raw = data as Record<string, unknown>;
                const outputs = (raw.outputs as Record<string, unknown>) || {};
                const summary: ArchitectPhaseSummary = {
                  phase: (raw.phase as string) || "",
                  summary: (raw.summary as string) || (outputs.summary as string) || "",
                  deliverables: (raw.deliverables as string[]) || (outputs.deliverables as string[]) || Object.keys(outputs).filter((k) => k !== "summary"),
                  confidence: (raw.confidence as number) ?? (outputs.confidence as number) ?? ((raw.confirmed || outputs.confirmed) ? 80 : 50),
                  ready_for_next: (raw.ready_for_next as boolean) ?? (raw.confirmed as boolean) ?? (outputs.ready_for_next as boolean) ?? false,
                };
                setPendingPhaseSummary(summary);
              } else if (curEvt === "architect_structure") {
                // 兼容后端 {type, title, data} 和前端 {type, root, nodes[]}
                const raw = data as Record<string, unknown>;
                let structure: ArchitectStructure;
                if (raw.nodes) {
                  // 已经是前端格式
                  structure = data as ArchitectStructure;
                } else {
                  // 后端格式：data 字段包含实际结构数据
                  const innerData = (raw.data as Record<string, unknown>) || {};
                  const nodes = (innerData.nodes as ArchitectStructure["nodes"]) || [];
                  structure = {
                    type: (raw.type as ArchitectStructure["type"]) || "issue_tree",
                    root: (raw.title as string) || (innerData.root as string) || "",
                    nodes: nodes.length > 0 ? nodes : [{ id: "root", label: (raw.title as string) || "", parent: null, children: [] }],
                  };
                }
                setArchitectStructures((prev) => [...prev, structure]);
              } else if (curEvt === "architect_priority_matrix") {
                // 兼容后端 {items: [{label, priority, reason}]}
                // 和前端 {dimensions: [{name, priority, sensitivity, reason}]}
                const raw = data as Record<string, unknown>;
                let matrix: ArchitectPriorityMatrix;
                if (raw.dimensions) {
                  matrix = data as ArchitectPriorityMatrix;
                } else {
                  const items = (raw.items as { label?: string; name?: string; priority?: string; reason?: string; sensitivity?: string }[]) || [];
                  matrix = {
                    dimensions: items.map((item) => ({
                      name: item.label || item.name || "",
                      priority: (item.priority as "P0" | "P1" | "P2") || "P2",
                      sensitivity: (item.sensitivity as "high" | "medium" | "low") || (item.priority === "P0" ? "high" : item.priority === "P1" ? "medium" : "low"),
                      reason: item.reason || "",
                    })),
                  };
                }
                setArchitectPriorities(matrix);
              } else if (curEvt === "architect_ooda_decision") {
                // 兼容后端 {round, action, reason, rollback_to?}
                // 和前端 {ooda_round, observation, orientation, decision, delta_from_last}
                const raw = data as Record<string, unknown>;
                const od: ArchitectOodaDecision = {
                  ooda_round: (raw.ooda_round as number) ?? (raw.round as number) ?? 1,
                  observation: (raw.observation as string) || (raw.reason as string) || "",
                  orientation: (raw.orientation as string) || ((raw.rollback_to ? `回调至 ${raw.rollback_to}` : (raw.action as string)) || ""),
                  decision: (raw.decision as string) || (raw.action as string) || "",
                  delta_from_last: (raw.delta_from_last as string) || (raw.rollback_to ? `将回调到 ${raw.rollback_to}` : ""),
                };
                setArchitectPhase((prev) => prev ? { ...prev, ooda_round: od.ooda_round, ooda_decision: od.decision } : prev);
                setOodaDecisions((prev) => [...prev, od]);
              } else if (curEvt === "architect_ready_for_draft") {
                // 兼容后端 {summary: {...}, exit_to}
                // 和前端 {key_elements, failure_prevention, draft_approach}
                const raw = data as Record<string, unknown>;
                let ready: ArchitectReadyForDraft;
                if (raw.key_elements) {
                  ready = data as ArchitectReadyForDraft;
                } else {
                  const summary = (raw.summary as Record<string, unknown>) || {};
                  ready = {
                    key_elements: (summary.key_elements as ArchitectReadyForDraft["key_elements"])
                      || Object.entries(summary)
                        .filter(([k]) => k !== "failure_prevention" && k !== "draft_approach")
                        .map(([k, v]) => ({ name: k, priority: "P1", source_phase: String(v) })),
                    failure_prevention: (summary.failure_prevention as string[]) || [],
                    draft_approach: (summary.draft_approach as string) || (raw.exit_to as string) || "generate_draft",
                  };
                }
                setArchitectReady(ready);
              } else if (curEvt === "audit_summary") {
                // 新协议审计事件 — 兼容后端直接发 severity 或 verdict
                const as_ = data as {
                  quality_score?: number; verdict?: string; severity?: AuditResult["severity"];
                  issues?: AuditResult["issues"]; recommended_path?: string; phase_entry?: string;
                  assist_skills_to_enable?: string[];
                };
                const severity: AuditResult["severity"] = as_.severity
                  || (as_.verdict === "poor" ? "high" : as_.verdict === "needs_work" ? "medium" : "low");
                setAuditResult({
                  quality_score: as_.quality_score ?? (severity === "high" ? 25 : severity === "medium" ? 55 : 80),
                  severity,
                  issues: as_.issues || [],
                  recommended_path: (as_.recommended_path === "brainstorming_upgrade" || as_.recommended_path === "major_rewrite") ? "restructure" : "optimize",
                  phase_entry: as_.phase_entry as AuditResult["phase_entry"],
                  assist_skills_to_enable: as_.assist_skills_to_enable,
                });
              } else if (curEvt === "studio_editor_target") {
                const target = data as { file_type?: string; filename?: string };
                if (target.filename) {
                  onEditorTarget(target.file_type || "asset", target.filename);
                }
              } else if (curEvt === "studio_context_rollup") {
                const rollup = data as { task_id?: string; summary?: string };
                if (rollup.summary && skillId) {
                  setMessages((prev) => {
                    if (prev.length <= 2) return prev;
                    const kept = prev.slice(-2);
                    return [
                      { role: "assistant" as const, text: `[${rollup.summary}]` },
                      ...kept,
                    ];
                  });
                  onMemoRefresh();
                }
              } else if (curEvt === "error") {
                const errMsg = data.message || "服务端错误";
                setMessages((prev) => prev.map((m, i) =>
                  i === msgIdx ? { ...m, text: errMsg, loading: false } : m
                ));
                setStreamStage(null);
              } else if (curEvt === "done") {
                setMessages((prev) => prev.map((m, i) =>
                  i === msgIdx ? { ...m, loading: false } : m
                ));
                setStreamStage(null);
              } else if ((curEvt === "delta" || curEvt === "content_block_delta") && data.text) {
                accText += data.text;
                setStreamStage("generating");
                setMessages((prev) => prev.map((m, i) => i === msgIdx ? { ...m, text: accText } : m));
              }
            } catch { /* skip */ }
            curEvt = "delta";
          }
        }
      }
      setMessages((prev) => prev.map((m, i) => i === msgIdx ? { ...m, loading: false } : m));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        if (accText) {
          setMessages((prev) => prev.map((m, i) =>
            i === msgIdx ? { ...m, text: accText + "\n\n[连接中断，以上为已接收内容]", loading: false } : m
          ));
        } else {
          setMessages((prev) => prev.map((m, i) =>
            i === msgIdx ? { ...m, text: "连接中断，请重试", loading: false } : m
          ));
        }
      } else if (accText) {
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: accText, loading: false } : m
        ));
      } else {
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: "请求超时或已取消", loading: false } : m
        ));
      }
    } finally {
      clearTimeout(timeout);
      setStreaming(false);
      setStreamStage(null);
    }
  }

  function handleApplyDraft() {
    if (!pendingDraft) return;
    onApplyDraft(pendingDraft);
    setPendingDraft(null);
  }

  function handleConfirmSummary() {
    if (!pendingSummary) return;
    setPendingSummary(null);
    const action = pendingSummary.next_action ?? "generate_draft";
    const msg =
      action === "generate_outline"
        ? "好的，请根据以上摘要生成 Skill 的完整目录骨架"
        : action === "generate_section"
        ? "好的，请根据以上摘要扩充对应章节内容"
        : "好的，请根据以上摘要生成完整的 Skill 草稿";
    send(msg);
  }

  function handleConfirmEditedSummary(editedItems: { label: string; value: string }[]) {
    setPendingSummary(null);
    const edits = editedItems.map((item) => `${item.label}=${item.value}`).join("，");
    send(`按以下修正后的理解生成草稿：${edits}`);
  }

  async function handleConfirmSplit() {
    if (!pendingFileSplit || !skillId) return;
    setSplitting(true);
    try {
      for (const f of pendingFileSplit.files) {
        await apiFetch(`/skills/${skillId}/files/${encodeURIComponent(f.filename)}`, {
          method: "PUT",
          body: JSON.stringify({ content: f.content }),
        });
      }
      onApplyDraft({
        system_prompt: pendingFileSplit.main_prompt_after_split,
        change_note: pendingFileSplit.change_note || "拆分文件",
      });
      onFileSplitDone();
    } catch (err) {
      console.error("File split failed", err);
    } finally {
      setSplitting(false);
      setPendingFileSplit(null);
    }
  }

  const isFixingMode = !!(memo && memo.lifecycle_stage === "fixing" && memo.latest_test?.status === "failed");

  return (
    <div className="flex flex-1 min-w-0 border-l-2 border-[#1A202C] bg-white">
      {/* ═══ 左侧：聊天主区 ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-3 py-2.5 border-b-2 border-[#1A202C] flex items-center gap-2 flex-shrink-0 bg-[#EBF4F7]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">Studio Chat</span>
          <span className="flex-1" />
          {messages.length > 0 && (
            <button
              onClick={() => {
                abortRef.current?.abort();
                setMessages([]);
                setStreaming(false);
                setPendingDraft(null);
                setPendingFileSplit(null);
                setArchitectPhase(null);
                setArchitectQuestions([]);
                setArchitectStructures([]);
                setArchitectPriorities(null);
                setOodaDecisions([]);
                setArchitectReady(null);
                setPendingPhaseSummary(null);
                setConfirmedPhases([]);
                setAnsweredQuestionIdx(-1);
                setPhaseProgress([]);
              }}
              className="text-[8px] font-bold uppercase text-gray-400 hover:text-red-400 transition-colors"
            >
              清除
            </button>
          )}
          <button
            onClick={onNewSession}
            className="text-[8px] font-bold uppercase text-gray-400 hover:text-[#00A3C4] transition-colors"
          >
            新建会话
          </button>
          {onExpandEditor && !editorExpanded && (
            <button
              onClick={onExpandEditor}
              className="text-[8px] font-bold uppercase text-gray-400 hover:text-[#00A3C4] transition-colors"
            >
              编辑区
            </button>
          )}
          {hasDrawerContent && !drawerOpen && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="relative text-[8px] font-bold uppercase text-amber-600 hover:text-amber-800 transition-colors flex items-center gap-1"
            >
              <ChevronDown size={10} />
              {isFixingMode ? "整改" : "面板"}
              {isFixingMode && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          )}
        </div>

        {/* V2 理解面板 */}
        {sessionState && sessionState.total_rounds > 0 && (
          <div className="px-3 py-1 bg-[#F0F4F8] border-b border-gray-200 flex-shrink-0 flex items-center gap-2 text-[8px] font-mono text-gray-500">
            <span className="font-bold text-[#00A3C4] uppercase">{sessionState.scenario !== "unknown" ? sessionState.scenario.replace(/_/g, " ") : "识别中"}</span>
            <span className="text-gray-300">|</span>
            <span className="font-bold uppercase">{sessionState.mode}</span>
            <span className="text-gray-300">|</span>
            <span className="truncate flex-1">{sessionState.goal}</span>
            {(sessionState.file_status === "not_needed" || sessionState.file_status === "forbidden") && (
              <span className="text-amber-500 font-bold">{sessionState.file_status === "forbidden" ? "禁文件" : "无文件"}</span>
            )}
            <span className="text-gray-400">R{sessionState.total_rounds} S{sessionState.readiness}/5</span>
          </div>
        )}

        {/* 路由状态面板 */}
        <RouteStatusBar route={routeInfo} phaseProgress={phaseProgress} architectPhase={architectPhase} />
        <AssistSkillsBar skills={storeAssistSkills} />

        {/* 本轮已采纳标签 */}
        {reconciledFacts.length > 0 && (
          <div className="px-3 py-1 bg-[#F0FFF9] border-b border-[#CCFFF0] flex gap-2 flex-wrap flex-shrink-0">
            {reconciledFacts.map((f, i) => (
              <span key={i} className={`text-[7px] px-1.5 py-0.5 font-mono ${
                f.type === "correction" ? "bg-amber-100 text-amber-700" :
                f.type === "scenario_shift" ? "bg-purple-100 text-purple-700" :
                f.type === "file_rejection" ? "bg-red-100 text-red-600" :
                f.type === "execution_request" ? "bg-blue-100 text-blue-700" :
                f.type === "constraint" ? "bg-orange-100 text-orange-700" :
                "bg-green-100 text-green-700"
              }`}>
                {f.type === "correction" ? "已纠偏" :
                 f.type === "scenario_shift" ? `切换→${f.text}` :
                 f.type === "file_rejection" ? "已禁文件" :
                 f.type === "execution_request" ? "直接出草稿" :
                 f.type === "constraint" ? `约束：${f.text.slice(0, 15)}` :
                 `已采纳：${f.text.slice(0, 15)}`}
              </span>
            ))}
          </div>
        )}

        {backendFailed && (
          <div className="px-3 py-1 bg-amber-50 border-b border-amber-200 text-[9px] text-amber-700 font-mono flex-shrink-0">
            正在显示本地缓存，服务器历史加载失败
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && !streaming && !memo && (
            <div className="flex items-center justify-center h-full">
              <p className="text-[9px] text-gray-400 font-bold uppercase text-center">
                描述你想创建的 Skill，我会快速给出第一版草稿<br />
                <span className="text-gray-300 normal-case font-normal">如果你已有参考文件，可以在左侧选中后告诉我</span>
              </p>
            </div>
          )}
          <GovernanceTimeline
            messages={messages}
            streaming={streaming}
            streamStage={streamStage}
            governanceCards={storeGovernanceCards}
            auditResult={auditResult}
            pendingGovernanceActions={pendingGovernanceActions}
            phaseProgress={phaseProgress}
            architectPhase={architectPhase}
            architectQuestions={architectQuestions}
            answeredQuestionIdx={answeredQuestionIdx}
            pendingPhaseSummary={pendingPhaseSummary}
            confirmedPhases={confirmedPhases}
            architectStructures={architectStructures}
            architectPriorities={architectPriorities ? [architectPriorities] : []}
            onArchitectAnswer={(answer) => {
              setAnsweredQuestionIdx(architectQuestions.length - 1);
              send(answer);
            }}
            onArchitectCustom={(text) => {
              setAnsweredQuestionIdx(architectQuestions.length - 1);
              setInput(text);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            onArchitectConfirm={() => {
              if (!pendingPhaseSummary) return;
              const s = pendingPhaseSummary;
              // Mark phase as confirmed
              setConfirmedPhases((prev) => [...prev, s.phase]);
              // Convert to PhaseProgress
              const phaseMap: Record<string, "phase1" | "phase2" | "phase3"> = {
                phase_1_why: "phase1",
                phase_2_what: "phase2",
                phase_3_how: "phase3",
              };
              const completedPhase = phaseMap[s.phase] || "phase1";
              setPhaseProgress((prev) => [
                ...prev,
                {
                  completed_phase: completedPhase,
                  phase_label: s.summary.slice(0, 30),
                  deliverables: s.deliverables,
                  next_phase: null,
                  next_label: null,
                },
              ]);
              // Clear pending state for clean phase transition
              setPendingPhaseSummary(null);
              setAnsweredQuestionIdx(-1);
              setArchitectQuestions([]);
              setArchitectStructures([]);
              setArchitectPriorities(null);
              // Send confirmation message
              send("确认，进入下一阶段");
            }}
            onArchitectRevise={(note) => {
              setInput(note);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            oodaDecisions={oodaDecisions}
            architectReady={architectReady}
            onOodaContinue={() => {
              // Clear structures/priorities from current phase as OODA will re-enter
              setArchitectStructures([]);
              setArchitectPriorities(null);
              setPendingPhaseSummary(null);
              send("继续推进");
            }}
            onGenerateDraft={() => {
              // Transition: architect mode → draft/governance mode
              // Clear all architect state so cards disappear smoothly
              setArchitectPhase(null);
              setArchitectQuestions([]);
              setArchitectStructures([]);
              setArchitectPriorities(null);
              setOodaDecisions([]);
              setPendingPhaseSummary(null);
              setConfirmedPhases([]);
              setAnsweredQuestionIdx(-1);
              // Keep architectReady briefly for the transition message
              setArchitectReady(null);
              // Trigger draft generation
              send("生成 Skill 草稿");
            }}
            onGovernanceAction={(card, action) => {
              const stagedEditId = typeof card.content.staged_edit_id === "string" ? card.content.staged_edit_id : null;
              if (action.type === "adopt") {
                updateCardStatus(card.id, "adopted");
                if (stagedEditId) handleAdoptStagedEdit(stagedEditId);
              } else if (action.type === "reject") {
                updateCardStatus(card.id, "rejected");
                if (stagedEditId) handleRejectStagedEdit(stagedEditId);
              } else if (action.type === "view_diff") {
                onExpandEditor?.();
              } else if (action.type === "refine") {
                setInput(String(card.content.summary || card.title));
                setTimeout(() => inputRef.current?.focus(), 50);
              }
            }}
            onDismissGovernance={(card) => updateCardStatus(card.id, "dismissed")}
            onDismissAudit={() => setAuditResult(null)}
            onAdoptGovernanceAction={async (a) => {
              if (a.staged_edit?.ops && a.staged_edit.ops.length > 0) {
                const newPrompt = applyOps(currentPrompt, a.staged_edit.ops as DiffOp[]);
                // Try API call if skillId available, otherwise apply locally
                if (skillId) {
                  try {
                    await apiFetch(`/skills/${skillId}/studio/staged-edits/${a.card_id}/adopt`, { method: "POST" });
                  } catch { /* API may not exist yet, fall through to local apply */ }
                }
                onApplyDraft({ system_prompt: newPrompt, change_note: a.title });
              }
              setPendingGovernanceActions((prev) => prev.filter((g) => g.card_id !== a.card_id));
            }}
            onQuickAction={(action) => {
              if (action.focusInput) {
                setInput(action.msg);
                setTimeout(() => inputRef.current?.focus(), 50);
              } else {
                send(action.msg);
              }
            }}
          />
        </div>

        {compressing && (
          <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-200 flex-shrink-0">
            <span className="text-[8px] font-bold uppercase tracking-widest text-amber-600 animate-pulse">
              正在压缩历史消息...
            </span>
          </div>
        )}

        {/* Input */}
        <div className="border-t-2 border-[#1A202C] p-3 flex-shrink-0 min-h-[60px] relative z-10">
          <div className="flex gap-2 relative">
            {hashQuery !== null && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border-2 border-[#1A202C] shadow-lg z-50 max-h-48 overflow-y-auto">
                {filteredSkills.length === 0 ? (
                  <div className="px-3 py-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest">无匹配 Skill</div>
                ) : (
                  filteredSkills.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectHashSkill(s); }}
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 flex flex-col gap-0.5 transition-colors ${
                        i === hashActiveIdx ? "bg-[#1A202C] text-white" : "hover:bg-gray-50"
                      }`}
                    >
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${i === hashActiveIdx ? "text-white" : "text-[#1A202C]"}`}>
                        <span className="text-[#00D1FF]">#</span>{s.name}
                      </span>
                      {s.description && (
                        <span className={`text-[8px] line-clamp-1 ${i === hashActiveIdx ? "text-gray-300" : "text-gray-400"}`}>{s.description}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
              placeholder="描述需求、说「帮我测试」、# 引用 Skill，Ctrl+Enter 发送..."
              disabled={streaming}
              rows={2}
              className="flex-1 border-2 border-[#1A202C] px-2 py-1.5 text-[9px] font-mono focus:outline-none focus:border-[#00D1FF] disabled:opacity-50 resize-none"
              onKeyDown={(e) => {
                if (hashQuery !== null && filteredSkills.length > 0) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setHashActiveIdx((i) => (i + 1) % filteredSkills.length); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setHashActiveIdx((i) => (i - 1 + filteredSkills.length) % filteredSkills.length); return; }
                  if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); selectHashSkill(filteredSkills[hashActiveIdx]); return; }
                  if (e.key === "Escape") { setHashQuery(null); return; }
                }
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <PixelButton
              size="sm"
              onClick={() => send(input)}
              disabled={streaming || !input.trim()}
            >
              {streaming ? "..." : "发送"}
            </PixelButton>
          </div>
        </div>
      </div>

      {/* ═══ 右侧：治理抽屉 ═══ */}
      {drawerOpen && hasDrawerContent && (
        <div className={`${drawerWidthClass} flex-shrink-0 border-l border-gray-200 bg-[#FAFBFC] flex flex-col overflow-hidden transition-all`}>
          <div className="px-3 py-2 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-[#F0F4F8]">
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">
              {isFixingMode ? "整改任务" : "治理面板"}
            </span>
            <span className="flex-1" />
            <div className="flex gap-0.5">
              {(["narrow", "medium", "wide"] as const).map((w) => (
                <button
                  key={w}
                  onClick={() => setDrawerWidth(w)}
                  className={`w-3 h-3 border transition-colors ${drawerWidth === w ? "bg-[#00A3C4] border-[#00A3C4]" : "bg-white border-gray-300 hover:border-gray-400"}`}
                  title={w === "narrow" ? "窄" : w === "medium" ? "中" : "宽"}
                />
              ))}
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="收起面板"
            >
              <X size={12} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {memo && (
              <SkillMemoPanel
                memo={memo}
                onStartTask={handleMemoStartTask}
                onDirectTest={handleMemoDirectTest}
                onStartFixTask={(task) => {
                  if (task.target_kind === "skill_prompt" || task.target_ref === "SKILL.md") {
                    onEditorTarget("prompt", "SKILL.md");
                  }
                  const fixMessage = `请帮我修复以下测试问题：\n${task.title}\n${task.description || ""}\n验收标准：${task.acceptance_rule_text || ""}`;
                  send(fixMessage);
                }}
                onTargetedRetest={async (taskId) => {
                  const allTasks = ((memo.memo as Record<string, unknown>)?.tasks as Array<{
                    id: string;
                    problem_refs?: string[];
                    source_report_id?: number;
                  }>) || [];
                  const task = allTasks.find(t => t.id === taskId);
                  if (!task?.problem_refs?.length || !task.source_report_id) {
                    handleMemoDirectTest();
                    return;
                  }
                  try {
                    await apiFetch(
                      `/sandbox/interactive/by-report/${task.source_report_id}/targeted-rerun`,
                      { method: "POST", body: JSON.stringify({ issue_ids: task.problem_refs }) }
                    );
                    onMemoRefresh();
                  } catch (err) {
                    const errMsg = err instanceof Error ? err.message : "未知错误";
                    const fallback = confirm(`局部重测失败：${errMsg}\n\n是否改为打开完整测试？`);
                    if (fallback) {
                      handleMemoDirectTest();
                    }
                  }
                }}
                onViewReport={onViewReport}
                sandboxReportId={sandboxReportId}
              />
            )}

            {isFixingMode && memo?.latest_test && (
              <div className="mx-3 my-2 px-3 py-2 bg-amber-50 border-2 border-amber-400">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700">
                    整改模式
                  </span>
                  <span className="text-[8px] text-amber-600 flex-1 truncate">
                    {memo.latest_test.summary}
                  </span>
                </div>
                {memo.current_task && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[7px] font-bold text-amber-500 border border-amber-400 px-1.5 py-0.5 rounded">
                      当前: {memo.current_task.title.slice(0, 40)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {pendingSummary && (
              <div className="mx-3 my-2">
                <SummaryCard
                  summary={pendingSummary}
                  onConfirm={handleConfirmSummary}
                  onConfirmEdited={handleConfirmEditedSummary}
                  onDiscard={() => setPendingSummary(null)}
                />
              </div>
            )}

            {pendingDraft && (
              <div className="mx-3 my-2">
                <DraftCard
                  draft={pendingDraft}
                  currentPrompt={currentPrompt}
                  onApply={handleApplyDraft}
                  onDiscard={() => setPendingDraft(null)}
                />
              </div>
            )}

            {pendingToolSuggestion && pendingToolSuggestion.suggestions.length > 0 && (
              <div className="mx-3 my-2">
                <ToolSuggestionCard
                  suggestion={pendingToolSuggestion}
                  skillId={skillId}
                  onBound={() => { setPendingToolSuggestion(null); onToolBound(); }}
                  onDevStudio={(desc) => { setPendingToolSuggestion(null); onDevStudio(desc); }}
                />
              </div>
            )}

            {pendingFileSplit && pendingFileSplit.files.length > 0 && (
              <div className="mx-3 my-2">
                <FileSplitCard
                  split={pendingFileSplit}
                  currentPrompt={currentPrompt}
                  skillId={skillId}
                  splitting={splitting}
                  onConfirm={handleConfirmSplit}
                  onDiscard={() => setPendingFileSplit(null)}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
