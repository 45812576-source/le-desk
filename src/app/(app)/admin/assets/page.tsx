"use client";

import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { useAuth } from "@/lib/auth";
import { FolderTree, Table2, Zap, Wrench, History } from "lucide-react";
import type { AssetType } from "@/lib/types";
import AssetObjectTab from "./tabs/AssetObjectTab";

const TABS = [
  { key: "knowledge_folder" as const, label: "文件夹", icon: FolderTree },
  { key: "business_table" as const, label: "数据表", icon: Table2 },
  { key: "skill" as const, label: "Skill", icon: Zap },
  { key: "tool" as const, label: "Tool", icon: Wrench },
  { key: "changelog" as const, label: "变更记录", icon: History },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AssetsPage() {
  const [tab, setTab] = useState<TabKey>("knowledge_folder");
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  return (
    <PageShell title="知识资产管理" icon={ICONS.skillsAdmin}>
      {/* Tab bar */}
      <div className="flex items-center gap-0 mb-4 border-b-2 border-[#1A202C] overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-colors -mb-[2px] ${
                tab === t.key
                  ? "border-[#00D1FF] text-[#00A3C4] bg-[#EBF4F7]"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={12} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {tab === "changelog" ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            变更记录功能开发中…
          </div>
        ) : (
          <AssetObjectTab assetType={tab as AssetType} isSuperAdmin={isSuperAdmin} />
        )}
      </div>
    </PageShell>
  );
}
