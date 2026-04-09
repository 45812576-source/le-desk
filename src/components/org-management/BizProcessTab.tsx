"use client";

import React, { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { BizProcess } from "@/lib/types";
import { Upload, Plus, ChevronDown, ChevronRight } from "lucide-react";
import ImportWizard from "./ImportWizard";

const API = "/org-management/biz-processes";

export default function BizProcessTab() {
  const [processes, setProcesses] = useState<BizProcess[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 新建表单
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<BizProcess[]>(API)
      .then(setProcesses)
      .catch(() => setProcesses([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.name.trim() || !form.code.trim()) return;
    setCreating(true);
    try {
      await apiFetch(API, { method: "POST", body: JSON.stringify(form) });
      setShowCreate(false);
      setForm({ name: "", code: "", description: "" });
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
        importType="biz_process"
        onClose={() => { setShowImport(false); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold font-mono uppercase">业务流程</h2>
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
          <p className="font-mono font-bold">新建业务流程</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="流程名称"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="border-2 border-[#1A202C] p-2 font-mono text-sm"
              placeholder="流程编码"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
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

      {/* 流程列表 */}
      {loading ? (
        <p className="text-center py-8 text-gray-500 font-mono">加载中...</p>
      ) : processes.length === 0 ? (
        <p className="text-center py-8 text-gray-500 font-mono">暂无业务流程数据</p>
      ) : (
        <div className="border-2 border-[#1A202C] overflow-hidden">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="bg-[#F0F4F8] border-b-2 border-[#1A202C]">
                <th className="text-left p-3 w-8"></th>
                <th className="text-left p-3">名称</th>
                <th className="text-left p-3">编码</th>
                <th className="text-left p-3">描述</th>
                <th className="text-center p-3">节点数</th>
                <th className="text-center p-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((p) => {
                const isExpanded = expandedId === p.id;
                return (
                  <React.Fragment key={p.id}>
                    <tr
                      className="border-b border-gray-200 hover:bg-[#F0F4F8] cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    >
                      <td className="p-3 text-center">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 inline-block" />
                          : <ChevronRight className="w-4 h-4 inline-block" />}
                      </td>
                      <td className="p-3 font-bold">{p.name}</td>
                      <td className="p-3 text-gray-500">{p.code}</td>
                      <td className="p-3 text-gray-500 truncate max-w-[200px]">{p.description || "—"}</td>
                      <td className="p-3 text-center">{p.process_nodes.length}</td>
                      <td className="p-3 text-center">
                        <PixelBadge color={p.is_active ? "green" : "gray"}>
                          {p.is_active ? "启用" : "停用"}
                        </PixelBadge>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="bg-[#F0F4F8] p-4">
                          <p className="text-xs font-mono text-gray-500 uppercase mb-2">流程节点</p>
                          {p.process_nodes.length === 0 ? (
                            <p className="text-sm text-gray-400">暂无节点</p>
                          ) : (
                            <ol className="space-y-1 list-decimal list-inside">
                              {[...p.process_nodes]
                                .sort((a, b) => a.order - b.order)
                                .map((node, i) => (
                                  <li key={i} className="text-sm">
                                    <span className="font-bold">{node.name}</span>
                                    {node.input_data && node.input_data.length > 0 && (
                                      <span className="text-gray-500 ml-2">
                                        输入: {node.input_data.join(", ")}
                                      </span>
                                    )}
                                    {node.output_data && node.output_data.length > 0 && (
                                      <span className="text-gray-500 ml-2">
                                        输出: {node.output_data.join(", ")}
                                      </span>
                                    )}
                                  </li>
                                ))}
                            </ol>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
