"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import type { PermissionChangeRequest } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";
import { Toggle } from "./Toggle";
import { PendingChangeBadge } from "./PendingChangeBadge";
import { ConfirmChangeDialog } from "./ConfirmChangeDialog";
import {
  FEATURE_LABELS,
  FEATURE_RISK_LEVEL,
  HIGH_RISK_FLAGS,
  type FeatureFlags,
} from "../constants";

interface FeatureFlagsSectionProps {
  userId: number;
  features: FeatureFlags | null;
  loading: boolean;
  pendingChanges: PermissionChangeRequest[];
  onFeaturesChange: (updated: FeatureFlags) => void;
  onPendingCreated: () => void;
}

export function FeatureFlagsSection({
  userId,
  features,
  loading,
  pendingChanges,
  onFeaturesChange,
  onPendingCreated,
}: FeatureFlagsSectionProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    key: keyof FeatureFlags;
    value: boolean;
  } | null>(null);

  async function toggleFeature(key: keyof FeatureFlags, value: boolean) {
    if (HIGH_RISK_FLAGS.has(key)) {
      setConfirmDialog({ key, value });
      return;
    }
    // 低风险：直接写入
    if (!features) return;
    const updated = { ...features, [key]: value };
    onFeaturesChange(updated);
    try {
      await apiFetch(`/admin/users/${userId}/features`, {
        method: "PUT",
        body: JSON.stringify({ feature_flags: updated }),
      });
    } catch {
      onFeaturesChange(features); // revert
    }
  }

  async function handleConfirm(reason: string) {
    if (!confirmDialog) return;
    const { key, value } = confirmDialog;
    try {
      await apiFetch("/admin/permission-changes", {
        method: "POST",
        body: JSON.stringify({
          target_user_id: userId,
          domain: "feature_flag",
          action_key: key,
          current_value: features?.[key] ?? false,
          target_value: value,
          reason,
        }),
      });
      onPendingCreated();
    } catch {
      // ignore
    } finally {
      setConfirmDialog(null);
    }
  }

  function getPendingForFlag(key: string): PermissionChangeRequest | undefined {
    return pendingChanges.find(
      (c) => c.domain === "feature_flag" && c.action_key === key && c.status === "pending"
    );
  }

  return (
    <div className="bg-card border-2 border-border">
      <SectionHeader title="① 系统功能权限" subtitle="控制该用户可使用的系统功能模块" />
      <div className="p-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse">
            加载中…
          </p>
        ) : !features ? (
          <p className="text-xs text-muted-foreground">加载失败</p>
        ) : (
          (Object.keys(FEATURE_LABELS) as (keyof FeatureFlags)[]).map((key) => {
            const pending = getPendingForFlag(key);
            const isHighRisk = HIGH_RISK_FLAGS.has(key);
            return (
              <div
                key={key}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-xs font-bold font-mono text-foreground">
                    {FEATURE_LABELS[key]}
                  </div>
                  {isHighRisk && (
                    <span className="text-[9px] px-1 py-0.5 bg-red-50 text-red-500 border border-red-200 font-bold">
                      需审批
                    </span>
                  )}
                  <div className="text-[10px] text-muted-foreground font-mono">{key}</div>
                  {pending && <PendingChangeBadge change={pending} />}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      features[key] ? "text-[#00A3C4]" : "text-muted-foreground"
                    }`}
                  >
                    {features[key] ? "开启" : "关闭"}
                  </span>
                  <Toggle
                    checked={features[key]}
                    onChange={(v) => toggleFeature(key, v)}
                    disabled={!!pending}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {confirmDialog && (
        <ConfirmChangeDialog
          title={`${FEATURE_LABELS[confirmDialog.key]} 属于高风险权限`}
          message="修改此权限需要审批流程，请填写变更原因。审批通过后将自动生效。"
          onConfirm={handleConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
