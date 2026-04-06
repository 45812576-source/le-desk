"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type {
  GovernanceObjectLite,
  GovernanceObjectDetail,
} from "@/app/(app)/data/components/shared/types";

interface ObjectConflict {
  object_a_id: number;
  object_a_name: string;
  object_b_id: number;
  object_b_name: string;
  reason: string;
  similarity: number;
}

export default function GovernanceObjectsTab() {
  const [objects, setObjects] = useState<GovernanceObjectLite[]>([]);
  const [conflicts, setConflicts] = useState<ObjectConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GovernanceObjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // 创建对象表单
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ object_type_code: "", canonical_key: "", display_name: "", business_line: "" });

  // 绑定对象表单
  const [showBind, setShowBind] = useState(false);
  const [bindForm, setBindForm] = useState({ subject_type: "knowledge", subject_id: "", governance_object_id: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("object_type_code", typeFilter);
      if (search) params.set("q", search);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const [objs, confs] = await Promise.all([
        apiFetch<GovernanceObjectLite[]>(`/knowledge-governance/objects${qs}`),
        apiFetch<ObjectConflict[]>("/knowledge-governance/object-conflicts").catch(() => []),
      ]);
      setObjects(Array.isArray(objs) ? objs : []);
      setConflicts(Array.isArray(confs) ? confs : []);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search]);

  useEffect(() => { void load(); }, [load]);

  async function loadDetail(id: number) {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const d = await apiFetch<GovernanceObjectDetail>(`/knowledge-governance/objects/${id}`);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleMerge(sourceId: number, targetId: number) {
    setActing(`merge:${sourceId}:${targetId}`);
    try {
      await apiFetch("/knowledge-governance/objects/merge", {
        method: "POST",
        body: JSON.stringify({ source_object_id: sourceId, target_object_id: targetId }),
      });
      await load();
      if (selectedId === sourceId) { setSelectedId(null); setDetail(null); }
    } finally {
      setActing(null);
    }
  }

  async function handleCreate() {
    if (!createForm.object_type_code || !createForm.canonical_key || !createForm.display_name) return;
    setActing("create");
    try {
      await apiFetch("/knowledge-governance/objects", {
        method: "POST",
        body: JSON.stringify({
          object_type_code: createForm.object_type_code,
          canonical_key: createForm.canonical_key,
          display_name: createForm.display_name,
          business_line: createForm.business_line || null,
        }),
      });
      setShowCreate(false);
      setCreateForm({ object_type_code: "", canonical_key: "", display_name: "", business_line: "" });
      await load();
    } finally {
      setActing(null);
    }
  }

  async function handleBind() {
    const objId = parseInt(bindForm.governance_object_id, 10);
    const subId = parseInt(bindForm.subject_id, 10);
    if (isNaN(objId) || isNaN(subId)) return;
    setActing("bind");
    try {
      await apiFetch("/knowledge-governance/bind-object", {
        method: "POST",
        body: JSON.stringify({
          subject_type: bindForm.subject_type,
          subject_id: subId,
          governance_object_id: objId,
        }),
      });
      setShowBind(false);
      setBind({ subject_type: "knowledge", subject_id: "", governance_object_id: "" });
      if (selectedId === objId) await loadDetail(objId);
    } finally {
      setActing(null);
    }
  }

  function setBind(v: typeof bindForm) { setBindForm(v); }

  const LIFECYCLE_COLORS: Record<string, string> = {
    active: "text-emerald-600 border-emerald-200 bg-emerald-50",
    draft: "text-gray-500 border-gray-200 bg-gray-50",
    deprecated: "text-amber-600 border-amber-200 bg-amber-50",
    archived: "text-red-600 border-red-200 bg-red-50",
  };

  return (
    <div className="flex h-full min-h-0">
      {/* 左侧：列表 + 冲突 */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        {/* 搜索 + 操作 */}
        <div className="px-3 py-2 border-b border-border space-y-1.5">
          <div className="flex items-center gap-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索对象..."
              className="flex-1 text-[10px] border border-border px-2 py-0.5 bg-white"
              onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
            />
            <input
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              placeholder="类型码"
              className="w-20 text-[10px] border border-border px-2 py-0.5 bg-white"
            />
            <button onClick={() => void load()} disabled={loading} className="px-2 py-0.5 text-[8px] font-bold border border-border text-muted-foreground hover:bg-muted disabled:opacity-50">
              {loading ? "..." : "搜"}
            </button>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setShowCreate(true)} className="px-2 py-0.5 text-[8px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-muted">
              + 创建对象
            </button>
            <button onClick={() => setShowBind(true)} className="px-2 py-0.5 text-[8px] font-bold border border-violet-300 text-violet-600 hover:bg-muted">
              绑定
            </button>
            <span className="ml-auto text-[8px] text-gray-400">{objects.length} 个对象</span>
          </div>
        </div>

        {/* 冲突告警 */}
        {conflicts.length > 0 && (
          <div className="px-3 py-1.5 bg-red-50 border-b border-red-200">
            <div className="text-[8px] font-bold text-red-700 mb-1">冲突检测 ({conflicts.length})</div>
            {conflicts.slice(0, 5).map((c, idx) => (
              <div key={idx} className="flex items-center gap-1 text-[8px] mb-0.5">
                <span className="text-red-600 truncate">{c.object_a_name}</span>
                <span className="text-gray-400">↔</span>
                <span className="text-red-600 truncate">{c.object_b_name}</span>
                <span className="text-gray-400 ml-auto">{(c.similarity * 100).toFixed(0)}%</span>
                <button
                  onClick={() => void handleMerge(c.object_a_id, c.object_b_id)}
                  disabled={acting === `merge:${c.object_a_id}:${c.object_b_id}`}
                  className="px-1.5 py-px text-[7px] font-bold border border-red-300 text-red-600 hover:bg-red-100 flex-shrink-0"
                >
                  {acting === `merge:${c.object_a_id}:${c.object_b_id}` ? "..." : "合并"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 对象列表 */}
        <div className="flex-1 overflow-y-auto">
          {objects.length === 0 && !loading && (
            <div className="text-center py-8 text-[9px] text-gray-400">暂无治理对象</div>
          )}
          {objects.map((obj) => {
            const lc = LIFECYCLE_COLORS[obj.lifecycle_status] || LIFECYCLE_COLORS.draft;
            return (
              <div
                key={obj.id}
                onClick={() => void loadDetail(obj.id)}
                className={`px-3 py-2 border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedId === obj.id ? "bg-[#CCF2FF] border-l-2 border-l-[#00D1FF]" : "hover:bg-[#F0FBFF]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold truncate">{obj.display_name}</span>
                  <span className={`px-1 py-px text-[7px] font-bold border rounded flex-shrink-0 ${lc}`}>
                    {obj.lifecycle_status}
                  </span>
                </div>
                <div className="text-[8px] text-gray-400 mt-0.5 font-mono">{obj.canonical_key}</div>
                {obj.business_line && (
                  <span className="text-[7px] text-violet-500">{obj.business_line}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 右侧：详情 */}
      <div className="flex-1 min-w-0 overflow-auto">
        {selectedId === null ? (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-400 uppercase tracking-widest">
            选择左侧对象查看详情
          </div>
        ) : detailLoading ? (
          <div className="flex items-center justify-center h-full text-[10px] text-gray-400 animate-pulse">加载中...</div>
        ) : detail ? (
          <ObjectDetailView detail={detail} />
        ) : null}
      </div>

      {/* 创建对象弹窗 */}
      {showCreate && (
        <Modal title="创建治理对象" onClose={() => setShowCreate(false)}>
          <div className="space-y-2">
            <Field label="对象类型码" value={createForm.object_type_code} onChange={(v) => setCreateForm({ ...createForm, object_type_code: v })} placeholder="如 client_entity" />
            <Field label="规范键" value={createForm.canonical_key} onChange={(v) => setCreateForm({ ...createForm, canonical_key: v })} placeholder="唯一标识" />
            <Field label="显示名称" value={createForm.display_name} onChange={(v) => setCreateForm({ ...createForm, display_name: v })} />
            <Field label="业务线" value={createForm.business_line} onChange={(v) => setCreateForm({ ...createForm, business_line: v })} placeholder="可选" />
            <button
              onClick={() => void handleCreate()}
              disabled={acting === "create" || !createForm.object_type_code || !createForm.canonical_key || !createForm.display_name}
              className="px-3 py-1 text-[9px] font-bold border border-[#0077B6] text-[#0077B6] hover:bg-muted disabled:opacity-50"
            >
              {acting === "create" ? "创建中..." : "创建"}
            </button>
          </div>
        </Modal>
      )}

      {/* 绑定弹窗 */}
      {showBind && (
        <Modal title="绑定主体到治理对象" onClose={() => setShowBind(false)}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[9px]">
              <label className="text-gray-600">主体类型</label>
              <select
                value={bindForm.subject_type}
                onChange={(e) => setBind({ ...bindForm, subject_type: e.target.value })}
                className="border border-border px-2 py-0.5 text-[9px]"
              >
                <option value="knowledge">知识条目</option>
                <option value="business_table">数据表</option>
              </select>
            </div>
            <Field label="主体 ID" value={bindForm.subject_id} onChange={(v) => setBind({ ...bindForm, subject_id: v })} placeholder="知识/数据表 ID" />
            <Field label="治理对象 ID" value={bindForm.governance_object_id} onChange={(v) => setBind({ ...bindForm, governance_object_id: v })} />
            <button
              onClick={() => void handleBind()}
              disabled={acting === "bind" || !bindForm.subject_id || !bindForm.governance_object_id}
              className="px-3 py-1 text-[9px] font-bold border border-violet-400 text-violet-600 hover:bg-muted disabled:opacity-50"
            >
              {acting === "bind" ? "绑定中..." : "绑定"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── 对象详情视图 ──────────────────────────────────────────────────────────────

function ObjectDetailView({ detail }: { detail: GovernanceObjectDetail }) {
  const cb = detail.collaboration_baseline;
  return (
    <div className="p-4 space-y-4">
      {/* 基本信息 */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-bold text-slate-800">{detail.display_name}</h2>
          <span className="text-[8px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-500 font-mono">
            {detail.canonical_key}
          </span>
          <span className="text-[8px] px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-600 font-bold">
            {detail.lifecycle_status}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[9px]">
          <div className="border border-border rounded px-2 py-1">
            <div className="text-[8px] text-gray-500">业务线</div>
            <div className="font-semibold">{detail.business_line || "—"}</div>
          </div>
          <div className="border border-border rounded px-2 py-1">
            <div className="text-[8px] text-gray-500">部门</div>
            <div className="font-semibold">{detail.department_id ?? "—"}</div>
          </div>
          <div className="border border-border rounded px-2 py-1">
            <div className="text-[8px] text-gray-500">Owner</div>
            <div className="font-semibold">{detail.owner_id ?? "—"}</div>
          </div>
        </div>
      </section>

      {/* Facets */}
      {detail.facets && detail.facets.length > 0 && (
        <section className="border border-border rounded bg-card p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-violet-700 mb-2">Facets ({detail.facets.length})</div>
          <div className="space-y-1">
            {detail.facets.map((facet) => (
              <div key={facet.id} className="border border-border rounded px-3 py-2 text-[8px]">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">{facet.facet_name || facet.facet_key}</span>
                  <span className="text-gray-400">可见性: {facet.visibility_mode}</span>
                  {facet.is_editable && <span className="text-emerald-500">可编辑</span>}
                  {facet.update_cycle && <span className="text-gray-400">更新周期: {facet.update_cycle}</span>}
                </div>
                {facet.consumer_scenarios.length > 0 && (
                  <div className="mt-1 flex gap-1 flex-wrap">
                    {facet.consumer_scenarios.map((s) => (
                      <span key={s} className="px-1 py-px border border-gray-200 rounded text-[7px] text-gray-500">{s}</span>
                    ))}
                  </div>
                )}
                {Object.keys(facet.field_values).length > 0 && (
                  <div className="mt-1 text-gray-500 font-mono truncate">
                    {JSON.stringify(facet.field_values).slice(0, 120)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 协同基线 */}
      {cb && (
        <section className="border border-border rounded bg-card p-3 space-y-2">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#0077B6] mb-1">协同基线</div>

          {cb.knowledge_entries.length > 0 && (
            <div>
              <div className="text-[8px] font-bold text-gray-600 mb-0.5">关联知识 ({cb.knowledge_entries.length})</div>
              {cb.knowledge_entries.slice(0, 10).map((e) => (
                <div key={e.id} className="text-[8px] text-gray-500 truncate">#{e.id} {e.title}</div>
              ))}
            </div>
          )}

          {cb.business_tables.length > 0 && (
            <div>
              <div className="text-[8px] font-bold text-gray-600 mb-0.5">关联数据表 ({cb.business_tables.length})</div>
              {cb.business_tables.slice(0, 10).map((t) => (
                <div key={t.id} className="text-[8px] text-gray-500 truncate">#{t.id} {t.display_name}</div>
              ))}
            </div>
          )}

          {cb.projects.length > 0 && (
            <div>
              <div className="text-[8px] font-bold text-gray-600 mb-0.5">关联项目 ({cb.projects.length})</div>
              {cb.projects.slice(0, 5).map((p) => (
                <div key={p.id} className="text-[8px] text-gray-500 truncate">#{p.id} {p.name}</div>
              ))}
            </div>
          )}

          {cb.tasks.length > 0 && (
            <div>
              <div className="text-[8px] font-bold text-gray-600 mb-0.5">关联任务 ({cb.tasks.length})</div>
              {cb.tasks.slice(0, 5).map((t) => (
                <div key={t.id} className="text-[8px] text-gray-500 truncate">#{t.id} {t.title} ({t.status})</div>
              ))}
            </div>
          )}

          {cb.knowledge_entries.length === 0 && cb.business_tables.length === 0 && cb.projects.length === 0 && cb.tasks.length === 0 && (
            <div className="text-[8px] text-gray-400">暂无关联主体</div>
          )}
        </section>
      )}
    </div>
  );
}

// ── 通用组件 ──────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-card border-2 border-[#1A202C] w-[420px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-2 border-b border-border flex items-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-700">{title}</span>
          <button onClick={onClose} className="ml-auto text-[10px] text-gray-400 hover:text-gray-600 font-bold">✕</button>
        </div>
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-[9px] text-gray-600">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full border border-border px-2 py-1 text-[10px] bg-white"
      />
    </label>
  );
}
