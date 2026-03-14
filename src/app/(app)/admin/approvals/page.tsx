"use client";

import { useCallback, useEffect, useState } from "react";
import React from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";

interface ApprovalAction {
  id: number;
  actor_id: number;
  actor_name: string | null;
  action: string;
  comment: string | null;
  created_at: string;
}

interface ApprovalItem {
  id: number;
  request_type: string;
  target_id: number | null;
  target_type: string | null;
  requester_id: number;
  requester_name: string | null;
  status: string;
  conditions: string[];
  created_at: string;
  actions: ApprovalAction[];
}

interface ApprovalResponse {
  total: number;
  page: number;
  page_size: number;
  items: ApprovalItem[];
}

const STATUS_COLOR: Record<string, "green" | "yellow" | "red" | "cyan"> = {
  pending: "yellow",
  approved: "green",
  rejected: "red",
  conditions: "cyan",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "待审批",
  approved: "已通过",
  rejected: "已拒绝",
  conditions: "附条件",
};
const TYPE_LABEL: Record<string, string> = {
  skill_publish: "Skill发布",
  scope_change: "权限变更",
  mask_override: "脱敏覆盖",
  schema_approval: "Schema审批",
};

export default function AdminApprovalsPage() {
  const [data, setData] = useState<ApprovalResponse>({ total: 0, page: 1, page_size: 20, items: [] });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [conditions, setConditions] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    apiFetch<ApprovalResponse>(`/approvals?${params}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, statusFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function act(requestId: number, action: string) {
    try {
      const body: Record<string, unknown> = { action, comment: comment || null };
      if (action === "add_conditions" && conditions) {
        body.conditions = conditions.split("\n").filter(Boolean);
      }
      await apiFetch(`/approvals/${requestId}/actions`, { method: "POST", body: JSON.stringify(body) });
      setActing(null);
      setComment("");
      setConditions("");
      fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <PageShell title="审批管理" icon={ICONS.approvals}>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {["", "pending", "approved", "rejected", "conditions"].map((s) => (
            <PixelButton
              key={s}
              size="sm"
              variant={statusFilter === s ? "primary" : "secondary"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
            >
              {s ? STATUS_LABEL[s] : "全部"}
            </PixelButton>
          ))}
        </div>
        <PixelSelect
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="w-auto"
        >
          <option value="">全部类型</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </PixelSelect>
        <span className="text-[10px] text-gray-400 font-bold ml-auto">共 {data.total} 条</span>
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div>
      ) : (
        <>
          <table className="w-full border-2 border-[#1A202C]">
            <thead>
              <tr className="bg-[#EBF4F7]">
                {["ID", "类型", "申请人", "目标", "状态", "时间", "操作"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <React.Fragment key={item.id}>
                  <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-400">{item.id}</td>
                    <td className="px-3 py-2">
                      <PixelBadge color="cyan">{TYPE_LABEL[item.request_type] || item.request_type}</PixelBadge>
                    </td>
                    <td className="px-3 py-2 text-xs">{item.requester_name || `#${item.requester_id}`}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {item.target_type ? `${item.target_type} #${item.target_id}` : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <PixelBadge color={STATUS_COLOR[item.status] || "cyan"}>
                        {STATUS_LABEL[item.status] || item.status}
                      </PixelBadge>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-gray-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-3 py-2 flex gap-1">
                      <button
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="text-[10px] font-bold text-[#00A3C4] hover:underline"
                      >
                        {expandedId === item.id ? "收起" : "详情"}
                      </button>
                      {item.status === "pending" && (
                        <button
                          onClick={() => setActing(acting === item.id ? null : item.id)}
                          className="text-[10px] font-bold text-[#B7791F] hover:underline ml-2"
                        >
                          {acting === item.id ? "取消" : "审批"}
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {expandedId === item.id && (
                    <tr key={`${item.id}-detail`}>
                      <td colSpan={7} className="px-4 py-3 bg-gray-50 border-b-2 border-[#1A202C]">
                        {item.conditions.length > 0 && (
                          <div className="mb-2">
                            <span className="text-[9px] font-bold uppercase text-[#B7791F]">附加条件</span>
                            <ul className="mt-1 space-y-0.5">
                              {item.conditions.map((c, i) => (
                                <li key={i} className="text-xs text-gray-700">• {c}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {item.actions.length > 0 && (
                          <div>
                            <span className="text-[9px] font-bold uppercase text-[#00A3C4]">审批历史</span>
                            <div className="mt-1 space-y-1">
                              {item.actions.map((a) => (
                                <div key={a.id} className="flex items-start gap-2 text-xs">
                                  <span className="text-gray-400 whitespace-nowrap">
                                    {new Date(a.created_at).toLocaleString("zh-CN")}
                                  </span>
                                  <span className="font-bold">{a.actor_name || `#${a.actor_id}`}</span>
                                  <PixelBadge color={a.action === "approve" ? "green" : a.action === "reject" ? "red" : "yellow"}>
                                    {a.action === "approve" ? "通过" : a.action === "reject" ? "拒绝" : "附条件"}
                                  </PixelBadge>
                                  {a.comment && <span className="text-gray-600">{a.comment}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}

                  {/* Action panel */}
                  {acting === item.id && (
                    <tr key={`${item.id}-act`}>
                      <td colSpan={7} className="px-4 py-3 bg-[#FEFCBF] border-b-2 border-[#B7791F]">
                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-bold uppercase text-[#B7791F] block mb-1">审批备注</label>
                            <input
                              type="text"
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              placeholder="可选"
                              className="w-full border-2 border-[#B7791F] px-3 py-1.5 text-xs focus:outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold uppercase text-[#B7791F] block mb-1">附加条件（每行一条，仅"附条件通过"时填写）</label>
                            <textarea
                              value={conditions}
                              onChange={(e) => setConditions(e.target.value)}
                              rows={2}
                              className="w-full border-2 border-[#B7791F] px-3 py-1.5 text-xs focus:outline-none bg-white resize-none"
                            />
                          </div>
                          <div className="flex gap-2">
                            <PixelButton variant="primary" size="sm" onClick={() => act(item.id, "approve")}>
                              通过
                            </PixelButton>
                            <PixelButton variant="secondary" size="sm" onClick={() => act(item.id, "add_conditions")}>
                              附条件通过
                            </PixelButton>
                            <PixelButton variant="danger" size="sm" onClick={() => act(item.id, "reject")}>
                              拒绝
                            </PixelButton>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <PixelButton size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                上一页
              </PixelButton>
              <span className="text-[10px] font-bold">{page} / {totalPages}</span>
              <PixelButton size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                下一页
              </PixelButton>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
