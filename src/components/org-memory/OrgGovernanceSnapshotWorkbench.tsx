"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  SnapshotScopeOption,
  SnapshotTabKey,
  WorkspaceSnapshotDetail,
  WorkspaceSnapshotRunStatus,
  WorkspaceSnapshotSummary,
  WorkspaceSnapshotTabSyncResult,
} from "@/lib/types";
import {
  createWorkspaceSnapshotEvent,
  loadWorkspaceSnapshotDetail,
  loadWorkspaceSnapshotRun,
  loadWorkspaceSnapshots,
} from "@/lib/org-memory";
import SnapshotToolbar from "./SnapshotToolbar";
import SnapshotTabBar from "./SnapshotTabBar";
import SnapshotMarkdownEditor from "./SnapshotMarkdownEditor";
import SnapshotEventDrawer from "./SnapshotEventDrawer";
import SnapshotGovernancePanel from "./SnapshotGovernancePanel";
import SnapshotSyncStatus from "./SnapshotSyncStatus";

export default function OrgGovernanceSnapshotWorkbench({
  onGovernanceVersionUpdated,
  onSelectedSnapshotChange,
  onUnavailable,
}: {
  onGovernanceVersionUpdated?: () => void;
  onSelectedSnapshotChange?: (snapshotId: number | null) => void;
  onUnavailable?: (reason: string) => void;
}) {
  // 版本列表
  const [versions, setVersions] = useState<WorkspaceSnapshotSummary[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);

  // 快照详情
  const [detail, setDetail] = useState<WorkspaceSnapshotDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // 当前 Tab
  const [activeTab, setActiveTab] = useState<SnapshotTabKey>("organization");
  const [tabSyncStatus, setTabSyncStatus] = useState<Partial<Record<SnapshotTabKey, WorkspaceSnapshotTabSyncResult>>>({});

  // 运行状态
  const [runStatus, setRunStatus] = useState<WorkspaceSnapshotRunStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // 范围
  const [scope, setScope] = useState<SnapshotScopeOption>("full");

  // 抽屉
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"generate" | "append">("generate");

  // 消息
  const [message, setMessage] = useState("");
  const [apiUnavailable, setApiUnavailable] = useState(false);

  const markUnavailable = useCallback((reason: string) => {
    setApiUnavailable(true);
    setMessage("新版治理快照接口暂不可用，已回退到旧版结构化快照页面。");
    onUnavailable?.(reason);
  }, [onUnavailable]);

  // 加载版本列表
  const refreshVersions = useCallback(async () => {
    if (apiUnavailable) return;
    try {
      const list = await loadWorkspaceSnapshots({ app: "le-desk" });
      setVersions(list);
      if (list.length > 0 && !selectedVersionId) {
        setSelectedVersionId(list[0].id);
      }
    } catch (error) {
      markUnavailable(error instanceof Error ? error.message : "workspace snapshot API unavailable");
    }
  }, [apiUnavailable, markUnavailable, selectedVersionId]);

  // 加载详情
  const refreshDetail = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const data = await loadWorkspaceSnapshotDetail(id);
      setDetail(data);
      setTabSyncStatus({});
      setRunStatus(data.status);
      onSelectedSnapshotChange?.(data.id);
      setLoading(false);
      return data;
    } catch (error) {
      setDetail(null);
      markUnavailable(error instanceof Error ? error.message : "workspace snapshot detail unavailable");
    }
    setLoading(false);
    return null;
  }, [markUnavailable, onSelectedSnapshotChange]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void refreshVersions();
    });
    return () => {
      active = false;
    };
  }, [refreshVersions]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (selectedVersionId) {
        void refreshDetail(selectedVersionId);
      } else {
        onSelectedSnapshotChange?.(null);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedVersionId, refreshDetail, onSelectedSnapshotChange]);

  // 轮询运行状态
  useEffect(() => {
    if (!runId) return;
    const interval = setInterval(async () => {
      try {
        const run = await loadWorkspaceSnapshotRun(runId);
        setRunStatus(run.status);
        if (run.status === "ready_for_review" || run.status === "synced" || run.status === "partial_sync") {
          setRunId(null);
          setGenerating(false);
          if (run.snapshot_id) {
            setSelectedVersionId(run.snapshot_id);
            await refreshDetail(run.snapshot_id);
            void refreshVersions();
          }
          onGovernanceVersionUpdated?.();
        } else if (run.status === "failed") {
          setRunId(null);
          setGenerating(false);
          setMessage(run.error || "快照生成失败");
        } else if (run.status === "needs_input") {
          setRunId(null);
          setGenerating(false);
          if (run.snapshot_id) {
            setSelectedVersionId(run.snapshot_id);
            await refreshDetail(run.snapshot_id);
          }
        }
      } catch {
        // 忽略轮询错误
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [runId, refreshDetail, refreshVersions, onGovernanceVersionUpdated]);

  // 提交生成/更新事件
  async function handleSubmitEvent(
    eventType: "snapshot.generate" | "snapshot.update" | "snapshot.append_sources" | "snapshot.resolve_questions",
    sourceIds?: number[],
    missingAnswers?: Record<string, string | string[] | boolean>,
  ) {
    setGenerating(true);
    setMessage("");
    try {
      const result = await createWorkspaceSnapshotEvent({
        event_type: eventType,
        snapshot_id: detail?.id,
        source_snapshot_id: detail?.source_snapshot_id ?? undefined,
        base_snapshot_id: detail?.base_snapshot_id ?? undefined,
        scope,
        source_ids: sourceIds,
        tab_key: scope === "full" ? undefined : activeTab,
        missing_item_answers: missingAnswers,
      });
      setRunStatus(result.status);
      if (result.run_id && (result.status === "queued" || result.status === "running")) {
        setRunId(result.run_id);
      } else {
        setRunId(null);
      }
      if (result.status === "needs_input" && result.snapshot_id) {
        setSelectedVersionId(result.snapshot_id);
        await refreshDetail(result.snapshot_id);
        setGenerating(false);
        setDrawerOpen(true);
        setMessage("当前还缺少关键信息，请补齐后继续生成。");
      } else if (result.status === "ready_for_review" && result.snapshot_id) {
        setSelectedVersionId(result.snapshot_id);
        await refreshDetail(result.snapshot_id);
        void refreshVersions();
        setGenerating(false);
        onGovernanceVersionUpdated?.();
        setDrawerOpen(false);
      } else if (result.status === "partial_sync" && result.snapshot_id) {
        setSelectedVersionId(result.snapshot_id);
        await refreshDetail(result.snapshot_id);
        void refreshVersions();
        setGenerating(false);
        setDrawerOpen(false);
        onGovernanceVersionUpdated?.();
      } else if (result.status === "failed") {
        setGenerating(false);
        setMessage(result.error || "操作失败");
      } else {
        setGenerating(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
      setGenerating(false);
    }
  }

  function handleGenerate() {
    setDrawerMode("generate");
    setDrawerOpen(true);
  }

  function handleAppendSources() {
    setDrawerMode("append");
    setDrawerOpen(true);
  }

  // 当前 Tab 的 markdown
  const currentMarkdown = detail?.markdown_by_tab?.[activeTab] ?? "";

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="rounded-lg border border-border bg-card px-5 py-4">
        <SnapshotToolbar
          snapshot={versions.find((v) => v.id === selectedVersionId) ?? null}
          scope={scope}
          onScopeChange={setScope}
          versions={versions}
          selectedVersionId={selectedVersionId}
          onVersionChange={setSelectedVersionId}
          missingCount={detail?.missing_items.length ?? 0}
          conflictCount={detail?.conflicts.length ?? 0}
          runStatus={runStatus}
          onGenerate={handleGenerate}
          onAppendSources={handleAppendSources}
          generating={generating}
        />
        {message && (
          <div className="mt-3 text-sm text-muted-foreground">{message}</div>
        )}
      </div>

      {/* 主体 */}
      {loading ? (
        <div className="rounded-lg border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
          加载中...
        </div>
      ) : detail ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          {/* 左侧: Tab + 编辑区 */}
          <div className="min-w-0 rounded-lg border border-border bg-card">
            <div className="px-5 pt-4">
              <SnapshotTabBar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                syncStatus={tabSyncStatus}
              />
            </div>
            <div className="p-5">
              <SnapshotMarkdownEditor
                snapshotId={detail.id}
                tabKey={activeTab}
                initialMarkdown={currentMarkdown}
                onSaved={(result) => {
                  setTabSyncStatus((prev) => ({ ...prev, [result.tab_key]: result }));
                  if (result.detail) {
                    setDetail(result.detail);
                    setRunStatus(result.detail.status);
                  }
                }}
              />
            </div>
          </div>

          {/* 右侧面板 */}
          <div className="space-y-4">
            {/* 证据引用 */}
            {detail.low_confidence_items.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs font-medium text-foreground">低置信度</div>
                <div className="mt-2 space-y-2">
                  {detail.low_confidence_items.map((item, i) => (
                    <div key={i} className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
                      <div className="text-xs font-medium text-amber-800">{item.label}</div>
                      <div className="mt-1 text-[11px] text-amber-700">{item.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 缺失项 */}
            {detail.missing_items.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-card p-4">
                <div className="text-xs font-medium text-amber-800">
                  缺失项（{detail.missing_items.length}）
                </div>
                <div className="mt-2 space-y-2">
                  {detail.missing_items.map((item) => (
                    <div key={item.id} className="rounded border border-border px-3 py-2">
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{item.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 冲突项 */}
            {detail.conflicts.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-card p-4">
                <div className="text-xs font-medium text-red-800">
                  冲突项（{detail.conflicts.length}）
                </div>
                <div className="mt-2 space-y-2">
                  {detail.conflicts.map((item) => (
                    <div key={item.id} className="rounded border border-red-200 bg-red-50 px-3 py-2">
                      <div className="text-xs font-medium text-red-800">
                        {item.entity_name} · {item.field}
                      </div>
                      <div className="mt-1 text-[11px] text-red-700">
                        当前: {item.current_value} → 新值: {item.new_value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SoD 风险 */}
            {detail.separation_of_duty_risks.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs font-medium text-foreground">SoD 风险</div>
                <div className="mt-2 space-y-2">
                  {detail.separation_of_duty_risks.map((item, i) => (
                    <div key={i} className={`rounded border px-3 py-2 ${
                      item.severity === "high"
                        ? "border-red-200 bg-red-50"
                        : item.severity === "medium"
                          ? "border-amber-200 bg-amber-50"
                          : "border-border bg-background"
                    }`}>
                      <div className="text-xs text-foreground">{item.description}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        涉及: {item.entities.join("、")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 同步状态 */}
            <div className="rounded-lg border border-border bg-card p-4">
              <SnapshotSyncStatus syncStatus={detail.sync_status} tabSyncStatus={tabSyncStatus} />
            </div>

            {/* 治理中间产物 */}
            <SnapshotGovernancePanel outputs={detail.governance_outputs} />

            {/* 变更摘要 */}
            {detail.change_summary && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs font-medium text-foreground">变更摘要</div>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-background p-2 text-[11px] text-muted-foreground">
                  {JSON.stringify(detail.change_summary, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-5 py-12 text-center">
          <div className="text-sm text-muted-foreground">
            暂无快照数据。点击「生成快照」开始。
          </div>
        </div>
      )}

      {/* 事件抽屉 */}
      <SnapshotEventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        mode={drawerMode}
        missingItems={detail?.missing_items ?? []}
        generating={generating}
        onSubmitGenerate={(sourceIds, answers) => {
          const eventType = drawerMode === "append"
            ? "snapshot.append_sources"
            : answers && Object.keys(answers).length > 0
              ? "snapshot.resolve_questions"
              : detail
                ? "snapshot.update"
                : "snapshot.generate";
          void handleSubmitEvent(eventType, sourceIds, answers);
        }}
      />
    </div>
  );
}
