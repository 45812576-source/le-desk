"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { StudioEntryResolution } from "@/lib/types";

type EntryStep = "workspace" | "session" | "runtime" | "ready";

const STEP_LABELS: Record<EntryStep, string> = {
  workspace: "加载工作区",
  session: "恢复历史会话",
  runtime: "启动运行时",
  ready: "已就绪",
};

export default function DevStudioEntryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSkill = searchParams.get("from_skill");
  const viewId = searchParams.get("view_id");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<EntryStep>("workspace");
  const [entry, setEntry] = useState<StudioEntryResolution | null>(null);

  useEffect(() => {
    async function enter() {
      try {
        // Step 1: 加载工作区 + 恢复会话（GET /entry）
        setStep("workspace");
        const entryData = await apiFetch<StudioEntryResolution>("/dev-studio/entry");
        setEntry(entryData);
        setStep("session");

        // Step 2: 启动运行时（POST /entry）
        setStep("runtime");
        const startData = await apiFetch<StudioEntryResolution>("/dev-studio/entry", {
          method: "POST",
        });

        if (startData.runtime_error) {
          // 运行时启动失败但工作区信息可用 — 仍跳转，DevStudio 组件会显示降级状态
          console.warn("运行时启动失败:", startData.runtime_error);
        }

        // Step 3: 跳转
        setStep("ready");
        const qsParts: string[] = [];
        if (fromSkill) qsParts.push(`from_skill=${fromSkill}`);
        if (viewId) qsParts.push(`view_id=${viewId}`);
        const qs = qsParts.length > 0 ? `?${qsParts.join("&")}` : "";
        router.replace(`/chat/${entryData.conversation_id}${qs}`);
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
        {entry && (entry.opencode_session_count ?? 0) > 0 && (
          <p className="text-[9px] text-gray-400 mt-2">
            工作区存在，包含 {entry.opencode_session_count} 个 OpenCode 历史会话（数据完好）
          </p>
        )}
        <button
          onClick={() => window.location.reload()}
          className="mt-2 px-4 py-2 text-[9px] font-bold uppercase tracking-widest border-2 border-[#6B46C1] text-[#6B46C1] hover:bg-[#6B46C1]/10 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 bg-[#6B46C1]/20 border-2 border-[#6B46C1] flex items-center justify-center">
        <span className="text-[#D2A8FF] font-bold text-xs animate-pulse">DEV</span>
      </div>
      {/* 分步状态 */}
      <div className="flex flex-col items-center gap-1.5">
        {(Object.keys(STEP_LABELS) as EntryStep[]).map((s) => {
          const isCurrent = s === step;
          const isDone = Object.keys(STEP_LABELS).indexOf(s) < Object.keys(STEP_LABELS).indexOf(step);
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 ${isDone ? "bg-[#00CC99]" : isCurrent ? "bg-[#6B46C1] animate-pulse" : "bg-gray-300"}`} />
              <span className={`text-[9px] font-bold uppercase tracking-widest ${isCurrent ? "text-[#6B46C1]" : isDone ? "text-[#00CC99]" : "text-gray-300"}`}>
                {STEP_LABELS[s]}
              </span>
            </div>
          );
        })}
      </div>
      {entry && entry.last_active_at && (
        <p className="text-[8px] text-gray-400 mt-1">
          上次活跃: {new Date(entry.last_active_at).toLocaleString("zh-CN")}
        </p>
      )}
    </div>
  );
}
