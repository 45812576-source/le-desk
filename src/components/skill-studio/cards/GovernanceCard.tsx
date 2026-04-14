"use client";

import { memo } from "react";
import { X } from "lucide-react";
import type { GovernanceCardData, GovernanceAction } from "../types";

// ─── Generic Governance Card ─────────────────────────────────────────────────

const TYPE_STYLE: Record<string, { bg: string; border: string; accent: string; label: string }> = {
  route_status: { bg: "bg-[#F0F4F8] dark:bg-cyan-950/20", border: "border-[#00A3C4]/30 dark:border-cyan-900", accent: "text-[#00A3C4] dark:text-cyan-300", label: "路由" },
  assist_skills_status: { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", accent: "text-purple-600 dark:text-purple-200", label: "辅助 Skill" },
  staged_edit: { bg: "bg-[#F0FFF9] dark:bg-emerald-950/25", border: "border-[#00CC99]/30 dark:border-emerald-900", accent: "text-[#00CC99] dark:text-emerald-300", label: "编辑建议" },
  adoption_prompt: { bg: "bg-amber-50 dark:bg-amber-950/25", border: "border-amber-200 dark:border-amber-800", accent: "text-amber-600 dark:text-amber-200", label: "待确认" },
  followup_prompt: { bg: "bg-blue-50 dark:bg-blue-950/25", border: "border-blue-200 dark:border-blue-800", accent: "text-blue-600 dark:text-blue-200", label: "后续建议" },
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-300",
  adopted: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-200",
  rejected: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-200",
  dismissed: "bg-gray-100 text-gray-400 line-through dark:bg-zinc-800 dark:text-zinc-500",
};

function getActionTitle(card: GovernanceCardData) {
  const preflightAction = typeof card.content.preflight_action === "string" ? card.content.preflight_action : null;
  const payload = (typeof card.content.action_payload === "object" && card.content.action_payload)
    ? card.content.action_payload as Record<string, unknown>
    : {};
  if (preflightAction === "bind_sandbox_tools") {
    const count = Array.isArray(payload.tool_ids) ? payload.tool_ids.length : 0;
    return count > 0 ? `将绑定 ${count} 个已确认工具` : "将绑定沙盒确认过的工具";
  }
  if (preflightAction === "bind_knowledge_references") {
    const count = Array.isArray(payload.knowledge_ids) ? payload.knowledge_ids.length : 0;
    return count > 0 ? `将写入 ${count} 个知识引用快照` : "将写入知识引用快照";
  }
  if (preflightAction === "bind_permission_tables") {
    const count = Array.isArray(payload.table_names) ? payload.table_names.length : 0;
    return count > 0 ? `将挂载 ${count} 张数据表` : "将挂载沙盒确认过的数据表";
  }
  if (preflightAction === "binding_action") {
    const action = String(payload.action || "");
    const target = String(payload.display_name || payload.target_name || "目标资源");
    const verb = action === "unbind_tool" || action === "unbind_table" ? "解绑" : "绑定";
    const kind = action.endsWith("_table") ? "数据表" : "工具";
    return `将${verb}${kind}：${target}`;
  }
  if (preflightAction === "reindex_knowledge") {
    return "将重建相关知识索引";
  }
  if (preflightAction === "navigate_tools") {
    return "需要前往工具页处理";
  }
  if (preflightAction === "navigate_data_assets") {
    return "需要前往数据资产页处理";
  }
  return null;
}

function getTagItems(card: GovernanceCardData) {
  const payload = (typeof card.content.action_payload === "object" && card.content.action_payload)
    ? card.content.action_payload as Record<string, unknown>
    : {};
  const tags: string[] = [];
  if (typeof card.content.target_kind === "string") tags.push(String(card.content.target_kind));
  if (Array.isArray(payload.tool_ids) && payload.tool_ids.length > 0) tags.push(`${payload.tool_ids.length} tools`);
  if (Array.isArray(payload.knowledge_ids) && payload.knowledge_ids.length > 0) tags.push(`${payload.knowledge_ids.length} knowledge`);
  if (Array.isArray(payload.table_names) && payload.table_names.length > 0) tags.push(`${payload.table_names.length} tables`);
  if (typeof payload.action === "string") tags.push(String(payload.action));
  if (typeof payload.confidence === "number") tags.push(`置信度 ${Math.round(payload.confidence * 100)}%`);
  return tags.slice(0, 3);
}

function getPrimaryActionLabel(card: GovernanceCardData, fallback: string) {
  const preflightAction = typeof card.content.preflight_action === "string" ? card.content.preflight_action : null;
  const payload = (typeof card.content.action_payload === "object" && card.content.action_payload)
    ? card.content.action_payload as Record<string, unknown>
    : {};
  if (preflightAction === "bind_sandbox_tools") {
    const count = Array.isArray(payload.tool_ids) ? payload.tool_ids.length : 0;
    return count > 0 ? `绑定 ${count} 个工具` : "绑定工具";
  }
  if (preflightAction === "bind_knowledge_references") {
    const count = Array.isArray(payload.knowledge_ids) ? payload.knowledge_ids.length : 0;
    return count > 0 ? `写入 ${count} 个知识引用` : "写入知识引用";
  }
  if (preflightAction === "bind_permission_tables") {
    const count = Array.isArray(payload.table_names) ? payload.table_names.length : 0;
    return count > 0 ? `挂载 ${count} 张数据表` : "挂载数据表";
  }
  if (preflightAction === "binding_action") {
    const action = String(payload.action || "");
    if (action === "unbind_tool") return "确认解绑工具";
    if (action === "unbind_table") return "确认解绑数据表";
    if (action === "bind_table") return "确认绑定数据表";
    return "确认绑定工具";
  }
  if (preflightAction === "reindex_knowledge") {
    return "重建知识索引";
  }
  return fallback;
}

function getBindingPayload(card: GovernanceCardData) {
  const preflightAction = typeof card.content.preflight_action === "string" ? card.content.preflight_action : null;
  if (preflightAction !== "binding_action") return null;
  return (typeof card.content.action_payload === "object" && card.content.action_payload)
    ? card.content.action_payload as Record<string, unknown>
    : null;
}

function getBindingAlternatives(card: GovernanceCardData) {
  const payload = getBindingPayload(card);
  if (!payload || !Array.isArray(payload.alternatives)) return [];
  return payload.alternatives
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .filter((item) => Number.isFinite(Number(item.id)));
}

export const GovernanceCard = memo(function GovernanceCard({
  card,
  onAction,
  onDismiss,
}: {
  card: GovernanceCardData;
  onAction: (card: GovernanceCardData, action: GovernanceAction) => void;
  onDismiss?: (card: GovernanceCardData) => void;
}) {
  const style = TYPE_STYLE[card.type] || TYPE_STYLE.staged_edit;
  const isDone = card.status !== "pending";
  const bindingPayload = getBindingPayload(card);
  const bindingAlternatives = getBindingAlternatives(card);
  const actions = bindingAlternatives.length > 1
    ? card.actions.filter((action) => action.type !== "adopt")
    : card.actions;

  return (
    <div className={`mx-3 my-1.5 p-2.5 border text-[9px] font-mono ${style.bg} ${style.border} ${isDone ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`text-[7px] font-bold uppercase tracking-widest ${style.accent}`}>
            {style.label}
          </span>
          <span className="font-bold text-[#1A202C] dark:text-foreground text-[9px]">{card.title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isDone && (
            <span className={`text-[7px] px-1 py-0.5 font-bold uppercase ${STATUS_BADGE[card.status]}`}>
              {card.status === "adopted" ? "已采纳" : card.status === "rejected" ? "已拒绝" : "已忽略"}
            </span>
          )}
          {onDismiss && !isDone && (
            <button
              onClick={() => onDismiss(card)}
              className="text-gray-300 hover:text-gray-500 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Content summary */}
      {!!card.content.summary && (
        <p className="text-gray-500 dark:text-muted-foreground mb-1.5 text-[8px]">{String(card.content.summary)}</p>
      )}
      {!!card.content.reason && (
        <p className="text-gray-400 dark:text-zinc-500 text-[8px] mb-1.5">原因：{String(card.content.reason)}</p>
      )}
      {getActionTitle(card) && (
        <div className="mb-1.5 px-1.5 py-1 border border-dashed border-current/20 text-[8px] text-gray-600 dark:text-zinc-300">
          执行动作：{getActionTitle(card)}
        </div>
      )}
      {getTagItems(card).length > 0 && (
        <div className="flex gap-1 flex-wrap mb-1.5">
          {getTagItems(card).map((tag) => (
            <span key={tag} className="text-[7px] px-1 py-0.5 bg-white/70 border border-current/15 text-gray-500 dark:bg-zinc-900 dark:text-zinc-300">
              {tag}
            </span>
          ))}
        </div>
      )}
      {!isDone && bindingPayload && bindingAlternatives.length > 1 && (
        <BindingCandidateList
          card={card}
          actionName={String(bindingPayload.action || "")}
          candidates={bindingAlternatives}
          onAction={onAction}
        />
      )}

      {/* Action bar */}
      {!isDone && actions.length > 0 && (
        <AdoptionActionBar card={card} actions={actions} onAction={onAction} />
      )}
    </div>
  );
});

function BindingCandidateList({
  card,
  actionName,
  candidates,
  onAction,
}: {
  card: GovernanceCardData;
  actionName: string;
  candidates: Record<string, unknown>[];
  onAction: (card: GovernanceCardData, action: GovernanceAction) => void;
}) {
  return (
    <div className="mb-1.5 space-y-1">
      <div className="text-[7px] font-bold uppercase tracking-widest text-gray-400">候选资源</div>
      {candidates.map((candidate) => {
        const candidateId = Number(candidate.id);
        const candidateName = String(candidate.display_name || candidate.name || `#${candidateId}`);
        const confidence = typeof candidate.confidence === "number" ? candidate.confidence : Number(candidate.confidence || 0);
        return (
          <button
            key={candidateId}
            onClick={() => onAction(card, {
              label: `选择 ${candidateName}`,
              type: "adopt",
              payload: {
                action: actionName,
                target_id: candidateId,
                target_name: candidate.name,
                display_name: candidateName,
                confidence,
              },
            })}
            className="w-full text-left px-1.5 py-1 border border-white/80 bg-white/75 hover:bg-white text-[8px] text-gray-600 flex items-center gap-2 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
          >
            <span className="flex-1 truncate">{candidateName}</span>
            <span className="text-[7px] text-gray-400 flex-shrink-0">ID {candidateId}</span>
            {confidence > 0 && (
              <span className="text-[7px] text-[#00A3C4] flex-shrink-0">{Math.round(confidence * 100)}%</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── AdoptionActionBar ───────────────────────────────────────────────────────

const ACTION_STYLE: Record<string, string> = {
  adopt: "bg-[#00A3C4] text-white hover:bg-[#00D1FF]",
  reject: "bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700",
  view_diff: "bg-white text-[#00A3C4] border-[#00A3C4] hover:bg-[#F0FCFF] dark:bg-zinc-900 dark:text-cyan-300 dark:border-cyan-700 dark:hover:bg-cyan-950/30",
  refine: "bg-white text-purple-600 border-purple-300 hover:bg-purple-50 dark:bg-zinc-900 dark:text-purple-200 dark:border-purple-800 dark:hover:bg-purple-950/30",
};

const ACTION_LABEL: Record<string, string> = {
  adopt: "采纳",
  reject: "不采纳",
  view_diff: "查看修改",
  refine: "继续细化",
};

function AdoptionActionBar({
  card,
  actions,
  onAction,
}: {
  card: GovernanceCardData;
  actions: GovernanceAction[];
  onAction: (card: GovernanceCardData, action: GovernanceAction) => void;
}) {
  return (
    <div className="flex gap-1.5 mt-1">
      {actions.map((action) => (
        <button
          key={action.type}
          onClick={() => onAction(card, action)}
          className={`px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest border transition-colors ${
            ACTION_STYLE[action.type] || ACTION_STYLE.adopt
          }`}
        >
          {action.type === "adopt"
            ? getPrimaryActionLabel(card, action.label || ACTION_LABEL[action.type] || action.type)
            : action.label || ACTION_LABEL[action.type] || action.type}
        </button>
      ))}
    </div>
  );
}
