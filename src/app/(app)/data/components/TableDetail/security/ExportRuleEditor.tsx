"use client";

import React, { useState, useEffect } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import type { ExportRule, ExportFormat, TableDetail } from "../../shared/types";
import { fetchExportRules, saveExportRule } from "../../shared/api";

interface Props {
  detail: TableDetail;
  onSaved: () => void;
}

const ALL_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "csv", label: "CSV" },
  { value: "excel", label: "Excel" },
  { value: "json", label: "JSON" },
];

export default function ExportRuleEditor({ detail, onSaved }: Props) {
  const [rules, setRules] = useState<ExportRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // 新建表单
  const [roleGroupId, setRoleGroupId] = useState<number | null>(null);
  const [formats, setFormats] = useState<ExportFormat[]>(["csv"]);
  const [maxRows, setMaxRows] = useState<string>("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [watermark, setWatermark] = useState(false);
  const [stripSensitive, setStripSensitive] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchExportRules(detail.id)
      .then(setRules)
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, [detail.id]);

  function toggleFormat(f: ExportFormat) {
    setFormats((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  }

  async function handleSave() {
    if (!roleGroupId || formats.length === 0) return;
    setSaving(true);
    try {
      await saveExportRule(detail.id, {
        table_id: detail.id,
        role_group_id: roleGroupId,
        allowed_formats: formats,
        max_rows: maxRows ? Number(maxRows) : null,
        requires_approval: requiresApproval,
        watermark,
        strip_sensitive: stripSensitive,
      });
      setEditing(false);
      // 重新加载
      const fresh = await fetchExportRules(detail.id);
      setRules(fresh);
      onSaved();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-[9px] text-gray-400 animate-pulse">加载导出规则...</div>;
  }

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">导出规则管理</span>
        <PixelButton size="sm" onClick={() => setEditing(true)} disabled={editing}>+ 新增规则</PixelButton>
      </div>

      {/* 已有规则列表 */}
      {rules.map((rule) => (
        <div key={rule.id} className="flex items-center gap-3 py-1.5 border-b border-gray-100 text-[9px]">
          <span className="font-bold">{rule.role_group_name}</span>
          <span className="text-gray-400">{rule.allowed_formats.join(", ")}</span>
          {rule.max_rows !== null && <span className="text-gray-400">上限 {rule.max_rows}</span>}
          {rule.requires_approval && <span className="text-orange-500 text-[7px] font-bold">需审批</span>}
          {rule.watermark && <span className="text-blue-500 text-[7px] font-bold">水印</span>}
          {rule.strip_sensitive && <span className="text-red-500 text-[7px] font-bold">剥离敏感</span>}
        </div>
      ))}
      {rules.length === 0 && !editing && (
        <div className="text-[9px] text-gray-400 py-2">暂无导出规则</div>
      )}

      {/* 新增表单 */}
      {editing && (
        <div className="border-2 border-[#00D1FF] p-2 mt-2 space-y-2">
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">角色组</label>
            <select
              value={roleGroupId ?? ""}
              onChange={(e) => setRoleGroupId(e.target.value ? Number(e.target.value) : null)}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
            >
              <option value="">选择角色组</option>
              {detail.role_groups.map((rg) => (
                <option key={rg.id} value={rg.id}>{rg.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">允许格式</label>
            <div className="flex gap-2">
              {ALL_FORMATS.map((f) => (
                <label key={f.value} className="flex items-center gap-1 text-[8px] cursor-pointer">
                  <input type="checkbox" checked={formats.includes(f.value)} onChange={() => toggleFormat(f.value)} className="w-3 h-3" />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] text-gray-400 font-bold uppercase block mb-0.5">最大行数</label>
              <input
                value={maxRows}
                onChange={(e) => setMaxRows(e.target.value)}
                placeholder="不限"
                className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-1 text-[8px] cursor-pointer">
              <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} className="w-3 h-3" />
              需审批
            </label>
            <label className="flex items-center gap-1 text-[8px] cursor-pointer">
              <input type="checkbox" checked={watermark} onChange={(e) => setWatermark(e.target.checked)} className="w-3 h-3" />
              加水印
            </label>
            <label className="flex items-center gap-1 text-[8px] cursor-pointer">
              <input type="checkbox" checked={stripSensitive} onChange={(e) => setStripSensitive(e.target.checked)} className="w-3 h-3" />
              剥离敏感字段
            </label>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <PixelButton size="sm" onClick={handleSave} disabled={saving || !roleGroupId || formats.length === 0}>
              {saving ? "保存中..." : "保存"}
            </PixelButton>
            <button onClick={() => setEditing(false)} className="text-[8px] text-gray-400 hover:text-[#1A202C]">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
