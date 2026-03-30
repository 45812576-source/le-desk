"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelSelect } from "@/components/pixel/PixelSelect";
import { apiFetch, getToken } from "@/lib/api";
import type { SkillDetail, SkillVersion } from "@/lib/types";
import { CommentsPanel } from "@/components/skill/CommentsPanel";

interface SkillPolicy { id: number; skill_id: number; publish_scope: string; view_scope: string; default_data_scope: Record<string, unknown>; created_at: string; }
interface RolePolicyOverride { id: number; skill_policy_id: number; position_id: number; callable: boolean; data_scope: Record<string, unknown>; output_mask: string[]; created_at: string; }
interface AgentConnection { id: number; skill_policy_id: number; direction: string; connected_skill_id: number; created_at: string; }
interface Position { id: number; name: string; department_id: number | null; }

const SCOPE_LABELS: Record<string, string> = { self_only: "仅自己", same_role: "同岗位", cross_role: "跨岗位", org_wide: "全组织" };

const STATUS_COLOR: Record<string, "cyan" | "green" | "yellow" | "red" | "gray"> = {
  draft: "gray",
  published: "green",
  archived: "red",
};

interface UploadResult {
  filename: string;
  action?: string;
  id?: number;
  name?: string;
  version?: number;
  error?: string;
}

const CAT_COLOR: Record<string, string> = {
  example: "border-[#00CC99] text-[#00CC99] bg-green-50",
  "knowledge-base": "border-[#00A3C4] text-[#00A3C4] bg-cyan-50",
  reference: "border-[#B7791F] text-[#B7791F] bg-amber-50",
  template: "border-[#6B46C1] text-[#6B46C1] bg-purple-50",
};

