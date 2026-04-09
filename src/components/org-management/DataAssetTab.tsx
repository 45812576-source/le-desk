"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch } from "@/lib/api";
import type { DataAssetOwnership, Department } from "@/lib/types";
import { Upload, Plus } from "lucide-react";
import ImportWizard from "./ImportWizard";

const API = "/org-management/data-assets";

export default function DataAssetTab() {
  const [assets, setAssets] = useState<DataAssetOwnership[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  // 新建表单
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    asset_name: "",
    asset_code: "",
    owner_department_id: "",
    update_frequency: "",
    description: "",
  });
  const [creating, setCreating] = useState(false);

  const deptName = useCallback(
    (id: number) => departments.find((d) => d.id === id)?.name ?? `部门#${id}`,
    [departments],
  );

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch<DataAssetOwnership[]>(API).catch(() => []),
      apiFetch<Department[]>("/org-management/departments").catch(() => []),
    ]).then(([a, d]) => {
      setAssets(a);
      setDepartments(d);
      setLoading(false);
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.asset_name.trim() || !form.asset_code.trim()) return;
    setCreating(true);
    try {
      await apiFetch(API, {
        method: "POST",
        body: JSON.stringify({
          asset_name: form.asset_name,
          asset_code: form.asset_code,
          owner_department_id: Number(form.owner_department_id),
          update_frequency: form.update_frequency,
          description: form.description || null,
          consumer_department_ids: [],
        }),
      });
      setShowCreate(false);
      setForm({ asset_name: "", asset_code: "", owner_department_id: "", update_frequency: "", description: "" });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  if (showImport) {
    return (
      <ImportWizard
        importType="data_asset"
        onClose={() => { setShowImport(false); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono uppercase">数据资产</h2>
        <div className="flex gap-2">
          <PixelButton onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-1 inline-block" />
            导入
          </PixelButton>
          <PixelButton onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1 inline-block" />
            新建
          </PixelButton>
        </div>
      </div>

      {/* 新建表单 */}
      {showCreate && (
        <div className="border-2 border-[#1A202C] bg-white p-4 space-y-3">
          <p className="font-mono font-bold">新建数据资产</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="资产名称"
              value={form.asset_name}
              onChange={(e) => setForm({ ...form, asset_name: e.target.value })}
            />
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="资产编码"
              value={form.asset_code}
              onChange={(e) => setForm({ ...form, asset_code: e.target.value })}
            />
            <select
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              value={form.owner_department_id}
              onChange={(e) => setForm({ ...form, owner_department_id: e.target.value })}
            >
              <option value="">选择归属部门</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="更新频率（如：每日/每周）"
              value={form.update_frequency}
              onChange={(e) => setForm({ ...form, update_frequency: e.target.value })}
            />
          </div>
          <textarea
            className="w-full border-2 border-[#1A202C] p-2 font-mono text-sm"
            rows={2}
            placeholder="描述（选填）"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <div className="flex gap-2">
            <PixelButton onClick={handleCreate} disabled={creating}>
              {creating ? "创建中..." : "创建"}
            </PixelButton>
            <PixelButton variant="ghost" onClick={() => setShowCreate(false)}>取消</PixelButton>
          </div>
        </div>
      )}

      {/* 资产列表 */}
      {loading ? (
        <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>
      ) : assets.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-mono">暂无数据资产</p>
      ) : (
        <div className="border-2 border-[#1A202C] overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-[#F0F4F8] border-b-2 border-[#1A202C]">
                <th className="text-left p-3">资产名称</th>
                <th className="text-left p-3">编码</th>
                <th className="text-left p-3">归属部门</th>
                <th className="text-center p-3">更新频率</th>
                <th className="text-center p-3">消费方数</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-b border-gray-200 hover:bg-[#F0F4F8]">
                  <td className="p-3 font-bold">{a.asset_name}</td>
                  <td className="p-3 text-gray-500">{a.asset_code}</td>
                  <td className="p-3">{deptName(a.owner_department_id)}</td>
                  <td className="p-3 text-center">{a.update_frequency}</td>
                  <td className="p-3 text-center">{a.consumer_department_ids.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
