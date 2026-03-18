"use client";

import { useCallback, useEffect, useState } from "react";
import React from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";

interface SkillPolicy {
  id: number;
  skill_id: number;
  publish_scope: string;
  default_data_scope: Record<string, unknown>;
  created_at: string;
}

interface RolePolicyOverride {
  id: number;
  skill_policy_id: number;
  position_id: number;
  callable: boolean;
  data_scope: Record<string, unknown>;
  output_mask: string[];
  created_at: string;
}

interface AgentConnection {
  id: number;
  skill_policy_id: number;
  direction: string;
  connected_skill_id: number;
  created_at: string;
}

interface SkillItem {
  id: number;
  name: string;
}

interface Position {
  id: number;
  name: string;
  department_id: number | null;
}

const SCOPE_LABELS: Record<string, string> = {
  self_only: "仅自己",
  same_role: "同岗位",
  cross_role: "跨岗位",
  org_wide: "全组织",
};

export default function AdminSkillPoliciesPage() {
  const [policies, setPolicies] = useState<SkillPolicy[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Record<number, RolePolicyOverride[]>>({});
  const [connections, setConnections] = useState<Record<number, AgentConnection[]>>({});

  // Create policy form
  const [showCreate, setShowCreate] = useState(false);
  const [createSkillId, setCreateSkillId] = useState("");
  const [createScope, setCreateScope] = useState("same_role");
  const [createError, setCreateError] = useState("");

  const fetchAll = useCallback(() => {
    Promise.resolve().then(() => setLoading(true));
    Promise.all([
      apiFetch<SkillPolicy[]>("/admin/skill-policies"),
      apiFetch<SkillItem[]>("/skills"),
      apiFetch<Position[]>("/admin/permissions/positions"),
    ])
      .then(([p, s, pos]) => { setPolicies(p); setSkills(s); setPositions(pos); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function expand(policy: SkillPolicy) {
    if (expandedId === policy.id) { setExpandedId(null); return; }
    setExpandedId(policy.id);
    if (!overrides[policy.id]) {
      const [ov, conn] = await Promise.all([
        apiFetch<RolePolicyOverride[]>(`/admin/skill-policies/${policy.id}/overrides`).catch(() => []),
        apiFetch<AgentConnection[]>(`/admin/skill-policies/${policy.id}/connections`).catch(() => []),
      ]);
      setOverrides((prev) => ({ ...prev, [policy.id]: ov }));
      setConnections((prev) => ({ ...prev, [policy.id]: conn }));
    }
  }

  async function updateScope(policy: SkillPolicy, scope: string) {
    await apiFetch(`/admin/skill-policies/${policy.id}`, {
      method: "PUT",
      body: JSON.stringify({ publish_scope: scope }),
    });
    fetchAll();
  }

  async function toggleOverrideCallable(policyId: number, override: RolePolicyOverride) {
    await apiFetch(`/admin/skill-policies/${policyId}/overrides`, {
      method: "POST",
      body: JSON.stringify({ position_id: override.position_id, callable: !override.callable, data_scope: override.data_scope, output_mask: override.output_mask }),
    });
    const ov = await apiFetch<RolePolicyOverride[]>(`/admin/skill-policies/${policyId}/overrides`).catch(() => []);
    setOverrides((prev) => ({ ...prev, [policyId]: ov }));
  }

  async function deleteConnection(policyId: number, connId: number) {
    await apiFetch(`/admin/skill-policies/${policyId}/connections/${connId}`, { method: "DELETE" });
    const conn = await apiFetch<AgentConnection[]>(`/admin/skill-policies/${policyId}/connections`).catch(() => []);
    setConnections((prev) => ({ ...prev, [policyId]: conn }));
  }

  async function createPolicy() {
    setCreateError("");
    if (!createSkillId) { setCreateError("请选择 Skill"); return; }
    try {
      await apiFetch("/admin/skill-policies", {
        method: "POST",
        body: JSON.stringify({ skill_id: Number(createSkillId), publish_scope: createScope, default_data_scope: {} }),
      });
      setShowCreate(false);
      setCreateSkillId("");
      fetchAll();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "创建失败");
    }
  }

  const skillName = (id: number) => skills.find((s) => s.id === id)?.name || `Skill #${id}`;
  const posName = (id: number) => positions.find((p) => p.id === id)?.name || `岗位 #${id}`;

  return (
    <PageShell title="Skill策略" icon={ICONS.skillPolicy}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] text-gray-400 font-bold">共 {policies.length} 条策略</span>
        <div className="ml-auto">
          <PixelButton variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            + 新建策略
          </PixelButton>
        </div>
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div>
      ) : policies.length === 0 ? (
        <div className="text-[10px] text-gray-400 font-bold py-10 text-center">暂无策略数据</div>
      ) : (
        <table className="w-full border-2 border-[#1A202C]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["ID", "Skill", "发布范围", "创建时间", "操作"].map((h) => (
                <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <React.Fragment key={p.id}>
                <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-400">{p.id}</td>
                  <td className="px-3 py-2 text-xs font-bold">{skillName(p.skill_id)}</td>
                  <td className="px-3 py-2">
                    <PixelSelect
                      value={p.publish_scope}
                      onChange={(e) => updateScope(p, e.target.value)}
                      pixelSize="sm"
                    >
                      {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </PixelSelect>
                  </td>
                  <td className="px-3 py-2 text-[10px] text-gray-400">
                    {new Date(p.created_at).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => expand(p)}
                      className="text-[10px] font-bold text-[#00A3C4] hover:underline"
                    >
                      {expandedId === p.id ? "收起" : "展开角色覆盖"}
                    </button>
                  </td>
                </tr>

                {expandedId === p.id && (
                  <tr key={`${p.id}-expand`}>
                    <td colSpan={5} className="bg-[#F0F9FF] border-b-2 border-[#1A202C] px-4 py-3">
                      {/* Role overrides */}
                      <div className="mb-3">
                        <div className="text-[9px] font-bold uppercase text-[#00A3C4] mb-2">角色调用覆盖</div>
                        {(overrides[p.id] || []).length === 0 ? (
                          <p className="text-[10px] text-gray-400">暂无覆盖规则，使用默认策略</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[10px] text-gray-500 font-bold">
                                <th className="text-left pb-1">岗位</th>
                                <th className="text-left pb-1">可调用</th>
                                <th className="text-left pb-1">输出遮罩</th>
                                <th className="text-left pb-1">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(overrides[p.id] || []).map((o) => (
                                <tr key={o.id} className="border-t border-gray-100">
                                  <td className="py-1">{posName(o.position_id)}</td>
                                  <td className="py-1">
                                    <button
                                      onClick={() => toggleOverrideCallable(p.id, o)}
                                      className={`text-[10px] font-bold px-2 py-0.5 border-2 ${o.callable ? "border-green-400 text-green-700 bg-green-50" : "border-red-400 text-red-700 bg-red-50"}`}
                                    >
                                      {o.callable ? "允许" : "禁止"}
                                    </button>
                                  </td>
                                  <td className="py-1 text-gray-500">
                                    {o.output_mask.length > 0 ? o.output_mask.join(", ") : "无"}
                                  </td>
                                  <td className="py-1">
                                    <span className="text-[10px] text-gray-400">data_scope: {JSON.stringify(o.data_scope).slice(0, 40)}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Agent connections */}
                      <div>
                        <div className="text-[9px] font-bold uppercase text-[#00A3C4] mb-2">Agent 上下游连接</div>
                        {(connections[p.id] || []).length === 0 ? (
                          <p className="text-[10px] text-gray-400">暂无 Agent 连接白名单</p>
                        ) : (
                          <div className="space-y-1">
                            {(connections[p.id] || []).map((c) => (
                              <div key={c.id} className="flex items-center gap-2 text-xs">
                                <PixelBadge color={c.direction === "upstream" ? "cyan" : "yellow"}>
                                  {c.direction === "upstream" ? "上游" : "下游"}
                                </PixelBadge>
                                <span className="font-bold">{skillName(c.connected_skill_id)}</span>
                                <button
                                  onClick={() => deleteConnection(p.id, c.id)}
                                  className="text-[10px] text-red-500 hover:underline ml-auto"
                                >
                                  删除
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {/* Create policy modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border-2 border-[#1A202C] w-96">
            <div className="bg-[#EBF4F7] border-b-2 border-[#1A202C] px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest">新建 Skill 策略</span>
              <button onClick={() => setShowCreate(false)} className="text-xs text-gray-400 hover:text-black">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">Skill</label>
                <PixelSelect
                  value={createSkillId}
                  onChange={(e) => setCreateSkillId(e.target.value)}
                >
                  <option value="">请选择</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </PixelSelect>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">发布范围</label>
                <PixelSelect
                  value={createScope}
                  onChange={(e) => setCreateScope(e.target.value)}
                >
                  {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </PixelSelect>
              </div>
              {createError && (
                <div className="bg-red-50 border-2 border-red-400 px-3 py-2 text-xs text-red-700 font-bold">{createError}</div>
              )}
            </div>
            <div className="border-t-2 border-[#1A202C] px-4 py-3 flex gap-2 justify-end">
              <PixelButton variant="secondary" size="sm" onClick={() => setShowCreate(false)}>取消</PixelButton>
              <PixelButton variant="primary" size="sm" onClick={createPolicy}>创建</PixelButton>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
