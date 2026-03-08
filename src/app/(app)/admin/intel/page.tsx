"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";

interface IntelSource {
  id: number;
  name: string;
  source_type: string;
  url: string | null;
  is_active: boolean;
  last_fetched_at: string | null;
}

export default function AdminIntelPage() {
  const [sources, setSources] = useState<IntelSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<IntelSource[]>("/intel/sources")
      .then(setSources)
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell title="情报管理" icon={ICONS.intelAdmin}>
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : sources.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无情报源
        </div>
      ) : (
        <table className="w-full border-2 border-[#1A202C]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["名称", "类型", "URL", "状态", "最后抓取"].map((h) => (
                <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2 text-xs font-bold">{s.name}</td>
                <td className="px-3 py-2">
                  <PixelBadge color="cyan">{s.source_type}</PixelBadge>
                </td>
                <td className="px-3 py-2 text-[10px] text-gray-500 truncate max-w-xs">
                  {s.url || "-"}
                </td>
                <td className="px-3 py-2">
                  <PixelBadge color={s.is_active ? "green" : "red"}>
                    {s.is_active ? "活跃" : "停用"}
                  </PixelBadge>
                </td>
                <td className="px-3 py-2 text-[10px] text-gray-500">
                  {s.last_fetched_at ? new Date(s.last_fetched_at).toLocaleString("zh-CN") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
