"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OrgMemorySourcesTab from "@/components/org-memory/OrgMemorySourcesTab";
import OrgMemorySnapshotsTab from "@/components/org-memory/OrgMemorySnapshotsTab";

type FactsView = "sources" | "snapshots";

interface FactsViewDef {
  key: FactsView;
  label: string;
  description: string;
}

const FACTS_VIEWS: FactsViewDef[] = [
  {
    key: "sources",
    label: "源文档",
    description: "录入组织事实源，并为当前文档触发快照生成。",
  },
  {
    key: "snapshots",
    label: "结构化快照",
    description: "核验解析结果、版本差异与草案生成前的中间态。",
  },
];

export default function OrgMemoryFactsWorkspace({
  initialView = "sources",
}: {
  initialView?: FactsView;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizedInitialView = useMemo<FactsView>(
    () => (FACTS_VIEWS.some((item) => item.key === initialView) ? initialView : "sources"),
    [initialView],
  );
  const [activeView, setActiveView] = useState<FactsView>(normalizedInitialView);

  useEffect(() => {
    setActiveView(normalizedInitialView);
  }, [normalizedInitialView]);

  const activeDef = FACTS_VIEWS.find((item) => item.key === activeView) || FACTS_VIEWS[0];

  function handleViewChange(view: FactsView) {
    setActiveView(view);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "sources");
    params.set("view", view);
    router.replace(`/admin/org-management?${params.toString()}`);
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-5 pb-3 border-b border-border bg-background">
        <div className="flex flex-wrap items-center gap-2">
          {FACTS_VIEWS.map((view) => (
            <button
              key={view.key}
              onClick={() => handleViewChange(view.key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                activeView === view.key
                  ? "border-[#00A3C4] bg-[#00D1FF]/5 text-[#007C95]"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
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
        {activeView === "sources" && <OrgMemorySourcesTab />}
        {activeView === "snapshots" && <OrgMemorySnapshotsTab />}
      </div>
    </div>
  );
}
