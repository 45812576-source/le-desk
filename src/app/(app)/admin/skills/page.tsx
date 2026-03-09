"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch, getToken } from "@/lib/api";
import type { SkillDetail, SkillVersion } from "@/lib/types";

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

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSkills = useCallback(() => {
    setLoading(true);
    apiFetch<SkillDetail[]>("/skills")
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  async function loadDetail(id: number) {
    setDetailLoading(true);
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

  async function handleDelete(id: number) {
    if (!confirm("确认删除该 Skill？")) return;
    try {
      await apiFetch(`/skills/${id}`, { method: "DELETE" });
      fetchSkills();
      if (selected?.id === id) setSelected(null);
    } catch {
      // ignore
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

  return (
    <PageShell
      title="Skill 管理"
      icon={ICONS.skillsAdmin}
      actions={
        <div className="flex gap-2">
          <PixelButton
            variant="primary"
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
              <button
                key={s.id}
                onClick={() => loadDetail(s.id)}
                className={`w-full text-left border-2 p-3 transition-colors ${
                  selected?.id === s.id
                    ? "border-[#00D1FF] bg-[#CCF2FF]"
                    : "border-[#1A202C] bg-white hover:bg-gray-50"
                }`}
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
                <p className="text-[10px] text-gray-600 mb-3">{selected.description}</p>
                <div className="flex flex-wrap gap-2">
                  <PixelBadge color={STATUS_COLOR[selected.status] || "gray"}>
                    {selected.status}
                  </PixelBadge>
                  <PixelBadge color="cyan">{selected.mode}</PixelBadge>
                  <PixelBadge color="purple">v{selected.current_version}</PixelBadge>
                  {selected.auto_inject && <PixelBadge color="green">自动注入</PixelBadge>}
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

              {/* Versions */}
              <div className="bg-white border-2 border-[#1A202C] p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">
                  版本历史
                </div>
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
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </PageShell>
  );
}
