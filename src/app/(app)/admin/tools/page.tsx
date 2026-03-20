"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { BookOpen, Wrench } from "lucide-react";
import { ICONS, PixelIcon } from "@/components/pixel";
import { useTheme } from "@/lib/theme";

function ThemedIcon({ iconKey, size }: { iconKey: "knowledgeMy" | "tools"; size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") {
    return <PixelIcon {...(iconKey === "knowledgeMy" ? ICONS.knowledgeMy : ICONS.tools)} size={size} />;
  }
  const Icon = iconKey === "knowledgeMy" ? BookOpen : Wrench;
  return <Icon size={size} className="text-muted-foreground" />;
}
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { ToolDeployInfo, ToolEntry, ToolManifest, ToolManifestDataSource } from "@/lib/types";

const SCOPE_OPTIONS = [
  { value: "personal", label: "个人" },
  { value: "department", label: "部门" },
  { value: "company", label: "全公司" },
];

const TYPE_LABELS: Record<string, string> = {
  builtin: "内置",
  mcp: "MCP",
  http: "HTTP",
};

const TYPE_COLOR: Record<string, "cyan" | "green" | "purple" | "gray"> = {
  mcp: "cyan",
  builtin: "green",
  http: "purple",
};

const ALL_TYPES = ["all", "builtin", "mcp", "http"] as const;

interface UploadResult {
  action: "created" | "updated";
  id: number;
  name: string;
  manifest: ToolManifest;
  manifest_warnings: string[];
}

