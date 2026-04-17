"use client";

import React from "react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApprovalRequest } from "@/lib/types";
import { useSearchParams } from "next/navigation";
import { Check, X, Clock, FileText, Send, Inbox, ChevronDown, ChevronRight, Play, Shield, AlertTriangle, Package, Database, Tag, Wrench, MessageSquare, ClipboardCheck, Info } from "lucide-react";
import { SandboxTestModal } from "@/components/skill/SandboxTestModal";
import { FALLBACK_APPROVAL_TEMPLATES } from "@/lib/approval-templates";
import type { ApprovalTemplate, EvidenceItem, ApprovalCondition, SkillEvidenceDetail, ToolEvidenceDetail, WebAppEvidenceDetail, KnowledgeReviewDetail, KnowledgeEditDetail } from "@/lib/approval-templates";

type MainTab = "incoming" | "outgoing" | "all";

const TYPE_TABS: { key: string; label: string }[] = [
  { key: "", label: "全部" },
  { key: "skill_publish,skill_version_change,skill_ownership_transfer,tool_publish", label: "Skill" },
  { key: "knowledge_review", label: "知识审核" },
  { key: "knowledge_edit", label: "知识编辑" },
  { key: "webapp_publish", label: "Web APP" },
  { key: "org_memory_proposal,knowledge_scope_expand,knowledge_redaction_lower,skill_mount_org_memory", label: "组织 Memory" },
  { key: "scope_change,mask_override,schema_approval", label: "权限&脱敏" },
  { key: "export_sensitive,elevate_disclosure,grant_access,policy_change,field_sensitivity_change,small_sample_change", label: "数据安全" },
  { key: "permission_change", label: "权限变更" },
];

