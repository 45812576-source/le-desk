"use client";

import React, { useState } from "react";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import { useV2DataAssets } from "../shared/feature-flags";
import { updateFieldTags, batchUpdateFieldTags } from "../shared/api";
import type { TableDetail, TableFieldDetail, FieldValueDictionary } from "../shared/types";
import {
  SENSITIVITY_LABELS,
  SENSITIVITY_COLORS,
  LIFECYCLE_LABELS,
  LIFECYCLE_STYLES,
  type SensitivityLevel,
  type TableFieldDetailV2,
  type TableDetailV2,
} from "../shared/types";
import FieldImpactPanel from "./fields/FieldImpactPanel";

const TYPE_COLORS: Record<string, string> = {
  text: "bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-muted-foreground",
  number: "bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400",
  single_select: "bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400",
  multi_select: "bg-purple-50 dark:bg-purple-950 text-purple-500 dark:text-purple-400",
  date: "bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400",
  datetime: "bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400",
  boolean: "bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400",
  person: "bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400",
  url: "bg-indigo-50 dark:bg-indigo-950 text-indigo-500 dark:text-indigo-400",
  email: "bg-indigo-50 dark:bg-indigo-950 text-indigo-500 dark:text-indigo-400",
  phone: "bg-teal-50 dark:bg-teal-950 text-teal-500 dark:text-teal-400",
  json: "bg-yellow-50 dark:bg-yellow-950 text-yellow-600 dark:text-yellow-400",
  attachment: "bg-pink-50 dark:bg-pink-950 text-pink-500 dark:text-pink-400",
};

const ROLE_TAG_LABELS: Record<string, { label: string; color: string }> = {
  dimension: { label: "维度", color: "bg-blue-50 dark:bg-blue-950 text-blue-500 dark:text-blue-400" },
  metric: { label: "指标", color: "bg-green-50 dark:bg-green-950 text-green-500 dark:text-green-400" },
  identifier: { label: "标识", color: "bg-purple-50 dark:bg-purple-950 text-purple-500 dark:text-purple-400" },
  sensitive: { label: "敏感", color: "bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400" },
  derived: { label: "衍生", color: "bg-orange-50 dark:bg-orange-950 text-orange-500 dark:text-orange-400" },
  system: { label: "系统", color: "bg-gray-50 dark:bg-gray-900 text-muted-foreground" },
};

const SENSITIVITY_OPTIONS = Object.entries(SENSITIVITY_LABELS) as [SensitivityLevel, string][];

// ─── 行背景色（按敏感级别渐变） ──
function sensitivityRowBg(level?: SensitivityLevel): string {
  switch (level) {
    case "S2_sensitive": return "bg-yellow-50/40 dark:bg-yellow-950/40";
    case "S3_confidential": return "bg-orange-50/40 dark:bg-orange-950/40";
    case "S4_restricted": return "bg-red-50/40 dark:bg-red-950/40";
    default: return "";
  }
}

