"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { OrgMemoryAppliedConfigVersion, OrgMemoryProposal } from "@/lib/types";
import {
  loadOrgMemoryConfigVersions,
  loadOrgMemoryProposals,
  ORG_MEMORY_PROPOSAL_STATUS_LABELS,
  ORG_MEMORY_PROPOSAL_STATUS_STYLES,
  ORG_MEMORY_RISK_STYLES,
  rollbackOrgMemoryProposalConfig,
  submitOrgMemoryProposal,
} from "@/lib/org-memory";

export default function OrgMemoryProposalsTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [proposals, setProposals] = useState<OrgMemoryProposal[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [submitState, setSubmitState] = useState<Record<number, string>>({});
  const [configVersions, setConfigVersions] = useState<OrgMemoryAppliedConfigVersion[]>([]);
  const [rollbackState, setRollbackState] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await loadOrgMemoryProposals();
        if (!active) return;
        setProposals(result.data);
        const proposalIdFromUrl = Number(searchParams.get("proposal_id") || "0") || null;
        setSelectedId(
          proposalIdFromUrl && result.data.some((item) => item.id === proposalIdFromUrl)
            ? proposalIdFromUrl
            : result.data[0]?.id ?? null,
        );
        setFallbackMode(result.fallback);
        setLoadError("");
      } catch (error) {
        if (!active) return;
        setProposals([]);
        setSelectedId(null);
        setFallbackMode(false);
        setLoadError(error instanceof Error ? error.message : "统一草案加载失败");
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [searchParams]);

  const selected = useMemo(
    () => proposals.find((item) => item.id === selectedId) || proposals[0] || null,
    [selectedId, proposals],
  );

  useEffect(() => {
    if (!selected) return;
    let active = true;
    loadOrgMemoryConfigVersions(selected.id)
      .then((items) => {
        if (!active) return;
        setConfigVersions(items);
      })
      .catch(() => {
        if (!active) return;
        setConfigVersions([]);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  async function refreshProposals(preferredId?: number) {
    const result = await loadOrgMemoryProposals();
    setProposals(result.data);
    setSelectedId((current) => {
      if (preferredId && result.data.some((item) => item.id === preferredId)) return preferredId;
      if (current && result.data.some((item) => item.id === current)) return current;
      return result.data[0]?.id ?? null;
    });
    setFallbackMode(result.fallback);
    setLoadError("");
  }

  async function handleSubmit(proposalId: number) {
    try {
      const result = await submitOrgMemoryProposal(proposalId);
      setSubmitState((prev) => ({
        ...prev,
        [proposalId]: result.message || "已提交审批",
      }));
      const params = new URLSearchParams({ tab: "outgoing" });
      if (result.approval_request_id) {
        params.set("request_id", String(result.approval_request_id));
      }
      router.push(`/approvals?${params.toString()}`);
    } catch {
      setSubmitState((prev) => ({ ...prev, [proposalId]: "当前为前端演示模式，后端提交接口尚未接入" }));
    }
  }

  async function handleRollback(proposalId: number) {
    setRollbackState("正在回滚正式配置...");
    try {
      const result = await rollbackOrgMemoryProposalConfig(proposalId);
      await refreshProposals(proposalId);
      const versions = await loadOrgMemoryConfigVersions(proposalId);
      setConfigVersions(versions);
      setRollbackState(result.message);
    } catch (error) {
      setRollbackState(error instanceof Error ? error.message : "回滚失败");
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground">统一草案</div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              草案把知识库结构、分类规则、共享边界和 Skill 挂载建议收敛为同一份审阅对象，避免三套规则漂移。
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
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="px-2 pb-3 pt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            草案列表
          </div>
          <div className="space-y-2">
            {proposals.map((item) => (
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
                    <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.impact_summary}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ORG_MEMORY_PROPOSAL_STATUS_STYLES[item.proposal_status]}`}>
                    {ORG_MEMORY_PROPOSAL_STATUS_LABELS[item.proposal_status] || item.proposal_status}
                  </span>
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
                  <div className="text-lg font-semibold text-foreground">{selected.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{selected.summary}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${ORG_MEMORY_PROPOSAL_STATUS_STYLES[selected.proposal_status]}`}>
                    {ORG_MEMORY_PROPOSAL_STATUS_LABELS[selected.proposal_status] || selected.proposal_status}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${ORG_MEMORY_RISK_STYLES[selected.risk_level]}`}>
                    {selected.risk_level === "high" ? "高风险" : selected.risk_level === "medium" ? "中风险" : "低风险"}
                  </span>
                </div>
              </div>

              <div className="mt-3 text-sm text-muted-foreground">{selected.impact_summary}</div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <ProposalSection
                  title="知识库结构变化"
                  items={selected.structure_changes.map((item) => ({
                    title: `${item.change_type.toUpperCase()} · ${item.target_path}`,
                    subtitle: `${item.dept_scope} · 置信度 ${(item.confidence_score * 100).toFixed(0)}%`,
                    description: item.rationale,
                  }))}
                />
                <ProposalSection
                  title="分类与共享策略"
                  items={selected.classification_rules.map((item) => ({
                    title: `${item.target_scope} → ${item.default_folder_path}`,
                    subtitle: `${item.origin_scope} → ${item.allowed_scope} · ${item.usage_purpose} · ${item.redaction_mode}`,
                    description: item.rationale,
                  }))}
                />
                <ProposalSection
                  title="Skill 挂载建议"
                  items={selected.skill_mounts.map((item) => ({
                    title: `${item.skill_name} · ${item.decision}`,
                    subtitle: `${item.target_scope} · ${item.required_domains.join(" / ")}`,
                    description: `${item.rationale}（共享上限：${item.max_allowed_scope}；共享形态：${item.required_redaction_mode}）`,
                  }))}
                />
                <ProposalSection
                  title="审批影响项"
                  items={selected.approval_impacts.map((item) => ({
                    title: item.target_asset_name,
                    subtitle: item.impact_type,
                    description: `${item.risk_reason}${item.requires_manual_approval ? " · 需人工审批" : ""}`,
                  }))}
                />
              </div>

              <div className="mt-5 rounded-lg border border-dashed border-border bg-background px-4 py-4">
                <div className="text-sm font-medium text-foreground">证据链</div>
                <div className="mt-3 space-y-2">
                  {selected.evidence_refs.map((item) => (
                    <div key={`${item.section}-${item.label}`} className="rounded border border-border/70 px-3 py-3">
                      <div className="text-xs font-medium text-foreground">
                        {item.label} · {item.section}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-muted-foreground">{item.excerpt}</div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.applied_config && (
                <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-medium text-green-800">正式配置已生效</div>
                    <button
                      onClick={() => handleRollback(selected.id)}
                      className="rounded border border-green-300 bg-white/70 px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-white"
                    >
                      回滚当前配置
                    </button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <EffectItem label="配置编号" value={`#${selected.applied_config.id}`} />
                    <EffectItem label="知识目录" value={`${selected.applied_config.knowledge_paths.length} 个`} />
                    <EffectItem label="分类规则" value={`${selected.applied_config.classification_rule_count} 条`} />
                    <EffectItem label="Skill 挂载" value={`${selected.applied_config.skill_mount_count} 个`} />
                  </div>
                  <div className="mt-3 text-sm leading-6 text-green-700">
                    生效时间：{new Date(selected.applied_config.applied_at).toLocaleString("zh-CN")}
                    {selected.applied_config.status === "effective_with_conditions" ? " · 附条件生效" : " · 全量生效"}
                  </div>
                  {selected.applied_config.knowledge_paths.length > 0 && (
                    <div className="mt-3 text-sm text-green-700">
                      <span className="font-medium">写入目录：</span>
                      {selected.applied_config.knowledge_paths.join("、")}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 rounded-lg border border-border bg-background px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-medium text-foreground">配置版本历史</div>
                  {rollbackState && <div className="text-xs text-muted-foreground">{rollbackState}</div>}
                </div>
                <div className="mt-3 space-y-2">
                  {configVersions.length === 0 && (
                    <div className="text-sm text-muted-foreground">暂无生效或回滚记录。</div>
                  )}
                  {configVersions.map((version) => (
                    <div key={`${version.action}-${version.version}-${version.id}`} className="rounded-lg border border-border/70 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">v{version.version}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          version.action === "rollback"
                            ? "bg-red-100 text-red-700"
                            : version.status === "effective_with_conditions"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-green-100 text-green-700"
                        }`}>
                          {version.action === "rollback" ? "回滚" : version.status === "effective_with_conditions" ? "附条件生效" : "生效"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(version.applied_at).toLocaleString("zh-CN")}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        目录 {version.knowledge_paths.length} 个 · 分类规则 {version.classification_rule_count} 条 · Skill 挂载 {version.skill_mount_count} 个
                      </div>
                      {version.note && <div className="mt-1 text-sm text-muted-foreground">{version.note}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleSubmit(selected.id)}
                  className="rounded bg-[#00A3C4] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  提交审批
                </button>
                <span className="text-sm text-muted-foreground">
                  {submitState[selected.id] || "草案提交后应进入统一审批页处理。"}
                </span>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">暂无草案。</div>
          )}
        </div>
      </div>
    </div>
  );
}

function EffectItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-green-200 bg-white/70 px-3 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-green-700">{label}</div>
      <div className="mt-2 text-sm font-semibold text-green-900">{value}</div>
    </div>
  );
}

function ProposalSection({
  title,
  items,
}: {
  title: string;
  items: Array<{
    title: string;
    subtitle: string;
    description: string;
  }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="mt-3 space-y-3">
        {items.length === 0 && <div className="text-sm text-muted-foreground">暂无变更</div>}
        {items.map((item) => (
          <div key={`${title}-${item.title}`} className="rounded-lg border border-border/70 px-3 py-3">
            <div className="text-sm font-medium text-foreground">{item.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.subtitle}</div>
            <div className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
