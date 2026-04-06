"use client";

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import GovernanceReviewWorkbench from "@/components/governance/GovernanceReviewWorkbench";
import DeptAdminReviewPanel from "@/components/governance/DeptAdminReviewPanel";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";

export default function GovernancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // employee → redirect 到 /knowledge
  useEffect(() => {
    if (!loading && user?.role === "employee") {
      router.replace("/knowledge");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="h-full flex items-center justify-center text-[10px] text-gray-400">加载中...</div>;
  }

  // employee 不应看到治理面板
  if (user.role === "employee") {
    return null;
  }

  const title = user.role === "super_admin" ? "治理控制台" : "分类纠偏台";
  const subtitle = user.role === "super_admin"
    ? "统一查看建议、策略效果、阈值实验和反馈审计"
    : "审核 AI 低置信度分类，你的每次判断都在帮 AI 变好";

  return (
    <div className="h-full flex flex-col">
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center gap-4 flex-shrink-0 bg-white">
        <div className="flex items-center gap-2 mr-4">
          <ThemedPageIcon icon={ICONS.data} size={16} />
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">{title}</h1>
        </div>
        <div className="text-[10px] text-gray-500">{subtitle}</div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {user.role === "super_admin" ? (
          <GovernanceReviewWorkbench mode="page" />
        ) : (
          <DeptAdminReviewPanel />
        )}
      </div>
    </div>
  );
}
