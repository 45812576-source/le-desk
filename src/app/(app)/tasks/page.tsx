"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { apiFetch } from "@/lib/api";
import type { TaskItem, TaskStats, ConfirmationItem } from "@/lib/types";

const PRIORITY_COLOR: Record<string, string> = {
  urgent_important: "#E53E3E",
  urgent: "#ED8936",
  important: "#3182CE",
  neither: "#A0AEC0",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent_important: "紧急重要",
  urgent: "紧急",
  important: "重要",
  neither: "其他",
};

const SOURCE_LABEL: Record<string, string> = {
  chat_message: "会话",
  ai_generated: "AI生成",
  draft: "草稿",
  manual: "手动",
};

function TaskCard({
  task,
  onDone,
  onDelete,
}: {
  task: TaskItem;
  onDone: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasSubs = !!task.sub_tasks?.length;

  return (
    <div className="border-2 border-[#1A202C] bg-white">
      {/* Parent row */}
      <div className="flex items-stretch">
        <div className="w-1 flex-shrink-0" style={{ background: PRIORITY_COLOR[task.priority] }} />
        <div className="flex-1 px-3 py-2 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {hasSubs && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-[9px] font-bold text-[#00A3C4] w-4 h-4 border border-[#00A3C4] flex items-center justify-center flex-shrink-0 hover:bg-[#CCF2FF]"
                >
                  {expanded ? "▾" : "▸"}
                </button>
              )}
              <span className="text-[11px] font-bold text-[#1A202C] leading-tight">
                {task.title}
              </span>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => onDone(task.id)}
                title="标记完成"
                className="w-6 h-6 border border-[#1A202C] bg-white hover:bg-[#00CC99] hover:text-white text-[10px] font-bold flex items-center justify-center transition-colors"
              >
                ✓
              </button>
              <button
                onClick={() => onDelete(task.id)}
                title="删除"
                className="w-6 h-6 border border-[#1A202C] bg-white hover:bg-[#E53E3E] hover:text-white text-[10px] font-bold flex items-center justify-center transition-colors"
              >
                ×
              </button>
            </div>
          </div>
          {task.description && (
            <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[8px] font-bold px-1 border"
              style={{ color: PRIORITY_COLOR[task.priority], borderColor: PRIORITY_COLOR[task.priority] }}
            >
              {PRIORITY_LABEL[task.priority]}
            </span>
            <span className="text-[8px] font-bold uppercase px-1 border border-gray-300 text-gray-400">
              {SOURCE_LABEL[task.source_type] ?? task.source_type}
            </span>
            {task.due_date && (
              <span className="text-[8px] text-gray-400 font-bold">
                截止 {task.due_date.slice(0, 10)}
              </span>
            )}
            {hasSubs && (
              <span className="text-[8px] text-gray-400">
                {task.sub_tasks!.length} 个子任务
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-tasks */}
      {hasSubs && expanded && (
        <div className="border-t border-[#E2E8F0]">
          {task.sub_tasks!.map((sub, idx) => (
            <div
              key={sub.id}
              className={`flex items-stretch ${idx < task.sub_tasks!.length - 1 ? "border-b border-[#F0F4F8]" : ""}`}
            >
              <div className="w-1 flex-shrink-0 bg-transparent" />
              <div className="w-3 flex-shrink-0 flex items-center justify-center">
                <div className="w-px h-full bg-[#E2E8F0]" />
              </div>
              <div
                className="w-0.5 flex-shrink-0"
                style={{ background: PRIORITY_COLOR[sub.priority], opacity: 0.6 }}
              />
              <div className="flex-1 px-3 py-1.5 min-w-0 bg-[#FAFBFC]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-[#1A202C]">{sub.title}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => onDone(sub.id)}
                      title="标记完成"
                      className="w-5 h-5 border border-gray-300 bg-white hover:bg-[#00CC99] hover:text-white text-[9px] flex items-center justify-center transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => onDelete(sub.id)}
                      title="删除"
                      className="w-5 h-5 border border-gray-300 bg-white hover:bg-[#E53E3E] hover:text-white text-[9px] flex items-center justify-center transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <span
                  className="text-[8px] font-bold px-1 border mt-0.5 inline-block"
                  style={{ color: PRIORITY_COLOR[sub.priority], borderColor: PRIORITY_COLOR[sub.priority] }}
                >
                  {PRIORITY_LABEL[sub.priority]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const FILTER_OPTIONS = [
  { value: "", label: "全部" },
  { value: "urgent_important", label: "紧急重要" },
  { value: "important", label: "重要" },
  { value: "urgent", label: "紧急" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState("");

  const [confirmations, setConfirmations] = useState<ConfirmationItem[]>([]);
  const [loadingConf, setLoadingConf] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const fetchTasks = useCallback(() => {
    setLoadingTasks(true);
    const params = new URLSearchParams();
    if (priorityFilter) params.set("priority", priorityFilter);
    Promise.all([
      apiFetch<TaskItem[]>(`/tasks?${params}`),
      apiFetch<TaskStats>("/tasks/stats"),
    ])
      .then(([t, s]) => {
        setTasks(t);
        setStats(s);
      })
      .catch(() => {
        setTasks([]);
        setStats(null);
      })
      .finally(() => setLoadingTasks(false));
  }, [priorityFilter]);

  const fetchConfirmations = useCallback(() => {
    setLoadingConf(true);
    apiFetch<ConfirmationItem[]>("/confirmations")
      .then(setConfirmations)
      .catch(() => setConfirmations([])
      )
      .finally(() => setLoadingConf(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { fetchConfirmations(); }, [fetchConfirmations]);

  async function markDone(id: number) {
    try {
      await apiFetch(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // ignore
    }
  }

  async function deleteTask(id: number) {
    try {
      await apiFetch(`/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // ignore
    }
  }

  async function confirmDraft(draftId: number, field: string) {
    setConfirmingId(draftId);
    const value = selectedOptions[`${draftId}-${field}`];
    try {
      await apiFetch(`/drafts/${draftId}/confirm`, {
        method: "PATCH",
        body: JSON.stringify({ field, value }),
      });
      setConfirmations((prev) =>
        prev.filter((c) => !(c.draft_id === draftId && c.field === field))
      );
    } catch {
      // ignore
    } finally {
      setConfirmingId(null);
    }
  }

  async function discardDraft(draftId: number) {
    setConfirmingId(draftId);
    try {
      await apiFetch(`/drafts/${draftId}/discard`, { method: "POST" });
      setConfirmations((prev) => prev.filter((c) => c.draft_id !== draftId));
    } catch {
      // ignore
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <PageShell title="待办中心" icon={ICONS.tasks}>
      <div className="grid grid-cols-3 gap-4 h-full">
        {/* Left: Tasks (2/3) */}
        <div className="col-span-2 flex flex-col gap-3">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-5 gap-2">
              {(["urgent_important", "important", "urgent", "neither"] as const).map((p) => (
                <div
                  key={p}
                  className="border-2 border-[#1A202C] bg-white p-2 flex flex-col items-center"
                >
                  <div
                    className="w-2 h-2 mb-1"
                    style={{ background: PRIORITY_COLOR[p] }}
                  />
                  <div className="text-[18px] font-bold leading-none">{stats[p]}</div>
                  <div className="text-[8px] font-bold uppercase text-gray-500 mt-0.5 text-center">
                    {PRIORITY_LABEL[p]}
                  </div>
                </div>
              ))}
              <div className="border-2 border-[#E53E3E] bg-red-50 p-2 flex flex-col items-center">
                <div className="w-2 h-2 mb-1 bg-[#E53E3E]" />
                <div className="text-[18px] font-bold leading-none text-[#E53E3E]">
                  {stats.overdue}
                </div>
                <div className="text-[8px] font-bold uppercase text-[#E53E3E] mt-0.5">
                  逾期
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPriorityFilter(opt.value)}
                className={`px-3 py-1 text-[10px] font-bold uppercase border-2 border-[#1A202C] transition-colors ${
                  priorityFilter === opt.value
                    ? "bg-[#1A202C] text-white"
                    : "bg-white text-[#1A202C] hover:bg-[#CCF2FF]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Task list */}
          <div className="flex flex-col gap-2 overflow-y-auto">
            {loadingTasks ? (
              <div className="text-[10px] text-gray-400 font-bold uppercase py-8 text-center">
                加载中...
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-[10px] text-gray-400 font-bold uppercase py-8 text-center">
                暂无待办
              </div>
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDone={markDone}
                  onDelete={deleteTask}
                />
              ))
            )}
          </div>
        </div>

        {/* Right: Confirmations (1/3) */}
        <div className="col-span-1 flex flex-col gap-3">
          <div className="border-b-2 border-[#1A202C] pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">
              — 待确认
            </span>
            {confirmations.length > 0 && (
              <span className="ml-2 text-[9px] font-bold bg-[#E53E3E] text-white px-1">
                {confirmations.length}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 overflow-y-auto">
            {loadingConf ? (
              <div className="text-[10px] text-gray-400 font-bold uppercase py-8 text-center">
                加载中...
              </div>
            ) : confirmations.length === 0 ? (
              <div className="text-[10px] text-gray-400 font-bold uppercase py-8 text-center">
                暂无待确认事项
              </div>
            ) : (
              confirmations.map((c) => {
                const key = `${c.draft_id}-${c.field}`;
                const selected = selectedOptions[key];
                return (
                  <div
                    key={key}
                    className="border-2 border-[#1A202C] bg-white p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[10px] font-bold text-[#1A202C] leading-tight">
                        {c.draft_title}
                      </span>
                      <span className="text-[8px] font-bold px-1 border border-[#00A3C4] text-[#00A3C4] flex-shrink-0">
                        {c.object_type}
                      </span>
                    </div>
                    <p className="text-[9px] text-gray-600 leading-tight">
                      {c.question}
                    </p>
                    {c.options && c.options.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {c.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() =>
                              setSelectedOptions((prev) => ({ ...prev, [key]: opt }))
                            }
                            className={`text-left px-2 py-1 text-[9px] font-bold border transition-colors ${
                              selected === opt
                                ? "bg-[#1A202C] text-white border-[#1A202C]"
                                : "bg-white text-[#1A202C] border-[#1A202C] hover:bg-[#CCF2FF]"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => confirmDraft(c.draft_id, c.field)}
                        disabled={confirmingId === c.draft_id}
                        className="flex-1 px-2 py-1 text-[9px] font-bold border-2 border-[#00CC99] bg-[#00CC99] text-white hover:bg-[#00A87A] disabled:opacity-50 transition-colors"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => discardDraft(c.draft_id)}
                        disabled={confirmingId === c.draft_id}
                        className="px-2 py-1 text-[9px] font-bold border-2 border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                      >
                        忽略
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
