"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { useTheme } from "@/lib/theme";

// ─── Save Modal ────────────────────────────────────────────────────────────────

type SaveMode = "tool" | "skill";

interface LatestFile {
  path: string;
  filename: string;
  content: string;
  tool: string;
  session_title: string;
}

function SaveModal({
  mode,
  onSave,
  onCancel,
}: {
  mode: SaveMode;
  onSave: (data: { name: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [latestFiles, setLatestFiles] = useState<LatestFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string>("");

  // 加载最近产出文件
  useEffect(() => {
    setLoadingFiles(true);
    apiFetch<LatestFile[]>("/dev-studio/latest-output?limit=10")
      .then((files) => {
        setLatestFiles(files);
        if (files.length > 0) {
          setSelectedFile(files[0].path);
          // 自动预填：skill 用文件内容作为 system prompt，tool 用文件名作为名称
          const f = files[0];
          const baseName = f.filename.replace(/\.[^.]+$/, "");
          setName(baseName);
          if (mode === "skill") {
            setSystemPrompt(f.content);
          } else {
            setDisplayName(baseName);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFiles(false));
  }, [mode]);

  function handleFileSelect(path: string) {
    setSelectedFile(path);
    const f = latestFiles.find((x) => x.path === path);
    if (!f) return;
    const baseName = f.filename.replace(/\.[^.]+$/, "");
    setName(baseName);
    if (mode === "skill") {
      setSystemPrompt(f.content);
    } else {
      setDisplayName(baseName);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("名称不能为空"); return; }
    if (mode === "skill" && !systemPrompt.trim()) { setError("System Prompt 不能为空"); return; }
    setSaving(true);
    setError("");
    try {
      if (mode === "tool") {
        await apiFetch("/dev-studio/save-tool", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            display_name: displayName.trim() || name.trim(),
            description: description.trim(),
            tool_type: "http",
            input_schema: {},
            output_format: "text",
            config: {},
          }),
        });
      } else {
        await apiFetch("/dev-studio/save-skill", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            system_prompt: systemPrompt.trim(),
          }),
        });
      }
      onSave({ name: name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] p-6 w-[480px] max-h-[85vh] overflow-y-auto">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#6B46C1] mb-4">
          保存为 {mode === "tool" ? "Tool" : "Skill"}
        </div>

        {/* 最近产出文件选择 */}
        <div className="mb-4 border-2 border-[#E9D8FD] bg-[#FAF5FF] p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1] mb-2">
            从最近写入文件中选择（自动预填）
          </div>
          {loadingFiles ? (
            <div className="text-[9px] text-gray-400 animate-pulse">读取中...</div>
          ) : latestFiles.length === 0 ? (
            <div className="text-[9px] text-gray-400">暂无最近写入文件，请手动填写</div>
          ) : (
            <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
              {latestFiles.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => handleFileSelect(f.path)}
                  className={`text-left px-2 py-1.5 text-[9px] font-mono border transition-colors ${
                    selectedFile === f.path
                      ? "border-[#6B46C1] bg-[#6B46C1]/10 text-[#6B46C1] font-bold"
                      : "border-gray-200 text-gray-600 hover:border-[#6B46C1]/50"
                  }`}
                >
                  <span className="font-bold">{f.filename}</span>
                  {f.session_title && (
                    <span className="text-gray-400 ml-2">· {f.session_title}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              {mode === "tool" ? "Tool 名称（英文，如 github_search）" : "Skill 名称"}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === "tool" ? "my_tool_name" : "Skill 名称"}
              className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#6B46C1]"
            />
          </div>
          {mode === "tool" && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                显示名称（中文可）
              </div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="我的工具"
                className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#6B46C1]"
              />
            </div>
          )}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              描述（可选）
            </div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这个工具 / Skill 的用途"
              className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#6B46C1]"
            />
          </div>
          {mode === "skill" && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                System Prompt
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                placeholder="粘贴由 AI 生成的 System Prompt 内容..."
                className="w-full border-2 border-[#1A202C] px-3 py-2 text-[10px] font-mono resize-y focus:outline-none focus:border-[#6B46C1]"
              />
            </div>
          )}
          {error && (
            <div className="text-[9px] text-red-500 font-bold border border-red-200 bg-red-50 px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <PixelButton type="submit" disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </PixelButton>
            <PixelButton variant="secondary" onClick={onCancel} type="button">
              取消
            </PixelButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Requirements Banner ──────────────────────────────────────────────────────

interface ProjectHandoff {
  project_type: string;
  name: string;
  handoff: {
    handoff_status: string;
    requirements: string | null;
    acceptance_criteria: string | null;
    handoff_at: string | null;
  };
}

function RequirementsBanner({ workspaceId }: { workspaceId: number }) {
  const [data, setData] = useState<ProjectHandoff | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    apiFetch<ProjectHandoff | null>(`/projects/by-workspace/${workspaceId}`)
      .then((d) => {
        if (d && d.project_type === "dev" && d.handoff?.handoff_status === "submitted") {
          setData(d);
        }
      })
      .catch(() => {});
  }, [workspaceId]);

  if (!data || !data.handoff.requirements) return null;

  return (
    <div className="flex-shrink-0 border-b-2 border-[#6B46C1] bg-[#6B46C1]/5">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#6B46C1]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">
            需求上下文 · {data.name}
          </span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 border border-[#D97706] text-[#D97706]">
            已交接
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[9px] text-[#6B46C1] font-bold hover:text-[#553C9A] transition-colors"
        >
          {collapsed ? "▸ 展开" : "▾ 收起"}
        </button>
      </div>
      {!collapsed && (
        <div className="px-4 pb-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-[#6B46C1] mb-1">功能需求</div>
            <pre className="text-[9px] text-gray-700 whitespace-pre-wrap leading-relaxed font-sans bg-white border border-[#E9D8FD] px-3 py-2">
              {data.handoff.requirements}
            </pre>
          </div>
          {data.handoff.acceptance_criteria && (
            <div>
              <div className="text-[8px] font-bold uppercase tracking-widest text-[#00CC99] mb-1">验收标准</div>
              <pre className="text-[9px] text-gray-700 whitespace-pre-wrap leading-relaxed font-sans bg-white border border-[#C6F6D5] px-3 py-2">
                {data.handoff.acceptance_criteria}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dev Studio ───────────────────────────────────────────────────────────────

// 受限模型 key 常量
const RESTRICTED_MODELS = ["lemondata/gpt-5.4"];

type Status = "loading" | "ready" | "error";

export function DevStudio({ convId: _convId, workspaceId }: { convId: number; workspaceId?: number }) {
  const { theme } = useTheme();
  const [status, setStatus] = useState<Status>("loading");
  const [opencodeUrl, setOpencodeUrl] = useState<string | null>(null);
  const [instanceKey, setInstanceKey] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<SaveMode | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [grantedModels, setGrantedModels] = useState<string[]>([]);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 拉取当前用户的受限模型授权
  useEffect(() => {
    apiFetch<{ model_keys: string[] }>("/auth/model-grants")
      .then((data) => setGrantedModels(data.model_keys))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setStatus("loading");
      setErrorMsg(null);
      try {
        await apiFetch<{ url: string; port: number }>("/dev-studio/instance");
        if (!cancelled) {
          // 通过 Next.js proxy 访问 opencode，兼容内网穿透场景（HTML 路径重写）
          setOpencodeUrl("/api/opencode");
          setInstanceKey(Date.now());
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "连接失败");
          setStatus("error");
        }
      }
    }

    connect();
    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  function handleRetry() {
    setStatus("loading");
    setErrorMsg(null);
    apiFetch<{ url: string; port: number }>("/dev-studio/instance")
      .then(() => {
        setOpencodeUrl("/api/opencode");
        setInstanceKey(Date.now());
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "连接失败");
        setStatus("error");
      });
  }

  function handleSaveSuccess(data: { name: string }) {
    setSaveMode(null);
    setSaveSuccess(`已保存：${data.name}`);
    setTimeout(() => setSaveSuccess(null), 6000);
  }

  const statusBadge = {
    loading: { color: "yellow" as const, label: "连接中..." },
    ready:   { color: "green" as const,  label: "运行中" },
    error:   { color: "red" as const,    label: "错误" },
  }[status];

  return (
    <div className="h-full flex flex-col bg-[#F0F4F8]">
      {/* Requirements Banner (dev project context) */}
      {workspaceId && <RequirementsBanner workspaceId={workspaceId} />}

      {/* Header */}
      <div className="flex-shrink-0 border-b-2 border-[#1A202C] bg-white px-4 h-11 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#6B46C1]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">
            工具开发 Studio
          </span>
          <PixelBadge color={statusBadge.color}>{statusBadge.label}</PixelBadge>
          {status === "ready" && (
            <span className="text-[9px] text-gray-400 font-mono">百炼 Coding Plan</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "ready" && opencodeUrl && (
            <a
              href={opencodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8] transition-colors"
            >
              ↗ 独立窗口
            </a>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-hidden relative">
        {status === "loading" && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-2 border-[#6B46C1] bg-[#6B46C1]/10 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-[#6B46C1] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B46C1] animate-pulse">
              正在连接 OpenCode...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-10 h-10 border-2 border-red-300 bg-red-50 flex items-center justify-center flex-shrink-0">
              <span className="text-red-400 font-bold text-sm">!</span>
            </div>
            <div className="text-center max-w-sm">
              <p className="text-[11px] font-bold text-red-500 mb-2">工作台服务未启动</p>
              <p className="text-[10px] text-gray-500 leading-relaxed mb-3">
                OpenCode 服务无法连接。请联系管理员检查后端服务是否正常运行。
              </p>
              {errorMsg && (
                <p className="text-[9px] text-gray-400 font-mono bg-gray-100 border border-gray-200 px-3 py-1.5 mb-4 text-left break-all">
                  {errorMsg}
                </p>
              )}
              <button
                onClick={handleRetry}
                className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest border-2 border-[#6B46C1] text-[#6B46C1] hover:bg-[#6B46C1]/10 transition-colors"
              >
                重试连接
              </button>
            </div>
          </div>
        )}

        {status === "ready" && opencodeUrl && (
          <>
            <iframe
              src={`${opencodeUrl}?t=${instanceKey}`}
              className="w-full h-full border-none"
              title="OpenCode Dev Studio"
              allow="clipboard-read; clipboard-write"
            />
            {/* 受限模型遮罩：无权用户看到提示，有权用户不显示 */}
            {RESTRICTED_MODELS.some((k) => !grantedModels.includes(k)) && (
              <div className="absolute bottom-0 right-0 m-3 z-10 bg-white border-2 border-[#1A202C] px-4 py-3 max-w-xs shadow-lg">
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#D97706] mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#D97706] inline-block" />
                  受限模型
                </div>
                <p className="text-[9px] text-gray-500 leading-relaxed">
                  <span className="font-bold text-[#1A202C]">GPT-5.4</span> 需要管理员授权后才可使用。请联系超级管理员开通权限。
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Save success */}
      {saveSuccess && (
        <div className="flex-shrink-0 bg-green-50 border-t-2 border-[#00CC99] px-4 py-2 flex items-center justify-between">
          <span className="text-[9px] text-[#00A87A] font-bold">✓ {saveSuccess}</span>
          <a
            href="/skills"
            className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] border border-[#00D1FF] px-2 py-0.5 hover:bg-[#CCF2FF] transition-colors"
          >
            前往 Skills & Tools 查看 →
          </a>
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 border-t-2 border-[#1A202C] bg-white px-4 py-2.5 flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mr-2">
          保存产出 →
        </span>
        <button
          onClick={() => setSaveMode("tool")}
          disabled={status !== "ready"}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#00D1FF] text-[#00A3C4] hover:bg-[#CCF2FF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          保存为 Tool
        </button>
        <button
          onClick={() => setSaveMode("skill")}
          disabled={status !== "ready"}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#00CC99] text-[#00A87A] hover:bg-[#C6F6D5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          保存为 Skill
        </button>
      </div>

      {saveMode && (
        <SaveModal
          mode={saveMode}
          onSave={handleSaveSuccess}
          onCancel={() => setSaveMode(null)}
        />
      )}
    </div>
  );
}
