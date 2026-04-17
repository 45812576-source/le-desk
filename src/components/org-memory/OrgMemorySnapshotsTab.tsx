"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { OrgMemorySnapshot, OrgMemorySnapshotDiff } from "@/lib/types";
import {
  createOrgMemoryProposal,
  loadOrgMemorySnapshots,
  loadOrgMemorySnapshotDiff,
  ORG_MEMORY_PARSE_STATUS_LABELS,
  ORG_MEMORY_PARSE_STATUS_STYLES,
} from "@/lib/org-memory";

export default function OrgMemorySnapshotsTab() {
  const router = useRouter();
  const [snapshots, setSnapshots] = useState<OrgMemorySnapshot[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [message, setMessage] = useState("可直接基于任一快照生成统一草案。");
  const [diff, setDiff] = useState<OrgMemorySnapshotDiff | null>(null);

  const refreshSnapshots = useCallback(async (preferredId?: number) => {
    return loadOrgMemorySnapshots().then((result) => {
      setSnapshots(result.data);
      setSelectedId((current) => {
        if (preferredId && result.data.some((item) => item.id === preferredId)) return preferredId;
        if (current && result.data.some((item) => item.id === current)) return current;
        return result.data[0]?.id ?? null;
      });
      setFallbackMode(result.fallback);
      setLoadError("");
      return result;
    });
  }, []);

  useEffect(() => {
    let active = true;
    loadOrgMemorySnapshots()
      .then((result) => {
        if (!active) return;
        setSnapshots(result.data);
        setSelectedId(result.data[0]?.id ?? null);
        setFallbackMode(result.fallback);
        setLoadError("");
      })
      .catch((error) => {
        if (!active) return;
        setSnapshots([]);
        setSelectedId(null);
        setFallbackMode(false);
        setLoadError(error instanceof Error ? error.message : "结构化快照加载失败");
      });
    return () => {
      active = false;
    };
  }, [refreshSnapshots]);

  const selected = useMemo(
    () => snapshots.find((item) => item.id === selectedId) || snapshots[0] || null,
    [selectedId, snapshots],
  );

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

  async function handleGenerateProposal(snapshotId: number) {
    setGeneratingId(snapshotId);
    setMessage("正在生成统一草案...");
    try {
      const result = await createOrgMemoryProposal(snapshotId);
      await refreshSnapshots(snapshotId);
      setMessage(`已生成草案 #${result.proposal_id}，正在切换到统一草案页。`);
      router.push(`/admin/org-management?tab=proposals&proposal_id=${result.proposal_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成统一草案失败");
    }
    setGeneratingId(null);
  }

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">结构化快照</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              快照承接组织、部门、岗位、人员、OKR 与流程六类对象，并保存证据引用与低置信度提示。
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

              <div className="mt-5 grid gap-4 md:grid-cols-5">
                <CountCard label="组织/部门" value={selected.entity_counts.units} />
                <CountCard label="岗位" value={selected.entity_counts.roles} />
                <CountCard label="人员" value={selected.entity_counts.people} />
                <CountCard label="OKR" value={selected.entity_counts.okrs} />
                <CountCard label="流程" value={selected.entity_counts.processes} />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <EntitySection
                  title="组织与部门"
                  items={selected.units.map((item) => ({
                    title: item.name,
                    subtitle: `${item.unit_type === "org" ? "组织" : "部门"} · ${item.parent_name || "根节点"}`,
                    bullets: item.responsibilities,
                    evidence: item.evidence_refs[0]?.excerpt || "暂无证据",
                  }))}
                />
                <EntitySection
                  title="岗位"
                  items={selected.roles.map((item) => ({
                    title: item.name,
                    subtitle: item.department_name,
                    bullets: item.responsibilities,
                    evidence: item.evidence_refs[0]?.excerpt || "暂无证据",
                  }))}
                />
                <EntitySection
                  title="OKR"
                  items={selected.okrs.map((item) => ({
                    title: item.objective,
                    subtitle: `${item.owner_name} · ${item.period}`,
                    bullets: item.key_results,
                    evidence: item.evidence_refs[0]?.excerpt || "暂无证据",
                  }))}
                />
                <EntitySection
                  title="业务流程"
                  items={selected.processes.map((item) => ({
                    title: item.name,
                    subtitle: item.owner_name,
                    bullets: item.risk_points.length > 0 ? item.risk_points : item.outputs,
                    evidence: item.evidence_refs[0]?.excerpt || "暂无证据",
                  }))}
                />
              </div>

              <div className="mt-5 rounded-lg border border-border bg-background p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">与上一版差异</div>
                </div>
                {diff ? (
                  <div className="mt-3 space-y-4">
                    <div className="text-sm text-muted-foreground">
                      {diff.summary}
                    </div>
                    <div className="grid gap-3 xl:grid-cols-2">
                      <DiffBucketCard title="组织/部门" bucket={diff.units} />
                      <DiffBucketCard title="岗位" bucket={diff.roles} />
                      <DiffBucketCard title="人员" bucket={diff.people} />
                      <DiffBucketCard title="OKR" bucket={diff.okrs} />
                      <DiffBucketCard title="流程" bucket={diff.processes} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground">暂无差异数据。</div>
                )}
              </div>

              {selected.low_confidence_items.length > 0 && (
                <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
                  <div className="text-sm font-medium text-amber-800">低置信度项</div>
                  <div className="mt-3 space-y-2">
                    {selected.low_confidence_items.map((item) => (
                      <div key={item.label} className="text-sm text-amber-700">
                        <span className="font-medium">{item.label}：</span>
                        {item.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleGenerateProposal(selected.id)}
                  disabled={generatingId !== null}
                  className="rounded bg-[#00A3C4] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generatingId === selected.id ? "生成中..." : "基于当前快照生成草案"}
                </button>
                <span className="text-sm text-muted-foreground">
                  生成后会自动切到“统一草案”，方便继续提交审批。
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

function DiffBucketCard({
  title,
  bucket,
}: {
  title: string;
  bucket: OrgMemorySnapshotDiff["units"];
}) {
  return (
    <div className="rounded-lg border border-border/70 px-3 py-3">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700">
          新增 {bucket.added.length}
        </span>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">
          移除 {bucket.removed.length}
        </span>
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">新增：</span>
          {bucket.added.length > 0 ? bucket.added.join("、") : "无"}
        </div>
        <div>
          <span className="font-medium text-foreground">移除：</span>
          {bucket.removed.length > 0 ? bucket.removed.join("、") : "无"}
        </div>
      </div>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background px-4 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
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
    evidence: string;
  }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-3 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">暂无数据</div>}
        {items.map((item) => (
          <div key={`${title}-${item.title}`} className="rounded-lg border border-border/70 px-3 py-3">
            <div className="text-sm font-medium text-foreground">{item.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.subtitle}</div>
            {item.bullets.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {item.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 rounded border border-dashed border-border px-3 py-2 text-xs leading-5 text-muted-foreground">
              {item.evidence}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