export default function SkillTab() {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [sourceFiles, setSourceFiles] = useState<{ filename: string; category: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [activeTab, setActiveTab] = useState<"versions" | "files" | "comments" | "usage" | "policy">("versions");
  const [usageData, setUsageData] = useState<{
    skill_name: string;
    total_conv_count: number;
    total_user_count: number;
    by_user: { user_id: number; display_name: string; conv_count: number; msg_count: number }[];
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [batchPublishing, setBatchPublishing] = useState(false);
  const [userMap, setUserMap] = useState<Map<number, string>>(new Map());
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [fileLoading, setFileLoading] = useState<string | null>(null);
  const [policyData, setPolicyData] = useState<SkillPolicy | null>(null);
  const [policyOverrides, setPolicyOverrides] = useState<RolePolicyOverride[]>([]);
  const [policyConnections, setPolicyConnections] = useState<AgentConnection[]>([]);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSkills = useCallback(() => {
    setLoading(true);
    apiFetch<SkillDetail[]>("/skills")
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    apiFetch<{ id: number; display_name: string }[]>("/admin/users")
      .then((users) => setUserMap(new Map(users.map((u) => [u.id, u.display_name]))))
      .catch(() => {});
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  async function loadDetail(id: number) {
    setDetailLoading(true);
    setActiveTab("versions");
    setUsageData(null);
    setFileContents({});
    try {
      const data = await apiFetch<SkillDetail & { versions: SkillVersion[]; source_files?: { filename: string; category: string }[] }>(`/skills/${id}`);
      setSelected(data);
      setVersions(data.versions || []);
      setSourceFiles(data.source_files || []);
    } catch { /* ignore */ } finally {
      setDetailLoading(false);
    }
  }

  async function handleStatusChange(id: number, status: string) {
    try {
      await apiFetch(`/skills/${id}/status?status=${status}`, { method: "PATCH" });
      fetchSkills();
      if (selected?.id === id) setSelected((prev) => (prev ? { ...prev, status } : null));
    } catch { /* ignore */ }
  }

  async function handleScopeChange(id: number, scope: string) {
    if (!selected) return;
    try {
      await apiFetch(`/skills/${id}/status?status=${selected.status}&scope=${scope}`, { method: "PATCH" });
      setSelected((prev) => (prev ? { ...prev, scope: scope as SkillDetail["scope"] } : null));
      fetchSkills();
    } catch (e) { alert(`修改失败：${e instanceof Error ? e.message : "未知错误"}`); }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除该 Skill？")) return;
    try {
      await apiFetch(`/skills/${id}`, { method: "DELETE" });
      fetchSkills();
      if (selected?.id === id) setSelected(null);
    } catch (e) { alert(`删除失败：${e instanceof Error ? e.message : "未知错误"}`); }
  }

  function toggleCheck(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBatchPublish() {
    if (checkedIds.size === 0) return;
    if (!confirm(`确认将选中的 ${checkedIds.size} 个 Skill 批量发布到公司市场？`)) return;
    setBatchPublishing(true);
    try {
      await apiFetch("/skills/batch-publish", {
        method: "POST",
        body: JSON.stringify({ skill_ids: Array.from(checkedIds), scope: "company" }),
      });
      setCheckedIds(new Set());
      fetchSkills();
    } catch (e) { alert(`批量发布失败：${e instanceof Error ? e.message : "未知错误"}`); }
    finally { setBatchPublishing(false); }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadResults(null);
    const formData = new FormData();
    const isBatch = files.length > 1;
    if (isBatch) {
      for (let i = 0; i < files.length; i++) formData.append("files", files[i]);
    } else {
      formData.append("file", files[0]);
    }
    try {
      const token = getToken();
      const endpoint = isBatch ? "/skills/batch-upload-md" : "/skills/upload-md";
      const res = await fetch(`/api/proxy${endpoint}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadResults([{ filename: files[0]?.name || "unknown", error: data.detail || "上传失败" }]);
        return;
      }
      if (isBatch) setUploadResults(data.results);
      else setUploadResults([{ filename: files[0].name, action: data.action, id: data.id, name: data.name, version: data.version }]);
      fetchSkills();
    } catch { setUploadResults([{ filename: "unknown", error: "网络错误" }]); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function loadUsage(id: number) {
    setUsageLoading(true);
    try { setUsageData(await apiFetch(`/skills/${id}/usage`)); }
    catch { setUsageData(null); }
    finally { setUsageLoading(false); }
  }

  async function loadFileContent(skillId: number, filename: string) {
    const key = `${skillId}:${filename}`;
    if (fileContents[key] !== undefined) {
      setFileContents((prev) => { const next = { ...prev }; delete next[key]; return next; });
      return;
    }
    setFileLoading(key);
    try {
      const data = await apiFetch<{ content: string }>(`/skills/${skillId}/files/${encodeURIComponent(filename)}`);
      setFileContents((prev) => ({ ...prev, [key]: data.content }));
    } catch {
      setFileContents((prev) => ({ ...prev, [key]: "加载失败" }));
    } finally { setFileLoading(null); }
  }

  function handleIterateDone() {
    if (selected) { loadDetail(selected.id); fetchSkills(); setActiveTab("versions"); }
  }

  async function loadPolicy(skillId: number) {
    setPolicyLoading(true);
    setPolicyData(null);
    setPolicyOverrides([]);
    setPolicyConnections([]);
    try {
      const [policies, pos] = await Promise.all([
        apiFetch<SkillPolicy[]>("/admin/skill-policies"),
        positions.length ? Promise.resolve(positions) : apiFetch<Position[]>("/admin/permissions/positions"),
      ]);
      if (!positions.length) setPositions(pos);
      const policy = policies.find((p) => p.skill_id === skillId);
      if (policy) {
        setPolicyData(policy);
        const [ov, conn] = await Promise.all([
          apiFetch<RolePolicyOverride[]>(`/admin/skill-policies/${policy.id}/overrides`).catch(() => []),
          apiFetch<AgentConnection[]>(`/admin/skill-policies/${policy.id}/connections`).catch(() => []),
        ]);
        setPolicyOverrides(ov);
        setPolicyConnections(conn);
      }
    } catch { /* ignore */ }
    finally { setPolicyLoading(false); }
  }

  async function updatePolicyScope(field: "publish_scope" | "view_scope", value: string) {
    if (!policyData) return;
    await apiFetch(`/admin/skill-policies/${policyData.id}`, { method: "PUT", body: JSON.stringify({ [field]: value }) }).catch(() => {});
    setPolicyData((prev) => prev ? { ...prev, [field]: value } : null);
  }

  async function toggleOverrideCallable(override: RolePolicyOverride) {
    if (!policyData) return;
    await apiFetch(`/admin/skill-policies/${policyData.id}/overrides`, {
      method: "POST",
      body: JSON.stringify({ position_id: override.position_id, callable: !override.callable, data_scope: override.data_scope, output_mask: override.output_mask }),
    });
    const ov = await apiFetch<RolePolicyOverride[]>(`/admin/skill-policies/${policyData.id}/overrides`).catch(() => []);
    setPolicyOverrides(ov);
  }

  async function deleteConnection(connId: number) {
    if (!policyData) return;
    await apiFetch(`/admin/skill-policies/${policyData.id}/connections/${connId}`, { method: "DELETE" });
    const conn = await apiFetch<AgentConnection[]>(`/admin/skill-policies/${policyData.id}/connections`).catch(() => []);
    setPolicyConnections(conn);
  }

  async function createPolicyForSkill() {
    if (!selected) return;
    try {
      await apiFetch("/admin/skill-policies", {
        method: "POST",
        body: JSON.stringify({ skill_id: selected.id, publish_scope: "same_role", view_scope: "org_wide", default_data_scope: {} }),
      });
      loadPolicy(selected.id);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "创建失败"); }
  }

  const posName = (id: number) => positions.find((p) => p.id === id)?.name || `岗位 #${id}`;
  const skillNameById = (id: number) => skills.find((s) => s.id === id)?.name || `Skill #${id}`;

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        {checkedIds.size > 0 && (
          <PixelButton variant="primary" size="sm" disabled={batchPublishing} onClick={handleBatchPublish}>
            {batchPublishing ? "发布中..." : `批量发布 (${checkedIds.size})`}
          </PixelButton>
        )}
        <PixelButton variant="secondary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "上传中..." : "上传 .md"}
        </PixelButton>
        <input ref={fileRef} type="file" accept=".md" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
      </div>

      {/* Upload results */}
      {uploadResults && (
        <div className="mb-3 flex-shrink-0 border-2 border-[#1A202C] bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">上传结果</span>
            <button onClick={() => setUploadResults(null)} className="text-[9px] font-bold text-gray-400 hover:text-[#1A202C]">x 关闭</button>
          </div>
          <div className="space-y-1">
            {uploadResults.map((r, i) => (
              <div key={i} className="text-[10px] font-bold flex items-center gap-2">
                <span className="text-gray-500 truncate max-w-[200px]">{r.filename}</span>
                {r.error
                  ? <span className="text-red-500">{r.error}</span>
                  : <span className="text-green-600">{r.action === "created" ? "新建" : "更新"} [{r.name}] v{r.version}</span>
                }
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left: list */}
        <div className="w-80 flex-shrink-0 space-y-2 overflow-y-auto">
          {loading ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div>
          ) : skills.length === 0 ? (
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">暂无 Skill</div>
          ) : (
            skills.map((s) => (
              <div
                key={s.id}
                className={`flex items-start gap-2 border-2 p-3 transition-colors ${
                  selected?.id === s.id ? "border-[#00D1FF] bg-[#CCF2FF]" : "border-[#1A202C] bg-white hover:bg-gray-50"
                }`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleCheck(s.id); }}
                  className={`mt-0.5 w-4 h-4 border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                    checkedIds.has(s.id) ? "border-[#1A202C] bg-[#1A202C]" : "border-gray-300 hover:border-[#1A202C]"
                  }`}
                >
                  {checkedIds.has(s.id) && <span className="text-white text-[8px] font-bold">✓</span>}
                </button>
                <button className="flex-1 text-left min-w-0" onClick={() => loadDetail(s.id)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold truncate">{s.name}</span>
                    <PixelBadge color={STATUS_COLOR[s.status] || "gray"}>{s.status}</PixelBadge>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate">{s.description || "无描述"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[8px] text-gray-400">v{s.current_version}</span>
                    <span className="text-[8px] text-gray-400">{s.mode}</span>
                  </div>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Right: detail */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-gray-400">
              选择一个 Skill 查看详情
            </div>
          ) : detailLoading ? (
            <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">Loading...</div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-white border-2 border-[#1A202C] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold">{selected.name}</h2>
                  <div className="flex gap-1">
                    {selected.status !== "published" && (
                      <PixelButton size="sm" onClick={() => handleStatusChange(selected.id, "published")}>发布</PixelButton>
                    )}
                    {selected.status === "published" && (
                      <PixelButton size="sm" variant="secondary" onClick={() => handleStatusChange(selected.id, "archived")}>归档</PixelButton>
                    )}
                    <PixelButton size="sm" variant="danger" onClick={() => handleDelete(selected.id)}>删除</PixelButton>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mb-1">{selected.description}</p>
                {selected.created_by && (
                  <p className="text-[9px] text-gray-400 mb-3">
                    作者：<span className="font-bold text-[#1A202C]">{userMap.get(selected.created_by) ?? `#${selected.created_by}`}</span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2 items-center">
                  <PixelBadge color={STATUS_COLOR[selected.status] || "gray"}>{selected.status}</PixelBadge>
                  <PixelBadge color="cyan">{selected.mode}</PixelBadge>
                  <PixelBadge color="purple">v{selected.current_version}</PixelBadge>
                  {selected.auto_inject && <PixelBadge color="green">自动注入</PixelBadge>}
                  <div className="flex items-center gap-1 ml-1">
                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">可见范围</span>
                    {(["company", "department", "personal"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleScopeChange(selected.id, s)}
                        className={`px-2 py-0.5 text-[8px] font-bold border-2 uppercase tracking-widest transition-colors ${
                          (selected.scope ?? "personal") === s
                            ? "border-[#1A202C] bg-[#1A202C] text-white"
                            : "border-gray-300 text-gray-400 hover:border-[#00A3C4] hover:text-[#00A3C4]"
                        }`}
                      >
                        {s === "company" ? "全公司" : s === "department" ? "部门" : "仅自己"}
                      </button>
                    ))}
                  </div>
                </div>
                {selected.knowledge_tags && selected.knowledge_tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.knowledge_tags.map((t) => (
                      <span key={t} className="text-[8px] text-[#00A3C4] font-bold uppercase">#{t}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b-2 border-[#1A202C]">
                {(["versions", "files", "comments", "usage", "policy"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setActiveTab(t);
                      if (t === "usage" && selected && !usageData && !usageLoading) loadUsage(selected.id);
                      if (t === "policy" && selected && !policyData && !policyLoading) loadPolicy(selected.id);
                    }}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wide border-r-2 border-[#1A202C] transition-colors ${
                      activeTab === t ? "bg-[#1A202C] text-white" : "bg-white text-[#1A202C] hover:bg-[#CCF2FF]"
                    }`}
                  >
                    {t === "versions" ? "版本历史" : t === "files" ? `文档目录 (${sourceFiles.length})` : t === "comments" ? "用户意见" : t === "usage" ? "使用统计" : "策略"}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="bg-white border-2 border-[#1A202C] p-4">
                {activeTab === "versions" ? (
                  versions.length === 0 ? (
                    <p className="text-[10px] text-gray-400">无版本记录</p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((v) => (
                        <div key={v.id} className="border border-gray-200 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold">v{v.version}</span>
                            <span className="text-[8px] text-gray-400">{new Date(v.created_at).toLocaleDateString("zh-CN")}</span>
                          </div>
                          {v.change_note && <p className="text-[10px] text-gray-600 mb-1">{v.change_note}</p>}
                          {v.system_prompt && (
                            <pre className="text-[10px] bg-gray-50 border border-gray-200 p-2 max-h-40 overflow-auto whitespace-pre-wrap">{v.system_prompt}</pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : activeTab === "files" ? (
                  sourceFiles.length === 0 ? (
                    <p className="text-[10px] text-gray-400">无附属文件</p>
                  ) : (
                    <div className="space-y-1">
                      {/* Group by category */}
                      {Object.entries(
                        sourceFiles.reduce<Record<string, { filename: string; category: string }[]>>((acc, f) => {
                          (acc[f.category] = acc[f.category] || []).push(f);
                          return acc;
                        }, {})
                      ).map(([cat, files]) => (
                        <div key={cat} className="mb-3">
                          <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">{cat} ({files.length})</div>
                          {files.map((f) => {
                            const key = `${selected.id}:${f.filename}`;
                            return (
                              <div key={f.filename} className="mb-1">
                                <button
                                  onClick={() => loadFileContent(selected.id, f.filename)}
                                  className="flex items-center gap-2 w-full text-left px-2 py-1 border border-border bg-card hover:bg-muted/50 transition-colors"
                                >
                                  <span className="text-[9px] font-mono font-bold text-foreground">{f.filename}</span>
                                  <span className={`text-[7px] font-bold px-1.5 py-0.5 border ${CAT_COLOR[f.category] || "border-gray-300 text-gray-400 bg-gray-50"}`}>
                                    {f.category}
                                  </span>
                                  {fileLoading === key && <span className="text-[7px] text-[#00A3C4] animate-pulse ml-auto">Loading...</span>}
                                  <span className="ml-auto text-[8px] text-gray-400">{fileContents[key] !== undefined ? "▼" : "▶"}</span>
                                </button>
                                {fileContents[key] !== undefined && (
                                  <pre className="text-[8px] text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-muted border border-t-0 border-border px-3 py-2 max-h-48 overflow-y-auto">
                                    {fileContents[key]}
                                  </pre>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )
                ) : activeTab === "usage" ? (
                  usageLoading ? (
                    <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-8 animate-pulse">加载中...</div>
                  ) : !usageData ? (
                    <div className="text-[10px] text-gray-400 text-center py-8">暂无使用数据</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "总对话数", value: usageData.total_conv_count },
                          { label: "活跃用户数", value: usageData.total_user_count },
                          { label: "人均对话", value: usageData.total_user_count ? (usageData.total_conv_count / usageData.total_user_count).toFixed(1) : "—" },
                        ].map(({ label, value }) => (
                          <div key={label} className="border-2 border-[#1A202C] p-3 text-center">
                            <div className="text-[20px] font-bold text-[#1A202C]">{value}</div>
                            <div className="text-[8px] font-bold uppercase text-gray-400 mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                      {usageData.by_user.length === 0 ? (
                        <div className="text-[10px] text-gray-400 text-center py-4">暂无用户使用记录</div>
                      ) : (
                        <table className="w-full border border-[#E2E8F0] text-[10px]">
                          <thead>
                            <tr className="bg-[#F0F4F8]">
                              <th className="text-left px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">#</th>
                              <th className="text-left px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">用户</th>
                              <th className="text-right px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">对话数</th>
                              <th className="text-right px-3 py-2 font-bold text-gray-500 uppercase text-[9px]">消息数</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageData.by_user.map((row, i) => (
                              <tr key={row.user_id} className="border-t border-[#E2E8F0] hover:bg-[#F0F4F8]">
                                <td className="px-3 py-2 text-gray-400 font-bold">{i + 1}</td>
                                <td className="px-3 py-2 font-bold text-[#1A202C]">{row.display_name}</td>
                                <td className="px-3 py-2 text-right font-bold text-[#00A3C4]">{row.conv_count}</td>
                                <td className="px-3 py-2 text-right text-gray-500">{row.msg_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                ) : activeTab === "policy" ? (
                  policyLoading ? (
                    <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-8 animate-pulse">加载中...</div>
                  ) : !policyData ? (
                    <div className="text-center py-8 space-y-3">
                      <p className="text-[10px] text-gray-400 font-bold">该 Skill 尚未创建策略</p>
                      <PixelButton variant="primary" size="sm" onClick={createPolicyForSkill}>+ 创建策略</PixelButton>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Scope selectors */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] font-bold uppercase text-[#00A3C4] block mb-1">可见范围</label>
                          <PixelSelect value={policyData.view_scope} onChange={(e) => updatePolicyScope("view_scope", e.target.value)}>
                            {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </PixelSelect>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold uppercase text-[#00A3C4] block mb-1">可用范围</label>
                          <PixelSelect value={policyData.publish_scope} onChange={(e) => updatePolicyScope("publish_scope", e.target.value)}>
                            {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </PixelSelect>
                        </div>
                      </div>

                      {/* Role overrides */}
                      <div>
                        <div className="text-[9px] font-bold uppercase text-[#00A3C4] mb-2">角色调用覆盖</div>
                        {policyOverrides.length === 0 ? (
                          <p className="text-[10px] text-gray-400">暂无覆盖规则，使用默认策略</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[10px] text-gray-500 font-bold">
                                <th className="text-left pb-1">岗位</th>
                                <th className="text-left pb-1">可调用</th>
                                <th className="text-left pb-1">输出遮罩</th>
                                <th className="text-left pb-1">数据范围</th>
                              </tr>
                            </thead>
                            <tbody>
                              {policyOverrides.map((o) => (
                                <tr key={o.id} className="border-t border-gray-100">
                                  <td className="py-1">{posName(o.position_id)}</td>
                                  <td className="py-1">
                                    <button onClick={() => toggleOverrideCallable(o)}
                                      className={`text-[10px] font-bold px-2 py-0.5 border-2 ${o.callable ? "border-green-400 text-green-700 bg-green-50" : "border-red-400 text-red-700 bg-red-50"}`}
                                    >{o.callable ? "允许" : "禁止"}</button>
                                  </td>
                                  <td className="py-1 text-gray-500">{o.output_mask.length > 0 ? o.output_mask.join(", ") : "无"}</td>
                                  <td className="py-1 text-[10px] text-gray-400">{JSON.stringify(o.data_scope).slice(0, 40)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* Agent connections */}
                      <div>
                        <div className="text-[9px] font-bold uppercase text-[#00A3C4] mb-2">Agent 上下游连接</div>
                        {policyConnections.length === 0 ? (
                          <p className="text-[10px] text-gray-400">暂无 Agent 连接白名单</p>
                        ) : (
                          <div className="space-y-1">
                            {policyConnections.map((c) => (
                              <div key={c.id} className="flex items-center gap-2 text-xs">
                                <PixelBadge color={c.direction === "upstream" ? "cyan" : "yellow"}>{c.direction === "upstream" ? "上游" : "下游"}</PixelBadge>
                                <span className="font-bold">{skillNameById(c.connected_skill_id)}</span>
                                <button onClick={() => deleteConnection(c.id)} className="text-[10px] text-red-500 hover:underline ml-auto">删除</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-[8px] text-gray-400">策略 ID: {policyData.id} · 创建于 {new Date(policyData.created_at).toLocaleDateString("zh-CN")}</div>
                    </div>
                  )
                ) : (
                  <CommentsPanel skillId={selected.id} onIterateDone={handleIterateDone} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
