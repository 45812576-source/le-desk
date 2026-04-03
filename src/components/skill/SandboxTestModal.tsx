"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PixelButton } from "@/components/pixel/PixelButton";
import type {
  SandboxSession,
  SandboxReport,
  SkillPublishPrecheck,
} from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SandboxTestModalProps {
  type: "skill" | "tool";
  id: number;
  name: string;
  onPassed: () => void;
  onCancel: () => void;
  passedLabel?: string;
}

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// ─── Main Modal ─────────────────────────────────────────────────────────────

export function SandboxTestModal({
  type,
  id,
  name,
  onPassed,
  onCancel,
  passedLabel = "OK 通过，继续发布",
}: SandboxTestModalProps) {
  const [session, setSession] = useState<SandboxSession | null>(null);
  const [report, setReport] = useState<SandboxReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [precheck, setPrecheck] = useState<SkillPublishPrecheck | null>(null);

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
                  setError(err instanceof Error ? err.message : "执行失败");
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
                  await apiFetch(
                    `/sandbox/interactive/${session.session_id}/submit-approval`,
                    { method: "POST" }
                  );
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
  loading,
}: {
  onRun: () => void;
  loading: boolean;
}) {
  return (
    <div className="text-center py-6">
      <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-2">
        三项检查全部通过，准备执行
      </div>
      <div className="text-[8px] text-gray-400 font-mono mb-4">
        将基于真实输入与权限语义矩阵生成测试用例并逐一执行
      </div>
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
          生成用例 -&gt; 执行 -&gt; 评价中，请稍候...
        </div>
      ) : (
        <PixelButton onClick={onRun}>执行测试矩阵</PixelButton>
      )}
    </div>
  );
}

// ─── Step 5: 报告（含扣分项、四维分数、行为验证） ──────────────────────────

function Step5Report({
  session,
  report,
  onSubmitApproval,
  loading,
  passedLabel,
}: {
  session: SandboxSession;
  report: SandboxReport;
  onSubmitApproval: () => void;
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
    final_verdict?: { approval_eligible: boolean };
  };

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

      {/* Top Issues + Fix Plan */}
      {p3.top_issues && p3.top_issues.length > 0 && (
        <div className="border border-gray-200 bg-[#F8FAFB] rounded">
          <div className="px-3 py-1.5 border-b border-gray-100">
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Top Issues</span>
          </div>
          <div className="px-3 py-2 space-y-1">
            {p3.top_issues.map((issue, i) => (
              <div key={i} className="text-[8px] text-gray-700">
                <span className="text-gray-400">[{issue.source}]</span> {issue.reason}
              </div>
            ))}
          </div>
        </div>
      )}
      {p3.fix_plan && p3.fix_plan.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/50 rounded">
          <div className="px-3 py-1.5 border-b border-amber-200">
            <span className="text-[8px] font-bold uppercase tracking-widest text-amber-600">Fix Plan</span>
          </div>
          <div className="px-3 py-2 space-y-1">
            {p3.fix_plan.map((fix, i) => (
              <div key={i} className="text-[8px] text-amber-700">
                {i + 1}. {fix}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 报告元信息 */}
      <div className="text-[8px] text-gray-400 font-mono">
        报告 ID: {report.report_id} | Hash: {report.report_hash?.slice(0, 12)} | 知识库 #{report.knowledge_entry_id}
      </div>

      {/* 提交审批 */}
      {session.approval_eligible && (
        <div className="pt-2">
          <PixelButton onClick={onSubmitApproval} disabled={loading}>
            {loading ? "提交中..." : passedLabel}
          </PixelButton>
        </div>
      )}
    </div>
  );
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
