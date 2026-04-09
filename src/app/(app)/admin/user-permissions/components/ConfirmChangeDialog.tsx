"use client";

import { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";

interface ConfirmChangeDialogProps {
  title: string;
  message: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function ConfirmChangeDialog({
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmChangeDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border-2 border-border w-[440px] max-w-[90vw]">
        <div className="bg-amber-50 border-b-2 border-border px-4 py-3">
          <div className="text-xs font-bold text-amber-800">{title}</div>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">{message}</p>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] block mb-1">
              变更原因（必填）
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full border-2 border-border bg-background text-foreground px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00D1FF] resize-none"
              placeholder="请说明为什么需要此权限变更…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <PixelButton variant="secondary" size="sm" onClick={onCancel}>
              取消
            </PixelButton>
            <PixelButton size="sm" onClick={() => onConfirm(reason)} disabled={!reason.trim()}>
              提交审批
            </PixelButton>
          </div>
        </div>
      </div>
    </div>
  );
}
