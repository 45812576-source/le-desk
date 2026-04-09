"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { apiFetch } from "@/lib/api";
import type { OrgBaselineVersion, OrgChangeImpactItem } from "@/lib/types";

/* ── 状态 badge ──────────────────────────────────────────────────── */
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "草稿", cls: "bg-gray-100 text-gray-600" },
  candidate: { label: "候选", cls: "bg-blue-100 text-blue-700" },
  active: { label: "生效中", cls: "bg-green-100 text-green-700" },
  archived: { label: "已归档", cls: "bg-gray-100 text-gray-400 line-through" },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

const VERSION_TYPE_MAP: Record<string, string> = {
  init: "初始化",
  incremental: "增量",
  major: "重大变更",
};

const SEVERITY_MAP: Record<string, { label: string; cls: string }> = {
  high: { label: "高", cls: "bg-red-100 text-red-700" },
  medium: { label: "中", cls: "bg-yellow-100 text-yellow-700" },
  low: { label: "低", cls: "bg-green-100 text-green-700" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const info = SEVERITY_MAP[severity] ?? { label: severity, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

/* ── 展开行详情 ──────────────────────────────────────────────────── */
function ExpandedDetail({
  baseline,
  impacts,
  loadingImpacts,
}: {
  baseline: OrgBaselineVersion;
  impacts: OrgChangeImpactItem[] | null;
  loadingImpacts: boolean;
}) {
  const { snapshot_summary, diff_from_previous, impact_analysis } = baseline;

  return (
    <div className="space-y-4 bg-gray-50 px-6 py-4 text-sm">
      {/* 快照摘要 */}
      {snapshot_summary && Object.keys(snapshot_summary).length > 0 && (
        <div>
          <h4 className="mb-2 font-medium text-gray-700">快照摘要</h4>
          <table className="w-full max-w-md text-sm">
            <tbody>
              {Object.entries(snapshot_summary).map(([key, val]) => (
                <tr key={key} className="border-b border-gray-200 last:border-0">
                  <td className="py-1 pr-4 text-gray-500">{key}</td>
                  <td className="py-1 font-mono">{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 变更列表 */}
      {diff_from_previous && diff_from_previous.length > 0 && (
        <div>
          <h4 className="mb-2 font-medium text-gray-700">
            变更明细（{diff_from_previous.length} 条）
          </h4>
          <ul className="space-y-1">
            {diff_from_previous.map((d, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                  {d.change_type}
                </span>
                <span className="text-gray-500">{d.entity_type} #{d.entity_id}</span>
                <span className="text-gray-700">{d.summary}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 影响面分析 */}
      {impact_analysis && Object.keys(impact_analysis).length > 0 && (
        <div>
          <h4 className="mb-2 font-medium text-gray-700">影响面分析</h4>
          <div className="flex flex-wrap gap-4">
            {impact_analysis.affected_resource_libraries != null && (
              <span className="text-gray-600">
                资源库: <span className="font-semibold">{impact_analysis.affected_resource_libraries}</span>
              </span>
            )}
            {impact_analysis.affected_policies != null && (
              <span className="text-gray-600">
                策略: <span className="font-semibold">{impact_analysis.affected_policies}</span>
              </span>
            )}
            {impact_analysis.affected_rules != null && (
              <span className="text-gray-600">
                规则: <span className="font-semibold">{impact_analysis.affected_rules}</span>
              </span>
            )}
            {impact_analysis.affected_missions != null && (
              <span className="text-gray-600">
                任务: <span className="font-semibold">{impact_analysis.affected_missions}</span>
              </span>
            )}
            {impact_analysis.total_changes != null && (
              <span className="text-gray-600">
                总变更: <span className="font-semibold">{impact_analysis.total_changes}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* 影响项列表 */}
      {loadingImpacts && (
        <div className="text-gray-400">加载影响项…</div>
      )}
      {impacts && impacts.length > 0 && (
        <div>
          <h4 className="mb-2 font-medium text-gray-700">影响项</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-1 pr-2 font-medium">类型</th>
                <th className="pb-1 pr-2 font-medium">目标</th>
                <th className="pb-1 pr-2 font-medium">严重度</th>
                <th className="pb-1 pr-2 font-medium">描述</th>
                <th className="pb-1 font-medium">已解决</th>
              </tr>
            </thead>
            <tbody>
              {impacts.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-1.5 pr-2 text-gray-600">{item.impact_type}</td>
                  <td className="py-1.5 pr-2 text-gray-600">
                    {item.target_name ?? `${item.target_type} #${item.target_id}`}
                  </td>
                  <td className="py-1.5 pr-2">
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td className="py-1.5 pr-2 text-gray-700">{item.description ?? "—"}</td>
                  <td className="py-1.5">
                    {item.resolved ? (
                      <span className="text-green-600">是</span>
                    ) : (
                      <span className="text-red-500">否</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── 主组件 ──────────────────────────────────────────────────────── */
export default function BaselineVersionTab() {
  const [baselines, setBaselines] = useState<OrgBaselineVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, OrgBaselineVersion>>({});
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);

  /* 创建候选版本 */
  const [showCreate, setShowCreate] = useState(false);
  const [createNote, setCreateNote] = useState("");
  const [creating, setCreating] = useState(false);

  /* 激活中 */
  const [activating, setActivating] = useState<number | null>(null);

  /* 加载列表 */
  const fetchBaselines = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<OrgBaselineVersion[]>("/api/org-management/baselines");
      setBaselines(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBaselines();
  }, [fetchBaselines]);

  /* 展开行 — 获取详情（含 impacts） */
  const handleToggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detailCache[id]) {
      setLoadingDetail(id);
      try {
        const detail = await apiFetch<OrgBaselineVersion>(
          `/api/org-management/baselines/${id}`,
        );
        setDetailCache((prev) => ({ ...prev, [id]: detail }));
      } finally {
        setLoadingDetail(null);
      }
    }
  };

  /* 创建候选版本 */
  const handleCreate = async () => {
    setCreating(true);
    try {
      await apiFetch("/api/org-management/baselines/create-candidate", {
        method: "POST",
        body: JSON.stringify({ note: createNote }),
      });
      setCreateNote("");
      setShowCreate(false);
      await fetchBaselines();
    } finally {
      setCreating(false);
    }
  };

  /* 激活 */
  const handleActivate = async (id: number) => {
    setActivating(id);
    try {
      await apiFetch(`/api/org-management/baselines/${id}/activate`, {
        method: "POST",
      });
      await fetchBaselines();
    } finally {
      setActivating(null);
    }
  };

  /* 影响面简述 */
  const impactSummary = (b: OrgBaselineVersion) => {
    const ia = b.impact_analysis;
    if (!ia) return "—";
    const parts: string[] = [];
    if (ia.affected_resource_libraries) parts.push(`资源库 ${ia.affected_resource_libraries}`);
    if (ia.affected_policies) parts.push(`策略 ${ia.affected_policies}`);
    if (ia.affected_rules) parts.push(`规则 ${ia.affected_rules}`);
    if (ia.affected_missions) parts.push(`任务 ${ia.affected_missions}`);
    return parts.length > 0 ? parts.join("、") : "—";
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center gap-3">
        {showCreate ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="rounded border border-gray-300 px-3 py-1.5 text-sm"
              placeholder="版本备注（可选）"
              value={createNote}
              onChange={(e) => setCreateNote(e.target.value)}
            />
            <button
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={creating}
              onClick={handleCreate}
            >
              {creating ? "创建中…" : "确认创建"}
            </button>
            <button
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => {
                setShowCreate(false);
                setCreateNote("");
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            onClick={() => setShowCreate(true)}
          >
            创建候选版本
          </button>
        )}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">加载中…</div>
      ) : baselines.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">暂无基线版本</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-2 pr-3 font-medium">版本号</th>
                <th className="pb-2 pr-3 font-medium">类型</th>
                <th className="pb-2 pr-3 font-medium">状态</th>
                <th className="pb-2 pr-3 font-medium">变更数</th>
                <th className="pb-2 pr-3 font-medium">影响面</th>
                <th className="pb-2 pr-3 font-medium">创建时间</th>
                <th className="pb-2 pr-3 font-medium">激活时间</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {baselines.map((b) => {
                const isExpanded = expandedId === b.id;
                const detail = detailCache[b.id] ?? b;
                return (
                  <Fragment key={b.id}>
                    <tr
                      className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                        isExpanded ? "bg-gray-50" : ""
                      }`}
                      onClick={() => handleToggleExpand(b.id)}
                    >
                      <td className="py-2.5 pr-3 font-mono font-semibold">{b.version}</td>
                      <td className="py-2.5 pr-3 text-gray-600">
                        {VERSION_TYPE_MAP[b.version_type] ?? b.version_type}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="py-2.5 pr-3 font-mono">
                        {b.diff_from_previous?.length ?? 0}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600 max-w-[200px] truncate">
                        {impactSummary(b)}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 font-mono text-xs">
                        {b.created_at
                          ? new Date(b.created_at).toLocaleString("zh-CN")
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-gray-500 font-mono text-xs">
                        {b.activated_at
                          ? new Date(b.activated_at).toLocaleString("zh-CN")
                          : "—"}
                      </td>
                      <td className="py-2.5">
                        {b.status === "candidate" && (
                          <button
                            className="rounded bg-green-600 px-2.5 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                            disabled={activating === b.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivate(b.id);
                            }}
                          >
                            {activating === b.id ? "激活中…" : "激活"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8}>
                          <ExpandedDetail
                            baseline={detail}
                            impacts={detail.impacts ?? null}
                            loadingImpacts={loadingDetail === b.id}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
