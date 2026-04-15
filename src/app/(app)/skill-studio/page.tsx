"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { StudioEntryResolution } from "@/lib/types";

export default function SkillStudioEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function enter() {
      try {
        const skillId = searchParams.get("skill_id");
        const qs = skillId
          ? `/conversations/studio-entry?type=skill_studio&skill_id=${skillId}`
          : "/conversations/studio-entry?type=skill_studio";
        const entry = await apiFetch<StudioEntryResolution>(qs);
        router.replace(
          `/chat/${entry.conversation_id}?ws=skill_studio${skillId ? `&skill_id=${skillId}` : ""}`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "启动失败");
      }
    }
    enter();
  }, [router, searchParams]);

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
