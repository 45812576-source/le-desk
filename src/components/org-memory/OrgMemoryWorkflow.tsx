"use client";

import { useMemo, useState } from "react";
import OrgMemoryGovernanceVersionPanel from "@/components/org-memory/OrgMemoryGovernanceVersionPanel";
import OrgMemorySnapshotsTab from "@/components/org-memory/OrgMemorySnapshotsTab";
import OrgMemorySourcesTab from "@/components/org-memory/OrgMemorySourcesTab";
import OrgGovernanceSnapshotWorkbench from "@/components/org-memory/OrgGovernanceSnapshotWorkbench";

/** Feature flag: 新版治理快照工作台 */
const USE_GOVERNANCE_SNAPSHOT_WORKBENCH =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_ORG_GOVERNANCE_SNAPSHOT_WORKBENCH !== "off"
    : true;

export default function OrgMemoryWorkflow({
  legacyHint,
}: {
  legacyHint?: string;
}) {
  const [selectedLegacySnapshotId, setSelectedLegacySnapshotId] = useState<number | null>(null);
  const [selectedWorkspaceSnapshotId, setSelectedWorkspaceSnapshotId] = useState<number | null>(null);
  const [snapshotRefreshSeed, setSnapshotRefreshSeed] = useState(0);
  const [governanceRefreshSeed, setGovernanceRefreshSeed] = useState(0);
  const [forceLegacySnapshots, setForceLegacySnapshots] = useState(false);
  const useGovernanceSnapshotWorkbench = USE_GOVERNANCE_SNAPSHOT_WORKBENCH && !forceLegacySnapshots;
  const governanceSnapshotId = useGovernanceSnapshotWorkbench ? selectedWorkspaceSnapshotId : selectedLegacySnapshotId;
  const governanceSnapshotKind = useGovernanceSnapshotWorkbench ? "workspace" : "legacy";

  const steps = useMemo(
    () => [
      { key: "01", title: "资料接入", description: "导入资料并自动生成快照。" },
      { key: "02", title: "快照结果", description: useGovernanceSnapshotWorkbench ? "横排 Tab 长文 Markdown 编辑、缺失项补齐、治理中间产物展示。" : "核验六类对象、证据、低置信度与差异。" },
      { key: "03", title: "治理版本", description: "查看由当前快照派生出的治理版本。" },
      { key: "04", title: "生效与影响", description: "确认生效、追踪当前 effective 版本并支持回滚。" },
    ],
    [useGovernanceSnapshotWorkbench],
  );

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#00A3C4]">
              主链路工作流
            </div>
            <div className="mt-3 text-2xl font-semibold text-foreground">组织事实 / 资料与治理</div>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-muted-foreground">
              本轮主链路只围绕资料接入、快照生成、治理版本生成，以及 Skill 按治理版本访问知识库 / 数据表展开。
              如果某个旧页面不直接服务这条链路，则只保留代码，不再从导航暴露。
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <div key={step.key} className="rounded-xl border border-border/80 bg-background px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#00A3C4]">
                Step {step.key}
              </div>
              <div className="mt-2 text-sm font-medium text-foreground">{step.title}</div>
              <div className="mt-2 text-xs leading-6 text-muted-foreground">{step.description}</div>
            </div>
          ))}
        </div>
      </div>

      {legacyHint && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {legacyHint}
        </div>
      )}

      <WorkflowStep index={1} title="资料接入" description="导入资料后自动完成 source → snapshot → governance_version 的初次生成。">
        <OrgMemorySourcesTab
          onSnapshotReady={(snapshotId) => {
            setSelectedLegacySnapshotId(snapshotId);
            setSnapshotRefreshSeed((current) => current + 1);
            setGovernanceRefreshSeed((current) => current + 1);
          }}
        />
      </WorkflowStep>

      <WorkflowStep
        index={2}
        title="快照结果"
        description={useGovernanceSnapshotWorkbench
          ? "横排 Tab 长文 Markdown 编辑、缺失项补齐、治理中间产物展示。"
          : "从结果页直接查看六类对象、证据、差异，并按需刷新治理版本。"}
      >
        {useGovernanceSnapshotWorkbench ? (
          <>
            <OrgGovernanceSnapshotWorkbench
              onSelectedSnapshotChange={setSelectedWorkspaceSnapshotId}
              onGovernanceVersionUpdated={() => setGovernanceRefreshSeed((current) => current + 1)}
              onUnavailable={() => {
                setForceLegacySnapshots(true);
                setSnapshotRefreshSeed((current) => current + 1);
              }}
            />
          </>
        ) : (
          <>
            {USE_GOVERNANCE_SNAPSHOT_WORKBENCH && forceLegacySnapshots && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                新版治理快照接口暂不可用，当前已自动回退到旧版结构化快照只读页面。
              </div>
            )}
            <OrgMemorySnapshotsTab
              selectedSnapshotId={selectedLegacySnapshotId}
              refreshSeed={snapshotRefreshSeed}
              onSelectedSnapshotChange={setSelectedLegacySnapshotId}
              onGovernanceVersionUpdated={() => setGovernanceRefreshSeed((current) => current + 1)}
            />
          </>
        )}
      </WorkflowStep>

      <WorkflowStep index={3} title="治理版本" description="治理版本直接回答：影响哪些 Skill、可访问哪些知识库 / 数据表、范围和脱敏要求是什么。">
        <OrgMemoryGovernanceVersionPanel
          snapshotId={governanceSnapshotId}
          snapshotKind={governanceSnapshotKind}
          refreshSeed={governanceRefreshSeed}
          section="version"
        />
      </WorkflowStep>

      <WorkflowStep index={4} title="生效与影响" description="只有当前 effective 治理版本会被运行时消费，页面提供确认生效与回滚入口。">
        <OrgMemoryGovernanceVersionPanel
          snapshotId={governanceSnapshotId}
          snapshotKind={governanceSnapshotKind}
          refreshSeed={governanceRefreshSeed}
          section="activation"
        />
      </WorkflowStep>
    </div>
  );
}

function WorkflowStep({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-background">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[#00D1FF]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#007C95]">
            Step {String(index).padStart(2, "0")}
          </span>
          <div className="text-base font-semibold text-foreground">{title}</div>
        </div>
        <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}
