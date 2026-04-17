"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Department, OrgMemorySnapshot, SkillDetail, User } from "@/lib/types";
import type {
  BoundAssetItem,
  MountContext,
  MountedPermissions,
  RoleAssetPolicyItem,
  ServiceRoleItem,
} from "./SkillGovernanceCards";
import {
  recommendationToServiceRole,
  recommendRoleList,
  serviceRoleKey,
  type PositionLite,
} from "./role-recommendation";
import {
  buildRolePackageDraft,
  type RolePackageDraft,
} from "./role-package";

function tinyBadge(className: string, text: string) {
  return (
    <span className={`inline-flex items-center border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest ${className}`}>
      {text}
    </span>
  );
}

function cardTitle(title: string, action?: ReactNode) {
  return (
    <div className="px-3 py-2 border-b border-slate-200 bg-[#F8FBFD] flex items-center gap-2">
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-700">{title}</div>
      <div className="ml-auto">{action}</div>
    </div>
  );
}

function dedupeRoles(nextRoles: ServiceRoleItem[]) {
  const grouped = new Map<string, ServiceRoleItem>();
  nextRoles.forEach((role) => {
    grouped.set(serviceRoleKey(role), role);
  });
  return Array.from(grouped.values());
}

function inferLevel(name: string) {
  if (/总监|负责人|head/i.test(name)) return "M1";
  if (/经理|主管|leader/i.test(name)) return "M0";
  if (/专家|顾问|分析师/i.test(name)) return "P2";
  if (/专员|助理|协调/i.test(name)) return "P1";
  return "";
}

