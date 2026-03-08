"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { WorkspaceEntry } from "@/lib/types";

const STATUS_COLOR: Record<string, "cyan" | "green" | "yellow" | "gray"> = {
  draft: "gray",
  reviewing: "yellow",
  published: "green",
};

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(() => {
    setLoading(true);
    apiFetch<WorkspaceEntry[]>("/workspaces")
      .then(setWorkspaces)
      .catch(() => setWorkspaces([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  async function handleReview(id: number, action: "approve" | "reject") {
    try {
      await apiFetch(`/workspaces/${id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      fetchWorkspaces();
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除？")) return;
    try {
      await apiFetch(`/workspaces/${id}`, { method: "DELETE" });
      fetchWorkspaces();
    } catch {
      // ignore
    }
  }

  return (
    <PageShell title="工作台管理" icon={ICONS.workspaceAdmin}>
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无工作台
        </div>
      ) : (
        <div className="space-y-2">
          {workspaces.map((ws) => (
            <div key={ws.id} className="bg-white border-2 border-[#1A202C] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 border-2 border-[#1A202C] flex items-center justify-center text-[10px]"
                    style={{ backgroundColor: ws.color }}
                  >
                    {ws.icon.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-bold">{ws.name}</span>
                  <PixelBadge color={STATUS_COLOR[ws.status] || "gray"}>
                    {ws.status}
                  </PixelBadge>
                  <PixelBadge color="cyan">{ws.category}</PixelBadge>
                  <PixelBadge color="purple">{ws.visibility}</PixelBadge>
                </div>
                <div className="flex gap-1">
                  {ws.status === "reviewing" && (
                    <>
                      <PixelButton size="sm" onClick={() => handleReview(ws.id, "approve")}>
                        通过
                      </PixelButton>
                      <PixelButton size="sm" variant="danger" onClick={() => handleReview(ws.id, "reject")}>
                        拒绝
                      </PixelButton>
                    </>
                  )}
                  <PixelButton size="sm" variant="danger" onClick={() => handleDelete(ws.id)}>
                    删除
                  </PixelButton>
                </div>
              </div>
              {ws.description && (
                <p className="text-[10px] text-gray-500 mt-1">{ws.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
