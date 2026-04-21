"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import StrategyStatsTab from "@/components/governance/StrategyStatsTab";
import BaselineVersionPanel from "@/components/governance/BaselineVersionPanel";
import GapManagementPanel from "@/components/governance/GapManagementPanel";
import MigrationWizard from "@/components/governance/MigrationWizard";
import ThresholdExperiment from "@/components/governance/ThresholdExperiment";
import MaskTab from "@/app/(app)/admin/assets/tabs/MaskTab";
import SchemaTab from "@/app/(app)/admin/assets/tabs/SchemaTab";

type TabKey =
  | "strategy_stats"
  | "baseline_version"
  | "gap"
  | "migration"
  | "experiment"
  | "mask"
  | "schema";

interface TabDef {
  key: TabKey;
  label: string;
}

const TABS: TabDef[] = [
  { key: "strategy_stats", label: "策略统计" },
  { key: "baseline_version", label: "基线版本" },
  { key: "gap", label: "领域缺口" },
  { key: "migration", label: "跨公司迁移" },
  { key: "experiment", label: "阈值实验" },
  { key: "mask", label: "脱敏规则" },
  { key: "schema", label: "Schema" },
];

const REDIRECT_TABS = new Set([
  "overview",
  "review",
  "dept_review",
  "baseline",
  "objects",
  "tags",
]);

export default function AdvancedGovernancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && user?.role !== "super_admin") {
      router.replace("/admin/governance");
    }
  }, [loading, router, user]);

  const requestedTab = searchParams.get("tab");
  const legacyTab = searchParams.get("legacy_tab");

  useEffect(() => {
    if (!requestedTab || !REDIRECT_TABS.has(requestedTab)) return;
    router.replace(`/admin/governance?tab=${encodeURIComponent(requestedTab)}`);
  }, [requestedTab, router]);

  const effectiveTab = useMemo<TabKey>(() => {
    if (requestedTab && TABS.some((tab) => tab.key === requestedTab)) {
      return requestedTab as TabKey;
    }
    return "strategy_stats";
  }, [requestedTab]);

  if (loading || !user) {
    return (
      <div className="h-full flex items-center justify-center text-[10px] text-gray-400">
        加载中...
      </div>
    );
  }

  if (user.role !== "super_admin") {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center gap-4 flex-shrink-0 bg-white">
        <div className="flex items-center gap-2 mr-4">
          <ThemedPageIcon icon={ICONS.settings} size={16} />
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">
            高级治理
          </h1>
        </div>
        <div className="text-[10px] text-gray-500">
          低频平台治理能力：版本、缺口、迁移、实验、Schema 与脱敏
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 border-b border-border bg-white overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("tab", tab.key);
              params.delete("legacy_tab");
              router.replace(`/admin/advanced-governance?${params.toString()}`);
            }}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              effectiveTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {legacyTab && (
          <div className="mx-6 mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            原“{legacyTab}”入口已迁移到“高级治理”。当前已为你打开对应页面。
          </div>
        )}
        {effectiveTab === "strategy_stats" && <StrategyStatsTab />}
        {effectiveTab === "baseline_version" && <BaselineVersionPanel />}
        {effectiveTab === "gap" && <GapManagementPanel />}
        {effectiveTab === "migration" && <MigrationWizard />}
        {effectiveTab === "experiment" && <ThresholdExperiment />}
        {effectiveTab === "mask" && <MaskTab />}
        {effectiveTab === "schema" && <SchemaTab />}
      </div>
    </div>
  );
}