export function RoleRecommendationWorkbench({
  skill,
  user,
  roles,
  assets,
  policies,
  mountContext,
  mountedPermissions,
  loading,
  orgMemoryFallback,
  snapshots,
  departments,
  positions,
  onSave,
  onSavePackage,
}: {
  skill: SkillDetail;
  user: User | null;
  roles: ServiceRoleItem[];
  assets: BoundAssetItem[];
  policies: RoleAssetPolicyItem[];
  mountContext: MountContext | null;
  mountedPermissions: MountedPermissions | null;
  loading: boolean;
  orgMemoryFallback: boolean;
  snapshots: OrgMemorySnapshot[];
  departments: Department[];
  positions: PositionLite[];
  onSave: (roles: ServiceRoleItem[]) => Promise<void>;
  onSavePackage: (draft: RolePackageDraft) => Promise<void>;
}) {
  const [draftRoles, setDraftRoles] = useState<ServiceRoleItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingPackage, setSavingPackage] = useState(false);
  const [selectedRecommendationKeys, setSelectedRecommendationKeys] = useState<string[]>([]);
  const [activeRoleKey, setActiveRoleKey] = useState<string | null>(null);
  const [deptSearch, setDeptSearch] = useState("");
  const [positionSearch, setPositionSearch] = useState("");
  const [levelSearch, setLevelSearch] = useState("");
  const [manualOrgPath, setManualOrgPath] = useState("");
  const [manualPosition, setManualPosition] = useState("");
  const [manualLevel, setManualLevel] = useState("");

  useEffect(() => {
    setDraftRoles(roles);
  }, [roles]);

  const recommendation = useMemo(
    () => recommendRoleList({
      skill,
      assets,
      snapshots,
      departments,
      positions,
      user,
    }),
    [assets, departments, positions, skill, snapshots, user],
  );

  useEffect(() => {
    const available = new Set(recommendation.items.map((item) => item.key));
    setSelectedRecommendationKeys((prev) => {
      const kept = prev.filter((item) => available.has(item));
      if (kept.length > 0) return kept;
      return recommendation.items.slice(0, recommendation.mode === "fallback" ? 1 : Math.min(3, recommendation.items.length)).map((item) => item.key);
    });
  }, [recommendation]);

  useEffect(() => {
    if (roles.length === 0) {
      setActiveRoleKey(null);
      return;
    }
    const firstKey = serviceRoleKey(roles[0]);
    setActiveRoleKey((prev) => {
      if (prev && roles.some((role) => serviceRoleKey(role) === prev)) return prev;
      return firstKey;
    });
  }, [roles]);

  const dirty = JSON.stringify(draftRoles) !== JSON.stringify(roles);
  const selectedRole = roles.find((role) => serviceRoleKey(role) === activeRoleKey) || roles[0] || null;
  const baseRolePackage = useMemo(
    () => selectedRole
      ? buildRolePackageDraft({
          role: selectedRole,
          policies,
          mountContext,
          mountedPermissions,
        })
      : null,
    [mountContext, mountedPermissions, policies, selectedRole],
  );
  const [packageDraft, setPackageDraft] = useState<RolePackageDraft | null>(null);


  useEffect(() => {
    setPackageDraft(baseRolePackage);
  }, [baseRolePackage]);

  const packageDirty = Boolean(packageDraft && baseRolePackage && JSON.stringify(packageDraft) !== JSON.stringify(baseRolePackage));
  const packageFieldCount = packageDraft?.field_rules.length || 0;
  const packageKnowledgeCount = packageDraft?.knowledge_permissions.filter((item) => item.enabled).length || 0;
  const packageAssetCount = packageDraft?.asset_mounts.filter((item) => item.enabled).length || 0;

  function updatePackageDraft(patch: (current: RolePackageDraft) => RolePackageDraft) {
    setPackageDraft((current) => current ? patch(current) : current);
  }

  async function savePackageDraft() {
    if (!packageDraft) return;
    setSavingPackage(true);
    try {
      await onSavePackage(packageDraft);
    } finally {
      setSavingPackage(false);
    }
  }

  const levelOptions = useMemo(() => {
    const levels = [
      "P1",
      "P2",
      "P3",
      "M0",
      "M1",
      "M2",
      ...draftRoles.map((role) => role.position_level || ""),
      ...recommendation.items.map((item) => item.position_level || ""),
    ].filter(Boolean);
    const search = levelSearch.trim().toLowerCase();
    const uniqueLevels = Array.from(new Set(levels));
    return search ? uniqueLevels.filter((item) => item.toLowerCase().includes(search)) : uniqueLevels;
  }, [draftRoles, levelSearch, recommendation.items]);

  const filteredDepartments = useMemo(() => {
    const search = deptSearch.trim().toLowerCase();
    return departments
      .filter((dept) => !search || dept.name.toLowerCase().includes(search))
      .slice(0, 8);
  }, [departments, deptSearch]);

  const filteredPositions = useMemo(() => {
    const search = positionSearch.trim().toLowerCase();
    return positions
      .filter((position) => !search || position.name.toLowerCase().includes(search))
      .slice(0, 8);
  }, [positions, positionSearch]);

  function pushRole(role: ServiceRoleItem) {
    setDraftRoles((prev) => dedupeRoles([...prev, role]));
  }

  function addManualRole() {
    if (!manualOrgPath.trim() || !manualPosition.trim()) return;
    const positionLevel = manualLevel.trim();
    pushRole({
      id: -Date.now(),
      org_path: manualOrgPath.trim(),
      position_name: manualPosition.trim(),
      position_level: positionLevel,
      role_label: `${manualPosition.trim()}${positionLevel ? `（${positionLevel}）` : ""}`,
      status: "active",
    });
    setManualOrgPath("");
    setManualPosition("");
    setManualLevel("");
  }

  function addPosition(position: PositionLite) {
    const departmentName = departments.find((item) => item.id === position.department_id)?.name || "未指定部门";
    const level = levelSearch.trim() || inferLevel(position.name);
    pushRole({
      id: -Date.now(),
      org_path: departmentName,
      position_name: position.name,
      position_level: level,
      role_label: `${position.name}${level ? `（${level}）` : ""}`,
      status: "active",
    });
  }

  function addDepartmentPositions(dept: Department) {
    const deptPositions = positions.filter((position) => position.department_id === dept.id);
    if (deptPositions.length === 0) {
      pushRole({
        id: -Date.now(),
        org_path: dept.name,
        position_name: `${dept.name}角色`,
        position_level: levelSearch.trim(),
        role_label: `${dept.name}角色${levelSearch.trim() ? `（${levelSearch.trim()}）` : ""}`,
        status: "active",
      });
      return;
    }
    setDraftRoles((prev) => dedupeRoles([
      ...prev,
      ...deptPositions.map((position) => {
        const level = levelSearch.trim() || inferLevel(position.name);
        return {
          id: -Date.now() - position.id,
          org_path: dept.name,
          position_name: position.name,
          position_level: level,
          role_label: `${position.name}${level ? `（${level}）` : ""}`,
          status: "active",
        } satisfies ServiceRoleItem;
      }),
    ]));
  }

  function applySelectedRecommendations() {
    const next = recommendation.items
      .filter((item) => selectedRecommendationKeys.includes(item.key))
      .map((item) => recommendationToServiceRole(item));
    setDraftRoles(dedupeRoles(next));
  }

  async function saveDraftRoles() {
    setSaving(true);
    try {
      await onSave(draftRoles);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="border border-slate-200 bg-white">
        {cardTitle(
          "AI 推荐角色 List",
          <button
            type="button"
            onClick={applySelectedRecommendations}
            disabled={recommendation.items.length === 0}
            className="text-[8px] font-bold border border-[#00A3C4]/40 text-[#00A3C4] px-2 py-0.5 disabled:opacity-40"
          >
            应用到角色 list
          </button>,
        )}
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            {tinyBadge(
              recommendation.overall_confidence === "high"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : recommendation.overall_confidence === "medium"
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-red-300 bg-red-50 text-red-700",
              `${recommendation.overall_confidence} confidence`,
            )}
            {tinyBadge(
              recommendation.mode === "fallback"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-slate-300 bg-slate-50 text-slate-600",
              recommendation.mode === "fallback" ? "fallback" : "skill + org memory",
            )}
            {orgMemoryFallback && tinyBadge("border-amber-300 bg-amber-50 text-amber-700", "org memory fallback")}
          </div>
          <p className="text-[9px] text-slate-600">{recommendation.summary}</p>
          {loading && <p className="text-[9px] text-slate-400">分析中...</p>}
          {!loading && recommendation.items.length === 0 && <p className="text-[9px] text-slate-400">暂无推荐角色。</p>}
          {recommendation.items.map((item) => {
            const selected = selectedRecommendationKeys.includes(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedRecommendationKeys((prev) => selected ? prev.filter((key) => key !== item.key) : [...prev, item.key])}
                className={`w-full border p-2 text-left transition-colors ${selected ? "border-[#00A3C4] bg-[#F0FBFF]" : "border-slate-200 bg-white"}`}
              >
                <div className="flex items-start gap-2">
                  <input type="checkbox" readOnly checked={selected} className="mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-800">{item.role_label}</span>
                      {tinyBadge(
                        item.confidence === "high"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : item.confidence === "medium"
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-red-300 bg-red-50 text-red-700",
                        item.confidence,
                      )}
                    </div>
                    <div className="text-[8px] text-slate-500">{item.org_path}</div>
                    <div className="text-[8px] text-slate-600">{item.reason_summary}</div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Skill 依据</div>
                        {(item.skill_reasons.length > 0 ? item.skill_reasons : ["未命中强证据"]).map((reason) => (
                          <div key={reason} className="text-[8px] text-slate-600">- {reason}</div>
                        ))}
                      </div>
                      <div>
                        <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Org Memory 依据</div>
                        {(item.org_memory_reasons.length > 0 ? item.org_memory_reasons : ["未命中强证据"]).map((reason) => (
                          <div key={reason} className="text-[8px] text-slate-600">- {reason}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="border border-slate-200 bg-white">
        {cardTitle(
          "服务岗位",
          <button
            type="button"
            onClick={saveDraftRoles}
            disabled={!dirty || saving}
            className="text-[8px] font-bold text-[#00A3C4] border border-[#00A3C4]/40 px-2 py-0.5 disabled:opacity-40"
          >
            {saving ? "保存中" : dirty ? "保存角色 list" : "已同步"}
          </button>,
        )}
        <div className="p-3 space-y-3">
          <div className="text-[8px] text-slate-500">先确认 AI 推荐，再用搜索补充 / 删除 / 替换角色。</div>
          {loading && <p className="text-[9px] text-slate-400">加载岗位中...</p>}
          {!loading && draftRoles.length === 0 && <p className="text-[9px] text-slate-400">还没有选择服务岗位。</p>}
          <div className="space-y-1.5">
            {draftRoles.map((role) => (
              <div key={serviceRoleKey(role)} className="border border-slate-200 bg-slate-50 p-2 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-slate-800 truncate">{role.role_label}</div>
                  <div className="text-[8px] text-slate-500 truncate">{role.org_path}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setDraftRoles((prev) => prev.filter((item) => serviceRoleKey(item) !== serviceRoleKey(role)))}
                  className="text-[8px] text-red-500 border border-red-200 px-1 py-0.5"
                >
                  删除
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-2">
            <div className="space-y-1">
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">部门批量添加</div>
              <input
                value={deptSearch}
                onChange={(event) => setDeptSearch(event.target.value)}
                placeholder="搜索部门后批量加入..."
                className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4]"
              />
              <div className="flex flex-wrap gap-1">
                {filteredDepartments.map((dept) => (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => addDepartmentPositions(dept)}
                    className="text-[8px] border border-slate-300 text-slate-600 px-2 py-0.5 hover:border-[#00A3C4] hover:text-[#00A3C4]"
                  >
                    加入 {dept.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">岗位搜索添加</div>
              <input
                value={positionSearch}
                onChange={(event) => setPositionSearch(event.target.value)}
                placeholder="搜索岗位后添加..."
                className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4]"
              />
              <div className="flex flex-wrap gap-1">
                {filteredPositions.map((position) => (
                  <button
                    key={position.id}
                    type="button"
                    onClick={() => addPosition(position)}
                    className="text-[8px] border border-slate-300 text-slate-600 px-2 py-0.5 hover:border-[#00A3C4] hover:text-[#00A3C4]"
                  >
                    {position.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">职级搜索</div>
              <input
                value={levelSearch}
                onChange={(event) => setLevelSearch(event.target.value)}
                placeholder="搜索职级..."
                className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4]"
              />
              <div className="flex flex-wrap gap-1">
                {levelOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLevelSearch(item)}
                    className="text-[8px] border border-slate-300 text-slate-600 px-2 py-0.5 hover:border-[#00A3C4] hover:text-[#00A3C4]"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-slate-100">
            <input
              value={manualOrgPath}
              onChange={(event) => setManualOrgPath(event.target.value)}
              placeholder="组织路径，如 公司经营发展中心/人力资源部"
              className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4]"
            />
            <div className="grid grid-cols-[1fr_72px_auto] gap-1.5">
              <input
                value={manualPosition}
                onChange={(event) => setManualPosition(event.target.value)}
                placeholder="岗位名"
                className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4]"
              />
              <input
                value={manualLevel}
                onChange={(event) => setManualLevel(event.target.value)}
                placeholder="职级"
                className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4]"
              />
              <button
                type="button"
                onClick={addManualRole}
                className="text-[8px] font-bold text-white bg-[#00A3C4] px-2"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="border border-slate-200 bg-white">
        {cardTitle(
          "角色 Package 总览",
          <button
            type="button"
            onClick={savePackageDraft}
            disabled={!packageDirty || savingPackage || !packageDraft}
            className="text-[8px] font-bold text-[#00A3C4] border border-[#00A3C4]/40 px-2 py-0.5 disabled:opacity-40"
          >
            {savingPackage ? "保存中" : packageDirty ? "保存 package" : "package 已同步"}
          </button>,
        )}
        <div className="p-3 space-y-3">
          {roles.length === 0 ? (
            <p className="text-[9px] text-slate-400">确认并保存角色 list 后，这里按角色查看 package。</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {roles.map((role) => {
                  const key = serviceRoleKey(role);
                  const active = key === serviceRoleKey(selectedRole || role);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveRoleKey(key)}
                      className={`px-2 py-1 text-[8px] font-bold border ${active ? "border-[#00A3C4] bg-[#F0FBFF] text-[#00A3C4]" : "border-slate-300 text-slate-600 bg-white"}`}
                    >
                      {role.role_label}
                    </button>
                  );
                })}
              </div>

              {selectedRole && packageDraft && (
                <div className="space-y-3 border border-slate-200 bg-slate-50 p-2">
                  <div>
                    <div className="text-[10px] font-bold text-slate-800">{selectedRole.role_label}</div>
                    <div className="text-[8px] text-slate-500">{selectedRole.org_path}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="border border-slate-200 bg-white p-2">
                      <div className="text-[8px] text-slate-400">表字段 package</div>
                      <div className="text-[11px] font-bold text-slate-800">{packageFieldCount}</div>
                      <div className="text-[8px] text-slate-500">可编辑字段细则</div>
                    </div>
                    <div className="border border-slate-200 bg-white p-2">
                      <div className="text-[8px] text-slate-400">知识遮蔽 package</div>
                      <div className="text-[11px] font-bold text-slate-800">{packageKnowledgeCount}</div>
                      <div className="text-[8px] text-slate-500">可编辑遮蔽等级</div>
                    </div>
                    <div className="border border-slate-200 bg-white p-2">
                      <div className="text-[8px] text-slate-400">资产挂载 package</div>
                      <div className="text-[11px] font-bold text-slate-800">{packageAssetCount}</div>
                      <div className="text-[8px] text-slate-500">可编辑挂载开关</div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">表字段可见性</div>
                    {packageDraft.field_rules.length === 0 ? (
                      <div className="text-[8px] text-slate-500">当前角色还没有独立字段规则，等待重新生成 bundle。</div>
                    ) : (
                      packageDraft.field_rules.map((rule) => (
                        <div key={rule.rule_id} className="border border-slate-200 bg-white p-2 space-y-2">
                          <div>
                            <div className="text-[9px] font-bold text-slate-700">{rule.asset_name}</div>
                            <div className="text-[8px] text-slate-500">{rule.target_summary}</div>
                          </div>
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                            <select
                              aria-label={`字段策略 ${rule.target_summary}`}
                              value={rule.suggested_policy}
                              onChange={(event) => updatePackageDraft((current) => ({
                                ...current,
                                field_rules: current.field_rules.map((item) => item.rule_id === rule.rule_id ? { ...item, suggested_policy: event.target.value } : item),
                              }))}
                              className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4] bg-white"
                            >
                              <option value="deny">禁止</option>
                              <option value="mask">脱敏</option>
                              <option value="raw">原值</option>
                            </select>
                            <select
                              aria-label={`字段脱敏 ${rule.target_summary}`}
                              value={rule.mask_style || ""}
                              onChange={(event) => updatePackageDraft((current) => ({
                                ...current,
                                field_rules: current.field_rules.map((item) => item.rule_id === rule.rule_id ? { ...item, mask_style: event.target.value || null } : item),
                              }))}
                              className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4] bg-white"
                            >
                              <option value="">未指定</option>
                              <option value="partial">部分脱敏</option>
                              <option value="hash">哈希</option>
                              <option value="raw">原样输出</option>
                            </select>
                            <label className="flex items-center gap-1 text-[8px] text-slate-600 border border-slate-200 px-2 py-1">
                              <input
                                type="checkbox"
                                checked={rule.confirmed}
                                onChange={(event) => updatePackageDraft((current) => ({
                                  ...current,
                                  field_rules: current.field_rules.map((item) => item.rule_id === rule.rule_id ? { ...item, confirmed: event.target.checked } : item),
                                }))}
                              />
                              确认
                            </label>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">知识库遮蔽等级</div>
                    {packageDraft.knowledge_permissions.length === 0 ? (
                      <div className="text-[8px] text-slate-500">当前没有知识权限投影。</div>
                    ) : (
                      packageDraft.knowledge_permissions.map((item) => (
                        <div key={item.asset_id} className="border border-slate-200 bg-white p-2 space-y-2">
                          <div className="flex items-start gap-2">
                            <label className="mt-0.5">
                              <input
                                aria-label={`启用知识 ${item.title}`}
                                type="checkbox"
                                checked={item.enabled}
                                onChange={(event) => updatePackageDraft((current) => ({
                                  ...current,
                                  knowledge_permissions: current.knowledge_permissions.map((permission) => permission.asset_id === item.asset_id ? { ...permission, enabled: event.target.checked } : permission),
                                }))}
                              />
                            </label>
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-bold text-slate-700">{item.title}</div>
                              <div className="text-[8px] text-slate-500 truncate">{item.folder_path || "未记录目录"}</div>
                            </div>
                            <select
                              aria-label={`知识遮蔽 ${item.title}`}
                              value={item.desensitization_level}
                              onChange={(event) => updatePackageDraft((current) => ({
                                ...current,
                                knowledge_permissions: current.knowledge_permissions.map((permission) => permission.asset_id === item.asset_id ? { ...permission, desensitization_level: event.target.value } : permission),
                              }))}
                              className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4] bg-white"
                            >
                              <option value="inherit">继承</option>
                              <option value="L1">L1 摘要</option>
                              <option value="L2">L2 脱敏</option>
                              <option value="L3">L3 严格遮蔽</option>
                              <option value="blocked">禁止引用</option>
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">资产挂载</div>
                    {packageDraft.asset_mounts.length === 0 ? (
                      <div className="text-[8px] text-slate-500">当前没有挂载上下文。</div>
                    ) : (
                      packageDraft.asset_mounts.map((asset) => (
                        <div key={asset.asset_id} className="border border-slate-200 bg-white p-2 flex items-center gap-2">
                          <input
                            aria-label={`启用资产 ${asset.asset_name}`}
                            type="checkbox"
                            checked={asset.enabled}
                            onChange={(event) => updatePackageDraft((current) => ({
                              ...current,
                              asset_mounts: current.asset_mounts.map((item) => item.asset_id === asset.asset_id ? { ...item, enabled: event.target.checked } : item),
                            }))}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[9px] font-bold text-slate-700">{asset.asset_name}</div>
                            <div className="text-[8px] text-slate-500">{asset.asset_type}</div>
                          </div>
                          <select
                            aria-label={`资产挂载 ${asset.asset_name}`}
                            value={asset.binding_mode}
                            onChange={(event) => updatePackageDraft((current) => ({
                              ...current,
                              asset_mounts: current.asset_mounts.map((item) => item.asset_id === asset.asset_id ? { ...item, binding_mode: event.target.value } : item),
                            }))}
                            className="text-[9px] border border-slate-200 px-2 py-1 outline-none focus:border-[#00A3C4] bg-white"
                          >
                            {Array.from(new Set([asset.binding_mode, "table_bound", "knowledge_bound", "tool_bound", "reference_only"])).map((mode) => (
                              <option key={mode} value={mode}>{mode}</option>
                            ))}
                          </select>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
