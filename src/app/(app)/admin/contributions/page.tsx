"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { ContributionStat, KbContributionStat } from "@/lib/types";

type Tab = "skill" | "kb";

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function RankCell({ i }: { i: number }) {
  if (i === 0) return <span className="text-sm font-bold text-yellow-500">#{i + 1}</span>;
  if (i === 1) return <span className="text-sm font-bold text-gray-400">#{i + 1}</span>;
  if (i === 2) return <span className="text-sm font-bold text-amber-700">#{i + 1}</span>;
  return <span className="text-xs text-gray-400">#{i + 1}</span>;
}

function SkillTab() {
  const [stats, setStats] = useState<ContributionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<ContributionStat[]>("/contributions/stats")
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingRow />;
  if (stats.length === 0) return <EmptyRow text="暂无 Skill 贡献数据" />;

  return (
    <table className="w-full border-2 border-[#1A202C]">
      <thead>
        <tr className="bg-[#EBF4F7]">
          {["排名", "用户", "提交数", "采纳数", "采纳率", "影响力", "影响Skill数"].map((h) => (
            <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stats.map((s, i) => (
          <tr key={s.user_id} className="border-b border-gray-200 hover:bg-gray-50">
            <td className="px-3 py-2"><RankCell i={i} /></td>
            <td className="px-3 py-2 text-xs font-bold">{s.display_name}</td>
            <td className="px-3 py-2 text-xs">{s.total_suggestions}</td>
            <td className="px-3 py-2 text-xs">{s.adopted_count}</td>
            <td className="px-3 py-2">
              <PixelBadge color={s.adoption_rate >= 0.5 ? "green" : s.adoption_rate > 0 ? "yellow" : "gray"}>
                {(s.adoption_rate * 100).toFixed(0)}%
              </PixelBadge>
            </td>
            <td className="px-3 py-2 text-xs font-bold">{s.influence_score}</td>
            <td className="px-3 py-2 text-xs">{s.impacted_skills}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KbTab() {
  const [stats, setStats] = useState<KbContributionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<KbContributionStat[]>("/contributions/kb-stats")
      .then(setStats)
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingRow />;
  if (stats.length === 0) return <EmptyRow text="暂无知识库贡献数据" />;

  return (
    <table className="w-full border-2 border-[#1A202C]">
      <thead>
        <tr className="bg-[#EBF4F7]">
          {["排名", "用户", "提交条目", "已审核", "使用模型", "Input Token", "Output Token", "总产出"].map((h) => (
            <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {stats.map((s, i) => (
          <tr key={s.user_id} className="border-b border-gray-200 hover:bg-gray-50">
            <td className="px-3 py-2"><RankCell i={i} /></td>
            <td className="px-3 py-2 text-xs font-bold">{s.display_name}</td>
            <td className="px-3 py-2 text-xs">{s.total_entries}</td>
            <td className="px-3 py-2">
              <PixelBadge color={s.approved_entries > 0 ? "green" : "gray"}>
                {s.approved_entries}
              </PixelBadge>
            </td>
            <td className="px-3 py-2 text-[9px] text-gray-500 max-w-[120px]">
              {s.top_model ? (
                <span className="truncate block" title={Object.entries(s.models).map(([m, c]) => `${m}: ${c}次`).join(" / ")}>
                  {s.top_model}
                </span>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </td>
            <td className="px-3 py-2 text-xs font-mono">
              {s.input_tokens > 0 ? (
                <span className="text-[#00A3C4]">{fmtTokens(s.input_tokens)}</span>
              ) : <span className="text-gray-300">—</span>}
            </td>
            <td className="px-3 py-2 text-xs font-mono">
              {s.output_tokens > 0 ? (
                <span className="text-[#00CC99]">{fmtTokens(s.output_tokens)}</span>
              ) : <span className="text-gray-300">—</span>}
            </td>
            <td className="px-3 py-2 text-xs font-mono font-bold">
              {s.input_tokens + s.output_tokens > 0 ? (
                fmtTokens(s.input_tokens + s.output_tokens)
              ) : <span className="text-gray-300">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LoadingRow() {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
      Loading...
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
      {text}
    </div>
  );
}

export default function AdminContributionsPage() {
  const [tab, setTab] = useState<Tab>("skill");

  return (
    <PageShell title="贡献排行" icon={ICONS.contrib}>
      {/* Tab bar */}
      <div className="flex border-b-2 border-[#1A202C] mb-4">
        {([["skill", "Skill 贡献"], ["kb", "知识库贡献"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-r-2 border-[#1A202C] transition-colors ${
              tab === key
                ? "bg-[#1A202C] text-[#00D1FF]"
                : "bg-white text-gray-400 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "skill" ? <SkillTab /> : <KbTab />}
    </PageShell>
  );
}
