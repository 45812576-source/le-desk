"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS, PixelIcon } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { SkillDetail } from "@/lib/types";

export default function SkillMarketPage() {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    apiFetch<SkillDetail[]>("/skills?scope=company")
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, []);

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
      // ignore — may already be saved
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
      {/* Search bar */}
      <div className="flex items-center gap-2 mb-6">
        <input
          type="text"
          placeholder="搜索公司 Skill..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          className="flex-1 max-w-xs border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
            Loading...
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-4">
            <PixelIcon {...ICONS.skills} size={16} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            暂无可用 Skill
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((skill) => {
            const isSaved = saved.has(skill.id);
            return (
              <div
                key={skill.id}
                className="bg-white border-2 border-[#1A202C] p-4 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <PixelIcon {...ICONS.skills} size={12} />
                    <span className="text-xs font-bold uppercase">{skill.name}</span>
                    <PixelBadge color="green">公司</PixelBadge>
                    {(skill.current_version ?? 0) > 0 && (
                      <PixelBadge color="cyan">v{skill.current_version}</PixelBadge>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-500 line-clamp-2">{skill.description || "无描述"}</p>
                  {skill.knowledge_tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {skill.knowledge_tags.map((t) => (
                        <span key={t} className="text-[8px] text-[#00A3C4] font-bold uppercase">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
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
    </PageShell>
  );
}
