"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GovernanceReviewWorkbench from "@/components/governance/GovernanceReviewWorkbench";
import DeptAdminReviewPanel from "@/components/governance/DeptAdminReviewPanel";

type GovernanceInboxView = "review" | "dept_review";

interface InboxViewDef {
  key: GovernanceInboxView;
  label: string;
  description: string;
  roles: ("super_admin" | "dept_admin")[];
}

const INBOX_VIEWS: InboxViewDef[] = [
  {
    key: "review",
    label: "统一审查",
    description: "处理系统待审建议、审核挂载结果，并查看治理反馈闭环。",
    roles: ["super_admin"],
  },
  {
    key: "dept_review",
    label: "分类纠偏",
    description: "处理低置信度分类条目，帮助 AI 学习部门口径。",
    roles: ["super_admin", "dept_admin"],
  },
];

export default function GovernanceInbox({
  role,
  initialView = "review",
}: {
  role: "super_admin" | "dept_admin";
  initialView?: GovernanceInboxView;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visibleViews = useMemo(
    () => INBOX_VIEWS.filter((item) => item.roles.includes(role)),
    [role],
  );

  const normalizedInitialView = useMemo<GovernanceInboxView>(
    () => (visibleViews.some((item) => item.key === initialView)
      ? initialView
      : (visibleViews[0]?.key ?? "dept_review")),
    [initialView, visibleViews],
  );

  const [activeView, setActiveView] = useState<GovernanceInboxView>(normalizedInitialView);

  useEffect(() => {
    setActiveView(normalizedInitialView);
  }, [normalizedInitialView]);

  const activeDef = visibleViews.find((item) => item.key === activeView) || visibleViews[0];

  function handleViewChange(view: GovernanceInboxView) {
    setActiveView(view);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "inbox");
    params.set("view", view);
    router.replace(`/admin/governance?${params.toString()}`);
  }

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border bg-white">
        <div className="flex flex-wrap items-center gap-2">
          {visibleViews.map((view) => (
            <button
              key={view.key}
              onClick={() => handleViewChange(view.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                activeView === view.key
                  ? "border-[#0077B6] bg-sky-50 text-[#0077B6]"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          {activeDef?.description}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {activeView === "review" && role === "super_admin" && (
          <GovernanceReviewWorkbench mode="page" />
        )}
        {activeView === "dept_review" && <DeptAdminReviewPanel />}
      </div>
    </div>
  );
}
