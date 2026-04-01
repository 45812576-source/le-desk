"use client";

import React, { useState, useEffect } from "react";
import { fetchRiskAssessment } from "../../shared/api";
import type { RiskAssessment, RiskLevel, TableDetailV2 } from "../../shared/types";
import { RISK_LEVEL_LABELS, RISK_LEVEL_COLORS } from "../../shared/types";

interface Props {
  detail: TableDetailV2;
}

/** 本地兜底计算风险分 */
function computeLocalRisk(detail: TableDetailV2): RiskAssessment {
  const factors = [];
  let total = 0;

  // 敏感字段占比
  const sensitiveCount = detail.fields.filter((f) => f.sensitivity_level !== "S0_public").length;
  const sensitiveRatio = detail.fields.length > 0 ? sensitiveCount / detail.fields.length : 0;
  const sensitiveScore = Math.round(sensitiveRatio * 30);
  factors.push({ name: "敏感字段占比", score: sensitiveScore, max_score: 30, description: `${sensitiveCount}/${detail.fields.length} 字段非公开` });
  total += sensitiveScore;

  // 权限覆盖
  const hasPermission = detail.permission_policies && detail.permission_policies.length > 0;
  const permScore = hasPermission ? 0 : 20;
  factors.push({ name: "权限策略覆盖", score: permScore, max_score: 20, description: hasPermission ? "已配置权限策略" : "未配置任何权限策略" });
  total += permScore;

  // 外部数据源
  const isExternal = detail.source_type !== "blank";
  const extScore = isExternal ? 15 : 0;
  factors.push({ name: "外部数据源", score: extScore, max_score: 15, description: isExternal ? `来源: ${detail.source_type}` : "本地创建" });
  total += extScore;

  // 小样本保护
  const hasSsp = detail.small_sample_protection?.enabled;
  const sspScore = hasSsp ? 0 : 10;
  factors.push({ name: "小样本保护", score: sspScore, max_score: 10, description: hasSsp ? "已启用" : "未启用" });
  total += sspScore;

  const level: RiskLevel = total >= 60 ? "critical" : total >= 40 ? "high" : total >= 20 ? "medium" : "low";

  return {
    table_id: detail.id,
    overall_level: level,
    overall_score: total,
    factors,
    assessed_at: new Date().toISOString(),
  };
}

const RING_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export default function RiskScorePanel({ detail }: Props) {
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRiskAssessment(detail.id)
      .then((r) => {
        // 若返回空态（score=0 且无 factors），使用本地计算
        if (r.factors.length === 0) {
          setRisk(computeLocalRisk(detail));
        } else {
          setRisk(r);
        }
      })
      .catch(() => setRisk(computeLocalRisk(detail)))
      .finally(() => setLoading(false));
  }, [detail]);

  if (loading) {
    return (
      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">风险评分</div>
        <div className="text-[9px] text-gray-400 animate-pulse">加载中...</div>
      </div>
    );
  }

  if (!risk) return null;

  const maxScore = risk.factors.reduce((sum, f) => sum + f.max_score, 0) || 100;
  const pct = Math.round((risk.overall_score / maxScore) * 100);
  const circumference = 2 * Math.PI * 36;
  const strokeDash = (pct / 100) * circumference;
  const color = RING_COLORS[risk.overall_level];

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">风险评分</div>

      <div className="flex items-start gap-4">
        {/* 圆形指示器 */}
        <div className="flex-shrink-0 relative w-20 h-20">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="36" fill="none"
              stroke={color} strokeWidth="6"
              strokeDasharray={`${strokeDash} ${circumference}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold" style={{ color }}>{risk.overall_score}</span>
            <span className={`text-[7px] font-bold px-1 py-px rounded ${RISK_LEVEL_COLORS[risk.overall_level]}`}>
              {RISK_LEVEL_LABELS[risk.overall_level]}
            </span>
          </div>
        </div>

        {/* 因素明细 */}
        <div className="flex-1 space-y-1.5">
          {risk.factors.map((f) => (
            <div key={f.name}>
              <div className="flex items-center justify-between text-[9px]">
                <span className="font-bold">{f.name}</span>
                <span className="text-gray-400">{f.score}/{f.max_score}</span>
              </div>
              <div className="h-1 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{
                    width: `${f.max_score > 0 ? (f.score / f.max_score) * 100 : 0}%`,
                    backgroundColor: f.score > f.max_score * 0.6 ? "#ef4444" : f.score > f.max_score * 0.3 ? "#eab308" : "#22c55e",
                  }}
                />
              </div>
              <div className="text-[8px] text-gray-400">{f.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 整改建议 */}
      {risk.overall_level !== "low" && (
        <div className="mt-3 border-t border-gray-200 pt-2">
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">整改建议</div>
          <ul className="text-[8px] text-gray-500 space-y-0.5">
            {risk.factors
              .filter((f) => f.score > f.max_score * 0.3)
              .map((f) => (
                <li key={f.name}>• {f.name}: {f.description}</li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
