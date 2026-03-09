"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { AuditLog } from "@/lib/types";

interface AuditResponse {
  total: number;
  page: number;
  page_size: number;
  logs: AuditLog[];
}

const OP_COLOR: Record<string, "green" | "yellow" | "red" | "cyan"> = {
  INSERT: "green",
  UPDATE: "yellow",
  DELETE: "red",
};

export default function AdminAuditPage() {
  const [data, setData] = useState<AuditResponse>({
    total: 0,
    page: 1,
    page_size: 20,
    logs: [],
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [tableFilter, setTableFilter] = useState("");
  const [opFilter, setOpFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (tableFilter) params.set("table_name", tableFilter);
    if (opFilter) params.set("operation", opFilter);
    apiFetch<AuditResponse>(`/audit-logs?${params}`)
      .then(setData)
      .catch(() => setData({ total: 0, page: 1, page_size: 20, logs: [] }))
      .finally(() => setLoading(false));
  }, [page, tableFilter, opFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(data.total / data.page_size);

  return (
    <PageShell title="操作审计" icon={ICONS.audit}>
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="text"
          placeholder="表名筛选"
          value={tableFilter}
          onChange={(e) => {
            setTableFilter(e.target.value);
            setPage(1);
          }}
          className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold w-48 focus:outline-none focus:border-[#00D1FF]"
        />
        <div className="flex gap-1">
          {["", "INSERT", "UPDATE", "DELETE"].map((op) => (
            <PixelButton
              key={op}
              variant={opFilter === op ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setOpFilter(op);
                setPage(1);
              }}
            >
              {op || "全部"}
            </PixelButton>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 font-bold ml-auto">共 {data.total} 条</span>
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : (
        <>
          <table className="w-full border-2 border-[#1A202C]">
            <thead>
              <tr className="bg-[#EBF4F7]">
                {["时间", "用户", "表", "操作", "行ID", "详情"].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2 text-[10px] text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-3 py-2 text-xs">{log.user_id}</td>
                  <td className="px-3 py-2 text-xs font-bold">{log.table_name}</td>
                  <td className="px-3 py-2">
                    <PixelBadge color={OP_COLOR[log.operation] || "cyan"}>
                      {log.operation}
                    </PixelBadge>
                  </td>
                  <td className="px-3 py-2 text-xs">{log.row_id ?? "-"}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                      className="text-[10px] font-bold text-[#00A3C4] hover:underline"
                    >
                      {expandedId === log.id ? "收起" : "展开"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Expanded detail */}
          {expandedId !== null &&
            (() => {
              const log = data.logs.find((l) => l.id === expandedId);
              if (!log) return null;
              return (
                <div className="mt-2 bg-gray-50 border-2 border-[#1A202C] p-3">
                  {log.old_values && (
                    <div className="mb-2">
                      <span className="text-[9px] font-bold uppercase text-red-500">旧值</span>
                      <pre className="text-[9px] mt-1 overflow-auto max-h-32">
                        {JSON.stringify(log.old_values, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.new_values && (
                    <div className="mb-2">
                      <span className="text-[9px] font-bold uppercase text-green-600">新值</span>
                      <pre className="text-[9px] mt-1 overflow-auto max-h-32">
                        {JSON.stringify(log.new_values, null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.sql_executed && (
                    <div>
                      <span className="text-[9px] font-bold uppercase text-[#00A3C4]">SQL</span>
                      <pre className="text-[9px] mt-1 overflow-auto max-h-20">{log.sql_executed}</pre>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <PixelButton
                size="sm"
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </PixelButton>
              <span className="text-[10px] font-bold">
                {page} / {totalPages}
              </span>
              <PixelButton
                size="sm"
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </PixelButton>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
