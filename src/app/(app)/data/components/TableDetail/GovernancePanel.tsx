"use client";

import React, { useCallback, useEffect, useState } from "react";

import GovernanceReviewCard from "@/components/governance/GovernanceReviewCard";
import { apiFetch } from "@/lib/api";

import type {
  GovernanceBlueprintLite,
  GovernanceSuggestionTaskLite,
  TableDetail,
} from "../shared/types";

interface Props {
  detail: TableDetail;
  onRefresh?: () => void;
}

export default function GovernancePanel({ detail, onRefresh }: Props) {
  const [blueprint, setBlueprint] = useState<GovernanceBlueprintLite | null>(null);
  const [suggestions, setSuggestions] = useState<GovernanceSuggestionTaskLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bp, subject] = await Promise.all([
        apiFetch<GovernanceBlueprintLite>("/knowledge-governance/blueprint"),
        apiFetch<{ subject: Record<string, unknown>; suggestions: GovernanceSuggestionTaskLite[] }>(
          `/knowledge-governance/subject?subject_type=business_table&subject_id=${detail.id}`,
        ),
      ]);
      setBlueprint(bp);
      setSuggestions(subject.suggestions || []);
    } finally {
      setLoading(false);
    }
  }, [detail.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-4 border-b border-gray-200 bg-[#FAFCFE]">
      <GovernanceReviewCard
        title="数据治理挂载"
        subjectType="business_table"
        subjectId={detail.id}
        subjectLabel={`数据表 #${detail.id}`}
        state={detail}
        blueprint={blueprint}
        suggestions={suggestions}
        loading={loading}
        actionLoading={actionLoading}
        onGenerate={() => {
          setActionLoading(true);
          return apiFetch(`/knowledge-governance/business-table/${detail.id}/suggest`, { method: "POST" })
            .then(load)
            .finally(() => setActionLoading(false));
        }}
        onApply={(objectiveId, resourceLibraryId, note) => {
          setActionLoading(true);
          return apiFetch("/knowledge-governance/apply", {
            method: "POST",
            body: JSON.stringify({
              subject_type: "business_table",
              subject_id: detail.id,
              objective_id: objectiveId,
              resource_library_id: resourceLibraryId,
              governance_status: "aligned",
              governance_note: note,
            }),
            })
            .then(async () => {
              await load();
              onRefresh?.();
            })
            .finally(() => setActionLoading(false));
        }}
        onBound={async () => {
          await load();
          onRefresh?.();
        }}
      />
    </div>
  );
}
