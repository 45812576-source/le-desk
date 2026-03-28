"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Workspace } from "@/lib/types";

export default function DevStudioEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSkill = searchParams.get("from_skill");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function enter() {
      try {
        // 找到 opencode workspace
        const workspaces = await apiFetch<Workspace[]>("/workspaces");
        const devWs = workspaces.find((ws) => ws.workspace_type === "opencode");
        if (!devWs) {
          setError("工具开发工作台尚未配置，请联系管理员");
          return;
        }
        // 创建新对话并绑定该 workspace
        const conv = await apiFetch<{ id: number }>("/conversations", {
          method: "POST",
          body: JSON.stringify({ workspace_id: devWs.id }),
        });
        const qs = fromSkill ? `?from_skill=${fromSkill}` : "";
        router.replace(`/chat/${conv.id}${qs}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "启动失败");
      }
    }
    enter();
  }, [router, fromSkill]);

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 bg-[#6B46C1]/20 border-2 border-[#6B46C1] flex items-center justify-center">
          <span className="text-[#6B46C1] font-bold text-sm">!</span>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-[#6B46C1]/20 border-2 border-[#6B46C1] flex items-center justify-center">
        <span className="text-[#D2A8FF] font-bold text-xs animate-pulse">DEV</span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B46C1] animate-pulse">
        正在启动工具开发工作台...
      </p>
    </div>
  );
}
