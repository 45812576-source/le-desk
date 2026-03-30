"use client";

import { CheckCircle, XCircle } from "lucide-react";
import { PersistentNotices } from "./PersistentNotices";
import { CurrentTaskCard } from "./CurrentTaskCard";
import type { SkillMemo } from "@/lib/types";

interface SkillMemoPanelProps {
  memo: SkillMemo;
  onStartTask: (taskId: string) => void;
  onDirectTest: () => void;
}

export function SkillMemoPanel({ memo, onStartTask, onDirectTest }: SkillMemoPanelProps) {
  const progressLog = (memo.memo as Record<string, unknown>)?.progress_log as { summary: string }[] | undefined;
  const latestProgress = progressLog?.length ? progressLog[progressLog.length - 1].summary : null;

  return (
    <div className="flex-shrink-0">
      {/* 持久提醒区 */}
      <PersistentNotices
        notices={memo.persistent_notices}
        onStartTask={onStartTask}
        onDirectTest={onDirectTest}
      />

      {/* 当前任务卡 */}
      {memo.current_task && (
        <CurrentTaskCard
          task={memo.current_task}
          latestProgress={latestProgress}
        />
      )}

      {/* 最近测试结果卡 */}
      {memo.latest_test && (
        <div className={`mx-3 my-2 border-2 flex-shrink-0 ${
          memo.latest_test.status === "passed"
            ? "border-[#68D391] bg-[#F0FFF4]"
            : "border-[#FC8181] bg-[#FFF5F5]"
        }`}>
          <div className={`px-3 py-2 border-b flex items-center gap-2 ${
            memo.latest_test.status === "passed" ? "border-[#C6F6D5]" : "border-[#FED7D7]"
          }`}>
            {memo.latest_test.status === "passed" ? (
              <CheckCircle size={12} className="text-[#38A169]" />
            ) : (
              <XCircle size={12} className="text-[#E53E3E]" />
            )}
            <span className={`text-[9px] font-bold uppercase tracking-widest flex-1 ${
              memo.latest_test.status === "passed" ? "text-[#38A169]" : "text-[#E53E3E]"
            }`}>
              最近测试 — {memo.latest_test.status === "passed" ? "通过" : "失败"}
            </span>
            <span className="text-[8px] text-gray-400">
              {memo.latest_test.source} v{memo.latest_test.version}
            </span>
          </div>
          <div className="px-3 py-2 text-[9px] text-gray-600 leading-relaxed">
            {memo.latest_test.summary}
          </div>
        </div>
      )}
    </div>
  );
}
