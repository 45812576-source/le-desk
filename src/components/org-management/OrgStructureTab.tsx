"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { OrgDepartment } from "@/lib/types";
import ImportWizard from "./ImportWizard";

interface DeptTreeNode extends OrgDepartment {
  children: DeptTreeNode[];
  depth: number;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  preparing: "bg-blue-100 text-blue-800",
  frozen: "bg-yellow-100 text-yellow-800",
  dissolved: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<string, string> = {
  active: "运行中",
  preparing: "筹建中",
  frozen: "冻结",
  dissolved: "已撤销",
};

function buildTree(list: OrgDepartment[]): DeptTreeNode[] {
  const map = new Map<number, DeptTreeNode>();
  const roots: DeptTreeNode[] = [];

  for (const d of list) {
    map.set(d.id, { ...d, children: [], depth: 0 });
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 递归设置深层 depth
  function setDepth(nodes: DeptTreeNode[], d: number) {
    for (const n of nodes) {
      n.depth = d;
      setDepth(n.children, d + 1);
    }
  }
  setDepth(roots, 0);

  return roots;
}

function flattenTree(nodes: DeptTreeNode[], expanded: Set<number>): DeptTreeNode[] {
  const result: DeptTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (expanded.has(node.id) && node.children.length > 0) {
      result.push(...flattenTree(node.children, expanded));
    }
  }
  return result;
}

export default function OrgStructureTab() {
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // 新建部门表单
  const [form, setForm] = useState({
    name: "",
    parent_id: "" as string,
    code: "",
    level: "",
    headcount_budget: "" as string,
  });

  // 编辑表单
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    level: "",
    headcount_budget: "" as string,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<OrgDepartment[]>("/api/org-management/departments");
      setDepartments(data);
    } catch (e) {
      console.error("加载部门失败", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tree = buildTree(departments);
  const rows = flattenTree(tree, expanded);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasChildren = (id: number): boolean => {
    return departments.some((d) => d.parent_id === id);
  };

  const handleCreate = async () => {
    try {
      await apiFetch("/api/org-management/departments", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          parent_id: form.parent_id ? Number(form.parent_id) : null,
          code: form.code || null,
          level: form.level || null,
          headcount_budget: form.headcount_budget ? Number(form.headcount_budget) : null,
        }),
      });
      setShowCreate(false);
      setForm({ name: "", parent_id: "", code: "", level: "", headcount_budget: "" });
      load();
    } catch (e) {
      console.error("创建部门失败", e);
    }
  };

  const startEdit = (dept: OrgDepartment) => {
    setEditingId(dept.id);
    setEditForm({
      name: dept.name,
      code: dept.code || "",
      level: dept.level || "",
      headcount_budget: dept.headcount_budget != null ? String(dept.headcount_budget) : "",
    });
  };

  const handleSaveEdit = async (id: number) => {
    try {
      await apiFetch(`/api/org-management/departments/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editForm.name,
          code: editForm.code || null,
          level: editForm.level || null,
          headcount_budget: editForm.headcount_budget ? Number(editForm.headcount_budget) : null,
        }),
      });
      setEditingId(null);
      load();
    } catch (e) {
      console.error("更新部门失败", e);
    }
  };

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">组织架构</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            导入
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
          >
            新建部门
          </button>
        </div>
      </div>

      {/* 树形表格 */}
      {loading ? (
        <div className="py-10 text-center text-gray-500">加载中...</div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 font-medium">名称</th>
                <th className="px-4 py-2 font-medium">编码</th>
                <th className="px-4 py-2 font-medium">层级</th>
                <th className="px-4 py-2 font-medium">编制</th>
                <th className="px-4 py-2 font-medium">状态</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    暂无部门数据
                  </td>
                </tr>
              )}
              {rows.map((node) => (
                <tr key={node.id} className="border-t border-gray-100 hover:bg-gray-50">
                  {/* 名称 - 带缩进和展开按钮 */}
                  <td className="px-4 py-2" style={{ paddingLeft: `${node.depth * 24 + 16}px` }}>
                    <span className="inline-flex items-center gap-1">
                      {hasChildren(node.id) ? (
                        <button
                          onClick={() => toggleExpand(node.id)}
                          className="mr-1 h-4 w-4 text-gray-400 hover:text-gray-600"
                        >
                          {expanded.has(node.id) ? "▼" : "▶"}
                        </button>
                      ) : (
                        <span className="mr-1 inline-block w-4" />
                      )}
                      {editingId === node.id ? (
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-32 rounded border px-1 py-0.5 text-sm"
                        />
                      ) : (
                        node.name
                      )}
                    </span>
                  </td>

                  {/* 编码 */}
                  <td className="px-4 py-2">
                    {editingId === node.id ? (
                      <input
                        value={editForm.code}
                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                        className="w-20 rounded border px-1 py-0.5 text-sm"
                      />
                    ) : (
                      node.code || "-"
                    )}
                  </td>

                  {/* 层级 */}
                  <td className="px-4 py-2">
                    {editingId === node.id ? (
                      <input
                        value={editForm.level}
                        onChange={(e) => setEditForm({ ...editForm, level: e.target.value })}
                        className="w-20 rounded border px-1 py-0.5 text-sm"
                      />
                    ) : (
                      node.level || "-"
                    )}
                  </td>

                  {/* 编制 */}
                  <td className="px-4 py-2">
                    {editingId === node.id ? (
                      <input
                        type="number"
                        value={editForm.headcount_budget}
                        onChange={(e) => setEditForm({ ...editForm, headcount_budget: e.target.value })}
                        className="w-16 rounded border px-1 py-0.5 text-sm"
                      />
                    ) : (
                      node.headcount_budget ?? "-"
                    )}
                  </td>

                  {/* 状态 */}
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[node.lifecycle_status] || "bg-gray-100 text-gray-600"}`}
                    >
                      {STATUS_LABEL[node.lifecycle_status] || node.lifecycle_status}
                    </span>
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-2">
                    {editingId === node.id ? (
                      <span className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(node.id)}
                          className="text-sm text-green-600 hover:underline"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-sm text-gray-500 hover:underline"
                        >
                          取消
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => startEdit(node)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        编辑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新建部门弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold">新建部门</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">部门名称 *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="请输入部门名称"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">上级部门</label>
                <select
                  value={form.parent_id}
                  onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                >
                  <option value="">无（顶级部门）</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">编码</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="部门编码"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">层级</label>
                <input
                  value={form.level}
                  onChange={(e) => setForm({ ...form, level: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="如：一级/二级/三级"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">编制人数</label>
                <input
                  type="number"
                  value={form.headcount_budget}
                  onChange={(e) => setForm({ ...form, headcount_budget: e.target.value })}
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="编制人数"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.name.trim()}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                确认创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入向导 */}
      {showImport && (
        <ImportWizard importType="org_structure" onClose={() => setShowImport(false)} onComplete={load} />
      )}
    </div>
  );
}