function requestTypeLabel(type: string): string {
  const map: Record<string, string> = {
    knowledge_edit: "文档编辑权限",
    knowledge_review: "知识审核",
    skill_publish: "Skill 首次发布",
    skill_version_change: "Skill 版本变更",
    skill_ownership_transfer: "Skill 所有权转让",
    tool_publish: "工具发布",
    webapp_publish: "应用发布",
    org_memory_proposal: "组织 Memory 草案",
    knowledge_scope_expand: "知识共享范围扩张",
    knowledge_redaction_lower: "知识匿名化要求降低",
    skill_mount_org_memory: "Skill 挂载审批",
    scope_change: "权限变更",
    mask_override: "脱敏覆盖",
    schema_approval: "Schema 审批",
    export_sensitive: "导出敏感数据",
    elevate_disclosure: "提升披露等级",
    grant_access: "授予访问权限",
    policy_change: "策略变更",
    field_sensitivity_change: "字段敏感级别变更",
    small_sample_change: "小样本保护变更",
    permission_change: "用户权限变更",
  };
  return map[type] || type;
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}天前`;
  return d.toLocaleDateString("zh-CN");
}

const CAT_COLOR: Record<string, string> = {
  example: "bg-green-100 text-green-700",
  "knowledge-base": "bg-cyan-100 text-cyan-700",
  reference: "bg-amber-100 text-amber-700",
  template: "bg-purple-100 text-purple-700",
};

const SCOPE_LABEL: Record<string, string> = {
  self_only: "仅创建者",
  same_role: "同岗位",
  cross_role: "跨岗位",
  org_wide: "全员",
};

const RISK_COLOR: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
};

const RISK_BAR_STYLE: Record<string, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-400 text-amber-900",
  low: "bg-green-500 text-white",
};

const FILE_CAT_ORDER = ["tool", "knowledge-base", "example", "template", "reference"];

function CollapsibleSection({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full px-3 py-2 bg-muted/50 hover:bg-muted transition-colors text-left">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {icon}
        <span className="text-[10px] font-medium text-foreground uppercase tracking-wider">{title}</span>
      </button>
      {open && <div className="px-3 py-2 space-y-2">{children}</div>}
    </div>
  );
}

interface AdminApprovalResponse {
  total: number;
  page: number;
  page_size: number;
  items: ApprovalRequest[];
}

// ─── 审查清单条目状态 ────────────────────────────────────────────────────────
type ChecklistItemStatus = "confirmed" | "rejected" | "need_info";

interface ChecklistState {
  status: ChecklistItemStatus;
  note: string;
}

// ─── 风险摘要条 ──────────────────────────────────────────────────────────────
function RiskSummaryBar({ riskLevel, evidenceComplete, missingCount }: { riskLevel: string | null; evidenceComplete: boolean; missingCount: number }) {
  let style = "bg-green-500 text-white";
  let text = "低风险 · 资料齐全";
  if (riskLevel === "high" || (!evidenceComplete && missingCount > 2)) {
    style = "bg-red-500 text-white";
    text = `${riskLevel === "high" ? "高风险" : "风险待评估"} · 缺少 ${missingCount} 项资料`;
  } else if (riskLevel === "medium" || !evidenceComplete) {
    style = "bg-amber-400 text-amber-900";
    text = `${riskLevel === "medium" ? "中风险" : "风险待评估"}${!evidenceComplete ? ` · 缺少 ${missingCount} 项资料` : " · 资料齐全"}`;
  } else if (riskLevel === "high") {
    style = "bg-red-500 text-white";
    text = "高风险 · 资料齐全";
  }
  return (
    <div className={`px-3 py-1.5 rounded-md text-[10px] font-medium ${style}`}>
      {text}
    </div>
  );
}

// ─── 区块 B：证据包 ──────────────────────────────────────────────────────────
function EvidencePackSection({ request, template }: { request: ApprovalRequest; template: ApprovalTemplate | null }) {
  const evidence = request.evidence_pack || {};
  const items = template?.required_evidence || [];

  if (items.length === 0) {
    return <div className="text-xs text-muted-foreground italic">该类型暂无证据模板</div>;
  }

  return (
    <div className="space-y-2">
      {!request.evidence_complete && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-[10px] font-medium">
          <AlertTriangle size={12} />
          资料不足，无法通过审批 — 缺少: {request.missing_evidence.map(k => items.find(i => i.key === k)?.label || k).join("、")}
        </div>
      )}
      {items.map((item) => {
        const value = evidence[item.key];
        const hasValue = value != null && value !== "" && !(typeof value === "object" && (value as Record<string, unknown>)?._status === "pending_integration");
        const isPending = typeof value === "object" && (value as Record<string, unknown>)?._status === "pending_integration";

        return (
          <EvidenceItemRow key={item.key} item={item} hasValue={hasValue} isPending={isPending} value={value} />
        );
      })}
    </div>
  );
}

function EvidenceItemRow({ item, hasValue, isPending, value }: { item: EvidenceItem; hasValue: boolean; isPending: boolean; value: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded">
      <button
        onClick={() => hasValue && setOpen(!open)}
        className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-[10px] ${hasValue ? "hover:bg-muted/50 cursor-pointer" : ""}`}
      >
        {hasValue ? (
          <span className="text-green-600 flex-shrink-0">&#10003;</span>
        ) : isPending ? (
          <span className="text-amber-500 flex-shrink-0">&#8635;</span>
        ) : (
          <span className="text-red-500 flex-shrink-0">&#10007;</span>
        )}
        <span className={`font-medium ${!hasValue && !isPending ? "text-red-600" : "text-foreground"}`}>{item.label}</span>
        {item.required && <span className="text-red-400 text-[8px]">*</span>}
        {item.auto && <span className="text-[8px] text-muted-foreground ml-1">(自动采集)</span>}
        {isPending && <span className="text-[8px] text-amber-600 ml-1">待系统对接</span>}
        {hasValue && <span className="ml-auto text-muted-foreground">{open ? "▼" : "▶"}</span>}
      </button>
      {open && hasValue && (
        <div className="border-t border-border px-2.5 py-2 bg-muted/20">
          <pre className="text-[10px] text-foreground whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
            {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── 区块 C：审批清单 ────────────────────────────────────────────────────────
function ReviewChecklistSection({
  checklist,
  checklistState,
  onUpdate,
}: {
  checklist: string[];
  checklistState: ChecklistState[];
  onUpdate: (index: number, state: ChecklistState) => void;
}) {
  return (
    <div className="space-y-1.5">
      {checklist.map((item, i) => {
        const state = checklistState[i] || { status: "confirmed" as const, note: "" };
        return (
          <div key={i} className="flex items-start gap-2 group">
            <div className="flex gap-0.5 mt-0.5 flex-shrink-0">
              {(["confirmed", "rejected", "need_info"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdate(i, { ...state, status: s })}
                  className={`w-5 h-5 rounded text-[8px] font-bold flex items-center justify-center border transition-colors ${
                    state.status === s
                      ? s === "confirmed" ? "bg-green-500 text-white border-green-500"
                      : s === "rejected" ? "bg-red-500 text-white border-red-500"
                      : "bg-amber-400 text-amber-900 border-amber-400"
                      : "bg-background border-border text-muted-foreground hover:border-foreground"
                  }`}
                  title={s === "confirmed" ? "已确认" : s === "rejected" ? "不通过" : "待补资料"}
                >
                  {s === "confirmed" ? "✓" : s === "rejected" ? "✗" : "?"}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[10px] ${state.status === "rejected" ? "text-red-600 font-medium" : "text-foreground"}`}>
                {item}
              </div>
              <input
                type="text"
                value={state.note}
                onChange={(e) => onUpdate(i, { ...state, note: e.target.value })}
                placeholder="短评（可选）"
                className="mt-0.5 w-full text-[9px] px-1.5 py-0.5 border border-transparent hover:border-border focus:border-primary rounded bg-transparent text-muted-foreground focus:text-foreground focus:outline-none transition-colors"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 区块 D：审批结论面板 ────────────────────────────────────────────────────
// 高风险类型：禁止 approve_with_conditions（执行层未打通）
const AWC_BLOCKED_TYPES = new Set([
  "export_sensitive", "elevate_disclosure", "grant_access",
  "policy_change", "field_sensitivity_change", "small_sample_change",
  "scope_change", "mask_override", "schema_approval",
]);

function DecisionPanel({
  requestId,
  requestType,
  evidenceComplete,
  approveBlocked,
  missingEvidence,
  onAction,
  acting,
  checklistState,
  checklistRequired,
}: {
  requestId: number;
  requestType: string;
  evidenceComplete: boolean;
  approveBlocked: boolean;
  missingEvidence: string[];
  onAction: (requestId: number, action: string, payload: Record<string, unknown>) => void;
  acting: boolean;
  checklistState: ChecklistState[];
  checklistRequired: number;  // 清单总项数
}) {
  const [decision, setDecision] = useState<string>("");
  const [comment, setComment] = useState("");
  const [riskJudgement, setRiskJudgement] = useState<string>("");
  // Fix 4: 结构化条件
  const [structuredConditions, setStructuredConditions] = useState<ApprovalCondition[]>([]);
  const [requestMoreInfoText, setRequestMoreInfoText] = useState("");

  // Fix 2: 审批清单硬约束
  const rejectedCount = checklistState.filter((c) => c.status === "rejected").length;
  const needInfoCount = checklistState.filter((c) => c.status === "need_info").length;
  const allConfirmed = checklistRequired > 0
    ? checklistState.length === checklistRequired && rejectedCount === 0 && needInfoCount === 0
    : true;

  function addCondition() {
    setStructuredConditions((prev) => [...prev, { type: "custom", label: "", value: "" }]);
  }
  function updateCondition(index: number, field: keyof ApprovalCondition, val: string) {
    setStructuredConditions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  }
  function removeCondition(index: number) {
    setStructuredConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (!decision) return;
    const finalComment = decision === "request_more_info" ? (requestMoreInfoText || comment) : comment;
    const payload: Record<string, unknown> = {
      comment: finalComment || null,
      decision_payload: {
        risk_judgement: riskJudgement || null,
      },
    };
    if (decision === "approve_with_conditions") {
      const validConditions = structuredConditions.filter((c) => c.label && c.value);
      if (validConditions.length === 0) return;
      payload.conditions = validConditions;
    }
    onAction(requestId, decision, payload);
  }

  const canApprove = evidenceComplete && allConfirmed && !approveBlocked;
  const awcBlocked = AWC_BLOCKED_TYPES.has(requestType);
  // 清单闸门：rejected → 只能 reject, need_info → 只能 reject/request_more_info
  const hasRejected = rejectedCount > 0;
  const hasNeedInfo = needInfoCount > 0;

  function isButtonDisabled(key: string): boolean {
    if (hasRejected) return key !== "reject";
    if (hasNeedInfo) return key !== "reject" && key !== "request_more_info";
    if (key === "approve" || key === "approve_with_conditions") return !canApprove || (key === "approve_with_conditions" && awcBlocked);
    return false;
  }
  function buttonTitle(key: string): string | undefined {
    if (hasRejected && key !== "reject") return "清单有未通过项，只能选择驳回";
    if (hasNeedInfo && key !== "reject" && key !== "request_more_info") return "清单有待补充项，只能选择驳回或要求补充";
    if ((key === "approve" || key === "approve_with_conditions") && !canApprove) {
      if (approveBlocked) return "高风险类型缺少必填证据";
      return "证据不完整或清单未确认";
    }
    if (key === "approve_with_conditions" && awcBlocked) return "该类型不支持附条件通过";
    return undefined;
  }

  return (
    <div className="space-y-3">
      {/* 高风险硬阻断警告 */}
      {approveBlocked && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-300">
          <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-medium text-red-700">高风险类型：审批已被系统阻断</div>
            <div className="text-[10px] text-red-600 mt-0.5">
              缺少 {missingEvidence.length} 项必填证据，高风险审批必须提供全部真实证据才能通过。
              请通知申请人补齐后重新提交。
            </div>
          </div>
        </div>
      )}

      {/* 清单闸门警告 */}
      {hasRejected && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-[10px] font-medium">
          <AlertTriangle size={12} />
          清单有 {rejectedCount} 项未通过，只能选择“驳回”
        </div>
      )}
      {!hasRejected && hasNeedInfo && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium">
          <AlertTriangle size={12} />
          清单有 {needInfoCount} 项待补充，只能选择“驳回”或“要求补充”
        </div>
      )}

      {/* 决定 */}
      <div>
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">审批决定</div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            { key: "approve", label: "通过", color: "bg-green-500 text-white" },
            { key: "reject", label: "驳回", color: "bg-red-500 text-white" },
            { key: "request_more_info", label: "要求补充", color: "bg-amber-500 text-white" },
            { key: "approve_with_conditions", label: "附条件通过", color: "bg-blue-500 text-white" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDecision(opt.key)}
              disabled={isButtonDisabled(opt.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                decision === opt.key ? opt.color : "bg-muted text-muted-foreground hover:text-foreground"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              title={buttonTitle(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {!canApprove && !approveBlocked && !hasRejected && !hasNeedInfo && !evidenceComplete && (
          <div className="text-[9px] text-red-500 mt-1">
            证据包不完整，无法选择“通过”或“附条件通过”
          </div>
        )}
      </div>

      {/* 理由 */}
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">理由（必填）</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="w-full border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground resize-none"
          placeholder="请输入审批理由…"
        />
      </div>

      {/* 风险判断 */}
      <div>
        <label className="text-[10px] font-medium text-muted-foreground block mb-1">风险判断</label>
        <div className="flex gap-1.5">
          {(["high", "medium", "low"] as const).map((level) => (
            <button
              key={level}
              onClick={() => setRiskJudgement(level)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                riskJudgement === level ? RISK_BAR_STYLE[level] : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {level === "high" ? "高" : level === "medium" ? "中" : "低"}
            </button>
          ))}
        </div>
      </div>

      {/* Fix 4: 结构化限制条件 */}
      {decision === "approve_with_conditions" && (
        <div className="space-y-2">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">限制条件</div>
          {structuredConditions.map((cond, i) => (
            <div key={i} className="flex items-start gap-1.5 bg-muted/50 rounded-md p-2">
              <select
                value={cond.type}
                onChange={(e) => updateCondition(i, "type", e.target.value as ApprovalCondition["type"])}
                className="border border-border rounded px-1.5 py-1 text-[10px] bg-background text-foreground w-28 flex-shrink-0"
              >
                <option value="scope_limit">范围限制</option>
                <option value="effective_until">有效期限</option>
                <option value="requires_followup_review">后续复审</option>
                <option value="allowed_targets">允许对象</option>
                <option value="custom">自定义</option>
              </select>
              <input
                value={cond.label}
                onChange={(e) => updateCondition(i, "label", e.target.value)}
                placeholder="条件名称"
                className="border border-border rounded px-2 py-1 text-[10px] bg-background text-foreground flex-1 min-w-0"
              />
              <input
                value={cond.value}
                onChange={(e) => updateCondition(i, "value", e.target.value)}
                placeholder="条件内容"
                className="border border-border rounded px-2 py-1 text-[10px] bg-background text-foreground flex-[2] min-w-0"
              />
              {cond.type === "effective_until" && (
                <input
                  type="date"
                  value={cond.expires_at || ""}
                  onChange={(e) => updateCondition(i, "expires_at", e.target.value)}
                  className="border border-border rounded px-1.5 py-1 text-[10px] bg-background text-foreground w-32 flex-shrink-0"
                />
              )}
              <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-600 text-xs flex-shrink-0 px-1">×</button>
            </div>
          ))}
          <button onClick={addCondition} className="text-[10px] text-primary hover:underline">+ 添加条件</button>
        </div>
      )}

      {/* 要求补充信息 */}
      {decision === "request_more_info" && (
        <div>
          <label className="text-[10px] font-medium text-muted-foreground block mb-1">需要补充的信息（必填）</label>
          <textarea
            value={requestMoreInfoText}
            onChange={(e) => setRequestMoreInfoText(e.target.value)}
            rows={3}
            className="w-full border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground resize-none"
            placeholder="请详细说明需要补充哪些材料…"
          />
        </div>
      )}

      {/* 提交 */}
      <button
        onClick={handleSubmit}
        disabled={!decision || !comment || acting || (decision === "approve_with_conditions" && structuredConditions.filter(c => c.label && c.value).length === 0) || (decision === "request_more_info" && !requestMoreInfoText.trim())}
        className="px-4 py-2 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        {acting ? "提交中…" : "提交审批结论"}
      </button>
    </div>
  );
}

// ─── ApprovalWorkbench 四区块统一组件 ────────────────────────────────────────
function ApprovalWorkbench({
  request,
  showActions,
  onAction,
  acting,
  fileContents,
  fileLoading,
  onLoadFile,
  onSandbox,
  templates,
  currentUserId,
  onRefresh,
}: {
  request: ApprovalRequest;
  showActions: boolean;
  onAction: (requestId: number, action: string, payload: Record<string, unknown>) => void;
  acting: boolean;
  fileContents: Record<string, string>;
  fileLoading: string | null;
  onLoadFile: (skillId: number, filename: string) => void;
  onSandbox: (item: { id: number; name: string }) => void;
  templates: Record<string, ApprovalTemplate>;
  currentUserId?: number;
  onRefresh?: () => void;
}) {
  const detail: Record<string, unknown> = (request.target_detail || {}) as Record<string, unknown>;
  const template = templates[request.request_type] || null;
  const isPending = request.status === "pending";

  // 审查清单状态
  const [checklistState, setChecklistState] = useState<ChecklistState[]>(
    () => (template?.review_checklist || []).map(() => ({ status: "confirmed" as const, note: "" }))
  );

  function updateChecklist(index: number, state: ChecklistState) {
    setChecklistState((prev) => {
      const next = [...prev];
      next[index] = state;
      return next;
    });
  }

  return (
    <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-3">
      {/* 风险摘要条 */}
      <RiskSummaryBar
        riskLevel={request.risk_level}
        evidenceComplete={request.evidence_complete}
        missingCount={request.missing_evidence?.length || 0}
      />

      {/* 决策聚焦 */}
      {template && (
        <div className="flex items-start gap-1.5 text-[10px] text-primary">
          <Info size={12} className="mt-0.5 flex-shrink-0" />
          <span className="font-medium">审查焦点: {template.decision_focus}</span>
        </div>
      )}

      {/* ═══ 区块 A：申请信息 ═══ */}
      <CollapsibleSection title="申请信息" icon={<FileText size={12} className="text-blue-600" />}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
          <div><span className="text-muted-foreground">发起人:</span> <span className="text-foreground font-medium">{request.requester_name}</span></div>
          <div><span className="text-muted-foreground">发起时间:</span> <span className="text-foreground">{formatTime(request.created_at)}</span></div>
          <div><span className="text-muted-foreground">变更对象:</span> <span className="text-foreground font-medium">{String(detail.title || detail.name || `#${request.target_id}`)}</span></div>
          <div><span className="text-muted-foreground">类型:</span> <span className="text-foreground">{requestTypeLabel(request.request_type)}</span></div>
          {request.reason && <div className="col-span-2"><span className="text-muted-foreground">原因:</span> <span className="text-foreground">{request.reason}</span></div>}
          {request.impact_summary && <div className="col-span-2"><span className="text-muted-foreground">影响范围:</span> <span className="text-foreground">{request.impact_summary}</span></div>}
          {request.risk_level && (
            <div><span className="text-muted-foreground">风险级别:</span> <span className={`px-1.5 py-0.5 rounded-full font-medium ${RISK_COLOR[request.risk_level] || "bg-gray-100 text-gray-600"}`}>{request.risk_level}</span></div>
          )}
          <div><span className="text-muted-foreground">状态:</span> <StatusBadge status={request.status} /></div>
          {request.stage && <div><span className="text-muted-foreground">阶段:</span> <span className="text-foreground">{request.stage === "super_pending" ? "待超管终审" : request.stage === "dept_pending" ? "待首轮审批" : request.stage === "needs_info" ? "待补充材料" : request.stage}</span></div>}
        </div>

        {/* 审批历史 */}
        {request.actions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">审批历史</div>
            {request.actions.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-[10px] py-0.5">
                <span className="text-muted-foreground">{formatTime(a.created_at)}</span>
                <span className="font-medium text-foreground">{a.actor_name}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                  a.action === "approve" ? "bg-green-100 text-green-700"
                  : a.action === "reject" ? "bg-red-100 text-red-700"
                  : a.action === "request_more_info" ? "bg-blue-100 text-blue-700"
                  : a.action === "withdraw" ? "bg-gray-100 text-gray-600"
                  : a.action === "approve_with_conditions" ? "bg-purple-100 text-purple-700"
                  : "bg-amber-100 text-amber-700"
                }`}>
                  {a.action === "approve" ? "通过" : a.action === "reject" ? "拒绝" : a.action === "request_more_info" ? "要求补充" : a.action === "withdraw" ? "撤回" : a.action === "approve_with_conditions" ? "附条件通过" : "附条件"}
                </span>
                {a.comment && <span className="text-muted-foreground truncate">{a.comment}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Skill 特有：沙盒测试按钮 */}
        {isPending && request.target_id && (request.request_type === "skill_publish" || request.request_type === "tool_publish") && (
          <div className="mt-2">
            <button
              onClick={() => onSandbox({ id: request.target_id!, name: String(detail.name || "") })}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
            >
              <Play size={10} />
              沙盒测试
            </button>
          </div>
        )}
      </CollapsibleSection>

      {/* ═══ 区块 B：证据包 ═══ */}
      <CollapsibleSection title="证据包" icon={<Package size={12} className="text-cyan-600" />}>
        <EvidencePackSection request={request} template={template} />

        {/* 类型特有内容嵌入 */}
        <TypeSpecificEvidence
          request={request}
          detail={detail}
          fileContents={fileContents}
          fileLoading={fileLoading}
          onLoadFile={onLoadFile}
        />
      </CollapsibleSection>

      {/* ═══ 区块 C：审批清单（仅审批人可见，pending 状态） ═══ */}
      {showActions && isPending && template && template.review_checklist.length > 0 && (
        <CollapsibleSection title="审批清单" icon={<ClipboardCheck size={12} className="text-amber-600" />}>
          <ReviewChecklistSection
            checklist={template.review_checklist}
            checklistState={checklistState}
            onUpdate={updateChecklist}
          />
          {template.approval_criteria && (
            <div className="mt-2 text-[9px] text-muted-foreground">
              <span className="font-medium text-green-600">通过标准:</span> {template.approval_criteria}
            </div>
          )}
          {template.rejection_criteria && (
            <div className="text-[9px] text-muted-foreground">
              <span className="font-medium text-red-600">驳回标准:</span> {template.rejection_criteria}
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* ═══ 区块 D：审批结论面板（仅审批人可见，pending 状态） ═══ */}
      {showActions && isPending && (
        <CollapsibleSection title="审批结论" icon={<MessageSquare size={12} className="text-green-600" />}>
          <DecisionPanel
            requestId={request.id}
            requestType={request.request_type}
            evidenceComplete={request.evidence_complete}
            approveBlocked={request.approve_blocked}
            missingEvidence={request.missing_evidence || []}
            onAction={(id, action, payload) => {
              // 附带 checklist_result
              const clResult = checklistState.map((s, i) => ({
                item: template?.review_checklist[i] || `#${i}`,
                status: s.status,
                note: s.note || undefined,
              }));
              onAction(id, action, { ...payload, checklist_result: clResult });
            }}
            acting={acting}
            checklistState={checklistState}
            checklistRequired={template?.review_checklist?.length || 0}
          />
        </CollapsibleSection>
      )}

      {/* Fix 3: 待补充证据面板（发起人视角，needs_info 阶段） */}
      {request.stage === "needs_info" && currentUserId === request.requester_id && (
        <SupplementEvidencePanel
          requestId={request.id}
          needsInfoComment={request.needs_info_comment}
          missingEvidence={request.missing_evidence || []}
          template={template}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

// ─── 补充证据面板（按缺失项逐条填写）────────────────────────────────────────
function SupplementEvidencePanel({
  requestId,
  needsInfoComment,
  missingEvidence,
  template,
  onRefresh,
}: {
  requestId: number;
  needsInfoComment: string | null | undefined;
  missingEvidence: string[];
  template: ApprovalTemplate | null;
  onRefresh?: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [supplementComment, setSupplementComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);

  // 构建需要补充的条目列表
  const missingItems = (template?.required_evidence || []).filter(
    (item) => missingEvidence.includes(item.key)
  );
  // 如果 missingEvidence 有模板中没有的 key，也列出来
  const extraKeys = missingEvidence.filter(
    (k) => !missingItems.some((i) => i.key === k)
  );

  function updateField(key: string, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const filledCount = Object.values(fields).filter((v) => v.trim()).length;
  const totalRequired = missingItems.filter((i) => i.required).length + extraKeys.length;

  async function handleSubmit() {
    if (filledCount === 0) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const evidence_pack: Record<string, string> = {};
      for (const [key, val] of Object.entries(fields)) {
        if (val.trim()) evidence_pack[key] = val.trim();
      }
      const res = await apiFetch(`/approvals/${requestId}/supplement`, {
        method: "POST",
        body: JSON.stringify({
          evidence_pack,
          comment: supplementComment || null,
        }),
      });
      const data = res as Record<string, unknown>;
      if (data.supplement_warning) {
        setSubmitResult(String(data.supplement_warning));
      } else {
        setSubmitResult(null);
      }
      onRefresh?.();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "提交失败");
    }
    setSubmitting(false);
  }

  return (
    <CollapsibleSection title="补充材料" icon={<Info size={12} className="text-amber-600" />} defaultOpen>
      {needsInfoComment && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2">
          <div className="text-[10px] font-medium text-amber-700 mb-0.5">审批人要求补充:</div>
          <div className="text-xs text-amber-900">{needsInfoComment}</div>
        </div>
      )}
      {submitResult && (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2">
          <div className="text-[10px] font-medium text-amber-700">{submitResult}</div>
        </div>
      )}
      <div className="space-y-3">
        {missingItems.length === 0 && extraKeys.length === 0 && (
          <div className="text-xs text-muted-foreground italic">无具体缺失项信息</div>
        )}
        {missingItems.map((item) => (
          <div key={item.key}>
            <label className="text-[10px] font-medium text-foreground">
              {item.label} {item.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={fields[item.key] || ""}
              onChange={(e) => updateField(item.key, e.target.value)}
              rows={2}
              className="w-full mt-0.5 border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground resize-none"
              placeholder={`请填写${item.label}…`}
            />
          </div>
        ))}
        {extraKeys.map((key) => (
          <div key={key}>
            <label className="text-[10px] font-medium text-foreground">{key} <span className="text-red-500">*</span></label>
            <textarea
              value={fields[key] || ""}
              onChange={(e) => updateField(key, e.target.value)}
              rows={2}
              className="w-full mt-0.5 border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground resize-none"
              placeholder={`请填写${key}…`}
            />
          </div>
        ))}
        <textarea
          value={supplementComment}
          onChange={(e) => setSupplementComment(e.target.value)}
          rows={1}
          className="w-full border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground resize-none"
          placeholder="补充说明（可选）"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={filledCount === 0 || submitting}
            className="px-4 py-1.5 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-opacity"
          >
            {submitting ? "提交中…" : "提交补充材料"}
          </button>
          <span className="text-[10px] text-muted-foreground">
            已填 {filledCount}/{totalRequired} 项必填
          </span>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ─── 类型特有证据内容 ────────────────────────────────────────────────────────
function TypeSpecificEvidence({
  request,
  detail,
  fileContents,
  fileLoading,
  onLoadFile,
}: {
  request: ApprovalRequest;
  detail: Record<string, unknown>;
  fileContents: Record<string, string>;
  fileLoading: string | null;
  onLoadFile: (skillId: number, filename: string) => void;
}) {
  const isSkill = ["skill_publish", "skill_version_change", "skill_ownership_transfer"].includes(request.request_type);
  const isTool = request.request_type === "tool_publish";
  const isWebApp = request.request_type === "webapp_publish";
  const isKnowledgeReview = request.request_type === "knowledge_review";
  const isKnowledgeEdit = request.request_type === "knowledge_edit";
  const isPermissionChange = request.request_type === "permission_change";
  const isOrgMemory = [
    "org_memory_proposal",
    "knowledge_scope_expand",
    "knowledge_redaction_lower",
    "skill_mount_org_memory",
  ].includes(request.request_type);

  if (isSkill) {
    return <SkillEvidenceContent detail={detail as SkillEvidenceDetail} targetId={request.target_id} fileContents={fileContents} fileLoading={fileLoading} onLoadFile={onLoadFile} securityScanResult={request.security_scan_result} />;
  }
  if (isTool) {
    return <ToolEvidenceContent detail={detail as ToolEvidenceDetail} />;
  }
  if (isWebApp) {
    return <WebAppEvidenceContent detail={detail as WebAppEvidenceDetail} />;
  }
  if (isKnowledgeReview) {
    return <KnowledgeReviewContent detail={detail as KnowledgeReviewDetail} />;
  }
  if (isKnowledgeEdit) {
    return <KnowledgeEditContent detail={detail as KnowledgeEditDetail} reason={request.reason} requesterName={request.requester_name} />;
  }
  if (isPermissionChange) {
    return <PermissionChangeContent detail={detail} />;
  }
  if (isOrgMemory) {
    return <OrgMemoryEvidenceContent requestType={request.request_type} detail={detail} />;
  }
  return null;
}

function SkillEvidenceContent({ detail, targetId, fileContents, fileLoading, onLoadFile, securityScanResult }: {
  detail: SkillEvidenceDetail;
  targetId: number | null;
  fileContents: Record<string, string>;
  fileLoading: string | null;
  onLoadFile: (skillId: number, filename: string) => void;
  securityScanResult?: Record<string, unknown> | null;
}) {
  const sourceFiles = detail.source_files || [];
  const knowledgeTags = detail.knowledge_tags || [];
  const dataQueries = detail.data_queries || [];
  const boundTools = detail.bound_tools || [];
  const scanResult = (securityScanResult || {}) as Record<string, unknown>;
  const suggestedPolicy = scanResult.suggested_policy as { publish_scope?: string; risk_level?: string; role_overrides?: { position_name: string; callable: boolean; data_scope: string }[]; mask_overrides?: { field: string; action: string; position_name: string }[] } | null;

  const filesByCategory = sourceFiles.reduce<Record<string, { filename: string; category: string }[]>>((acc, f) => {
    const cat = f.category || "其他";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});
  const sortedCategories = Object.keys(filesByCategory).sort((a, b) => {
    const ai = FILE_CAT_ORDER.indexOf(a);
    const bi = FILE_CAT_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="space-y-2 mt-2 pt-2 border-t border-border">
      {/* Skill 基本信息 */}
      <div className="flex items-center gap-2 flex-wrap text-[10px]">
        <span className="font-medium text-foreground">{String(detail.name || "")}</span>
        {detail.scope ? <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{String(detail.scope)}</span> : null}
        {detail.version != null && <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">v{String(detail.version)}</span>}
      </div>
      {detail.description ? <div className="text-[10px] text-muted-foreground">{String(detail.description)}</div> : null}

      {/* 变更说明 */}
      {detail.change_note ? <div className="text-[10px]"><span className="text-muted-foreground">变更说明:</span> {String(detail.change_note)}</div> : null}

      {/* 版本 diff */}
      {detail.prev_system_prompt != null && (
        <PromptDiffBlock current={String(detail.system_prompt || "")} previous={String(detail.prev_system_prompt)} prevVersion={detail.prev_version as number | undefined} currentVersion={detail.version as number | undefined} />
      )}

      {/* System Prompt */}
      {detail.system_prompt ? <SystemPromptBlock value={detail.system_prompt} /> : null}

      {/* 文件树 */}
      {sortedCategories.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">文件树 ({sourceFiles.length})</div>
          {sortedCategories.map((cat) => (
            <div key={cat} className="mb-2">
              <div className="flex items-center gap-1 mb-1">
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${CAT_COLOR[cat] || "bg-gray-100 text-gray-600"}`}>{cat}</span>
              </div>
              <div className="space-y-1 pl-2 border-l-2 border-border">
                {filesByCategory[cat].map((f) => {
                  const key = `${targetId}:${f.filename}`;
                  return (
                    <div key={f.filename}>
                      <button
                        onClick={() => targetId && onLoadFile(targetId, f.filename)}
                        className="flex items-center gap-2 w-full text-left px-2 py-1 border border-border rounded bg-background hover:bg-muted/50 transition-colors"
                      >
                        <FileText size={10} className="text-muted-foreground flex-shrink-0" />
                        <span className="text-[10px] font-mono font-medium text-foreground truncate">{f.filename}</span>
                        {fileLoading === key && <span className="text-[9px] text-primary animate-pulse ml-auto">加载中...</span>}
                        <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">{fileContents[key] !== undefined ? "▼" : "▶"}</span>
                      </button>
                      {fileContents[key] !== undefined && (
                        <pre className="text-[10px] text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-background border border-t-0 border-border rounded-b px-3 py-2 max-h-48 overflow-y-auto">
                          {fileContents[key]}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 附属信息 */}
      {knowledgeTags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Tag size={10} className="text-muted-foreground" />
          {knowledgeTags.map((t) => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-medium">{t}</span>)}
        </div>
      )}
      {dataQueries.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1"><Database size={10} />数据查询</div>
          {dataQueries.map((q) => <div key={q.query_name} className="text-[10px] text-foreground pl-2">{q.query_name} → {q.table_name} ({q.query_type})</div>)}
        </div>
      )}
      {boundTools.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1"><Wrench size={10} />绑定工具</div>
          {boundTools.map((t) => <div key={t.id} className="text-[10px] text-foreground pl-2">{t.display_name || t.name} <span className="text-muted-foreground">({t.tool_type})</span></div>)}
        </div>
      )}

      {/* 权限范围 */}
      {suggestedPolicy && (
        <div className="space-y-2">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">拟可使用人范围</div>
          <div className="flex items-center gap-3 flex-wrap text-[10px]">
            <span className="text-muted-foreground">发布范围:</span>
            <span className="font-medium text-foreground">{SCOPE_LABEL[suggestedPolicy.publish_scope || ""] || suggestedPolicy.publish_scope || "—"}</span>
            {suggestedPolicy.risk_level && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${RISK_COLOR[suggestedPolicy.risk_level] || "bg-gray-100 text-gray-600"}`}>
                风险: {suggestedPolicy.risk_level}
              </span>
            )}
          </div>
          {suggestedPolicy.role_overrides && suggestedPolicy.role_overrides.length > 0 && (
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-[10px]">
                <thead><tr className="bg-muted/50"><th className="px-2 py-1 text-left font-medium text-muted-foreground">岗位</th><th className="px-2 py-1 text-left font-medium text-muted-foreground">可调用</th><th className="px-2 py-1 text-left font-medium text-muted-foreground">数据范围</th></tr></thead>
                <tbody>
                  {suggestedPolicy.role_overrides.map((ro) => (
                    <tr key={ro.position_name} className="border-t border-border">
                      <td className="px-2 py-1 text-foreground">{ro.position_name}</td>
                      <td className="px-2 py-1">{ro.callable ? <span className="text-green-600">✓</span> : <span className="text-red-600">✗</span>}</td>
                      <td className="px-2 py-1 text-muted-foreground">{ro.data_scope}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PERM_DOMAIN_LABELS: Record<string, string> = {
  feature_flag: "系统功能权限",
  model_grant: "特殊 AI 模型授权",
  capability_grant: "审批体系资格",
};

function PermissionChangeContent({ detail }: { detail: Record<string, unknown> }) {
  const domain = String(detail.domain || "");
  const actionKey = String(detail.action_key || "");
  const actionLabel = String(detail.action_label || actionKey);
  const targetUserName = String(detail.target_user_name || detail.target_user_id || "");
  const currentValue = detail.current_value;
  const targetValue = detail.target_value;
  const reason = detail.reason as string | undefined;
  const riskNote = detail.risk_note as string | undefined;

  function formatValue(v: unknown): string {
    if (typeof v === "boolean") return v ? "开启" : "关闭";
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  return (
    <div className="space-y-2 mt-2 pt-2 border-t border-border">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
        <div>
          <span className="text-muted-foreground">目标用户:</span>{" "}
          <span className="text-foreground font-medium">{targetUserName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">权限域:</span>{" "}
          <span className="text-foreground font-medium">{PERM_DOMAIN_LABELS[domain] || domain}</span>
        </div>
        <div>
          <span className="text-muted-foreground">变更项:</span>{" "}
          <span className="text-foreground font-medium">{actionLabel}</span>
        </div>
        <div>
          <span className="text-muted-foreground">动作 Key:</span>{" "}
          <span className="text-foreground font-mono">{actionKey}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px]">
        <span className="text-muted-foreground">当前状态:</span>
        <span className="px-1.5 py-0.5 rounded bg-muted text-foreground font-medium">{formatValue(currentValue)}</span>
        <span className="text-muted-foreground">→</span>
        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{formatValue(targetValue)}</span>
      </div>
      {reason && (
        <div className="text-[10px]">
          <span className="text-muted-foreground">变更原因:</span>{" "}
          <span className="text-foreground">{reason}</span>
        </div>
      )}
      {riskNote && (
        <div className="text-[10px] flex items-start gap-1">
          <AlertTriangle size={10} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <span className="text-amber-700">{riskNote}</span>
        </div>
      )}
    </div>
  );
}

function OrgMemoryEvidenceContent({
  requestType,
  detail,
}: {
  requestType: string;
  detail: Record<string, unknown>;
}) {
  const structureChanges = Array.isArray(detail.structure_changes)
    ? (detail.structure_changes as Array<Record<string, unknown>>)
    : [];
  const classificationRules = Array.isArray(detail.classification_rules)
    ? (detail.classification_rules as Array<Record<string, unknown>>)
    : [];
  const skillMounts = Array.isArray(detail.skill_mounts)
    ? (detail.skill_mounts as Array<Record<string, unknown>>)
    : [];
  const approvalImpacts = Array.isArray(detail.approval_impacts)
    ? (detail.approval_impacts as Array<Record<string, unknown>>)
    : [];
  const evidenceRefs = Array.isArray(detail.evidence_refs)
    ? (detail.evidence_refs as Array<Record<string, unknown>>)
    : [];
  const appliedConfig = typeof detail.applied_config === "object" && detail.applied_config !== null
    ? detail.applied_config as Record<string, unknown>
    : null;
  const configVersions = Array.isArray(detail.config_versions)
    ? (detail.config_versions as Array<Record<string, unknown>>)
    : [];

  const summary =
    String(detail.summary || detail.impact_summary || detail.description || "");

  return (
    <div className="space-y-2 mt-2 pt-2 border-t border-border">
      <div className="text-[10px]">
        <span className="text-muted-foreground font-medium">审批主题:</span>{" "}
        <span className="text-foreground">
          {requestTypeLabel(requestType)}
        </span>
      </div>
      {summary && (
        <div className="text-[10px] text-muted-foreground">
          {summary}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
          结构 {structureChanges.length}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-medium">
          分类 {classificationRules.length}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
          挂载 {skillMounts.length}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
          审批影响 {approvalImpacts.length}
        </span>
      </div>

      {classificationRules.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            共享范围与匿名化
          </div>
          {classificationRules.slice(0, 3).map((rule, index) => (
            <div key={`${String(rule.target_scope || "rule")}-${index}`} className="rounded border border-border px-2.5 py-2 text-[10px]">
              <div className="font-medium text-foreground">
                {String(rule.target_scope || "未命名规则")}
              </div>
              <div className="mt-1 text-muted-foreground">
                {String(rule.origin_scope || "—")} → {String(rule.allowed_scope || "—")} · {String(rule.redaction_mode || "—")}
              </div>
              {Boolean(rule.rationale) && (
                <div className="mt-1 text-muted-foreground">
                  {String(rule.rationale)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {skillMounts.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Skill 挂载建议
          </div>
          {skillMounts.slice(0, 3).map((item, index) => (
            <div key={`${String(item.skill_name || "skill")}-${index}`} className="rounded border border-border px-2.5 py-2 text-[10px]">
              <div className="font-medium text-foreground">
                {String(item.skill_name || "未命名 Skill")}
              </div>
              <div className="mt-1 text-muted-foreground">
                结论：{String(item.decision || "—")} · 共享上限：{String(item.max_allowed_scope || "—")} · 形态：{String(item.required_redaction_mode || "—")}
              </div>
            </div>
          ))}
        </div>
      )}

      {approvalImpacts.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            审批影响
          </div>
          {approvalImpacts.slice(0, 3).map((impact, index) => (
            <div key={`${String(impact.target_asset_name || "impact")}-${index}`} className="rounded border border-border px-2.5 py-2 text-[10px]">
              <div className="font-medium text-foreground">
                {String(impact.target_asset_name || "未命名资产")}
              </div>
              <div className="mt-1 text-muted-foreground">
                {String(impact.risk_reason || impact.impact_type || "—")}
              </div>
            </div>
          ))}
        </div>
      )}

      {evidenceRefs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            证据链
          </div>
          {evidenceRefs.slice(0, 2).map((evidence, index) => (
            <div key={`${String(evidence.section || "evidence")}-${index}`} className="rounded border border-dashed border-border px-2.5 py-2 text-[10px] text-muted-foreground">
              <div className="font-medium text-foreground">
                {String(evidence.label || "证据")} · {String(evidence.section || "未命名章节")}
              </div>
              <div className="mt-1">
                {String(evidence.excerpt || "—")}
              </div>
            </div>
          ))}
        </div>
      )}

      {appliedConfig && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            生效配置
          </div>
          <div className="rounded border border-green-200 bg-green-50 px-2.5 py-2 text-[10px]">
            <div className="font-medium text-green-900">
              配置 #{String(appliedConfig.id || "—")}
            </div>
            <div className="mt-1 text-green-800">
              状态：{String(appliedConfig.status || "effective")} · 生效时间：{String(appliedConfig.applied_at || "—")}
            </div>
            <div className="mt-1 text-green-800">
              目录 {Array.isArray(appliedConfig.knowledge_paths) ? appliedConfig.knowledge_paths.length : 0} 个 ·
              分类规则 {String(appliedConfig.classification_rule_count || 0)} 条 ·
              Skill 挂载 {String(appliedConfig.skill_mount_count || 0)} 个
            </div>
          </div>
        </div>
      )}

      {configVersions.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            配置版本历史
          </div>
          {configVersions.slice(0, 4).map((version, index) => (
            <div key={`${String(version.version || index)}-${String(version.id || index)}`} className="rounded border border-border px-2.5 py-2 text-[10px]">
              <div className="font-medium text-foreground">
                v{String(version.version || index + 1)} · {String(version.action || "apply")}
              </div>
              <div className="mt-1 text-muted-foreground">
                {String(version.status || "effective")} · {String(version.applied_at || "—")}
              </div>
              {Boolean(version.note) && (
                <div className="mt-1 text-muted-foreground">
                  {String(version.note)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolEvidenceContent({ detail }: { detail: ToolEvidenceDetail }) {
  return (
    <div className="space-y-1 mt-2 pt-2 border-t border-border">
      <div className="text-[10px]"><span className="text-muted-foreground font-medium">工具名:</span> {detail.tool_name || detail.name || ""}</div>
      {detail.description ? <div className="text-[10px] text-muted-foreground">{detail.description}</div> : null}
      {detail.tool_type ? <div className="text-[10px]"><span className="text-muted-foreground">类型:</span> {detail.tool_type}</div> : null}
      {detail.scope ? <div className="text-[10px]"><span className="text-muted-foreground">范围:</span> {detail.scope}</div> : null}
    </div>
  );
}

function WebAppEvidenceContent({ detail }: { detail: WebAppEvidenceDetail }) {
  const [codeOpen, setCodeOpen] = useState(false);
  const [iframeOpen, setIframeOpen] = useState(false);
  const htmlCode = detail.html_code || "";
  const previewUrl = detail.preview_url || null;

  return (
    <div className="space-y-2 mt-2 pt-2 border-t border-border">
      <div className="text-[10px]"><span className="text-muted-foreground font-medium">应用名:</span> {detail.name || ""}</div>
      {detail.description ? <div className="text-[10px] text-muted-foreground">{detail.description}</div> : null}
      {detail.creator_name ? <div className="text-[10px]"><span className="text-muted-foreground">创建者:</span> {detail.creator_name}</div> : null}
      {htmlCode && (
        <div>
          <button onClick={() => setCodeOpen(!codeOpen)} className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            {codeOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            代码预览 ({htmlCode.length} 字符)
          </button>
          {codeOpen && <pre className="text-[10px] text-foreground whitespace-pre-wrap font-mono bg-background border border-border rounded px-3 py-2 max-h-64 overflow-y-auto mt-1">{htmlCode}</pre>}
        </div>
      )}
      {previewUrl && (
        <div>
          <button onClick={() => setIframeOpen(!iframeOpen)} className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            {iframeOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            实时预览
          </button>
          {iframeOpen && <iframe src={previewUrl} className="w-full h-64 border border-border rounded mt-1 bg-white" sandbox="allow-scripts allow-same-origin" title="Web App 预览" />}
        </div>
      )}
    </div>
  );
}

function KnowledgeReviewContent({ detail }: { detail: KnowledgeReviewDetail }) {
  const [contentOpen, setContentOpen] = useState(false);
  const content = detail.content || "";
  const preview = content.length > 500 ? content.slice(0, 500) + "…" : content;
  const reviewLevel = detail.review_level;
  const reviewStage = detail.review_stage || "";
  const sensitivityFlags = detail.sensitivity_flags || [];
  const autoReviewNote = detail.auto_review_note || "";
  const entryId = detail.entry_id;

  const levelLabel: Record<number, string> = { 0: "L0 自动通过", 1: "L1 自动通过", 2: "L2 部门审核", 3: "L3 两级审核" };
  const stageLabel: Record<string, string> = { pending_dept: "待部门审核", dept_approved_pending_super: "部门已通过，待超管终审", approved: "已通过", auto_approved: "自动通过", rejected: "已拒绝" };

  return (
    <div className="space-y-2 mt-2 pt-2 border-t border-border">
      <div className="flex items-center gap-2 flex-wrap">
        {reviewLevel != null && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${reviewLevel >= 3 ? "bg-red-100 text-red-700" : reviewLevel >= 2 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
            {levelLabel[reviewLevel] || `L${reviewLevel}`}
          </span>
        )}
        {reviewStage && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">{stageLabel[reviewStage] || reviewStage}</span>}
      </div>
      {sensitivityFlags.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex flex-wrap gap-1">{sensitivityFlags.map((f) => <span key={f} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">{f}</span>)}</div>
        </div>
      )}
      {autoReviewNote && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Shield size={10} />AI 审核意见</div>
          <div className="text-xs text-foreground bg-background border border-border rounded px-3 py-2">{autoReviewNote}</div>
        </div>
      )}
      {content && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">内容预览</div>
          <pre className="text-[10px] text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-background border border-border rounded px-3 py-2 max-h-64 overflow-y-auto">{contentOpen ? content : preview}</pre>
          {content.length > 500 && <button onClick={() => setContentOpen(!contentOpen)} className="text-[10px] text-primary hover:underline mt-1">{contentOpen ? "收起" : "展开全文"}</button>}
        </div>
      )}
      {entryId && <a href={`/knowledge?doc=${entryId}`} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-primary hover:underline">查看原文档 ↗</a>}
    </div>
  );
}

function KnowledgeEditContent({ detail, reason, requesterName }: { detail: KnowledgeEditDetail; reason: string | null; requesterName: string | null }) {
  const [contentOpen, setContentOpen] = useState(false);
  const content = detail.content || "";
  const preview = content.length > 500 ? content.slice(0, 500) + "…" : content;
  const entryId = detail.entry_id;

  return (
    <div className="space-y-2 mt-2 pt-2 border-t border-border">
      {requesterName && <div className="text-[10px]"><span className="text-muted-foreground">申请者:</span> <span className="font-medium">{requesterName}</span></div>}
      {reason && <div className="text-[10px]"><span className="text-muted-foreground">申请理由:</span> {reason}</div>}
      <div className="text-[10px]"><span className="text-muted-foreground">文档标题:</span> {detail.title || detail.name || ""}</div>
      {detail.category ? <div className="text-[10px]"><span className="text-muted-foreground">分类:</span> {detail.category}</div> : null}
      {content && (
        <div>
          <pre className="text-[10px] text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-background border border-border rounded px-3 py-2 max-h-48 overflow-y-auto">{contentOpen ? content : preview}</pre>
          {content.length > 500 && <button onClick={() => setContentOpen(!contentOpen)} className="text-[10px] text-primary hover:underline mt-1">{contentOpen ? "收起" : "展开全文"}</button>}
        </div>
      )}
      {entryId && <a href={`/knowledge?doc=${entryId}`} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-primary hover:underline">查看原文档 ↗</a>}
    </div>
  );
}

// ─── 通用辅助组件 ────────────────────────────────────────────────────────────

function SystemPromptBlock({ value }: { value: unknown }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">System Prompt</div>
      <pre className="text-[10px] text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-background border border-border rounded px-3 py-2 max-h-48 overflow-y-auto">{String(value)}</pre>
    </div>
  );
}

function PromptDiffBlock({ current, previous, prevVersion, currentVersion }: { current: string; previous: string; prevVersion?: number; currentVersion?: number }) {
  const [open, setOpen] = useState(false);
  const prevLines = previous.split("\n");
  const currLines = current.split("\n");
  const maxLen = Math.max(prevLines.length, currLines.length);
  const diffLines: { type: "same" | "add" | "del"; text: string }[] = [];
  for (let i = 0; i < maxLen; i++) {
    const p = prevLines[i]; const c = currLines[i];
    if (p === c) { diffLines.push({ type: "same", text: c ?? "" }); }
    else { if (p !== undefined) diffLines.push({ type: "del", text: p }); if (c !== undefined) diffLines.push({ type: "add", text: c }); }
  }
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 hover:text-foreground transition-colors">
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        版本变更对比 (v{prevVersion ?? "?"} → v{currentVersion ?? "?"})
      </button>
      {open && (
        <pre className="text-[10px] whitespace-pre-wrap leading-relaxed font-mono bg-background border border-border rounded px-3 py-2 max-h-64 overflow-y-auto">
          {diffLines.map((line, i) => (
            <div key={i} className={line.type === "add" ? "bg-green-100 text-green-800" : line.type === "del" ? "bg-red-100 text-red-800 line-through" : "text-foreground"}>
              {line.type === "add" ? "+ " : line.type === "del" ? "- " : "  "}{line.text}
            </div>
          ))}
        </pre>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700"><Clock size={10} />审批中</span>;
  if (status === "approved") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700"><Check size={10} />已通过</span>;
  if (status === "rejected") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700"><X size={10} />已拒绝</span>;
  if (status === "withdrawn") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600"><X size={10} />已撤回</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">{status}</span>;
}

// ─── ApprovalCard（统一使用 WorkBench 展开） ─────────────────────────────────
function ApprovalCard({
  request: r,
  acting,
  onStructuredAction,
  expanded,
  isTarget,
  onToggleExpand,
  fileContents,
  fileLoading,
  onLoadFile,
  onSandbox,
  showActions,
  templates,
  currentUserId,
  onRefresh,
  onWithdraw,
}: {
  request: ApprovalRequest;
  acting: number | null;
  onStructuredAction: (id: number, action: string, payload: Record<string, unknown>) => void;
  expanded: boolean;
  isTarget?: boolean;
  onToggleExpand: () => void;
  fileContents: Record<string, string>;
  fileLoading: string | null;
  onLoadFile: (skillId: number, filename: string) => void;
  onSandbox: (item: { id: number; name: string }) => void;
  showActions: boolean;
  templates: Record<string, ApprovalTemplate>;
  currentUserId?: number;
  onRefresh?: () => void;
  onWithdraw?: (requestId: number) => void;
}) {
  const detail: Record<string, unknown> = (r.target_detail || {}) as Record<string, unknown>;
  const title = (detail.title || detail.name || `#${r.target_id}`) as string;
  const fileExt = detail.file_ext as string | undefined;

  return (
    <div
      id={`approval-request-${r.id}`}
      className={`border rounded-lg bg-card hover:shadow-sm transition-shadow ${
        isTarget ? "border-[#00A3C4] ring-2 ring-[#00D1FF]/40" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
          {(r.requester_name || "?").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{r.requester_name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">{requestTypeLabel(r.request_type)}</span>
            <StatusBadge status={r.status} />
            {/* V2: 风险级别标签 */}
            {r.risk_level && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${RISK_COLOR[r.risk_level] || "bg-gray-100 text-gray-600"}`}>{r.risk_level === "high" ? "高风险" : r.risk_level === "medium" ? "中风险" : "低风险"}</span>}
            {/* V2: 证据完整度 */}
            {r.evidence_complete === false && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-600">资料不全</span>}
            {/* Fix 3: 待补充状态 */}
            {r.stage === "needs_info" && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">待补充</span>}
            {isTarget && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700">目标工单</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <FileText size={12} className="text-muted-foreground" />
            <span className="text-xs text-foreground font-medium truncate">{title}</span>
            {fileExt && <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-semibold">{fileExt.replace(".", "").toUpperCase()}</span>}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">{formatTime(r.created_at)}</div>
          {r.request_type === "skill_ownership_transfer" && detail.new_owner_name ? (
            <div className="text-xs text-foreground mt-1">→ 新所有者: <span className="font-medium">{String(detail.new_owner_name)}</span></div>
          ) : null}
          {r.reason ? <div className="text-xs text-muted-foreground mt-1">理由: <span className="text-foreground">{r.reason}</span></div> : null}
          {/* Action history summary */}
          {r.actions.length > 0 && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              {r.actions.map((a) => (
                <div key={a.id} className="flex items-center gap-1">
                  <span className="font-medium">{a.actor_name}</span>
                  <span>{a.action === "approve" ? "已通过" : a.action === "reject" ? "已拒绝" : a.action === "request_more_info" ? "要求补充" : a.action === "approve_with_conditions" ? "附条件通过" : a.action === "supplement" ? "补充证据" : a.action === "withdraw" ? "已撤回" : a.action}</span>
                  {a.comment && <span className="text-foreground">: {a.comment}</span>}
                  <span className="ml-1">{formatTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!showActions && r.status === "pending" && currentUserId === r.requester_id && onWithdraw && (
            <button
              onClick={() => onWithdraw(r.id)}
              className="text-[10px] font-medium text-red-600 hover:underline"
            >
              撤回
            </button>
          )}
          <button onClick={onToggleExpand} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {/* 展开：统一 ApprovalWorkbench */}
      {expanded && (
        <ApprovalWorkbench
          request={r}
          showActions={showActions}
          onAction={onStructuredAction}
          acting={acting === r.id}
          fileContents={fileContents}
          fileLoading={fileLoading}
          onLoadFile={onLoadFile}
          onSandbox={onSandbox}
          templates={templates}
          currentUserId={currentUserId}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}

// ─── 主页面 ──────────────────────────────────────────────────────────────────
export default function ApprovalsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isAdmin = user?.role === "super_admin" || user?.role === "dept_admin";
  const [mainTab, setMainTab] = useState<MainTab>("incoming");
  const [typeFilter, setTypeFilter] = useState("");
  const [incoming, setIncoming] = useState<ApprovalRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ApprovalRequest[]>([]);
  const [adminData, setAdminData] = useState<AdminApprovalResponse>({ total: 0, page: 1, page_size: 20, items: [] });
  const [adminPage, setAdminPage] = useState(1);
  const [adminStatusFilter, setAdminStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [fileLoading, setFileLoading] = useState<string | null>(null);
  const [sandboxItem, setSandboxItem] = useState<{ id: number; name: string } | null>(null);
  // 模板从后端拉取（单一真源）
  const [templates, setTemplates] = useState<Record<string, ApprovalTemplate>>({});
  const requestIdParam = searchParams.get("request_id");
  const tabParam = searchParams.get("tab");
  const targetRequestId = requestIdParam ? Number(requestIdParam) || null : null;

  useEffect(() => {
    if (!tabParam) return;
    if (tabParam === "incoming" || tabParam === "outgoing") {
      setMainTab(tabParam);
      return;
    }
    if (tabParam === "all" && isAdmin) {
      setMainTab("all");
    }
  }, [isAdmin, tabParam]);

  useEffect(() => {
    apiFetch<Record<string, ApprovalTemplate>>("/approvals/templates")
      .then((data) => setTemplates({ ...FALLBACK_APPROVAL_TEMPLATES, ...data }))
      .catch(() => setTemplates(FALLBACK_APPROVAL_TEMPLATES));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [inc, out] = await Promise.all([
        apiFetch<ApprovalRequest[]>("/approvals/incoming"),
        apiFetch<ApprovalRequest[]>("/approvals/my"),
      ]);
      setIncoming(inc);
      setOutgoing(out);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const fetchAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(adminPage), page_size: "20" });
      if (adminStatusFilter) params.set("status", adminStatusFilter);
      if (typeFilter) params.set("type", typeFilter);
      const data = await apiFetch<AdminApprovalResponse>(`/approvals?${params}`);
      setAdminData(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [isAdmin, adminPage, adminStatusFilter, typeFilter]);

  useEffect(() => {
    if (mainTab === "all") fetchAdminData();
    else fetchData();
  }, [fetchData, fetchAdminData, mainTab]);

  useEffect(() => {
    if (!requestIdParam) return;
    const targetId = Number(requestIdParam);
    if (!targetId) return;

    if (mainTab === "incoming" && incoming.some((item) => item.id === targetId)) {
      setExpandedId(targetId);
      return;
    }
    if (mainTab === "outgoing" && outgoing.some((item) => item.id === targetId)) {
      setExpandedId(targetId);
      return;
    }
    if (mainTab === "all" && adminData.items.some((item) => item.id === targetId)) {
      setExpandedId(targetId);
    }
  }, [adminData.items, incoming, mainTab, outgoing, requestIdParam]);

  useEffect(() => {
    if (!targetRequestId || expandedId !== targetRequestId) return;
    const frame = window.requestAnimationFrame(() => {
      const el = document.getElementById(`approval-request-${targetRequestId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedId, targetRequestId]);

  async function handleStructuredAction(requestId: number, action: string, payload: Record<string, unknown>) {
    setActing(requestId);
    try {
      const body: Record<string, unknown> = {
        action,
        comment: payload.comment || null,
        decision_payload: payload.decision_payload || null,
        checklist_result: payload.checklist_result || null,
      };
      if (action === "approve_with_conditions" && payload.conditions) {
        body.conditions = payload.conditions;
      }
      await apiFetch(`/approvals/${requestId}/actions`, { method: "POST", body: JSON.stringify(body) });
      if (mainTab === "all") await fetchAdminData();
      else await fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
    setActing(null);
  }

  async function handleWithdraw(requestId: number) {
    if (!confirm("确认撤回这条审批申请？")) return;
    setActing(requestId);
    try {
      await apiFetch(`/approvals/${requestId}/withdraw`, { method: "POST" });
      if (mainTab === "all") await fetchAdminData();
      else await fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "撤回失败");
    }
    setActing(null);
  }

  async function loadFileContent(skillId: number, filename: string) {
    const key = `${skillId}:${filename}`;
    if (fileContents[key] !== undefined) {
      setFileContents((prev) => { const next = { ...prev }; delete next[key]; return next; });
      return;
    }
    setFileLoading(key);
    try {
      const data = await apiFetch<{ content: string }>(`/skills/${skillId}/files/${encodeURIComponent(filename)}`);
      setFileContents((prev) => ({ ...prev, [key]: data.content }));
    } catch {
      setFileContents((prev) => ({ ...prev, [key]: "加载失败" }));
    } finally {
      setFileLoading(null);
    }
  }

  function filterByType(items: ApprovalRequest[]) {
    if (!typeFilter) return items;
    const types = typeFilter.split(",");
    return items.filter((r) => types.includes(r.request_type));
  }

  const filteredIncoming = filterByType(incoming);
  const filteredOutgoing = filterByType(outgoing);
  const pendingIncoming = filteredIncoming.filter((r) => r.status === "pending");
  const resolvedIncoming = filteredIncoming.filter((r) => r.status !== "pending");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {sandboxItem && (
          <SandboxTestModal
            type="skill"
            id={sandboxItem.id}
            name={sandboxItem.name}
            onPassed={() => setSandboxItem(null)}
            onCancel={() => setSandboxItem(null)}
            passedLabel="✓ 测试通过，关闭"
          />
        )}

        <h1 className="text-xl font-bold text-foreground mb-1">审批管理</h1>
        <p className="text-sm text-muted-foreground mb-4">管理审批请求</p>
        {targetRequestId && (
          <div className="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
            已定位到审批单 <span className="font-semibold">#{targetRequestId}</span>。
          </div>
        )}

        {/* Main Tabs */}
        <div className="flex gap-1 mb-4 border-b border-border">
          <MainTabButton active={mainTab === "incoming"} onClick={() => setMainTab("incoming")} count={incoming.filter((r) => r.status === "pending").length}>
            <Inbox size={14} />
            我收到的
          </MainTabButton>
          <MainTabButton active={mainTab === "outgoing"} onClick={() => setMainTab("outgoing")} count={outgoing.filter(r => r.stage === "needs_info").length || undefined}>
            <Send size={14} />
            我发起的
          </MainTabButton>
          {isAdmin && (
            <MainTabButton active={mainTab === "all"} onClick={() => setMainTab("all")}>
              全部审批
            </MainTabButton>
          )}
        </div>

        {/* Type sub-tabs */}
        <div className="flex gap-0 mb-4 overflow-x-auto">
          {TYPE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap rounded-full transition-colors ${
                typeFilter === t.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              } mr-1.5`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-16">加载中…</div>
        ) : mainTab === "incoming" ? (
          <div className="space-y-3">
            {pendingIncoming.length === 0 && resolvedIncoming.length === 0 && <EmptyState text="暂无审批请求" />}
            {pendingIncoming.map((r) => (
              <ApprovalCard
                key={r.id}
                request={r}
                acting={acting}
                onStructuredAction={handleStructuredAction}
                expanded={expandedId === r.id}
                isTarget={targetRequestId === r.id}
                onToggleExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
                fileContents={fileContents}
                fileLoading={fileLoading}
                onLoadFile={loadFileContent}
                onSandbox={setSandboxItem}
                showActions
                templates={templates}
                currentUserId={user?.id}
                onRefresh={fetchData}
                onWithdraw={handleWithdraw}
              />
            ))}
            {resolvedIncoming.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-6 mb-2">已处理</div>
                {resolvedIncoming.map((r) => (
                  <ApprovalCard
                    key={r.id}
                    request={r}
                    acting={acting}
                    onStructuredAction={handleStructuredAction}
                    expanded={expandedId === r.id}
                    isTarget={targetRequestId === r.id}
                    onToggleExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    fileContents={fileContents}
                    fileLoading={fileLoading}
                    onLoadFile={loadFileContent}
                    onSandbox={setSandboxItem}
                    showActions={false}
                    templates={templates}
                    currentUserId={user?.id}
                    onRefresh={fetchData}
                    onWithdraw={handleWithdraw}
                  />
                ))}
              </>
            )}
          </div>
        ) : mainTab === "all" ? (
          <AdminAllTab
            data={adminData}
            adminStatusFilter={adminStatusFilter}
            setAdminStatusFilter={(s) => { setAdminStatusFilter(s); setAdminPage(1); }}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            targetRequestId={targetRequestId}
            onStructuredAction={handleStructuredAction}
            acting={acting}
            fileContents={fileContents}
            fileLoading={fileLoading}
            onLoadFile={loadFileContent}
            onSandbox={setSandboxItem}
            page={adminPage}
            setPage={setAdminPage}
            templates={templates}
            currentUserId={user?.id}
            onRefresh={() => fetchAdminData()}
          />
        ) : (
          <div className="space-y-3">
            {filteredOutgoing.length === 0 && <EmptyState text="暂无发起的申请" />}
            {filteredOutgoing.map((r) => (
              <ApprovalCard
                key={r.id}
                request={r}
                acting={null}
                onStructuredAction={() => {}}
                expanded={expandedId === r.id}
                isTarget={targetRequestId === r.id}
                onToggleExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
                fileContents={fileContents}
                fileLoading={fileLoading}
                onLoadFile={loadFileContent}
                onSandbox={setSandboxItem}
                showActions={false}
                templates={templates}
                currentUserId={user?.id}
                onRefresh={fetchData}
                onWithdraw={handleWithdraw}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MainTabButton({ active, onClick, count, children }: { active: boolean; onClick: () => void; count?: number; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {count != null && count > 0 && (
        <span className="ml-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 rounded-full">{count}</span>
      )}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-center text-muted-foreground text-sm py-16 opacity-60">{text}</div>;
}

// ─── AdminAllTab ─────────────────────────────────────────────────────────────

const ADMIN_STATUS_TABS: { key: string; label: string }[] = [
  { key: "", label: "全部" },
  { key: "pending", label: "待审批" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已拒绝" },
  { key: "withdrawn", label: "已撤回" },
];

function AdminAllTab({
  data,
  adminStatusFilter,
  setAdminStatusFilter,
  expandedId,
  setExpandedId,
  targetRequestId,
  onStructuredAction,
  acting,
  fileContents,
  fileLoading,
  onLoadFile,
  onSandbox,
  page,
  setPage,
  templates,
  currentUserId,
  onRefresh,
}: {
  data: AdminApprovalResponse;
  adminStatusFilter: string;
  setAdminStatusFilter: (s: string) => void;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
  targetRequestId?: number | null;
  onStructuredAction: (id: number, action: string, payload: Record<string, unknown>) => void;
  acting: number | null;
  fileContents: Record<string, string>;
  fileLoading: string | null;
  onLoadFile: (skillId: number, filename: string) => void;
  onSandbox: (item: { id: number; name: string }) => void;
  page: number;
  setPage: (p: number) => void;
  templates: Record<string, ApprovalTemplate>;
  currentUserId?: number;
  onRefresh?: () => void;
}) {
  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <div className="space-y-3">
      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 mb-2">
        {ADMIN_STATUS_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setAdminStatusFilter(s.key)}
            className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-colors ${
              adminStatusFilter === s.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto">共 {data.total} 条</span>
      </div>

      {data.items.length === 0 && <EmptyState text="暂无审批记录" />}

      {data.items.map((item) => {
        const detail: Record<string, unknown> = (item.target_detail || {}) as Record<string, unknown>;
        const title = (detail.title || detail.name || `#${item.target_id}`) as string;

        return (
          <div
            id={`approval-request-${item.id}`}
            key={item.id}
            className={`border rounded-lg bg-card ${
              targetRequestId === item.id ? "border-[#00A3C4] ring-2 ring-[#00D1FF]/40" : "border-border"
            }`}
          >
            {/* Summary row */}
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">#{item.id}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">{requestTypeLabel(item.request_type)}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">{item.requester_name || `#${item.requester_id}`}</span>
              <span className="text-xs font-medium text-foreground truncate flex-1">{title}</span>
              {item.risk_level && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${RISK_COLOR[item.risk_level] || "bg-gray-100 text-gray-600"}`}>{item.risk_level}</span>}
              {item.evidence_complete === false && <span className="text-[9px] px-1 py-0.5 rounded-full font-medium bg-red-100 text-red-600 flex-shrink-0">资料不全</span>}
              {item.stage && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                  item.stage === "super_pending" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {item.stage === "super_pending" ? "待超管终审" : item.stage === "dept_pending" ? "待首轮审批" : item.stage === "needs_info" ? "待补充材料" : item.stage}
                </span>
              )}
              {targetRequestId === item.id && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-cyan-100 text-cyan-700 flex-shrink-0">
                  目标工单
                </span>
              )}
              <StatusBadge status={item.status} />
              <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{formatTime(item.created_at)}</span>
              <button
                onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                className="text-[10px] font-medium text-primary hover:underline flex-shrink-0"
              >
                {expandedId === item.id ? "收起" : "详情"}
              </button>
            </div>

            {/* 展开：统一 ApprovalWorkbench */}
            {expandedId === item.id && (
              <ApprovalWorkbench
                request={item}
                showActions={item.status === "pending"}
                onAction={onStructuredAction}
                acting={acting === item.id}
                fileContents={fileContents}
                fileLoading={fileLoading}
                onLoadFile={onLoadFile}
                onSandbox={onSandbox}
                templates={templates}
                currentUserId={currentUserId}
                onRefresh={onRefresh}
              />
            )}
          </div>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors">上一页</button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors">下一页</button>
        </div>
      )}
    </div>
  );
}
