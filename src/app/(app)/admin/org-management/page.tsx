"use client";

import { useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter, useSearchParams } from "next/navigation";
import OrgMemoryWorkflow from "@/components/org-memory/OrgMemoryWorkflow";

export default function OrgManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && user?.role === "employee") {
      router.replace("/knowledge");
    }
  }, [loading, router, user]);

  const legacyHint = useMemo(() => {
    const requestedTab = searchParams.get("tab");
    const requestedView = searchParams.get("view");
    if (requestedTab === "snapshots" || requestedView === "snapshots") {
      return "原“结构化快照”入口已并入统一工作流，你现在看到的是步骤 2「快照结果」。";
    }
    if (requestedTab === "proposals") {
      return "原“统一草案”入口已升级为步骤 3 / 4 的「治理版本」与「生效与影响」。";
    }
    if (requestedTab === "overview" || requestedTab === "sources") {
      return "原 tab 结构已收口为单工作流页，页面会按步骤呈现资料接入到生效闭环。";
    }
    return "";
  }, [searchParams]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (user.role === "employee") return null;

  return <OrgMemoryWorkflow legacyHint={legacyHint} />;
}
