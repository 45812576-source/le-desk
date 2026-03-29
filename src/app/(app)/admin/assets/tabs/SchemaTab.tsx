"use client";

import { useCallback, useEffect, useState } from "react";
import React from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface OutputSchema {
  id: number; skill_id: number; version: number;
  status: "draft" | "pending_review" | "approved";
  schema_json: Record<string, unknown>;
  created_by: number | null; approved_by: number | null; created_at: string;
}

interface SkillItem { id: number; name: string; }

const STATUS_COLOR: Record<string, "green" | "yellow" | "cyan"> = { draft: "cyan", pending_review: "yellow", approved: "green" };
const STATUS_LABEL: Record<string, string> = { draft: "草稿", pending_review: "待审批", approved: "已通过" };

export default function SchemaTab() {
  const { user } = useAuth();
  const [schemas, setSchemas] = useState<OutputSchema[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillFilter, setSkillFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editJson, setEditJson] = useState("{}");
  const [editError, setEditError] = useState("");
  const [generating, setGenerating] = useState<number | null>(null);

  const fetchAll = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (skillFilter) params.set("skill_id", skillFilter);
    if (statusFilter) params.set("status", statusFilter);
    Promise.all([
      apiFetch<OutputSchema[]>(`/admin/output-schemas?${params}`),
      apiFetch<SkillItem[]>("/skills"),
    ]).then(([s, sk]) => { setSchemas(s); setSkills(sk); }).catch(() => {}).finally(() => setLoading(false));
  }, [skillFilter, statusFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const skillName = (id: number) => skills.find((s) => s.id === id)?.name || `Skill #${id}`;

  async function generate(skillId: number) {
    setGenerating(skillId);
    try { await apiFetch(`/admin/output-schemas/generate?skill_id=${skillId}`, { method: "POST" }); fetchAll(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : "推导失败"); }
    finally { setGenerating(null); }
  }

  async function approve(schemaId: number) {
    if (!confirm("确认审批通过此 Schema？")) return;
    try { await apiFetch(`/admin/output-schemas/${schemaId}/approve`, { method: "POST" }); fetchAll(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : "审批失败"); }
  }

  function startEdit(schema: OutputSchema) {
    setEditingId(schema.id); setEditJson(JSON.stringify(schema.schema_json, null, 2)); setEditError("");
  }

  async function saveEdit(schemaId: number) {
    setEditError("");
    let parsed; try { parsed = JSON.parse(editJson); } catch { setEditError("JSON 格式错误"); return; }
    try { await apiFetch(`/admin/output-schemas/${schemaId}`, { method: "PUT", body: JSON.stringify({ schema_json: parsed }) }); setEditingId(null); fetchAll(); }
    catch (e: unknown) { setEditError(e instanceof Error ? e.message : "保存失败"); }
  }

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <PixelSelect value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)} className="w-auto">
          <option value="">全部 Skill</option>
          {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </PixelSelect>
        <div className="flex gap-1">
          {["", "draft", "pending_review", "approved"].map((s) => (
            <PixelButton key={s} size="sm" variant={statusFilter === s ? "primary" : "secondary"} onClick={() => setStatusFilter(s)}>
              {s ? STATUS_LABEL[s] : "全部"}
            </PixelButton>
          ))}
        </div>
        <span className="text-[10px] text-gray-400 font-bold ml-auto">共 {schemas.length} 条</span>
      </div>

      {loading ? (
        <div className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div>
      ) : schemas.length === 0 ? (
        <div className="space-y-3">
          <div className="text-[10px] text-gray-400 font-bold py-6 text-center">暂无 Schema 数据</div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {skills.slice(0, 8).map((s) => (
                <PixelButton key={s.id} size="sm" variant="secondary" disabled={generating === s.id} onClick={() => generate(s.id)}>
                  {generating === s.id ? "推导中..." : `为 ${s.name} 推导`}
                </PixelButton>
              ))}
            </div>
          )}
        </div>
      ) : (
        <table className="w-full border-2 border-[#1A202C]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["Skill", "版本", "状态", "创建时间", "操作"].map((h) => (
                <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schemas.map((s) => (
              <React.Fragment key={s.id}>
                <tr className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs font-bold">{skillName(s.skill_id)}</td>
                  <td className="px-3 py-2 text-xs">v{s.version}</td>
                  <td className="px-3 py-2"><PixelBadge color={STATUS_COLOR[s.status] || "cyan"}>{STATUS_LABEL[s.status] || s.status}</PixelBadge></td>
                  <td className="px-3 py-2 text-[10px] text-gray-400 whitespace-nowrap">{new Date(s.created_at).toLocaleString("zh-CN")}</td>
                  <td className="px-3 py-2 flex gap-1">
                    <button onClick={() => setExpandedId(expandedId === s.id ? null : s.id)} className="text-[10px] font-bold text-[#00A3C4] hover:underline">
                      {expandedId === s.id ? "收起" : "查看"}
                    </button>
                    {s.status !== "approved" && <button onClick={() => startEdit(s)} className="text-[10px] font-bold text-[#B7791F] hover:underline ml-2">编辑</button>}
                    {isSuperAdmin && s.status === "pending_review" && <button onClick={() => approve(s.id)} className="text-[10px] font-bold text-green-600 hover:underline ml-2">审批通过</button>}
                    <button onClick={() => generate(s.skill_id)} disabled={generating === s.skill_id} className="text-[10px] font-bold text-[#805AD5] hover:underline ml-2 disabled:opacity-40">
                      {generating === s.skill_id ? "推导中..." : "重新推导"}
                    </button>
                  </td>
                </tr>
                {expandedId === s.id && (
                  <tr><td colSpan={5} className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <pre className="text-[10px] font-mono overflow-auto max-h-48">{JSON.stringify(s.schema_json, null, 2)}</pre>
                  </td></tr>
                )}
                {editingId === s.id && (
                  <tr><td colSpan={5} className="px-4 py-3 bg-[#FEFCBF] border-b-2 border-[#B7791F]">
                    <textarea value={editJson} onChange={(e) => setEditJson(e.target.value)} rows={8}
                      className="w-full border-2 border-[#1A202C] px-3 py-2 text-xs font-mono focus:outline-none bg-white resize-none" />
                    {editError && <div className="mt-1 text-xs text-red-600 font-bold">{editError}</div>}
                    <div className="flex gap-2 mt-2">
                      <PixelButton variant="primary" size="sm" onClick={() => saveEdit(s.id)}>保存</PixelButton>
                      <PixelButton variant="secondary" size="sm" onClick={() => setEditingId(null)}>取消</PixelButton>
                    </div>
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      {schemas.length > 0 && (
        <div className="mt-4 p-3 border-2 border-[#1A202C] bg-[#EBF4F7]">
          <div className="text-[10px] font-bold uppercase text-[#00A3C4] mb-2">为其他 Skill 推导 Schema</div>
          <div className="flex gap-2 flex-wrap">
            {skills.filter((sk) => !schemas.some((s) => s.skill_id === sk.id)).map((sk) => (
              <PixelButton key={sk.id} size="sm" variant="secondary" disabled={generating === sk.id} onClick={() => generate(sk.id)}>
                {generating === sk.id ? "推导中..." : sk.name}
              </PixelButton>
            ))}
            {skills.filter((sk) => !schemas.some((s) => s.skill_id === sk.id)).length === 0 && (
              <span className="text-[10px] text-gray-400">所有 Skill 均已有 Schema</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
