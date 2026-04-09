"use client";

import { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { KnowledgePermissionGrantDetail } from "@/lib/types";
import {
  KNOWLEDGE_ACTION_LABELS,
  SOURCE_LABELS,
  SOURCE_COLORS,
  HIGH_RISK_ACTIONS,
} from "../../constants";
import { GrantDialog } from "./GrantDialog";

interface CapabilityListProps {
  userId: number;
  title: string;
  grants: KnowledgePermissionGrantDetail[];
  mode: "review" | "publish";
  onRefresh: () => void;
}

export function CapabilityList({ userId, title, grants, mode, onRefresh }: CapabilityListProps) {
  const [showDialog, setShowDialog] = useState(false);

  async function handleRevoke(grantId: number) {
    if (!confirm("确认回收此审批资格？")) return;
    try {
      await apiFetch(`/admin/users/${userId}/knowledge-permissions/${grantId}`, {
        method: "DELETE",
      });
      onRefresh();
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground">
          {title}
        </span>
        <PixelButton size="sm" variant="secondary" onClick={() => setShowDialog(true)}>
          + 授予资格
        </PixelButton>
      </div>

      {grants.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">暂无此类审批资格</p>
      ) : (
        <table className="w-full border-2 border-border text-xs font-mono">
          <thead>
            <tr className="bg-muted">
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-border">
                审批动作
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-border w-20">
                来源
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-border w-16">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id} className="border-b border-border hover:bg-muted">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      {KNOWLEDGE_ACTION_LABELS[g.action] || g.action}
                    </span>
                    {HIGH_RISK_ACTIONS.has(g.action) && (
                      <PixelBadge color="red">终审</PixelBadge>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] font-bold ${SOURCE_COLORS[g.source] || ""}`}>
                    {SOURCE_LABELS[g.source] || g.source}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <PixelButton size="sm" variant="danger" onClick={() => handleRevoke(g.id)}>
                    回收
                  </PixelButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showDialog && (
        <GrantDialog
          userId={userId}
          mode={mode}
          onClose={() => setShowDialog(false)}
          onGranted={() => {
            setShowDialog(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
