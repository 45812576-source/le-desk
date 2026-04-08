"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { apiFetch } from "@/lib/api";
import type { TokenDashboardEntry } from "@/lib/types";

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

function TokenVal({ n, color }: { n: number; color: string }) {
  if (n <= 0) return <span className="text-gray-300">—</span>;
  return <span className={`font-mono ${color}`}>{fmtTokens(n)}</span>;
}

function SummaryCard({ label, input, output }: { label: string; input: number; output: number }) {
  return (
    <div className="border-2 border-[#1A202C] bg-white p-4 flex-1 min-w-[180px]">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">{label}</div>
      <div className="text-lg font-bold font-mono">{fmtTokens(input + output)}</div>
      <div className="flex gap-3 mt-1 text-[10px] font-mono">
        <span className="text-[#00A3C4]">IN {fmtTokens(input)}</span>
        <span className="text-[#00CC99]">OUT {fmtTokens(output)}</span>
      </div>
    </div>
  );
}

export default function TokenDashboardPage() {
  const [data, setData] = useState<TokenDashboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<TokenDashboardEntry[]>("/contributions/token-dashboard")
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  // 汇总
  const totals = data.reduce(
    (acc, d) => ({
      opencode_in: acc.opencode_in + d.opencode.input_tokens,
      opencode_out: acc.opencode_out + d.opencode.output_tokens,
      skill_in: acc.skill_in + d.skill_studio.input_tokens,
      skill_out: acc.skill_out + d.skill_studio.output_tokens,
      chat_in: acc.chat_in + d.chat.input_tokens,
      chat_out: acc.chat_out + d.chat.output_tokens,
      project_in: acc.project_in + d.project.input_tokens,
      project_out: acc.project_out + d.project.output_tokens,
    }),
    { opencode_in: 0, opencode_out: 0, skill_in: 0, skill_out: 0, chat_in: 0, chat_out: 0, project_in: 0, project_out: 0 },
  );

  const HEADERS = [
    "排名", "用户",
    "OpenCode IN", "OpenCode OUT", "OC 缓存",
    "Skill Studio IN", "Skill Studio OUT",
    "Chat IN", "Chat OUT",
    "项目 IN", "项目 OUT",
    "合计",
  ];

  return (
    <PageShell title="Token 用量看板" icon={ICONS.contrib}>
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : data.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无 Token 用量数据
        </div>
      ) : (
        <div className="space-y-4">
          {/* 汇总卡片 */}
          <div className="flex gap-3 flex-wrap">
            <SummaryCard label="OpenCode" input={totals.opencode_in} output={totals.opencode_out} />
            <SummaryCard label="Skill Studio" input={totals.skill_in} output={totals.skill_out} />
            <SummaryCard label="Chat 工作台" input={totals.chat_in} output={totals.chat_out} />
            <SummaryCard label="项目工作台" input={totals.project_in} output={totals.project_out} />
          </div>

          {/* 明细表 */}
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-[#1A202C]">
              <thead>
                <tr className="bg-[#EBF4F7]">
                  {HEADERS.map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={d.user_id} className="border-b border-gray-200 hover:bg-gray-50 text-xs">
                    <td className="px-3 py-2"><RankCell i={i} /></td>
                    <td className="px-3 py-2 font-bold whitespace-nowrap">{d.display_name}</td>
                    <td className="px-3 py-2"><TokenVal n={d.opencode.input_tokens} color="text-[#00A3C4]" /></td>
                    <td className="px-3 py-2"><TokenVal n={d.opencode.output_tokens} color="text-[#00CC99]" /></td>
                    <td className="px-3 py-2 font-mono text-gray-400">
                      {(d.opencode.cache_read_tokens ?? 0) > 0 ? fmtTokens(d.opencode.cache_read_tokens!) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2"><TokenVal n={d.skill_studio.input_tokens} color="text-[#00A3C4]" /></td>
                    <td className="px-3 py-2"><TokenVal n={d.skill_studio.output_tokens} color="text-[#00CC99]" /></td>
                    <td className="px-3 py-2"><TokenVal n={d.chat.input_tokens} color="text-[#00A3C4]" /></td>
                    <td className="px-3 py-2"><TokenVal n={d.chat.output_tokens} color="text-[#00CC99]" /></td>
                    <td className="px-3 py-2"><TokenVal n={d.project.input_tokens} color="text-[#00A3C4]" /></td>
                    <td className="px-3 py-2"><TokenVal n={d.project.output_tokens} color="text-[#00CC99]" /></td>
                    <td className="px-3 py-2 font-mono font-bold">
                      {fmtTokens(d.total_input + d.total_output)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}
