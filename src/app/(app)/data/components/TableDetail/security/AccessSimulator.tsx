"use client";

import React, { useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import type { TableDetail, DisclosureLevel } from "../../shared/types";
import { DISCLOSURE_LABELS } from "../../shared/types";
import { useAccessSimulation } from "../../../hooks";

interface Props {
  detail: TableDetail;
}

export default function AccessSimulator({ detail }: Props) {
  const [subjectType, setSubjectType] = useState<"user" | "role" | "skill">("user");
  const [subjectId, setSubjectId] = useState("");
  const [viewId, setViewId] = useState<string>("");
  const [question, setQuestion] = useState("");
  const { result, isLoading, error, simulate, clear } = useAccessSimulation();

  function handleSimulate() {
    if (!subjectId) return;
    simulate({
      subject_type: subjectType,
      subject_id: Number(subjectId),
      resource_table_id: detail.id,
      resource_view_id: viewId ? Number(viewId) : undefined,
      question: question || undefined,
    });
  }

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">访问模拟器</div>

      {/* 输入区 */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">主体类型</label>
          <select
            value={subjectType}
            onChange={(e) => setSubjectType(e.target.value as "user" | "role" | "skill")}
            className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
          >
            <option value="user">用户</option>
            <option value="role">角色组</option>
            <option value="skill">Skill</option>
          </select>
        </div>
        <div>
          <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">
            {subjectType === "user" ? "用户 ID" : subjectType === "role" ? "角色组" : "Skill ID"}
          </label>
          {subjectType === "role" ? (
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
            >
              <option value="">选择角色组</option>
              {detail.role_groups.map((rg) => (
                <option key={rg.id} value={rg.id}>{rg.name}</option>
              ))}
            </select>
          ) : (
            <input
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              placeholder={subjectType === "user" ? "输入用户 ID" : "输入 Skill ID"}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5"
            />
          )}
        </div>
        <div>
          <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">视图（可选）</label>
          <select
            value={viewId}
            onChange={(e) => setViewId(e.target.value)}
            className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
          >
            <option value="">表级</option>
            {detail.views.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">自然语言问题（可选）</label>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例: 上季度各部门业绩？"
            className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <PixelButton size="sm" onClick={handleSimulate} disabled={isLoading || !subjectId}>
          {isLoading ? "模拟中..." : "开始模拟"}
        </PixelButton>
        {result && (
          <button onClick={clear} className="text-[8px] text-gray-400 hover:text-[#1A202C]">清除结果</button>
        )}
      </div>

      {error && (
        <div className="text-[9px] text-red-500 mb-2">{error}</div>
      )}

      {/* 输出区 */}
      {result && (
        <div className="border border-gray-200 p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[7px] text-gray-400 uppercase block">可访问字段</span>
              <span className="text-[9px] font-bold text-green-600">{result.accessible_fields.length} 个</span>
            </div>
            <div>
              <span className="text-[7px] text-gray-400 uppercase block">被拦截字段</span>
              <span className="text-[9px] font-bold text-red-500">{result.blocked_fields.length} 个</span>
            </div>
            <div>
              <span className="text-[7px] text-gray-400 uppercase block">披露级别</span>
              <span className="text-[9px] font-bold">
                {DISCLOSURE_LABELS[result.disclosure_level as DisclosureLevel] || result.disclosure_level}
              </span>
            </div>
            <div>
              <span className="text-[7px] text-gray-400 uppercase block">行访问</span>
              <span className="text-[9px] font-bold">{result.row_access_summary}</span>
            </div>
          </div>

          {result.intercepted_items.length > 0 && (
            <div>
              <span className="text-[7px] text-gray-400 uppercase block mb-1">拦截明细</span>
              {result.intercepted_items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-[8px] py-0.5">
                  <span className={`px-1 py-px rounded font-bold ${
                    item.action === "blocked" ? "bg-red-50 text-red-500" :
                    item.action === "masked" ? "bg-yellow-50 text-yellow-600" :
                    "bg-blue-50 text-blue-500"
                  }`}>{item.action}</span>
                  <span className="font-bold">{item.field_name}</span>
                  <span className="text-gray-400">{item.reason}</span>
                </div>
              ))}
            </div>
          )}

          {result.accessible_fields.length > 0 && (
            <div>
              <span className="text-[7px] text-gray-400 uppercase block mb-1">可访问字段列表</span>
              <div className="flex flex-wrap gap-1">
                {result.accessible_fields.slice(0, 30).map((f) => (
                  <span key={f} className="text-[7px] px-1 py-px bg-green-50 border border-green-200 text-green-600 rounded">{f}</span>
                ))}
                {result.accessible_fields.length > 30 && (
                  <span className="text-[7px] text-gray-400">+{result.accessible_fields.length - 30}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
