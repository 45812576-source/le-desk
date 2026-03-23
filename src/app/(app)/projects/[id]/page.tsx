"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageShell, ThemedPageIcon } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelUserPicker, type SuggestedUser } from "@/components/pixel/PixelUserPicker";
import { apiFetch } from "@/lib/api";
import type { Project, ProjectContext } from "@/lib/types";
import { ProjectChat } from "@/components/project/ProjectChat";

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  active: "进行中",
  completed: "已完结",
  archived: "已归档",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "#A0AEC0",
  active: "#00CC99",
  completed: "#3182CE",
  archived: "#718096",
};

const HANDOFF_LABEL: Record<string, string> = {
  none: "未提交",
  submitted: "已提交",
  accepted: "已接受",
};

const HANDOFF_COLOR: Record<string, string> = {
  none: "#A0AEC0",
  submitted: "#D97706",
  accepted: "#00CC99",
};

interface HandoffData {
  handoff_status: "none" | "submitted" | "accepted";
  requirements: string | null;
  acceptance_criteria: string | null;
  handoff_at: string | null;
}

function HandoffCard({ projectId, onHandoffComplete }: { projectId: string; onHandoffComplete: () => void }) {
  const [data, setData] = useState<HandoffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

  function loadHandoff() {
    return apiFetch<HandoffData>(`/projects/${projectId}/handoff`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadHandoff();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleSubmitHandoff() {
    setSubmitting(true);
    setError("");
    try {
      const result = await apiFetch<HandoffData>(`/projects/${projectId}/handoff`, { method: "POST" });
      setData({ ...result, handoff_status: "submitted", handoff_at: new Date().toISOString() });
      setExpanded(true);
      onHandoffComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "提取失败");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  const status = data?.handoff_status || "none";

  return (
    <div className="border-2 border-[#6B46C1] bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#6B46C1]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">
            需求交接
          </span>
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 border"
            style={{ color: HANDOFF_COLOR[status], borderColor: HANDOFF_COLOR[status] }}
          >
            {HANDOFF_LABEL[status]}
          </span>
          {data?.handoff_at && (
            <span className="text-[8px] text-gray-400">
              {data.handoff_at.slice(0, 16).replace("T", " ")}
            </span>
          )}
        </div>
        <button
          onClick={handleSubmitHandoff}
          disabled={submitting}
          className="px-3 py-1 text-[9px] font-bold uppercase border-2 border-[#6B46C1] text-[#6B46C1] hover:bg-[#6B46C1]/10 disabled:opacity-50 transition-colors"
        >
          {submitting ? "提取中..." : "提取需求并推送给研发"}
        </button>
      </div>

      {error && (
        <div className="text-[9px] font-bold text-red-500 border border-red-200 px-3 py-1.5 bg-red-50 mb-3">
          {error}
        </div>
      )}

      {status !== "none" && data?.requirements && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[9px] font-bold text-gray-400 text-left hover:text-gray-600 transition-colors"
          >
            {expanded ? "▾ 收起需求详情" : "▸ 展开需求详情"}
          </button>
          {expanded && (
            <div className="flex flex-col gap-3">
              <div className="bg-[#F0F4F8] p-3">
                <div className="text-[8px] font-bold uppercase tracking-widest text-[#6B46C1] mb-2">
                  功能需求
                </div>
                <pre className="text-[10px] text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                  {data.requirements}
                </pre>
              </div>
              {data.acceptance_criteria && (
                <div className="bg-[#F0F4F8] p-3">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-[#00CC99] mb-2">
                    验收标准
                  </div>
                  <pre className="text-[10px] text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
                    {data.acceptance_criteria}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {status === "none" && (
        <p className="text-[9px] text-gray-400 leading-relaxed">
          在需求方 Chat workspace 中与 AI 充分讨论需求后，点击上方按钮提取结构化需求并推送给研发。
        </p>
      )}
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  // 编辑态
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // 新增成员
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberUser, setNewMemberUser] = useState<SuggestedUser | null>(null);
  const [newMemberRole, setNewMemberRole] = useState("");
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState("");

  function loadProject() {
    return apiFetch<Project>(`/projects/${id}`)
      .then(setProject)
      .catch(() => router.push("/projects"));
  }

  useEffect(() => {
    loadProject().finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSync() {
    setSyncing(true);
    try {
      await apiFetch(`/projects/${id}/context/sync`, { method: "POST" });
      await loadProject();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  }

  async function handleComplete() {
    if (!confirm("确认完结该项目？")) return;
    setCompleting(true);
    try {
      await apiFetch(`/projects/${id}/complete`, { method: "POST" });
      await loadProject();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setCompleting(false);
    }
  }

  function startEdit() {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description || "");
    setEditError("");
    setEditing(true);
  }

  async function handleSave() {
    if (!editName.trim()) { setEditError("项目名称不能为空"); return; }
    setSaving(true);
    setEditError("");
    try {
      await apiFetch(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() }),
      });
      await loadProject();
      setEditing(false);
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember() {
    if (!newMemberUser) { setMemberError("请选择成员"); return; }
    if (!newMemberRole.trim()) { setMemberError("请填写分工描述"); return; }
    setMemberSaving(true);
    setMemberError("");
    try {
      await apiFetch(`/projects/${id}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: newMemberUser.id, role_desc: newMemberRole.trim() }),
      });
      await loadProject();
      setAddingMember(false);
      setNewMemberUser(null);
      setNewMemberRole("");
    } catch (err: unknown) {
      setMemberError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setMemberSaving(false);
    }
  }

  async function handleRemoveMember(memberId: number) {
    if (!confirm("确认移除该成员？")) return;
    try {
      await apiFetch(`/projects/${id}/members/${memberId}`, { method: "DELETE" });
      await loadProject();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "移除失败");
    }
  }

  if (loading) {
    return (
      <PageShell title="项目详情" icon={ICONS.project}>
        <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-16">加载中...</div>
      </PageShell>
    );
  }

  if (!project) return null;

  const isDev = project.project_type === "dev";

  const contextMap: Record<number, ProjectContext> = {};
  for (const ctx of project.contexts || []) {
    contextMap[ctx.workspace_id] = ctx;
  }

  const isActive = project.status === "active";

  // dev 项目：区分 chat/opencode workspace
  const chatMember = isDev
    ? (project.members || []).find((m) => {
        // 按 role_desc 判断，或按 workspace_type（如有）
        return m.role_desc === "需求定义";
      })
    : null;
  const devMember = isDev
    ? (project.members || []).find((m) => m.role_desc === "代码实施")
    : null;

  const actions = (
    <div className="flex gap-2">
      <button
        onClick={startEdit}
        className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#CCF2FF] transition-colors"
      >
        编辑信息
      </button>
      <Link
        href={`/projects/${id}/reports`}
        className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#CCF2FF] transition-colors"
      >
        日/周报
      </Link>
      {project.status === "draft" && project.llm_generated_plan && (
        <Link
          href={`/projects/${id}/plan`}
          className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#805AD5] text-[#805AD5] hover:bg-[#E9D8FD] transition-colors"
        >
          查看规划
        </Link>
      )}
      {isActive && (
        <>
          {!isDev && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#00A3C4] text-[#00A3C4] hover:bg-[#CCF2FF] disabled:opacity-50 transition-colors"
            >
              {syncing ? "同步中..." : "同步进展"}
            </button>
          )}
          <button
            onClick={handleComplete}
            disabled={completing}
            className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#00CC99] bg-[#00CC99] text-white hover:bg-[#00A87A] disabled:opacity-50 transition-colors"
          >
            完结项目
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header — 复用 PageShell 风格 */}
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center justify-between flex-shrink-0 bg-[var(--card,white)]">
        <div className="flex items-center gap-2">
          <ThemedPageIcon icon={ICONS.project} size={16} />
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">
            {project.name}
          </h1>
        </div>
        {actions}
      </div>

      {/* Body — 左侧内容 + 右侧 chat，各自独立滚动 */}
      <div className="flex flex-1 min-h-0">
        {/* 左侧：可滚动的项目内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-5 max-w-3xl">
        {error && (
          <div className="text-[10px] font-bold text-red-500 border border-red-300 px-3 py-2 bg-red-50">
            {error}
          </div>
        )}

        {/* 项目信息 */}
        <div className="border-2 border-[#1A202C] bg-white p-4">
          {editing ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold uppercase text-[#1A202C]">项目名称 *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border-2 border-[#1A202C] px-3 py-2 text-[11px] font-bold bg-white focus:outline-none focus:border-[#00A3C4]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold uppercase text-[#1A202C]">项目背景</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={4}
                  className="border-2 border-[#1A202C] px-3 py-2 text-[11px] bg-white focus:outline-none focus:border-[#00A3C4] resize-none leading-relaxed"
                />
              </div>
              {editError && (
                <div className="text-[9px] font-bold text-red-500 border border-red-200 px-3 py-1.5 bg-red-50">
                  {editError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-1.5 text-[9px] font-bold uppercase border-2 border-gray-400 text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-1.5 text-[9px] font-bold uppercase border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4] disabled:opacity-50 transition-colors"
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[13px] font-bold text-[#1A202C]">{project.name}</h2>
                    {isDev && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 bg-[#6B46C1] text-white">
                        DEV
                      </span>
                    )}
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 border"
                      style={{ color: STATUS_COLOR[project.status], borderColor: STATUS_COLOR[project.status] }}
                    >
                      {STATUS_LABEL[project.status]}
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    负责人：{project.owner_name} · 创建于 {project.created_at?.slice(0, 10)}
                  </div>
                </div>
              </div>
              {project.description && (
                <p className="text-[10px] text-gray-600 leading-relaxed border-t border-[#E2E8F0] pt-3">
                  {project.description}
                </p>
              )}
            </>
          )}
        </div>

        {/* dev 项目：需求交接卡片（插在两个 workspace 之间） */}
        {isDev && isActive && (
          <HandoffCard projectId={id} onHandoffComplete={loadProject} />
        )}

        {/* 成员 Workspace 卡片 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
              — 成员工作台
            </div>
            {!isDev && (project.members || []).length < 5 && (
              <button
                onClick={() => { setAddingMember(true); setMemberError(""); setNewMemberUser(null); setNewMemberRole(""); }}
                className="text-[9px] font-bold uppercase px-2 py-1 border border-[#00A3C4] text-[#00A3C4] hover:bg-[#CCF2FF] transition-colors"
              >
                + 添加成员
              </button>
            )}
          </div>

          {/* 新增成员表单 */}
          {addingMember && (
            <div className="border border-[#E2E8F0] p-3 flex flex-col gap-2 bg-[#FAFBFC] mb-3">
              <div className="text-[9px] font-bold uppercase text-gray-500">新增成员</div>
              <PixelUserPicker
                value={newMemberUser ? { user_id: newMemberUser.id, display_name: newMemberUser.display_name } : null}
                onChange={(u) => setNewMemberUser(u)}
                excludeIds={(project.members || []).map((m) => m.user_id)}
                placeholder="选择成员"
                accentColor="cyan"
              />
              <textarea
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
                placeholder="描述该成员的分工职责..."
                rows={2}
                className="border-2 border-[#1A202C] px-2 py-1.5 text-[10px] bg-white focus:outline-none focus:border-[#00A3C4] resize-none"
              />
              {memberError && (
                <div className="text-[9px] font-bold text-red-500 border border-red-200 px-2 py-1 bg-red-50">
                  {memberError}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setAddingMember(false)}
                  className="px-3 py-1 text-[9px] font-bold uppercase border border-gray-400 text-gray-500 hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddMember}
                  disabled={memberSaving}
                  className="px-3 py-1 text-[9px] font-bold uppercase border border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4] disabled:opacity-50 transition-colors"
                >
                  {memberSaving ? "添加中..." : "确认添加"}
                </button>
              </div>
            </div>
          )}
          {(project.members || []).length === 0 ? (
            <div className="text-[10px] text-gray-400 text-center py-8 border-2 border-dashed border-gray-300">
              暂无成员
            </div>
          ) : isDev ? (
            // dev 项目：单独渲染两个 workspace，有角色标识
            <div className="grid grid-cols-2 gap-3">
              {[chatMember, devMember].filter(Boolean).map((member) => {
                if (!member) return null;
                const isChatRole = member.role_desc === "需求定义";
                const ctx = member.workspace_id ? contextMap[member.workspace_id] : null;
                const wsHref = member.workspace_id
                  ? isChatRole
                    ? `/chat?workspace=${member.workspace_id}`
                    : `/dev-studio?workspace=${member.workspace_id}`
                  : null;

                return (
                  <div
                    key={member.id}
                    className={`border-2 bg-white p-4 ${isChatRole ? "border-[#00A3C4]" : "border-[#6B46C1]"}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span
                            className={`text-[8px] font-bold px-1.5 py-0.5 text-white ${isChatRole ? "bg-[#00A3C4]" : "bg-[#6B46C1]"}`}
                          >
                            {isChatRole ? "需求方" : "开发方"}
                          </span>
                          <span className="text-[8px] text-gray-400">
                            {isChatRole ? "Chat" : "OpenCode"}
                          </span>
                        </div>
                        <div className="text-[11px] font-bold text-[#1A202C]">
                          {member.display_name}
                        </div>
                      </div>
                    </div>

                    {ctx?.summary ? (
                      <div className="bg-[#F0F4F8] p-2 mb-3">
                        <div className="text-[8px] font-bold uppercase text-gray-400 mb-1">最新进展</div>
                        <p className="text-[10px] text-gray-700 leading-relaxed line-clamp-3">
                          {ctx.summary}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-[#F0F4F8] p-2 mb-3 text-[10px] text-gray-400 text-center">
                        暂无进展摘要
                      </div>
                    )}

                    {wsHref ? (
                      <Link
                        href={wsHref}
                        className={`block text-center text-[9px] font-bold uppercase border px-2 py-1.5 transition-colors ${
                          isChatRole
                            ? "border-[#00A3C4] text-[#00A3C4] hover:bg-[#CCF2FF]"
                            : "border-[#6B46C1] text-[#6B46C1] hover:bg-[#6B46C1]/10"
                        }`}
                      >
                        进入 Workspace →
                      </Link>
                    ) : (
                      <div className="text-[9px] text-gray-400 text-center py-1">
                        Workspace 待创建
                      </div>
                    )}
                  </div>
                );
              })}
              {/* 如果还有其他成员（防御性） */}
              {(project.members || [])
                .filter((m) => m.id !== chatMember?.id && m.id !== devMember?.id)
                .map((member) => {
                  const ctx = member.workspace_id ? contextMap[member.workspace_id] : null;
                  return (
                    <div key={member.id} className="border-2 border-[#1A202C] bg-white p-4">
                      <div className="text-[11px] font-bold text-[#1A202C] mb-1">{member.display_name}</div>
                      <div className="text-[9px] text-[#00A3C4] font-bold mb-2">{member.role_desc}</div>
                      {ctx?.summary && (
                        <div className="bg-[#F0F4F8] p-2 mb-3 text-[10px] text-gray-700 leading-relaxed line-clamp-3">
                          {ctx.summary}
                        </div>
                      )}
                      {member.workspace_id && (
                        <Link
                          href={`/chat?workspace=${member.workspace_id}`}
                          className="block text-center text-[9px] font-bold uppercase border border-[#00A3C4] text-[#00A3C4] px-2 py-1.5 hover:bg-[#CCF2FF] transition-colors"
                        >
                          进入 Workspace →
                        </Link>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            // custom 项目：原有渲染
            <div className="grid grid-cols-2 gap-3">
              {(project.members || []).map((member) => {
                const ctx = member.workspace_id ? contextMap[member.workspace_id] : null;
                return (
                  <div key={member.id} className="border-2 border-[#1A202C] bg-white p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="text-[11px] font-bold text-[#1A202C]">
                          {member.display_name}
                        </div>
                        <div className="text-[9px] text-[#00A3C4] font-bold">
                          {member.role_desc || "项目成员"}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {member.task_order > 0 ? (
                          <span className="text-[8px] font-bold px-1 py-0.5 bg-[#805AD5] text-white">
                            顺序 {member.task_order}
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold px-1 py-0.5 bg-[#00CC99] text-white">
                            并行
                          </span>
                        )}
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="text-[8px] font-bold text-red-400 hover:text-red-600 px-1"
                          title="移除成员"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {ctx?.summary ? (
                      <div className="bg-[#F0F4F8] p-2 mb-3">
                        <div className="text-[8px] font-bold uppercase text-gray-400 mb-1">最新进展</div>
                        <p className="text-[10px] text-gray-700 leading-relaxed line-clamp-3">
                          {ctx.summary}
                        </p>
                        <div className="text-[8px] text-gray-400 mt-1">
                          更新于 {ctx.updated_at?.slice(0, 16).replace("T", " ")}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#F0F4F8] p-2 mb-3 text-[10px] text-gray-400 text-center">
                        暂无进展摘要
                      </div>
                    )}

                    {member.workspace_id ? (
                      <Link
                        href={`/chat?workspace=${member.workspace_id}`}
                        className="block text-center text-[9px] font-bold uppercase border border-[#00A3C4] text-[#00A3C4] px-2 py-1.5 hover:bg-[#CCF2FF] transition-colors"
                      >
                        进入 Workspace →
                      </Link>
                    ) : (
                      <div className="text-[9px] text-gray-400 text-center py-1">
                        Workspace 待创建
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 共享知识 */}
        {(project.knowledge_shares || []).length > 0 && (
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">
              — 共享知识
            </div>
            <div className="border-2 border-[#1A202C] bg-white divide-y divide-[#E2E8F0]">
              {(project.knowledge_shares || []).map((share) => (
                <div key={share.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-[#1A202C]">
                      {share.knowledge_title || `知识 #${share.knowledge_id}`}
                    </span>
                    <span className="text-[9px] text-gray-400 ml-2">
                      by {share.user_name}
                    </span>
                  </div>
                  <span className="text-[8px] text-gray-400">
                    {share.shared_at?.slice(0, 10)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>{/* max-w-3xl */}
        </div>{/* 左侧滚动区 */}

        {/* 右侧：chat 面板，固定高度独立滚动 */}
        <ProjectChat projectId={id} className="w-80 flex-shrink-0" />
      </div>{/* body flex */}
    </div>
  );
}
