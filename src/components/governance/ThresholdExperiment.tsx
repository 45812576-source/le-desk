"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

import type {
  GovernanceExperiment,
  ThresholdSimulationResult,
} from "@/app/(app)/data/components/shared/types";

export default function ThresholdExperiment() {
  const [currentThreshold, setCurrentThreshold] = useState(85);
  const [candidateThreshold, setCandidateThreshold] = useState(70);
  const [simulation, setSimulation] = useState<ThresholdSimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [experiments, setExperiments] = useState<GovernanceExperiment[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDeptIds, setNewDeptIds] = useState("");
  const [newDuration, setNewDuration] = useState(7);

  async function loadExperiments() {
    setLoading(true);
    try {
      const data = await apiFetch<GovernanceExperiment[]>("/knowledge-governance/experiments");
      setExperiments(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExperiments();
  }, []);

  async function handleSimulate() {
    setSimulating(true);
    try {
      const result = await apiFetch<ThresholdSimulationResult>("/knowledge-governance/simulate-threshold", {
        method: "POST",
        body: JSON.stringify({
          current_threshold: currentThreshold,
          candidate_threshold: candidateThreshold,
        }),
      });
      setSimulation(result);
    } finally {
      setSimulating(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const deptIds = newDeptIds
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      await apiFetch("/knowledge-governance/experiments", {
        method: "POST",
        body: JSON.stringify({
          name: newName,
          department_ids: deptIds,
          threshold: candidateThreshold,
          duration_days: newDuration,
        }),
      });
      setNewName("");
      await loadExperiments();
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(expId: number, action: "apply" | "cancel") {
    await apiFetch(`/knowledge-governance/experiments/${expId}/${action}`, { method: "POST" });
    await loadExperiments();
  }

  return (
    <div className="space-y-4">
      {/* 阈值模拟 */}
      <section className="border border-border rounded bg-card px-4 py-3 space-y-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#0077B6]">阈值模拟</div>
        <div className="flex items-center gap-3 text-[10px]">
          <label className="text-gray-600">
            当前阈值
            <input
              type="number"
              min={1}
              max={99}
              value={currentThreshold}
              onChange={(e) => setCurrentThreshold(Number(e.target.value))}
              className="ml-1 w-14 border border-border px-1 py-0.5 text-center"
            />
          </label>
          <label className="text-gray-600">
            候选阈值
            <input
              type="number"
              min={1}
              max={99}
              value={candidateThreshold}
              onChange={(e) => setCandidateThreshold(Number(e.target.value))}
              className="ml-1 w-14 border border-border px-1 py-0.5 text-center"
            />
          </label>
          <button
            onClick={() => void handleSimulate()}
            disabled={simulating}
            className="px-3 py-1 text-[8px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-muted disabled:opacity-50"
          >
            {simulating ? "模拟中..." : "模拟对比"}
          </button>
        </div>

        {simulation && (
          <div className="grid grid-cols-2 gap-3 text-[9px]">
            <SimCard label={`当前 (阈值 ${currentThreshold})`} data={simulation.current} />
            <SimCard label={`候选 (阈值 ${candidateThreshold})`} data={simulation.candidate} highlight />
            <div className="col-span-2 text-[8px] text-gray-400">
              基于 {simulation.total_samples} 条历史数据模拟
            </div>
          </div>
        )}
      </section>

      {/* 创建灰度实验 */}
      <section className="border border-border rounded bg-card px-4 py-3 space-y-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-amber-700">新建灰度实验</div>
        <div className="flex items-center gap-2 text-[10px] flex-wrap">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="实验名称"
            className="border border-border px-2 py-1 text-[10px] w-40"
          />
          <input
            value={newDeptIds}
            onChange={(e) => setNewDeptIds(e.target.value)}
            placeholder="部门ID (逗号分隔)"
            className="border border-border px-2 py-1 text-[10px] w-40"
          />
          <label className="text-gray-600">
            天数
            <input
              type="number"
              min={1}
              max={90}
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value))}
              className="ml-1 w-12 border border-border px-1 py-0.5 text-center"
            />
          </label>
          <button
            onClick={() => void handleCreate()}
            disabled={creating || !newName.trim()}
            className="px-3 py-1 text-[8px] font-bold border border-amber-400 text-amber-700 hover:bg-muted disabled:opacity-50"
          >
            {creating ? "创建中..." : "创建实验"}
          </button>
        </div>
      </section>

      {/* 进行中实验 */}
      <section className="border border-border rounded bg-card px-4 py-3 space-y-2">
        <div className="text-[9px] font-bold uppercase tracking-widest text-violet-700">
          实验列表
          {loading && <span className="ml-2 text-gray-400 font-normal">加载中...</span>}
        </div>
        {experiments.length === 0 && !loading && (
          <div className="text-[9px] text-gray-400">暂无实验</div>
        )}
        {experiments.map((exp) => (
          <ExperimentCard key={exp.id} exp={exp} onAction={handleAction} />
        ))}
      </section>
    </div>
  );
}

function SimCard({
  label,
  data,
  highlight,
}: {
  label: string;
  data: { auto_pass_rate: number; human_review_volume: number; error_rate: number };
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded px-3 py-2 ${highlight ? "border-amber-300 bg-amber-50" : "border-border bg-card"}`}>
      <div className="text-[8px] font-bold text-gray-600 mb-1">{label}</div>
      <div className="space-y-0.5 text-[9px]">
        <div>自动通过率 <span className="font-bold text-emerald-600">{data.auto_pass_rate}%</span></div>
        <div>需人审 <span className="font-bold text-amber-600">{data.human_review_volume}</span> 条</div>
        <div>误判率 <span className="font-bold text-red-600">{data.error_rate}%</span></div>
      </div>
    </div>
  );
}

function ExperimentCard({
  exp,
  onAction,
}: {
  exp: GovernanceExperiment;
  onAction: (id: number, action: "apply" | "cancel") => Promise<void>;
}) {
  const statusColor: Record<string, string> = {
    running: "text-blue-600 border-blue-200 bg-blue-50",
    completed: "text-emerald-600 border-emerald-200 bg-emerald-50",
    applied: "text-violet-600 border-violet-200 bg-violet-50",
    cancelled: "text-gray-500 border-gray-200 bg-gray-50",
  };
  const statusLabel: Record<string, string> = {
    running: "进行中",
    completed: "已完成",
    applied: "已全量",
    cancelled: "已取消",
  };

  const metrics = exp.live_metrics;

  return (
    <div className="border border-border rounded px-3 py-2 text-[9px] space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-700">{exp.name}</span>
        <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded border ${statusColor[exp.status] || ""}`}>
          {statusLabel[exp.status] || exp.status}
        </span>
        <span className="text-gray-400">阈值 {exp.threshold} vs {exp.baseline_threshold}</span>
        <span className="text-gray-400">{exp.duration_days}天</span>
        {exp.status === "running" && (
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => void onAction(exp.id, "apply")}
              className="px-2 py-0.5 text-[8px] font-bold border border-emerald-300 text-emerald-600 hover:bg-muted"
            >
              全量应用
            </button>
            <button
              onClick={() => void onAction(exp.id, "cancel")}
              className="px-2 py-0.5 text-[8px] font-bold border border-gray-300 text-gray-600 hover:bg-muted"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-2 text-[8px]">
          <div className="border border-blue-100 rounded px-2 py-1">
            <div className="font-bold text-blue-600">实验组 (阈值 {exp.threshold})</div>
            <div>自动通过 {metrics.experiment_group.auto_pass_rate}% · 人审 {metrics.experiment_group.human_review} · 拒绝 {metrics.experiment_group.rejected}</div>
          </div>
          <div className="border border-gray-100 rounded px-2 py-1">
            <div className="font-bold text-gray-600">对照组 (阈值 {exp.baseline_threshold})</div>
            <div>自动通过 {metrics.control_group.auto_pass_rate}% · 人审 {metrics.control_group.human_review} · 拒绝 {metrics.control_group.rejected}</div>
          </div>
          <div className="col-span-2 text-gray-400">已运行 {metrics.days_elapsed} 天</div>
        </div>
      )}
    </div>
  );
}
