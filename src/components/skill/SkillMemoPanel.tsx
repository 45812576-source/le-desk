"use client";

import { CheckCircle, XCircle, Wrench, PlayCircle, AlertTriangle } from "lucide-react";
import { PersistentNotices } from "./PersistentNotices";
import { CurrentTaskCard } from "./CurrentTaskCard";
import { PixelButton } from "@/components/pixel/PixelButton";
import type { SkillMemo, SkillMemoTask } from "@/lib/types";

interface SkillMemoPanelProps {
  memo: SkillMemo;
  onStartTask: (taskId: string) => void;
  onDirectTest: () => void;
  onStartFixTask?: (task: SkillMemoTask) => void;
  onTargetedRetest?: (taskId: string) => void;
}

export function SkillMemoPanel({ memo, onStartTask, onDirectTest, onStartFixTask, onTargetedRetest }: SkillMemoPanelProps) {
  const progressLog = (memo.memo as Record<string, unknown>)?.progress_log as { summary: string }[] | undefined;
  const latestProgress = progressLog?.length ? progressLog[progressLog.length - 1].summary : null;

  // 提取 fix tasks
  const allTasks = ((memo.memo as Record<string, unknown>)?.tasks as SkillMemoTask[] | undefined) || [];
  const fixTasks = allTasks.filter(t =>
    ["fix_prompt_logic", "fix_input_slot", "fix_tool_usage", "fix_knowledge_binding", "fix_permission_handling", "run_targeted_retest"].includes(t.type)
    && t.status !== "done" && t.status !== "skipped"
  ).sort((a, b) => {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
  });

  const isFixing = memo.lifecycle_stage === "fixing" && memo.latest_test?.status === "failed";

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

      {/* 测试整改区 */}
      {isFixing && fixTasks.length > 0 && (
        <div className="mx-3 my-2 border-2 border-amber-400 bg-amber-50 flex-shrink-0">
          <div className="px-3 py-2 border-b border-amber-300 flex items-center gap-2">
            <AlertTriangle size={12} className="text-amber-600" />
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700 flex-1">
              测试整改 ({fixTasks.length} 项待修复)
            </span>
          </div>

          {/* 测试结论摘要 */}
          {memo.latest_test && (
            <div className="px-3 py-1.5 border-b border-amber-200 text-[8px] text-amber-700">
              {memo.latest_test.summary}
            </div>
          )}

          {/* Fix tasks 列表 */}
          <div className="px-3 py-2 space-y-1.5">
            {fixTasks.slice(0, 5).map(task => {
              const priorityColors: Record<string, string> = {
                high: "bg-red-500 text-white",
                medium: "bg-amber-500 text-white",
                low: "bg-gray-400 text-white",
              };
              const typeLabels: Record<string, string> = {
                fix_prompt_logic: "Prompt",
                fix_input_slot: "输入槽",
                fix_tool_usage: "工具",
                fix_knowledge_binding: "知识",
                fix_permission_handling: "权限",
                run_targeted_retest: "重测",
              };
              return (
                <div key={task.id} className="flex items-center gap-1.5">
                  <span className={`text-[6px] font-bold px-1 py-0.5 rounded ${priorityColors[task.priority] || "bg-gray-400 text-white"}`}>
                    {task.priority === "high" ? "P0" : task.priority === "medium" ? "P1" : "P2"}
                  </span>
                  <span className="text-[7px] font-bold text-gray-500 w-8">
                    {typeLabels[task.type] || "修复"}
                  </span>
                  <span className="text-[8px] text-gray-700 flex-1 truncate">
                    {task.title.replace(/^修复:\s*/, "")}
                  </span>
                  <div className="flex gap-1">
                    {task.type !== "run_targeted_retest" && onStartFixTask && (
                      <button
                        className="text-[7px] font-bold text-[#00A3C4] border border-[#00A3C4] px-1 py-0.5 hover:bg-[#00A3C4] hover:text-white"
                        onClick={() => onStartFixTask(task)}
                      >
                        <Wrench size={8} className="inline" /> 修复
                      </button>
                    )}
                    {task.type === "run_targeted_retest" && onTargetedRetest && (
                      <button
                        className="text-[7px] font-bold text-[#00CC99] border border-[#00CC99] px-1 py-0.5 hover:bg-[#00CC99] hover:text-white"
                        onClick={() => onTargetedRetest(task.id)}
                      >
                        <PlayCircle size={8} className="inline" /> 重测
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {fixTasks.length > 5 && (
              <div className="text-[7px] text-gray-400 text-center">
                还有 {fixTasks.length - 5} 项...
              </div>
            )}
          </div>
        </div>
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
