"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Wrench, PlayCircle, AlertTriangle, FileText, ChevronDown, ChevronRight } from "lucide-react";
import { PersistentNotices } from "./PersistentNotices";
import { PixelButton } from "@/components/pixel/PixelButton";
import type { SkillMemo, SkillMemoTask } from "@/lib/types";

interface SkillMemoPanelProps {
  memo: SkillMemo;
  onStartTask: (taskId: string) => void;
  onDirectTest: () => void;
  onStartFixTask?: (task: SkillMemoTask) => void;
  onTargetedRetest?: (taskId: string) => void;
  onViewReport?: () => void;
  sandboxReportId?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500 text-white",
  medium: "bg-amber-500 text-white",
  low: "bg-gray-400 text-white",
};

const TYPE_LABELS: Record<string, string> = {
  fix_prompt_logic: "Prompt",
  fix_input_slot: "输入槽",
  fix_tool_usage: "工具",
  fix_knowledge_binding: "知识",
  fix_permission_handling: "权限",
  run_targeted_retest: "重测",
};

export function SkillMemoPanel({ memo, onStartTask, onDirectTest, onStartFixTask, onTargetedRetest, onViewReport, sandboxReportId }: SkillMemoPanelProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  // 提取所有 fix tasks
  const allMemoTasks = ((memo.memo as Record<string, unknown>)?.tasks as SkillMemoTask[] | undefined) || [];
  const fixTaskTypes = ["fix_prompt_logic", "fix_input_slot", "fix_tool_usage", "fix_knowledge_binding", "fix_permission_handling", "run_targeted_retest"];

  const pendingTasks = allMemoTasks.filter(t =>
    fixTaskTypes.includes(t.type) && t.status !== "done" && t.status !== "skipped"
  ).sort((a, b) => {
    const p: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (p[a.priority] ?? 2) - (p[b.priority] ?? 2);
  });

  const completedTasks = allMemoTasks.filter(t =>
    fixTaskTypes.includes(t.type) && (t.status === "done" || t.status === "skipped")
  );

  // 测试结论
  const testPassed = memo.latest_test
    ? (memo.latest_test.details?.approval_eligible != null
        ? memo.latest_test.details.approval_eligible
        : memo.latest_test.status === "passed")
    : null;
  const isFixing = memo.lifecycle_stage === "fixing" && testPassed === false;

  function toggleTaskExpanded(taskId: string) {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  return (
    <div className="flex flex-col">
      {/* ── 顶部：测试结论 + 报告入口 ── */}
      {memo.latest_test && (
        <div className={`mx-3 mt-3 mb-1 border-2 ${
          testPassed ? "border-[#68D391] bg-[#F0FFF4]" : "border-[#FC8181] bg-[#FFF5F5]"
        }`}>
          <div className={`px-3 py-1.5 flex items-center gap-2 ${testPassed ? "border-[#C6F6D5]" : "border-[#FED7D7]"}`}>
            {testPassed
              ? <CheckCircle size={10} className="text-[#38A169] flex-shrink-0" />
              : <XCircle size={10} className="text-[#E53E3E] flex-shrink-0" />
            }
            <span className={`text-[8px] font-bold uppercase tracking-widest ${testPassed ? "text-[#38A169]" : "text-[#E53E3E]"}`}>
              {testPassed ? "通过" : "失败"}
            </span>
            <span className="text-[7px] text-gray-400 flex-shrink-0">
              {memo.latest_test.source} v{memo.latest_test.version}
            </span>
            {sandboxReportId && (
              <span className="text-[7px] text-gray-400">#{sandboxReportId}</span>
            )}
            <span className="flex-1" />
            {onViewReport && (
              <button
                onClick={onViewReport}
                className="text-[7px] font-bold text-[#00A3C4] border border-[#00A3C4] px-1.5 py-0.5 hover:bg-[#00A3C4] hover:text-white flex items-center gap-0.5 flex-shrink-0"
              >
                <FileText size={7} /> 报告
              </button>
            )}
          </div>
          <div className="px-3 py-1.5 text-[8px] text-gray-600 leading-relaxed border-t border-gray-100 whitespace-pre-wrap break-words">
            {memo.latest_test.summary}
            {memo.latest_test.details?.blocking_reasons && memo.latest_test.details.blocking_reasons.length > 0 && (
              <div className="mt-0.5 text-[7px] text-red-500 whitespace-pre-wrap break-words">
                未通过: {memo.latest_test.details.blocking_reasons.join("、")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 当前任务 ── */}
      {memo.current_task && (
        <div className="mx-3 my-1 px-3 py-2 border-2 border-[#00D1FF] bg-[#F0FAFF]">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D1FF] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00A3C4]" />
            </span>
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">当前任务</span>
          </div>
          <div className="text-[8px] text-[#1A202C] font-medium whitespace-pre-wrap break-words">{memo.current_task.title}</div>
          {memo.current_task.target_files.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {memo.current_task.target_files.map(f => (
                <span key={f} className="text-[7px] px-1 py-0.5 bg-[#E0F7FF] text-[#00A3C4] font-mono">{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 持久提醒 ── */}
      <PersistentNotices
        notices={memo.persistent_notices}
        onStartTask={onStartTask}
        onDirectTest={onDirectTest}
      />

      {/* ── 待修复任务列表 ── */}
      {isFixing && pendingTasks.length > 0 && (
        <div className="mx-3 my-1">
          <div className="px-2 py-1.5 flex items-center gap-2 border-b border-amber-200">
            <AlertTriangle size={10} className="text-amber-600" />
            <span className="text-[8px] font-bold uppercase tracking-widest text-amber-700">
              待修复 ({pendingTasks.length})
            </span>
          </div>
          <div className="py-1 space-y-1">
            {pendingTasks.map(task => (
              <div key={task.id} className="px-2 py-1 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-1.5">
                  <span className={`text-[6px] font-bold px-1 py-0.5 rounded flex-shrink-0 ${PRIORITY_COLORS[task.priority] || "bg-gray-400 text-white"}`}>
                    {task.priority === "high" ? "P0" : task.priority === "medium" ? "P1" : "P2"}
                  </span>
                  <span className="text-[7px] font-bold text-gray-500 w-7 flex-shrink-0">
                    {TYPE_LABELS[task.type] || "修复"}
                  </span>
                  <span className="text-[8px] text-gray-700 flex-1 min-w-0 whitespace-pre-wrap break-words leading-relaxed">
                    {task.title.replace(/^修复:\s*/, "")}
                  </span>
                  {(task.description || task.acceptance_rule_text) && (
                    <button
                      type="button"
                      className="text-[7px] font-bold text-[#6B46C1] border border-[#E9D8FD] px-1 py-0.5 hover:bg-[#FAF5FF] flex-shrink-0"
                      onClick={() => toggleTaskExpanded(task.id)}
                    >
                      {expandedTaskIds.has(task.id) ? "收起" : "详情"}
                    </button>
                  )}
                  {task.type !== "run_targeted_retest" && onStartFixTask && (
                    <button
                      className="text-[7px] font-bold text-[#00A3C4] border border-[#00A3C4] px-1 py-0.5 hover:bg-[#00A3C4] hover:text-white flex-shrink-0"
                      onClick={() => onStartFixTask(task)}
                    >
                      <Wrench size={7} className="inline" /> 修复
                    </button>
                  )}
                  {task.type === "run_targeted_retest" && onTargetedRetest && (
                    <button
                      className="text-[7px] font-bold text-[#00CC99] border border-[#00CC99] px-1 py-0.5 hover:bg-[#00CC99] hover:text-white flex-shrink-0"
                      onClick={() => onTargetedRetest(task.id)}
                    >
                      <PlayCircle size={7} className="inline" /> 重测
                    </button>
                  )}
                </div>
                {expandedTaskIds.has(task.id) && (
                  <div className="ml-[56px] mt-1 space-y-1">
                    {task.description && (
                      <div className="text-[8px] text-gray-600 bg-gray-50 border-l-2 border-gray-300 px-2 py-1 whitespace-pre-wrap break-words">
                        {task.description}
                      </div>
                    )}
                    {task.acceptance_rule_text && (
                      <div className="text-[8px] text-[#00A3C4] bg-[#F0FAFF] border-l-2 border-[#00A3C4] px-2 py-1 whitespace-pre-wrap break-words">
                        验收：{task.acceptance_rule_text}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 已完成任务（折叠） ── */}
      {completedTasks.length > 0 && (
        <div className="mx-3 my-1">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full px-2 py-1 flex items-center gap-1.5 text-[7px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showCompleted ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
            已完成 ({completedTasks.length})
          </button>
          {showCompleted && (
            <div className="py-0.5 space-y-0.5">
              {completedTasks.map(task => (
                <div key={task.id} className="px-2 py-0.5 flex items-center gap-1.5 opacity-50">
                  <CheckCircle size={8} className="text-green-400 flex-shrink-0" />
                  <span className="text-[7px] text-gray-500 whitespace-pre-wrap break-words">{task.title.replace(/^修复:\s*/, "")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 底部操作栏 ── */}
      <div className="mx-3 my-2 flex gap-2 flex-wrap">
        {onViewReport && (
          <PixelButton size="sm" variant="secondary" onClick={onViewReport}>
            查看报告
          </PixelButton>
        )}
        <PixelButton size="sm" variant="secondary" onClick={onDirectTest}>
          运行测试
        </PixelButton>
      </div>
    </div>
  );
}
