"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CollaborationBaseline from "@/components/governance/CollaborationBaseline";
import GovernanceObjectsTab from "@/components/governance/GovernanceObjectsTab";
import TagGovernanceTab from "@/components/governance/TagGovernanceTab";

type GovernanceModelView = "baseline" | "objects" | "tags";

interface ModelViewDef {
  key: GovernanceModelView;
  label: string;
  description: string;
}

const MODEL_VIEWS: ModelViewDef[] = [
  {
    key: "baseline",
    label: "协同基线",
    description: "定义跨知识域的协同边界、覆盖度与治理基线。",
  },
  {
    key: "objects",
    label: "治理对象",
    description: "维护治理对象、冲突合并与对象绑定关系。",
  },
  {
    key: "tags",
    label: "标签规则",
    description: "维护标签体系、标签关系与分类标准件。",
  },
];

export default function GovernanceModelWorkspace({
  initialView = "baseline",
}: {
  initialView?: GovernanceModelView;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const normalizedInitialView = useMemo<GovernanceModelView>(
    () => (MODEL_VIEWS.some((item) => item.key === initialView) ? initialView : "baseline"),
    [initialView],
  );
  const [activeView, setActiveView] = useState<GovernanceModelView>(normalizedInitialView);

  useEffect(() => {
    setActiveView(normalizedInitialView);
  }, [normalizedInitialView]);

  const activeDef = MODEL_VIEWS.find((item) => item.key === activeView) || MODEL_VIEWS[0];

  function handleViewChange(view: GovernanceModelView) {
    setActiveView(view);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "model");
    params.set("view", view);
    router.replace(`/admin/governance?${params.toString()}`);
  }

  return (
    <div className="h-full flex flex-col bg-card">
      <div className="px-4 py-3 border-b border-border bg-white">
        <div className="flex flex-wrap items-center gap-2">
          {MODEL_VIEWS.map((view) => (
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
        {activeView === "baseline" && <CollaborationBaseline />}
        {activeView === "objects" && <GovernanceObjectsTab />}
        {activeView === "tags" && <TagGovernanceTab />}
      </div>
    </div>
  );
}
