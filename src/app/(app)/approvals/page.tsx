"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApprovalRequest } from "@/lib/types";
import { Check, X, Clock, FileText, Send, Inbox } from "lucide-react";

type Tab = "incoming" | "outgoing";

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("incoming");
  const [incoming, setIncoming] = useState<ApprovalRequest[]>([]);
  const [outgoing, setOutgoing] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<number | null>(null);

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

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAction(requestId: number, action: "approve" | "reject") {
    setActing(requestId);
    try {
      await apiFetch(`/approvals/${requestId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await fetchData();
    } catch { /* ignore */ }
    setActing(null);
  }

  const pendingIncoming = incoming.filter((r) => r.status === "pending");
  const resolvedIncoming = incoming.filter((r) => r.status !== "pending");

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <h1 className="text-xl font-bold text-foreground mb-1">审批管理</h1>
        <p className="text-sm text-muted-foreground mb-6">管理文档编辑权限申请</p>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border">
          <TabButton
            active={tab === "incoming"}
            onClick={() => setTab("incoming")}
            count={pendingIncoming.length}
          >
            <Inbox size={14} />
            我收到的
          </TabButton>
          <TabButton
            active={tab === "outgoing"}
            onClick={() => setTab("outgoing")}
          >
            <Send size={14} />
            我发起的
          </TabButton>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground text-sm py-16">加载中…</div>
        ) : tab === "incoming" ? (
          <div className="space-y-3">
            {pendingIncoming.length === 0 && resolvedIncoming.length === 0 && (
              <EmptyState text="暂无审批请求" />
            )}
            {pendingIncoming.map((r) => (
              <IncomingCard key={r.id} request={r} acting={acting} onAction={handleAction} />
            ))}
            {resolvedIncoming.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-6 mb-2">已处理</div>
                {resolvedIncoming.map((r) => (
                  <IncomingCard key={r.id} request={r} acting={acting} onAction={handleAction} />
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {outgoing.length === 0 && <EmptyState text="暂无发起的申请" />}
            {outgoing.map((r) => (
              <OutgoingCard key={r.id} request={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {count != null && count > 0 && (
        <span className="ml-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-muted-foreground text-sm py-16 opacity-60">
      {text}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700"><Clock size={10} />审批中</span>;
  }
  if (status === "approved") {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700"><Check size={10} />已通过</span>;
  }
  if (status === "rejected") {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700"><X size={10} />已拒绝</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">{status}</span>;
}

function requestTypeLabel(type: string): string {
  const map: Record<string, string> = {
    knowledge_edit: "文档编辑权限",
    skill_publish: "Skill 发布",
    tool_publish: "工具发布",
    webapp_publish: "应用发布",
    scope_change: "权限变更",
    mask_override: "脱敏覆盖",
    schema_approval: "Schema 审批",
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

function IncomingCard({
  request: r,
  acting,
  onAction,
}: {
  request: ApprovalRequest;
  acting: number | null;
  onAction: (id: number, action: "approve" | "reject") => void;
}) {
  const detail = r.target_detail || {};
  const title = (detail.title || detail.name || `#${r.target_id}`) as string;
  const fileExt = detail.file_ext as string | undefined;
  const isPending = r.status === "pending";

  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {/* Avatar placeholder */}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
          {(r.requester_name || "?").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{r.requester_name}</span>
            <span className="text-xs text-muted-foreground">申请{requestTypeLabel(r.request_type)}</span>
            <StatusBadge status={r.status} />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <FileText size={12} className="text-muted-foreground" />
            <span className="text-xs text-foreground font-medium truncate">{title}</span>
            {fileExt && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                {(fileExt as string).replace(".", "").toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">{formatTime(r.created_at)}</div>
        </div>
        {/* Action buttons */}
        {isPending && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              disabled={acting === r.id}
              onClick={() => onAction(r.id, "approve")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              <Check size={12} />
              通过
            </button>
            <button
              disabled={acting === r.id}
              onClick={() => onAction(r.id, "reject")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              <X size={12} />
              拒绝
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OutgoingCard({ request: r }: { request: ApprovalRequest }) {
  const detail = r.target_detail || {};
  const title = (detail.title || detail.name || `#${r.target_id}`) as string;
  const fileExt = detail.file_ext as string | undefined;
  const creatorName = detail.creator_name as string | undefined;

  return (
    <div className="border border-border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <FileText size={14} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{requestTypeLabel(r.request_type)}</span>
            <StatusBadge status={r.status} />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-xs text-foreground font-medium truncate">{title}</span>
            {fileExt && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                {(fileExt as string).replace(".", "").toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            {creatorName && <span>文档创建者: {creatorName}</span>}
            <span>{formatTime(r.created_at)}</span>
          </div>
          {/* Show approval action info */}
          {r.actions.length > 0 && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              {r.actions.map((a) => (
                <div key={a.id} className="flex items-center gap-1">
                  <span className="font-medium">{a.actor_name}</span>
                  <span>{a.action === "approve" ? "已通过" : a.action === "reject" ? "已拒绝" : a.action}</span>
                  {a.comment && <span className="text-foreground">: {a.comment}</span>}
                  <span className="ml-1">{formatTime(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
