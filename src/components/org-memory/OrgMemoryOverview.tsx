"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrgMemoryProposal, OrgMemorySource } from "@/lib/types";
import {
  loadOrgMemoryOverviewData,
  ORG_MEMORY_PARSE_STATUS_LABELS,
  ORG_MEMORY_PARSE_STATUS_STYLES,
  ORG_MEMORY_PROPOSAL_STATUS_LABELS,
  ORG_MEMORY_PROPOSAL_STATUS_STYLES,
  ORG_MEMORY_SOURCE_TYPE_LABELS,
} from "@/lib/org-memory";

export default function OrgMemoryOverview() {
  const [sources, setSources] = useState<OrgMemorySource[]>([]);
  const [proposals, setProposals] = useState<OrgMemoryProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const result = await loadOrgMemoryOverviewData();
        if (!active) return;
        setSources(result.data.sources);
        setProposals(result.data.proposals);
        setFallbackMode(result.fallback);
        setError("");
      } catch (error) {
        if (!active) return;
        setSources([]);
        setProposals([]);
        setFallbackMode(false);
        setError(error instanceof Error ? error.message : "组织 Memory 加载失败");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const readySources = sources.filter((item) => item.ingest_status === "ready").length;
    const pendingProposals = proposals.filter((item) => item.proposal_status === "pending_approval").length;
    const highRiskProposals = proposals.filter((item) => item.risk_level === "high").length;
    const latestSource = [...sources].sort((a, b) => {
      const av = new Date(a.fetched_at || 0).getTime();
      const bv = new Date(b.fetched_at || 0).getTime();
      return bv - av;
    })[0];
    return {
      totalSources: sources.length,
      readySources,
      pendingProposals,
      highRiskProposals,
      latestSourceTitle: latestSource?.title || "—",
    };
  }, [proposals, sources]);

  const recentProposals = proposals.slice(0, 2);

  if (loading) {
    return <div className="space-y-4 p-6 text-sm text-muted-foreground">组织 Memory 加载中…</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#00A3C4]">
              组织 Memory 概览
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              当前入口只承接外部组织文档、结构化快照、统一草案与审批生效，不再鼓励系统内维护组织树、花名册和 OKR。
            </p>
          </div>
          {fallbackMode && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
              当前展示演示数据
            </span>
          )}
        </div>
        {error && (
          <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="源文档" value={String(metrics.totalSources)} note={`${metrics.readySources} 份已可解析`} />
        <MetricCard label="待审批草案" value={String(metrics.pendingProposals)} note="统一草案进入审批流" />
        <MetricCard label="高风险项" value={String(metrics.highRiskProposals)} note="扩大共享范围或降低匿名化" />
        <MetricCard label="最近导入" value={metrics.latestSourceTitle} note="最新同步的源文档标题" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm font-semibold text-foreground">最近源文档</div>
          <div className="mt-4 space-y-3">
            {sources.slice(0, 3).map((item) => (
              <div key={item.id} className="rounded-lg border border-border/80 bg-background px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {ORG_MEMORY_SOURCE_TYPE_LABELS[item.source_type] || item.source_type} · {item.owner_name}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${ORG_MEMORY_PARSE_STATUS_STYLES[item.ingest_status]}`}>
                    {ORG_MEMORY_PARSE_STATUS_LABELS[item.ingest_status] || item.ingest_status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  最近快照：{item.latest_snapshot_version || "未生成"} · 版本：{item.external_version || "待同步"}
                </div>
                {item.latest_parse_note && (
                  <div className="mt-2 rounded border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    {item.latest_parse_note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm font-semibold text-foreground">最近草案</div>
          <div className="mt-4 space-y-3">
            {recentProposals.map((item) => (
              <div key={item.id} className="rounded-lg border border-border/80 bg-background px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.impact_summary}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${ORG_MEMORY_PROPOSAL_STATUS_STYLES[item.proposal_status]}`}>
                    {ORG_MEMORY_PROPOSAL_STATUS_LABELS[item.proposal_status] || item.proposal_status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <TagBadge label={`结构 ${item.structure_changes.length}`} />
                  <TagBadge label={`分类 ${item.classification_rules.length}`} />
                  <TagBadge label={`挂载 ${item.skill_mounts.length}`} />
                  <TagBadge label={`审批影响 ${item.approval_impacts.length}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="text-sm font-semibold text-foreground">治理原则</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <PrincipleCard
            title="源文档唯一事实源"
            description="组织信息以外部文档为准，系统只保留解析快照与推断结果。"
          />
          <PrincipleCard
            title="三类消费端共用草案"
            description="目录结构、共享策略和 Skill 挂载都来自同一份 Proposal。"
          />
          <PrincipleCard
            title="共享边界可审批"
            description="扩大共享范围或降低匿名化要求时，必须经过人工审批。"
          />
        </div>
      </div>
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

function PrincipleCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-background px-4 py-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-2 text-xs leading-5 text-muted-foreground">{description}</div>
    </div>
  );
}

function TagBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
      {label}
    </span>
  );
}
