"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrgMemoryEvidenceRef, OrgMemorySnapshot, OrgMemorySnapshotDiff } from "@/lib/types";
import {
  loadOrgMemorySnapshots,
  loadOrgMemorySnapshotDiff,
  ORG_MEMORY_PARSE_STATUS_LABELS,
  ORG_MEMORY_PARSE_STATUS_STYLES,
  refreshOrgMemoryGovernanceVersion,
} from "@/lib/org-memory";

export default function OrgMemorySnapshotsTab({
  selectedSnapshotId,
  onSelectedSnapshotChange,
  refreshSeed = 0,
  onGovernanceVersionUpdated,
}: {
  selectedSnapshotId?: number | null;
  onSelectedSnapshotChange?: (snapshotId: number | null) => void;
  refreshSeed?: number;
  onGovernanceVersionUpdated?: (governanceVersionId: number) => void;
}) {
  const [snapshots, setSnapshots] = useState<OrgMemorySnapshot[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(selectedSnapshotId ?? null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [message, setMessage] = useState("快照会直接承接六类对象、证据引用、低置信度问题与上一版差异。");
  const [diff, setDiff] = useState<OrgMemorySnapshotDiff | null>(null);

  const refreshSnapshots = useCallback(async (preferredId?: number) => {
    return loadOrgMemorySnapshots().then((result) => {
      setSnapshots(result.data);
      setSelectedId((current) => {
        if (preferredId && result.data.some((item) => item.id === preferredId)) return preferredId;
        if (selectedSnapshotId && result.data.some((item) => item.id === selectedSnapshotId)) return selectedSnapshotId;
        if (current && result.data.some((item) => item.id === current)) return current;
        return result.data[0]?.id ?? null;
      });
      setFallbackMode(result.fallback);
      setLoadError("");
      return result;
    });
  }, [selectedSnapshotId]);

  useEffect(() => {
    void refreshSnapshots(selectedSnapshotId ?? undefined);
  }, [refreshSnapshots, refreshSeed, selectedSnapshotId]);

  const selected = useMemo(
    () => snapshots.find((item) => item.id === (selectedSnapshotId ?? selectedId)) || snapshots[0] || null,
    [selectedId, selectedSnapshotId, snapshots],
  );

  useEffect(() => {
    onSelectedSnapshotChange?.(selected?.id ?? null);
  }, [onSelectedSnapshotChange, selected]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    loadOrgMemorySnapshotDiff(selected.id)
      .then((result) => {
        if (!active) return;
        setDiff(result);
      })
      .catch(() => {
        if (!active) return;
        setDiff(null);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  const selectedCounts = useMemo(() => {
    if (!selected) {
      return {
        orgs: 0,
        departments: 0,
      };
    }
    return {
      orgs: selected.units.filter((item) => item.unit_type === "org").length,
      departments: selected.units.filter((item) => item.unit_type === "department").length,
    };
  }, [selected]);

  const evidenceRefs = useMemo<OrgMemoryEvidenceRef[]>(() => {
    if (!selected) return [];
    return [
      ...selected.units.flatMap((item) => item.evidence_refs),
      ...selected.roles.flatMap((item) => item.evidence_refs),
      ...selected.people.flatMap((item) => item.evidence_refs),
      ...selected.okrs.flatMap((item) => item.evidence_refs),
      ...selected.processes.flatMap((item) => item.evidence_refs),
    ].slice(0, 8);
  }, [selected]);

  async function handleRefreshGovernanceVersion(snapshotId: number) {
    setRefreshingId(snapshotId);
    setMessage("正在刷新治理版本...");
    try {
      const result = await refreshOrgMemoryGovernanceVersion(snapshotId);
      setMessage(`治理版本 #${result.governance_version_id} 已刷新，步骤 3 / 4 已同步更新。`);
      onGovernanceVersionUpdated?.(result.governance_version_id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刷新治理版本失败");
    }
    setRefreshingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">快照结果</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              快照是主产物，页面需要让业务用户一眼看懂组织、部门、岗位、人员、OKR 与流程六类对象，以及证据和差异。
            </p>
          </div>
          {fallbackMode && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              演示数据
            </span>
          )}
        </div>
        {loadError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </div>
        )}
        <div className="mt-3 text-sm text-muted-foreground">{message}</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="px-2 pb-3 pt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            快照版本
          </div>
          <div className="space-y-2">
            {snapshots.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                  selected?.id === item.id
                    ? "border-[#00A3C4] bg-[#00D1FF]/5"
                    : "border-border bg-background hover:bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">{item.snapshot_version}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.source_title}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ORG_MEMORY_PARSE_STATUS_STYLES[item.parse_status]}`}>
                    {ORG_MEMORY_PARSE_STATUS_LABELS[item.parse_status] || item.parse_status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  置信度 {(item.confidence_score * 100).toFixed(0)}% · {new Date(item.created_at).toLocaleString("zh-CN")}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">{selected.snapshot_version}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{selected.summary}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${ORG_MEMORY_PARSE_STATUS_STYLES[selected.parse_status]}`}>
                  {ORG_MEMORY_PARSE_STATUS_LABELS[selected.parse_status] || selected.parse_status}
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <CountCard label="组织" value={selectedCounts.orgs} />
                <CountCard label="部门" value={selectedCounts.departments} />
                <CountCard label="岗位" value={selected.entity_counts.roles} />
                <CountCard label="人员" value={selected.entity_counts.people} />
                <CountCard label="OKR" value={selected.entity_counts.okrs} />
                <CountCard label="流程" value={selected.entity_counts.processes} />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <EntitySection
                  title="组织"
                  items={selected.units
                    .filter((item) => item.unit_type === "org")
                    .map((item) => ({
                      title: item.name,
                      subtitle: item.leader_name || "未指定负责人",
                      bullets: item.responsibilities,
                    }))}
                />
                <EntitySection
                  title="部门"
                  items={selected.units
                    .filter((item) => item.unit_type === "department")
                    .map((item) => ({
                      title: item.name,
                      subtitle: `${item.parent_name || "根节点"} · ${item.leader_name || "未指定负责人"}`,
                      bullets: item.responsibilities,
                    }))}
                />
                <EntitySection
                  title="岗位"
                  items={selected.roles.map((item) => ({
                    title: item.name,
                    subtitle: item.department_name,
                    bullets: item.responsibilities,
                  }))}
                />
                <EntitySection
                  title="人员"
                  items={selected.people.map((item) => ({
                    title: item.name,
                    subtitle: `${item.department_name} · ${item.role_name}`,
                    bullets: [item.manager_name ? `汇报：${item.manager_name}` : "汇报关系待补充", `状态：${item.employment_status}`],
                  }))}
                />
                <EntitySection
                  title="OKR"
                  items={selected.okrs.map((item) => ({
                    title: item.objective,
                    subtitle: `${item.owner_name} · ${item.period}`,
                    bullets: item.key_results,
                  }))}
                />
                <EntitySection
                  title="流程"
                  items={selected.processes.map((item) => ({
                    title: item.name,
                    subtitle: item.owner_name,
                    bullets: item.risk_points.length > 0 ? item.risk_points : item.outputs,
                  }))}
                />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-sm font-medium text-foreground">证据引用</div>
                  <div className="mt-3 space-y-3">
                    {evidenceRefs.length === 0 && (
                      <div className="text-sm text-muted-foreground">暂无证据引用。</div>
                    )}
                    {evidenceRefs.map((item, index) => (
                      <div key={`${item.label}-${item.section}-${index}`} className="rounded-lg border border-border/70 px-3 py-3">
                        <div className="text-xs font-medium text-foreground">{item.label} · {item.section}</div>
                        <div className="mt-2 text-sm leading-6 text-muted-foreground">{item.excerpt}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="text-sm font-medium text-foreground">低置信度问题</div>
                  <div className="mt-3 space-y-3">
                    {selected.low_confidence_items.length === 0 && (
                      <div className="text-sm text-muted-foreground">当前快照未识别到低置信度问题。</div>
                    )}
                    {selected.low_confidence_items.map((item) => (
                      <div key={item.label} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                        <div className="text-sm font-medium text-amber-800">{item.label}</div>
                        <div className="mt-2 text-sm leading-6 text-amber-700">{item.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-border bg-background p-4">
                <div className="text-sm font-medium text-foreground">与上一版差异</div>
                {diff ? (
                  <div className="mt-3 space-y-4">
                    <div className="text-sm text-muted-foreground">{diff.summary}</div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <DiffBucketCard title="组织 / 部门" added={[...diff.units.added]} removed={[...diff.units.removed]} />
                      <DiffBucketCard title="岗位" added={diff.roles.added} removed={diff.roles.removed} />
                      <DiffBucketCard title="人员" added={diff.people.added} removed={diff.people.removed} />
                      <DiffBucketCard title="OKR" added={diff.okrs.added} removed={diff.okrs.removed} />
                      <DiffBucketCard title="流程" added={diff.processes.added} removed={diff.processes.removed} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground">暂无差异数据。</div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleRefreshGovernanceVersion(selected.id)}
                  disabled={refreshingId !== null}
                  className="rounded bg-[#00A3C4] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshingId === selected.id ? "刷新中..." : "刷新治理版本"}
                </button>
                <span className="text-sm text-muted-foreground">
                  如果当前快照仍在主链路内，则治理版本会按最新快照重新派生。
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">暂无快照。</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-4 py-4">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function EntitySection({
  title,
  items,
}: {
  title: string;
  items: Array<{
    title: string;
    subtitle: string;
    bullets: string[];
  }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-3 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">暂无对象</div>}
        {items.map((item) => (
          <div key={`${title}-${item.title}`} className="rounded-lg border border-border/70 px-3 py-3">
            <div className="text-sm font-medium text-foreground">{item.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.subtitle}</div>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-foreground">
              {item.bullets.length === 0 && <li>暂无补充说明</li>}
              {item.bullets.map((bullet, index) => (
                <li key={`${item.title}-${index}`}>• {bullet}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffBucketCard({
  title,
  added,
  removed,
}: {
  title: string;
  added: string[];
  removed: string[];
}) {
  return (
    <div className="rounded-lg border border-border/70 px-4 py-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <DiffList title="新增" tone="green" items={added} />
        <DiffList title="移除" tone="red" items={removed} />
      </div>
    </div>
  );
}

function DiffList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "green" | "red";
  items: string[];
}) {
  const titleClass = tone === "green" ? "text-green-700" : "text-red-700";
  const bgClass = tone === "green" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200";
  return (
    <div className={`rounded-lg border px-3 py-3 ${bgClass}`}>
      <div className={`text-xs font-medium uppercase tracking-[0.16em] ${titleClass}`}>{title}</div>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.length === 0 && <div>暂无</div>}
        {items.map((item) => (
          <div key={`${title}-${item}`}>{item}</div>
        ))}
      </div>
    </div>
  );
}
