"use client";

import React, { useState, useMemo } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type {
  TableDetail,
  TablePermissionPolicy,
  RowAccessMode,
  FieldAccessMode,
  DisclosureLevel,
} from "../../shared/types";
import { DISCLOSURE_LABELS } from "../../shared/types";
import ScenarioSelector, { type ScenarioPreset } from "./ScenarioSelector";

type WizardStep = 1 | 2 | 3 | 4;
const STEP_LABELS: Record<WizardStep, string> = {
  1: "让谁看",
  2: "看什么",
  3: "什么程度",
  4: "为什么",
};

interface WizardState {
  role_group_id: number | null;
  view_id: number | null;
  row_access_mode: RowAccessMode;
  field_access_mode: FieldAccessMode;
  allowed_field_ids: number[];
  blocked_field_ids: number[];
  disclosure_level: DisclosureLevel;
  masking_sensitive: boolean;
  export_permission: boolean;
  tool_permission_mode: string;
  reason_template: string;
}

const INITIAL_STATE: WizardState = {
  role_group_id: null,
  view_id: null,
  row_access_mode: "all",
  field_access_mode: "all",
  allowed_field_ids: [],
  blocked_field_ids: [],
  disclosure_level: "L2",
  masking_sensitive: true,
  export_permission: false,
  tool_permission_mode: "allow",
  reason_template: "",
};

interface Props {
  detail: TableDetail;
  onSaved: () => void;
}

