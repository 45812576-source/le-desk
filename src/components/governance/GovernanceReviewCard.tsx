"use client";

import React, { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

import type {
  GovernanceBlueprintLite,
  GovernanceObjectDetail,
  GovernanceObjectLite,
  GovernanceObjectiveLite,
  GovernanceResourceLibraryLite,
  GovernanceSuggestionTaskLite,
} from "@/app/(app)/data/components/shared/types";

type LibraryCluster = {
  label: string;
  codes: string[];
};

const LIBRARY_CLUSTERS: Record<string, LibraryCluster[]> = {
  company_common: [
    { label: "战略基线", codes: ["company_strategy", "company_metrics", "company_meeting_decisions"] },
    { label: "组织机制", codes: ["company_org_design", "company_policies"] },
    { label: "标准件", codes: ["company_sop", "company_templates"] },
  ],
  professional_capability: [
    { label: "通用能力", codes: ["general_capability", "general_toolkit"] },
    { label: "岗位胜任力", codes: ["role_capability", "role_assessment_rubric"] },
    { label: "岗位执行与案例", codes: ["role_sop_playbook", "role_case_repo", "role_interview_kit"] },
  ],
  outsource_intel: [
    { label: "行业认知", codes: ["industry_map", "industry_intel"] },
    { label: "平台与增长", codes: ["platform_watch", "creative_trends", "account_growth_playbook"] },
    { label: "竞争与风险", codes: ["competitor_watch", "signal_alerts"] },
  ],
  business_line_execution: [
    { label: "客户与资源", codes: ["biz_customer_repo", "biz_resource_repo"] },
    { label: "岗位与流程", codes: ["biz_role_setup", "biz_sop"] },
    { label: "交付与复盘", codes: ["biz_project_delivery", "biz_case_repo", "biz_external_signals"] },
  ],
};

type SubjectState = {
  governance_objective_id?: number | null;
  resource_library_id?: number | null;
  object_type_id?: number | null;
  governance_kr_id?: number | null;
  governance_element_id?: number | null;
  governance_object_id?: number | null;
  governance_status?: string | null;
  governance_note?: string | null;
  governance_confidence?: number | null;
};

interface Props {
  title?: string;
  subjectType?: string;
  subjectId?: number;
  subjectLabel: string;
  state: SubjectState;
  blueprint: GovernanceBlueprintLite | null;
  suggestions: GovernanceSuggestionTaskLite[];
  loading?: boolean;
  actionLoading?: boolean;
  onGenerate?: () => void;
  onApply?: (objectiveId: number | null, resourceLibraryId: number | null, note: string) => void;
  onBound?: () => void;
}

export default function GovernanceReviewCard({
  title = "治理挂载",
  subjectType,
  subjectId,
  subjectLabel,
  state,
  blueprint,
  suggestions,
  loading,
  actionLoading,
  onGenerate,
  onApply,
  onBound,
}: Props) {
  const objectives = blueprint?.objectives || [];
  const libraries = blueprint?.resource_libraries || [];
  const fieldTemplates = blueprint?.field_templates || [];
  const krs = blueprint?.krs || [];
  const requiredElements = blueprint?.required_elements || [];
  const objectTypes = blueprint?.object_types || [];
  const currentObjective = objectives.find((item) => item.id === state.governance_objective_id) || null;
  const currentLibrary = libraries.find((item) => item.id === state.resource_library_id) || null;
  const currentObjectType = objectTypes.find((item) => item.id === state.object_type_id) || null;
  const currentKr = krs.find((item) => item.id === state.governance_kr_id) || null;
  const currentElement = requiredElements.find((item) => item.id === state.governance_element_id) || null;
  const pendingSuggestion = useMemo(
    () => suggestions.find((item) => item.status === "pending") || null,
    [suggestions],
  );
  const suggestedObjective = objectives.find((item) => item.id === pendingSuggestion?.objective_id) || null;
  const suggestedLibrary = libraries.find((item) => item.id === pendingSuggestion?.resource_library_id) || null;

  const roots = ["company_common", "professional_capability", "outsource_intel", "business_line_execution"];
  const objectCandidates = useMemo(() => [] as GovernanceObjectLite[], []);

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded bg-[#F8FCFF]">
      <div
        className="px-3 py-2 border-b border-gray-200 flex items-center gap-2 cursor-pointer select-none hover:bg-[#EAF7FF] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#0077B6]">{title}</span>
        <span className="text-[8px] text-gray-400">{subjectLabel}</span>
        <span className={`ml-auto px-1.5 py-0.5 rounded text-[8px] font-bold ${
          state.governance_status === "aligned"
            ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
            : state.governance_status === "suggested"
              ? "bg-amber-50 text-amber-600 border border-amber-200"
              : "bg-gray-100 text-gray-500"
        }`}>
          {state.governance_status || "ungoverned"}
        </span>
        <span className="text-[8px] text-gray-400 ml-1">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && <div className="p-3 space-y-3">
        <div className="flex flex-wrap gap-2 text-[9px]">
          <span className="px-2 py-1 rounded border border-sky-200 bg-sky-50 text-sky-700">
            当前目标: {currentObjective?.name || "未挂载"}
          </span>
          <span className="px-2 py-1 rounded border border-slate-200 bg-white text-slate-600">
            当前资源库: {currentLibrary?.name || "未挂载"}
          </span>
          <span className="px-2 py-1 rounded border border-violet-200 bg-violet-50 text-violet-700">
            对象类型: {currentObjectType?.name || "未挂载"}
          </span>
          <span className="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
            KR: {currentKr?.name || "未挂载"}
          </span>
          <span className="px-2 py-1 rounded border border-orange-200 bg-orange-50 text-orange-700">
            要素: {currentElement?.name || "未挂载"}
          </span>
          {state.governance_confidence != null && (
            <span className="px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700">
              置信度: {(state.governance_confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>

        {state.governance_note && (
          <div className="text-[10px] text-gray-600 border border-gray-100 bg-white rounded px-3 py-2">
            {state.governance_note}
          </div>
        )}

        {pendingSuggestion && (
          <div className="border border-amber-200 bg-amber-50 rounded px-3 py-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-medium text-amber-700">
                建议挂载到 {suggestedObjective?.name || "未知目标"} / {suggestedLibrary?.name || "未知资源库"}
              </div>
              <span className="text-[9px] text-amber-600">{pendingSuggestion.confidence || 0}%</span>
            </div>
            {pendingSuggestion.reason && (
              <div className="text-[9px] text-amber-700">{pendingSuggestion.reason}</div>
            )}
            {pendingSuggestion.suggested_payload && (
              <div className="text-[8px] text-amber-800 space-y-1">
                {"kr_name" in pendingSuggestion.suggested_payload && (
                  <div>建议 KR: {String(pendingSuggestion.suggested_payload.kr_name || "-")}</div>
                )}
                {"element_name" in pendingSuggestion.suggested_payload && (
                  <div>建议要素: {String(pendingSuggestion.suggested_payload.element_name || "-")}</div>
                )}
                {Array.isArray(pendingSuggestion.suggested_payload.missing_fields) && (
                  <div>字段缺口: {(pendingSuggestion.suggested_payload.missing_fields as string[]).join("、") || "无"}</div>
                )}
              </div>
            )}
            {onApply && (
              <button
                disabled={actionLoading}
                onClick={() => onApply(pendingSuggestion.objective_id || null, pendingSuggestion.resource_library_id || null, pendingSuggestion.reason || "采纳治理建议")}
                className="px-2 py-1 text-[9px] font-bold border border-emerald-300 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
              >
                采纳建议
              </button>
            )}
          </div>
        )}

        {onGenerate && (
          <div className="flex items-center gap-2">
            <button
              disabled={actionLoading || loading}
              onClick={onGenerate}
              className="px-2 py-1 text-[9px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-[#EAF7FF] disabled:opacity-50"
            >
              {actionLoading ? "处理中..." : "生成治理建议"}
            </button>
            <span className="text-[8px] text-gray-400">按标题、描述、内容和旧分类结果生成建议</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {roots.map((rootCode) => {
            const objective = objectives.find((item) => item.code === rootCode) || null;
            const relatedLibraries = libraries.filter((item) => item.objective_id === objective?.id);
            return (
              <BlueprintColumn
                key={rootCode}
                objective={objective}
                libraries={relatedLibraries}
              />
            );
          })}
        </div>

        {currentObjectType && (
          <div className="border border-gray-200 rounded bg-white px-3 py-2">
            <div className="text-[10px] font-semibold text-gray-700 mb-2">字段模板</div>
            <div className="space-y-1">
              {fieldTemplates
                .filter((item) => item.object_type_id === currentObjectType.id)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 text-[8px] border border-gray-100 rounded px-2 py-1">
                    <span className="text-gray-700">{item.field_label}</span>
                    <span className="text-gray-400">{item.field_type}</span>
                    <span className={`${item.is_required ? "text-red-500" : "text-gray-300"}`}>{item.is_required ? "必填" : "可选"}</span>
                    <span className="text-gray-400">{item.update_cycle || "-"}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {subjectType && subjectId && currentObjectType && (
          <ObjectBindingPanel
            subjectType={subjectType}
            subjectId={subjectId}
            currentObjectTypeCode={currentObjectType.code}
            currentObjectId={state.governance_object_id || null}
            defaultName={subjectLabel}
            onBound={onBound}
          />
        )}
      </div>}
    </div>
  );
}

function BlueprintColumn({
  objective,
  libraries,
}: {
  objective: GovernanceObjectiveLite | null;
  libraries: GovernanceResourceLibraryLite[];
}) {
  const clusters = LIBRARY_CLUSTERS[objective?.code || ""] || [];
  const ungrouped = libraries.filter(
    (library) => !clusters.some((cluster) => cluster.codes.includes(library.code)),
  );

  return (
    <div className="border border-gray-200 rounded bg-white px-3 py-2">
      <div className="text-[10px] font-semibold text-gray-700">{objective?.name || "未初始化"}</div>
      <div className="text-[8px] text-gray-400 mt-0.5">{objective?.description || "暂无描述"}</div>
      <div className="mt-2 space-y-2">
        {libraries.length === 0 && <div className="text-[8px] text-gray-300">暂无资源库</div>}
        {clusters.map((cluster) => {
          const items = cluster.codes
            .map((code) => libraries.find((library) => library.code === code) || null)
            .filter((library): library is GovernanceResourceLibraryLite => Boolean(library));
          if (items.length === 0) return null;
          return (
            <div key={cluster.label} className="border border-gray-100 rounded px-2 py-2 bg-[#FAFCFE]">
              <div className="text-[8px] font-bold uppercase tracking-widest text-gray-500">{cluster.label}</div>
              <div className="mt-1 space-y-1">
                {items.map((library) => (
                  <div key={library.id} className="flex items-center justify-between gap-2 text-[8px] border border-gray-100 rounded px-2 py-1 bg-white">
                    <span className="text-gray-600 truncate">{library.name}</span>
                    <span className="text-gray-400">{library.default_update_cycle || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {ungrouped.length > 0 && (
          <div className="border border-dashed border-gray-200 rounded px-2 py-2 bg-white">
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">待归组</div>
            <div className="mt-1 space-y-1">
              {ungrouped.map((library) => (
                <div key={library.id} className="flex items-center justify-between gap-2 text-[8px] border border-gray-100 rounded px-2 py-1">
                  <span className="text-gray-600 truncate">{library.name}</span>
                  <span className="text-gray-400">{library.default_update_cycle || "-"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ObjectBindingPanel({
  subjectType,
  subjectId,
  currentObjectTypeCode,
  currentObjectId,
  defaultName,
  onBound,
}: {
  subjectType: string;
  subjectId: number;
  currentObjectTypeCode: string;
  currentObjectId: number | null;
  defaultName: string;
  onBound?: () => void;
}) {
  const [search, setSearch] = React.useState("");
  const [items, setItems] = React.useState<GovernanceObjectLite[]>([]);
  const [detail, setDetail] = React.useState<GovernanceObjectDetail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  async function load(query = "") {
    setLoading(true);
    try {
      const data = await apiFetch<GovernanceObjectLite[]>(
        `/knowledge-governance/objects?object_type_code=${encodeURIComponent(currentObjectTypeCode)}${query ? `&q=${encodeURIComponent(query)}` : ""}`,
      );
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { void load(); }, [currentObjectTypeCode]);
  React.useEffect(() => {
    if (!currentObjectId) {
      setDetail(null);
      return;
    }
    void apiFetch<GovernanceObjectDetail>(`/knowledge-governance/objects/${currentObjectId}`)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [currentObjectId]);

  return (
    <div className="border border-gray-200 rounded bg-white px-3 py-2 space-y-2">
      <div className="text-[10px] font-semibold text-gray-700">对象绑定</div>
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索已有对象"
          className="flex-1 text-[10px] border border-gray-300 px-2 py-1 focus:outline-none focus:border-[#00D1FF]"
        />
        <button
          onClick={() => void load(search)}
          className="px-2 py-1 text-[8px] font-bold border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          搜索
        </button>
        <button
          disabled={creating}
          onClick={async () => {
            setCreating(true);
            try {
              const created = await apiFetch<GovernanceObjectLite>("/knowledge-governance/objects", {
                method: "POST",
                body: JSON.stringify({
                  object_type_code: currentObjectTypeCode,
                  canonical_key: `${currentObjectTypeCode}:${Date.now()}`,
                  display_name: defaultName.replace(/^.*#\d+\s*/, "") || defaultName,
                }),
              });
              await apiFetch("/knowledge-governance/bind-object", {
                method: "POST",
                body: JSON.stringify({
                  subject_type: subjectType,
                  subject_id: subjectId,
                  governance_object_id: created.id,
                }),
              });
              await load(search);
              onBound?.();
            } finally {
              setCreating(false);
            }
          }}
          className="px-2 py-1 text-[8px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-[#EAF7FF] disabled:opacity-50"
        >
          {creating ? "创建中..." : "新建并绑定"}
        </button>
      </div>
      <div className="space-y-1 max-h-36 overflow-y-auto">
        {loading && <div className="text-[8px] text-gray-400">加载中...</div>}
        {!loading && items.length === 0 && <div className="text-[8px] text-gray-300">暂无对象候选</div>}
        {items.map((item) => (
          <div key={item.id} className={`flex items-center gap-2 text-[8px] border rounded px-2 py-1 ${currentObjectId === item.id ? "border-emerald-300 bg-emerald-50" : "border-gray-100"}`}>
            <span className="text-gray-700 flex-1 truncate">{item.display_name}</span>
            {item.matched_business_line && (
              <span className="px-1 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-600">同业务线</span>
            )}
            {typeof item.feedback_score === "number" && (
              <span className="text-violet-600">反馈 {item.feedback_score}</span>
            )}
            {typeof item.score === "number" && (
              <span className="text-gray-400">分数 {item.score}</span>
            )}
            <span className="text-gray-400">{item.lifecycle_status}</span>
            <button
              onClick={async () => {
                await apiFetch("/knowledge-governance/bind-object", {
                  method: "POST",
                  body: JSON.stringify({
                    subject_type: subjectType,
                    subject_id: subjectId,
                    governance_object_id: item.id,
                  }),
                });
                onBound?.();
              }}
              className="px-2 py-0.5 text-[8px] font-bold border border-emerald-300 text-emerald-600 hover:bg-emerald-50"
            >
              {currentObjectId === item.id ? "已绑定" : "绑定"}
            </button>
          </div>
        ))}
      </div>

      {detail && (
        <div className="border border-gray-100 rounded bg-[#FAFCFE] px-2 py-2 space-y-1">
          <div className="text-[9px] font-semibold text-gray-700">当前对象视图</div>
          <div className="text-[8px] text-gray-500">{detail.display_name} · {detail.canonical_key}</div>
          {detail.facets.length === 0 && <div className="text-[8px] text-gray-300">暂无 facet</div>}
          {detail.facets.map((facet) => (
            <div key={facet.id} className="text-[8px] border border-gray-100 rounded px-2 py-1 bg-white">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700">{facet.facet_name}</span>
                <span className="text-gray-400">{facet.update_cycle || "-"}</span>
              </div>
              <div className="text-gray-400 mt-0.5">
                {facet.source_subjects.map((item) => `${item.type}#${item.id}`).join(" / ") || "无来源"}
              </div>
            </div>
          ))}

          {detail.collaboration_baseline && (
            <div className="mt-2 border border-gray-100 rounded px-2 py-2 bg-white space-y-1">
              <div className="text-[9px] font-semibold text-gray-700">协同基线</div>
              <div className="grid grid-cols-2 gap-2 text-[8px]">
                <BaselineBucket
                  title="知识文档"
                  items={detail.collaboration_baseline.knowledge_entries.map((item) => item.title)}
                />
                <BaselineBucket
                  title="数据表"
                  items={detail.collaboration_baseline.business_tables.map((item) => item.display_name)}
                />
                <BaselineBucket
                  title="项目"
                  items={detail.collaboration_baseline.projects.map((item) => item.name)}
                />
                <BaselineBucket
                  title="任务"
                  items={detail.collaboration_baseline.tasks.map((item) => item.title)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="border border-gray-100 rounded bg-[#FFFDF5] px-2 py-2">
          <div className="text-[9px] font-semibold text-amber-700 mb-1">对象候选</div>
          <div className="space-y-1">
            {items.slice(0, 3).map((item) => (
              <div key={`candidate-${item.id}`} className="text-[8px] flex items-center justify-between gap-2">
                <span className="text-gray-700 truncate">{item.display_name}</span>
                <span className="text-gray-400">{item.business_line || "-"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BaselineBucket({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-gray-100 rounded px-2 py-1">
      <div className="text-gray-500 mb-1">{title}</div>
      {items.length === 0 && <div className="text-gray-300">暂无</div>}
      {items.slice(0, 3).map((item, idx) => (
        <div key={`${title}-${idx}`} className="text-gray-700 truncate">{item}</div>
      ))}
      {items.length > 3 && <div className="text-gray-300">+{items.length - 3}</div>}
    </div>
  );
}