function FieldDictionaryPanel({ fieldId, onClose }: { fieldId: number; onClose: () => void }) {
  const [entries, setEntries] = React.useState<FieldValueDictionary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newValue, setNewValue] = React.useState("");

  React.useEffect(() => {
    apiFetch<{ items: FieldValueDictionary[] }>(`/data-assets/fields/${fieldId}/dictionary`)
      .then((d) => setEntries(d.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fieldId]);

  async function handleAdd() {
    if (!newValue.trim()) return;
    try {
      const entry = await apiFetch<FieldValueDictionary>(`/data-assets/fields/${fieldId}/enum-values`, {
        method: "POST",
        body: JSON.stringify({ value: newValue.trim() }),
      });
      setEntries((prev) => [...prev, entry]);
      setNewValue("");
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "添加失败");
    }
  }

  async function handleDelete(valueId: number) {
    await apiFetch(`/data-assets/fields/${fieldId}/enum-values/${valueId}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== valueId));
  }

  if (loading) return <div className="p-2 text-[9px] text-muted-foreground animate-pulse">Loading...</div>;

  return (
    <div className="border-2 border-[#00D1FF] bg-card p-3 mt-1 mb-2 mx-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">枚举值字典</span>
        <button onClick={onClose} className="text-[8px] text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-[9px] py-0.5">
            <span className={`px-1.5 py-px rounded ${e.is_active ? "bg-muted" : "bg-muted text-muted-foreground line-through"}`}>
              {e.value}
            </span>
            {e.label && <span className="text-muted-foreground">({e.label})</span>}
            <span className="text-[7px] text-muted-foreground ml-auto">{e.source}</span>
            {e.hit_count > 0 && <span className="text-[7px] text-muted-foreground">{e.hit_count}次</span>}
            <button onClick={() => handleDelete(e.id)} className="text-[8px] text-muted-foreground hover:text-red-400">✕</button>
          </div>
        ))}
        {entries.length === 0 && <div className="text-[8px] text-muted-foreground">暂无枚举值</div>}
      </div>
      <div className="flex items-center gap-1 mt-2">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="新增枚举值..."
          className="flex-1 text-[9px] border border-border bg-background text-foreground px-1.5 py-0.5 focus:outline-none focus:border-[#00D1FF]"
        />
        <PixelButton size="sm" onClick={handleAdd}>+</PixelButton>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  detail,
  isV2,
  onRefresh,
}: {
  field: TableFieldDetail;
  detail: TableDetail;
  isV2: boolean;
  onRefresh: () => void;
}) {
  const typeColor = TYPE_COLORS[field.field_type] || TYPE_COLORS.text;
  const [showDict, setShowDict] = useState(false);
  const [showImpact, setShowImpact] = useState(false);

  // V2 字段扩展
  const v2Field = field as TableFieldDetailV2;
  const sensitivityLevel = v2Field.sensitivity_level;
  const lifecycleStatus = v2Field.lifecycle_status;
  const isDeprecatedOrArchived = lifecycleStatus === "deprecated" || lifecycleStatus === "archived";

  // 字段被哪些视图使用
  const usedByViews = detail.views.filter((v) =>
    v.visible_field_ids?.length > 0 && field.id !== null && v.visible_field_ids.includes(field.id)
  );
  const usedByGrants = detail.skill_grants?.filter((g) =>
    g.field_rule_override_json && Object.keys(g.field_rule_override_json).length > 0
  ) || [];

  async function toggleSensitive() {
    if (!field.id) return;
    try {
      await apiFetch(`/data-assets/fields/${field.id}/tags`, {
        method: "PATCH",
        body: JSON.stringify({ is_sensitive: !field.is_sensitive }),
      });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  async function handleSensitivityChange(level: SensitivityLevel) {
    if (!field.id) return;
    try {
      // S2 及以上同步 is_sensitive = true
      const isSensitive = level >= "S2_sensitive";
      await updateFieldTags(field.id, { sensitivity_level: level, is_sensitive: isSensitive });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  async function handleConfirmLifecycle() {
    if (!field.id) return;
    try {
      await updateFieldTags(field.id, { lifecycle_status: "confirmed" });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  }

  const rowBg = isV2 ? sensitivityRowBg(sensitivityLevel) : "";

  return (
    <>
      <div className={`flex items-center gap-3 px-4 py-2 border-b border-border hover:bg-muted transition-colors ${rowBg} ${isDeprecatedOrArchived && isV2 ? "opacity-50" : ""}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold">{field.display_name || field.field_name}</span>
            {field.is_system && (
              <span className="text-[7px] font-bold px-1 py-px bg-muted text-muted-foreground rounded">SYS</span>
            )}
            {/* V2: 生命周期标签 */}
            {isV2 && lifecycleStatus && (
              <span className={`text-[7px] font-bold px-1 py-px border rounded ${LIFECYCLE_STYLES[lifecycleStatus]}`}>
                {LIFECYCLE_LABELS[lifecycleStatus]}
              </span>
            )}
            {/* V2: inferred 状态确认按钮 */}
            {isV2 && lifecycleStatus === "inferred" && field.id && (
              <button
                onClick={handleConfirmLifecycle}
                className="text-[7px] font-bold px-1 py-px bg-green-50 dark:bg-green-950 text-green-500 dark:text-green-400 border border-green-200 dark:border-green-800 rounded hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
              >
                确认
              </button>
            )}
            {/* V1: 原有敏感标记（V2 下用下拉替代） */}
            {!isV2 && field.is_sensitive && (
              <span className="text-[7px] font-bold px-1 py-px bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 rounded">敏感</span>
            )}
            {field.is_enum && (
              <span className="text-[7px] font-bold px-1 py-px bg-purple-50 dark:bg-purple-950 text-purple-500 dark:text-purple-400 rounded cursor-pointer" onClick={() => setShowDict(!showDict)}>
                枚举
              </span>
            )}
            {field.is_free_text && (
              <span className="text-[7px] font-bold px-1 py-px bg-muted text-muted-foreground rounded">自由文本</span>
            )}
          </div>
          {field.display_name && field.display_name !== field.field_name && (
            <span className="text-[8px] font-mono text-muted-foreground">{field.field_name}</span>
          )}
          {field.field_role_tags?.length > 0 && (
            <div className="flex gap-1 mt-0.5">
              {field.field_role_tags.map((tag) => {
                const info = ROLE_TAG_LABELS[tag];
                return info ? (
                  <span key={tag} className={`text-[7px] font-bold px-1 py-px rounded ${info.color}`}>{info.label}</span>
                ) : null;
              })}
            </div>
          )}
          {field.description && (
            <p className="text-[8px] text-muted-foreground mt-0.5 truncate">{field.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${typeColor}`}>{field.field_type}</span>
          {field.enum_values.length > 0 && (
            <span
              className="text-[8px] text-purple-500 cursor-pointer hover:underline"
              title={field.enum_values.join(", ")}
              onClick={() => field.id && setShowDict(!showDict)}
            >
              {field.enum_values.length} 选项
              {field.enum_source === "observed" && <span className="text-[7px] text-muted-foreground ml-0.5">(推断)</span>}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {field.is_filterable && <span className="text-[7px] px-1 py-px bg-blue-50 dark:bg-blue-950 text-blue-400" title="可筛选">F</span>}
          {field.is_groupable && <span className="text-[7px] px-1 py-px bg-green-50 dark:bg-green-950 text-green-400" title="可分组">G</span>}
          {field.is_sortable && <span className="text-[7px] px-1 py-px bg-orange-50 dark:bg-orange-950 text-orange-400" title="可排序">S</span>}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {usedByViews.length > 0 && (
            <span className="text-[7px] text-[#00A3C4]" title={usedByViews.map((v) => v.name).join(", ")}>{usedByViews.length} 视图</span>
          )}
          {usedByGrants.length > 0 && (
            <span className="text-[7px] text-green-500">{usedByGrants.length} Skill</span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 text-[8px] text-muted-foreground w-32 justify-end">
          {field.distinct_count !== null && (
            <span title="唯一值数">{field.distinct_count} 种</span>
          )}
          {field.null_ratio !== null && (
            <span title="空值率">{(field.null_ratio * 100).toFixed(1)}% null</span>
          )}

          {/* V2: S0-S4 敏感分级下拉 */}
          {isV2 && field.id ? (
            <select
              value={sensitivityLevel || "S0_public"}
              onChange={(e) => handleSensitivityChange(e.target.value as SensitivityLevel)}
              className={`text-[7px] font-bold px-1 py-px border rounded cursor-pointer appearance-none bg-card ${
                SENSITIVITY_COLORS[sensitivityLevel] || "border-border text-muted-foreground"
              }`}
              title="敏感分级"
            >
              {SENSITIVITY_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          ) : (
            /* V1: 原有 🔒 按钮 */
            field.id && (
              <button
                onClick={toggleSensitive}
                className={`text-[7px] px-1 py-px border rounded transition-colors ${
                  field.is_sensitive ? "border-red-300 dark:border-red-700 text-red-400 bg-red-50 dark:bg-red-950" : "border-border text-muted-foreground hover:text-red-400"
                }`}
                title={field.is_sensitive ? "取消敏感标记" : "标记为敏感"}
              >
                敏感
              </button>
            )
          )}

          {/* V2: 影响按钮 */}
          {isV2 && field.id && (
            <button
              onClick={() => setShowImpact(!showImpact)}
              className={`text-[7px] px-1 py-px border rounded transition-colors ${
                showImpact ? "border-[#00D1FF] text-[#00A3C4] bg-[#F0FBFF] dark:bg-[#0A2A3A]" : "border-border text-muted-foreground hover:text-[#00A3C4]"
              }`}
              title="查看字段影响"
            >
              影响
            </button>
          )}
        </div>
      </div>
      {showDict && field.id && (
        <FieldDictionaryPanel fieldId={field.id} onClose={() => setShowDict(false)} />
      )}
      {showImpact && field.id && (
        <FieldImpactPanel fieldId={field.id} fieldName={field.display_name || field.field_name} onClose={() => setShowImpact(false)} />
      )}
    </>
  );
}

interface EnumSuggestion {
  field_id: number;
  field_name: string;
  display_name: string | null;
  distinct_count: number;
  suggested_values: string[];
}

function EnumSuggestionsPanel({ tableId, onRefresh }: { tableId: number; onRefresh: () => void }) {
  const [suggestions, setSuggestions] = React.useState<EnumSuggestion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [upgrading, setUpgrading] = React.useState<number | null>(null);

  React.useEffect(() => {
    apiFetch<{ suggestions: EnumSuggestion[] }>(`/data-assets/tables/${tableId}/enum-suggestions`)
      .then((d) => setSuggestions(d.suggestions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tableId]);

  async function handleUpgrade(fieldId: number) {
    setUpgrading(fieldId);
    try {
      await apiFetch(`/data-assets/fields/${fieldId}/tags`, {
        method: "PATCH",
        body: JSON.stringify({ is_free_text: false, is_enum: true }),
      });
      setSuggestions((prev) => prev.filter((s) => s.field_id !== fieldId));
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "升级失败");
    } finally {
      setUpgrading(null);
    }
  }

  if (loading || suggestions.length === 0) return null;

  return (
    <div className="mx-4 my-2 border-2 border-[#00CC99] bg-green-50 dark:bg-green-950 p-2">
      <div className="text-[8px] font-bold uppercase tracking-widest text-green-600 mb-1">
        枚举升级建议 ({suggestions.length})
      </div>
      {suggestions.map((s) => (
        <div key={s.field_id} className="flex items-center gap-2 py-1 text-[9px]">
          <span className="font-bold">{s.display_name || s.field_name}</span>
          <span className="text-muted-foreground">{s.distinct_count} 个不同值</span>
          <span className="text-[8px] text-muted-foreground truncate max-w-[200px]" title={s.suggested_values.join(", ")}>
            {s.suggested_values.slice(0, 5).join(", ")}
          </span>
          <PixelButton
            size="sm"
            onClick={() => handleUpgrade(s.field_id)}
            disabled={upgrading === s.field_id}
          >
            {upgrading === s.field_id ? "..." : "升级为枚举"}
          </PixelButton>
        </div>
      ))}
    </div>
  );
}

function BatchActionsBar({
  selectedIds,
  isV2,
  onClear,
  onRefresh,
}: {
  selectedIds: Set<number>;
  isV2: boolean;
  onClear: () => void;
  onRefresh: () => void;
}) {
  const [acting, setActing] = useState(false);

  async function handleBatchSensitive(value: boolean) {
    setActing(true);
    try {
      await apiFetch("/data-assets/fields/batch-tags", {
        method: "PATCH",
        body: JSON.stringify({ field_ids: [...selectedIds], is_sensitive: value }),
      });
      onClear();
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActing(false);
    }
  }

  async function handleBatchSensitivityLevel(level: SensitivityLevel) {
    setActing(true);
    try {
      const isSensitive = level >= "S2_sensitive";
      await batchUpdateFieldTags([...selectedIds], { sensitivity_level: level, is_sensitive: isSensitive });
      onClear();
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActing(false);
    }
  }

  if (selectedIds.size === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-[#F0FBFF] dark:bg-[#0A2A3A] border-b border-[#00D1FF]">
      <span className="text-[9px] font-bold text-[#00A3C4]">已选 {selectedIds.size} 个字段</span>
      {isV2 ? (
        <>
          <select
            onChange={(e) => { if (e.target.value) handleBatchSensitivityLevel(e.target.value as SensitivityLevel); }}
            disabled={acting}
            className="text-[8px] font-bold border border-[#00D1FF] rounded px-1 py-0.5 bg-card text-foreground cursor-pointer"
            defaultValue=""
          >
            <option value="" disabled>批量设置敏感级别...</option>
            {SENSITIVITY_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </>
      ) : (
        <>
          <PixelButton size="sm" onClick={() => handleBatchSensitive(true)} disabled={acting}>标记敏感</PixelButton>
          <PixelButton size="sm" onClick={() => handleBatchSensitive(false)} disabled={acting}>取消敏感</PixelButton>
        </>
      )}
      <button onClick={onClear} className="text-[8px] text-muted-foreground hover:text-foreground ml-auto">清除选择</button>
    </div>
  );
}

interface Props {
  detail: TableDetail;
  onRefresh?: () => void;
}

export default function FieldsTab({ detail, onRefresh }: Props) {
  const isV2 = useV2DataAssets();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  function toggleSelect(fieldId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId); else next.add(fieldId);
      return next;
    });
  }

  if (detail.fields.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground uppercase tracking-widest">
        {detail.field_profile_status === "pending" ? "字段画像待分析" : "暂无字段信息"}
      </div>
    );
  }

  return (
    <div>
      <EnumSuggestionsPanel tableId={detail.id} onRefresh={onRefresh || (() => {})} />
      <BatchActionsBar
        selectedIds={selectedIds}
        isV2={isV2}
        onClear={() => setSelectedIds(new Set())}
        onRefresh={onRefresh || (() => {})}
      />
      <div className="flex items-center gap-4 px-4 py-2 border-b-2 border-border bg-muted text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
        <input
          type="checkbox"
          checked={selectedIds.size === detail.fields.filter((f) => f.id).length}
          onChange={() => {
            const allIds = detail.fields.filter((f) => f.id).map((f) => f.id!);
            setSelectedIds((prev) => prev.size === allIds.length ? new Set() : new Set(allIds));
          }}
          className="w-3 h-3"
        />
        <span className="flex-1">字段</span>
        <span className="w-20">类型</span>
        <span className="w-12">能力</span>
        <span className="w-16">引用</span>
        <span className="w-32 text-right">统计</span>
      </div>
      {detail.fields.map((f) => (
        <div key={f.id ?? f.field_name} className="flex items-start">
          {f.id && (
            <div className="flex items-center px-1 pt-3">
              <input
                type="checkbox"
                checked={selectedIds.has(f.id)}
                onChange={() => toggleSelect(f.id!)}
                className="w-3 h-3"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <FieldRow field={f} detail={detail} isV2={isV2} onRefresh={onRefresh || (() => {})} />
          </div>
        </div>
      ))}
    </div>
  );
}