export default function PermissionWizard({ detail, onSaved }: Props) {
  const [step, setStep] = useState<WizardStep>(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [scenarioId, setScenarioId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function applyScenario(s: ScenarioPreset) {
    setScenarioId(s.id);
    setState((prev) => ({
      ...prev,
      row_access_mode: s.defaults.row_access_mode,
      field_access_mode: s.defaults.field_access_mode,
      disclosure_level: s.defaults.disclosure_level,
      export_permission: s.defaults.export_permission,
      masking_sensitive: s.defaults.masking_sensitive,
    }));
  }

  // 即时预览摘要
  const previewSummary = useMemo(() => {
    const group = detail.role_groups.find((rg) => rg.id === state.role_group_id);
    const fieldCount = state.field_access_mode === "all"
      ? detail.fields.length
      : state.field_access_mode === "allowlist"
        ? state.allowed_field_ids.length
        : detail.fields.length - state.blocked_field_ids.length;
    const rowLabel: Record<string, string> = { none: "禁止", all: "全部", owner: "归属人", department: "部门", rule: "自定义" };
    return {
      groupName: group?.name || "未选择",
      fieldCount,
      rowLabel: rowLabel[state.row_access_mode] || state.row_access_mode,
      disclosure: DISCLOSURE_LABELS[state.disclosure_level],
    };
  }, [state, detail]);

  async function handleSave() {
    if (!state.role_group_id) return;
    setSaving(true);
    setError("");
    try {
      const masking_rule_json: Record<string, unknown> = {};
      if (state.masking_sensitive) {
        for (const f of detail.fields) {
          if (f.is_sensitive && f.id) {
            masking_rule_json[String(f.id)] = "full_mask";
          }
        }
      }

      const payload: Partial<TablePermissionPolicy> = {
        table_id: detail.id,
        view_id: state.view_id,
        role_group_id: state.role_group_id,
        row_access_mode: state.row_access_mode,
        row_rule_json: {},
        field_access_mode: state.field_access_mode,
        allowed_field_ids: state.allowed_field_ids,
        blocked_field_ids: state.blocked_field_ids,
        disclosure_level: state.disclosure_level,
        masking_rule_json,
        tool_permission_mode: state.tool_permission_mode,
        export_permission: state.export_permission,
        reason_template: state.reason_template || null,
      };

      // 查找是否已有策略
      const existing = detail.permission_policies.find(
        (p) => p.role_group_id === state.role_group_id && p.view_id === (state.view_id || null)
      );

      if (existing) {
        await apiFetch(`/data-assets/policies/${existing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/data-assets/tables/${detail.id}/policies`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  // 检测是否有超出向导能力的策略
  const hasAdvancedPolicies = detail.permission_policies.some(
    (p) => p.row_access_mode === "rule" && Object.keys(p.row_rule_json).length > 0
  );

  return (
    <div className="border-2 border-[#00D1FF] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">权限配置向导</span>
        <div className="flex items-center gap-1">
          {([1, 2, 3, 4] as WizardStep[]).map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`text-[8px] font-bold px-2 py-0.5 border transition-colors ${
                step === s
                  ? "border-[#00D1FF] bg-[#00D1FF] text-white"
                  : step > s
                    ? "border-green-300 bg-green-50 text-green-600"
                    : "border-gray-200 text-gray-400"
              }`}
            >
              {s}. {STEP_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* 即时预览条 */}
      <div className="flex items-center gap-3 px-2 py-1 bg-[#EBF4F7] mb-3 text-[8px] text-gray-500">
        <span>角色: <b className="text-[#1A202C]">{previewSummary.groupName}</b></span>
        <span>字段: <b className="text-[#1A202C]">{previewSummary.fieldCount}</b></span>
        <span>行: <b className="text-[#1A202C]">{previewSummary.rowLabel}</b></span>
        <span>披露: <b className="text-[#1A202C]">{previewSummary.disclosure}</b></span>
      </div>

      {/* 高级策略提示 */}
      {hasAdvancedPolicies && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-orange-50 border border-orange-200 text-[8px] text-orange-600 font-bold mb-3">
          <span>⚠</span>
          <span>此表含高级策略（自定义行规则），在向导中为只读，请使用专家模式编辑</span>
        </div>
      )}

      {/* Step 1: 让谁看 */}
      {step === 1 && (
        <div className="space-y-3">
          <ScenarioSelector onSelect={applyScenario} selectedId={scenarioId} />
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">角色组</label>
            <select
              value={state.role_group_id ?? ""}
              onChange={(e) => setState({ ...state, role_group_id: e.target.value ? Number(e.target.value) : null })}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
            >
              <option value="">选择角色组</option>
              {detail.role_groups.map((rg) => (
                <option key={rg.id} value={rg.id}>{rg.name} ({rg.group_type})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">视图（可选）</label>
            <select
              value={state.view_id ?? ""}
              onChange={(e) => setState({ ...state, view_id: e.target.value ? Number(e.target.value) : null })}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
            >
              <option value="">表级策略</option>
              {detail.views.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Step 2: 看什么 */}
      {step === 2 && (
        <div className="space-y-3">
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">行权限</label>
            <select
              value={state.row_access_mode}
              onChange={(e) => setState({ ...state, row_access_mode: e.target.value as RowAccessMode })}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
            >
              <option value="none">禁止</option>
              <option value="all">全部行</option>
              <option value="owner">仅归属人的行</option>
              <option value="department">仅本部门的行</option>
            </select>
          </div>
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">字段权限</label>
            <select
              value={state.field_access_mode}
              onChange={(e) => setState({ ...state, field_access_mode: e.target.value as FieldAccessMode })}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
            >
              <option value="all">全部字段</option>
              <option value="allowlist">白名单</option>
              <option value="blocklist">黑名单</option>
            </select>
          </div>
          {state.field_access_mode === "allowlist" && (
            <div>
              <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">
                允许的字段 ({state.allowed_field_ids.length})
              </label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {detail.fields.filter((f) => !f.is_system && f.id).map((f) => {
                  const checked = state.allowed_field_ids.includes(f.id!);
                  return (
                    <label key={f.id} className={`text-[8px] px-1.5 py-0.5 border rounded cursor-pointer transition-colors ${
                      checked ? "border-[#00D1FF] bg-[#F0FBFF] text-[#00A3C4]" : "border-gray-200 text-gray-400"
                    }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const ids = checked
                            ? state.allowed_field_ids.filter((id) => id !== f.id)
                            : [...state.allowed_field_ids, f.id!];
                          setState({ ...state, allowed_field_ids: ids });
                        }}
                        className="hidden"
                      />
                      {f.display_name || f.field_name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {state.field_access_mode === "blocklist" && (
            <div>
              <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">
                屏蔽的字段 ({state.blocked_field_ids.length})
              </label>
              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                {detail.fields.filter((f) => !f.is_system && f.id).map((f) => {
                  const checked = state.blocked_field_ids.includes(f.id!);
                  return (
                    <label key={f.id} className={`text-[8px] px-1.5 py-0.5 border rounded cursor-pointer transition-colors ${
                      checked ? "border-red-300 bg-red-50 text-red-500" : "border-gray-200 text-gray-400"
                    }`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const ids = checked
                            ? state.blocked_field_ids.filter((id) => id !== f.id)
                            : [...state.blocked_field_ids, f.id!];
                          setState({ ...state, blocked_field_ids: ids });
                        }}
                        className="hidden"
                      />
                      {f.display_name || f.field_name}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: 什么程度 */}
      {step === 3 && (
        <div className="space-y-3">
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">披露级别</label>
            <select
              value={state.disclosure_level}
              onChange={(e) => setState({ ...state, disclosure_level: e.target.value as DisclosureLevel })}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
            >
              {Object.entries(DISCLOSURE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-[9px] cursor-pointer">
              <input
                type="checkbox"
                checked={state.masking_sensitive}
                onChange={(e) => setState({ ...state, masking_sensitive: e.target.checked })}
                className="w-3 h-3"
              />
              <span>敏感字段自动脱敏</span>
            </label>
            <label className="flex items-center gap-1 text-[9px] cursor-pointer">
              <input
                type="checkbox"
                checked={state.export_permission}
                onChange={(e) => setState({ ...state, export_permission: e.target.checked })}
                className="w-3 h-3"
              />
              <span>允许导出</span>
            </label>
          </div>
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">Tool 调用</label>
            <select
              value={state.tool_permission_mode}
              onChange={(e) => setState({ ...state, tool_permission_mode: e.target.value })}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-0.5 bg-white"
            >
              <option value="allow">允许</option>
              <option value="deny">禁止</option>
              <option value="approval">需审批</option>
            </select>
          </div>
        </div>
      )}

      {/* Step 4: 为什么 */}
      {step === 4 && (
        <div className="space-y-3">
          <div>
            <label className="text-[8px] text-gray-400 font-bold uppercase block mb-1">原因模板（可选）</label>
            <textarea
              value={state.reason_template}
              onChange={(e) => setState({ ...state, reason_template: e.target.value })}
              placeholder="说明为何授予此权限，如: 运营部需要查看客户数据以进行季度分析"
              rows={3}
              className="w-full text-[9px] border border-gray-300 px-1.5 py-1 resize-none"
            />
          </div>
        </div>
      )}

      {/* 导航 + 保存 */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
        <div className="flex items-center gap-1">
          {step > 1 && (
            <PixelButton size="sm" variant="secondary" onClick={() => setStep((step - 1) as WizardStep)}>
              上一步
            </PixelButton>
          )}
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-[8px] text-red-500">{error}</span>}
          {step < 4 ? (
            <PixelButton size="sm" onClick={() => setStep((step + 1) as WizardStep)}>
              下一步
            </PixelButton>
          ) : (
            <PixelButton size="sm" onClick={handleSave} disabled={saving || !state.role_group_id}>
              {saving ? "保存中..." : "保存策略"}
            </PixelButton>
          )}
        </div>
      </div>
    </div>
  );
}
