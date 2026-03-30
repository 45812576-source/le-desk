"use client";

import { FileCode, CheckCircle } from "lucide-react";
import type { SkillMemoTask } from "@/lib/types";

interface CurrentTaskCardProps {
  task: SkillMemoTask;
  latestProgress?: string | null;
}

const ACCEPTANCE_HINTS: Record<string, string> = {
  all_target_files_saved_nonempty: "保存目标文件（内容不为空）后自动完成",
  tool_bound: "成功绑定工具后自动完成",
  test_record_created: "完成一次测试后自动完成",
  manual: "手动标记完成",
};

export function CurrentTaskCard({ task, latestProgress }: CurrentTaskCardProps) {
  const acceptanceHint = ACCEPTANCE_HINTS[task.acceptance_rule?.mode || ""] || "保存文件后自动完成";
  const isInProgress = task.status === "in_progress";

  return (
    <div className="mx-3 my-2 border-2 border-[#00D1FF] bg-[#F0FAFF] flex-shrink-0">
      <div className="px-3 py-2 border-b border-[#CCE8F4] flex items-center gap-2">
        {isInProgress ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D1FF] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00A3C4]" />
          </span>
        ) : (
          <CheckCircle size={10} className="text-[#00A3C4]" />
        )}
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] flex-1">
          当前任务
        </span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {/* 任务标题 */}
        <div className="flex gap-2 text-[9px]">
          <span className="font-bold text-[#00A3C4] flex-shrink-0 w-16">任务</span>
          <span className="text-[#1A202C] font-medium">{task.title}</span>
        </div>
        {/* 目标文件 */}
        {task.target_files.length > 0 && (
          <div className="flex gap-2 text-[9px]">
            <span className="font-bold text-[#00A3C4] flex-shrink-0 w-16">要改文件</span>
            <div className="flex flex-wrap gap-1">
              {task.target_files.map((f) => (
                <span key={f} className="inline-flex items-center gap-0.5 px-1 py-0.5 bg-[#E0F7FF] text-[#00A3C4] font-mono">
                  <FileCode size={8} />
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}
        {/* 完成标准 */}
        <div className="flex gap-2 text-[9px]">
          <span className="font-bold text-[#00A3C4] flex-shrink-0 w-16">完成标准</span>
          <span className="text-gray-600">{acceptanceHint}</span>
        </div>
        {/* 最近进度 */}
        {latestProgress && (
          <div className="flex gap-2 text-[9px]">
            <span className="font-bold text-[#00A3C4] flex-shrink-0 w-16">最近进度</span>
            <span className="text-gray-500 italic">{latestProgress}</span>
          </div>
        )}
      </div>
    </div>
  );
}
