"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import GovernanceOverview from "@/components/governance/GovernanceOverview";
import GovernanceInbox from "@/components/governance/GovernanceInbox";
import GovernanceModelWorkspace from "@/components/governance/GovernanceModelWorkspace";

type TabKey =
  | "overview"
  | "inbox"
  | "model";

interface TabDef {
  key: TabKey;
  label: string;
  roles: ("super_admin" | "dept_admin")[];
}

const TABS: TabDef[] = [
  { key: "overview", label: "总览", roles: ["super_admin", "dept_admin"] },
  { key: "inbox", label: "待审治理", roles: ["super_admin", "dept_admin"] },
  { key: "model", label: "治理模型", roles: ["super_admin"] },
];

export default function AdminGovernancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const requestedTab = searchParams.get("tab");
  const requestedView = searchParams.get("view");

  useEffect(() => {
    if (!requestedTab) return;
    const advancedTabs = new Set(["strategy_stats", "baseline_version", "gap", "migration", "experiment", "mask", "schema"]);
    if (advancedTabs.has(requestedTab)) {
      router.replace(`/admin/advanced-governance?tab=${encodeURIComponent(requestedTab)}&legacy_tab=${encodeURIComponent(requestedTab)}`);
    }
  }, [requestedTab, router]);

  const effectiveTab = useMemo<TabKey>(() => {
    if (requestedTab === "review" || requestedTab === "dept_review") return "inbox";
    if (requestedTab === "baseline" || requestedTab === "objects" || requestedTab === "tags") return "model";
    if (requestedTab && visibleTabs.find((t) => t.key === requestedTab)) return requestedTab as TabKey;
    return visibleTabs[0]?.key ?? "overview";
  }, [requestedTab, visibleTabs]);

  const initialInboxView = requestedTab === "dept_review"
    ? "dept_review"
    : (requestedView === "dept_review" ? "dept_review" : "review");
  const initialModelView = requestedTab === "objects" || requestedTab === "tags"
    ? requestedTab
    : (requestedView === "objects" || requestedView === "tags" ? requestedView : "baseline");

  const legacyMessage = requestedTab === "review"
    ? "原“治理审查”已归并到“待审治理 > 统一审查”。"
    : requestedTab === "dept_review"
      ? "原“分类纠偏”已归并到“待审治理 > 分类纠偏”。"
      : requestedTab === "baseline"
        ? "原“协同基线”已归并到“治理模型 > 协同基线”。"
        : requestedTab === "objects"
          ? "原“治理对象”已归并到“治理模型 > 治理对象”。"
          : requestedTab === "tags"
            ? "原“标签治理”已归并到“治理模型 > 标签规则”。"
            : "";

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
            知识治理
          </h1>
        </div>
        <div className="text-[10px] text-gray-500">
          {isSuperAdmin
            ? "高频治理工作台：待审治理、治理模型与知识质量总览"
            : "处理低置信度治理建议，帮助 AI 学习你的口径"}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 border-b border-border bg-white">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("tab", tab.key);
              if (tab.key === "overview") {
                params.delete("view");
              } else if (tab.key === "inbox") {
                params.set("view", isSuperAdmin ? "review" : "dept_review");
              } else if (tab.key === "model") {
                params.set("view", "baseline");
              }
              router.replace(`/admin/governance?${params.toString()}`);
            }}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              effectiveTab === tab.key
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
        {legacyMessage && (
          <div className="mx-6 mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            {legacyMessage}
          </div>
        )}
        {effectiveTab === "overview" && <GovernanceOverview />}
        {effectiveTab === "inbox" && (
          <GovernanceInbox
            role={role as "super_admin" | "dept_admin"}
            initialView={initialInboxView}
          />
        )}
        {effectiveTab === "model" && isSuperAdmin && (
          <GovernanceModelWorkspace
            initialView={initialModelView as "baseline" | "objects" | "tags"}
          />
        )}
      </div>
    </div>
  );
}
