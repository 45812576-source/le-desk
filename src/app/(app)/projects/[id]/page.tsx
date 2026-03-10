"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { apiFetch } from "@/lib/api";
import type { Project, ProjectContext } from "@/lib/types";

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

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

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

  if (loading) {
    return (
      <PageShell title="项目详情" icon={ICONS.project}>
        <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-16">加载中...</div>
      </PageShell>
    );
  }

  if (!project) return null;

  const contextMap: Record<number, ProjectContext> = {};
  for (const ctx of project.contexts || []) {
    contextMap[ctx.workspace_id] = ctx;
  }

  const isActive = project.status === "active";

  return (
    <PageShell
      title={project.name}
      icon={ICONS.project}
      actions={
        <div className="flex gap-2">
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
              <button
                onClick={handleSync}
                disabled={syncing}
                className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#00A3C4] text-[#00A3C4] hover:bg-[#CCF2FF] disabled:opacity-50 transition-colors"
              >
                {syncing ? "同步中..." : "同步进展"}
              </button>
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
      }
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        {error && (
          <div className="text-[10px] font-bold text-red-500 border border-red-300 px-3 py-2 bg-red-50">
            {error}
          </div>
        )}

        {/* 项目信息 */}
        <div className="border-2 border-[#1A202C] bg-white p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-bold text-[#1A202C]">{project.name}</h2>
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
        </div>

        {/* 成员 Workspace 卡片 */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">
            — 成员工作台
          </div>
          {(project.members || []).length === 0 ? (
            <div className="text-[10px] text-gray-400 text-center py-8 border-2 border-dashed border-gray-300">
              暂无成员
            </div>
          ) : (
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
                      {member.task_order > 0 ? (
                        <span className="text-[8px] font-bold px-1 py-0.5 bg-[#805AD5] text-white flex-shrink-0">
                          顺序 {member.task_order}
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold px-1 py-0.5 bg-[#00CC99] text-white flex-shrink-0">
                          并行
                        </span>
                      )}
                    </div>

                    {/* 进度摘要 */}
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

                    {/* 跳转到 workspace */}
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
      </div>
    </PageShell>
  );
}
