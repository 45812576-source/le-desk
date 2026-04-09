"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { StudioEntryResolution } from "@/lib/types";

export default function DevStudioEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSkill = searchParams.get("from_skill");
  const viewId = searchParams.get("view_id");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function enter() {
      try {
        const entry = await apiFetch<StudioEntryResolution>("/dev-studio/entry");
        const qsParts: string[] = [];
        if (fromSkill) qsParts.push(`from_skill=${fromSkill}`);
        if (viewId) qsParts.push(`view_id=${viewId}`);
        const qs = qsParts.length > 0 ? `?${qsParts.join("&")}` : "";
        router.replace(`/chat/${entry.conversation_id}${qs}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "启动失败");
      }
    }
    enter();
  }, [router, fromSkill, viewId]);

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
