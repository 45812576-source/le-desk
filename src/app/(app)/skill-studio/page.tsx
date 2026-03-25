"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Workspace } from "@/lib/types";

export default function SkillStudioEntryPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function enter() {
      try {
        const workspaces = await apiFetch<Workspace[]>("/workspaces");
        const studioWs = workspaces.find((ws) => ws.workspace_type === "skill_studio");
        if (!studioWs) {
          setError("Skill Studio 工作台尚未配置，请联系管理员");
          return;
        }
        const conv = await apiFetch<{ id: number }>("/conversations", {
          method: "POST",
          body: JSON.stringify({ workspace_id: studioWs.id }),
        });
        router.replace(`/chat/${conv.id}?ws=skill_studio`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "启动失败");
      }
    }
    enter();
  }, [router]);

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 bg-[#00D1FF]/20 border-2 border-[#00D1FF] flex items-center justify-center">
          <span className="text-[#00A3C4] font-bold text-sm">!</span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-[#00D1FF]/20 border-2 border-[#00D1FF] flex items-center justify-center">
        <span className="text-[#00A3C4] font-bold text-xs animate-pulse">SKILL</span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
        正在启动 Skill Studio...
      </p>
    </div>
  );
}
