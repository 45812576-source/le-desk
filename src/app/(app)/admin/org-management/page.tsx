"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import OrgMemoryOverview from "@/components/org-memory/OrgMemoryOverview";
import OrgMemorySourcesTab from "@/components/org-memory/OrgMemorySourcesTab";
import OrgMemorySnapshotsTab from "@/components/org-memory/OrgMemorySnapshotsTab";
import OrgMemoryProposalsTab from "@/components/org-memory/OrgMemoryProposalsTab";

type TabKey =
  | "overview"
  | "sources"
  | "snapshots"
  | "proposals";

interface TabDef {
  key: TabKey;
  label: string;
  roles: ("super_admin" | "dept_admin")[];
}

const TABS: TabDef[] = [
  { key: "overview", label: "概览", roles: ["super_admin", "dept_admin"] },
  { key: "sources", label: "源文档", roles: ["super_admin", "dept_admin"] },
  { key: "snapshots", label: "结构化快照", roles: ["super_admin", "dept_admin"] },
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
  const effectiveTab = visibleTabs.find((t) => t.key === requestedTab)
    ? requestedTab as TabKey
    : visibleTabs[0]?.key ?? "overview";

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
        <h1 className="text-sm font-semibold text-foreground mr-4">组织 Memory</h1>
        <div className="text-xs text-muted-foreground">
          {isSuperAdmin ? "文档驱动的组织治理入口 — Source / Snapshot / Proposal" : "查看组织文档、快照与草案"}
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 border-b border-border bg-background overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.set("tab", tab.key);
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
        {effectiveTab === "overview" && <OrgMemoryOverview />}
        {effectiveTab === "sources" && <OrgMemorySourcesTab />}
        {effectiveTab === "snapshots" && <OrgMemorySnapshotsTab />}
        {effectiveTab === "proposals" && <OrgMemoryProposalsTab />}
      </div>
    </div>
  );
}
