"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { ContributionStat } from "@/lib/types";

export default function AdminContributionsPage() {
  const [stats, setStats] = useState<ContributionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ContributionStat[]>("/contributions/stats")
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageShell title="贡献排行" icon={ICONS.contrib}>
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : stats.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无贡献数据
        </div>
      ) : (
        <table className="w-full border-2 border-[#1A202C]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["排名", "用户", "提交数", "采纳数", "采纳率", "影响力", "影响Skill数"].map((h) => (
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
            {stats.map((s, i) => (
              <tr key={s.user_id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2">
                  {i < 3 ? (
                    <span
                      className={`text-sm font-bold ${
                        i === 0
                          ? "text-yellow-500"
                          : i === 1
                            ? "text-gray-400"
                            : "text-amber-700"
                      }`}
                    >
                      #{i + 1}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">#{i + 1}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs font-bold">{s.display_name}</td>
                <td className="px-3 py-2 text-xs">{s.total_suggestions}</td>
                <td className="px-3 py-2 text-xs">{s.adopted_count}</td>
                <td className="px-3 py-2">
                  <PixelBadge
                    color={
                      s.adoption_rate >= 0.5 ? "green" : s.adoption_rate > 0 ? "yellow" : "gray"
                    }
                  >
                    {(s.adoption_rate * 100).toFixed(0)}%
                  </PixelBadge>
                </td>
                <td className="px-3 py-2 text-xs font-bold">{s.influence_score}</td>
                <td className="px-3 py-2 text-xs">{s.impacted_skills}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
