"use client";

import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { Zap, Wrench, Bot, Key, EyeOff, FileJson } from "lucide-react";
import SkillTab from "./tabs/SkillTab";
import ToolTab from "./tabs/ToolTab";
import ModelTab from "./tabs/ModelTab";
import McpTab from "./tabs/McpTab";
import MaskTab from "./tabs/MaskTab";
import SchemaTab from "./tabs/SchemaTab";

const TABS = [
  { key: "skill", label: "Skill", icon: Zap },
  { key: "tool", label: "Tool", icon: Wrench },
  { key: "model", label: "AI 模型", icon: Bot },
  { key: "mcp", label: "MCP 连接", icon: Key },
  { key: "mask", label: "脱敏规则", icon: EyeOff },
  { key: "schema", label: "Schema", icon: FileJson },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AssetsPage() {
  const [tab, setTab] = useState<TabKey>("skill");

  return (
    <PageShell title="AI 资产管理" icon={ICONS.skillsAdmin}>
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
        {tab === "skill" && <SkillTab />}
        {tab === "tool" && <ToolTab />}
        {tab === "model" && <ModelTab />}
        {tab === "mcp" && <McpTab />}
        {tab === "mask" && <MaskTab />}
        {tab === "schema" && <SchemaTab />}
      </div>
    </PageShell>
  );
}
