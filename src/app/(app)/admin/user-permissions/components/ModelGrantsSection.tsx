"use client";

import { SectionHeader } from "./SectionHeader";
import { Toggle } from "./Toggle";
import { RESTRICTED_MODELS, MODEL_LABELS } from "../constants";

interface ModelGrant {
  id: number;
  user_id: number;
  model_key: string;
  granted_at: string | null;
}

interface ModelGrantsSectionProps {
  grants: ModelGrant[];
  loading: boolean;
  onToggle: (modelKey: string, currentlyGranted: boolean) => void;
}

export function ModelGrantsSection({ grants, loading, onToggle }: ModelGrantsSectionProps) {
  return (
    <div className="bg-card border-2 border-border">
      <SectionHeader title="② 特殊 AI 模型授权" subtitle="控制该用户可访问的受限 AI 模型" />
      <div className="p-4 flex flex-col gap-3">
        {RESTRICTED_MODELS.map((modelKey) => {
          const granted = grants.some((g) => g.model_key === modelKey);
          return (
            <div
              key={modelKey}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div>
                <div className="text-xs font-bold font-mono text-foreground">
                  {MODEL_LABELS[modelKey] || modelKey}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">{modelKey}</div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-bold uppercase ${
                    granted ? "text-[#00A3C4]" : "text-muted-foreground"
                  }`}
                >
                  {granted ? "已授权" : "未授权"}
                </span>
                <Toggle
                  checked={granted}
                  onChange={() => onToggle(modelKey, granted)}
                  disabled={loading}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
