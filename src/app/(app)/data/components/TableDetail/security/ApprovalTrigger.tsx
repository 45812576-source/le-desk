"use client";

import React, { useState, useCallback } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { createApprovalRequest } from "../../shared/api";
import type { DataApprovalType, TableDetailV2 } from "../../shared/types";

const APPROVAL_TYPE_LABELS: Record<DataApprovalType, string> = {
  export_sensitive: "导出敏感数据",
  elevate_disclosure: "提升披露等级",
  grant_access: "授予访问权限",
  policy_change: "策略变更",
};

interface ApprovalFormProps {
  tableId: number;
  tableName: string;
  defaultType?: DataApprovalType;
  defaultPayload?: Record<string, unknown>;
  onSubmitted: () => void;
  onCancel: () => void;
}

export function ApprovalForm({ tableId, tableName, defaultType, defaultPayload, onSubmitted, onCancel }: ApprovalFormProps) {
  const [type, setType] = useState<DataApprovalType>(defaultType || "policy_change");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) {
      alert("请填写申请原因");
      return;
    }
    setSubmitting(true);
    try {
      await createApprovalRequest({
        approval_type: type,
        table_id: tableId,
        payload: { ...defaultPayload, reason: reason.trim(), table_name: tableName },
      });
      onSubmitted();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border-2 border-[#00D1FF] bg-white p-3 space-y-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">提交审批申请</div>

      <div>
        <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 block mb-1">审批类型</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as DataApprovalType)}
          className="text-[9px] border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-[#00D1FF]"
        >
          {Object.entries(APPROVAL_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 block mb-1">申请原因</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="请说明变更原因和影响范围..."
          rows={3}
          className="text-[9px] border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:border-[#00D1FF] resize-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <PixelButton size="sm" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "提交中..." : "提交审批"}
        </PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={onCancel}>取消</PixelButton>
      </div>
    </div>
  );
}

/** 检查操作是否需要审批 */
export function checkApprovalRequired(detail: TableDetailV2, action: string): boolean {
  // 有敏感字段(S2+)的表，策略变更需审批
  const hasSensitive = detail.fields.some((f) => f.sensitivity_level >= "S2_sensitive");
  if (hasSensitive && ["policy_change", "export_sensitive", "elevate_disclosure"].includes(action)) {
    return true;
  }
  // 有需审批的 grant
  const hasApprovalGrant = detail.skill_grants?.some((g) => g.approval_required);
  if (hasApprovalGrant && action === "grant_access") {
    return true;
  }
  return false;
}

/** useApprovalCheck hook */
export function useApprovalCheck(detail: TableDetailV2) {
  const [showForm, setShowForm] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    type: DataApprovalType;
    payload: Record<string, unknown>;
    onApproved: () => void;
  } | null>(null);

  const triggerApproval = useCallback((type: DataApprovalType, payload: Record<string, unknown>, onApproved: () => void) => {
    if (checkApprovalRequired(detail, type)) {
      setPendingAction({ type, payload, onApproved });
      setShowForm(true);
    } else {
      onApproved();
    }
  }, [detail]);

  const onSubmitted = useCallback(() => {
    setShowForm(false);
    setPendingAction(null);
    alert("审批申请已提交，待审批通过后生效");
  }, []);

  const onCancel = useCallback(() => {
    setShowForm(false);
    setPendingAction(null);
  }, []);

  return { showForm, pendingAction, triggerApproval, onSubmitted, onCancel };
}
