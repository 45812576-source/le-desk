"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PixelButton } from "@/components/pixel/PixelButton";
import type {
  SandboxSession,
  SandboxReport,
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

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

// ─── Main Modal ─────────────────────────────────────────────────────────────

export function SandboxTestModal({
  type,
  id,
  name,
  onPassed,
  onCancel,
  passedLabel = "✓ 通过，继续发布",
}: SandboxTestModalProps) {
  const [session, setSession] = useState<SandboxSession | null>(null);
  const [report, setReport] = useState<SandboxReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);

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
      <div className="bg-white border-2 border-[#1A202C] w-[680px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-[#1A202C] bg-[#EBF4F7]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            交互式沙盒测试
          </span>
          <span className="text-xs font-bold text-[#1A202C] ml-1">— {name}</span>
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
                {wizardStep > idx ? "✓" : idx + 1} {label}
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
              ✕ {error}
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
              passedLabel={passedLabel}
              onSubmitApproval={async () => {
                setLoading(true);
                setError(null);
                try {
                  await apiFetch(
                    `/sandbox/interactive/${session.session_id}/submit-approval`,
                    { method: "POST" }
                  );
                  onPassed();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "提交审批失败");
                } finally {
                  setLoading(false);
                }
              }}
              loading={loading}
            />
          )}
        </div>

        {/* Footer */}
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
        交互式引导测试 — 从架构上杜绝大模型幻觉
      </div>
      <div className="text-[8px] text-gray-400 font-mono mb-4 max-w-md mx-auto">
        测试将分三步确认：输入槽位来源 → Tool 参数验证 → 权限快照确认<br />
        然后基于真实证据穷尽权限语义生成测试矩阵<br />
        禁止 LLM 在任何环节生成虚拟数据
      </div>
      <PixelButton onClick={onStart} disabled={loading}>
        {loading ? "初始化中..." : "开始测试"}
      </PixelButton>
    </div>
  );
}

