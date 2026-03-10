"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { apiFetch } from "@/lib/api";
import type { Project, ProjectWorkspacePlan } from "@/lib/types";

function WorkspacePlanCard({
  plan,
  memberName,
}: {
  plan: ProjectWorkspacePlan;
  memberName: string;
}) {
  return (
    <div className="border-2 border-[#1A202C] bg-white p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold text-[#1A202C]">{plan.workspace_name}</div>
          <div className="text-[9px] text-[#00A3C4] font-bold uppercase mt-0.5">
            {plan.identity_desc}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[8px] font-bold px-1.5 py-0.5 bg-[#EBF4F7] border border-[#00A3C4] text-[#00A3C4]">
            {memberName}
          </span>
          {plan.task_order > 0 && (
            <span className="text-[8px] font-bold px-1 py-0.5 bg-[#805AD5] text-white">
              顺序 {plan.task_order}
            </span>
          )}
          {plan.task_order === 0 && (
            <span className="text-[8px] font-bold px-1 py-0.5 bg-[#00CC99] text-white">
              并行
            </span>
          )}
        </div>
      </div>

      {/* Responsibilities */}
      {plan.responsibilities.length > 0 && (
        <div>
          <div className="text-[9px] font-bold uppercase text-gray-500 mb-1">职责</div>
          <ul className="flex flex-col gap-0.5">
            {plan.responsibilities.map((r, i) => (
              <li key={i} className="text-[10px] text-gray-700 flex gap-1.5">
                <span className="text-[#00A3C4] flex-shrink-0">▸</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Skills & Tools */}
      <div className="flex gap-3">
        {plan.suggested_skills.length > 0 && (
          <div className="flex-1">
            <div className="text-[9px] font-bold uppercase text-gray-500 mb-1">推荐 Skill</div>
            <div className="flex flex-wrap gap-1">
              {plan.suggested_skills.map((s, i) => (
                <span key={i} className="text-[8px] font-bold px-1.5 py-0.5 border border-[#00A3C4] text-[#00A3C4]">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {plan.suggested_tools.length > 0 && (
          <div className="flex-1">
            <div className="text-[9px] font-bold uppercase text-gray-500 mb-1">推荐工具</div>
            <div className="flex flex-wrap gap-1">
              {plan.suggested_tools.map((t, i) => (
                <span key={i} className="text-[8px] font-bold px-1.5 py-0.5 border border-[#718096] text-gray-500">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Project>(`/projects/${id}`)
      .then(setProject)
      .catch(() => router.push("/projects"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleApply() {
    setError("");
    setApplying(true);
    try {
      await apiFetch(`/projects/${id}/apply-plan`, { method: "POST" });
      router.push(`/projects/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "执行失败");
    } finally {
      setApplying(false);
    }
  }

  async function handleRegenerate() {
    setError("");
    setRegenerating(true);
    try {
      const res = await apiFetch<{ plan: Project["llm_generated_plan"] }>(`/projects/${id}/generate`, {
        method: "POST",
      });
      setProject((prev) => prev ? { ...prev, llm_generated_plan: res.plan } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <PageShell title="规划方案" icon={ICONS.project}>
        <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-16">加载中...</div>
      </PageShell>
    );
  }

  const plan = project?.llm_generated_plan;
  const memberMap = Object.fromEntries(
    (project?.members || []).map((m) => [m.user_id, m.display_name || `user#${m.user_id}`])
  );

  return (
    <PageShell
      title={`规划方案 · ${project?.name}`}
      icon={ICONS.project}
      actions={
        <div className="flex gap-2">
          <button
            onClick={handleRegenerate}
            disabled={regenerating || applying}
            className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#CCF2FF] disabled:opacity-50 transition-colors"
          >
            {regenerating ? "重新生成中..." : "重新生成"}
          </button>
          <button
            onClick={handleApply}
            disabled={applying || regenerating || !plan}
            className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#00CC99] bg-[#00CC99] text-white hover:bg-[#00A87A] disabled:opacity-50 transition-colors"
          >
            {applying ? "创建中..." : "确认并创建 Workspace →"}
          </button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto flex flex-col gap-5">
        {error && (
          <div className="text-[10px] font-bold text-red-500 border border-red-300 px-3 py-2 bg-red-50">
            {error}
          </div>
        )}

        {!plan ? (
          <div className="text-[10px] text-gray-400 text-center py-16">暂无规划方案，请点击生成</div>
        ) : (
          <>
            {/* 整体流程说明 */}
            {plan.overall_flow && (
              <div className="border-2 border-[#1A202C] bg-[#EBF4F7] p-4">
                <div className="text-[9px] font-bold uppercase text-[#00A3C4] mb-1">— 整体流程</div>
                <div className="text-[11px] text-[#1A202C]">{plan.overall_flow}</div>
              </div>
            )}

            {/* Workspace 卡片 */}
            <div className="grid grid-cols-2 gap-4">
              {(plan.workspaces || []).map((ws, i) => (
                <WorkspacePlanCard
                  key={i}
                  plan={ws}
                  memberName={memberMap[ws.user_id] || `user#${ws.user_id}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
