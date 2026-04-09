"use client";

import { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import {
  REVIEW_ACTIONS,
  PUBLISH_ACTIONS,
  KNOWLEDGE_ACTION_LABELS,
  HIGH_RISK_ACTIONS,
} from "../../constants";

type GrantMode = "review" | "publish";

interface GrantDialogProps {
  userId: number;
  mode: GrantMode;
  onClose: () => void;
  onGranted: () => void;
}

export function GrantDialog({ userId, mode, onClose, onGranted }: GrantDialogProps) {
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const actions = mode === "review" ? REVIEW_ACTIONS : PUBLISH_ACTIONS;

  function toggleAction(action: string) {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(action)) next.delete(action);
      else next.add(action);
      return next;
    });
  }

  async function handleSave() {
    if (selectedActions.size === 0) return;
    setSaving(true);
    try {
      const grants = Array.from(selectedActions).map((action) => ({
        resource_type: "approval_capability",
        resource_id: null,
        action,
        scope: "exact",
      }));
      await apiFetch(`/admin/users/${userId}/knowledge-permissions`, {
        method: "POST",
        body: JSON.stringify({ grants }),
      });
      onGranted();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "review" ? "授予内容审批资格" : "授予发布审批资格";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border-2 border-border w-[420px] max-w-[90vw] max-h-[80vh] flex flex-col">
        <div className="bg-muted border-b-2 border-border px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-widest text-[#00A3C4]">
            {title}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] block mb-2">
            授权动作
          </label>
          <div className="flex flex-col gap-2">
            {actions.map((action) => {
              const isHighRisk = HIGH_RISK_ACTIONS.has(action);
              return (
                <label
                  key={action}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedActions.has(action)}
                    onChange={() => toggleAction(action)}
                  />
                  <span className="font-mono text-foreground">
                    {KNOWLEDGE_ACTION_LABELS[action] || action}
                  </span>
                  {isHighRisk && (
                    <span className="text-[9px] px-1 py-0.5 bg-red-50 text-red-500 border border-red-200 font-bold">
                      高风险
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div className="border-t-2 border-border px-4 py-3 flex justify-end gap-2">
          <PixelButton variant="secondary" size="sm" onClick={onClose}>
            取消
          </PixelButton>
          <PixelButton
            size="sm"
            onClick={handleSave}
            disabled={saving || selectedActions.size === 0}
          >
            {saving ? "保存中…" : "授予资格"}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
