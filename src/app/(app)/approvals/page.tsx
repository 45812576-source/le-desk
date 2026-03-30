"use client";

import React from "react";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApprovalRequest } from "@/lib/types";
import { Check, X, Clock, FileText, Send, Inbox, ChevronDown, ChevronRight, Play, Shield, AlertTriangle } from "lucide-react";
import { SandboxTestModal } from "@/components/skill/SandboxTestModal";

type MainTab = "incoming" | "outgoing" | "all";

const TYPE_TABS: { key: string; label: string }[] = [
  { key: "", label: "全部" },
  { key: "skill_publish,skill_version_change,skill_ownership_transfer", label: "Skill" },
  { key: "knowledge_review", label: "知识审核" },
  { key: "knowledge_edit", label: "知识编辑" },
  { key: "tool_publish", label: "工具" },
  { key: "webapp_publish", label: "Web APP" },
  { key: "scope_change,mask_override,schema_approval", label: "权限&脱敏" },
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

const CAT_COLOR: Record<string, string> = {
  example: "bg-green-100 text-green-700",
  "knowledge-base": "bg-cyan-100 text-cyan-700",
  reference: "bg-amber-100 text-amber-700",
  template: "bg-purple-100 text-purple-700",
};

interface AdminApprovalResponse {
  total: number;
  page: number;
  page_size: number;
  items: ApprovalRequest[];
}

export default function ApprovalsPage() {
  const { user } = useAuth();
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

  const [actingPanel, setActingPanel] = useState<number | null>(null);
  const [actionComment, setActionComment] = useState("");
  const [actionConditions, setActionConditions] = useState("");

  async function handleAction(requestId: number, action: "approve" | "reject") {
    setActing(requestId);
    try {
      await apiFetch(`/approvals/${requestId}/actions`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (mainTab === "all") await fetchAdminData();
      else await fetchData();
    } catch { /* ignore */ }
    setActing(null);
  }

  async function handleAdminAction(requestId: number, action: string) {
    try {
      const body: Record<string, unknown> = { action, comment: actionComment || null };
      if (action === "add_conditions" && actionConditions) {
        body.conditions = actionConditions.split("\n").filter(Boolean);
      }
      await apiFetch(`/approvals/${requestId}/actions`, { method: "POST", body: JSON.stringify(body) });
      setActingPanel(null);
      setActionComment("");
      setActionConditions("");
      if (mainTab === "all") await fetchAdminData();
      else await fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
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

  // Filter by type
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

        {/* Header */}
        <h1 className="text-xl font-bold text-foreground mb-1">审批管理</h1>
        <p className="text-sm text-muted-foreground mb-4">管理审批请求</p>

        {/* Main Tabs: incoming / outgoing / all(admin) */}
        <div className="flex gap-1 mb-4 border-b border-border">
          <MainTabButton
            active={mainTab === "incoming"}
            onClick={() => setMainTab("incoming")}
            count={incoming.filter((r) => r.status === "pending").length}
          >
            <Inbox size={14} />
            我收到的
          </MainTabButton>
          <MainTabButton
            active={mainTab === "outgoing"}
            onClick={() => setMainTab("outgoing")}
          >
            <Send size={14} />
            我发起的
          </MainTabButton>
          {isAdmin && (
            <MainTabButton
              active={mainTab === "all"}
              onClick={() => setMainTab("all")}
            >
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
                typeFilter === t.key
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
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
            {pendingIncoming.length === 0 && resolvedIncoming.length === 0 && (
              <EmptyState text="暂无审批请求" />
            )}
            {pendingIncoming.map((r) => (
              <ApprovalCard
                key={r.id}
                request={r}
                acting={acting}
                onAction={handleAction}
                expanded={expandedId === r.id}
                onToggleExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
                fileContents={fileContents}
                fileLoading={fileLoading}
                onLoadFile={loadFileContent}
                onSandbox={setSandboxItem}
                showActions
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
                    onAction={handleAction}
                    expanded={expandedId === r.id}
                    onToggleExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    fileContents={fileContents}
                    fileLoading={fileLoading}
                    onLoadFile={loadFileContent}
                    onSandbox={setSandboxItem}
                    showActions={false}
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
            actingPanel={actingPanel}
            setActingPanel={setActingPanel}
            actionComment={actionComment}
            setActionComment={setActionComment}
            actionConditions={actionConditions}
            setActionConditions={setActionConditions}
            onAdminAction={handleAdminAction}
            fileContents={fileContents}
            fileLoading={fileLoading}
            onLoadFile={loadFileContent}
            onSandbox={setSandboxItem}
            page={adminPage}
            setPage={setAdminPage}
          />
        ) : (
          <div className="space-y-3">
            {filteredOutgoing.length === 0 && <EmptyState text="暂无发起的申请" />}
            {filteredOutgoing.map((r) => (
              <ApprovalCard
                key={r.id}
                request={r}
                acting={null}
                onAction={() => {}}
                expanded={expandedId === r.id}
                onToggleExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
                fileContents={fileContents}
                fileLoading={fileLoading}
                onLoadFile={loadFileContent}
                onSandbox={setSandboxItem}
                showActions={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MainTabButton({
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

function SystemPromptBlock({ value }: { value: unknown }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">System Prompt</div>
      <pre className="text-[10px] text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-background border border-border rounded px-3 py-2 max-h-48 overflow-y-auto">
        {String(value)}
      </pre>
    </div>
  );
}

function ApprovalCard({
  request: r,
  acting,
  onAction,
  expanded,
  onToggleExpand,
  fileContents,
  fileLoading,
  onLoadFile,
  onSandbox,
  showActions,
}: {
  request: ApprovalRequest;
  acting: number | null;
  onAction: (id: number, action: "approve" | "reject") => void;
  expanded: boolean;
  onToggleExpand: () => void;
  fileContents: Record<string, string>;
  fileLoading: string | null;
  onLoadFile: (skillId: number, filename: string) => void;
  onSandbox: (item: { id: number; name: string }) => void;
  showActions: boolean;
}) {
  const detail: Record<string, unknown> = (r.target_detail || {}) as Record<string, unknown>;
  const title = (detail.title || detail.name || `#${r.target_id}`) as string;
  const fileExt = detail.file_ext as string | undefined;
  const isPending = r.status === "pending";
  const isSkill = r.request_type === "skill_publish" || r.request_type === "skill_version_change" || r.request_type === "skill_ownership_transfer";
  const isTool = r.request_type === "tool_publish";
  const isWebApp = r.request_type === "webapp_publish";
  const isKnowledgeReview = r.request_type === "knowledge_review";
  const hasExpandable = isSkill || isTool || isWebApp || isKnowledgeReview;

  return (
    <div className="border border-border rounded-lg bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3 p-4">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
          {(r.requester_name || "?").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{r.requester_name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
              {requestTypeLabel(r.request_type)}
            </span>
            <StatusBadge status={r.status} />
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <FileText size={12} className="text-muted-foreground" />
            <span className="text-xs text-foreground font-medium truncate">{title}</span>
            {fileExt && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                {fileExt.replace(".", "").toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">{formatTime(r.created_at)}</div>

          {/* Action history */}
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

        {/* Right: actions + expand toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {showActions && isPending && (
            <>
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
            </>
          )}
          {hasExpandable && (
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && isSkill && (
        <SkillDetail
          detail={detail}
          targetId={r.target_id}
          isPending={isPending}
          fileContents={fileContents}
          fileLoading={fileLoading}
          onLoadFile={onLoadFile}
          onSandbox={onSandbox}
        />
      )}
      {expanded && isTool && (
        <div className="border-t border-border px-4 py-3 bg-muted/30">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">工具名：</span>{String(detail.tool_name || detail.name || "")}
          </div>
          {detail.description ? (
            <div className="text-xs text-muted-foreground mt-1">{String(detail.description)}</div>
          ) : null}
        </div>
      )}
      {expanded && isWebApp && (
        <div className="border-t border-border px-4 py-3 bg-muted/30">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">名称：</span>{String(detail.name || "")}
          </div>
          {detail.description ? (
            <div className="text-xs text-muted-foreground mt-1">{String(detail.description)}</div>
          ) : null}
          {detail.preview_url ? (
            <a
              href={String(detail.preview_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-xs font-medium text-primary hover:underline"
            >
              预览 Web App ↗
            </a>
          ) : null}
        </div>
      )}
      {expanded && isKnowledgeReview && (
        <KnowledgeReviewDetail detail={detail} />
      )}
    </div>
  );
}

function SkillDetail({
  detail,
  targetId,
  isPending,
  fileContents,
  fileLoading,
  onLoadFile,
  onSandbox,
}: {
  detail: Record<string, unknown>;
  targetId: number | null;
  isPending: boolean;
  fileContents: Record<string, string>;
  fileLoading: string | null;
  onLoadFile: (skillId: number, filename: string) => void;
  onSandbox: (item: { id: number; name: string }) => void;
}) {
  const sourceFiles = (detail.source_files || []) as { filename: string; category: string }[];

  return (
    <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-3">
      {/* Basic info */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-foreground">{String(detail.name || "")}</span>
        {detail.scope ? (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {String(detail.scope)}
          </span>
        ) : null}
        {isPending && targetId && (
          <button
            onClick={() => onSandbox({ id: targetId, name: String(detail.name || "") })}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors"
          >
            <Play size={10} />
            沙盒测试
          </button>
        )}
      </div>

      {detail.description ? (
        <div className="text-xs text-muted-foreground">{String(detail.description)}</div>
      ) : null}
      {detail.change_note ? (
        <div className="text-xs"><span className="text-muted-foreground">变更说明：</span>{String(detail.change_note)}</div>
      ) : null}

      {/* System Prompt */}
      <SystemPromptBlock value={detail.system_prompt} />

      {/* Source files */}
      {sourceFiles.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
            附属文件 ({sourceFiles.length})
          </div>
          <div className="space-y-1">
            {sourceFiles.map((f) => {
              const key = `${targetId}:${f.filename}`;
              return (
                <div key={f.filename}>
                  <button
                    onClick={() => targetId && onLoadFile(targetId, f.filename)}
                    className="flex items-center gap-2 w-full text-left px-2 py-1.5 border border-border rounded bg-background hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-xs font-mono font-medium text-foreground">{f.filename}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${CAT_COLOR[f.category] || "bg-gray-100 text-gray-600"}`}>
                      {f.category}
                    </span>
                    {fileLoading === key && (
                      <span className="text-[9px] text-primary animate-pulse ml-auto">加载中...</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fileContents[key] !== undefined ? "▼" : "▶"}
                    </span>
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
      )}
    </div>
  );
}

function KnowledgeReviewDetail({ detail }: { detail: Record<string, unknown> }) {
  const content = String(detail.content || "");
  const category = String(detail.category || "");
  const reviewLevel = detail.review_level as number | undefined;
  const reviewStage = String(detail.review_stage || "");
  const sensitivityFlags = (detail.sensitivity_flags || []) as string[];
  const autoReviewNote = String(detail.auto_review_note || "");

  const levelLabel: Record<number, string> = { 0: "L0 自动通过", 1: "L1 自动通过", 2: "L2 部门审核", 3: "L3 两级审核" };
  const stageLabel: Record<string, string> = {
    pending_dept: "待部门审核",
    dept_approved_pending_super: "部门已通过，待超管终审",
    approved: "已通过",
    auto_approved: "自动通过",
    rejected: "已拒绝",
  };

  return (
    <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-3">
      {/* 审核级别和阶段 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">知识审核</span>
        {reviewLevel != null && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
            reviewLevel >= 3 ? "bg-red-100 text-red-700" : reviewLevel >= 2 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
          }`}>
            {levelLabel[reviewLevel] || `L${reviewLevel}`}
          </span>
        )}
        {reviewStage && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
            {stageLabel[reviewStage] || reviewStage}
          </span>
        )}
        {category && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
            {category}
          </span>
        )}
      </div>

      {/* 敏感词标记 */}
      {sensitivityFlags.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertTriangle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex flex-wrap gap-1">
            {sensitivityFlags.map((flag) => (
              <span key={flag} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI 审核意见 */}
      {autoReviewNote && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
            <Shield size={10} />
            AI 审核意见
          </div>
          <div className="text-xs text-foreground bg-background border border-border rounded px-3 py-2">
            {autoReviewNote}
          </div>
        </div>
      )}

      {/* 知识内容 */}
      {content && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">内容预览</div>
          <pre className="text-[10px] text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-background border border-border rounded px-3 py-2 max-h-64 overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

const ADMIN_STATUS_TABS: { key: string; label: string }[] = [
  { key: "", label: "全部" },
  { key: "pending", label: "待审批" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已拒绝" },
];

function AdminAllTab({
  data,
  adminStatusFilter,
  setAdminStatusFilter,
  expandedId,
  setExpandedId,
  actingPanel,
  setActingPanel,
  actionComment,
  setActionComment,
  actionConditions,
  setActionConditions,
  onAdminAction,
  fileContents,
  fileLoading,
  onLoadFile,
  onSandbox,
  page,
  setPage,
}: {
  data: AdminApprovalResponse;
  adminStatusFilter: string;
  setAdminStatusFilter: (s: string) => void;
  expandedId: number | null;
  setExpandedId: (id: number | null) => void;
  actingPanel: number | null;
  setActingPanel: (id: number | null) => void;
  actionComment: string;
  setActionComment: (s: string) => void;
  actionConditions: string;
  setActionConditions: (s: string) => void;
  onAdminAction: (id: number, action: string) => void;
  fileContents: Record<string, string>;
  fileLoading: string | null;
  onLoadFile: (skillId: number, filename: string) => void;
  onSandbox: (item: { id: number; name: string }) => void;
  page: number;
  setPage: (p: number) => void;
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
              adminStatusFilter === s.key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="text-[10px] text-muted-foreground ml-auto">共 {data.total} 条</span>
      </div>

      {data.items.length === 0 && <EmptyState text="暂无审批记录" />}

      {/* Approval list as table-like cards */}
      {data.items.map((item) => {
        const detail: Record<string, unknown> = (item.target_detail || {}) as Record<string, unknown>;
        const title = (detail.title || detail.name || `#${item.target_id}`) as string;
        const isKR = item.request_type === "knowledge_review";
        const isSkillType = item.request_type === "skill_publish" || item.request_type === "skill_version_change" || item.request_type === "skill_ownership_transfer";

        return (
          <React.Fragment key={item.id}>
            <div className="border border-border rounded-lg bg-card">
              {/* Summary row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-[10px] text-muted-foreground w-8 flex-shrink-0">#{item.id}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex-shrink-0">
                  {requestTypeLabel(item.request_type)}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{item.requester_name || `#${item.requester_id}`}</span>
                <span className="text-xs font-medium text-foreground truncate flex-1">{title}</span>
                {item.stage && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    item.stage === "super_pending" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {item.stage === "super_pending" ? "待超管终审" : item.stage === "dept_pending" ? "待首轮审批" : item.stage}
                  </span>
                )}
                <StatusBadge status={item.status} />
                <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {formatTime(item.created_at)}
                </span>
                <button
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  className="text-[10px] font-medium text-primary hover:underline flex-shrink-0"
                >
                  {expandedId === item.id ? "收起" : "详情"}
                </button>
                {item.status === "pending" && (
                  <button
                    onClick={() => setActingPanel(actingPanel === item.id ? null : item.id)}
                    className="text-[10px] font-medium text-amber-600 hover:underline flex-shrink-0"
                  >
                    {actingPanel === item.id ? "取消" : "审批"}
                  </button>
                )}
              </div>

              {/* Expanded detail */}
              {expandedId === item.id && (
                <div className="border-t border-border px-4 py-3 bg-muted/30 space-y-3">
                  {/* Skill detail */}
                  {isSkillType && !!detail.name && (
                    <SkillDetail
                      detail={detail}
                      targetId={item.target_id}
                      isPending={item.status === "pending"}
                      fileContents={fileContents}
                      fileLoading={fileLoading}
                      onLoadFile={onLoadFile}
                      onSandbox={onSandbox}
                    />
                  )}

                  {/* Knowledge review detail */}
                  {isKR && <KnowledgeReviewDetail detail={detail} />}

                  {/* Tool detail */}
                  {item.request_type === "tool_publish" && !!detail.tool_name && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">工具名：</span>{String(detail.tool_name)}
                      {!!detail.description && <div className="mt-1">{String(detail.description)}</div>}
                    </div>
                  )}

                  {/* WebApp detail */}
                  {item.request_type === "webapp_publish" && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">名称：</span>{String(detail.name || "")}
                      {!!detail.description && <div className="mt-1">{String(detail.description)}</div>}
                      {!!detail.preview_url && (
                        <a href={String(detail.preview_url)} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-primary hover:underline">
                          预览 ↗
                        </a>
                      )}
                    </div>
                  )}

                  {/* Action history */}
                  {item.actions && item.actions.length > 0 && (
                    <div>
                      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">审批历史</div>
                      <div className="space-y-1">
                        {item.actions.map((a: { id: number; actor_name: string | null; actor_id: number; action: string; comment: string | null; created_at: string | null }) => (
                          <div key={a.id} className="flex items-center gap-2 text-[11px]">
                            <span className="text-muted-foreground">{formatTime(a.created_at)}</span>
                            <span className="font-medium text-foreground">{a.actor_name || `#${a.actor_id}`}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${
                              a.action === "approve" ? "bg-green-100 text-green-700" : a.action === "reject" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {a.action === "approve" ? "通过" : a.action === "reject" ? "拒绝" : "附条件"}
                            </span>
                            {a.comment && <span className="text-muted-foreground">{a.comment}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action panel */}
              {actingPanel === item.id && (
                <div className="border-t border-amber-200 px-4 py-3 bg-amber-50/50 space-y-2">
                  <div>
                    <label className="text-[10px] font-medium text-amber-700 block mb-1">审批备注</label>
                    <input
                      type="text"
                      value={actionComment}
                      onChange={(e) => setActionComment(e.target.value)}
                      placeholder="可选"
                      className="w-full border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-amber-700 block mb-1">附加条件（每行一条）</label>
                    <textarea
                      value={actionConditions}
                      onChange={(e) => setActionConditions(e.target.value)}
                      rows={2}
                      className="w-full border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary bg-background text-foreground resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onAdminAction(item.id, "approve")}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                    >
                      通过
                    </button>
                    <button
                      onClick={() => onAdminAction(item.id, "add_conditions")}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                    >
                      附条件通过
                    </button>
                    <button
                      onClick={() => onAdminAction(item.id, "reject")}
                      className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            上一页
          </button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
