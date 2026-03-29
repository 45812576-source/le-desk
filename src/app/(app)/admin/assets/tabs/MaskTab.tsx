"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";

interface GlobalMask { id: number; field_name: string; data_domain_id: number | null; mask_action: string; mask_params: Record<string, unknown>; severity: number; created_at: string; }
interface RoleMask { id: number; position_id: number; field_name: string; data_domain_id: number | null; mask_action: string; mask_params: Record<string, unknown>; created_at: string; }
interface DataDomain { id: number; name: string; display_name: string; }
interface Position { id: number; name: string; department_id: number | null; }

const MASK_ACTIONS = ["keep", "hide", "remove", "range", "truncate", "partial", "rank", "aggregate", "replace", "noise"];
const SEVERITY_COLOR: Record<number, "green" | "cyan" | "yellow" | "red"> = { 1: "green", 2: "cyan", 3: "yellow", 4: "red", 5: "red" };

type TabType = "global" | "role";

export default function MaskTab() {
  const [tab, setTab] = useState<TabType>("global");
  const [globalMasks, setGlobalMasks] = useState<GlobalMask[]>([]);
  const [roleMasks, setRoleMasks] = useState<RoleMask[]>([]);
  const [domains, setDomains] = useState<DataDomain[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [posFilter, setPosFilter] = useState("");

  const [showGlobalForm, setShowGlobalForm] = useState(false);
  const [gField, setGField] = useState("");
  const [gDomain, setGDomain] = useState("");
  const [gAction, setGAction] = useState("hide");
  const [gSeverity, setGSeverity] = useState("3");
  const [gParams, setGParams] = useState("{}");

  const [showRoleForm, setShowRoleForm] = useState(false);
  const [rPos, setRPos] = useState("");
  const [rField, setRField] = useState("");
  const [rDomain, setRDomain] = useState("");
  const [rAction, setRAction] = useState("hide");
  const [rParams, setRParams] = useState("{}");
  const [formError, setFormError] = useState("");

  const [previewPos, setPreviewPos] = useState("");
  const [previewJson, setPreviewJson] = useState('[{"name":"张三","salary":50000,"phone":"13800138000"}]');
  const [previewResult, setPreviewResult] = useState<Record<string, unknown> | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const fetchAll = useCallback(() => {
    setLoading(true);
    const params = posFilter ? `?position_id=${posFilter}` : "";
    Promise.all([
      apiFetch<GlobalMask[]>("/admin/permissions/global-masks"),
      apiFetch<RoleMask[]>(`/admin/permissions/role-masks${params}`),
      apiFetch<DataDomain[]>("/admin/permissions/data-domains"),
      apiFetch<Position[]>("/admin/permissions/positions"),
    ]).then(([g, r, d, p]) => { setGlobalMasks(g); setRoleMasks(r); setDomains(d); setPositions(p); }).catch(() => {}).finally(() => setLoading(false));
  }, [posFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const domainName = (id: number | null) => id ? (domains.find((d) => d.id === id)?.display_name || `域#${id}`) : "通用";
  const posName = (id: number) => positions.find((p) => p.id === id)?.name || `岗位#${id}`;

  async function saveGlobalMask() {
    setFormError("");
    try { JSON.parse(gParams); } catch { setFormError("params JSON 格式错误"); return; }
    try {
      await apiFetch("/admin/permissions/global-masks", {
        method: "POST",
        body: JSON.stringify({ field_name: gField, data_domain_id: gDomain ? Number(gDomain) : null, mask_action: gAction, mask_params: JSON.parse(gParams), severity: Number(gSeverity) }),
      });
      setShowGlobalForm(false); setGField(""); setGDomain(""); setGAction("hide"); setGSeverity("3"); setGParams("{}"); fetchAll();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : "保存失败"); }
  }

  async function deleteGlobalMask(id: number) {
    if (!confirm("确认删除此全局脱敏规则？")) return;
    await apiFetch(`/admin/permissions/global-masks/${id}`, { method: "DELETE" }); fetchAll();
  }

  async function saveRoleMask() {
    setFormError("");
    if (!rPos) { setFormError("请选择岗位"); return; }
    try { JSON.parse(rParams); } catch { setFormError("params JSON 格式错误"); return; }
    try {
      await apiFetch("/admin/permissions/role-masks", {
        method: "POST",
        body: JSON.stringify({ position_id: Number(rPos), field_name: rField, data_domain_id: rDomain ? Number(rDomain) : null, mask_action: rAction, mask_params: JSON.parse(rParams) }),
      });
      setShowRoleForm(false); setRPos(""); setRField(""); setRDomain(""); setRAction("hide"); setRParams("{}"); fetchAll();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : "保存失败"); }
  }

  async function deleteRoleMask(id: number) {
    if (!confirm("确认删除此规则？")) return;
    await apiFetch(`/admin/permissions/role-masks/${id}`, { method: "DELETE" }); fetchAll();
  }

  async function runPreview() {
    if (!previewPos) { alert("请选择预览岗位"); return; }
    let data; try { data = JSON.parse(previewJson); } catch { alert("示例数据 JSON 格式错误"); return; }
    setPreviewing(true);
    try {
      const result = await apiFetch("/admin/permissions/mask-preview", { method: "POST", body: JSON.stringify({ position_id: Number(previewPos), sample_data: data }) });
      setPreviewResult(result as Record<string, unknown>);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "预览失败"); }
    finally { setPreviewing(false); }
  }

  return (
    <div>
      <div className="flex gap-1 mb-4 border-b-2 border-[#1A202C]">
        {(["global", "role"] as TabType[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-2 border-b-0 transition-colors ${
              tab === t ? "bg-[#CCF2FF] border-[#1A202C] text-[#1A202C]" : "border-transparent text-gray-400 hover:text-black"
            }`}
          >{t === "global" ? "全局规则" : "岗位规则 + 预览"}</button>
        ))}
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div>
      ) : tab === "global" ? (
        <>
          <div className="flex items-center mb-3">
            <span className="text-[10px] text-gray-400 font-bold">共 {globalMasks.length} 条全局规则</span>
            <PixelButton variant="primary" size="sm" className="ml-auto" onClick={() => { setShowGlobalForm(true); setFormError(""); }}>+ 新增规则</PixelButton>
          </div>
          <table className="w-full border-2 border-[#1A202C]">
            <thead>
              <tr className="bg-[#EBF4F7]">
                {["字段名", "数据域", "脱敏动作", "严重级别", "Params", "操作"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {globalMasks.map((m) => (
                <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-mono font-bold">{m.field_name}</td>
                  <td className="px-3 py-2 text-xs">{domainName(m.data_domain_id)}</td>
                  <td className="px-3 py-2"><PixelBadge color="cyan">{m.mask_action}</PixelBadge></td>
                  <td className="px-3 py-2"><PixelBadge color={SEVERITY_COLOR[m.severity] || "cyan"}>L{m.severity}</PixelBadge></td>
                  <td className="px-3 py-2 text-[10px] font-mono text-gray-500 max-w-[160px] truncate">{JSON.stringify(m.mask_params)}</td>
                  <td className="px-3 py-2"><PixelButton size="sm" variant="danger" onClick={() => deleteGlobalMask(m.id)}>删除</PixelButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-3">
            <PixelSelect value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="w-auto">
              <option value="">全部岗位</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </PixelSelect>
            <span className="text-[10px] text-gray-400 font-bold">共 {roleMasks.length} 条</span>
            <PixelButton variant="primary" size="sm" className="ml-auto" onClick={() => { setShowRoleForm(true); setFormError(""); }}>+ 新增规则</PixelButton>
          </div>
          <table className="w-full border-2 border-[#1A202C]">
            <thead>
              <tr className="bg-[#EBF4F7]">
                {["岗位", "字段名", "数据域", "脱敏动作", "操作"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roleMasks.map((m) => (
                <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-bold">{posName(m.position_id)}</td>
                  <td className="px-3 py-2 text-xs font-mono">{m.field_name}</td>
                  <td className="px-3 py-2 text-xs">{domainName(m.data_domain_id)}</td>
                  <td className="px-3 py-2"><PixelBadge color="yellow">{m.mask_action}</PixelBadge></td>
                  <td className="px-3 py-2"><PixelButton size="sm" variant="danger" onClick={() => deleteRoleMask(m.id)}>删除</PixelButton></td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Preview */}
          <div className="mt-6 border-2 border-[#805AD5] p-4">
            <div className="text-[10px] font-bold uppercase text-[#805AD5] mb-3">脱敏效果预览</div>
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">预览岗位</label>
                <PixelSelect value={previewPos} onChange={(e) => setPreviewPos(e.target.value)}>
                  <option value="">选择岗位</option>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </PixelSelect>
              </div>
              <div className="flex-1 min-w-[240px]">
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">示例数据 (JSON array)</label>
                <textarea value={previewJson} onChange={(e) => setPreviewJson(e.target.value)} rows={3}
                  className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-mono focus:outline-none bg-white resize-none" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <PixelButton variant="primary" size="sm" disabled={previewing} onClick={runPreview}>
                {previewing ? "预览中..." : "运行预览"}
              </PixelButton>
            </div>
            {previewResult && (
              <pre className="mt-3 bg-white border-2 border-[#1A202C] p-3 text-[10px] font-mono overflow-auto max-h-48">
                {JSON.stringify(previewResult, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}

      {/* Global mask form modal */}
      {showGlobalForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border-2 border-[#1A202C] w-96">
            <div className="bg-[#EBF4F7] border-b-2 border-[#1A202C] px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest">新增全局脱敏规则</span>
              <button onClick={() => setShowGlobalForm(false)} className="text-xs text-gray-400 hover:text-black">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">字段名 *</label>
                <input type="text" value={gField} onChange={(e) => setGField(e.target.value)} placeholder="e.g. salary" className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00D1FF]" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">数据域</label>
                <PixelSelect value={gDomain} onChange={(e) => setGDomain(e.target.value)}>
                  <option value="">通用（无域限制）</option>
                  {domains.map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}
                </PixelSelect>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">脱敏动作</label>
                <PixelSelect value={gAction} onChange={(e) => setGAction(e.target.value)}>
                  {MASK_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </PixelSelect>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">严重级别 (1-5)</label>
                <input type="number" min={1} max={5} value={gSeverity} onChange={(e) => setGSeverity(e.target.value)} className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs focus:outline-none focus:border-[#00D1FF]" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">Params (JSON)</label>
                <input type="text" value={gParams} onChange={(e) => setGParams(e.target.value)} className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00D1FF]" />
              </div>
              {formError && <div className="bg-red-50 border-2 border-red-400 px-3 py-2 text-xs text-red-700 font-bold">{formError}</div>}
            </div>
            <div className="border-t-2 border-[#1A202C] px-4 py-3 flex gap-2 justify-end">
              <PixelButton variant="secondary" size="sm" onClick={() => setShowGlobalForm(false)}>取消</PixelButton>
              <PixelButton variant="primary" size="sm" onClick={saveGlobalMask}>保存</PixelButton>
            </div>
          </div>
        </div>
      )}

      {/* Role mask form modal */}
      {showRoleForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border-2 border-[#1A202C] w-96">
            <div className="bg-[#EBF4F7] border-b-2 border-[#1A202C] px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest">新增岗位脱敏覆盖</span>
              <button onClick={() => setShowRoleForm(false)} className="text-xs text-gray-400 hover:text-black">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">岗位 *</label>
                <PixelSelect value={rPos} onChange={(e) => setRPos(e.target.value)}>
                  <option value="">请选择</option>
                  {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </PixelSelect>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">字段名 *</label>
                <input type="text" value={rField} onChange={(e) => setRField(e.target.value)} placeholder="e.g. salary" className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00D1FF]" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">数据域</label>
                <PixelSelect value={rDomain} onChange={(e) => setRDomain(e.target.value)}>
                  <option value="">通用</option>
                  {domains.map((d) => <option key={d.id} value={d.id}>{d.display_name}</option>)}
                </PixelSelect>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">脱敏动作</label>
                <PixelSelect value={rAction} onChange={(e) => setRAction(e.target.value)}>
                  {MASK_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </PixelSelect>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-[#00A3C4] block mb-1">Params (JSON)</label>
                <input type="text" value={rParams} onChange={(e) => setRParams(e.target.value)} className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00D1FF]" />
              </div>
              {formError && <div className="bg-red-50 border-2 border-red-400 px-3 py-2 text-xs text-red-700 font-bold">{formError}</div>}
            </div>
            <div className="border-t-2 border-[#1A202C] px-4 py-3 flex gap-2 justify-end">
              <PixelButton variant="secondary" size="sm" onClick={() => setShowRoleForm(false)}>取消</PixelButton>
              <PixelButton variant="primary" size="sm" onClick={saveRoleMask}>保存</PixelButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