export default function AdminToolsPage() {
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testTargetName, setTestTargetName] = useState("");
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Upload panel
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState<"py" | "mcp">("py");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // MCP upload state
  const [mcpZipUploading, setMcpZipUploading] = useState(false);
  const [mcpZipResult, setMcpZipResult] = useState<{ id: number; name: string; project_type: string; run_cmd: string; warnings: string[] } | null>(null);
  const [mcpZipError, setMcpZipError] = useState<string | null>(null);
  const [mcpZipDragOver, setMcpZipDragOver] = useState(false);
  const mcpZipInputRef = useRef<HTMLInputElement>(null);
  // MCP config generation
  const [mcpDescription, setMcpDescription] = useState("");
  const [mcpGenerating, setMcpGenerating] = useState(false);
  const [mcpGenerated, setMcpGenerated] = useState<Record<string, unknown> | null>(null);
  const [mcpGenError, setMcpGenError] = useState<string | null>(null);
  // MCP submit
  const [mcpSubmitting, setMcpSubmitting] = useState(false);
  const [mcpSubmitError, setMcpSubmitError] = useState<string | null>(null);
  const [mcpSubmitSuccess, setMcpSubmitSuccess] = useState<string | null>(null);

  const fetchTools = useCallback(() => {
    setLoading(true);
    apiFetch<ToolEntry[]>("/tools")
      .then(setTools)
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTools(); }, [fetchTools]);

  async function handleToggle(id: number, is_active: boolean) {
    try {
      await apiFetch(`/tools/${id}`, { method: "PUT", body: JSON.stringify({ is_active: !is_active }) });
      fetchTools();
    } catch { /* ignore */ }
  }

  async function handleTest(tool: ToolEntry) {
    setTestingId(tool.id);
    setTestTargetName(tool.display_name);
    setTestResult(null);
    try {
      const result = await apiFetch<Record<string, unknown>>(`/tools/${tool.id}/test`, {
        method: "POST",
        body: JSON.stringify({ params: {} }),
      });
      setTestResult(JSON.stringify(result, null, 2));
    } catch (err) {
      setTestResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确认删除？")) return;
    try {
      await apiFetch(`/tools/${id}`, { method: "DELETE" });
      fetchTools();
    } catch { /* ignore */ }
  }

  async function handleMcpZipUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) { setMcpZipError("只支持 .zip 文件"); return; }
    setMcpZipUploading(true);
    setMcpZipResult(null);
    setMcpZipError(null);
    setMcpGenerated(null);
    setMcpGenError(null);
    setMcpSubmitError(null);
    setMcpSubmitSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch<{ id: number; name: string; project_type: string; run_cmd: string; warnings: string[] }>("/tools/upload-mcp", { method: "POST", body: form });
      setMcpZipResult(res);
    } catch (err) {
      setMcpZipError(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpZipUploading(false);
    }
  }

  async function handleMcpGenerateConfig() {
    if (!mcpDescription.trim()) return;
    setMcpGenerating(true);
    setMcpGenError(null);
    try {
      const res = await apiFetch<Record<string, unknown>>("/tools/generate-mcp-config", {
        method: "POST",
        body: JSON.stringify({ description: mcpDescription }),
      });
      setMcpGenerated(res);
    } catch (err) {
      setMcpGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpGenerating(false);
    }
  }

  async function handleMcpSubmit() {
    if (!mcpZipResult || !mcpGenerated) return;
    setMcpSubmitting(true);
    setMcpSubmitError(null);
    try {
      // 将 AI 生成的 manifest 写入工具记录，触发审批
      const manifest = {
        invocation_mode: mcpGenerated.invocation_mode ?? "chat",
        data_sources: mcpGenerated.data_sources ?? [],
        permissions: mcpGenerated.permissions ?? [],
        preconditions: mcpGenerated.preconditions ?? [],
      };
      const deployInfo = { env_requirements: mcpGenerated.env_requirements ?? "" };
      // 更新工具的 display_name / description / manifest
      await apiFetch(`/tools/${mcpZipResult.id}`, {
        method: "PUT",
        body: JSON.stringify({
          display_name: String(mcpGenerated.display_name || mcpZipResult.name),
          description: String(mcpGenerated.description || ""),
          config: { install_dir: undefined, project_type: undefined, run_cmd: undefined, manifest, deploy_info: deployInfo },
        }),
      });
      // 提交审批
      await apiFetch(`/tools/${mcpZipResult.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published", scope: "company" }),
      });
      setMcpSubmitSuccess(`「${mcpGenerated.display_name ?? mcpZipResult.name}」已提交审批`);
      fetchTools();
    } catch (err) {
      setMcpSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setMcpSubmitting(false);
    }
  }

  async function handleUploadFile(file: File) {
    if (!file.name.endsWith(".py")) {
      setUploadError("只支持 .py 文件");
      return;
    }
    setUploading(true);
    setUploadResult(null);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch<UploadResult>("/tools/upload-py", { method: "POST", body: form });
      setUploadResult(res);
      fetchTools();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUploadFile(file);
  }

  // Filter
  const filtered = tools.filter((t) => {
    const matchQ = !q.trim() ||
      t.display_name.toLowerCase().includes(q.toLowerCase()) ||
      t.name.toLowerCase().includes(q.toLowerCase()) ||
      (t.description ?? "").toLowerCase().includes(q.toLowerCase());
    const matchType = filterType === "all" || t.tool_type === filterType;
    return matchQ && matchType;
  });

  // Group counts
  const counts: Record<string, number> = { all: tools.length };
  for (const t of tools) {
    counts[t.tool_type ?? "other"] = (counts[t.tool_type ?? "other"] ?? 0) + 1;
  }

  return (
    <PageShell title="工具管理" icon={ICONS.tools}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-0 border-2 border-[#1A202C] bg-white flex-1 min-w-[180px] max-w-xs">
          <span className="px-2 opacity-40">
            <ThemedIcon iconKey="knowledgeMy" size={12} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索工具名称 / 描述..."
            className="flex-1 py-1.5 text-[10px] font-bold focus:outline-none bg-transparent pr-2"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1">
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-2.5 py-1 border-2 text-[9px] font-bold uppercase tracking-widest transition-colors ${
                filterType === type
                  ? "border-[#1A202C] bg-[#1A202C] text-white"
                  : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
              }`}
            >
              {type === "all" ? "全部" : TYPE_LABELS[type] ?? type}
              <span className="ml-1 opacity-60">{counts[type] ?? 0}</span>
            </button>
          ))}
        </div>

        <PixelButton size="sm" variant="primary" onClick={() => { setShowUpload((v) => !v); setUploadResult(null); setUploadError(null); setMcpZipError(null); setMcpSubmitError(null); setMcpSubmitSuccess(null); }}>
          {showUpload ? "▾ 收起" : "+ 上传工具"}
        </PixelButton>

        <span className="ml-auto text-[9px] text-gray-400 font-bold uppercase tracking-widest">
          {filtered.length} / {tools.length}
        </span>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="mb-5 border-2 border-[#1A202C] bg-white">
          {/* Tab bar */}
          <div className="flex border-b-2 border-[#1A202C]">
            {(["py", "mcp"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setUploadTab(tab)}
                className={`px-5 py-2.5 text-[9px] font-bold uppercase tracking-widest border-r-2 border-[#1A202C] last:border-r-0 transition-colors ${
                  uploadTab === tab
                    ? "bg-[#1A202C] text-white"
                    : "bg-[#EBF4F7] text-[#1A202C] hover:bg-[#D8EEF5]"
                }`}
              >
                {tab === "py" ? "Python 脚本" : "MCP 服务"}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* ── Python 脚本 tab ── */}
            {uploadTab === "py" && (
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-8 transition-colors ${
                    dragOver ? "border-[#00D1FF] bg-[#CCF2FF]/30" : "border-gray-300 hover:border-[#00A3C4] hover:bg-[#F0F4F8]"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".py"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFile(f); e.target.value = ""; }}
                  />
                  {uploading ? (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">解析中...</span>
                  ) : (
                    <>
                      <span className="text-2xl mb-2 opacity-40">🐍</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">拖入 .py 文件，或点击选择</span>
                      <span className="text-[8px] text-gray-300 mt-1 font-mono">文件顶部需包含 # __le_desk_manifest__ 注释块</span>
                    </>
                  )}
                </div>
                {uploadError && (
                  <div className="mt-3 px-3 py-2 border-2 border-red-300 bg-red-50 text-[9px] font-bold text-red-600">✕ {uploadError}</div>
                )}
                {uploadResult && <ManifestPreview result={uploadResult} />}
              </>
            )}

            {/* ── MCP 服务 tab ── */}
            {uploadTab === "mcp" && (
              <div className="space-y-4">
                {/* Step 1: 上传 zip */}
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Step 1 — 上传 MCP 服务包（.zip）
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setMcpZipDragOver(true); }}
                    onDragLeave={() => setMcpZipDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setMcpZipDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleMcpZipUpload(f); }}
                    onClick={() => mcpZipInputRef.current?.click()}
                    className={`border-2 border-dashed cursor-pointer flex flex-col items-center justify-center py-6 transition-colors ${
                      mcpZipDragOver ? "border-[#00D1FF] bg-[#CCF2FF]/30" : "border-gray-300 hover:border-[#00A3C4] hover:bg-[#F0F4F8]"
                    }`}
                  >
                    <input
                      ref={mcpZipInputRef}
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMcpZipUpload(f); e.target.value = ""; }}
                    />
                    {mcpZipUploading ? (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">解析中...</span>
                    ) : mcpZipResult ? (
                      <div className="flex items-center gap-3">
                        <span className="text-[#00CC99] font-bold text-[10px]">✓ {mcpZipResult.name}</span>
                        <span className="text-[8px] text-gray-400 border border-gray-200 px-1.5 py-0.5">{mcpZipResult.project_type}</span>
                        <span className="text-[8px] text-gray-400 font-mono">{mcpZipResult.run_cmd}</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-2xl mb-2 opacity-40">📦</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">拖入 .zip，或点击选择</span>
                        <span className="text-[8px] text-gray-300 mt-1">支持 Python / Node.js MCP 服务包</span>
                      </>
                    )}
                  </div>
                  {mcpZipError && <div className="mt-2 px-3 py-2 border-2 border-red-300 bg-red-50 text-[9px] font-bold text-red-600">✕ {mcpZipError}</div>}
                  {(mcpZipResult?.warnings ?? []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {(mcpZipResult!.warnings).map((w, i) => (
                        <div key={i} className="text-[8px] text-amber-600 border border-amber-200 bg-amber-50 px-2 py-1">⚠ {w}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 2: AI 生成配置（仅上传成功后展示） */}
                {mcpZipResult && (
                  <div>
                    <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                      Step 2 — 描述工具用途，AI 生成配置
                    </div>
                    <textarea
                      rows={3}
                      value={mcpDescription}
                      onChange={(e) => setMcpDescription(e.target.value)}
                      placeholder="用一段话描述这个工具做什么、访问哪些数据、需要什么权限……AI 会自动生成 manifest 配置"
                      className="w-full border-2 border-[#1A202C] px-3 py-2 text-[9px] resize-none focus:outline-none focus:border-[#00A3C4]"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <PixelButton
                        size="sm"
                        variant="secondary"
                        onClick={handleMcpGenerateConfig}
                        disabled={mcpGenerating || !mcpDescription.trim()}
                      >
                        {mcpGenerating ? "生成中..." : "✦ AI 生成配置"}
                      </PixelButton>
                      {mcpGenError && <span className="text-[8px] text-red-500">{mcpGenError}</span>}
                    </div>

                    {/* 生成结果预览 */}
                    {mcpGenerated && (
                      <div className="mt-3 border-2 border-[#1A202C] bg-[#F8FAFC]">
                        <div className="px-3 py-2 border-b border-gray-200 bg-[#EBF4F7] flex items-center justify-between">
                          <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">AI 生成的配置</span>
                          <button
                            onClick={() => setMcpGenerated(null)}
                            className="text-[8px] text-gray-400 hover:text-gray-700"
                          >重新生成</button>
                        </div>
                        <div className="p-3">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                            <div>
                              <span className="text-[7px] font-bold uppercase tracking-widest text-gray-400">显示名称</span>
                              <p className="text-[9px] font-bold">{String(mcpGenerated.display_name ?? "")}</p>
                            </div>
                            <div>
                              <span className="text-[7px] font-bold uppercase tracking-widest text-gray-400">触发方式</span>
                              <p className="text-[9px] font-bold">{String(mcpGenerated.invocation_mode ?? "chat")}</p>
                            </div>
                          </div>
                          {!!mcpGenerated.description && (
                            <p className="text-[8px] text-gray-500 mb-2">{String(mcpGenerated.description)}</p>
                          )}
                          <pre className="text-[8px] bg-white border border-gray-200 p-2 max-h-40 overflow-auto font-mono text-gray-600 whitespace-pre-wrap">
                            {JSON.stringify({ permissions: mcpGenerated.permissions, preconditions: mcpGenerated.preconditions, data_sources: mcpGenerated.data_sources, env_requirements: mcpGenerated.env_requirements }, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: 提交审批 */}
                {mcpZipResult && mcpGenerated && (
                  <div className="pt-2 flex items-center gap-3 border-t border-gray-100">
                    <PixelButton
                      variant="primary"
                      size="sm"
                      onClick={handleMcpSubmit}
                      disabled={mcpSubmitting}
                    >
                      {mcpSubmitting ? "提交中..." : "提交审批"}
                    </PixelButton>
                    {mcpSubmitError && <span className="text-[8px] text-red-500">{mcpSubmitError}</span>}
                    {mcpSubmitSuccess && <span className="text-[8px] text-[#00CC99] font-bold">{mcpSubmitSuccess}</span>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 bg-[#EBF4F7] border-2 border-[#1A202C] flex items-center justify-center mb-4 opacity-40">
            <ThemedIcon iconKey="tools" size={20} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {tools.length === 0 ? "暂无工具" : "无匹配结果"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <ToolCard
              key={t.id}
              tool={t}
              testing={testingId === t.id}
              onToggle={handleToggle}
              onTest={handleTest}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Test result panel */}
      {testResult && (
        <div className="fixed bottom-4 right-4 w-[420px] bg-white border-2 border-[#1A202C] shadow-lg z-50 flex flex-col max-h-[60vh]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-[#1A202C] bg-[#EBF4F7] flex-shrink-0">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
              测试结果 — {testTargetName}
            </span>
            <button
              onClick={() => setTestResult(null)}
              className="w-5 h-5 flex items-center justify-center border-2 border-[#1A202C] text-[9px] font-bold hover:bg-red-400 hover:text-white hover:border-red-400 transition-colors"
            >
              ✕
            </button>
          </div>
          <pre className="flex-1 overflow-auto text-[9px] p-4 bg-gray-50 whitespace-pre-wrap font-mono leading-relaxed">
            {testResult}
          </pre>
        </div>
      )}
    </PageShell>
  );
}

// ─── Tool Card ────────────────────────────────────────────────────────────────
interface SkillOption { id: number; name: string; }

function ToolCard({
  tool: t,
  testing,
  onToggle,
  onTest,
  onDelete,
}: {
  tool: ToolEntry;
  testing: boolean;
  onToggle: (id: number, is_active: boolean) => void;
  onTest: (tool: ToolEntry) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [bindOpen, setBindOpen] = useState(false);
  const [boundSkills, setBoundSkills] = useState<SkillOption[]>([]);
  const [allSkills, setAllSkills] = useState<SkillOption[]>([]);
  const [bindLoading, setBindLoading] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishScope, setPublishScope] = useState("department");
  const [publishing, setPublishing] = useState(false);
  const [deployInfo, setDeployInfo] = useState<Partial<ToolDeployInfo>>(() => {
    // 从 manifest 预填 permissions / preconditions
    const manifest = t.config?.manifest;
    return {
      purpose: "",
      env_requirements: "",
      permissions: manifest?.permissions ?? [],
      tested: false,
      test_note: "",
      extra_note: manifest?.preconditions?.join("\n") ?? "",
    };
  });
  const typeColor = TYPE_COLOR[t.tool_type ?? ""] ?? "gray";

  async function openBindPanel() {
    if (bindOpen) { setBindOpen(false); return; }
    setBindLoading(true);
    setBindOpen(true);
    try {
      const [bound, all] = await Promise.all([
        apiFetch<SkillOption[]>(`/tools/tool-bindings/${t.id}`),
        apiFetch<{ id: number; name: string }[]>("/skills"),
      ]);
      setBoundSkills(bound);
      setAllSkills(all);
    } catch {
      setBoundSkills([]);
      setAllSkills([]);
    } finally {
      setBindLoading(false);
    }
  }

  async function handleBind(skillId: number) {
    try {
      await apiFetch(`/tools/skill/${skillId}/tools/${t.id}`, { method: "POST" });
      setBoundSkills((prev) => {
        const skill = allSkills.find((s) => s.id === skillId);
        if (!skill || prev.some((s) => s.id === skillId)) return prev;
        return [...prev, skill];
      });
    } catch { /* ignore */ }
  }

  async function handleUnbind(skillId: number) {
    try {
      await apiFetch(`/tools/skill/${skillId}/tools/${t.id}`, { method: "DELETE" });
      setBoundSkills((prev) => prev.filter((s) => s.id !== skillId));
    } catch { /* ignore */ }
  }

  async function handlePublish() {
    if (!deployInfo.purpose?.trim()) return;
    setPublishing(true);
    try {
      await apiFetch(`/tools/${t.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published", scope: publishScope, deploy_info: deployInfo }),
      });
      setPublishOpen(false);
      onToggle(t.id, false); // 触发父组件刷新
    } catch (err) {
      alert(err instanceof Error ? err.message : "提交失败");
    } finally {
      setPublishing(false);
    }
  }

  const unboundSkills = allSkills.filter((s) => !boundSkills.some((b) => b.id === s.id));

  // Count input params
  const paramCount = t.input_schema
    ? Object.keys((t.input_schema as { properties?: Record<string, unknown> }).properties ?? {}).length
    : 0;

  return (
    <div className={`border-2 bg-white flex flex-col transition-colors ${
      t.is_active ? "border-[#1A202C]" : "border-gray-200 opacity-60"
    }`}>
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 flex-1">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-[11px] font-bold leading-tight">{t.display_name}</span>
              {t.tool_type && (
                <PixelBadge color={typeColor}>{TYPE_LABELS[t.tool_type] ?? t.tool_type}</PixelBadge>
              )}
              <PixelBadge color={t.is_active ? "green" : "gray"}>
                {t.is_active ? "启用" : "禁用"}
              </PixelBadge>
            </div>
            <p className="text-[9px] text-gray-400 font-mono">{t.name}</p>
          </div>
        </div>

        {t.description && (
          <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2 mb-2">
            {t.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          {paramCount > 0 && (
            <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
              {paramCount} 个参数
            </span>
          )}
          {t.output_format && (
            <span className="text-[8px] text-[#00A3C4] font-bold uppercase tracking-widest border border-[#00A3C4]/30 px-1.5 py-0.5">
              输出: {t.output_format}
            </span>
          )}
        </div>

        {/* Schema expand */}
        {t.input_schema && paramCount > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] transition-colors"
            >
              {expanded ? "▾ 收起参数" : "▸ 查看参数"}
            </button>
            {expanded && (
              <pre className="mt-1.5 text-[8px] bg-[#F0F4F8] border border-gray-200 p-2 max-h-32 overflow-auto font-mono text-gray-600 leading-relaxed">
                {JSON.stringify(t.input_schema, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Manifest inline */}
        {t.config?.manifest && Object.keys(t.config.manifest).length > 0 && (
          <ManifestSection manifest={t.config.manifest as ToolManifest} compact />
        )}
      </div>

      {/* Card actions */}
      <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-1.5 bg-[#FAFCFD]">
        <PixelButton size="sm" variant="secondary" onClick={() => onTest(t)} disabled={testing}>
          {testing ? "测试中..." : "▶ 测试"}
        </PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={() => onToggle(t.id, t.is_active)}>
          {t.is_active ? "禁用" : "启用"}
        </PixelButton>
        <PixelButton size="sm" variant={bindOpen ? "primary" : "secondary"} onClick={openBindPanel}>
          绑定 Skill
        </PixelButton>
        {(t.status === "draft" || !t.status) && (
          <PixelButton
            size="sm"
            variant={publishOpen ? "primary" : "secondary"}
            onClick={() => setPublishOpen((v) => !v)}
          >
            申请发布
          </PixelButton>
        )}
        {t.status === "reviewing" && (
          <span className="text-[8px] font-bold text-amber-500 uppercase tracking-widest border border-amber-300 px-1.5 py-0.5">审批中</span>
        )}
        {t.status === "published" && (
          <span className="text-[8px] font-bold text-[#00CC99] uppercase tracking-widest border border-[#00CC99] px-1.5 py-0.5">已发布</span>
        )}
        <button
          onClick={() => onDelete(t.id)}
          className="ml-auto px-2 py-0.5 border-2 border-red-200 text-red-400 text-[8px] font-bold uppercase hover:bg-red-400 hover:text-white hover:border-red-400 transition-colors"
        >
          删除
        </button>
      </div>

      {/* Bind panel */}
      {bindOpen && (
        <div className="border-t-2 border-[#1A202C] bg-[#F8FAFC] px-4 py-3">
          {bindLoading ? (
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">加载中...</div>
          ) : (
            <>
              {/* Already bound */}
              {boundSkills.length > 0 && (
                <div className="mb-3">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">已绑定</div>
                  <div className="flex flex-wrap gap-1.5">
                    {boundSkills.map((s) => (
                      <div key={s.id} className="flex items-center gap-1 border-2 border-[#00A3C4] bg-[#CCF2FF] px-2 py-0.5">
                        <span className="text-[9px] font-bold text-[#00A3C4]">{s.name}</span>
                        <button
                          onClick={() => handleUnbind(s.id)}
                          className="text-[#00A3C4] hover:text-red-500 text-[9px] font-bold leading-none ml-0.5"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add binding */}
              {unboundSkills.length > 0 ? (
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">添加绑定</div>
                  <div className="flex flex-wrap gap-1.5">
                    {unboundSkills.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleBind(s.id)}
                        className="text-[9px] font-bold border-2 border-[#1A202C] bg-white px-2 py-0.5 hover:bg-[#CCF2FF] hover:border-[#00A3C4] transition-colors"
                      >
                        + {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : boundSkills.length === 0 ? (
                <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">暂无可绑定的 Skill</div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* 发布申请表单 */}
      {publishOpen && (
        <div className="border-t-2 border-[#00CC99] bg-[#F6FFFC] px-4 py-4 space-y-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99] mb-1">申请发布 — 部署说明</div>

          {/* 发布范围 */}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-500 block mb-1">发布范围</label>
            <div className="flex gap-1">
              {SCOPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPublishScope(opt.value)}
                  className={`px-2.5 py-1 border-2 text-[8px] font-bold uppercase tracking-widest transition-colors ${
                    publishScope === opt.value
                      ? "border-[#00CC99] bg-[#00CC99] text-white"
                      : "border-[#1A202C] bg-white text-[#1A202C] hover:border-[#00CC99]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 用途说明（必填） */}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-500 block mb-1">
              用途说明 <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              value={deployInfo.purpose ?? ""}
              onChange={(e) => setDeployInfo((d) => ({ ...d, purpose: e.target.value }))}
              placeholder="这个工具解决什么问题？适用什么场景？"
              className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[9px] resize-none focus:outline-none focus:border-[#00CC99]"
            />
          </div>

          {/* 数据访问（从 manifest 预填，可编辑） */}
          {(t.config?.manifest?.data_sources?.length ?? 0) > 0 && (
            <div>
              <label className="text-[8px] font-bold uppercase tracking-widest text-gray-500 block mb-1">数据访问（来自 Manifest，可补充说明）</label>
              <div className="space-y-1">
                {t.config!.manifest!.data_sources!.map((ds) => (
                  <div key={ds.key} className="flex items-center gap-2 text-[8px] border border-gray-200 bg-white px-2 py-1">
                    <span className="font-mono text-[#00A3C4]">{ds.key}</span>
                    <span className="text-gray-400">{ds.type === "registered_table" ? "业务表" : ds.type === "uploaded_file" ? "上传文件" : "对话上下文"}</span>
                    {ds.required !== false && <span className="text-red-400 font-bold">必填</span>}
                    {ds.description && <span className="text-gray-500 ml-1">{ds.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 权限声明（从 manifest 预填，可手动编辑） */}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-500 block mb-1">
              权限声明
              <span className="ml-1 font-normal normal-case text-gray-400">每行一条，如 read:hr_employees</span>
            </label>
            <textarea
              rows={2}
              value={(deployInfo.permissions ?? []).join("\n")}
              onChange={(e) => setDeployInfo((d) => ({ ...d, permissions: e.target.value.split("\n").filter(Boolean) }))}
              placeholder="read:hr_employees&#10;write:hr_bonus"
              className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[9px] font-mono resize-none focus:outline-none focus:border-[#00CC99]"
            />
          </div>

          {/* 运行环境 */}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-500 block mb-1">运行环境 / 外部依赖</label>
            <input
              type="text"
              value={deployInfo.env_requirements ?? ""}
              onChange={(e) => setDeployInfo((d) => ({ ...d, env_requirements: e.target.value }))}
              placeholder="如：需要 HR_DB_URL 环境变量，依赖 pandas >= 2.0"
              className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[9px] focus:outline-none focus:border-[#00CC99]"
            />
          </div>

          {/* 测试确认 */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id={`tested-${t.id}`}
              checked={deployInfo.tested ?? false}
              onChange={(e) => setDeployInfo((d) => ({ ...d, tested: e.target.checked }))}
              className="mt-0.5 w-3.5 h-3.5 border-2 border-[#1A202C] accent-[#00CC99]"
            />
            <label htmlFor={`tested-${t.id}`} className="text-[8px] font-bold text-gray-600 cursor-pointer">
              已在本地测试通过，工具输出符合预期
            </label>
          </div>
          {deployInfo.tested && (
            <input
              type="text"
              value={deployInfo.test_note ?? ""}
              onChange={(e) => setDeployInfo((d) => ({ ...d, test_note: e.target.value }))}
              placeholder="测试备注（可选）：测试了哪些 case，结果如何"
              className="w-full border-2 border-gray-300 px-2 py-1.5 text-[9px] focus:outline-none focus:border-[#00CC99]"
            />
          )}

          {/* 其他说明 */}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-500 block mb-1">其他说明（可选）</label>
            <textarea
              rows={2}
              value={deployInfo.extra_note ?? ""}
              onChange={(e) => setDeployInfo((d) => ({ ...d, extra_note: e.target.value }))}
              placeholder="运行前提、注意事项、已知限制…"
              className="w-full border-2 border-[#1A202C] px-2 py-1.5 text-[9px] resize-none focus:outline-none focus:border-[#00CC99]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <PixelButton
              variant="primary"
              size="sm"
              onClick={handlePublish}
              disabled={publishing || !deployInfo.purpose?.trim()}
            >
              {publishing ? "提交中..." : "提交审批"}
            </PixelButton>
            <button
              type="button"
              onClick={() => setPublishOpen(false)}
              className="text-[8px] font-bold text-gray-400 hover:text-gray-700 uppercase tracking-widest"
            >
              取消
            </button>
            {!deployInfo.purpose?.trim() && (
              <span className="text-[8px] text-red-400 font-bold">请填写用途说明</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Manifest Section ─────────────────────────────────────────────────────────

const DS_TYPE_LABEL: Record<string, string> = {
  registered_table: "业务表",
  uploaded_file: "上传文件",
  chat_context: "对话上下文",
};

const DS_TYPE_COLOR: Record<string, string> = {
  registered_table: "border-[#00A3C4] text-[#00A3C4] bg-[#CCF2FF]/40",
  uploaded_file: "border-[#00CC99] text-[#00CC99] bg-[#CCFFF0]/40",
  chat_context: "border-purple-400 text-purple-500 bg-purple-50",
};

const MODE_LABEL: Record<string, string> = {
  chat: "对话触发",
  registered_table: "业务表模式",
  file_upload: "文件上传模式",
};

function ManifestSection({ manifest, compact = false }: { manifest: ToolManifest; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);

  const hasSources = (manifest.data_sources?.length ?? 0) > 0;
  const hasPerms = (manifest.permissions?.length ?? 0) > 0;
  const hasPrecond = (manifest.preconditions?.length ?? 0) > 0;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] hover:opacity-70 transition-opacity"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>运行契约</span>
        {manifest.invocation_mode && (
          <span className="ml-1 px-1.5 py-0.5 border border-[#00A3C4]/40 text-[#00A3C4] text-[7px] font-bold uppercase">
            {MODE_LABEL[manifest.invocation_mode] ?? manifest.invocation_mode}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-1.5 space-y-2 pl-2 border-l-2 border-[#00D1FF]/30">
          {/* Data sources */}
          {hasSources && (
            <div>
              <div className="text-[7px] font-bold uppercase tracking-widest text-gray-400 mb-1">数据来源</div>
              <div className="flex flex-col gap-1">
                {manifest.data_sources!.map((ds: ToolManifestDataSource) => (
                  <div key={ds.key} className={`flex items-start gap-2 border px-2 py-1 text-[8px] font-bold ${DS_TYPE_COLOR[ds.type] ?? "border-gray-200 text-gray-500"}`}>
                    <span className="shrink-0 uppercase tracking-wide">{DS_TYPE_LABEL[ds.type] ?? ds.type}</span>
                    <span className="font-mono text-[#1A202C]">{ds.key}</span>
                    {ds.required && <span className="ml-auto shrink-0 text-red-400 text-[7px]">必填</span>}
                    {!ds.required && <span className="ml-auto shrink-0 text-gray-300 text-[7px]">选填</span>}
                    {ds.description && <span className="text-gray-400 font-normal text-[7px] w-full">{ds.description}</span>}
                    {ds.accept && <span className="text-[7px] font-mono text-gray-400">{ds.accept.join(" ")}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Permissions */}
          {hasPerms && (
            <div>
              <div className="text-[7px] font-bold uppercase tracking-widest text-gray-400 mb-1">权限声明</div>
              <div className="flex flex-wrap gap-1">
                {manifest.permissions!.map((p: string) => (
                  <span key={p} className="px-1.5 py-0.5 border border-amber-300 bg-amber-50 text-amber-600 text-[7px] font-mono">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Preconditions */}
          {hasPrecond && (
            <div>
              <div className="text-[7px] font-bold uppercase tracking-widest text-gray-400 mb-1">运行前提</div>
              <ul className="space-y-0.5">
                {manifest.preconditions!.map((p: string, i: number) => (
                  <li key={i} className="text-[8px] text-gray-500 flex items-start gap-1">
                    <span className="text-gray-300 shrink-0">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ManifestPreview (upload result) ─────────────────────────────────────────

function ManifestPreview({ result }: { result: UploadResult }) {
  const hasManifest = result.manifest && Object.keys(result.manifest).length > 0;

  return (
    <div className="mt-3 border-2 border-[#1A202C]">
      {/* Header */}
      <div className={`px-4 py-2.5 border-b-2 border-[#1A202C] flex items-center gap-3 ${result.action === "created" ? "bg-[#CCFFF0]" : "bg-[#CCF2FF]"}`}>
        <span className="text-[9px] font-bold uppercase tracking-widest">
          {result.action === "created" ? "✓ 工具已创建" : "✓ 工具已更新"}
        </span>
        <span className="font-mono text-[9px] text-gray-600">{result.name}</span>
        <span className="ml-auto text-[8px] text-gray-400">ID: {result.id}</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Warnings */}
        {result.manifest_warnings.length > 0 && (
          <div className="border-2 border-amber-300 bg-amber-50 px-3 py-2 space-y-1">
            <div className="text-[8px] font-bold uppercase tracking-widest text-amber-600 mb-1">⚠ Manifest 警告</div>
            {result.manifest_warnings.map((w, i) => (
              <div key={i} className="text-[8px] text-amber-700">• {w}</div>
            ))}
          </div>
        )}

        {/* Manifest parsed */}
        {hasManifest ? (
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-500 mb-2">解析到的运行契约</div>
            <ManifestSection manifest={result.manifest} compact={false} />
          </div>
        ) : (
          <div className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">
            未检测到 # __le_desk_manifest__ 注释块，工具已注册但无运行契约声明
          </div>
        )}
      </div>
    </div>
  );
}
