"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import OrgMemoryOverview from "@/components/org-memory/OrgMemoryOverview";
import OrgMemoryFactsWorkspace from "@/components/org-memory/OrgMemoryFactsWorkspace";
import OrgMemoryProposalsTab from "@/components/org-memory/OrgMemoryProposalsTab";

type TabKey =
  | "overview"
  | "sources"
  | "proposals";

interface TabDef {
  key: TabKey;
  label: string;
  roles: ("super_admin" | "dept_admin")[];
}

const TABS: TabDef[] = [
  { key: "overview", label: "总览", roles: ["super_admin", "dept_admin"] },
  { key: "sources", label: "源文档", roles: ["super_admin", "dept_admin"] },
  { key: "proposals", label: "统一草案", roles: ["super_admin", "dept_admin"] },
];

export default function OrgManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const normalizedTab = requestedTab === "snapshots" ? "sources" : requestedTab;
  const effectiveTab = visibleTabs.find((t) => t.key === normalizedTab)
    ? normalizedTab as TabKey
    : visibleTabs[0]?.key ?? "overview";
  const effectiveView = requestedTab === "snapshots"
    ? "snapshots"
    : (requestedView === "snapshots" ? "snapshots" : "sources");

  if (loading || !user) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (user.role === "employee") return null;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-6 h-12 flex items-center gap-4 flex-shrink-0 bg-background">
        <h1 className="text-sm font-semibold text-foreground mr-4">组织事实</h1>
        <div className="text-xs text-muted-foreground">
          {isSuperAdmin ? "组织事实工作台：源文档录入、快照核验与统一草案审批" : "查看组织源文档与统一草案"}
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 border-b border-border bg-background overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("tab", tab.key);
              if (tab.key === "sources") {
                params.set("view", "sources");
              } else {
                params.delete("view");
              }
              if (tab.key !== "proposals") {
                params.delete("proposal_id");
              }
              router.replace(`/admin/org-management?${params.toString()}`);
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
        {requestedTab === "snapshots" && (
          <div className="mx-6 mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            原“结构化快照”一级入口已下沉到“源文档”内。当前已为你打开对应二级视图。
          </div>
        )}
        {effectiveTab === "overview" && <OrgMemoryOverview />}
        {effectiveTab === "sources" && (
          <OrgMemoryFactsWorkspace initialView={effectiveView} />
        )}
        {effectiveTab === "proposals" && <OrgMemoryProposalsTab />}
      </div>
    </div>
  );
}
