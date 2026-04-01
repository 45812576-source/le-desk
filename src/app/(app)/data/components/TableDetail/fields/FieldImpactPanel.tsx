"use client";

import React, { useState, useEffect } from "react";
import { fetchFieldImpact } from "../../shared/api";
import type { FieldImpact } from "../../shared/types";

interface Props {
  fieldId: number;
  fieldName: string;
  onClose: () => void;
}

/** A6 字段影响图 — inline 展开面板，4 维度 */
export default function FieldImpactPanel({ fieldId, fieldName, onClose }: Props) {
  const [impact, setImpact] = useState<FieldImpact | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFieldImpact(fieldId)
      .then(setImpact)
      .catch(() => setImpact(null))
      .finally(() => setLoading(false));
  }, [fieldId]);

  if (loading) {
    return <div className="p-2 text-[9px] text-gray-400 animate-pulse">加载影响分析...</div>;
  }

  if (!impact) {
    return (
      <div className="p-2 text-[9px] text-gray-400">
        无法获取影响数据
        <button onClick={onClose} className="ml-2 text-[8px] text-gray-300 hover:text-[#1A202C]">✕</button>
      </div>
    );
  }

  const hasAny =
    impact.used_by_views.length > 0 ||
    impact.used_by_policies.length > 0 ||
    impact.used_by_skills.length > 0 ||
    impact.used_by_sync_rules.length > 0;

  return (
    <div className="border-2 border-[#00D1FF] bg-white p-3 mt-1 mb-2 mx-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
          字段影响分析 — {fieldName}
        </span>
        <button onClick={onClose} className="text-[8px] text-gray-400 hover:text-[#1A202C]">✕</button>
      </div>

      {!hasAny && (
        <div className="text-[8px] text-gray-400">此字段暂无被引用记录</div>
      )}

      {impact.used_by_views.length > 0 && (
        <Section title="视图引用" count={impact.used_by_views.length}>
          {impact.used_by_views.map((v) => (
            <Tag key={v.id} label={v.name} color="bg-blue-50 text-blue-500" />
          ))}
        </Section>
      )}

      {impact.used_by_policies.length > 0 && (
        <Section title="权限策略" count={impact.used_by_policies.length}>
          {impact.used_by_policies.map((p) => (
            <Tag key={p.id} label={p.role_group_name} color="bg-purple-50 text-purple-500" />
          ))}
        </Section>
      )}

      {impact.used_by_skills.length > 0 && (
        <Section title="Skill 绑定" count={impact.used_by_skills.length}>
          {impact.used_by_skills.map((s) => (
            <Tag key={s.id} label={s.skill_name} color="bg-green-50 text-green-500" />
          ))}
        </Section>
      )}

      {impact.used_by_sync_rules.length > 0 && (
        <Section title="同步规则" count={impact.used_by_sync_rules.length}>
          {impact.used_by_sync_rules.map((r) => (
            <Tag key={r} label={r} color="bg-orange-50 text-orange-500" />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-1">
        {title} ({count})
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Tag({ label, color }: { label: string; color: string }) {
  return <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${color}`}>{label}</span>;
}
