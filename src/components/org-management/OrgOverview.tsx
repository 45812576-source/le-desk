"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { GovernanceSyncStatus } from "@/lib/types";

export default function OrgOverview() {
  const [data, setData] = useState<GovernanceSyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [creatingCandidate, setCreatingCandidate] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showGaps, setShowGaps] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<GovernanceSyncStatus>("/org-management/baseline-status")
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message ?? "加载失败");
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleActivate = async (candidateVersion: string) => {
    if (!confirm(`确认激活候选基线 ${candidateVersion}？`)) return;
    setActivating(true);
    try {
      await apiFetch(`/org-management/baselines/${candidateVersion}/activate`, {
        method: "POST",
      });
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "激活失败";
      alert(msg);
    } finally {
      setActivating(false);
    }
  };

  const handleCreateCandidate = async () => {
    setCreatingCandidate(true);
    try {
      await apiFetch("/org-management/baselines/create-candidate", {
        method: "POST",
      });
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "创建候选版本失败";
      alert(msg);
    } finally {
      setCreatingCandidate(false);
    }
  };

  // ---------- loading ----------
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-16 rounded-lg bg-muted/10" />
        <div className="h-28 rounded-lg bg-muted/10" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted/10" />
          ))}
        </div>
        <div className="h-48 rounded-lg bg-muted/10" />
      </div>
    );
  }

  // ---------- error ----------
  if (error) {
    return (
      <div className="rounded-lg border-2 border-red-300 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-950">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 rounded border border-red-400 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900"
        >
          重试
        </button>
      </div>
    );
  }

  if (!data) return null;

  const {
    active_baseline,
    candidate_baseline,
    baseline_consistent,
    mission_sync,
    resource_library_gaps,
    access_rule_sync,
    governance_tasks,
    unresolved_impacts,
  } = data;

  const resourceGapCount =
    resource_library_gaps.missing_fields.length +
    resource_library_gaps.missing_cycle.length +
    resource_library_gaps.missing_consumer.length;

  // ---------- render ----------
  return (
    <div className="space-y-6">
      {/* -------- 1. Active Baseline Banner -------- */}
      {active_baseline.version ? (
        <div className="flex items-center gap-4 rounded-lg border-2 border-green-300 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-800 dark:bg-green-800 dark:text-green-200">
            ● 活跃
          </span>
          <div className="flex-1">
            <span className="text-lg font-bold">{active_baseline.version}</span>
            {active_baseline.activated_at && (
              <span className="ml-3 text-sm text-muted-foreground">
                激活于 {new Date(active_baseline.activated_at).toLocaleString("zh-CN")}
              </span>
            )}
          </div>
          {active_baseline.snapshot_summary && (
            <div className="flex gap-3 text-sm text-muted-foreground">
              {Object.entries(active_baseline.snapshot_summary).map(([k, v]) => (
                <span key={k}>
                  {k}: <strong>{v}</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border-2 border-yellow-300 bg-yellow-50 px-5 py-4 text-center dark:border-yellow-700 dark:bg-yellow-950">
          <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300">
            ⚠ 暂无基线
          </span>
          <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
            当前系统没有活跃基线，请先创建并激活候选版本
          </p>
        </div>
      )}

      {/* -------- 2. Candidate Baseline Card -------- */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">候选基线</h3>
        {candidate_baseline ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-lg font-bold">{candidate_baseline.version}</span>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {candidate_baseline.diff_count} 项变更
              </span>
            </div>

            {/* Impact analysis summary */}
            {candidate_baseline.impact_analysis &&
              Object.keys(candidate_baseline.impact_analysis).length > 0 && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {Object.entries(candidate_baseline.impact_analysis).map(([k, v]) => (
                    <span
                      key={k}
                      className="rounded border border-border bg-muted/20 px-2 py-0.5 text-xs"
                    >
                      {k}: {v}
                    </span>
                  ))}
                </div>
              )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowDiff((p) => !p)}
                className="rounded border border-border px-4 py-1.5 text-sm font-medium hover:bg-muted/20"
              >
                {showDiff ? "收起差异" : "查看差异"}
              </button>
              <button
                onClick={() => handleActivate(candidate_baseline.version!)}
                disabled={activating || !candidate_baseline.version}
                className="rounded bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {activating ? "激活中…" : "激活"}
              </button>
            </div>

            {/* Inline diff (expanded) */}
            {showDiff && (
              <div className="mt-2 rounded border border-dashed border-border bg-muted/10 p-4 text-sm">
                <p className="font-medium">差异摘要</p>
                <p className="mt-1 text-muted-foreground">
                  共 {candidate_baseline.diff_count} 项变更
                </p>
                {candidate_baseline.impact_analysis &&
                  Object.entries(candidate_baseline.impact_analysis).map(([k, v]) => (
                    <p key={k} className="text-muted-foreground">
                      {k}: {v}
                    </p>
                  ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">暂无候选版本</p>
            <button
              onClick={handleCreateCandidate}
              disabled={creatingCandidate}
              className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingCandidate ? "创建中…" : "创建候选版本"}
            </button>
          </div>
        )}
      </div>

      {/* -------- 3. Baseline Consistency Check -------- */}
      <div
        className={`flex items-center gap-3 rounded-lg border-2 px-5 py-3 ${
          baseline_consistent
            ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950"
            : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950"
        }`}
      >
        <span className="text-lg">{baseline_consistent ? "✓" : "✗"}</span>
        <span
          className={`text-sm font-medium ${
            baseline_consistent
              ? "text-green-700 dark:text-green-300"
              : "text-red-700 dark:text-red-300"
          }`}
        >
          {baseline_consistent ? "基线一致性检查通过" : "基线一致性异常，请检查同步状态"}
        </span>
      </div>

      {/* -------- 4. Stat Cards Row -------- */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Mission 同步"
          value={`${mission_sync.synced} / ${mission_sync.total_depts}`}
          status={mission_sync.synced === mission_sync.total_depts ? "ok" : "warn"}
        />
        <StatCard
          label="资源库缺口"
          value={resourceGapCount}
          status={resourceGapCount === 0 ? "ok" : "warn"}
        />
        <StatCard
          label="访问规则同步"
          value={`${access_rule_sync.synced_to_policy} / ${access_rule_sync.total_rules}`}
          status={
            access_rule_sync.synced_to_policy === access_rule_sync.total_rules
              ? "ok"
              : "warn"
          }
        />
        <StatCard
          label="未解决影响项"
          value={unresolved_impacts}
          status={unresolved_impacts === 0 ? "ok" : "warn"}
        />
      </div>

      {/* -------- 5. Detailed Gaps Section (expandable) -------- */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <button
          onClick={() => setShowGaps((p) => !p)}
          className="flex w-full items-center justify-between px-5 py-3 text-left text-sm font-semibold hover:bg-muted/10"
        >
          <span>详细缺口列表</span>
          <span className="text-muted-foreground">{showGaps ? "▲ 收起" : "▼ 展开"}</span>
        </button>

        {showGaps && (
          <div className="space-y-4 border-t border-border px-5 py-4 text-sm">
            {/* Mission sync detail */}
            <div>
              <h4 className="mb-2 font-semibold">Mission 同步详情</h4>
              <p className="text-muted-foreground">
                总部门: {mission_sync.total_depts} · 已同步: {mission_sync.synced} · 待同步:{" "}
                {mission_sync.pending_sync} · 缺失明细: {mission_sync.missing_detail}
              </p>
            </div>

            {/* Resource library gaps */}
            <div>
              <h4 className="mb-2 font-semibold">资源库缺口明细</h4>
              {resourceGapCount === 0 ? (
                <p className="text-muted-foreground">无缺口</p>
              ) : (
                <ul className="space-y-1">
                  {resource_library_gaps.missing_fields.map((item) => (
                    <li key={`field-${item.id}`} className="text-muted-foreground">
                      <span className="font-mono text-xs">[{item.code}]</span> {item.name} —{" "}
                      {item.issue}
                    </li>
                  ))}
                  {resource_library_gaps.missing_cycle.map((item, i) => (
                    <li key={`cycle-${i}`} className="text-muted-foreground">
                      缺少更新周期: {JSON.stringify(item)}
                    </li>
                  ))}
                  {resource_library_gaps.missing_consumer.map((item, i) => (
                    <li key={`consumer-${i}`} className="text-muted-foreground">
                      缺少消费方: {JSON.stringify(item)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Access rule pending */}
            <div>
              <h4 className="mb-2 font-semibold">访问规则待同步</h4>
              <p className="text-muted-foreground">
                总规则: {access_rule_sync.total_rules} · 已同步至策略:{" "}
                {access_rule_sync.synced_to_policy} · 待同步: {access_rule_sync.pending_sync}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* -------- 6. Pending governance suggestions -------- */}
      <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">待处理治理建议</span>
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              governance_tasks.pending_suggestions > 0
                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            }`}
          >
            {governance_tasks.pending_suggestions}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- StatCard sub-component ----------
function StatCard({
  label,
  value,
  status,
}: {
  label: string;
  value: string | number;
  status: "ok" | "warn";
}) {
  return (
    <div
      className={`rounded-lg border-2 px-4 py-4 shadow-sm ${
        status === "ok"
          ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30"
          : "border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/30"
      }`}
    >
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
