"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { ResourceLibraryDef } from "@/lib/types";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";

const API = "/org-management/resource-library-defs";

export default function ResourceLibDefTab() {
  const [defs, setDefs] = useState<ResourceLibraryDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 新建表单
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    library_code: "",
    display_name: "",
    owner_department_id: "",
    update_cycle_sla: "",
    required_fields: "[]",
    consumption_scenarios: "[]",
    read_write_policy: "{}",
    quality_baseline: "{}",
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<ResourceLibraryDef[]>(API)
      .then(setDefs)
      .catch(() => setDefs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.library_code.trim() || !form.display_name.trim()) return;
    setCreating(true);
    try {
      await apiFetch(API, {
        method: "POST",
        body: JSON.stringify({
          library_code: form.library_code,
          display_name: form.display_name,
          owner_department_id: form.owner_department_id ? Number(form.owner_department_id) : null,
          update_cycle_sla: form.update_cycle_sla || null,
          required_fields: JSON.parse(form.required_fields),
          consumption_scenarios: JSON.parse(form.consumption_scenarios),
          read_write_policy: JSON.parse(form.read_write_policy),
          quality_baseline: JSON.parse(form.quality_baseline),
        }),
      });
      setShowCreate(false);
      setForm({ library_code: "", display_name: "", owner_department_id: "", update_cycle_sla: "", required_fields: "[]", consumption_scenarios: "[]", read_write_policy: "{}", quality_baseline: "{}" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  function toggleExpand(id: number) {
    setExpandedId(expandedId === id ? null : id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono uppercase">资源库定义中心</h2>
        <PixelButton onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1 inline-block" />
          新建
        </PixelButton>
      </div>

      {/* 新建表单 */}
      {showCreate && (
        <div className="border-2 border-[#1A202C] bg-white p-4 space-y-3">
          <p className="font-mono font-bold">新建资源库定义</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="资源库编码"
              value={form.library_code}
              onChange={(e) => setForm({ ...form, library_code: e.target.value })}
            />
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="显示名称"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="归属部门 ID（选填）"
              value={form.owner_department_id}
              onChange={(e) => setForm({ ...form, owner_department_id: e.target.value })}
            />
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="更新周期 SLA（选填）"
              value={form.update_cycle_sla}
              onChange={(e) => setForm({ ...form, update_cycle_sla: e.target.value })}
            />
          </div>
          <textarea
            className="w-full border-2 border-[#1A202C] p-2 font-mono text-xs"
            rows={3}
            placeholder='必填字段 JSON，如 [{"field_key":"name","label":"名称","type":"string","required":true}]'
            value={form.required_fields}
            onChange={(e) => setForm({ ...form, required_fields: e.target.value })}
          />
          <textarea
            className="w-full border-2 border-[#1A202C] p-2 font-mono text-xs"
            rows={3}
            placeholder='消费场景 JSON，如 [{"scenario":"月度报告","consumer_roles":["分析师"],"frequency":"monthly"}]'
            value={form.consumption_scenarios}
            onChange={(e) => setForm({ ...form, consumption_scenarios: e.target.value })}
          />
          <div className="flex gap-2">
            <PixelButton onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "创建"}
            </PixelButton>
            <PixelButton variant="ghost" onClick={() => setShowCreate(false)}>取消</PixelButton>
          </div>
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>
      ) : defs.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-mono">暂无资源库定义</p>
      ) : (
        <div className="border-2 border-[#1A202C] overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-[#F0F4F8] border-b-2 border-[#1A202C]">
                <th className="text-left p-3 w-8"></th>
                <th className="text-left p-3">资源库编码</th>
                <th className="text-left p-3">显示名称</th>
                <th className="text-center p-3">归属部门 ID</th>
                <th className="text-center p-3">更新周期 SLA</th>
                <th className="text-center p-3">必填字段数</th>
                <th className="text-center p-3">消费场景数</th>
              </tr>
            </thead>
            <tbody>
              {defs.map((d) => (
                <React.Fragment key={d.id}>
                  <tr
                    className="border-b border-gray-200 hover:bg-[#F0F4F8] cursor-pointer"
                    onClick={() => toggleExpand(d.id)}
                  >
                    <td className="p-3">
                      {expandedId === d.id
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    </td>
                    <td className="p-3 font-bold">{d.library_code}</td>
                    <td className="p-3">{d.display_name}</td>
                    <td className="p-3 text-center">{d.owner_department_id ?? "—"}</td>
                    <td className="p-3 text-center">
                      {d.update_cycle_sla
                        ? <PixelBadge color="cyan">{d.update_cycle_sla}</PixelBadge>
                        : "—"}
                    </td>
                    <td className="p-3 text-center">{d.required_fields.length}</td>
                    <td className="p-3 text-center">{d.consumption_scenarios.length}</td>
                  </tr>

                  {/* 展开详情 */}
                  {expandedId === d.id && (
                    <tr>
                      <td colSpan={7} className="p-4 bg-[#F0F4F8] border-b-2 border-[#1A202C]">
                        <div className="space-y-4">
                          {/* 必填字段 */}
                          {d.required_fields.length > 0 && (
                            <div>
                              <p className="font-mono text-xs font-bold uppercase text-gray-500 mb-1">必填字段</p>
                              <table className="w-full text-xs font-mono border border-gray-300">
                                <thead>
                                  <tr className="bg-white">
                                    <th className="text-left p-2 border-b">字段 Key</th>
                                    <th className="text-left p-2 border-b">标签</th>
                                    <th className="text-center p-2 border-b">类型</th>
                                    <th className="text-center p-2 border-b">必填</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {d.required_fields.map((f, i) => (
                                    <tr key={i} className="bg-white border-b border-gray-200">
                                      <td className="p-2">{f.field_key}</td>
                                      <td className="p-2">{f.label}</td>
                                      <td className="p-2 text-center"><PixelBadge color="gray">{f.type}</PixelBadge></td>
                                      <td className="p-2 text-center">{f.required ? "是" : "否"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* 消费场景 */}
                          {d.consumption_scenarios.length > 0 && (
                            <div>
                              <p className="font-mono text-xs font-bold uppercase text-gray-500 mb-1">消费场景</p>
                              <div className="space-y-1">
                                {d.consumption_scenarios.map((s, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs font-mono bg-white p-2 border border-gray-300">
                                    <span className="font-bold">{s.scenario}</span>
                                    <PixelBadge color="green">{s.frequency}</PixelBadge>
                                    <span className="text-gray-500">角色: {s.consumer_roles.join(", ")}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 读写策略 */}
                          <div>
                            <p className="font-mono text-xs font-bold uppercase text-gray-500 mb-1">读写策略</p>
                            <pre className="bg-white border border-gray-300 p-2 text-xs font-mono overflow-auto max-h-32">
                              {JSON.stringify(d.read_write_policy, null, 2)}
                            </pre>
                          </div>

                          {/* 质量基线 */}
                          <div>
                            <p className="font-mono text-xs font-bold uppercase text-gray-500 mb-1">质量基线</p>
                            <pre className="bg-white border border-gray-300 p-2 text-xs font-mono overflow-auto max-h-32">
                              {JSON.stringify(d.quality_baseline, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
