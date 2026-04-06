"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import GovernanceOverview from "@/components/governance/GovernanceOverview";
import StrategyStatsTab from "@/components/governance/StrategyStatsTab";
import GovernanceReviewWorkbench from "@/components/governance/GovernanceReviewWorkbench";
import CollaborationBaseline from "@/components/governance/CollaborationBaseline";
import BaselineVersionPanel from "@/components/governance/BaselineVersionPanel";
import GapManagementPanel from "@/components/governance/GapManagementPanel";
import MigrationWizard from "@/components/governance/MigrationWizard";
import ThresholdExperiment from "@/components/governance/ThresholdExperiment";
import DeptAdminReviewPanel from "@/components/governance/DeptAdminReviewPanel";
import FolderGovernanceTab from "@/components/governance/FolderGovernanceTab";
import TagGovernanceTab from "@/components/governance/TagGovernanceTab";
import GovernanceObjectsTab from "@/components/governance/GovernanceObjectsTab";

type TabKey =
  | "overview"
  | "review"
  | "strategy_stats"
  | "baseline"
  | "baseline_version"
  | "gap"
  | "migration"
  | "experiment"
  | "dept_review"
  | "objects"
  | "folders"
  | "tags";

interface TabDef {
  key: TabKey;
  label: string;
  roles: ("super_admin" | "dept_admin")[];
}

const TABS: TabDef[] = [
  { key: "overview", label: "总览", roles: ["super_admin", "dept_admin"] },
  { key: "review", label: "治理审查", roles: ["super_admin"] },
  { key: "strategy_stats", label: "策略统计", roles: ["super_admin"] },
  { key: "baseline", label: "协同基线", roles: ["super_admin"] },
  { key: "baseline_version", label: "基线版本", roles: ["super_admin"] },
  { key: "gap", label: "领域缺口", roles: ["super_admin"] },
  { key: "migration", label: "跨公司迁移", roles: ["super_admin"] },
  { key: "experiment", label: "阈值实验", roles: ["super_admin"] },
  { key: "dept_review", label: "分类纠偏", roles: ["super_admin", "dept_admin"] },
  { key: "objects", label: "治理对象", roles: ["super_admin"] },
  { key: "folders", label: "目录治理", roles: ["super_admin"] },
  { key: "tags", label: "标签治理", roles: ["super_admin"] },
];

export default function AdminGovernancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // employee → redirect 到 /knowledge
  useEffect(() => {
    if (!loading && user?.role === "employee") {
      router.replace("/knowledge");
    }
  }, [loading, user, router]);

  const role = user?.role as string;
  const isSuperAdmin = role === "super_admin";

  const visibleTabs = TABS.filter((t) =>
    t.roles.includes(role as "super_admin" | "dept_admin")
  );

  const defaultTab: TabKey = "overview";
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  // 确保 activeTab 在可见 tab 中
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  if (loading || !user) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-gray-400">
        加载中...
      </div>
    );
  }

  if (user.role === "employee") {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center gap-4 flex-shrink-0 bg-white">
        <div className="flex items-center gap-2 mr-4">
          <ThemedPageIcon icon={ICONS.review} size={16} />
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">
            治理引擎
          </h1>
        </div>
        <div className="text-[10px] text-gray-500">
          {isSuperAdmin
            ? "统一治理总控：审查、基线、缺口、迁移、实验、目录、标签"
            : "审核 AI 低置信度分类，你的每次判断都在帮 AI 变好"}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 border-b border-border bg-white">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "overview" && <GovernanceOverview />}
        {activeTab === "review" && <GovernanceReviewWorkbench mode="page" />}
        {activeTab === "strategy_stats" && <StrategyStatsTab />}
        {activeTab === "baseline" && <CollaborationBaseline />}
        {activeTab === "baseline_version" && <BaselineVersionPanel />}
        {activeTab === "gap" && <GapManagementPanel />}
        {activeTab === "migration" && <MigrationWizard />}
        {activeTab === "experiment" && <ThresholdExperiment />}
        {activeTab === "dept_review" && <DeptAdminReviewPanel />}
        {activeTab === "objects" && <GovernanceObjectsTab />}
        {activeTab === "folders" && <FolderGovernanceTab isSuperAdmin={isSuperAdmin} />}
        {activeTab === "tags" && <TagGovernanceTab />}
      </div>
    </div>
  );
}
