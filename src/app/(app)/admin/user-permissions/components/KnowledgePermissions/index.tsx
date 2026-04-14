"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { KnowledgePermissionGrantDetail } from "@/lib/types";
import { SectionHeader } from "../SectionHeader";
import { CapabilityList } from "./CapabilityList";
import { REVIEW_ACTIONS, PUBLISH_ACTIONS } from "../../constants";

const REVIEW_ACTION_SET = new Set<string>(REVIEW_ACTIONS);
const PUBLISH_ACTION_SET = new Set<string>(PUBLISH_ACTIONS);

interface ApprovalCapabilitiesSectionProps {
  userId: number;
}

export function ApprovalCapabilitiesSection({ userId }: ApprovalCapabilitiesSectionProps) {
  const [grants, setGrants] = useState<KnowledgePermissionGrantDetail[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGrants = useCallback(() => {
    setLoading(true);
    apiFetch<KnowledgePermissionGrantDetail[]>(`/admin/users/${userId}/knowledge-permissions`)
      .then((all) => {
        // 只保留 approval_capability 类型
        setGrants(all.filter((g) => g.resource_type === "approval_capability"));
      })
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchGrants();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchGrants]);

  const reviewGrants = grants.filter((g) => REVIEW_ACTION_SET.has(g.action));
  const publishGrants = grants.filter((g) => PUBLISH_ACTION_SET.has(g.action));

  return (
    <div className="bg-card border-2 border-border">
      <SectionHeader
        title="③ 审批体系资格"
        subtitle="内容审批资格、发布审批资格"
      />
      <div className="p-4 flex flex-col gap-6">
        {loading ? (
          <p className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse">
            加载中…
          </p>
        ) : (
          <>
            <CapabilityList
              userId={userId}
              title="内容审批资格"
              grants={reviewGrants}
              mode="review"
              onRefresh={fetchGrants}
            />
            <div className="border-t border-border" />
            <CapabilityList
              userId={userId}
              title="发布审批资格"
              grants={publishGrants}
              mode="publish"
              onRefresh={fetchGrants}
            />
          </>
        )}
      </div>
    </div>
  );
}
