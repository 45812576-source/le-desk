"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch, getToken } from "@/lib/api";
import type { SkillDetail, SkillVersion } from "@/lib/types";
import { CommentsPanel } from "@/components/skill/CommentsPanel";

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [activeTab, setActiveTab] = useState<"versions" | "comments" | "usage">("versions");
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

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  async function loadDetail(id: number) {
    setDetailLoading(true);
    setActiveTab("versions");
    setUsageData(null);
    try {
      const data = await apiFetch<SkillDetail & { versions: SkillVersion[] }>(`/skills/${id}`);
      setSelected(data);
      setVersions(data.versions || []);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleStatusChange(id: number, status: string) {
    try {
      await apiFetch(`/skills/${id}/status?status=${status}`, { method: "PATCH" });
      fetchSkills();
      if (selected?.id === id) {
        setSelected((prev) => (prev ? { ...prev, status } : null));
      }
    } catch {
      // ignore
    }
  }

  async function handleScopeChange(id: number, scope: string) {
    if (!selected) return;
    try {
      await apiFetch(`/skills/${id}/status?status=${selected.status}&scope=${scope}`, { method: "PATCH" });
      setSelected((prev) => (prev ? { ...prev, scope: scope as SkillDetail["scope"] } : null));
      fetchSkills();
    } catch (e) {
      alert(`修改失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除该 Skill？")) return;
    try {
      await apiFetch(`/skills/${id}`, { method: "DELETE" });
      fetchSkills();
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      alert(`删除失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
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
    } catch (e) {
      alert(`批量发布失败：${e instanceof Error ? e.message : "未知错误"}`);
    } finally {
      setBatchPublishing(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadResults(null);

    const formData = new FormData();
    const isBatch = files.length > 1;

    if (isBatch) {
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
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

      if (isBatch) {
        setUploadResults(data.results);
      } else {
        setUploadResults([{
          filename: files[0].name,
          action: data.action,
          id: data.id,
          name: data.name,
          version: data.version,
        }]);
      }
      fetchSkills();
    } catch {
      setUploadResults([{ filename: "unknown", error: "网络错误" }]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function loadUsage(id: number) {
    setUsageLoading(true);
    try {
      const data = await apiFetch<typeof usageData>(`/skills/${id}/usage`);
      setUsageData(data);
    } catch {
      setUsageData(null);
    } finally {
      setUsageLoading(false);
    }
  }

  // After apply iterate, reload detail to show new version
  function handleIterateDone() {
    if (selected) {
      loadDetail(selected.id);
      fetchSkills();
      setActiveTab("versions");
    }
  }

  return (
    <PageShell
      title="Skill 管理"
      icon={ICONS.skillsAdmin}
      actions={
        <div className="flex gap-2">
          {checkedIds.size > 0 && (
            <PixelButton
              variant="primary"
              size="sm"
              disabled={batchPublishing}
              onClick={handleBatchPublish}
            >
              {batchPublishing ? "发布中..." : `批量发布 (${checkedIds.size})`}
            </PixelButton>
          )}
          <PixelButton
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "上传中..." : "上传 .md"}
          </PixelButton>
          <input
            ref={fileRef}
            type="file"
            accept=".md"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      }
    >
      <div className="flex flex-col h-full gap-0">
        {/* Upload results banner */}
        {uploadResults && (
          <div className="mb-4 flex-shrink-0 border-2 border-[#1A202C] bg-white p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
                上传结果
              </span>
              <button
                onClick={() => setUploadResults(null)}
                className="text-[9px] font-bold text-gray-400 hover:text-[#1A202C]"
              >
                x 关闭
              </button>
            </div>
            <div className="space-y-1">
              {uploadResults.map((r, i) => (
                <div key={i} className="text-[10px] font-bold flex items-center gap-2">
                  <span className="text-gray-500 truncate max-w-[200px]">{r.filename}</span>
                  {r.error ? (
                    <span className="text-red-500">{r.error}</span>
                  ) : (
                    <span className="text-green-600">
                      {r.action === "created" ? "新建" : "更新"} [{r.name}] v{r.version}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-6 flex-1 min-h-0">
          {/* Left: list */}
          <div className="w-80 flex-shrink-0 space-y-2 overflow-y-auto">
            {loading ? (
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
                Loading...
              </div>
            ) : skills.length === 0 ? (
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
                暂无 Skill
              </div>
            ) : (
              skills.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-start gap-2 border-2 p-3 transition-colors ${
                    selected?.id === s.id
                      ? "border-[#00D1FF] bg-[#CCF2FF]"
                      : "border-[#1A202C] bg-white hover:bg-gray-50"
                  }`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleCheck(s.id); }}
                    className={`mt-0.5 w-4 h-4 border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      checkedIds.has(s.id)
                        ? "border-[#1A202C] bg-[#1A202C]"
                        : "border-gray-300 hover:border-[#1A202C]"
                    }`}
                  >
                    {checkedIds.has(s.id) && <span className="text-white text-[8px] font-bold">✓</span>}
                  </button>
                  <button
                    className="flex-1 text-left min-w-0"
                    onClick={() => loadDetail(s.id)}
                  >
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
              <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
                Loading...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="bg-white border-2 border-[#1A202C] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold">{selected.name}</h2>
                    <div className="flex gap-1">
                      {selected.status !== "published" && (
                        <PixelButton
                          size="sm"
                          onClick={() => handleStatusChange(selected.id, "published")}
                        >
                          发布
                        </PixelButton>
                      )}
                      {selected.status === "published" && (
                        <PixelButton
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusChange(selected.id, "archived")}
                        >
                          归档
                        </PixelButton>
                      )}
                      <PixelButton
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(selected.id)}
                      >
                        删除
                      </PixelButton>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-600 mb-1">{selected.description}</p>
                  {selected.created_by && (
                    <p className="text-[9px] text-gray-400 mb-3">
                      作者：<span className="font-bold text-[#1A202C]">{userMap.get(selected.created_by) ?? `#${selected.created_by}`}</span>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    <PixelBadge color={STATUS_COLOR[selected.status] || "gray"}>
                      {selected.status}
                    </PixelBadge>
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
                        <span key={t} className="text-[8px] text-[#00A3C4] font-bold uppercase">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="flex border-b-2 border-[#1A202C]">
                  {(["versions", "comments", "usage"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        if (tab === "usage" && selected && !usageData && !usageLoading) {
                          loadUsage(selected.id);
                        }
                      }}
                      className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wide border-r-2 border-[#1A202C] transition-colors ${
                        activeTab === tab
                          ? "bg-[#1A202C] text-white"
                          : "bg-white text-[#1A202C] hover:bg-[#CCF2FF]"
                      }`}
                    >
                      {tab === "versions" ? "版本历史" : tab === "comments" ? "用户意见" : "使用统计"}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="bg-white border-2 border-[#1A202C] p-4">
                  {activeTab === "usage" ? (
                    usageLoading ? (
                      <div className="text-[10px] text-gray-400 font-bold uppercase text-center py-8 animate-pulse">加载中...</div>
                    ) : !usageData ? (
                      <div className="text-[10px] text-gray-400 text-center py-8">暂无使用数据</div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        {/* 汇总 */}
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
                        {/* 按用户明细 */}
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
                  ) : activeTab === "versions" ? (
                    <>
                      {versions.length === 0 ? (
                        <p className="text-[10px] text-gray-400">无版本记录</p>
                      ) : (
                        <div className="space-y-3">
                          {versions.map((v) => (
                            <div key={v.id} className="border border-gray-200 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold">v{v.version}</span>
                                <span className="text-[8px] text-gray-400">
                                  {new Date(v.created_at).toLocaleDateString("zh-CN")}
                                </span>
                              </div>
                              {v.change_note && (
                                <p className="text-[10px] text-gray-600 mb-1">{v.change_note}</p>
                              )}
                              {v.system_prompt && (
                                <pre className="text-[10px] bg-gray-50 border border-gray-200 p-2 max-h-40 overflow-auto whitespace-pre-wrap">
                                  {v.system_prompt}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <CommentsPanel
                      skillId={selected.id}
                      onIterateDone={handleIterateDone}
                    />
                  )}
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
