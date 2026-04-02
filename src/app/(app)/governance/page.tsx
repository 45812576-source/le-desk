"use client";

import GovernanceReviewWorkbench from "@/components/governance/GovernanceReviewWorkbench";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";

export default function GovernancePage() {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center gap-4 flex-shrink-0 bg-white">
        <div className="flex items-center gap-2 mr-4">
          <ThemedPageIcon icon={ICONS.data} size={16} />
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">治理控制台</h1>
        </div>
        <div className="text-[10px] text-gray-500">统一查看建议、策略效果、坏规则和反馈审计</div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <GovernanceReviewWorkbench mode="page" />
      </div>
    </div>
  );
}
