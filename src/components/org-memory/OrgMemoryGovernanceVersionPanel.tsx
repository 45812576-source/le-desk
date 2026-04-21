"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrgMemoryGovernanceVersion } from "@/lib/types";
import {
  activateOrgMemoryGovernanceVersion,
  loadCurrentOrgMemoryGovernanceVersion,
  loadOrgMemoryGovernanceVersions,
  loadOrgMemorySnapshotGovernanceVersion,
  ORG_MEMORY_ACCESS_DECISION_LABELS,
  ORG_MEMORY_GOVERNANCE_STATUS_LABELS,
  ORG_MEMORY_GOVERNANCE_STATUS_STYLES,
  ORG_MEMORY_REDACTION_MODE_LABELS,
  ORG_MEMORY_SCOPE_LABELS,
  rollbackOrgMemoryGovernanceVersion,
} from "@/lib/org-memory";

export default function OrgMemoryGovernanceVersionPanel({
  snapshotId,
  refreshSeed = 0,
  section,
}: {
  snapshotId: number | null;
  refreshSeed?: number;
  section: "version" | "activation";
}) {
  const [version, setVersion] = useState<OrgMemoryGovernanceVersion | null>(null);
  const [currentEffectiveVersion, setCurrentEffectiveVersion] = useState<OrgMemoryGovernanceVersion | null>(null);
  const [allVersions, setAllVersions] = useState<OrgMemoryGovernanceVersion[]>([]);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionPending, setActionPending] = useState<"activate" | "rollback" | "">("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!snapshotId) {
        if (!active) return;
        setVersion(null);
        setCurrentEffectiveVersion(null);
        setAllVersions([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const linkedResult = await loadOrgMemorySnapshotGovernanceVersion(snapshotId);
        const [currentResult, versionsResult] = await Promise.allSettled([
          loadCurrentOrgMemoryGovernanceVersion(),
          loadOrgMemoryGovernanceVersions(),
        ]);
        if (!active) return;
        setVersion(linkedResult.data);
        setFallbackMode(
          linkedResult.fallback
          || (currentResult.status === "fulfilled" ? currentResult.value.fallback : false)
          || (versionsResult.status === "fulfilled" ? versionsResult.value.fallback : false),
        );
        setCurrentEffectiveVersion(currentResult.status === "fulfilled" ? currentResult.value.data : null);
        setAllVersions(versionsResult.status === "fulfilled" ? versionsResult.value.data : []);
        setLoadError("");
      } catch (error) {
        if (!active) return;
        setVersion(null);
        setCurrentEffectiveVersion(null);
        setAllVersions([]);
        setFallbackMode(false);
        setLoadError(error instanceof Error ? error.message : "治理版本加载失败");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [refreshSeed, snapshotId]);

  const relatedVersions = useMemo(() => {
    if (!version) return [];
    return allVersions
      .filter((item) => item.derived_from_snapshot_id === version.derived_from_snapshot_id || item.id === version.id)
      .sort((left, right) => right.version - left.version);
  }, [allVersions, version]);

  async function handleActivate() {
    if (!version) return;
    setActionPending("activate");
    setMessage("正在确认治理版本生效...");
    try {
      const result = await activateOrgMemoryGovernanceVersion(version.id);
      setMessage(result.message);
      setVersion((current) => (current ? { ...current, status: "effective", activated_at: new Date().toISOString() } : current));
      const currentResult = await loadCurrentOrgMemoryGovernanceVersion();
      setCurrentEffectiveVersion(currentResult.data);
      const versionsResult = await loadOrgMemoryGovernanceVersions();
      setAllVersions(versionsResult.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "治理版本生效失败");
    }
    setActionPending("");
  }

  async function handleRollback() {
    const targetId = currentEffectiveVersion?.id ?? version?.id;
    if (!targetId) return;
    setActionPending("rollback");
    setMessage("正在回滚到上一治理版本...");
    try {
      const result = await rollbackOrgMemoryGovernanceVersion(targetId);
      setMessage(result.message);
      const [linkedResult, currentResult, versionsResult] = await Promise.all([
        snapshotId ? loadOrgMemorySnapshotGovernanceVersion(snapshotId) : Promise.resolve({ data: null, fallback: false }),
        loadCurrentOrgMemoryGovernanceVersion().catch(() => ({ data: null, fallback: false })),
        loadOrgMemoryGovernanceVersions(),
      ]);
      setVersion(linkedResult.data);
      setCurrentEffectiveVersion(currentResult.data);
      setAllVersions(versionsResult.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "治理版本回滚失败");
    }
    setActionPending("");
  }

  if (loading) {
    return <div className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">治理版本加载中…</div>;
  }

  if (!snapshotId) {
    return <div className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">如果已选中快照，则这里会展示对应治理版本。</div>;
  }

  if (!version) {
    return <div className="rounded-lg border border-dashed border-border bg-card p-5 text-sm text-muted-foreground">当前快照尚未生成治理版本。</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">
              {section === "version" ? "治理版本" : "生效与影响"}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {section === "version"
                ? "治理版本直接描述当前快照会影响哪些 Skill、知识库和数据表，以及访问范围和脱敏要求。"
                : "运行时只消费当前 effective 的治理版本，页面需要明确当前版本、回滚目标和影响范围。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {fallbackMode && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                演示数据
              </span>
            )}
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${ORG_MEMORY_GOVERNANCE_STATUS_STYLES[version.status]}`}>
              {ORG_MEMORY_GOVERNANCE_STATUS_LABELS[version.status]}
            </span>
          </div>
        </div>
        {loadError && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {loadError}
          </div>
        )}
        {message && <div className="mt-3 text-sm text-muted-foreground">{message}</div>}
      </div>

      {section === "version" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="治理版本" value={`v${version.version}`} note={`派生自 ${version.derived_from_snapshot_version}`} />
            <MetricCard label="影响 Skill" value={String(version.affected_skills.length)} note="运行时按此版本判断访问边界" />
            <MetricCard label="可访问知识库" value={String(version.knowledge_bases.length)} note="仅展示治理版本允许的知识库" />
            <MetricCard label="可访问数据表" value={String(version.data_tables.length)} note="仅展示治理版本允许的表视图" />
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-sm font-medium text-foreground">{version.summary}</div>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">{version.impact_summary}</div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ListCard title="知识库范围" items={version.knowledge_bases} emptyText="暂无知识库范围" />
            <ListCard title="数据表范围" items={version.data_tables} emptyText="暂无数据表范围" />
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="text-sm font-medium text-foreground">Skill 访问规则</div>
            <div className="mt-4 space-y-3">
              {version.skill_access_rules.map((rule) => (
                <div key={rule.id} className="rounded-lg border border-border/70 bg-background px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{rule.skill_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Skill #{rule.skill_id}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge label={ORG_MEMORY_ACCESS_DECISION_LABELS[rule.decision] || rule.decision} tone={rule.decision === "allow" ? "green" : rule.decision === "deny" ? "red" : "amber"} />
                      <Badge label={ORG_MEMORY_SCOPE_LABELS[rule.access_scope] || rule.access_scope} tone="slate" />
                      <Badge label={ORG_MEMORY_REDACTION_MODE_LABELS[rule.redaction_mode] || rule.redaction_mode} tone="blue" />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    <CompactList title="可访问知识库" items={rule.knowledge_bases} />
                    <CompactList title="可访问数据表" items={rule.data_tables} />
                  </div>

                  <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">访问前提</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {rule.required_domains.map((domain) => (
                        <span key={`${rule.id}-${domain}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                          {domain}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 text-sm leading-6 text-muted-foreground">{rule.rationale}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="当前查看版本"
              value={`v${version.version}`}
              note={version.status === "effective" ? "当前版本已生效" : "当前版本尚未生效"}
            />
            <MetricCard
              label="当前生效版本"
              value={currentEffectiveVersion ? `v${currentEffectiveVersion.version}` : "—"}
              note={currentEffectiveVersion ? `版本号可追溯到 ${currentEffectiveVersion.derived_from_snapshot_version}` : "当前没有 effective 版本"}
            />
            <MetricCard
              label="影响知识库"
              value={String(version.knowledge_bases.length)}
              note="运行时仅在这些知识库内放行"
            />
            <MetricCard
              label="影响数据表"
              value={String(version.data_tables.length)}
              note="运行时仅在这些表视图内放行"
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">当前 effective 版本</div>
                <div className="mt-2 text-sm leading-6 text-muted-foreground">
                  {currentEffectiveVersion
                    ? `治理版本 v${currentEffectiveVersion.version} 已生效，运行时应按该版本放行 Skill 访问。`
                    : "当前还没有已生效版本，Skill 运行时不应按新规则放行。"}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleActivate}
                  disabled={actionPending !== "" || version.status === "effective"}
                  className="rounded bg-[#00A3C4] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionPending === "activate" ? "生效中..." : "确认生效"}
                </button>
                <button
                  onClick={handleRollback}
                  disabled={actionPending !== "" || !currentEffectiveVersion}
                  className="rounded border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionPending === "rollback" ? "回滚中..." : "回滚到上一治理版本"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="text-sm font-medium text-foreground">生效影响</div>
              <div className="mt-3 space-y-3">
                <ImpactItem label="治理版本号" value={`v${version.version}`} note={`派生自 ${version.derived_from_snapshot_version}`} />
                <ImpactItem label="影响 Skill" value={version.affected_skills.map((item) => item.skill_name).join("、") || "—"} note="Skill 运行时应统一消费当前 effective 版本" />
                <ImpactItem label="知识库范围" value={version.knowledge_bases.join("、") || "—"} note="未在此版本声明的知识库不放行" />
                <ImpactItem label="数据表范围" value={version.data_tables.join("、") || "—"} note="未在此版本声明的数据表不放行" />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <div className="text-sm font-medium text-foreground">版本历史</div>
              <div className="mt-3 space-y-3">
                {relatedVersions.length === 0 && (
                  <div className="text-sm text-muted-foreground">暂无治理版本历史。</div>
                )}
                {relatedVersions.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/70 bg-background px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">v{item.version}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ORG_MEMORY_GOVERNANCE_STATUS_STYLES[item.status]}`}>
                        {ORG_MEMORY_GOVERNANCE_STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{item.impact_summary}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      创建于 {new Date(item.created_at).toLocaleString("zh-CN")}
                      {item.activated_at ? ` · 生效于 ${new Date(item.activated_at).toLocaleString("zh-CN")}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{note}</div>
    </div>
  );
}

function ListCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-3 space-y-2">
        {items.length === 0 && <div className="text-sm text-muted-foreground">{emptyText}</div>}
        {items.map((item) => (
          <div key={`${title}-${item}`} className="rounded-lg border border-border/70 bg-background px-3 py-3 text-sm text-foreground">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function CompactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/70 px-3 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{title}</div>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.length === 0 && <div>暂无</div>}
        {items.map((item) => (
          <div key={`${title}-${item}`}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "red" | "amber" | "blue" | "slate";
}) {
  const className =
    tone === "green"
      ? "bg-green-100 text-green-700"
      : tone === "red"
        ? "bg-red-100 text-red-700"
        : tone === "amber"
          ? "bg-amber-100 text-amber-700"
          : tone === "blue"
            ? "bg-blue-100 text-blue-700"
            : "bg-slate-100 text-slate-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}

function ImpactItem({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-background px-4 py-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{note}</div>
    </div>
  );
}
