"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2, CheckCircle2, Pencil, Plus, X } from "lucide-react";
import type { Department, OrgMemorySnapshot, SkillDetail, User } from "@/lib/types";
import type {
  BoundAssetItem,
  MountedPermissions,
  RoleAssetPolicyItem,
  ServiceRoleItem,
  SensitiveFieldSummaryItem,
} from "./SkillGovernanceCards";
import { extractSensitiveFieldSummary, extractPermissionSummary } from "./SkillGovernanceCards";
import {
  recommendationToServiceRole,
  recommendRoleList,
  type PositionLite,
} from "./role-recommendation";

type WizardPhase = "idle" | "running" | "review" | "confirming" | "done";

type StepLabel = string;

export function SimpleGovernanceWizard({
  skill,
  user,
  roles,
  assets,
  policies,
  mountedPermissions,
  loading,
  snapshots,
  departments,
  positions,
  onSaveRoles,
  onGeneratePolicies,
  onGenerateDeclaration,
  onMountDeclaration,
  onSaveGranularRule,
  canAutoSetup = true,
  autoSetupBlockedReason,
  autoStart = false,
  autoStartReason,
}: {
  skill: SkillDetail;
  user: User | null;
  roles: ServiceRoleItem[];
  assets: BoundAssetItem[];
  policies: RoleAssetPolicyItem[];
  mountedPermissions: MountedPermissions | null;
  loading: boolean;
  snapshots: OrgMemorySnapshot[];
  departments: Department[];
  positions: PositionLite[];
  onSaveRoles: (roles: ServiceRoleItem[]) => Promise<void>;
  onGeneratePolicies: () => Promise<void>;
  onGenerateDeclaration: () => Promise<void>;
  onMountDeclaration: () => Promise<void>;
  onSaveGranularRule: (
    policyId: number,
    ruleId: number,
    payload: { suggested_policy?: string; mask_style?: string | null; confirmed?: boolean },
  ) => Promise<void>;
  canAutoSetup?: boolean;
  autoSetupBlockedReason?: string | null;
  autoStart?: boolean;
  autoStartReason?: string | null;
}) {
  const [phase, setPhase] = useState<WizardPhase>("idle");
  const [step, setStep] = useState<StepLabel>("");
  const [error, setError] = useState<string | null>(null);

  // review 阶段 - 角色编辑
  const [reviewRoles, setReviewRoles] = useState<ServiceRoleItem[]>([]);
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleDept, setNewRoleDept] = useState("");
  const [newRolePosition, setNewRolePosition] = useState("");

  // review 阶段 - 敏感字段编辑
  const [fieldDrafts, setFieldDrafts] = useState<Record<number, SensitiveFieldSummaryItem["currentPolicy"]>>({});

  const sensitiveFields = useMemo(() => extractSensitiveFieldSummary(policies), [policies]);
  const permissionSummary = useMemo(() => extractPermissionSummary(mountedPermissions), [mountedPermissions]);

  // autoStart：外部触发时（如 mount_blocked）自动启动 wizard
  const autoStartFired = useRef(false);

  const runAutoSetup = useCallback(async () => {
    setPhase("running");
    setError(null);

    try {
      // 1. 自动推荐角色
      setStep("正在分析谁会用这个技能...");
      if (roles.length === 0) {
        const recommended = recommendRoleList({
          skill,
          assets: assets.map((a) => ({ asset_name: a.asset_name, asset_type: a.asset_type, risk_flags: a.risk_flags })),
          snapshots,
          departments,
          positions,
          user,
        });
        const newRoles = recommended.items.map(recommendationToServiceRole) as ServiceRoleItem[];
        if (newRoles.length === 0) {
          throw new Error("未能自动推荐可用岗位，请先到详细设置补充服务岗位。");
        }
        await onSaveRoles(newRoles);
      }

      // 2. 自动生成策略
      setStep("正在分析数据的安全等级...");
      await onGeneratePolicies();

      // 3. 自动生成声明
      setStep("正在生成使用规则...");
      await onGenerateDeclaration();

      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "自动设置失败，请重试");
      setPhase("idle");
    }
  }, [assets, departments, onGenerateDeclaration, onGeneratePolicies, onSaveRoles, positions, roles.length, skill, snapshots, user]);

  // autoStart 触发：用 ref callback 在 idle 按钮挂载时自动点击
  const autoStartButtonRef = useCallback(
    (node: HTMLButtonElement | null) => {
      if (node && autoStart && !autoStartFired.current && !loading) {
        autoStartFired.current = true;
        // 延迟一帧确保 React 渲染完成
        requestAnimationFrame(() => node.click());
      }
    },
    [autoStart, loading],
  );

  // review 阶段初始化已有角色
  const displayRoles = phase === "review" && reviewRoles.length === 0 ? roles : reviewRoles;

  const handleConfirmReview = useCallback(async () => {
    setPhase("confirming");
    setError(null);
    try {
      // 保存角色变更
      if (reviewRoles.length > 0) {
        await onSaveRoles(reviewRoles);
      }

      // 保存敏感字段变更
      for (const field of sensitiveFields) {
        const draft = fieldDrafts[field.ruleId];
        if (draft && draft !== field.currentPolicy) {
          const maskStyle = draft === "full" ? "full" : draft === "partial" ? "partial" : null;
          const suggestedPolicy = draft === "full" ? "deny" : draft === "partial" ? "mask" : "allow";
          await onSaveGranularRule(field.policyId, field.ruleId, {
            suggested_policy: suggestedPolicy,
            mask_style: maskStyle,
            confirmed: true,
          });
        }
      }

      // 重新生成声明（如果有变更）
      if (reviewRoles.length > 0 || Object.keys(fieldDrafts).length > 0) {
        await onGenerateDeclaration();
      }

      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setPhase("review");
    }
  }, [fieldDrafts, onGenerateDeclaration, onSaveGranularRule, onSaveRoles, reviewRoles, sensitiveFields]);

  const handleFinalConfirm = useCallback(async () => {
    setError(null);
    try {
      await onMountDeclaration();
    } catch (err) {
      setError(err instanceof Error ? err.message : "启用失败");
    }
  }, [onMountDeclaration]);

  const handleAddRole = useCallback(() => {
    if (!newRoleDept || !newRolePosition) return;
    const newRole: ServiceRoleItem = {
      id: -Date.now(),
      org_path: newRoleDept,
      position_name: newRolePosition,
      position_level: "",
      role_label: `${newRoleDept} · ${newRolePosition}`,
      status: "active",
    };
    const base = reviewRoles.length > 0 ? reviewRoles : [...roles];
    setReviewRoles([...base, newRole]);
    setNewRoleDept("");
    setNewRolePosition("");
    setAddingRole(false);
  }, [newRoleDept, newRolePosition, reviewRoles, roles]);

  const handleRemoveRole = useCallback((index: number) => {
    const base = reviewRoles.length > 0 ? [...reviewRoles] : [...roles];
    base.splice(index, 1);
    setReviewRoles(base);
  }, [reviewRoles, roles]);

  // ─── idle：一键开始 ───
  if (phase === "idle") {
    return (
      <div className="space-y-3">
        {autoStartReason && (
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-[9px] text-amber-700 font-bold">
            {autoStartReason}
          </div>
        )}
        {autoSetupBlockedReason && (
          <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-[9px] text-amber-700 font-bold">
            {autoSetupBlockedReason}
          </div>
        )}
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 text-[9px] text-red-600 font-bold">
            {error}
          </div>
        )}
        <button
          ref={autoStartButtonRef}
          type="button"
          onClick={runAutoSetup}
          disabled={loading || !canAutoSetup}
          className="w-full py-4 border-2 border-[#00A3C4] bg-[#F0FAFF] hover:bg-[#E0F4FF] text-[#00A3C4] font-bold text-[11px] uppercase tracking-widest transition-colors disabled:opacity-50"
        >
          {loading ? "加载中..." : "帮我自动设置这个技能的使用权限"}
        </button>
        <p className="text-[8px] text-slate-400 text-center">
          系统会自动分析技能内容，推荐使用角色，配置数据安全等级
        </p>
      </div>
    );
  }

  // ─── running：进度动画 ───
  if (phase === "running") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 size={24} className="animate-spin text-[#00A3C4]" />
        <div className="text-[10px] font-bold text-[#1A202C]">{step}</div>
        <div className="w-full max-w-[240px] h-1 bg-slate-200 overflow-hidden">
          <div className="h-full bg-[#00A3C4] animate-pulse" style={{ width: "60%" }} />
        </div>
        <p className="text-[8px] text-slate-400">通常需要 10-30 秒，请稍候</p>
      </div>
    );
  }

  // ─── review：中间结果编辑 ───
  if (phase === "review") {
    return (
      <div className="space-y-3">
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 text-[9px] text-red-600 font-bold">
            {error}
          </div>
        )}

        <div className="text-[10px] font-bold text-[#1A202C]">
          系统已分析完毕，请确认以下设置
        </div>

        {/* 角色推荐 */}
        <div className="border-2 border-slate-200 bg-white">
          <div className="px-3 py-2 border-b border-slate-200 bg-[#F8FBFD]">
            <div className="text-[9px] font-bold text-slate-700">谁会用这个技能？</div>
          </div>
          <div className="p-3 space-y-2">
            {displayRoles.map((role, index) => (
              <div key={role.id} className="flex items-center gap-2 text-[9px]">
                <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                <span className="flex-1 text-slate-700 truncate">
                  {role.org_path} · {role.position_name}
                </span>
                {role.status === "active" && roles.some((r) => r.id === role.id) && (
                  <span className="text-[7px] px-1.5 py-0.5 bg-[#E0F4FF] text-[#00A3C4] font-bold">
                    系统推荐
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveRole(index)}
                  className="text-slate-300 hover:text-red-400"
                  title="移除"
                >
                  <X size={10} />
                </button>
              </div>
            ))}

            {addingRole ? (
              <div className="border border-dashed border-slate-300 p-2 space-y-2">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-500">部门</label>
                  <select
                    value={newRoleDept}
                    onChange={(e) => setNewRoleDept(e.target.value)}
                    className="w-full text-[9px] border border-slate-300 px-2 py-1 bg-white"
                  >
                    <option value="">选择部门</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-bold text-slate-500">职位</label>
                  <select
                    value={newRolePosition}
                    onChange={(e) => setNewRolePosition(e.target.value)}
                    className="w-full text-[9px] border border-slate-300 px-2 py-1 bg-white"
                  >
                    <option value="">选择职位</option>
                    {positions.map((pos) => (
                      <option key={pos.id} value={pos.name}>{pos.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddRole}
                    disabled={!newRoleDept || !newRolePosition}
                    className="text-[8px] font-bold text-white bg-[#00A3C4] px-3 py-1 disabled:opacity-40"
                  >
                    添加
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingRole(false)}
                    className="text-[8px] font-bold text-slate-500 border border-slate-300 px-3 py-1"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingRole(true)}
                className="flex items-center gap-1 text-[8px] font-bold text-[#00A3C4] hover:text-[#008BA6]"
              >
                <Plus size={10} />
                添加其他人
              </button>
            )}
          </div>
        </div>

        {/* 敏感数据处理 */}
        {sensitiveFields.length > 0 && (
          <div className="border-2 border-slate-200 bg-white">
            <div className="px-3 py-2 border-b border-slate-200 bg-[#F8FBFD]">
              <div className="text-[9px] font-bold text-slate-700">涉及敏感信息的处理方式</div>
            </div>
            <div className="p-3 space-y-2">
              {sensitiveFields.map((field) => (
                <div key={field.ruleId} className="flex items-center gap-2 text-[9px]">
                  <span className="min-w-0 flex-1 truncate text-slate-700">
                    {field.fieldName}
                    <span className="text-[7px] text-slate-400 ml-1">({field.assetName})</span>
                  </span>
                  <span className="text-slate-400 text-[8px]">→</span>
                  <select
                    value={fieldDrafts[field.ruleId] ?? field.currentPolicy}
                    onChange={(e) =>
                      setFieldDrafts((prev) => ({
                        ...prev,
                        [field.ruleId]: e.target.value as SensitiveFieldSummaryItem["currentPolicy"],
                      }))
                    }
                    className="text-[8px] border border-slate-300 px-1.5 py-0.5 bg-white min-w-[80px]"
                  >
                    {field.policyOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <Pencil size={9} className="text-slate-300 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirmReview}
            className="flex-1 py-2 text-[10px] font-bold text-white bg-[#00A3C4] hover:bg-[#008BA6] transition-colors"
          >
            确认，下一步
          </button>
          <button
            type="button"
            onClick={() => { setPhase("idle"); setError(null); }}
            className="py-2 px-4 text-[10px] font-bold text-slate-500 border border-slate-300 hover:bg-slate-50"
          >
            重来
          </button>
        </div>
      </div>
    );
  }

  // ─── confirming：保存中 ───
  if (phase === "confirming") {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 size={24} className="animate-spin text-[#00A3C4]" />
        <div className="text-[10px] font-bold text-[#1A202C]">正在保存你的设置...</div>
      </div>
    );
  }

  // ─── done：最终确认卡 ───
  return (
    <div className="space-y-3">
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-[9px] text-red-600 font-bold">
          {error}
        </div>
      )}

      <div className="border-2 border-emerald-300 bg-emerald-50">
        <div className="px-3 py-2 border-b border-emerald-200">
          <div className="text-[10px] font-bold text-emerald-800">这个技能设置好了！</div>
        </div>
        <div className="p-3 space-y-3">
          {/* 能查看的数据 */}
          {permissionSummary.tables.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] font-bold text-slate-700">能查看的数据</div>
              {permissionSummary.tables.map((t) => (
                <div key={t.name} className="text-[9px] text-slate-600 pl-2">
                  · {t.name}{t.note ? `（${t.note}）` : ""}
                </div>
              ))}
            </div>
          )}

          {/* 能参考的知识 */}
          {permissionSummary.knowledge.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] font-bold text-slate-700">能参考的知识</div>
              {permissionSummary.knowledge.map((k) => (
                <div key={k.name} className="text-[9px] text-slate-600 pl-2">
                  · {k.name}
                </div>
              ))}
            </div>
          )}

          {/* 能使用的工具 */}
          {permissionSummary.tools.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] font-bold text-slate-700">能使用的工具</div>
              {permissionSummary.tools.map((t) => (
                <div key={t.name} className="text-[9px] text-slate-600 pl-2">
                  · {t.name}（{t.accessLabel}）
                </div>
              ))}
            </div>
          )}

          {/* 空数据提示 */}
          {permissionSummary.tables.length === 0 && permissionSummary.knowledge.length === 0 && permissionSummary.tools.length === 0 && (
            <div className="text-[9px] text-slate-400">使用规则已生成，点击下方按钮启用</div>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleFinalConfirm}
          className="flex-1 py-2 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
        >
          确认并启用
        </button>
        <button
          type="button"
          onClick={() => { setPhase("review"); setError(null); }}
          className="py-2 px-4 text-[10px] font-bold text-slate-500 border border-slate-300 hover:bg-slate-50"
        >
          我要调整
        </button>
      </div>
    </div>
  );
}
