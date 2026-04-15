"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelRightOpen, PanelRightClose, Pin } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { SkillDetail, SkillMemo, SandboxReport } from "@/lib/types";
import type { Suggestion } from "@/components/skill/CommentsPanel";
import { ImportSkillModal } from "@/components/skill/ImportSkillModal";
import { SandboxTestModal } from "@/components/skill/SandboxTestModal";
import { isEditableSkillStatus, isPublishedSkillStatus } from "@/lib/skill-status";
import { useStudioStore } from "@/lib/studio-store";

import type { ChatMessage, SelectedFile, StudioDraft, StagedEdit, GovernanceCardData } from "./types";
import { SkillList, SkillIcon } from "./SkillList";
import { PromptEditor } from "./PromptEditor";
import { StudioChat } from "./StudioChat";
import { AssetFileEditor } from "./AssetFileEditor";
import { normalizeStagedEditPayload } from "./utils";
import { normalizeWorkflowCardPayload, parseWorkflowStatePayload } from "./workflow-adapter";
import type { WorkflowStateData } from "./workflow-protocol";

// ─── Main page ────────────────────────────────────────────────────────────────

export function SkillStudio({
  convId,
  initialSkillId,
  fromSandbox,
  sandboxReportId,
  sandboxSessionId,
}: {
  convId: number;
  initialSkillId?: number;
  fromSandbox?: boolean;
  sandboxReportId?: string;
  sandboxSessionId?: string;
}) {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [selectedFile, _setSelectedFile] = useState<SelectedFile | null>(() => {
    // URL 的 initialSkillId 是权威来源，优先于 localStorage
    if (initialSkillId) return { skillId: initialSkillId, fileType: "prompt" as const };
    try {
      const saved = localStorage.getItem("skill_studio_selected");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const setSelectedFile = useCallback((f: SelectedFile | null) => {
    _setSelectedFile(f);
    try {
      if (f) localStorage.setItem("skill_studio_selected", JSON.stringify(f));
      else localStorage.removeItem("skill_studio_selected");
    } catch { /* ignore */ }
  }, []);
  const [isNew, setIsNew] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [skillListCollapsed, setSkillListCollapsed] = useState(false);
  const [showSandbox, setShowSandbox] = useState<number | null>(null);
  const [memo, setMemo] = useState<SkillMemo | null>(null);
  const [sandboxEntryHandled, setSandboxEntryHandled] = useState(false);
  const [memoSyncError, setMemoSyncError] = useState<string | null>(null);
  const [retryingMemoSync, setRetryingMemoSync] = useState(false);
  const [activeSandboxReport, setActiveSandboxReport] = useState<SandboxReport | null>(null);
  const [sandboxRemediationSummary, setSandboxRemediationSummary] = useState<{ cards: number; stagedEdits: number } | null>(null);
  const [sandboxRemediationLoading, setSandboxRemediationLoading] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");  // last persisted version for dirty tracking
  const [externalName, setExternalName] = useState<string | null>(null);
  const [externalDescription, setExternalDescription] = useState<string | null>(null);
  const [pendingDiffBase, setPendingDiffBase] = useState<string | null>(null);
  const editorSaveRef = useRef<(() => void) | null>(null);
  const clearChatRef = useRef<(() => void) | null>(null);
  const setInputRef = useRef<((text: string) => void) | null>(null);

  const editorIsDirty = prompt !== savedPrompt && prompt.trim().length > 0;

  // ── Editor visibility from store ──
  const editorVisibility = useStudioStore((s) => s.editorVisibility);
  const setEditorVisibility = useStudioStore((s) => s.setEditorVisibility);
  const editorManuallyCollapsed = useStudioStore((s) => s.editorManuallyCollapsed);
  const setEditorManuallyCollapsed = useStudioStore((s) => s.setEditorManuallyCollapsed);
  const syncGovernanceCards = useStudioStore((s) => s.syncGovernanceCards);
  const syncStagedEdits = useStudioStore((s) => s.syncStagedEdits);
  const setStoreMemo = useStudioStore((s) => s.setMemo);
  const setWorkflowState = useStudioStore((s) => s.setWorkflowState);
  const resetWorkflowArtifacts = useStudioStore((s) => s.resetWorkflowArtifacts);
  const editorExpanded = editorVisibility !== "collapsed";
  const hydratedRecoveryRef = useRef<string | null>(null);

  // Auto-expand editor when selecting a file to edit
  const prevSelectedFileRef = useRef(selectedFile);
  useEffect(() => {
    if (selectedFile && selectedFile !== prevSelectedFileRef.current) {
      if (editorVisibility === "collapsed" && !editorManuallyCollapsed) {
        setEditorVisibility("auto_expanded");
      }
    }
    prevSelectedFileRef.current = selectedFile;
  }, [selectedFile, editorVisibility, editorManuallyCollapsed, setEditorVisibility]);

  const router = useRouter();

  // Skill 切换时做页面级路由跳转：resolve 该 skill 的独立 conversation → router.replace
  const navigateToSkillConv = useCallback(async (skillId: number) => {
    try {
      const entry = await apiFetch<{ conversation_id: number }>(
        `/conversations/studio-entry?type=skill_studio&skill_id=${skillId}`
      );
      if (entry.conversation_id !== convId) {
        router.replace(`/chat/${entry.conversation_id}?ws=skill_studio&skill_id=${skillId}`);
      }
    } catch { /* resolve 失败则留在当前 conversation */ }
  }, [convId, router]);

  // 选择新 skill 时触发路由跳转
  useEffect(() => {
    const skillId = selectedFile?.skillId;
    if (skillId && skillId !== initialSkillId) {
      navigateToSkillConv(skillId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.skillId]);

  // URL skill_id 变化时（路由跳转但组件未重新挂载），强制同步 selectedFile
  useEffect(() => {
    if (initialSkillId && selectedFile?.skillId !== initialSkillId) {
      _setSelectedFile({ skillId: initialSkillId, fileType: "prompt" });
      // 同步写入 localStorage
      try { localStorage.setItem("skill_studio_selected", JSON.stringify({ skillId: initialSkillId, fileType: "prompt" })); } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSkillId]);

  const selectedSkill = selectedFile
    ? (skills.find((s) => s.id === selectedFile.skillId) ?? null)
    : null;
  const sandboxVersionMismatch = Boolean(
    fromSandbox &&
    activeSandboxReport &&
    selectedSkill &&
    activeSandboxReport.target_version != null &&
    selectedSkill.current_version !== activeSandboxReport.target_version,
  );
  const sandboxVersionMismatchMessage = sandboxVersionMismatch
    ? `当前 Skill 已是 v${selectedSkill?.current_version}，但整改来源报告基于 v${activeSandboxReport?.target_version}。如果要继续提交审批，请先重新运行质量检测生成新报告。`
    : null;

  // ── Memo: fetch when selected skill changes ──
  const fetchMemo = useCallback((skillId: number) => {
    apiFetch<SkillMemo>(`/skills/${skillId}/memo`)
      .then((data) => {
        // Backend returns { skill_id, memo: null } when no memo exists
        if (data && data.lifecycle_stage) {
          setMemo(data);
          setStoreMemo(data);
          const recovery = data.workflow_recovery;
          const recoveredWorkflowState = recovery?.workflow_state
            ? parseWorkflowStatePayload(recovery.workflow_state as Record<string, unknown>)
            : null;
          setWorkflowState(recoveredWorkflowState);
          const recoverySignature = `${skillId}:${recovery?.updated_at || "none"}`;
          if (hydratedRecoveryRef.current !== recoverySignature) {
            const recoveryCards = Array.isArray(recovery?.cards) ? recovery.cards : [];
            const recoveryEdits = Array.isArray(recovery?.staged_edits) ? recovery.staged_edits : [];
            const cards = recoveryCards.map((card) => normalizeWorkflowCardPayload(card, "memo-recovery"));
            const edits = recoveryEdits.map((edit) => normalizeStagedEditPayload(edit, "memo-recovery"));
            syncGovernanceCards("memo-recovery", cards);
            syncStagedEdits("memo-recovery", edits);
            hydratedRecoveryRef.current = recoverySignature;
            if (cards.length > 0 || edits.some((edit) => edit.status === "pending")) {
              setEditorManuallyCollapsed(false);
              setEditorVisibility("auto_expanded");
            }
          }
        } else {
          setMemo(null);
          setStoreMemo(null);
          setWorkflowState(null);
          syncGovernanceCards("memo-recovery", []);
          syncStagedEdits("memo-recovery", []);
          hydratedRecoveryRef.current = skillId ? `${skillId}:none` : null;
        }
      })
      .catch(() => {
        setMemo(null);
        setStoreMemo(null);
        setWorkflowState(null);
        syncGovernanceCards("memo-recovery", []);
        syncStagedEdits("memo-recovery", []);
        hydratedRecoveryRef.current = skillId ? `${skillId}:none` : null;
      });
  }, [setStoreMemo, setWorkflowState, setEditorManuallyCollapsed, setEditorVisibility, syncGovernanceCards, syncStagedEdits]);

  useEffect(() => {
    const skillId = selectedFile?.skillId;
    if (skillId) {
      resetWorkflowArtifacts();
      hydratedRecoveryRef.current = null;
      fetchMemo(skillId);
    }
    return () => {
      setMemo(null);
      setStoreMemo(null);
    };
  }, [selectedFile?.skillId, fetchMemo, resetWorkflowArtifacts, setStoreMemo]);

  // ── Sandbox report 入口：首次进入时刷新 memo + 拉取报告，绑定整改上下文 ──
  useEffect(() => {
    if (!fromSandbox || sandboxEntryHandled || !initialSkillId) return;
    setSandboxEntryHandled(true);
    setMemoSyncError(null);
    let cancelled = false;
    (async () => {
      try {
        const [memoData, reportData] = await Promise.all([
          apiFetch<SkillMemo>(`/skills/${initialSkillId}/memo`),
          (sandboxSessionId
            ? apiFetch<SandboxReport>(`/sandbox/interactive/${sandboxSessionId}/report`).catch(() => null)
            : Promise.resolve(null)),
        ]);
        if (cancelled) return;

        const reportIdForRemediation = reportData?.report_id ?? (sandboxReportId ? Number(sandboxReportId) : NaN);
        if (reportData) {
          setActiveSandboxReport(reportData);
        }
        if (Number.isFinite(reportIdForRemediation) && reportIdForRemediation > 0) {
          try {
            if (!cancelled) setSandboxRemediationLoading(true);
            const remediation = await apiFetch<{
              workflow_state?: WorkflowStateData;
              cards: GovernanceCardData[];
              staged_edits: Record<string, unknown>[];
            }>(
              `/sandbox/interactive/by-report/${reportIdForRemediation}/remediation-actions`,
              { method: "POST" }
            );
            if (!cancelled) {
              const workflowState = remediation.workflow_state
                ? parseWorkflowStatePayload(remediation.workflow_state as Record<string, unknown>)
                : null;
              if (workflowState) {
                setWorkflowState(workflowState);
              }
              const source = `sandbox-report:${reportIdForRemediation}`;
              syncGovernanceCards(source, remediation.cards || []);
              syncStagedEdits(source, (remediation.staged_edits || []).map(normalizeStagedEdit));
              setSandboxRemediationSummary({
                cards: remediation.cards?.length || 0,
                stagedEdits: remediation.staged_edits?.length || 0,
              });
              if ((remediation.cards?.length || 0) > 0 || (remediation.staged_edits?.length || 0) > 0) {
                setEditorManuallyCollapsed(false);
                setEditorVisibility("auto_expanded");
                const firstSourceFileEdit = (remediation.staged_edits || []).find((edit) =>
                  edit.target_type === "source_file" && typeof edit.target_key === "string" && edit.target_key
                );
                if (firstSourceFileEdit?.target_key) {
                  setSelectedFile({ skillId: initialSkillId, fileType: "asset", filename: String(firstSourceFileEdit.target_key) });
                }
              }
            }
          } catch {
            // best effort: remediation actions might not be available for older backend
          } finally {
            if (!cancelled) setSandboxRemediationLoading(false);
          }
        }

        if (memoData && memoData.lifecycle_stage) {
          setMemo(memoData);
          setStoreMemo(memoData);
          const workflowState = memoData.workflow_recovery?.workflow_state
            ? parseWorkflowStatePayload(memoData.workflow_recovery.workflow_state as Record<string, unknown>)
            : null;
          setWorkflowState(workflowState);
          if (memoData.lifecycle_stage !== "fixing" && (!memoData.latest_test || memoData.latest_test.status !== "failed")) {
            setMemoSyncError("整改计划未导入 — Memo 中未检测到 fixing 状态");
          }
        } else {
          setMemoSyncError("整改计划未导入 — Memo 不存在");
        }
      } catch {
        if (!cancelled) setMemoSyncError("整改任务尚未同步到 Memo");
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromSandbox, initialSkillId, sandboxReportId]);

  const handleRetryMemoSync = async () => {
    if (!sandboxSessionId || retryingMemoSync) return;
    setRetryingMemoSync(true);
    try {
      await apiFetch(`/sandbox/interactive/${sandboxSessionId}/retry-from-step`, {
        method: "POST",
        body: JSON.stringify({ step: "memo_sync" }),
      });
      setMemoSyncError(null);
      if (initialSkillId) fetchMemo(initialSkillId);
    } catch (err) {
      setMemoSyncError(err instanceof Error ? err.message : "重试 Memo 同步失败");
    } finally {
      setRetryingMemoSync(false);
    }
  };

  const handleMemoRefresh = () => {
    if (selectedFile?.skillId) fetchMemo(selectedFile.skillId);
  };

  // ── Memo: complete-from-save after file save ──
  async function handleFileSaved(filename: string, contentSize: number) {
    if (!selectedFile?.skillId || !memo?.current_task) return;
    try {
      const result = await apiFetch<{ ok: boolean; task_completed?: boolean }>(`/skills/${selectedFile.skillId}/memo/tasks/${memo.current_task.id}/complete-from-save`, {
        method: "POST",
        body: JSON.stringify({
          filename,
          file_type: filename === "SKILL.md" ? "prompt" : "asset",
          content_size: contentSize,
        }),
      });
      if (result.ok) handleMemoRefresh();
    } catch { /* ignore — memo may not exist for this skill */ }
  }

  // ── Memo: editor target switching ──
  function handleEditorTarget(fileType: string, filename: string) {
    if (!selectedFile?.skillId) return;
    if (fileType === "prompt" || filename === "SKILL.md") {
      setSelectedFile({ skillId: selectedFile.skillId, fileType: "prompt" });
    } else {
      setSelectedFile({ skillId: selectedFile.skillId, fileType: "asset", filename });
    }
  }

  const fetchSkills = useCallback(() => {
    setSkillsLoading(true);
    apiFetch<SkillDetail[]>("/skills?mine=true")
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]))
      .finally(() => setSkillsLoading(false));
  }, []);

  const [skillRefreshCounter, setSkillRefreshCounter] = useState(0);

  async function refreshSkill(skillId: number) {
    try {
      const updated = await apiFetch<SkillDetail>(`/skills/${skillId}`);
      setSkills((prev) => prev.map((s) => s.id === skillId ? { ...s, ...updated } : s));
      setSkillRefreshCounter((c) => c + 1);
    } catch { /* ignore */ }
  }

  const [globalSkills, setGlobalSkills] = useState<SkillDetail[]>([]);
  useEffect(() => {
    apiFetch<SkillDetail[]>("/skills")
      .then((data) => setGlobalSkills(Array.isArray(data) ? data.filter((s) => isPublishedSkillStatus(s.status)) : []))
      .catch(() => {});
  }, []);

  const searchableSkills = (() => {
    const seen = new Set<number>();
    return [
      ...skills.filter((s) => isEditableSkillStatus(s.status) || isPublishedSkillStatus(s.status)),
      ...globalSkills,
    ].filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
  })();

  // 初始化时同步 workspace 中未注册的 skill 文件到 DB，再加载列表
  useEffect(() => {
    apiFetch("/dev-studio/sync-skills-from-workspace", { method: "POST" })
      .catch(() => {})
      .finally(() => fetchSkills());
  }, [fetchSkills]);

  function handleNew() {
    setSelectedFile(null);
    setIsNew(true);
    setPrompt("");
    setSavedPrompt("");
  }

  async function handleNewFromList(name: string) {
    const created = await apiFetch<SkillDetail>("/skills", {
      method: "POST",
      body: JSON.stringify({ name, description: "", system_prompt: "", mode: "hybrid", variables: [], auto_inject: true }),
    });
    fetchSkills();
    setSelectedFile({ skillId: created.id, fileType: "prompt" });
    setIsNew(false);
    setPrompt("");
    setSavedPrompt("");
  }

  async function handleSaved(skill: SkillDetail) {
    setSelectedFile({ skillId: skill.id, fileType: "prompt" });
    setIsNew(false);
    setSavedPrompt(prompt);
    fetchSkills();

    // 将本轮 chat 摘要写入 skill 的 _memo.md 附属文件
    const chatKey = `studio_msgs_${convId}`;
    try {
      let chatMsgs: ChatMessage[] = [];
      try {
        const dbMsgs = await apiFetch<{ role: string; content: string; metadata?: Record<string, unknown> }[]>(
          `/conversations/${convId}/messages`
        );
        chatMsgs = dbMsgs.map((m) => ({ role: m.role as "user" | "assistant", text: m.content, loading: false }));
      } catch {
        const raw = localStorage.getItem(chatKey);
        chatMsgs = raw ? JSON.parse(raw) : [];
      }
      if (chatMsgs.length > 0) {
        // 取最近 10 条消息作为摘要
        const recent = chatMsgs.slice(-10);
        const summary = recent.map((m) => {
          const prefix = m.role === "user" ? "👤" : "🤖";
          const text = m.text.length > 200 ? m.text.slice(0, 200) + "..." : m.text;
          return `${prefix} ${text}`;
        }).join("\n\n");

        const now = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        const newEntry = `## ${now} 改动记录\n\n${summary}\n\n---\n`;

        // 读取已有 memo 内容并追加
        let existing = "";
        try {
          const res = await apiFetch<{ content: string }>(`/skills/${skill.id}/files/_memo.md`);
          existing = res.content || "";
        } catch { /* 文件不存在，忽略 */ }

        const header = existing ? "" : `# Skill Memo - ${skill.name}\n\n`;
        const content = header + newEntry + existing.replace(/^# Skill Memo.*\n\n/, "");

        await apiFetch(`/skills/${skill.id}/files/${encodeURIComponent("_memo.md")}`, {
          method: "PUT",
          body: JSON.stringify({ content }),
        });

        // 归档后清空本轮 chat
        localStorage.removeItem(chatKey);
        clearChatRef.current?.();
      }
    } catch { /* memo 写入失败不阻塞保存流程 */ }
  }

  async function handleFork() {
    if (!selectedSkill) return;
    try {
      const forked = await apiFetch<SkillDetail>(`/skills/${selectedSkill.id}/fork`, { method: "POST" }).catch(() => null);
      if (forked) { handleSaved(forked); return; }
      const detail = await apiFetch<SkillDetail>(`/skills/${selectedSkill.id}`);
      const srcPrompt = detail.versions?.[0]?.system_prompt ?? detail.system_prompt ?? "";
      const created = await apiFetch<SkillDetail>("/skills", {
        method: "POST",
        body: JSON.stringify({ name: `${selectedSkill.name}（副本）`, description: selectedSkill.description, system_prompt: srcPrompt, mode: "hybrid", variables: [], auto_inject: true }),
      });
      handleSaved(created);
    } catch (err) {
      console.error("Fork failed", err);
    }
  }

  function handleApplyDraft(draft: StudioDraft) {
    setPendingDiffBase(prompt);
    setPrompt(draft.system_prompt);
    if (draft.name) setExternalName(draft.name);
    if (draft.description !== undefined) setExternalDescription(draft.description);
  }

  function handleNewSession() {
    clearChatRef.current?.();
  }

  function handleAdoptSuggestion(skillName: string, suggestion: Suggestion) {
    const text = `${skillName}-修改意见: ${suggestion.problem_desc}\n期望: ${suggestion.expected_direction}`;
    setInputRef.current?.(text);
    // Also register in memo if skill has one
    if (selectedSkill) {
      apiFetch(`/skills/${selectedSkill.id}/memo/adopt-feedback`, {
        method: "POST",
        body: JSON.stringify({
          source_type: "comment",
          source_id: (suggestion as unknown as { id?: number }).id ?? 0,
          summary: `${suggestion.problem_desc} → ${suggestion.expected_direction}`,
          task_blueprint: {},
        }),
      }).then(() => handleMemoRefresh()).catch(() => {});
    }
  }

  async function handleDevStudioJump(desc: string) {
    if (!selectedSkill) return;
    try {
      await apiFetch("/dev-studio/tool-task", {
        method: "POST",
        body: JSON.stringify({
          skill_id: selectedSkill.id,
          skill_name: selectedSkill.name,
          tool_description: desc,
        }),
      });
    } catch { /* best effort */ }

    // 自动在 workdir 中创建 skill 项目文件夹
    const safeName = selectedSkill.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "");
    const folderName = `skill-${selectedSkill.id}-${safeName}`;
    try {
      await apiFetch("/dev-studio/workdir/mkdir", {
        method: "POST",
        body: JSON.stringify({ path: folderName }),
      });
    } catch { /* 文件夹可能已存在，忽略 */ }

    window.open(`/dev-studio?from_skill=${selectedSkill.id}`, "_blank");
  }

  const showAssetEditor = selectedFile?.fileType === "asset" && selectedSkill !== null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b-2 border-[#1A202C] bg-[#EBF4F7] px-4 py-2.5 flex items-center gap-3">
        <SkillIcon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">Skill Studio</span>
        <span className="text-[8px] text-gray-400 font-mono ml-2">
          {selectedFile?.fileType === "asset"
            ? `${selectedSkill?.name ?? ""} / ${(selectedFile as { filename: string }).filename}`
            : selectedSkill
              ? `正在编辑：${selectedSkill.name} / SKILL.md`
              : isNew
                ? "新建 Skill"
                : "选择或新建 Skill 开始"}
        </span>
        <div className="ml-auto" />
      </div>

      {/* 工程文件区共用提示 */}
      <div className="flex-shrink-0 px-4 py-1 bg-violet-50 border-b border-violet-200 text-[9px] text-violet-600 font-mono flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full inline-block" />
        当前与 OpenCode 共用个人工程文件区
      </div>

      {/* 沙盒报告入口提示 */}
      {fromSandbox && sandboxReportId && (
        <div className="flex-shrink-0 px-4 py-1.5 bg-amber-50 border-b-2 border-amber-300 text-[9px] flex items-center gap-2 flex-wrap">
          <span className="text-amber-700 font-bold">
            来源：沙盒报告 #{sandboxReportId}
          </span>
          {activeSandboxReport && (
            <span className="text-gray-500">
              {activeSandboxReport.approval_eligible ? "通过" : "失败"}
              {(() => {
                const issues = (activeSandboxReport.part3_evaluation as Record<string, unknown>)?.issues as unknown[] | undefined;
                const fixPlan = (activeSandboxReport.part3_evaluation as Record<string, unknown>)?.fix_plan_structured as unknown[] | undefined;
                const parts: string[] = [];
                if (issues?.length) parts.push(`${issues.length} 个问题`);
                if (fixPlan?.length) parts.push(`${fixPlan.length} 项整改`);
                return parts.length ? ` · ${parts.join(" / ")}` : "";
              })()}
            </span>
          )}
          {memoSyncError && (
            <>
              <span className="text-red-500 font-bold ml-2">{memoSyncError}</span>
              <button
                onClick={handleRetryMemoSync}
                disabled={retryingMemoSync || !sandboxSessionId}
                className="text-[8px] font-bold text-[#00A3C4] border border-[#00A3C4] px-2 py-0.5 hover:bg-[#00A3C4] hover:text-white disabled:opacity-50 ml-1"
              >
                {retryingMemoSync ? "同步中..." : "重试同步"}
              </button>
            </>
          )}
          {!memoSyncError && memo?.lifecycle_stage === "fixing" && (
            <span className="text-[#00CC99] font-bold ml-2">已进入整改模式</span>
          )}
          {sandboxRemediationLoading && (
            <span className="text-[#F59E0B] font-bold ml-2">正在扫描 Skill 并生成治理卡片...</span>
          )}
          {sandboxRemediationSummary && (
            <span className="text-[#00A3C4] font-bold ml-2">
              已生成 {sandboxRemediationSummary.cards} 张治理卡片 / {sandboxRemediationSummary.stagedEdits} 个待确认修改
            </span>
          )}
          {sandboxVersionMismatchMessage && (
            <div className="basis-full text-red-600 font-bold border border-red-300 bg-red-50 px-2 py-1 mt-1">
              {sandboxVersionMismatchMessage}
            </div>
          )}
        </div>
      )}

      {/* Three-column body: SkillList | StudioChat(main) | Editor(collapsible) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Skill list */}
        <SkillList
          skills={skills}
          loading={skillsLoading}
          selectedFile={selectedFile}
          refreshCounter={skillRefreshCounter}
          collapsed={skillListCollapsed}
          onSelectFile={(f) => {
            setSelectedFile(f);
            setIsNew(false);
          }}
          onNew={handleNewFromList}
          onImport={() => setShowImportModal(true)}
          onRefreshSkill={refreshSkill}
          onAdoptSuggestion={handleAdoptSuggestion}
          onToggleCollapse={() => setSkillListCollapsed((v) => !v)}
        />

        {/* Center: Chat (main work area) */}
        <StudioChat
          convId={convId}
          skillId={selectedSkill?.id ?? null}
          currentPrompt={prompt}
          currentDescription={selectedSkill?.description ?? ""}
          editorIsDirty={editorIsDirty}
          selectedSourceFile={selectedFile?.fileType === "asset" ? (selectedFile as { filename: string }).filename : null}
          allSkills={searchableSkills}
          memo={memo}
          onApplyDraft={handleApplyDraft}
          onNewSession={handleNewSession}
          onToolBound={() => { if (selectedSkill) { refreshSkill(selectedSkill.id); handleMemoRefresh(); } }}
          onDevStudio={handleDevStudioJump}
          onFileSplitDone={() => { if (selectedSkill) refreshSkill(selectedSkill.id); }}
          onMemoRefresh={handleMemoRefresh}
          onOpenSandbox={(id) => setShowSandbox(id)}
          onEditorTarget={handleEditorTarget}
          clearRef={clearChatRef}
          setInputRef={setInputRef}
          onViewReport={selectedFile?.skillId ? () => setShowSandbox(selectedFile.skillId) : undefined}
          sandboxReportId={fromSandbox ? sandboxReportId : undefined}
          fromSandbox={fromSandbox}
          onRefreshSkill={() => { if (selectedSkill) refreshSkill(selectedSkill.id); }}
          onExpandEditor={() => {
            if (editorVisibility === "collapsed" && !editorManuallyCollapsed) {
              setEditorVisibility("auto_expanded");
            }
          }}
          editorExpanded={editorExpanded}
        />

        {/* Right: Collapsible editor panel */}
        <div
          className={`flex-shrink-0 border-l-2 border-[#1A202C] transition-[width] duration-200 overflow-hidden ${
            editorExpanded ? "w-[480px]" : "w-0 border-l-0"
          }`}
        >
          {editorExpanded && (
            <div className="w-[480px] h-full flex flex-col">
              {/* Editor panel header with collapse/pin controls */}
              <div className="px-3 py-1.5 border-b border-gray-200 bg-[#F0F4F8] flex items-center gap-2 flex-shrink-0">
                <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 flex-1">
                  {showAssetEditor ? (selectedFile as { filename: string }).filename : "Prompt 编辑"}
                </span>
                <button
                  onClick={() => {
                    setEditorManuallyCollapsed(false);
                    setEditorVisibility(editorVisibility === "pinned_open" ? "auto_expanded" : "pinned_open");
                  }}
                  className={`p-0.5 transition-colors ${
                    editorVisibility === "pinned_open"
                      ? "text-[#00A3C4]"
                      : "text-gray-300 hover:text-gray-500"
                  }`}
                  title={editorVisibility === "pinned_open" ? "取消固定" : "固定编辑区"}
                >
                  <Pin size={10} />
                </button>
                <button
                  onClick={() => {
                    setEditorManuallyCollapsed(true);
                    setEditorVisibility("collapsed");
                  }}
                  className="text-gray-400 hover:text-gray-600 p-0.5"
                  title="收起编辑区"
                >
                  <PanelRightClose size={12} />
                </button>
              </div>

              {/* Editor content */}
              {showAssetEditor && selectedSkill ? (
                <AssetFileEditor
                  skill={selectedSkill}
                  filename={(selectedFile as { filename: string }).filename}
                  onDeleted={() => {
                    refreshSkill(selectedSkill.id);
                    setSelectedFile({ skillId: selectedSkill.id, fileType: "prompt" });
                  }}
                  onFileSaved={handleFileSaved}
                />
              ) : (
                <PromptEditor
                  skill={selectedSkill}
                  isNew={isNew}
                  prompt={prompt}
                  externalName={externalName}
                  externalDescription={externalDescription}
                  pendingDiffBase={pendingDiffBase}
                  saveRef={editorSaveRef}
                  onPromptChange={setPrompt}
                  onSaved={handleSaved}
                  onFork={handleFork}
                  onFileSaved={handleFileSaved}
                  sandboxVersionMismatch={sandboxVersionMismatch}
                  sandboxVersionMismatchMessage={sandboxVersionMismatchMessage}
                />
              )}
            </div>
          )}
        </div>

        {/* Collapsed editor toggle (shown when editor is hidden) */}
        {!editorExpanded && selectedSkill && (
          <button
            onClick={() => {
              setEditorManuallyCollapsed(false);
              setEditorVisibility("auto_expanded");
            }}
            className="flex-shrink-0 w-8 border-l-2 border-[#1A202C] bg-[#F0F4F8] hover:bg-[#E0ECF0] flex flex-col items-center justify-center gap-1 transition-colors"
            title="展开编辑区"
          >
            <PanelRightOpen size={12} className="text-gray-400" />
            <span className="text-[7px] text-gray-400 font-bold writing-mode-vertical" style={{ writingMode: "vertical-rl" }}>
              编辑
            </span>
          </button>
        )}
      </div>

      {/* Import modal */}
      {showSandbox && (
        <SandboxTestModal
          type="skill"
          id={showSandbox}
          name={skills.find(s => s.id === showSandbox)?.name ?? ""}
          onPassed={() => { setShowSandbox(null); handleMemoRefresh(); }}
          onCancel={() => { setShowSandbox(null); handleMemoRefresh(); }}
          onImportToStudio={() => {
            // 1. 关闭弹窗
            setShowSandbox(null);
            // 2. 刷新 memo（会自动加载 fixing 状态的 fix tasks）
            handleMemoRefresh();
            // 3. 确保 Skill 被选中并打开 prompt 编辑器
            const sandboxSkillId = showSandbox;
            if (sandboxSkillId) {
              setSelectedFile({ skillId: sandboxSkillId, fileType: "prompt" });
            }
          }}
          initialSessionId={
            fromSandbox && sandboxSessionId && showSandbox === initialSkillId
              ? Number(sandboxSessionId)
              : undefined
          }
        />
      )}

      {showImportModal && (
        <ImportSkillModal
          onImported={(skill) => {
            setShowImportModal(false);
            handleSaved(skill as SkillDetail);
            // Trigger memo analyze-import for the imported skill
            const imported = skill as SkillDetail;
            apiFetch(`/skills/${imported.id}/memo/analyze-import`, {
              method: "POST",
              body: JSON.stringify({ trigger: "import_zip" }),
            }).then(() => {
              if (imported.id) fetchMemo(imported.id);
            }).catch(() => {});
          }}
          onCancel={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}
  function normalizeStagedEdit(raw: Record<string, unknown>): StagedEdit {
    return normalizeStagedEditPayload(raw);
  }
