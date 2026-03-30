"use client";

import { AlertTriangle, Info } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import type { SkillPersistentNotice } from "@/lib/types";

interface PersistentNoticesProps {
  notices: SkillPersistentNotice[];
  onStartTask: (taskId: string) => void;
  onDirectTest: () => void;
}

const NOTICE_TYPE_ICON: Record<string, typeof AlertTriangle> = {
  missing_structure: AlertTriangle,
  test_failure: AlertTriangle,
  feedback_followup: Info,
};

const NOTICE_TYPE_COLOR: Record<string, { border: string; bg: string; text: string; borderInner: string }> = {
  missing_structure: { border: "border-[#ED8936]", bg: "bg-[#FFFAF0]", text: "text-[#C05621]", borderInner: "border-[#FEEBC8]" },
  test_failure:      { border: "border-[#FC8181]", bg: "bg-[#FFF5F5]", text: "text-[#C53030]", borderInner: "border-[#FED7D7]" },
  feedback_followup: { border: "border-[#90CDF4]", bg: "bg-[#EBF8FF]", text: "text-[#2B6CB0]", borderInner: "border-[#BEE3F8]" },
};

export function PersistentNotices({ notices, onStartTask, onDirectTest }: PersistentNoticesProps) {
  const activeNotices = notices.filter((n) => n.status === "active");
  if (activeNotices.length === 0) return null;

  return (
    <div className="mx-3 my-2 space-y-2 flex-shrink-0">
      {activeNotices.map((notice) => {
        const colors = NOTICE_TYPE_COLOR[notice.type] || NOTICE_TYPE_COLOR.missing_structure;
        const Icon = NOTICE_TYPE_ICON[notice.type] || AlertTriangle;
        const firstTaskId = notice.related_task_ids[0];

        return (
          <div key={notice.id} className={`border-2 ${colors.border} ${colors.bg}`}>
            <div className={`px-3 py-2 border-b ${colors.borderInner} flex items-start gap-2`}>
              <Icon size={12} className={`${colors.text} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className={`text-[9px] font-bold uppercase tracking-widest ${colors.text}`}>
                  {notice.title}
                </div>
                <div className="text-[9px] text-gray-600 mt-0.5 leading-relaxed">
                  {notice.message}
                </div>
              </div>
            </div>
            <div className={`px-3 py-1.5 border-t ${colors.borderInner} flex gap-2`}>
              {firstTaskId && (
                <PixelButton size="sm" onClick={() => onStartTask(firstTaskId)}>
                  开始完善
                </PixelButton>
              )}
              <PixelButton size="sm" variant="secondary" onClick={onDirectTest}>
                直接测试
              </PixelButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}
