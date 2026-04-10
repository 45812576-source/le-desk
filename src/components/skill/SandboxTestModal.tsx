"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PixelButton } from "@/components/pixel/PixelButton";
import type {
  SandboxSession,
  SandboxReport,
  SandboxStepStatus,
  SandboxIssue,
  SandboxFixPlanItem,
  SandboxSupportingFinding,
  SkillPublishPrecheck,
} from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SandboxTestModalProps {
  type: "skill" | "tool";
  id: number;
  name: string;
  onPassed: () => void;
  onCancel: () => void;
  onImportToStudio?: () => void;
  passedLabel?: string;
  /** 传入已有 session ID 时，直接加载该会话和报告（查看模式） */
  initialSessionId?: number;
}

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ─── Main Modal ─────────────────────────────────────────────────────────────

export function SandboxTestModal({
  type,
  id,
  name,
  onPassed,
  onCancel,
  onImportToStudio: onImportToStudioProp,
  passedLabel = "OK 通过，继续发布",
  initialSessionId,
}: SandboxTestModalProps) {
  const router = useRouter();
  const [session, setSession] = useState<SandboxSession | null>(null);
  const [report, setReport] = useState<SandboxReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [precheck, setPrecheck] = useState<SkillPublishPrecheck | null>(null);
  const [approvalInfo, setApprovalInfo] = useState<string | null>(null);

  // ── Resume 已有会话（从沙盒报告跳转进来） ──
  useEffect(() => {
    if (!initialSessionId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const sess = await apiFetch<SandboxSession>(`/sandbox/interactive/${initialSessionId}`);
        if (cancelled) return;
        setSession(sess);
        if (sess.report_id) {
          const rpt = await apiFetch<SandboxReport>(`/sandbox/interactive/${initialSessionId}/report`);
          if (cancelled) return;
          setReport(rpt);
          setWizardStep(5);
        } else {
          // 会话尚未完成，跳到最后已知步骤
          setWizardStep(sess.current_step === "start" ? 0 : 4);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载会话失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [initialSessionId]);

  // ── Step 0: 开始测试 ──

  async function startTest() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SandboxSession>("/sandbox/interactive/start", {
        method: "POST",
        body: JSON.stringify({ target_type: type, target_id: id }),
      });
      setSession(data);
      // 根据 current_step 决定跳转
      if (data.current_step === "input_slot_review") setWizardStep(1);
      else if (data.current_step === "tool_review") setWizardStep(2);
      else setWizardStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "启动测试失败");
    } finally {
      setLoading(false);
    }
  }

  const STEP_LABELS = ["开始", "输入槽位", "Tool 确认", "权限确认", "执行测试", "报告"];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] w-[720px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-[#1A202C] bg-[#EBF4F7]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            交互式沙盒测试
          </span>
          <span className="text-xs font-bold text-[#1A202C] ml-1">-- {name}</span>
          <span className="ml-auto text-[8px] font-mono text-gray-400 border border-gray-300 px-1.5 py-0.5">
            {type === "skill" ? "SKILL" : "TOOL"}
          </span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-4 py-2 border-b border-gray-100 bg-[#F8FAFB]">
          {STEP_LABELS.map((label, idx) => (
            <div key={idx} className="flex items-center">
              <div
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                  wizardStep === idx
                    ? "bg-[#00A3C4] text-white"
                    : wizardStep > idx
                      ? "bg-[#00CC99] text-white"
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                {wizardStep > idx ? "OK" : idx + 1} {label}
              </div>
              {idx < STEP_LABELS.length - 1 && (
                <div className={`w-4 h-px mx-0.5 ${wizardStep > idx ? "bg-[#00CC99]" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="border-2 border-red-400 bg-red-50 px-3 py-2 text-[9px] font-bold text-red-500">
              X {error}
            </div>
          )}
          {approvalInfo && (
            <div className="border-2 border-green-400 bg-green-50 px-3 py-2 text-[9px] font-bold text-green-600">
              {approvalInfo}
            </div>
          )}

          {/* Blocked / cannot_test */}
          {session && (session.status === "blocked" || session.status === "cannot_test") && (
            <div className="border-2 border-red-400 bg-red-50 px-3 py-2">
              <div className="text-[9px] font-bold text-red-600 uppercase tracking-widest mb-1">
                {session.status === "blocked" ? "测试阻断" : "无法测试"}
              </div>
              <div className="text-[9px] text-red-600 font-mono whitespace-pre-wrap">
                {session.blocked_reason}
              </div>
            </div>
          )}

          {wizardStep === 0 && <Step0Start loading={loading} onStart={startTest} />}
          {wizardStep === 1 && session && (
            <Step1InputSlots
              session={session}
              onSubmit={async (slots) => {
                setLoading(true);
                setError(null);
                try {
                  const data = await apiFetch<SandboxSession>(
                    `/sandbox/interactive/${session.session_id}/input-slots`,
                    { method: "POST", body: JSON.stringify({ slots }) }
                  );
                  setSession(data);
                  if (data.status === "cannot_test" || data.status === "blocked") return;
                  if (data.current_step === "tool_review") setWizardStep(2);
                  else setWizardStep(3);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "提交失败");
                } finally {
                  setLoading(false);
                }
              }}
              loading={loading}
            />
          )}
          {wizardStep === 2 && session && (
            <Step2ToolReview
              session={session}
              onSubmit={async (tools) => {
                setLoading(true);
                setError(null);
                try {
                  const data = await apiFetch<SandboxSession>(
                    `/sandbox/interactive/${session.session_id}/tool-review`,
                    { method: "POST", body: JSON.stringify({ tools }) }
                  );
                  setSession(data);
                  if (data.status === "cannot_test" || data.status === "blocked") return;
                  setWizardStep(3);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "提交失败");
                } finally {
                  setLoading(false);
                }
              }}
              loading={loading}
            />
          )}
          {wizardStep === 3 && session && (
            <Step3PermissionReview
              session={session}
              onSubmit={async (tables) => {
                setLoading(true);
                setError(null);
                try {
                  const data = await apiFetch<SandboxSession>(
                    `/sandbox/interactive/${session.session_id}/permission-review`,
                    { method: "POST", body: JSON.stringify({ tables }) }
                  );
                  setSession(data);
                  if (data.status === "blocked") return;
                  setWizardStep(4);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "提交失败");
                } finally {
                  setLoading(false);
                }
              }}
              loading={loading}
            />
          )}
          {wizardStep === 4 && session && (
            <Step4Execute
              session={session}
              onRun={async () => {
                setLoading(true);
                setError(null);
                try {
                  const data = await apiFetch<SandboxSession>(
                    `/sandbox/interactive/${session.session_id}/run`,
                    { method: "POST" }
                  );
                  setSession(data);
                  if (data.status === "completed" && data.report_id) {
                    const rpt = await apiFetch<SandboxReport>(
                      `/sandbox/interactive/${session.session_id}/report`
                    );
                    setReport(rpt);
                    setWizardStep(5);
                  } else if (data.status === "blocked") {
                    setError("语义组合超阈值，测试被阻断");
                  }
                } catch (err) {
                  // 执行中断但 session 可能有 step_statuses，刷新 session
                  try {
                    const refreshed = await apiFetch<SandboxSession>(
                      `/sandbox/interactive/${session.session_id}/session`
                    );
                    setSession(refreshed);
                  } catch { /* ignore */ }
                  setError(err instanceof Error ? err.message : "执行失败");
                } finally {
                  setLoading(false);
                }
              }}
              onRetryStep={async (step: string) => {
                setLoading(true);
                setError(null);
                try {
                  const data = await apiFetch<SandboxSession>(
                    `/sandbox/interactive/${session.session_id}/retry-from-step`,
                    { method: "POST", body: JSON.stringify({ step }) }
                  );
                  setSession(data);
                  if (data.status === "completed" && data.report_id) {
                    const rpt = await apiFetch<SandboxReport>(
                      `/sandbox/interactive/${session.session_id}/report`
                    );
                    setReport(rpt);
                    setWizardStep(5);
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : "重试失败");
                } finally {
                  setLoading(false);
                }
              }}
              loading={loading}
            />
          )}
          {wizardStep === 5 && session && report && (
            <Step5Report
              session={session}
              report={report}
              passedLabel={type === "skill" ? "下一步：知识引用检查" : passedLabel}
              onSubmitApproval={async () => {
                setLoading(true);
                setError(null);
                try {
                  const result = await apiFetch<{
                    approval_request_id: number;
                    assigned_approver_name?: string;
                    routing_reason?: string;
                  }>(
                    `/sandbox/interactive/${session.session_id}/submit-approval`,
                    { method: "POST" }
                  );
                  if (result.assigned_approver_name) {
                    setError(null);
                    // 使用临时 info 提示审批人，复用 error 位置但语义不同
                    setApprovalInfo(`已提交给 ${result.assigned_approver_name} 审批`);
                  }
                  // 沙箱审批通过后，进入知识引用安全检查
                  if (type === "skill") {
                    try {
                      const pc = await apiFetch<SkillPublishPrecheck>(
                        `/skills/${id}/publish-precheck`,
                        { method: "POST" }
                      );
                      setPrecheck(pc);
                      setWizardStep(6);
                    } catch {
                      // precheck 失败不阻塞（可能无知识引用）
                      onPassed();
                    }
                  } else {
                    onPassed();
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : "提交审批失败");
                } finally {
                  setLoading(false);
                }
              }}
              onImportToStudio={async () => {
                // 内建跳转是主路径，外部回调只做附加动作（如关闭弹窗）
                try {
                  setLoading(true);
                  const entry = await apiFetch<{ conversation_id: number }>(
                    `/conversations/studio-entry?type=skill_studio&skill_id=${id}`
                  );
                  const params = new URLSearchParams({
                    ws: "skill_studio",
                    skill_id: String(id),
                    from: "sandbox_report",
                    report_id: String(report?.report_id ?? ""),
                    session_id: String(session?.session_id ?? ""),
                  });
                  // 先执行路由跳转，再 fire-and-forget 外部回调
                  // 避免外部回调导致组件卸载使 router.push 不执行
                  router.push(`/chat/${entry.conversation_id}?${params.toString()}`);
                  onImportToStudioProp?.();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "跳转 Skill Studio 失败");
                } finally {
                  setLoading(false);
                }
              }}
              onTargetedRerun={async (fixPlanItemIds) => {
                setLoading(true);
                setError(null);
                try {
                  const data = await apiFetch<SandboxSession & { covered_issues: string[]; remaining_issues: string[] }>(
                    `/sandbox/interactive/${session.session_id}/targeted-rerun`,
                    { method: "POST", body: JSON.stringify({ fix_plan_item_ids: fixPlanItemIds }) }
                  );
                  setSession(data);
                  if (data.status === "completed" && data.report_id) {
                    const rpt = await apiFetch<SandboxReport>(
                      `/sandbox/interactive/${data.session_id}/report`
                    );
                    setReport(rpt);
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : "局部重测失败");
                } finally {
                  setLoading(false);
                }
              }}
              onRetryMemoSync={async () => {
                setLoading(true);
                setError(null);
                try {
                  const data = await apiFetch<SandboxSession>(
                    `/sandbox/interactive/${session.session_id}/retry-from-step`,
                    { method: "POST", body: JSON.stringify({ step: "memo_sync" }) }
                  );
                  setSession(data);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Memo 同步重试失败");
                } finally {
                  setLoading(false);
                }
              }}
              loading={loading}
            />
          )}
          {wizardStep === 6 && precheck && (
            <Step6KnowledgePrecheck
              precheck={precheck}
              onPassed={onPassed}
              blocked={precheck.blocked}
            />
          )}
        </div>
        <div className="flex items-center gap-2 px-4 py-3 border-t-2 border-[#1A202C]">
          <PixelButton variant="secondary" onClick={onCancel}>关闭</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─── Step 0: 开始 ───────────────────────────────────────────────────────────

function Step0Start({ loading, onStart }: { loading: boolean; onStart: () => void }) {
  return (
    <div className="text-center py-6">
      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
        交互式引导测试 -- 从架构上杜绝大模型幻觉
      </div>
      <div className="text-[8px] text-gray-400 font-mono mb-4 max-w-md mx-auto">
        测试将分三步确认：输入槽位来源 -&gt; Tool 参数验证 -&gt; 权限快照确认<br />
        然后基于真实证据穷尽权限语义生成测试矩阵<br />
        禁止 LLM 在任何环节生成虚拟数据
      </div>
      <PixelButton onClick={onStart} disabled={loading}>
        {loading ? "初始化中..." : "开始测试"}
      </PixelButton>
    </div>
  );
}

// ─── Step 1: 输入槽位来源确认（证据化） ──────────────────────────────────────

function Step1InputSlots({
  session,
  onSubmit,
  loading,
}: {
  session: SandboxSession;
  onSubmit: (slots: { slot_key: string; chosen_source: string; chat_example?: string; knowledge_entry_id?: number; rag_query?: string; table_name?: string; field_name?: string }[]) => void;
  loading: boolean;
}) {
  const [slotEdits, setSlotEdits] = useState(() => {
    const edits: Record<string, {
      chosen_source: string;
      chat_example: string;
      knowledge_entry_id: string;
      rag_query: string;
      table_name: string;
      field_name: string;
    }> = {};
    for (const slot of session.detected_slots) {
      edits[slot.slot_key] = {
        chosen_source: slot.chosen_source || "",
        chat_example: slot.chat_example || "",
        knowledge_entry_id: slot.knowledge_entry_id ? String(slot.knowledge_entry_id) : "",
        rag_query: "",
        table_name: slot.table_name || "",
        field_name: slot.field_name || "",
      };
    }
    return edits;
  });

  function updateSlot(key: string, field: string, value: string) {
    setSlotEdits((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function handleSubmit() {
    const slots = session.detected_slots.map((slot) => {
      const edit = slotEdits[slot.slot_key] || {};
      return {
        slot_key: slot.slot_key,
        chosen_source: edit.chosen_source,
        chat_example: edit.chosen_source === "chat_text" ? edit.chat_example : undefined,
        knowledge_entry_id: edit.chosen_source === "knowledge" && edit.knowledge_entry_id
          ? parseInt(edit.knowledge_entry_id) : undefined,
        rag_query: edit.chosen_source === "knowledge" ? edit.rag_query : undefined,
        table_name: edit.chosen_source === "data_table" ? edit.table_name : undefined,
        field_name: edit.chosen_source === "data_table" ? edit.field_name : undefined,
      };
    });
    onSubmit(slots);
  }

  if (session.detected_slots.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-[9px] text-gray-400 mb-3">未检测到输入槽位</div>
        <PixelButton onClick={() => onSubmit([])} disabled={loading}>跳过，下一步</PixelButton>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
        Q1 -- 输入槽位来源确认
      </div>
      <div className="text-[8px] text-gray-400 font-mono mb-2">
        每个槽位必须有证据证明来源合法，结构化数据禁止 chat_text
      </div>

      {session.detected_slots.map((slot) => {
        const edit = slotEdits[slot.slot_key] || { chosen_source: "", chat_example: "", knowledge_entry_id: "", rag_query: "", table_name: "", field_name: "" };
        const conclusion = slot.verification_conclusion;
        return (
          <div key={slot.slot_key} className={`border rounded ${
            conclusion === "failed" || conclusion === "unsupported"
              ? "border-red-300 bg-red-50/30"
              : conclusion === "verified"
                ? "border-green-300 bg-green-50/30"
                : "border-gray-200 bg-[#F8FAFB]"
          }`}>
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100">
              <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${slot.structured ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                {slot.structured ? "结构化" : "非结构化"}
              </span>
              {slot.required && <span className="text-[8px] font-bold text-red-500">必填</span>}
              <span className="text-[9px] font-bold text-gray-700">{slot.label}</span>
              {conclusion && (
                <span className={`ml-auto text-[8px] font-bold ${
                  conclusion === "verified" ? "text-green-600" : "text-red-500"
                }`}>
                  {conclusion === "verified" ? "OK" : conclusion.toUpperCase()}
                </span>
              )}
            </div>

            {/* 证据化审批信息 */}
            <div className="px-3 py-1.5 space-y-0.5 border-b border-gray-50">
              {slot.required_reason && (
                <div className="text-[8px] text-blue-600">
                  <span className="text-gray-400">必填原因:</span> {slot.required_reason}
                </div>
              )}
              {slot.evidence_requirement && (
                <div className="text-[8px] text-gray-500">
                  <span className="text-gray-400">证据要求:</span> {slot.evidence_requirement}
                </div>
              )}
              {slot.pass_criteria && (
                <div className="text-[8px] text-gray-500">
                  <span className="text-gray-400">通过标准:</span> {slot.pass_criteria}
                </div>
              )}
              {slot.verification_reason && (
                <div className={`text-[8px] ${conclusion === "verified" ? "text-green-600" : "text-red-500"}`}>
                  <span className="text-gray-400">判定:</span> {slot.verification_reason}
                </div>
              )}
              {slot.suggested_source && conclusion !== "verified" && (
                <div className="text-[8px] text-amber-600">
                  <span className="text-gray-400">建议:</span> {slot.suggested_source}
                </div>
              )}
            </div>

            <div className="px-3 py-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-gray-500 w-12 flex-shrink-0">来源</span>
                <select
                  value={edit.chosen_source}
                  onChange={(e) => updateSlot(slot.slot_key, "chosen_source", e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-2 py-1 text-[9px]"
                >
                  <option value="">请选择</option>
                  {slot.allowed_sources.includes("chat_text") && <option value="chat_text">Chat 文本录入</option>}
                  {slot.allowed_sources.includes("knowledge") && <option value="knowledge">知识库</option>}
                  {slot.allowed_sources.includes("data_table") && <option value="data_table">数据表</option>}
                  {slot.allowed_sources.includes("system_runtime") && <option value="system_runtime">系统运行时</option>}
                </select>
              </div>

              {edit.chosen_source === "chat_text" && (
                <div>
                  <div className="text-[8px] text-amber-600 mb-1">请手写录入示例（禁止使用 LLM 生成）：</div>
                  <textarea
                    value={edit.chat_example}
                    onChange={(e) => updateSlot(slot.slot_key, "chat_example", e.target.value)}
                    rows={2}
                    placeholder="手写示例文本..."
                    className="w-full border border-gray-300 rounded px-2 py-1 text-[9px] resize-none"
                  />
                </div>
              )}

              {edit.chosen_source === "knowledge" && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-gray-500 w-12 flex-shrink-0">知识 ID</span>
                    <input
                      type="number"
                      value={edit.knowledge_entry_id}
                      onChange={(e) => updateSlot(slot.slot_key, "knowledge_entry_id", e.target.value)}
                      placeholder="KnowledgeEntry ID"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-[9px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-gray-500 w-12 flex-shrink-0">RAG 查询</span>
                    <input
                      value={edit.rag_query}
                      onChange={(e) => updateSlot(slot.slot_key, "rag_query", e.target.value)}
                      placeholder="用于验证 RAG 检索的查询文本"
                      className="flex-1 border border-gray-300 rounded px-2 py-1 text-[9px]"
                    />
                  </div>
                </div>
              )}

              {edit.chosen_source === "data_table" && (
                <div className="flex items-center gap-2">
                  <span className="text-[8px] text-gray-500 w-12 flex-shrink-0">表.字段</span>
                  <input
                    value={edit.table_name}
                    onChange={(e) => updateSlot(slot.slot_key, "table_name", e.target.value)}
                    placeholder="表名"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-[9px]"
                  />
                  <input
                    value={edit.field_name}
                    onChange={(e) => updateSlot(slot.slot_key, "field_name", e.target.value)}
                    placeholder="字段名（可选）"
                    className="flex-1 border border-gray-300 rounded px-2 py-1 text-[9px]"
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="pt-2">
        <PixelButton onClick={handleSubmit} disabled={loading}>
          {loading ? "提交中..." : "确认槽位来源，下一步"}
        </PixelButton>
      </div>
    </div>
  );
}

// ─── Step 2: Tool 确认（三选一） ─────────────────────────────────────────────

function Step2ToolReview({
  session,
  onSubmit,
  loading,
}: {
  session: SandboxSession;
  onSubmit: (tools: { tool_id: number; decision: string; no_tool_proof?: string; input_provenance: { field_name: string; source_kind: string; source_ref: string }[] }[]) => void;
  loading: boolean;
}) {
  const [toolEdits, setToolEdits] = useState(() => {
    const edits: Record<number, {
      decision: string;
      no_tool_proof: string;
      provenance: Record<string, { source_kind: string; source_ref: string }>;
    }> = {};
    for (const t of session.tool_review) {
      const prov: Record<string, { source_kind: string; source_ref: string }> = {};
      for (const p of t.input_provenance) {
        prov[p.field_name] = {
          source_kind: p.source_kind || "",
          source_ref: p.source_ref || "",
        };
      }
      edits[t.tool_id] = { decision: "", no_tool_proof: "", provenance: prov };
    }
    return edits;
  });

  if (session.tool_review.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-[9px] text-gray-400 mb-3">无绑定工具</div>
        <PixelButton onClick={() => onSubmit([])} disabled={loading}>跳过，下一步</PixelButton>
      </div>
    );
  }

  function handleSubmit() {
    const tools = session.tool_review.map((t) => {
      const edit = toolEdits[t.tool_id] || { decision: "uncertain_block", no_tool_proof: "", provenance: {} };
      return {
        tool_id: t.tool_id,
        decision: edit.decision || "uncertain_block",
        no_tool_proof: edit.decision === "no_need" ? edit.no_tool_proof : undefined,
        input_provenance: edit.decision === "must_call"
          ? Object.entries(edit.provenance).map(([field_name, p]) => ({
              field_name,
              source_kind: p.source_kind,
              source_ref: p.source_ref,
            }))
          : [],
      };
    });
    onSubmit(tools);
  }

  return (
    <div className="space-y-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
        Q2 -- Tool 确认（必须调用 / 无需调用 / 不确定）
      </div>
      <div className="text-[8px] text-gray-400 font-mono mb-2">
        每个 Tool 必须选择是否需要调用，并提供证据
      </div>

      {session.tool_review.map((t) => {
        const edit = toolEdits[t.tool_id] || { decision: "", no_tool_proof: "", provenance: {} };
        return (
          <div key={t.tool_id} className="border border-gray-200 bg-[#F8FAFB] rounded">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <span className="text-[9px] font-bold text-gray-700">{t.tool_name}</span>
              <span className="text-[8px] text-gray-400 ml-auto">ID: {t.tool_id}</span>
              {t.requiredness && (
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${
                  t.requiredness === "required" ? "bg-red-100 text-red-600" :
                  t.requiredness === "avoidable" ? "bg-amber-100 text-amber-600" :
                  "bg-gray-100 text-gray-500"
                }`}>
                  {t.requiredness}
                </span>
              )}
            </div>
            {t.description && (
              <div className="px-3 py-1 text-[8px] text-gray-500">{t.description}</div>
            )}

            {/* 必要性信息 */}
            {t.requiredness_reason && (
              <div className="px-3 py-1 text-[8px] text-blue-600">
                <span className="text-gray-400">必要性判定:</span> {t.requiredness_reason}
              </div>
            )}
            {t.pass_criteria && (
              <div className="px-3 py-1 text-[8px] text-gray-500">
                <span className="text-gray-400">通过标准:</span> {t.pass_criteria}
              </div>
            )}

            {/* 三选一 */}
            <div className="px-3 py-2 flex items-center gap-4 border-t border-gray-50">
              <label className="flex items-center gap-1.5 text-[9px] cursor-pointer">
                <input
                  type="radio"
                  name={`tool-${t.tool_id}`}
                  value="must_call"
                  checked={edit.decision === "must_call"}
                  onChange={() => setToolEdits((prev) => ({
                    ...prev,
                    [t.tool_id]: { ...prev[t.tool_id], decision: "must_call" },
                  }))}
                  className="w-3 h-3"
                />
                <span className="font-bold text-green-700">必须调用</span>
              </label>
              <label className="flex items-center gap-1.5 text-[9px] cursor-pointer">
                <input
                  type="radio"
                  name={`tool-${t.tool_id}`}
                  value="no_need"
                  checked={edit.decision === "no_need"}
                  onChange={() => setToolEdits((prev) => ({
                    ...prev,
                    [t.tool_id]: { ...prev[t.tool_id], decision: "no_need" },
                  }))}
                  className="w-3 h-3"
                />
                <span className="font-bold text-amber-700">无需调用</span>
              </label>
              <label className="flex items-center gap-1.5 text-[9px] cursor-pointer">
                <input
                  type="radio"
                  name={`tool-${t.tool_id}`}
                  value="uncertain_block"
                  checked={edit.decision === "uncertain_block"}
                  onChange={() => setToolEdits((prev) => ({
                    ...prev,
                    [t.tool_id]: { ...prev[t.tool_id], decision: "uncertain_block" },
                  }))}
                  className="w-3 h-3"
                />
                <span className="font-bold text-red-600">不确定（阻断）</span>
              </label>
            </div>

            {/* no_need: 证明 */}
            {edit.decision === "no_need" && (
              <div className="px-3 py-2 border-t border-gray-50">
                <div className="text-[8px] text-amber-600 mb-1">请说明无需调用的原因（引用知识库 ID 或数据表名作为替代证明）：</div>
                <textarea
                  value={edit.no_tool_proof}
                  onChange={(e) => setToolEdits((prev) => ({
                    ...prev,
                    [t.tool_id]: { ...prev[t.tool_id], no_tool_proof: e.target.value },
                  }))}
                  rows={2}
                  placeholder="例：知识库 #12 已包含等效数据，无需调用此工具"
                  className="w-full border border-gray-300 rounded px-2 py-1 text-[9px] resize-none"
                />
              </div>
            )}

            {/* must_call: provenance */}
            {edit.decision === "must_call" && t.input_provenance.length > 0 && (
              <div className="px-3 py-2 space-y-1.5 border-t border-gray-50">
                <div className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Required Input 来源</div>
                {t.input_provenance.map((p) => {
                  const pe = edit.provenance[p.field_name] || { source_kind: "", source_ref: "" };
                  return (
                    <div key={p.field_name} className="flex items-center gap-2">
                      <span className="text-[8px] font-mono text-gray-600 w-24 flex-shrink-0">{p.field_name}</span>
                      <select
                        value={pe.source_kind}
                        onChange={(e) => {
                          const newProv = { ...edit.provenance, [p.field_name]: { ...pe, source_kind: e.target.value } };
                          setToolEdits((prev) => ({ ...prev, [t.tool_id]: { ...prev[t.tool_id], provenance: newProv } }));
                        }}
                        className="border border-gray-300 rounded px-1.5 py-0.5 text-[8px]"
                      >
                        <option value="">来源</option>
                        <option value="knowledge">知识库</option>
                        <option value="data_table">数据表</option>
                        <option value="system_runtime">系统运行时</option>
                        <option value="chat_text">Chat 文本</option>
                      </select>
                      <input
                        value={pe.source_ref}
                        onChange={(e) => {
                          const newProv = { ...edit.provenance, [p.field_name]: { ...pe, source_ref: e.target.value } };
                          setToolEdits((prev) => ({ ...prev, [t.tool_id]: { ...prev[t.tool_id], provenance: newProv } }));
                        }}
                        placeholder="来源引用（表名/知识ID/...）"
                        className="flex-1 border border-gray-300 rounded px-1.5 py-0.5 text-[8px]"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-2">
        <PixelButton onClick={handleSubmit} disabled={loading}>
          {loading ? "提交中..." : "确认 Tool，下一步"}
        </PixelButton>
      </div>
    </div>
  );
}

// ─── Step 3: 权限快照确认（四选一） ─────────────────────────────────────────

function Step3PermissionReview({
  session,
  onSubmit,
  loading,
}: {
  session: SandboxSession;
  onSubmit: (tables: { table_name: string; decision: string; no_permission_reason?: string; included_in_test: boolean }[]) => void;
  loading: boolean;
}) {
  const [tableEdits, setTableEdits] = useState(() => {
    const edits: Record<string, { decision: string; no_permission_reason: string; included_in_test: boolean }> = {};
    for (const snap of session.permission_snapshot || []) {
      edits[snap.table_name] = {
        decision: "",
        no_permission_reason: "",
        included_in_test: snap.included_in_test,
      };
    }
    return edits;
  });

  const snapshots = session.permission_snapshot || [];

  if (snapshots.length === 0) {
    return (
      <div className="text-center py-4">
        <div className="text-[9px] text-gray-400 mb-3">无关联数据表</div>
        <PixelButton onClick={() => onSubmit([])} disabled={loading}>跳过，下一步</PixelButton>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
        Q3 -- 权限快照确认
      </div>
      <div className="text-[8px] text-gray-400 font-mono mb-2">
        每个数据表必须明确选择权限状态并提供理由
      </div>

      {snapshots.map((snap) => {
        const edit = tableEdits[snap.table_name] || { decision: "", no_permission_reason: "", included_in_test: true };
        return (
          <div key={snap.table_name} className="border border-gray-200 bg-[#F8FAFB] rounded">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <span className="text-[9px] font-bold text-gray-700">{snap.display_name}</span>
              <span className="text-[8px] text-gray-400 font-mono">{snap.table_name}</span>
              {snap.warning && (
                <span className="text-[8px] text-red-500 ml-auto">{snap.warning}</span>
              )}
            </div>

            {/* 权限信息 */}
            <div className="px-3 py-1.5 space-y-0.5 border-b border-gray-50">
              <div className="flex items-center gap-4 text-[8px]">
                <span className="text-gray-500">行可见范围:</span>
                <span className="font-mono text-gray-700">{snap.row_visibility}</span>
              </div>
              {snap.permission_required_reason && (
                <div className="text-[8px] text-blue-600">
                  <span className="text-gray-400">权限状态:</span> {snap.permission_required_reason}
                </div>
              )}
              {snap.applied_rules && snap.applied_rules.length > 0 && (
                <div className="text-[8px]">
                  <span className="text-gray-400">已应用规则:</span>
                  {snap.applied_rules.map((rule, i) => (
                    <span key={i} className="ml-1 px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-[7px] font-mono">
                      {rule}
                    </span>
                  ))}
                </div>
              )}
              {snap.why_no_permission_needed && (
                <div className="text-[8px] text-green-600">
                  <span className="text-gray-400">无需权限原因:</span> {snap.why_no_permission_needed}
                </div>
              )}
              {snap.field_masks.length > 0 && (
                <div className="text-[8px]">
                  <span className="text-gray-500">字段遮罩:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {snap.field_masks.map((fm, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[7px] font-mono">
                        {fm.field_name}: {fm.mask_action}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 四选一 */}
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                {[
                  { value: "required_confirmed", label: "权限符合预期", color: "text-green-700" },
                  { value: "no_permission_needed", label: "无需权限控制", color: "text-blue-700" },
                  { value: "mismatch", label: "配置不一致", color: "text-red-600" },
                  { value: "uncertain_block", label: "不确定（阻断）", color: "text-red-600" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-1.5 text-[9px] cursor-pointer">
                    <input
                      type="radio"
                      name={`perm-${snap.table_name}`}
                      value={opt.value}
                      checked={edit.decision === opt.value}
                      onChange={() => setTableEdits((prev) => ({
                        ...prev,
                        [snap.table_name]: { ...prev[snap.table_name], decision: opt.value },
                      }))}
                      className="w-3 h-3"
                    />
                    <span className={`font-bold ${opt.color}`}>{opt.label}</span>
                  </label>
                ))}
              </div>

              {edit.decision === "no_permission_needed" && (
                <div>
                  <div className="text-[8px] text-blue-600 mb-1">请说明无需权限的理由：</div>
                  <textarea
                    value={edit.no_permission_reason}
                    onChange={(e) => setTableEdits((prev) => ({
                      ...prev,
                      [snap.table_name]: { ...prev[snap.table_name], no_permission_reason: e.target.value },
                    }))}
                    rows={2}
                    placeholder="例：仅公开知识，无敏感字段"
                    className="w-full border border-gray-300 rounded px-2 py-1 text-[9px] resize-none"
                  />
                </div>
              )}

              <label className="flex items-center gap-1 text-[8px] text-gray-500">
                <input
                  type="checkbox"
                  checked={edit.included_in_test}
                  onChange={(e) => setTableEdits((prev) => ({
                    ...prev,
                    [snap.table_name]: { ...prev[snap.table_name], included_in_test: e.target.checked },
                  }))}
                  className="w-2.5 h-2.5"
                />
                纳入测试
              </label>
            </div>
          </div>
        );
      })}

      <div className="pt-2">
        <PixelButton
          onClick={() => {
            const tables = snapshots.map((s) => ({
              table_name: s.table_name,
              decision: tableEdits[s.table_name]?.decision || "uncertain_block",
              no_permission_reason: tableEdits[s.table_name]?.decision === "no_permission_needed"
                ? tableEdits[s.table_name]?.no_permission_reason
                : undefined,
              included_in_test: tableEdits[s.table_name]?.included_in_test ?? true,
            }));
            onSubmit(tables);
          }}
          disabled={loading}
        >
          {loading ? "提交中..." : "确认权限，开始测试"}
        </PixelButton>
      </div>
    </div>
  );
}

// ─── Step 4: 执行测试 ──────────────────────────────────────────────────────

function Step4Execute({
  onRun,
  onRetryStep,
  loading,
  session,
}: {
  onRun: () => void;
  onRetryStep?: (step: string) => void;
  loading: boolean;
  session?: SandboxSession | null;
}) {
  const stepLabels: Record<string, string> = {
    case_generation: "用例生成",
    case_execution: "用例执行",
    evaluation: "质量评价",
    report_generation: "报告生成",
    memo_sync: "Memo 同步",
  };
  const stepOrder = ["case_generation", "case_execution", "evaluation", "report_generation", "memo_sync"];
  const stepStatuses = session?.step_statuses;

  const hasFailedStep = stepStatuses && stepOrder.some(s => stepStatuses[s]?.status === "failed");

  return (
    <div className="py-4">
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-3 text-center">
        {hasFailedStep ? "执行中断" : "三项检查全部通过，准备执行"}
      </div>

      {/* 分段进度 */}
      {stepStatuses && Object.keys(stepStatuses).length > 0 && (
        <div className="space-y-1.5 mb-4 mx-4">
          {stepOrder.map(step => {
            const info = stepStatuses[step] as SandboxStepStatus | undefined;
            if (!info) return null;
            const statusColors: Record<string, string> = {
              pending: "text-gray-400",
              running: "text-[#00A3C4] animate-pulse",
              completed: "text-[#00CC99]",
              failed: "text-red-500",
            };
            const statusIcons: Record<string, string> = {
              pending: "○",
              running: "◎",
              completed: "●",
              failed: "✗",
            };
            return (
              <div key={step} className="flex items-center gap-2 text-[8px]">
                <span className={`font-bold ${statusColors[info.status] || "text-gray-400"}`}>
                  {statusIcons[info.status] || "○"}
                </span>
                <span className="font-bold text-gray-600 w-20">{stepLabels[step]}</span>
                <span className={`flex-1 ${statusColors[info.status] || ""}`}>
                  {info.status === "running" && "执行中..."}
                  {info.status === "completed" && "完成"}
                  {info.status === "failed" && (
                    <span className="text-red-500">{info.error_message || "失败"}</span>
                  )}
                </span>
                {info.status === "failed" && info.retryable && onRetryStep && (
                  <button
                    className="text-[7px] font-bold text-[#00A3C4] border border-[#00A3C4] px-1.5 py-0.5 hover:bg-[#00A3C4] hover:text-white"
                    onClick={() => onRetryStep(step)}
                    disabled={loading}
                  >
                    重试
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!hasFailedStep && (
        <div className="text-center">
          {loading ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
              生成用例 -&gt; 执行 -&gt; 评价中，请稍候...
            </div>
          ) : (
            <PixelButton onClick={onRun}>执行测试矩阵</PixelButton>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Supporting 结论展示组件 ──────────────────────────────────────────────

function SupportingFindingsSection({ findings }: { findings?: SandboxSupportingFinding[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!findings || findings.length === 0) {
    return (
      <div className="border border-gray-200 bg-[#F8FAFB] rounded">
        <div className="px-3 py-1.5 border-b border-gray-100">
          <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Supporting 结论</span>
        </div>
        <div className="px-3 py-2 text-[8px] text-gray-400">无 supporting 结论</div>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const severityColors: Record<string, string> = {
    critical: "bg-red-500 text-white",
    major: "bg-amber-500 text-white",
    minor: "bg-gray-400 text-white",
    info: "bg-blue-400 text-white",
  };

  return (
    <div className="border border-gray-200 bg-[#F8FAFB] rounded">
      <div className="px-3 py-1.5 border-b border-gray-100">
        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">
          Supporting 结论 ({findings.length})
        </span>
      </div>
      <div className="px-3 py-2 space-y-2">
        {findings.map(f => {
          const isExpanded = expandedIds.has(f.id);
          return (
            <div key={f.id} className="border border-gray-200 rounded p-2">
              <div className="flex items-center gap-2 mb-1">
                {f.severity && (
                  <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${severityColors[f.severity] || severityColors.info}`}>
                    {f.severity.toUpperCase()}
                  </span>
                )}
                <span className="text-[8px] font-bold text-gray-700 flex-1">{f.title}</span>
                {f.source_case_indexes && f.source_case_indexes.length > 0 && (
                  <span className="text-[7px] text-gray-400">
                    关联 {f.source_case_indexes.length} 个用例
                  </span>
                )}
              </div>
              <div className="text-[8px] text-gray-600">
                {isExpanded ? f.conclusion : (f.conclusion.length > 120 ? f.conclusion.slice(0, 120) + "..." : f.conclusion)}
              </div>
              {isExpanded && (
                <div className="mt-1.5 space-y-1.5">
                  {f.detail && (
                    <div className="text-[8px] text-gray-500 bg-gray-50 p-1.5 rounded">
                      {f.detail}
                    </div>
                  )}
                  {f.evidence_snippets && f.evidence_snippets.length > 0 && (
                    <div>
                      <div className="text-[7px] font-bold text-gray-400 mb-0.5">证据片段:</div>
                      {f.evidence_snippets.map((snippet, i) => (
                        <div key={i} className="text-[7px] text-gray-500 bg-gray-100 p-1 rounded font-mono mb-0.5">
                          {snippet}
                        </div>
                      ))}
                    </div>
                  )}
                  {f.source_case_indexes && f.source_case_indexes.length > 0 && (
                    <div className="text-[7px] text-gray-400">
                      关联用例: {f.source_case_indexes.map(idx => `#${idx}`).join(", ")}
                    </div>
                  )}
                  {f.recommendation && (
                    <div className="text-[8px] text-amber-600">
                      建议: {f.recommendation}
                    </div>
                  )}
                </div>
              )}
              {(f.conclusion.length > 120 || f.detail || (f.evidence_snippets && f.evidence_snippets.length > 0)) && (
                <button
                  onClick={() => toggleExpand(f.id)}
                  className="text-[7px] font-bold text-[#00A3C4] mt-1 hover:underline"
                >
                  {isExpanded ? "收起" : "展开详情"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 5: 报告（含扣分项、四维分数、行为验证） ──────────────────────────

function Step5Report({
  session,
  report,
  onSubmitApproval,
  onImportToStudio,
  onTargetedRerun,
  onRetryMemoSync,
  loading,
  passedLabel,
}: {
  session: SandboxSession;
  report: SandboxReport;
  onSubmitApproval: () => void;
  onImportToStudio?: () => void;
  onTargetedRerun?: (fixPlanItemIds?: string[]) => void;
  onRetryMemoSync?: () => void;
  loading: boolean;
  passedLabel: string;
}) {
  const p3 = report.part3_evaluation as {
    quality?: {
      passed: boolean;
      detail?: {
        avg_score?: number;
        avg_coverage?: number;
        avg_correctness?: number;
        avg_constraint?: number;
        avg_actionability?: number;
        top_deductions?: { dimension: string; points: number; reason: string; fix_suggestion: string }[];
        fix_plan?: string[];
      };
    };
    usability?: {
      passed: boolean;
      detail?: {
        input_burden_score?: number;
        first_turn_success_score?: number;
        compact_answer_score?: number;
        safe_compact_answer_score?: number;
        reason?: string;
        fix_suggestion?: string;
        thresholds?: { first_turn_success: number; safe_compact_answer: number; input_burden: number };
      };
    };
    anti_hallucination?: {
      passed: boolean;
      detail?: {
        keyword_checks?: { check: string; found: boolean }[];
        behavior_checks?: { prompt: string; response_preview?: string; passed: boolean; refused?: boolean; fabricated?: boolean; error?: string }[];
        keyword_passed?: boolean;
        behavior_passed?: boolean;
        suggestion?: string;
      };
    };
    top_issues?: { source: string; dimension: string; reason: string; points?: number }[];
    fix_plan?: string[];
    issues?: SandboxIssue[];
    fix_plan_structured?: SandboxFixPlanItem[];
    final_verdict?: { approval_eligible: boolean };
  };

  const issues = (p3.issues || []) as SandboxIssue[];
  const fixPlan = (p3.fix_plan_structured || []) as SandboxFixPlanItem[];
  const memoSyncStatus = session.step_statuses?.memo_sync as SandboxStepStatus | undefined;
  const memoSyncFailed = memoSyncStatus?.status === "failed";

  const p2 = report.part2_test_matrix as {
    theoretical_combo_count?: number;
    semantic_combo_count?: number;
    executed_case_count?: number;
    summary?: { passed: number; failed: number; error: number; skipped: number };
  };

  return (
    <div className="space-y-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
        沙盒测试报告
      </div>

      {/* 总判定 */}
      <div className={`border-2 px-3 py-2 text-xs font-bold ${
        session.approval_eligible
          ? "border-[#00CC99] bg-[#F0FFF4] text-[#00CC99]"
          : "border-red-400 bg-red-50 text-red-600"
      }`}>
        {session.approval_eligible
          ? "OK 三项全部通过，可提交审批"
          : "FAIL 未满足全部通过条件"
        }
      </div>

      {/* Memo 同步失败提示 */}
      {memoSyncFailed && (
        <div className="border-2 border-amber-400 bg-amber-50 px-3 py-2 flex items-center gap-2">
          <span className="text-[9px] font-bold text-amber-700 flex-1">
            报告已生成，但 Memo 同步失败：{memoSyncStatus?.error_message || "未知错误"}
          </span>
          {onRetryMemoSync && (
            <button
              className="text-[7px] font-bold text-[#00A3C4] border border-[#00A3C4] px-2 py-0.5 hover:bg-[#00A3C4] hover:text-white"
              onClick={onRetryMemoSync}
              disabled={loading}
            >
              重试同步
            </button>
          )}
        </div>
      )}

      {/* Part 1: 证据审查 */}
      {report.part1_evidence_check && (() => {
        const p1 = report.part1_evidence_check as {
          q1_input_slots?: { total_slots: number; verified: number; failed: number; slots?: { slot_key?: string; source_kind?: string; decision?: string; reason?: string }[] };
          q2_tool_review?: { total_tools: number; confirmed: number; must_call: number; no_need: number; tools?: { tool_name?: string; decision?: string; reason?: string }[] };
          q3_permission_review?: { total_tables: number; confirmed: number; tables?: { table_name?: string; decision?: string; reason?: string }[] };
        };
        return (
          <div className="border border-gray-200 bg-[#F8FAFB] rounded">
            <div className="px-3 py-1.5 border-b border-gray-100">
              <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Part 1 -- 证据审查</span>
            </div>
            <div className="px-3 py-2 space-y-2">
              {/* Q1 输入槽位 */}
              {p1.q1_input_slots && (
                <div>
                  <div className="text-[8px] font-bold text-gray-600 mb-1">
                    Q1 输入槽位: {p1.q1_input_slots.verified}/{p1.q1_input_slots.total_slots} 已验证
                    {p1.q1_input_slots.failed > 0 && <span className="text-red-500 ml-1">({p1.q1_input_slots.failed} 失败)</span>}
                  </div>
                  {p1.q1_input_slots.slots?.map((s, i) => (
                    <div key={i} className="ml-2 text-[8px] flex items-start gap-1.5">
                      <span className={s.decision === "verified" ? "text-green-600" : s.decision === "failed" ? "text-red-500" : "text-gray-400"}>
                        {s.decision === "verified" ? "OK" : s.decision === "failed" ? "FAIL" : "—"}
                      </span>
                      <span className="text-gray-600">{s.slot_key}</span>
                      <span className="text-gray-400">({s.source_kind})</span>
                      {s.reason && <span className="text-gray-400 truncate max-w-[200px]">{s.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
              {/* Q2 工具 */}
              {p1.q2_tool_review && (
                <div>
                  <div className="text-[8px] font-bold text-gray-600 mb-1">
                    Q2 工具: {p1.q2_tool_review.must_call} 必须调用 / {p1.q2_tool_review.no_need} 无需
                  </div>
                  {p1.q2_tool_review.tools?.map((t, i) => (
                    <div key={i} className="ml-2 text-[8px] flex items-center gap-1.5">
                      <span className={t.decision === "must_call" ? "text-[#00A3C4]" : "text-gray-400"}>
                        {t.decision === "must_call" ? "CALL" : t.decision === "no_need" ? "SKIP" : "—"}
                      </span>
                      <span className="text-gray-600">{t.tool_name}</span>
                      {t.reason && <span className="text-gray-400 truncate max-w-[200px]">{t.reason}</span>}
                    </div>
                  ))}
                </div>
              )}
              {/* Q3 权限 */}
              {p1.q3_permission_review && p1.q3_permission_review.total_tables > 0 && (
                <div>
                  <div className="text-[8px] font-bold text-gray-600 mb-1">
                    Q3 权限: {p1.q3_permission_review.confirmed}/{p1.q3_permission_review.total_tables} 已确认
                  </div>
                  {p1.q3_permission_review.tables?.map((t, i) => (
                    <div key={i} className="ml-2 text-[8px] flex items-center gap-1.5">
                      <span className={t.decision?.includes("confirmed") ? "text-green-600" : "text-gray-400"}>
                        {t.decision?.includes("confirmed") ? "OK" : "—"}
                      </span>
                      <span className="text-gray-600">{t.table_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Part 2: 测试矩阵 */}
      <div className="border border-gray-200 bg-[#F8FAFB] rounded">
        <div className="px-3 py-1.5 border-b border-gray-100">
          <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Part 2 -- 测试矩阵</span>
        </div>
        <div className="px-3 py-2 flex items-center gap-4 text-[8px]">
          <span>理论组合: {p2.theoretical_combo_count ?? 0}</span>
          <span>语义折叠: {p2.semantic_combo_count ?? 0}</span>
          <span>实际执行: {p2.executed_case_count ?? 0}</span>
        </div>
        {p2.summary && (
          <div className="px-3 pb-2 flex items-center gap-3 text-[8px]">
            <span className="text-green-600">通过 {p2.summary.passed}</span>
            <span className="text-red-600">失败 {p2.summary.failed}</span>
            <span className="text-amber-600">错误 {p2.summary.error}</span>
            <span className="text-gray-400">跳过 {p2.summary.skipped}</span>
          </div>
        )}
      </div>

      {/* 测试用例明细 */}
      {report.cases && report.cases.length > 0 && (
        <div className="border border-gray-200 bg-[#F8FAFB] rounded">
          <div className="px-3 py-1.5 border-b border-gray-100">
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">
              测试用例明细 ({report.cases.length})
            </span>
          </div>
          <div className="px-3 py-2 space-y-2 max-h-[300px] overflow-y-auto">
            {report.cases.map((c) => {
              const verdictColor = c.verdict === "pass" ? "text-green-600 bg-green-50 border-green-200"
                : c.verdict === "fail" ? "text-red-600 bg-red-50 border-red-200"
                : "text-gray-500 bg-gray-50 border-gray-200";
              return (
                <div key={c.case_index} className={`border rounded p-2 ${verdictColor}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-current/10">
                      #{c.case_index} {c.verdict?.toUpperCase() ?? "—"}
                    </span>
                    <span className="text-[7px] text-gray-400 flex gap-1.5">
                      {c.row_visibility && <span>行:{c.row_visibility}</span>}
                      {c.field_output_semantic && <span>字段:{c.field_output_semantic}</span>}
                      {c.tool_precondition && <span>工具:{c.tool_precondition}</span>}
                    </span>
                    {c.execution_duration_ms != null && (
                      <span className="text-[7px] text-gray-300 ml-auto">{c.execution_duration_ms}ms</span>
                    )}
                  </div>
                  {c.test_input && (
                    <div className="text-[8px] text-gray-600 mb-1">
                      <span className="font-bold text-gray-500">输入:</span> {c.test_input.length > 150 ? c.test_input.slice(0, 150) + "..." : c.test_input}
                    </div>
                  )}
                  {c.llm_response && (
                    <div className="text-[8px] text-gray-600 mb-1">
                      <span className="font-bold text-gray-500">输出:</span> {c.llm_response.length > 200 ? c.llm_response.slice(0, 200) + "..." : c.llm_response}
                    </div>
                  )}
                  {c.verdict_reason && (
                    <div className="text-[7px] text-gray-400">{c.verdict_reason.length > 150 ? c.verdict_reason.slice(0, 150) + "..." : c.verdict_reason}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Part 3: 评价 */}
      <div className="border border-gray-200 bg-[#F8FAFB] rounded">
        <div className="px-3 py-1.5 border-b border-gray-100">
          <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Part 3 -- 评价</span>
        </div>
        <div className="px-3 py-2 space-y-3">
          {/* 3.1 质量（四维 + 扣分项） */}
          <div>
            <EvalItem
              label="3.1 质量"
              passed={p3.quality?.passed ?? false}
              detail={`综合: ${p3.quality?.detail?.avg_score ?? "N/A"}`}
            />
            <div className="ml-4 flex items-center gap-3 mt-1">
              <ScoreBadge label="覆盖" score={p3.quality?.detail?.avg_coverage} />
              <ScoreBadge label="正确" score={p3.quality?.detail?.avg_correctness} />
              <ScoreBadge label="约束" score={p3.quality?.detail?.avg_constraint} />
              <ScoreBadge label="可行动" score={p3.quality?.detail?.avg_actionability} />
            </div>
            {p3.quality?.detail?.top_deductions && p3.quality.detail.top_deductions.length > 0 && (
              <div className="ml-4 mt-1.5 space-y-1">
                <div className="text-[8px] font-bold text-red-500">扣分项:</div>
                {p3.quality.detail.top_deductions.map((d, i) => (
                  <div key={i} className="text-[8px] text-red-600 bg-red-50 px-2 py-1 rounded">
                    [{d.dimension}] {d.points}分: {d.reason}
                    {d.fix_suggestion && (
                      <span className="text-amber-600 ml-1">-&gt; {d.fix_suggestion}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3.2 易用性（四维） */}
          <div>
            <EvalItem
              label="3.2 易用性"
              passed={p3.usability?.passed ?? false}
              detail=""
            />
            {p3.usability?.detail?.input_burden_score !== undefined && (
              <div className="ml-4 mt-1 space-y-1">
                <ScoreBar label="输入负担" score={p3.usability.detail.input_burden_score} threshold={p3.usability.detail.thresholds?.input_burden ?? 60} />
                <ScoreBar label="首轮成功" score={p3.usability.detail.first_turn_success_score ?? 0} threshold={p3.usability.detail.thresholds?.first_turn_success ?? 70} />
                <ScoreBar label="精简度" score={p3.usability.detail.compact_answer_score ?? 0} />
                <ScoreBar label="安全精简" score={p3.usability.detail.safe_compact_answer_score ?? 0} threshold={p3.usability.detail.thresholds?.safe_compact_answer ?? 70} />
              </div>
            )}
            {p3.usability?.detail?.reason && (
              <div className="ml-4 text-[8px] text-gray-500 mt-1">{p3.usability.detail.reason}</div>
            )}
            {p3.usability?.detail?.fix_suggestion && (
              <div className="ml-4 text-[8px] text-amber-600 mt-0.5">建议: {p3.usability.detail.fix_suggestion}</div>
            )}
          </div>

          {/* 3.3 反幻觉（关键词 + 行为验证） */}
          <div>
            <EvalItem
              label="3.3 幻觉限制"
              passed={p3.anti_hallucination?.passed ?? false}
              detail=""
            />
            {/* 关键词检查 */}
            {(p3.anti_hallucination?.detail?.keyword_checks || []).map((chk, i) => (
              <div key={i} className="ml-4 text-[8px]">
                <span className={chk.found ? "text-green-600" : "text-red-500"}>
                  {chk.found ? "OK" : "FAIL"} {chk.check}
                </span>
              </div>
            ))}
            {/* 行为验证 */}
            {p3.anti_hallucination?.detail?.behavior_checks && p3.anti_hallucination.detail.behavior_checks.length > 0 && (
              <div className="ml-4 mt-1.5">
                <div className="text-[8px] font-bold text-gray-500">行为验证:</div>
                {p3.anti_hallucination.detail.behavior_checks.map((bc, i) => (
                  <div key={i} className="text-[8px] mt-0.5">
                    <span className={bc.passed ? "text-green-600" : "text-red-500"}>
                      {bc.passed ? "OK" : "FAIL"} 场景: {bc.prompt.slice(0, 40)}...
                    </span>
                    {!bc.passed && bc.response_preview && (
                      <div className="text-red-400 ml-2 text-[7px]">模型回复: {bc.response_preview.slice(0, 100)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {p3.anti_hallucination?.detail?.suggestion && (
              <div className="ml-4 text-[8px] text-red-500 mt-0.5">
                建议: {p3.anti_hallucination.detail.suggestion}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 结构化问题清单 */}
      {issues.length > 0 && (
        <div className="border border-gray-200 bg-[#F8FAFB] rounded">
          <div className="px-3 py-1.5 border-b border-gray-100">
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">
              结构化问题 ({issues.length})
            </span>
          </div>
          <div className="px-3 py-2 space-y-2">
            {issues.map((issue) => {
              const severityColors: Record<string, string> = {
                critical: "border-red-300 bg-red-50",
                major: "border-amber-300 bg-amber-50",
                minor: "border-gray-300 bg-gray-50",
              };
              const severityLabels: Record<string, string> = {
                critical: "严重",
                major: "主要",
                minor: "轻微",
              };
              return (
                <div key={issue.issue_id} className={`border rounded p-2 ${severityColors[issue.severity] || "border-gray-200"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${
                      issue.severity === "critical" ? "bg-red-500 text-white" :
                      issue.severity === "major" ? "bg-amber-500 text-white" : "bg-gray-400 text-white"
                    }`}>
                      {severityLabels[issue.severity]}
                    </span>
                    <span className="text-[8px] font-bold text-gray-700">[{issue.dimension}]</span>
                    <span className="text-[7px] text-gray-400 ml-auto">{issue.target_kind}</span>
                  </div>
                  <div className="text-[8px] text-gray-700">{issue.reason}</div>
                  {issue.fix_suggestion && (
                    <div className="text-[8px] text-amber-600 mt-0.5">建议: {issue.fix_suggestion}</div>
                  )}
                  {issue.evidence_snippets.length > 0 && (
                    <div className="text-[7px] text-gray-400 mt-1 bg-gray-100 p-1 rounded font-mono truncate">
                      {issue.evidence_snippets[0].slice(0, 150)}
                    </div>
                  )}
                  {issue.target_ref && (
                    <div className="text-[7px] text-[#00A3C4] mt-0.5">目标: {issue.target_ref}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 结构化 Fix Plan */}
      {fixPlan.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/50 rounded">
          <div className="px-3 py-1.5 border-b border-amber-200">
            <span className="text-[8px] font-bold uppercase tracking-widest text-amber-600">
              整改计划 ({fixPlan.length})
            </span>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {fixPlan.map((fp) => (
              <div key={fp.id} className="flex items-start gap-2 text-[8px]">
                <span className={`flex-shrink-0 font-bold px-1 py-0.5 rounded text-[7px] ${
                  fp.priority === "p0" ? "bg-red-500 text-white" :
                  fp.priority === "p1" ? "bg-amber-500 text-white" : "bg-gray-400 text-white"
                }`}>
                  {fp.priority.toUpperCase()}
                </span>
                <div className="flex-1">
                  <div className="text-gray-700">{fp.title}</div>
                  {fp.acceptance_rule && (
                    <div className="text-gray-400 text-[7px]">验收: {fp.acceptance_rule}</div>
                  )}
                </div>
                {onTargetedRerun && fp.retest_scope.length > 0 && (
                  <button
                    className="flex-shrink-0 text-[7px] font-bold text-[#00CC99] border border-[#00CC99] px-1 py-0.5 hover:bg-[#00CC99] hover:text-white"
                    onClick={() => onTargetedRerun([fp.id])}
                    disabled={loading}
                  >
                    重测
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 兼容旧 Top Issues */}
      {issues.length === 0 && p3.top_issues && p3.top_issues.length > 0 && (
        <div className="border border-gray-200 bg-[#F8FAFB] rounded">
          <div className="px-3 py-1.5 border-b border-gray-100">
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Top Issues</span>
          </div>
          <div className="px-3 py-2 space-y-1">
            {p3.top_issues.map((issue: { source: string; reason: string }, i: number) => (
              <div key={i} className="text-[8px] text-gray-700">
                <span className="text-gray-400">[{issue.source}]</span> {issue.reason}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supporting 结论 */}
      <SupportingFindingsSection findings={report.supporting_findings} />

      {/* 报告元信息 */}
      <div className="text-[8px] text-gray-400 font-mono">
        报告 ID: {report.report_id} | 版本 v{report.target_version ?? "?"} | Hash: {report.report_hash?.slice(0, 12)} | 知识库 #{report.knowledge_entry_id}
      </div>

      {/* 操作按钮组 */}
      {!session.approval_eligible && fixPlan.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 px-3 py-1.5 text-[8px] text-amber-700 font-bold">
          共 {fixPlan.length} 项整改任务待完成，完成后才能提交审批
        </div>
      )}
      <div className="flex items-center gap-2 pt-2 flex-wrap">
        {session.approval_eligible && (
          <PixelButton onClick={onSubmitApproval} disabled={loading}>
            {loading ? "提交中..." : passedLabel}
          </PixelButton>
        )}
        {!session.approval_eligible && issues.length > 0 && onImportToStudio && (
          <PixelButton variant="secondary" onClick={onImportToStudio} disabled={loading}>
            导入 Skill Studio 整改
          </PixelButton>
        )}
        {!session.approval_eligible && fixPlan.length > 0 && onTargetedRerun && (
          <PixelButton variant="secondary" onClick={() => onTargetedRerun(fixPlan.map(fp => fp.id))} disabled={loading}>
            全部问题重测
          </PixelButton>
        )}
        <button
          className="text-[8px] font-bold uppercase tracking-widest border border-[#00A3C4] text-[#00A3C4] px-3 py-1.5 hover:bg-[#00A3C4] hover:text-white"
          onClick={() => downloadSandboxReport(report, "json")}
        >
          导出 JSON
        </button>
        <button
          className="text-[8px] font-bold uppercase tracking-widest border border-[#00A3C4] text-[#00A3C4] px-3 py-1.5 hover:bg-[#00A3C4] hover:text-white"
          onClick={() => downloadSandboxReport(report, "csv")}
        >
          导出 CSV
        </button>
      </div>
    </div>
  );
}

// ─── 导出报告辅助 ────────────────────────────────────────────────────────

function downloadSandboxReport(report: SandboxReport, format: "json" | "csv") {
  if (format === "json") {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sandbox-report-${report.report_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const p2 = report.part2_test_matrix as {
      cases?: { input: string; output: string; passed: boolean; score?: number }[];
    };
    const cases = p2?.cases ?? [];
    const header = "序号,输入,输出,通过,分数\n";
    const rows = cases.map((c, i) =>
      `${i + 1},"${(c.input || "").replace(/"/g, '""')}","${(c.output || "").replace(/"/g, '""')}",${c.passed ? "是" : "否"},${c.score ?? ""}`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sandbox-report-${report.report_id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// ─── 辅助组件 ──────────────────────────────────────────────────────────────

function EvalItem({ label, passed, detail }: { label: string; passed: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[9px] font-bold ${passed ? "text-[#00CC99]" : "text-red-500"}`}>
        {passed ? "OK" : "FAIL"}
      </span>
      <span className="text-[9px] font-bold text-gray-700">{label}</span>
      {detail && <span className="text-[8px] text-gray-400 ml-auto">{detail}</span>}
    </div>
  );
}

function ScoreBadge({ label, score }: { label: string; score?: number }) {
  if (score === undefined || score === null) return null;
  const color = score >= 70 ? "text-green-600 bg-green-50" : score >= 50 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";
  return (
    <span className={`text-[7px] font-bold px-1.5 py-0.5 rounded ${color}`}>
      {label}: {Math.round(score)}
    </span>
  );
}

function ScoreBar({ label, score, threshold }: { label: string; score: number; threshold?: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const passed = threshold ? score >= threshold : true;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[7px] text-gray-500 w-14 flex-shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded overflow-hidden relative">
        <div
          className={`h-full rounded ${passed ? "bg-[#00CC99]" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
        {threshold && (
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-400"
            style={{ left: `${threshold}%` }}
          />
        )}
      </div>
      <span className={`text-[7px] font-bold w-6 text-right ${passed ? "text-green-600" : "text-red-500"}`}>
        {Math.round(score)}
      </span>
    </div>
  );
}

// ─── Step 6: 知识引用安全检查 ───────────────────────────────────────────────

const DESENS_STEP_COLORS: Record<string, string> = {
  D0: "bg-gray-50 text-gray-500 border-gray-200",
  D1: "bg-blue-50 text-blue-600 border-blue-200",
  D2: "bg-yellow-50 text-yellow-600 border-yellow-200",
  D3: "bg-orange-50 text-orange-600 border-orange-200",
  D4: "bg-red-50 text-red-600 border-red-200",
};

function Step6KnowledgePrecheck({
  precheck,
  onPassed,
  blocked,
}: {
  precheck: SkillPublishPrecheck;
  onPassed: () => void;
  blocked: boolean;
}) {
  const { risk_summary: rs, references, block_reasons } = precheck;

  return (
    <div className="space-y-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">
        知识引用安全检查
      </div>

      {/* 风险摘要 */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "高敏感文件", value: rs.high_sensitivity_count, warn: rs.high_sensitivity_count > 0 },
          { label: "缺脱敏配置", value: rs.missing_mask_config_count, warn: rs.missing_mask_config_count > 0 },
          { label: "超出管理范围", value: rs.out_of_scope_count, warn: rs.out_of_scope_count > 0 },
          { label: "未确认", value: rs.unconfirmed_count, warn: rs.unconfirmed_count > 0 },
        ].map((item) => (
          <div
            key={item.label}
            className={`text-center p-2 rounded border ${item.warn ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}
          >
            <div className={`text-[14px] font-bold ${item.warn ? "text-red-600" : "text-green-600"}`}>{item.value}</div>
            <div className="text-[8px] text-gray-500">{item.label}</div>
          </div>
        ))}
      </div>

      {/* 阻断原因 */}
      {blocked && block_reasons.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded p-2 space-y-1">
          <div className="text-[9px] font-bold text-red-600">发布被阻断</div>
          {block_reasons.map((r, i) => (
            <div key={i} className="text-[8px] text-red-500">• {r}</div>
          ))}
        </div>
      )}

      {/* 引用文件表格 */}
      {references.length > 0 && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-[8px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-2 py-1 font-bold text-gray-600">文件名</th>
                <th className="text-left px-2 py-1 font-bold text-gray-600">目录</th>
                <th className="text-center px-2 py-1 font-bold text-gray-600">脱敏等级</th>
                <th className="text-left px-2 py-1 font-bold text-gray-600">命中数据类型</th>
                <th className="text-center px-2 py-1 font-bold text-gray-600">管理范围</th>
              </tr>
            </thead>
            <tbody>
              {references.map((ref) => (
                <tr key={ref.knowledge_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1 font-medium text-gray-700 max-w-[140px] truncate">{ref.title}</td>
                  <td className="px-2 py-1 text-gray-500 max-w-[120px] truncate">{ref.folder_path || "-"}</td>
                  <td className="px-2 py-1 text-center">
                    {ref.desensitization_level ? (
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[7px] font-bold ${DESENS_STEP_COLORS[ref.desensitization_level] || ""}`}>
                        {ref.desensitization_level}
                      </span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-2 py-1 text-gray-500">
                    {ref.data_type_hits.length > 0 ? ref.data_type_hits.map((h) => h.label).join(", ") : "-"}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {ref.manager_scope_ok
                      ? <span className="text-green-600 font-bold">✓</span>
                      : <span className="text-red-500 font-bold">✗</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {references.length === 0 && !blocked && (
        <div className="text-center py-4 text-[9px] text-gray-400">该 Skill 未引用知识文件，无需安全检查</div>
      )}

      <div className="flex justify-end pt-1">
        {blocked ? (
          <div className="text-[9px] text-red-500 font-bold">请先解决上述阻断问题后再发布</div>
        ) : (
          <PixelButton onClick={onPassed}>
            {references.length > 0 ? "安全检查通过，继续发布" : "继续发布"}
          </PixelButton>
        )}
      </div>
    </div>
  );
}
