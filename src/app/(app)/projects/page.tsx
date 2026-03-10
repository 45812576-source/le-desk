"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { apiFetch } from "@/lib/api";
import type { Project } from "@/lib/types";

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

function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <div className="border-2 border-[#1A202C] bg-white p-4 hover:bg-[#CCF2FF] transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-[12px] font-bold text-[#1A202C] leading-tight">
            {project.name}
          </h3>
          <span
            className="text-[8px] font-bold px-1.5 py-0.5 border flex-shrink-0"
            style={{ color: STATUS_COLOR[project.status], borderColor: STATUS_COLOR[project.status] }}
          >
            {STATUS_LABEL[project.status]}
          </span>
        </div>
        {project.description && (
          <p className="text-[10px] text-gray-500 mb-3 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(project.member_names || []).slice(0, 5).map((name, i) => (
              <div
                key={i}
                className="w-5 h-5 bg-[#00A3C4] flex items-center justify-center text-white text-[8px] font-bold"
                title={name}
              >
                {name.charAt(0)}
              </div>
            ))}
            {(project.member_count || 0) > 5 && (
              <span className="text-[8px] text-gray-400">+{(project.member_count || 0) - 5}</span>
            )}
          </div>
          <span className="text-[9px] text-gray-400 font-bold">
            {project.updated_at?.slice(0, 10)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Project[]>("/projects")
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell
      title="项目"
      icon={ICONS.project}
      actions={
        <button
          onClick={() => router.push("/projects/new")}
          className="px-3 py-1.5 text-[10px] font-bold uppercase border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4] transition-colors"
        >
          + 新建项目
        </button>
      }
    >
      {loading ? (
        <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-16">
          加载中...
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            暂无项目
          </div>
          <button
            onClick={() => router.push("/projects/new")}
            className="px-4 py-2 text-[10px] font-bold uppercase border-2 border-[#00A3C4] text-[#00A3C4] hover:bg-[#CCF2FF] transition-colors"
          >
            创建第一个项目
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
