"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import OrgOverview from "@/components/org-management/OrgOverview";
import OrgStructureTab from "@/components/org-management/OrgStructureTab";
import RosterTab from "@/components/org-management/RosterTab";
import OkrTab from "@/components/org-management/OkrTab";
import KpiTab from "@/components/org-management/KpiTab";
import DeptMissionTab from "@/components/org-management/DeptMissionTab";
import BizProcessTab from "@/components/org-management/BizProcessTab";
import TerminologyTab from "@/components/org-management/TerminologyTab";
import DataAssetTab from "@/components/org-management/DataAssetTab";
import CollabMatrixTab from "@/components/org-management/CollabMatrixTab";
import AccessMatrixTab from "@/components/org-management/AccessMatrixTab";
import BaselineVersionTab from "@/components/org-management/BaselineVersionTab";
import CompetencyModelTab from "@/components/org-management/CompetencyModelTab";
import ResourceLibDefTab from "@/components/org-management/ResourceLibDefTab";
import KrMappingTab from "@/components/org-management/KrMappingTab";
import CollabProtocolTab from "@/components/org-management/CollabProtocolTab";

type TabKey =
  | "overview"
  | "baseline"
  | "org_structure"
  | "roster"
  | "okr"
  | "kpi"
  | "dept_mission"
  | "biz_process"
  | "terminology"
  | "data_asset"
  | "collab_matrix"
  | "access_matrix"
  | "competency"
  | "resource_lib_def"
  | "kr_mapping"
  | "collab_protocol";

interface TabDef {
  key: TabKey;
  label: string;
  roles: ("super_admin" | "dept_admin")[];
}

const TABS: TabDef[] = [
  { key: "overview", label: "基线控制台", roles: ["super_admin", "dept_admin"] },
  { key: "baseline", label: "基线版本", roles: ["super_admin"] },
  { key: "org_structure", label: "组织架构", roles: ["super_admin"] },
  { key: "roster", label: "花名册", roles: ["super_admin", "dept_admin"] },
  { key: "okr", label: "OKR", roles: ["super_admin"] },
  { key: "kpi", label: "绩效 KPI", roles: ["super_admin"] },
  { key: "dept_mission", label: "部门职责", roles: ["super_admin"] },
  { key: "biz_process", label: "业务流程", roles: ["super_admin"] },
  { key: "competency", label: "岗位能力", roles: ["super_admin"] },
  { key: "resource_lib_def", label: "资源库定义", roles: ["super_admin"] },
  { key: "kr_mapping", label: "KR 映射", roles: ["super_admin"] },
  { key: "collab_protocol", label: "协同协议", roles: ["super_admin"] },
  { key: "terminology", label: "业务术语", roles: ["super_admin"] },
  { key: "data_asset", label: "数据资产", roles: ["super_admin"] },
  { key: "collab_matrix", label: "协作矩阵", roles: ["super_admin"] },
  { key: "access_matrix", label: "访问矩阵", roles: ["super_admin"] },
];

export default function OrgManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

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

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const effectiveTab = visibleTabs.find((t) => t.key === activeTab)
    ? activeTab
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
        <h1 className="text-sm font-semibold text-foreground mr-4">组织管理</h1>
        <div className="text-xs text-muted-foreground">
          {isSuperAdmin ? "组织基线中枢 — 治理底座版本管理" : "查看组织总览与花名册"}
        </div>
      </div>

      <div className="flex items-center gap-1 px-4 border-b border-border bg-background overflow-x-auto">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
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
        {effectiveTab === "overview" && <OrgOverview />}
        {effectiveTab === "baseline" && <BaselineVersionTab />}
        {effectiveTab === "org_structure" && <OrgStructureTab />}
        {effectiveTab === "roster" && <RosterTab />}
        {effectiveTab === "okr" && <OkrTab />}
        {effectiveTab === "kpi" && <KpiTab />}
        {effectiveTab === "dept_mission" && <DeptMissionTab />}
        {effectiveTab === "biz_process" && <BizProcessTab />}
        {effectiveTab === "competency" && <CompetencyModelTab />}
        {effectiveTab === "resource_lib_def" && <ResourceLibDefTab />}
        {effectiveTab === "kr_mapping" && <KrMappingTab />}
        {effectiveTab === "collab_protocol" && <CollabProtocolTab />}
        {effectiveTab === "terminology" && <TerminologyTab />}
        {effectiveTab === "data_asset" && <DataAssetTab />}
        {effectiveTab === "collab_matrix" && <CollabMatrixTab />}
        {effectiveTab === "access_matrix" && <AccessMatrixTab />}
      </div>
    </div>
  );
}