// ─── Step 1: 输入槽位来源确认 ──────────────────────────────────────────────

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
        Q1 — 输入槽位来源确认
      </div>
      <div className="text-[8px] text-gray-400 font-mono mb-2">
        结构化数据必须从知识库/数据表取得，禁止 LLM 用虚拟数据
      </div>

      {session.detected_slots.map((slot) => {
        const edit = slotEdits[slot.slot_key] || { chosen_source: "", chat_example: "", knowledge_entry_id: "", rag_query: "", table_name: "", field_name: "" };
        return (
          <div key={slot.slot_key} className="border border-gray-200 bg-[#F8FAFB] rounded">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100">
              <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${slot.structured ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"}`}>
                {slot.structured ? "结构化" : "非结构化"}
              </span>
              {slot.required && <span className="text-[8px] font-bold text-red-500">必填</span>}
              <span className="text-[9px] font-bold text-gray-700">{slot.label}</span>
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

// ─── Step 2: Tool 确认 ──────────────────────────────────────────────────────

function Step2ToolReview({
  session,
  onSubmit,
  loading,
}: {
  session: SandboxSession;
  onSubmit: (tools: { tool_id: number; confirmed: boolean; input_provenance: { field_name: string; source_kind: string; source_ref: string }[] }[]) => void;
  loading: boolean;
}) {
  const [toolEdits, setToolEdits] = useState(() => {
    const edits: Record<number, {
      confirmed: boolean;
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
      edits[t.tool_id] = { confirmed: false, provenance: prov };
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
      const edit = toolEdits[t.tool_id] || { confirmed: false, provenance: {} };
      return {
        tool_id: t.tool_id,
        confirmed: edit.confirmed,
        input_provenance: Object.entries(edit.provenance).map(([field_name, p]) => ({
          field_name,
          source_kind: p.source_kind,
          source_ref: p.source_ref,
        })),
      };
    });
    onSubmit(tools);
  }

  return (
    <div className="space-y-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
        Q2 — Tool 确认与参数来源验证
      </div>
      <div className="text-[8px] text-gray-400 font-mono mb-2">
        检测绑定的 tool 数量和名称，确认每个 tool input 的数据来源
      </div>

      {session.tool_review.map((t) => {
        const edit = toolEdits[t.tool_id] || { confirmed: false, provenance: {} };
        return (
          <div key={t.tool_id} className="border border-gray-200 bg-[#F8FAFB] rounded">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <input
                type="checkbox"
                checked={edit.confirmed}
                onChange={(e) => setToolEdits((prev) => ({
                  ...prev,
                  [t.tool_id]: { ...prev[t.tool_id], confirmed: e.target.checked },
                }))}
                className="w-3 h-3"
              />
              <span className="text-[9px] font-bold text-gray-700">{t.tool_name}</span>
              <span className="text-[8px] text-gray-400 ml-auto">ID: {t.tool_id}</span>
            </div>
            {t.description && (
              <div className="px-3 py-1 text-[8px] text-gray-500">{t.description}</div>
            )}
            {t.input_provenance.length > 0 && (
              <div className="px-3 py-2 space-y-1.5">
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

// ─── Step 3: 权限快照确认 ──────────────────────────────────────────────────

function Step3PermissionReview({
  session,
  onSubmit,
  loading,
}: {
  session: SandboxSession;
  onSubmit: (tables: { table_name: string; confirmed: boolean; included_in_test: boolean }[]) => void;
  loading: boolean;
}) {
  const [tableEdits, setTableEdits] = useState(() => {
    const edits: Record<string, { confirmed: boolean; included_in_test: boolean }> = {};
    for (const snap of session.permission_snapshot || []) {
      edits[snap.table_name] = { confirmed: false, included_in_test: snap.included_in_test };
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
        Q3 — 权限快照确认
      </div>
      <div className="text-[8px] text-gray-400 font-mono mb-2">
        确认每个数据表的行可见范围、字段遮罩规则是否符合业务预期
      </div>

      {snapshots.map((snap) => {
        const edit = tableEdits[snap.table_name] || { confirmed: false, included_in_test: true };
        return (
          <div key={snap.table_name} className="border border-gray-200 bg-[#F8FAFB] rounded">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
              <input
                type="checkbox"
                checked={edit.confirmed}
                onChange={(e) => setTableEdits((prev) => ({
                  ...prev,
                  [snap.table_name]: { ...prev[snap.table_name], confirmed: e.target.checked },
                }))}
                className="w-3 h-3"
              />
              <span className="text-[9px] font-bold text-gray-700">{snap.display_name}</span>
              <span className="text-[8px] text-gray-400 font-mono">{snap.table_name}</span>
              {snap.warning && (
                <span className="text-[8px] text-red-500 ml-auto">{snap.warning}</span>
              )}
            </div>
            <div className="px-3 py-2 space-y-1">
              <div className="flex items-center gap-4 text-[8px]">
                <span className="text-gray-500">行可见范围:</span>
                <span className="font-mono text-gray-700">{snap.row_visibility}</span>
              </div>
              {snap.ownership_rules && Object.keys(snap.ownership_rules).length > 0 && (
                <div className="flex items-center gap-4 text-[8px]">
                  <span className="text-gray-500">Ownership:</span>
                  <span className="font-mono text-gray-700">
                    {String(snap.ownership_rules.owner_field ?? "无")} / {String(snap.ownership_rules.department_field ?? "无")}
                  </span>
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
              <div className="flex items-center gap-2 pt-1">
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
          </div>
        );
      })}

      <div className="pt-2">
        <PixelButton
          onClick={() => {
            const tables = snapshots.map((s) => ({
              table_name: s.table_name,
              confirmed: tableEdits[s.table_name]?.confirmed ?? false,
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
          生成用例 → 执行 → 评价中，请稍候...
        </div>
      ) : (
        <PixelButton onClick={onRun}>执行测试矩阵</PixelButton>
      )}
    </div>
  );
}

// ─── Step 5: 报告 ──────────────────────────────────────────────────────────

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
    quality?: { passed: boolean; detail?: { avg_score?: number } };
    usability?: { passed: boolean; detail?: { structured_input_count?: number } };
    anti_hallucination?: { passed: boolean; detail?: { checks?: { check: string; found: boolean }[]; suggestion?: string } };
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
          ? "✓ 三项全部通过，可提交审批"
          : "✗ 未满足全部通过条件"
        }
      </div>

      {/* Part 2: 测试矩阵 */}
      <div className="border border-gray-200 bg-[#F8FAFB] rounded">
        <div className="px-3 py-1.5 border-b border-gray-100">
          <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Part 2 — 测试矩阵</span>
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
          <span className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Part 3 — 评价</span>
        </div>
        <div className="px-3 py-2 space-y-2">
          <EvalItem
            label="3.1 质量"
            passed={p3.quality?.passed ?? false}
            detail={`平均分: ${p3.quality?.detail?.avg_score ?? "N/A"}`}
          />
          <EvalItem
            label="3.2 易用性"
            passed={p3.usability?.passed ?? false}
            detail={`结构化手动输入: ${p3.usability?.detail?.structured_input_count ?? 0} (阈值 5)`}
          />
          <div>
            <EvalItem
              label="3.3 幻觉限制"
              passed={p3.anti_hallucination?.passed ?? false}
              detail=""
            />
            {p3.anti_hallucination?.detail?.checks?.map((chk, i) => (
              <div key={i} className="ml-4 text-[8px]">
                <span className={chk.found ? "text-green-600" : "text-red-500"}>
                  {chk.found ? "✓" : "✗"} {chk.check}
                </span>
              </div>
            ))}
            {p3.anti_hallucination?.detail?.suggestion && (
              <div className="ml-4 text-[8px] text-red-500 mt-0.5">
                建议: {p3.anti_hallucination.detail.suggestion}
              </div>
            )}
          </div>
        </div>
      </div>

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

function EvalItem({ label, passed, detail }: { label: string; passed: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[9px] font-bold ${passed ? "text-[#00CC99]" : "text-red-500"}`}>
        {passed ? "✓" : "✗"}
      </span>
      <span className="text-[9px] font-bold text-gray-700">{label}</span>
      {detail && <span className="text-[8px] text-gray-400 ml-auto">{detail}</span>}
    </div>
  );
}
