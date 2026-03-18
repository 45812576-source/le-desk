"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Zap } from "lucide-react";
import { ICONS, PixelIcon } from "@/components/pixel";
import { useTheme } from "@/lib/theme";

function ThemedIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.skills} size={size} />;
  return <Zap size={size} className="text-muted-foreground" />;
}
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";
import type { SkillDetail, Department } from "@/lib/types";

interface RankItem {
  rank: number;
  skill_id: number;
  name: string;
  description: string | null;
  scope: string;
  department_id: number | null;
  knowledge_tags: string[];
  current_version: number;
  conv_count_recent: number;
  user_count_recent: number;
  conv_count_total: number;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="w-6 h-6 bg-yellow-400 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>;
  if (rank === 2) return <span className="w-6 h-6 bg-gray-300 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>;
  if (rank === 3) return <span className="w-6 h-6 bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>;
  return <span className="w-6 h-6 border-2 border-gray-300 text-gray-400 text-[9px] font-bold flex items-center justify-center flex-shrink-0">{rank}</span>;
}

function HeatBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#E2E8F0]">
        <div className="h-full bg-[#00D1FF] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] font-bold text-[#00A3C4] w-6 text-right">{value}</span>
    </div>
  );
}

function RankingBoard({
  title,
  color,
  items,
  loading,
  extraHeader,
}: {
  title: string;
  color: string;
  items: RankItem[];
  loading: boolean;
  extraHeader?: React.ReactNode;
}) {
  const max = items[0]?.conv_count_recent ?? 1;

  return (
    <div className="border-2 border-[#1A202C] bg-white flex flex-col">
      <div
        className="px-4 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ background: color }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-white">
          {title}
        </span>
        {extraHeader}
      </div>
      {loading ? (
        <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-8 animate-pulse">加载中...</div>
      ) : items.length === 0 ? (
        <div className="text-[10px] text-gray-400 text-center py-8">暂无数据</div>
      ) : (
        <div className="divide-y divide-[#F0F4F8]">
          {items.map((item) => (
            <div key={item.skill_id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#F0F4F8] transition-colors">
              <RankBadge rank={item.rank} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[11px] font-bold text-[#1A202C] truncate">{item.name}</span>
                  {item.current_version > 0 && (
                    <span className="text-[8px] font-bold text-gray-400">v{item.current_version}</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-[9px] text-gray-500 truncate mb-1">{item.description}</p>
                )}
                <HeatBar value={item.conv_count_recent} max={max} />
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-[9px] text-gray-400">{item.user_count_recent} 人用</div>
                <div className="text-[8px] text-gray-300">共 {item.conv_count_total} 次</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SkillMarketPage() {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  // 热榜
  const [companyRank, setCompanyRank] = useState<RankItem[]>([]);
  const [deptRank, setDeptRank] = useState<RankItem[]>([]);
  const [rankLoading, setRankLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | "">("");
  const [rankDays, setRankDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    apiFetch<SkillDetail[]>("/skills?scope=company")
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));

    apiFetch<Department[]>("/admin/departments")
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    setRankLoading(true);
    const deptParam = selectedDept ? `&department_id=${selectedDept}` : "";
    Promise.all([
      apiFetch<RankItem[]>(`/skills/ranking?scope=company&days=${rankDays}&limit=10`),
      apiFetch<RankItem[]>(`/skills/ranking?scope=department&days=${rankDays}&limit=10${deptParam}`),
    ])
      .then(([company, dept]) => {
        setCompanyRank(company);
        setDeptRank(dept);
      })
      .catch(() => {
        setCompanyRank([]);
        setDeptRank([]);
      })
      .finally(() => setRankLoading(false));
  }, [rankDays, selectedDept]);

  const filtered = searchQ
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQ.toLowerCase()) ||
          (s.description || "").toLowerCase().includes(searchQ.toLowerCase())
      )
    : skills;

  async function handleSave(skillId: number) {
    if (saved.has(skillId) || saving === skillId) return;
    setSaving(skillId);
    try {
      await apiFetch("/skills/save-from-market", {
        method: "POST",
        body: JSON.stringify({ skill_id: skillId }),
      });
      setSaved((prev) => new Set(prev).add(skillId));
    } catch {
      setSaved((prev) => new Set(prev).add(skillId));
    } finally {
      setSaving(null);
    }
  }

  return (
    <PageShell
      title="Skill 市场"
      icon={ICONS.skillMarket ?? ICONS.skills}
      actions={
        <PixelButton variant="secondary" onClick={() => window.location.href = "/skills"}>
          ← 返回我的 Skill
        </PixelButton>
      }
    >
      <div className="flex flex-col gap-6">
        {/* ── 热门排行榜 ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
              — 热门排行榜
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-400 font-bold">近</span>
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setRankDays(d)}
                  className={`px-2 py-1 text-[9px] font-bold border transition-colors ${
                    rankDays === d
                      ? "border-[#1A202C] bg-[#1A202C] text-white"
                      : "border-gray-300 text-gray-500 hover:border-[#1A202C]"
                  }`}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <RankingBoard
              title="通用榜"
              color="#00A3C4"
              items={companyRank}
              loading={rankLoading}
            />
            <RankingBoard
              title="专业榜"
              color="#805AD5"
              items={deptRank}
              loading={rankLoading}
              extraHeader={
                <PixelSelect
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value === "" ? "" : Number(e.target.value))}
                  pixelSize="sm"
                  className="w-auto bg-white/20 text-white border border-white/40"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="" className="text-[#1A202C] bg-white">全部部门</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id} className="text-[#1A202C] bg-white">
                      {d.name}
                    </option>
                  ))}
                </PixelSelect>
              }
            />
          </div>
        </div>

        {/* ── Skill 列表 ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
              — 全部 Skill
            </div>
            <input
              type="text"
              placeholder="搜索..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="ml-auto max-w-xs border-2 border-[#1A202C] px-3 py-1 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
                Loading...
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-10 h-10 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
                <ThemedIcon size={16} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                暂无可用 Skill
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((skill) => {
                const isSaved = saved.has(skill.id);
                // 在热榜里找到排名标注
                const inCompanyRank = companyRank.find((r) => r.skill_id === skill.id);
                return (
                  <div
                    key={skill.id}
                    className="bg-white border-2 border-[#1A202C] p-4 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <ThemedIcon size={12} />
                        <span className="text-xs font-bold uppercase">{skill.name}</span>
                        <PixelBadge color="green">公司</PixelBadge>
                        {(skill.current_version ?? 0) > 0 && (
                          <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>
                        )}
                        {inCompanyRank && inCompanyRank.rank <= 3 && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 bg-yellow-100 border border-yellow-400 text-yellow-700">
                            通用榜 #{inCompanyRank.rank}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-500 line-clamp-2">{skill.description || "无描述"}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {skill.knowledge_tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {skill.knowledge_tags.map((t) => (
                              <span key={t} className="text-[8px] text-[#00A3C4] font-bold uppercase">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                        {inCompanyRank && (
                          <span className="text-[8px] text-gray-400 ml-auto">
                            近30天 {inCompanyRank.conv_count_recent} 次对话
                          </span>
                        )}
                      </div>
                    </div>
                    <PixelButton
                      size="sm"
                      variant={isSaved ? "secondary" : "primary"}
                      onClick={() => handleSave(skill.id)}
                      disabled={isSaved || saving === skill.id}
                    >
                      {isSaved ? "已保存" : saving === skill.id ? "保存中..." : "保存"}
                    </PixelButton>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
