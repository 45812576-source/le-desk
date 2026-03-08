"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { BusinessTable } from "@/lib/types";

export default function AdminBusinessTablesPage() {
  const [tables, setTables] = useState<BusinessTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BusinessTable | null>(null);

  const fetchTables = useCallback(() => {
    setLoading(true);
    apiFetch<BusinessTable[]>("/business-tables")
      .then(setTables)
      .catch(() => setTables([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  async function handleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    try {
      const data = await apiFetch<BusinessTable>(`/business-tables/${id}`);
      setDetail(data);
    } catch {
      setDetail(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除？")) return;
    try {
      await apiFetch(`/business-tables/${id}`, { method: "DELETE" });
      fetchTables();
    } catch {
      // ignore
    }
  }

  return (
    <PageShell title="业务表管理" icon={ICONS.bizTable}>
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : tables.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无业务表
        </div>
      ) : (
        <div className="space-y-2">
          {tables.map((bt) => (
            <div key={bt.id} className="bg-white border-2 border-[#1A202C]">
              <div className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold">{bt.display_name}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{bt.table_name}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{bt.description}</p>
                </div>
                <div className="flex gap-1">
                  <PixelButton size="sm" variant="secondary" onClick={() => handleExpand(bt.id)}>
                    {expandedId === bt.id ? "收起" : "详情"}
                  </PixelButton>
                  <PixelButton size="sm" variant="danger" onClick={() => handleDelete(bt.id)}>
                    删除
                  </PixelButton>
                </div>
              </div>

              {expandedId === bt.id && detail && (
                <div className="border-t-2 border-[#1A202C] p-4">
                  {detail.columns && detail.columns.length > 0 && (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">
                        列定义
                      </div>
                      <table className="w-full border border-gray-200 mb-3">
                        <thead>
                          <tr className="bg-gray-50">
                            {["列名", "类型", "可空", "备注"].map((h) => (
                              <th key={h} className="text-left text-[9px] font-bold text-gray-500 px-2 py-1">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.columns.map((col) => (
                            <tr key={col.name} className="border-t border-gray-100">
                              <td className="px-2 py-1 text-[10px] font-mono font-bold">{col.name}</td>
                              <td className="px-2 py-1 text-[10px]">{col.type}</td>
                              <td className="px-2 py-1 text-[10px]">{col.nullable ? "YES" : "NO"}</td>
                              <td className="px-2 py-1 text-[10px] text-gray-500">{col.comment}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                  {detail.ddl_sql && (
                    <>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">DDL</div>
                      <pre className="text-[9px] bg-gray-50 border border-gray-200 p-2 max-h-40 overflow-auto">
                        {detail.ddl_sql}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
