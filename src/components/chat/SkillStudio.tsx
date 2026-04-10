"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, File, FileCode, Upload, Trash2, Zap, BookOpen, FileText, Lightbulb, Terminal, Layout, Plus, Download, Package, X, Search, ExternalLink } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch, getToken, dispatchAuthExpired } from "@/lib/api";
import type { SkillDetail, SkillVersion, BoundTool, SkillMemo } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { ICONS, PixelIcon } from "@/components/pixel";
import { ImportSkillModal } from "@/components/skill/ImportSkillModal";
import { CommentsPanel, type Suggestion } from "@/components/skill/CommentsPanel";
import { SkillMemoPanel } from "@/components/skill/SkillMemoPanel";
import { SandboxTestModal } from "@/components/skill/SandboxTestModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  loading?: boolean;
}

interface StudioDraft {
  name?: string;
  description?: string;
  system_prompt: string;
  change_note?: string;
}

interface DiffOp {
  type: "replace" | "insert_after" | "insert_before" | "delete" | "append";
  old?: string;
  new?: string;
  anchor?: string;
  content?: string;
}

interface StudioDiff {
  system_prompt?: { old: string; new: string };  // 向后兼容
  ops?: DiffOp[];
  change_note?: string;
  [key: string]: unknown;
}

interface StudioSummary {
  title?: string;
  items: { label: string; value: string }[];
  next_action?: "generate_draft" | "generate_outline" | "generate_section";
}

interface ToolSuggestionItem {
  name: string;
  reason: string;
  action: "bind_existing" | "create_new";
  tool_id: number | null;
}

interface StudioToolSuggestion {
  suggestions: ToolSuggestionItem[];
}

interface StudioFileSplit {
  files: {
    filename: string;
    category: FileCategory;
    content: string;
    reason: string;
  }[];
  main_prompt_after_split: string;
  change_note?: string;
}

// Which file is currently selected in the editor
type SelectedFile =
  | { skillId: number; fileType: "prompt" }
  | { skillId: number; fileType: "asset"; filename: string };

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".py", ".js", ".ts", ".json", ".yaml", ".yml", ".sh", ".toml", ".xml", ".csv"]);

function isTextFile(filename: string) {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

// ─── 文件角色分类 ───────────────────────────────────────────────────────────────

type FileCategory = "knowledge-base" | "reference" | "example" | "tool" | "template" | "other";

const CATEGORY_CONFIG: Record<FileCategory, { icon: typeof File; label: string; hint: string }> = {
  "knowledge-base": { icon: BookOpen, label: "知识库", hint: "知识库文件 — AI 推理时作为领域知识注入" },
  "reference":      { icon: FileText, label: "参考资料", hint: "参考资料 — 方法论、API 文档" },
  "example":        { icon: Lightbulb, label: "示例", hint: "示例文件 — 提供输入输出样本" },
  "tool":           { icon: Terminal, label: "工具", hint: "工具脚本 — 可执行辅助脚本" },
  "template":       { icon: Layout, label: "模板", hint: "模板文件 — 输出格式模板" },
  "other":          { icon: File, label: "其他", hint: "" },
};

const CATEGORY_ORDER: FileCategory[] = ["knowledge-base", "reference", "example", "tool", "template", "other"];

function inferCategory(filename: string): FileCategory {
  const lower = filename.toLowerCase();
  const base = lower.split("/").pop() || lower;
  if (base.endsWith(".js") || base.endsWith(".py") || base.endsWith(".sh") || base.endsWith(".ts")) return "tool";
  if (base.includes("template") || base.startsWith("_")) return "template";
  if (base.startsWith("example") || base.includes("example")) return "example";
  if (base.includes("-kb.") || base.includes("knowledge")) return "knowledge-base";
  if (base.includes("reference") || base.endsWith(".dot") || base.endsWith(".xml")) return "reference";
  return "other";
}

function getFileCategory(file: { filename: string; category?: string }): FileCategory {
  if (file.category && file.category in CATEGORY_CONFIG) return file.category as FileCategory;
  return inferCategory(file.filename);
}

const NEW_FILE_TEMPLATES: Partial<Record<FileCategory, string>> = {
  "knowledge-base": "# 知识库\n\n> AI 推理时参考此内容。\n\n",
  "example":        "# 示例\n\n## 输入\n\n## 期望输出\n",
  "reference":      "# 参考资料\n\n",
  "template":       "# 输出模板\n\n",
};

const NEW_FILE_PREFIX: Partial<Record<FileCategory, string>> = {
  "knowledge-base": "-kb",
  "example":        "example-",
  "reference":      "reference-",
  "template":       "template-",
};

// ─── applyOps: 精准局部编辑 ─────────────────────────────────────────────────────

function applyOps(text: string, ops: DiffOp[]): string {
  // 倒序应用 ops，避免前面的 op 改变后面 op 的偏移量
  const reversed = [...ops].reverse();
  let result = text;
  for (const op of reversed) {
    switch (op.type) {
      case "replace": {
        if (!op.old) break;
        const idx = result.indexOf(op.old);
        if (idx === -1) break; // 找不到则跳过
        result = result.slice(0, idx) + (op.new ?? "") + result.slice(idx + op.old.length);
        break;
      }
      case "insert_after": {
        if (!op.anchor || !op.content) break;
        const idx = result.indexOf(op.anchor);
        if (idx === -1) break;
        const insertPos = idx + op.anchor.length;
        result = result.slice(0, insertPos) + "\n" + op.content + result.slice(insertPos);
        break;
      }
      case "insert_before": {
        if (!op.anchor || !op.content) break;
        const idx = result.indexOf(op.anchor);
        if (idx === -1) break;
        result = result.slice(0, idx) + op.content + "\n" + result.slice(idx);
        break;
      }
      case "delete": {
        if (!op.old) break;
        const idx = result.indexOf(op.old);
        if (idx === -1) break;
        result = result.slice(0, idx) + result.slice(idx + op.old.length);
        break;
      }
      case "append": {
        if (!op.content) break;
        result = result.trimEnd() + "\n\n" + op.content;
        break;
      }
    }
  }
  return result;
}

// ─── Status badge ──────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { color: "cyan" | "green" | "yellow" | "gray" | "red"; label: string }> = {
  draft: { color: "gray", label: "草稿" },
  reviewing: { color: "yellow", label: "审核中" },
  published: { color: "green", label: "已发布" },
  archived: { color: "red", label: "已归档" },
};

function SkillIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.skills} size={size} />;
  return <Zap size={size} className="text-muted-foreground" />;
}

// ─── Tool binding popup ──────────────────────────────────────────────────────

function ToolBindPopup({
  skillId,
  existingIds,
  onBound,
  onClose,
}: {
  skillId: number;
  existingIds: Set<number>;
  onBound: (tool: BoundTool) => void;
  onClose: () => void;
}) {
  const [tools, setTools] = useState<BoundTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [binding, setBinding] = useState<number | null>(null);

  useEffect(() => {
    apiFetch<BoundTool[]>("/tools?status=published")
      .then((data) => setTools(Array.isArray(data) ? data : []))
      .catch(() => setTools([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tools.filter(
    (t) => !existingIds.has(t.id) && (!search || t.name.includes(search) || (t.display_name || "").includes(search) || (t.description || "").includes(search))
  );

  async function handleBind(tool: BoundTool) {
    setBinding(tool.id);
    try {
      await apiFetch(`/tools/skill/${skillId}/tools/${tool.id}`, { method: "POST" });
      onBound(tool);
    } catch (err) {
      console.error("Bind failed", err);
    } finally { setBinding(null); }
  }

  return (
    <div className="pl-7 pr-3 py-2 bg-[#F0F4F8] border-t border-gray-200 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-[8px] font-bold uppercase tracking-widest text-[#6B46C1]">选择工具</span>
        <button onClick={onClose} className="ml-auto text-gray-400 hover:text-gray-600"><X size={9} /></button>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索工具..."
        className="w-full text-[9px] font-mono px-1.5 py-1 border border-gray-300 bg-white outline-none focus:border-[#6B46C1]"
        autoFocus
      />
      <div className="max-h-32 overflow-y-auto space-y-0.5">
        {loading ? (
          <div className="text-[8px] text-gray-400 py-1">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-[8px] text-gray-400 py-1">无可用工具</div>
        ) : (
          filtered.map((t) => (
            <div key={t.id} className="flex items-center gap-1.5 py-0.5">
              <Package size={8} className="text-[#6B46C1] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-mono truncate block">{t.display_name || t.name}</span>
                {t.description && <span className="text-[8px] text-gray-400 truncate block">{t.description}</span>}
              </div>
              <span className="text-[7px] px-1 py-0.5 bg-[#6B46C1]/10 text-[#6B46C1] font-bold flex-shrink-0">{t.tool_type}</span>
              <button
                onClick={() => handleBind(t)}
                disabled={binding === t.id}
                className="text-[8px] font-bold px-1.5 py-0.5 bg-[#6B46C1] text-white disabled:opacity-50 flex-shrink-0"
              >
                {binding === t.id ? "..." : "绑定"}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Left panel ───────────────────────────────────────────────────────────────

function SkillList({
  skills,
  loading,
  selectedFile,
  refreshCounter,
  onSelectFile,
  onNew,
  onImport,
  onRefreshSkill,
  onAdoptSuggestion,
}: {
  skills: SkillDetail[];
  loading: boolean;
  selectedFile: SelectedFile | null;
  refreshCounter?: number;
  onSelectFile: (f: SelectedFile) => void;
  onNew: () => void;
  onImport: () => void;
  onRefreshSkill: (skillId: number) => void;
  onAdoptSuggestion?: (skillName: string, suggestion: Suggestion) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const [suggestionPopupSkillId, setSuggestionPopupSkillId] = useState<number | null>(null);

  const drafts = skills.filter((s) => s.status === "draft" || s.status === "reviewing");
  const published = skills.filter((s) => s.status === "published" || s.status === "archived");

  function toggleExpand(skillId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }

  async function handleUpload(skillId: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const token = getToken();
    const resp = await fetch(`/api/proxy/skills/${skillId}/files`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (resp.ok) {
      onRefreshSkill(skillId);
    }
  }

  async function handleDelete(skillId: number, filename: string, e: React.MouseEvent) {
    e.stopPropagation();
    await apiFetch(`/skills/${skillId}/files/${encodeURIComponent(filename)}`, { method: "DELETE" });
    onRefreshSkill(skillId);
  }

  function SkillFolder({ skill }: { skill: SkillDetail }) {
    const isOpen = expanded.has(skill.id);
    const selectedSkillId = selectedFile?.skillId ?? null;
    const isThisSkillSelected = selectedSkillId === skill.id;
    const badge = STATUS_BADGE[skill.status] ?? STATUS_BADGE.draft;
    const assetFiles = skill.source_files ?? [];
    const isReadOnly = skill.status === "published" || skill.status === "archived";

    // 新建文件状态
    const [showNewFile, setShowNewFile] = useState(false);
    const [newFileCategory, setNewFileCategory] = useState<FileCategory>("knowledge-base");
    const [newFileName, setNewFileName] = useState("");
    const [creating, setCreating] = useState(false);

    // 已绑定工具
    const [boundTools, setBoundTools] = useState<BoundTool[]>([]);
    const [showToolBind, setShowToolBind] = useState(false);
    const toolUploadRef = useRef<HTMLInputElement>(null);
    const [uploadingTool, setUploadingTool] = useState(false);

    useEffect(() => {
      if (!isOpen) return;
      apiFetch<BoundTool[]>(`/skills/${skill.id}/bound-tools`)
        .then((data) => setBoundTools(Array.isArray(data) ? data : []))
        .catch(() => setBoundTools([]));
    }, [isOpen, skill.id, refreshCounter]);

    async function handleUnbind(toolId: number, e: React.MouseEvent) {
      e.stopPropagation();
      await apiFetch(`/tools/skill/${skill.id}/tools/${toolId}`, { method: "DELETE" });
      setBoundTools((prev) => prev.filter((t) => t.id !== toolId));
    }

    async function handleToolUpload(file: File) {
      setUploadingTool(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const token = getToken();
        const resp = await fetch(`/api/proxy/skills/${skill.id}/upload-tool`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (resp.ok) {
          const result = await resp.json();
          if (result.tool_id) {
            setBoundTools((prev) => [...prev, { id: result.tool_id, name: result.tool_name || "tool", display_name: result.tool_name || "tool", tool_type: "BUILTIN", description: "", status: "draft" }]);
          }
          onRefreshSkill(skill.id);
        }
      } catch (err) { console.error("Tool upload failed", err); }
      finally { setUploadingTool(false); }
    }

    // 按 category 分组
    const grouped = CATEGORY_ORDER.reduce<Record<FileCategory, typeof assetFiles>>((acc, cat) => {
      acc[cat] = assetFiles.filter((f) => getFileCategory(f) === cat);
      return acc;
    }, {} as Record<FileCategory, typeof assetFiles>);

    async function handleCreateFile() {
      if (!newFileName.trim()) return;
      const fname = newFileName.endsWith(".md") ? newFileName : newFileName + ".md";
      setCreating(true);
      try {
        await apiFetch(`/skills/${skill.id}/files/${encodeURIComponent(fname)}`, {
          method: "PUT",
          body: JSON.stringify({ content: NEW_FILE_TEMPLATES[newFileCategory] || "" }),
        });
        onRefreshSkill(skill.id);
        setShowNewFile(false);
        setNewFileName("");
        onSelectFile({ skillId: skill.id, fileType: "asset", filename: fname });
      } catch (err) {
        console.error("Create file failed", err);
      } finally { setCreating(false); }
    }

    function renderFileItem(f: { filename: string; path: string; size: number; category?: string }) {
      const cat = getFileCategory(f);
      const cfg = CATEGORY_CONFIG[cat];
      const Icon = cfg.icon;
      const isSelected =
        isThisSkillSelected &&
        selectedFile?.fileType === "asset" &&
        (selectedFile as { filename: string }).filename === f.filename;
      return (
        <div
          key={f.filename}
          className={`w-full flex items-center gap-1.5 pl-9 pr-2 py-1 transition-colors group ${
            isSelected ? "bg-[#CCF2FF]" : "hover:bg-[#F0F4F8]"
          }`}
        >
          <button
            className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
            onClick={() => onSelectFile({ skillId: skill.id, fileType: "asset", filename: f.filename })}
          >
            <Icon size={9} className={`flex-shrink-0 ${isSelected ? "text-[#00A3C4]" : "text-gray-400"}`} />
            <span className={`text-[9px] font-mono truncate ${isSelected ? "text-[#00A3C4]" : "text-gray-600"}`}>
              {f.filename}
            </span>
            <span className="text-[8px] text-gray-400 flex-shrink-0 ml-auto">
              {f.size > 1024 ? `${(f.size / 1024).toFixed(1)}k` : `${f.size}b`}
            </span>
          </button>
          {!isReadOnly && (
            <button
              onClick={(e) => handleDelete(skill.id, f.filename, e)}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity flex-shrink-0"
            >
              <Trash2 size={9} />
            </button>
          )}
        </div>
      );
    }

    return (
      <div>
        {/* Folder row */}
        <button
          onClick={() => {
            toggleExpand(skill.id);
            onSelectFile({ skillId: skill.id, fileType: "prompt" });
          }}
          className={`w-full text-left px-2 py-2 border-b border-gray-100 transition-colors flex items-center gap-1.5 ${
            isThisSkillSelected && selectedFile?.fileType === "prompt"
              ? "bg-[#CCF2FF]"
              : "hover:bg-[#F0F4F8]"
          }`}
        >
          <span className="text-gray-400 flex-shrink-0">
            {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
          <SkillIcon size={10} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className={`text-[10px] font-bold truncate ${isThisSkillSelected ? "text-[#00A3C4]" : ""}`}>
                {skill.name}
              </span>
              <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSuggestionPopupSkillId(suggestionPopupSkillId === skill.id ? null : skill.id);
            }}
            className="flex-shrink-0 text-[7px] font-bold text-[#805AD5] border border-[#805AD5] px-1 py-0.5 hover:bg-[#FAF5FF] transition-colors"
            title="查看用户意见"
          >
            意见
          </button>
        </button>

        {/* Suggestion popup */}
        {suggestionPopupSkillId === skill.id && (
          <div className="bg-[#FAF5FF] border-b-2 border-[#805AD5] p-2 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] font-bold uppercase text-[#805AD5]">用户意见</span>
              <button
                onClick={() => setSuggestionPopupSkillId(null)}
                className="text-[8px] text-gray-400 hover:text-gray-600"
              >
                <X size={10} />
              </button>
            </div>
            <CommentsPanel
              skillId={skill.id}
              onIterateDone={() => onRefreshSkill(skill.id)}
              hideIterate
              statusFilter="pending"
              onAdopt={(s) => {
                if (onAdoptSuggestion) {
                  onAdoptSuggestion(skill.name, s);
                  setSuggestionPopupSkillId(null);
                  return true;
                }
              }}
            />
          </div>
        )}

        {/* Expanded file list */}
        {isOpen && (
          <div className="bg-white border-b border-gray-100">
            {/* SKILL.md (system prompt) */}
            <button
              onClick={() => onSelectFile({ skillId: skill.id, fileType: "prompt" })}
              className={`w-full text-left pl-7 pr-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                isThisSkillSelected && selectedFile?.fileType === "prompt"
                  ? "bg-[#CCF2FF] text-[#00A3C4]"
                  : "hover:bg-[#F0F4F8] text-gray-600"
              }`}
            >
              <File size={9} className="flex-shrink-0" />
              <span className="text-[9px] font-mono">SKILL.md</span>
            </button>

            {/* Asset files grouped by category */}
            {CATEGORY_ORDER.map((cat) => {
              const files = grouped[cat];
              if (!files || files.length === 0) return null;
              const cfg = CATEGORY_CONFIG[cat];
              const CatIcon = cfg.icon;
              return (
                <div key={cat}>
                  <div className="pl-7 pr-3 py-1 flex items-center gap-1">
                    <CatIcon size={8} className="text-gray-400" />
                    <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">{cfg.label}</span>
                  </div>
                  {files.map(renderFileItem)}
                </div>
              );
            })}

            {/* Bound tools (from ToolRegistry) */}
            {boundTools.length > 0 && (
              <div>
                <div className="pl-7 pr-3 py-1 flex items-center gap-1">
                  <Package size={8} className="text-gray-400" />
                  <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">已绑定工具</span>
                </div>
                {boundTools.map((t) => (
                  <div key={t.id} className="w-full flex items-center gap-1.5 pl-9 pr-2 py-1 group hover:bg-[#F0F4F8]">
                    <Package size={9} className="text-[#6B46C1] flex-shrink-0" />
                    <span className="text-[9px] font-mono truncate text-gray-600 flex-1 min-w-0">{t.display_name || t.name}</span>
                    <span className="text-[7px] px-1 py-0.5 bg-[#6B46C1]/10 text-[#6B46C1] font-bold flex-shrink-0">{t.tool_type}</span>
                    {!isReadOnly && (
                      <button
                        onClick={(e) => handleUnbind(t.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity flex-shrink-0"
                        title="解绑"
                      >
                        <X size={9} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tool actions: upload script / bind existing */}
            {!isReadOnly && (
              <div className="pl-7 pr-3 py-1 flex items-center gap-2">
                <button
                  onClick={() => toolUploadRef.current?.click()}
                  disabled={uploadingTool}
                  className="flex items-center gap-1 text-[7px] font-bold uppercase tracking-widest text-[#6B46C1]/60 hover:text-[#6B46C1] transition-colors"
                >
                  <Upload size={7} />
                  {uploadingTool ? "上传中..." : "上传脚本"}
                </button>
                <button
                  onClick={() => setShowToolBind(true)}
                  className="flex items-center gap-1 text-[7px] font-bold uppercase tracking-widest text-[#6B46C1]/60 hover:text-[#6B46C1] transition-colors"
                >
                  <Search size={7} />
                  绑定已有
                </button>
                <input
                  ref={toolUploadRef}
                  type="file"
                  accept=".py"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleToolUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {/* Tool binding popup */}
            {showToolBind && (
              <ToolBindPopup
                skillId={skill.id}
                existingIds={new Set(boundTools.map((t) => t.id))}
                onBound={(tool) => {
                  setBoundTools((prev) => [...prev, tool]);
                  setShowToolBind(false);
                }}
                onClose={() => setShowToolBind(false)}
              />
            )}

            {/* New file + Upload buttons */}
            {!isReadOnly && (
              <div className="pl-7 pr-3 py-1.5 flex items-center gap-3 border-t border-gray-100">
                <button
                  onClick={() => { setShowNewFile((v) => !v); setNewFileName(""); }}
                  className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] transition-colors"
                >
                  <Plus size={8} />
                  新建文件
                </button>
                <button
                  onClick={() => {
                    setUploadingFor(skill.id);
                    uploadInputRef.current?.click();
                  }}
                  className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] transition-colors"
                >
                  <Upload size={8} />
                  上传
                </button>
              </div>
            )}

            {/* Inline new file form */}
            {showNewFile && !isReadOnly && (
              <div className="pl-7 pr-3 py-2 bg-[#F0F4F8] border-t border-gray-200 space-y-1.5">
                <div className="flex gap-1 flex-wrap">
                  {(["knowledge-base", "example", "reference", "template"] as FileCategory[]).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setNewFileCategory(cat);
                        const prefix = NEW_FILE_PREFIX[cat] || "";
                        setNewFileName(prefix);
                      }}
                      className={`text-[8px] px-1.5 py-0.5 border transition-colors ${
                        newFileCategory === cat
                          ? "border-[#00A3C4] bg-[#CCF2FF] text-[#00A3C4] font-bold"
                          : "border-gray-300 text-gray-500 hover:border-[#00A3C4]"
                      }`}
                    >
                      {CATEGORY_CONFIG[cat].label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    placeholder="文件名.md"
                    className="flex-1 text-[9px] font-mono px-1.5 py-1 border border-gray-300 bg-white outline-none focus:border-[#00A3C4] min-w-0"
                    onKeyDown={(e) => { if (e.key === "Enter") handleCreateFile(); }}
                  />
                  <button
                    onClick={handleCreateFile}
                    disabled={creating || !newFileName.trim()}
                    className="text-[8px] font-bold px-2 py-1 bg-[#00A3C4] text-white disabled:opacity-50"
                  >
                    {creating ? "..." : "创建"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-r-2 border-[#1A202C] bg-[#EBF4F7] w-52 flex-shrink-0">
      <div className="px-3 py-2.5 border-b-2 border-[#1A202C] flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">Skills</span>
        <div className="flex items-center gap-1">
          <PixelButton size="sm" variant="secondary" onClick={onImport}>导入</PixelButton>
          <PixelButton size="sm" onClick={onNew}>+ 新建</PixelButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">加载中...</div>
        ) : (
          <>
            {drafts.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest text-gray-400 bg-[#F0F4F8] border-b border-gray-200">
                  草稿 / 审核中 ({drafts.length})
                </div>
                {drafts.map((s) => <SkillFolder key={s.id} skill={s} />)}
              </div>
            )}
            {published.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest text-gray-400 bg-[#F0F4F8] border-b border-gray-200">
                  已发布 ({published.length})
                </div>
                {published.map((s) => <SkillFolder key={s.id} skill={s} />)}
              </div>
            )}
            {drafts.length === 0 && published.length === 0 && (
              <div className="p-4 text-center text-[9px] text-gray-400">暂无 Skill，点击新建</div>
            )}
          </>
        )}
      </div>
      {/* Hidden file input for upload */}
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file && uploadingFor !== null) {
            await handleUpload(uploadingFor, file);
          }
          e.target.value = "";
          setUploadingFor(null);
        }}
      />
    </div>
  );
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

function diffLines(oldText: string, newText: string) {
  const a = oldText ? oldText.split("\n") : [];
  const b = newText ? newText.split("\n") : [];
  const m = a.length, n = b.length;

  if (m * n > 40000) {
    return [
      ...a.map((text) => ({ type: "removed" as const, text })),
      ...b.map((text) => ({ type: "added" as const, text })),
    ];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const result: { type: "added" | "removed" | "unchanged"; text: string }[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) { result.push({ type: "unchanged", text: a[i] }); i++; j++; }
    else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) { result.push({ type: "added", text: b[j] }); j++; }
    else { result.push({ type: "removed", text: a[i] }); i++; }
  }
  return result;
}

function LineNumberedEditor({ value, onChange, disabled, placeholder }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = (value.match(/\n/g) ?? []).length + 1;
  const LINE_H = 20;

  return (
    <div className="flex flex-1 overflow-hidden border-2 border-[#1A202C] focus-within:border-[#00D1FF] min-h-0">
      <div
        ref={gutterRef}
        className="overflow-hidden bg-gray-50 border-r border-gray-200 select-none flex-shrink-0 w-9"
        style={{ overflowY: "hidden" }}
      >
        <div className="pt-[9px] pb-2">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{ lineHeight: `${LINE_H}px`, height: LINE_H }} className="text-right pr-2 text-[9px] font-mono text-gray-400">
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={() => {
          if (gutterRef.current && textareaRef.current)
            gutterRef.current.scrollTop = textareaRef.current.scrollTop;
        }}
        disabled={disabled}
        placeholder={placeholder}
        wrap="off"
        spellCheck={false}
        className="flex-1 px-3 py-2 text-[10px] font-mono resize-none focus:outline-none disabled:opacity-50 disabled:bg-gray-50 overflow-auto"
        style={{ lineHeight: `${LINE_H}px` }}
      />
    </div>
  );
}

function DiffViewer({ oldText, newText }: { oldText: string; newText: string }) {
  const diff = diffLines(oldText, newText);
  let newNum = 0;
  const LINE_H = 20;

  return (
    <div className="flex-1 overflow-auto border-2 border-[#1A202C] bg-white font-mono text-[10px] min-h-0">
      {diff.map((line, i) => {
        let bgClass = "", textClass = "text-[#1A202C]", indClass = "text-gray-200", ind = " ", lineNum = "";
        if (line.type === "unchanged") {
          newNum++;
          lineNum = String(newNum);
        } else if (line.type === "added") {
          newNum++;
          bgClass = "bg-green-50"; textClass = "text-green-900"; indClass = "text-green-600 font-bold"; ind = "+"; lineNum = String(newNum);
        } else {
          bgClass = "bg-red-50"; textClass = "text-red-700"; indClass = "text-red-500 font-bold"; ind = "−"; lineNum = "";
        }
        return (
          <div key={i} className={`flex ${bgClass}`} style={{ lineHeight: `${LINE_H}px`, minHeight: LINE_H }}>
            <div className="w-8 text-right pr-1.5 text-gray-400 select-none flex-shrink-0 border-r border-gray-200 text-[9px]">
              {lineNum}
            </div>
            <div className={`w-5 text-center select-none flex-shrink-0 ${indClass}`}>{ind}</div>
            <div className={`flex-1 px-2 whitespace-pre overflow-hidden ${textClass}`}>
              {line.text || "\u00A0"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Asset file editor ────────────────────────────────────────────────────────

function AssetFileEditor({
  skill,
  filename,
  onDeleted,
  onFileSaved,
}: {
  skill: SkillDetail;
  filename: string;
  onDeleted: () => void;
  onFileSaved?: (filename: string, contentSize: number) => void;
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [diffBase, setDiffBase] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const isReadOnly = skill.status === "published" || skill.status === "archived";
  const isText = isTextFile(filename);
  const hasDiff = diffBase !== null && diffBase !== content;

  useEffect(() => {
    setLoading(true);
    setMsg(null);
    setDiffBase(null);
    setShowDiff(false);
    if (!isText) { setLoading(false); return; }
    apiFetch<{ content: string }>(`/skills/${skill.id}/files/${encodeURIComponent(filename)}`)
      .then((d) => { setContent(d.content); setDiffBase(d.content); })
      .catch(() => setMsg("加载失败"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill.id, filename]);

  async function handleSave() {
    setSaving(true); setMsg(null);
    try {
      await apiFetch(`/skills/${skill.id}/files/${encodeURIComponent(filename)}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      setMsg("✓ 已保存");
      setDiffBase(content);
      setShowDiff(false);
      onFileSaved?.(filename, new Blob([content]).size);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "保存失败");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`确认删除文件 ${filename}？`)) return;
    await apiFetch(`/skills/${skill.id}/files/${encodeURIComponent(filename)}`, { method: "DELETE" });
    onDeleted();
  }

  const fileInfo = (skill.source_files ?? []).find((f) => f.filename === filename);
  const fileCategory = fileInfo ? getFileCategory(fileInfo) : inferCategory(filename);
  const categoryHint = CATEGORY_CONFIG[fileCategory]?.hint;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0 w-0 flex-[1]">
      {isReadOnly && (
        <div className="px-4 py-2 bg-amber-50 border-b-2 border-amber-300 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">已发布（只读）</span>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-[#1A202C] flex items-center gap-3 flex-shrink-0">
        {(() => { const CatIcon = CATEGORY_CONFIG[fileCategory]?.icon || FileCode; return <CatIcon size={12} className="text-[#00A3C4] flex-shrink-0" />; })()}
        <span className="text-xs font-bold font-mono flex-1 truncate">{filename}</span>
        {fileInfo && (
          <span className="text-[8px] text-gray-400 font-mono flex-shrink-0">
            {fileInfo.size > 1024 ? `${(fileInfo.size / 1024).toFixed(1)} KB` : `${fileInfo.size} B`}
          </span>
        )}
        {!isReadOnly && (
          <button onClick={handleDelete} className="text-[8px] font-bold uppercase text-red-400 hover:text-red-600 flex-shrink-0">
            删除
          </button>
        )}
      </div>

      {/* Category hint bar */}
      {categoryHint && (
        <div className="px-4 py-1.5 bg-[#F0F4F8] border-b border-gray-200 flex-shrink-0">
          <span className="text-[9px] text-gray-500">{categoryHint}</span>
        </div>
      )}

      {/* Editor area */}
      <div className="flex-1 flex flex-col px-4 py-3 overflow-hidden min-h-0">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            {isText ? "文件内容" : "附属文件（二进制）"}
          </span>
          {hasDiff && isText && (
            <button
              onClick={() => setShowDiff((v) => !v)}
              className={`text-[8px] font-bold uppercase tracking-widest transition-colors ${
                showDiff ? "text-[#00CC99]" : "text-gray-400 hover:text-[#00CC99]"
              }`}
            >
              {showDiff ? "◼ 编辑模式" : "◈ 查看变更"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[9px] text-gray-400 animate-pulse">加载中...</div>
        ) : !isText ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <FileCode size={32} className="text-gray-300" />
            <p className="text-[9px] text-gray-400">二进制文件，不支持文本预览</p>
            {fileInfo && (
              <a
                href={`/api/proxy/${fileInfo.path}`}
                download={filename}
                className="text-[9px] text-[#00A3C4] hover:underline font-bold"
              >
                下载文件
              </a>
            )}
          </div>
        ) : showDiff && diffBase !== null ? (
          <DiffViewer oldText={diffBase} newText={content} />
        ) : (
          <LineNumberedEditor
            value={content}
            onChange={setContent}
            disabled={isReadOnly}
            placeholder="文件内容..."
          />
        )}
      </div>

      {/* Toolbar */}
      {!isReadOnly && isText && (
        <div className="px-4 py-3 border-t-2 border-[#1A202C] flex items-center gap-2 flex-shrink-0">
          <PixelButton size="sm" variant="secondary" onClick={handleSave} disabled={saving || loading}>
            {saving ? "保存中..." : "保存文件"}
          </PixelButton>
          {msg && (
            <span className={`text-[9px] font-bold ${msg.startsWith("✓") ? "text-[#00CC99]" : "text-red-500"}`}>{msg}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Middle panel ─────────────────────────────────────────────────────────────

function PromptEditor({
  skill,
  isNew,
  prompt,
  externalName,
  pendingDiffBase,
  saveRef,
  onPromptChange,
  onSaved,
  onFork,
  onFileSaved,
}: {
  skill: SkillDetail | null;
  isNew: boolean;
  prompt: string;
  externalName?: string | null;
  pendingDiffBase?: string | null;
  saveRef?: React.MutableRefObject<(() => void) | null>;
  onPromptChange: (p: string) => void;
  onSaved: (skill: SkillDetail) => void;
  onFork: () => void;
  onFileSaved?: (filename: string, contentSize: number) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [showSaveNote, setShowSaveNote] = useState(false);
  const [diffBase, setDiffBase] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  // Gap 7: 回归测试状态
  const [regressionResult, setRegressionResult] = useState<{
    total_cases: number; passed: number; regressions: number;
  } | null>(null);
  const [regressionRunning, setRegressionRunning] = useState(false);

  async function runRegression() {
    if (!skill?.id || regressionRunning) return;
    setRegressionRunning(true);
    setRegressionResult(null);
    try {
      const res = await apiFetch<{ total_cases: number; passed: number; regressions: number }>(
        `/sandbox/regression/${skill?.id}`, { method: "POST" }
      );
      setRegressionResult(res);
    } catch {
      setRegressionResult({ total_cases: 0, passed: 0, regressions: -1 });
    } finally {
      setRegressionRunning(false);
    }
  }

  // Data table binding state
  const [dataQueries, setDataQueries] = useState<SkillDetail["data_queries"]>([]);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [availableTables, setAvailableTables] = useState<{ table_name: string; display_name: string }[]>([]);
  const [tablePickerSearch, setTablePickerSearch] = useState("");
  const [savingTables, setSavingTables] = useState(false);

  // Preflight state
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [preflightRunning, setPreflightRunning] = useState(false);
  const [preflightStage, setPreflightStage] = useState<string | null>(null);
  const [showKbConfirm, setShowKbConfirm] = useState<PreflightGate["items"] | null>(null);
  const [, setSubmitting] = useState(false);

  const isReadOnly = skill?.status === "published" || skill?.status === "archived";
  const hasDiff = diffBase !== null && diffBase !== prompt;

  useEffect(() => {
    if (!skill) {
      if (isNew) { setName(""); setDescription(""); setVersions([]); setDiffBase(null); setShowDiff(false); }
      return;
    }
    apiFetch<SkillDetail>(`/skills/${skill.id}`)
      .then((d) => {
        setName(d.name);
        setDescription(d.description ?? "");
        const p = d.versions?.[0]?.system_prompt ?? d.system_prompt ?? "";
        onPromptChange(p);
        setVersions(d.versions ?? []);
        setDiffBase(p);
        setShowDiff(false);
        const queries = d.data_queries ?? [];
        if (queries.length > 0) {
          setDataQueries(queries);
          try { localStorage.setItem(`skill_data_queries_${skill.id}`, JSON.stringify(queries)); } catch {}
        } else {
          try {
            const cached = localStorage.getItem(`skill_data_queries_${skill.id}`);
            if (cached) { setDataQueries(JSON.parse(cached)); return; }
          } catch {}
          setDataQueries([]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill?.id]);

  useEffect(() => {
    if (isNew) { setName(""); setDescription(""); setVersions([]); onPromptChange(""); setDiffBase(null); setShowDiff(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  useEffect(() => {
    if (externalName) setName(externalName);
  }, [externalName]);

  useEffect(() => {
    if (!showTablePicker) return;
    apiFetch<{ table_name: string; display_name: string }[]>("/business-tables")
      .then((d) => setAvailableTables(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [showTablePicker]);

  async function saveDataQueries(next: SkillDetail["data_queries"]) {
    if (!skill) return;
    setSavingTables(true);
    try {
      await apiFetch(`/skills/${skill.id}/data-queries`, {
        method: "PATCH",
        body: JSON.stringify({ data_queries: next }),
      });
      setDataQueries(next);
      try { localStorage.setItem(`skill_data_queries_${skill.id}`, JSON.stringify(next)); } catch {}
    } catch { /* ignore */ }
    finally { setSavingTables(false); }
  }

  function addTableBinding(table: { table_name: string; display_name: string }) {
    const already = (dataQueries ?? []).some((q) => q.table_name === table.table_name);
    if (already) return;
    const next = [...(dataQueries ?? []), {
      query_name: `read_${table.table_name}`,
      query_type: "read",
      table_name: table.table_name,
      description: table.display_name,
    }];
    saveDataQueries(next);
    setShowTablePicker(false);
  }

  function removeTableBinding(table_name: string) {
    saveDataQueries((dataQueries ?? []).filter((q) => q.table_name !== table_name));
  }

  useEffect(() => {
    if (pendingDiffBase != null) {
      setDiffBase(pendingDiffBase);
      setShowDiff(true);
    }
  }, [pendingDiffBase]);

  async function handleSave() {
    if (!name.trim() || !prompt.trim()) { setSaveMsg("名称和 Prompt 不能为空"); return; }
    setSaving(true); setSaveMsg(null);
    try {
      if (isNew || !skill) {
        const created = await apiFetch<SkillDetail>("/skills", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), description: description.trim(), system_prompt: prompt.trim(), mode: "hybrid", variables: [], auto_inject: true }),
        });
        setSaveMsg("✓ 已创建");
        setDiffBase(prompt);
        setShowDiff(false);
        onSaved(created);
      } else {
        await apiFetch(`/skills/${skill.id}/versions`, {
          method: "POST",
          body: JSON.stringify({ system_prompt: prompt.trim(), change_note: changeNote.trim() || "手动编辑" }),
        });
        if (name !== skill.name || description !== (skill.description ?? "")) {
          await apiFetch(`/skills/${skill.id}`, {
            method: "PUT",
            body: JSON.stringify({ name: name.trim(), description: description.trim() }),
          }).catch(() => {});
        }
        setChangeNote(""); setShowSaveNote(false);
        const assetCount = skill.source_files?.length ?? 0;
        setSaveMsg(`✓ 已保存新版本${assetCount > 0 ? `（含 ${assetCount} 个附属文件）` : ""}`);
        setDiffBase(prompt);
        setShowDiff(false);
        const d = await apiFetch<SkillDetail>(`/skills/${skill.id}`);
        setVersions(d.versions ?? []);
        onSaved(d);
        onFileSaved?.("SKILL.md", new Blob([prompt]).size);
      }
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "保存失败");
    } finally { setSaving(false); }
  }

  async function runPreflight() {
    if (!skill) return;
    setPreflightRunning(true);
    setPreflightResult(null);
    setPreflightStage("启动检测...");
    const token = getToken();
    try {
      const resp = await fetch(`/api/proxy/sandbox/preflight/${skill.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const reader = resp.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buf = "";
      const gates: PreflightGate[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        let curEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { curEvent = line.slice(7).trim(); continue; }
          if (line.startsWith("data: ")) {
            const raw = line.slice(6);
            try {
              const data = JSON.parse(raw);
              if (curEvent === "gate") {
                if (data.status === "running") {
                  setPreflightStage(data.label);
                } else {
                  const idx = gates.findIndex((g) => g.gate === data.gate);
                  if (idx >= 0) gates[idx] = data; else gates.push(data);
                  setPreflightResult((prev) => ({ ...prev, passed: false, gates: [...gates] } as PreflightResult));
                  setPreflightStage(null);
                }
              } else if (curEvent === "stage") {
                setPreflightStage(data.label);
              } else if (curEvent === "test_result") {
                setPreflightResult((prev) => ({
                  ...prev!,
                  tests: [...(prev?.tests || []), data],
                }));
              } else if (curEvent === "done") {
                setPreflightResult(data as PreflightResult);
                setPreflightStage(null);
              }
            } catch { /* ignore parse error */ }
          }
        }
      }
    } catch (err) {
      console.error("Preflight failed", err);
      setPreflightStage(null);
    } finally {
      setPreflightRunning(false);
    }
  }

  async function handleSubmitReview() {
    if (!skill) return;
    setSubmitting(true);
    try {
      await apiFetch(`/skills/${skill.id}/status?status=published`, { method: "PATCH" });
      setSaveMsg("✓ 已提交审核");
      onSaved(skill);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "提交失败");
    } finally { setSubmitting(false); }
  }

  // Sync saveRef every render so parent can call handleSave
  if (saveRef) saveRef.current = handleSave;

  if (!skill && !isNew) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-white">
        <div className="w-12 h-12 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center">
          <SkillIcon size={18} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          从左侧选择 Skill 编辑，或点击新建
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0 w-0 flex-[1]">
      {isReadOnly && (
        <div className="px-4 py-2 bg-amber-50 border-b-2 border-amber-300 flex items-center gap-3 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">已发布（只读）</span>
          <PixelButton size="sm" onClick={onFork}>Fork 并编辑</PixelButton>
        </div>
      )}

      {/* Meta */}
      <div className="px-4 py-3 border-b-2 border-[#1A202C] space-y-2 flex-shrink-0">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Skill 名称" disabled={isReadOnly}
          className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF] disabled:opacity-50 disabled:bg-gray-50" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述（可选）" disabled={isReadOnly}
          className="w-full border-2 border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:border-[#00D1FF] disabled:opacity-50 disabled:bg-gray-50" />
      </div>

      {/* Prompt */}
      <div className="flex-1 flex flex-col px-4 py-3 overflow-hidden min-h-0">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            SKILL.md{versions.length > 0 && <span className="ml-2 text-gray-400">v{versions[0].version}</span>}
          </span>
          <div className="flex items-center gap-3">
            {hasDiff && (
              <button
                onClick={() => setShowDiff((v) => !v)}
                className={`text-[8px] font-bold uppercase tracking-widest transition-colors ${
                  showDiff ? "text-[#00CC99]" : "text-gray-400 hover:text-[#00CC99]"
                }`}
              >
                {showDiff ? "◼ 编辑模式" : "◈ 查看变更"}
              </button>
            )}
            {versions.length > 1 && (
              <>
                <button onClick={() => setShowVersions((v) => !v)}
                  className="text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4]">
                  {showVersions ? "▲ 收起历史" : "▼ 版本历史"}
                </button>
                {!isNew && (
                  <button onClick={runRegression} disabled={regressionRunning}
                    className="text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] disabled:opacity-50">
                    {regressionRunning ? "回归测试中..." : "回归测试"}
                  </button>
                )}
                {regressionResult && (
                  <span className={`text-[8px] font-bold ${regressionResult.regressions > 0 ? "text-red-500" : regressionResult.regressions === 0 ? "text-green-600" : "text-gray-400"}`}>
                    {regressionResult.regressions === -1
                      ? "无基线"
                      : regressionResult.regressions > 0
                        ? `${regressionResult.regressions} 回归`
                        : `${regressionResult.passed}/${regressionResult.total_cases} 通过`}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        {showVersions && (
          <div className="mb-2 border-2 border-[#1A202C] max-h-40 overflow-y-auto flex-shrink-0">
            {versions.map((v) => (
              <button key={v.id} onClick={() => { onPromptChange(v.system_prompt ?? ""); setShowVersions(false); setDiffBase(v.system_prompt ?? ""); setShowDiff(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-[#F0F4F8] border-b border-gray-100 last:border-0 flex items-center gap-2">
                <span className="text-[9px] font-bold text-[#00A3C4]">v{v.version}</span>
                <span className="text-[8px] text-gray-500 flex-1 truncate">{v.change_note || "无说明"}</span>
                <span className="text-[8px] text-gray-400 font-mono flex-shrink-0">
                  {new Date(v.created_at).toLocaleDateString("zh-CN")}
                </span>
              </button>
            ))}
          </div>
        )}
        {showDiff && diffBase !== null ? (
          <DiffViewer oldText={diffBase} newText={prompt} />
        ) : (
          <LineNumberedEditor
            value={prompt}
            onChange={onPromptChange}
            disabled={isReadOnly}
            placeholder="在此输入 System Prompt..."
          />
        )}
      </div>

      {/* Data Table Binding */}
      {!isNew && skill && (
        <div className="border-t-2 border-[#1A202C] flex-shrink-0">
          <div className="px-4 py-2 flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">数据表绑定</span>
            <span className="text-[8px] text-gray-400">({(dataQueries ?? []).length})</span>
            {!isReadOnly && (
              <button onClick={() => { setShowTablePicker(true); setTablePickerSearch(""); }}
                className="ml-auto text-[8px] font-bold text-[#00A3C4] hover:text-[#00D1FF] uppercase tracking-widest">
                + 绑定表
              </button>
            )}
          </div>
          {(dataQueries ?? []).length > 0 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1">
              {(dataQueries ?? []).map((q) => (
                <div key={q.table_name} className="flex items-center gap-1 border border-[#00A3C4] px-1.5 py-0.5 text-[8px] font-mono text-[#00A3C4]">
                  <span>{q.description || q.table_name}</span>
                  {!isReadOnly && (
                    <button onClick={() => removeTableBinding(q.table_name)} className="hover:text-red-500 leading-none">×</button>
                  )}
                </div>
              ))}
            </div>
          )}
          {savingTables && <div className="px-4 pb-1 text-[8px] text-gray-400">保存中...</div>}
          {showTablePicker && (
            <div className="mx-4 mb-3 border-2 border-[#1A202C] bg-white shadow-md">
              <div className="flex items-center border-b border-gray-200 px-2">
                <Search size={10} className="text-gray-400 flex-shrink-0" />
                <input autoFocus value={tablePickerSearch} onChange={(e) => setTablePickerSearch(e.target.value)}
                  placeholder="搜索数据表..." className="flex-1 px-2 py-1.5 text-[9px] font-mono focus:outline-none" />
                <button onClick={() => setShowTablePicker(false)} className="text-gray-400 hover:text-gray-600 text-[10px]">×</button>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {availableTables
                  .filter((t) => !tablePickerSearch || t.display_name.includes(tablePickerSearch) || t.table_name.includes(tablePickerSearch))
                  .map((t) => {
                    const bound = (dataQueries ?? []).some((q) => q.table_name === t.table_name);
                    return (
                      <button key={t.table_name} onClick={() => { if (!bound) addTableBinding(t); }}
                        disabled={bound}
                        className={`w-full text-left px-3 py-1.5 text-[9px] font-mono border-b border-gray-100 last:border-0 flex items-center gap-2 ${bound ? "text-gray-300" : "hover:bg-[#F0F4F8]"}`}>
                        <span className="flex-1 truncate">{t.display_name || t.table_name}</span>
                        <span className="text-[8px] text-gray-400 flex-shrink-0">{t.table_name}</span>
                        {bound && <span className="text-[8px] text-[#00CC99]">已绑定</span>}
                      </button>
                    );
                  })}
                {availableTables.length === 0 && (
                  <div className="px-3 py-2 text-[9px] text-gray-400">暂无可用数据表</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Preflight Report */}
      <PreflightReport
        result={preflightResult}
        stage={preflightStage}
        running={preflightRunning}
        onConfirmKnowledge={(items) => setShowKbConfirm(items || null)}
        onSubmit={handleSubmitReview}
        onRerun={runPreflight}
      />

      {/* Toolbar */}
      {!isReadOnly && (
        <div className="px-4 py-3 border-t-2 border-[#1A202C] flex items-center gap-2 flex-wrap flex-shrink-0">
          {showSaveNote ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="变更说明（可选）" autoFocus
                className="flex-1 min-w-0 border-2 border-[#1A202C] px-2 py-1 text-[9px] font-mono focus:outline-none focus:border-[#00D1FF]"
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveNote(false); }} />
              <PixelButton size="sm" onClick={handleSave} disabled={saving}>{saving ? "保存中..." : "确认保存"}</PixelButton>
              <PixelButton size="sm" variant="secondary" onClick={() => setShowSaveNote(false)}>取消</PixelButton>
            </div>
          ) : (
            <PixelButton size="sm" variant="secondary" onClick={() => { if (isNew || !skill) handleSave(); else setShowSaveNote(true); }} disabled={saving}>
              {saving ? "保存中..." : isNew ? "创建 Skill" : "保存版本"}
            </PixelButton>
          )}
          {!isNew && skill && (
            <div className="flex items-center gap-3 ml-auto">
              <button
                onClick={runPreflight}
                disabled={preflightRunning}
                className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-[#6B46C1] hover:text-[#553C9A] transition-colors disabled:opacity-50"
              >
                {preflightRunning ? "检测中..." : "质量检测"}
              </button>
              <button
                onClick={() => window.open(`/api/proxy/skills/${skill.id}/export-zip`, "_blank")}
                className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] transition-colors"
              >
                <Download size={9} />
                导出 Zip
              </button>
            </div>
          )}
          {saveMsg && (
            <span className={`text-[9px] font-bold ${saveMsg.startsWith("✓") ? "text-[#00CC99]" : "text-red-500"}`}>{saveMsg}</span>
          )}
        </div>
      )}

      {/* Knowledge Confirm Modal */}
      {showKbConfirm && skill && (
        <KnowledgeConfirmModal
          skillId={skill.id}
          items={showKbConfirm.map((it) => ({ check: it.check, ok: it.ok, issue: it.issue }))}
          onDone={() => { setShowKbConfirm(null); runPreflight(); }}
          onCancel={() => setShowKbConfirm(null)}
        />
      )}
    </div>
  );
}

// ─── Preflight types ─────────────────────────────────────────────────────────

interface PreflightGate {
  gate: string;
  label: string;
  status: "running" | "passed" | "failed";
  items?: { check: string; ok: boolean; issue?: string; detail?: string; action?: string; knowledge_id?: number }[];
  cached?: boolean;
  checked_at?: string;
}

interface PreflightTestResult {
  index: number;
  test_input: string;
  response: string;
  score: number;
  detail: { score?: number; coverage?: number; completeness?: number; professionalism?: number; reason?: string };
}

interface PreflightResult {
  passed: boolean;
  blocked_by?: string;
  score?: number;
  gates: PreflightGate[];
  tests?: PreflightTestResult[];
}

// ─── Preflight Report ────────────────────────────────────────────────────────

function PreflightReport({
  result,
  stage,
  running,
  onConfirmKnowledge,
  onSubmit,
  onRerun,
}: {
  result: PreflightResult | null;
  stage: string | null;
  running: boolean;
  onConfirmKnowledge: (items: PreflightGate["items"]) => void;
  onSubmit: () => void;
  onRerun: () => void;
}) {
  if (!running && !result) return null;

  return (
    <div className="px-4 py-3 border-t-2 border-[#6B46C1] bg-[#6B46C1]/5 flex-shrink-0 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">
          {running ? "质量检测中..." : "质量检测"}
        </span>
        {result && !running && (
          <>
            <span className={`text-xs font-bold ${result.passed ? "text-[#00CC99]" : "text-red-500"}`}>
              {result.score != null ? `${result.score} / 100` : ""}
            </span>
            <span className={`text-[9px] font-bold ${result.passed ? "text-[#00CC99]" : "text-red-500"}`}>
              {result.passed ? "✓ 通过" : result.blocked_by ? `✗ 未通过 — ${result.blocked_by}` : "✗ 质量未达标"}
            </span>
          </>
        )}
      </div>

      {/* Running stage */}
      {running && stage && (
        <div className="text-[9px] text-[#6B46C1] font-bold animate-pulse">{stage}</div>
      )}

      {/* Gates */}
      {result && (
        <div className="flex flex-wrap gap-2">
          {result.gates.map((g) => (
            <div key={g.gate} className={`flex items-center gap-1 px-2 py-1 border text-[8px] font-bold ${
              g.status === "passed" ? "border-[#00CC99] text-[#00CC99] bg-[#00CC99]/5" :
              g.status === "failed" ? "border-red-400 text-red-500 bg-red-50" :
              "border-gray-300 text-gray-400"
            }`}>
              {g.status === "passed" ? "✓" : g.status === "failed" ? "✗" : "..."} {g.label}
              {g.cached && <span className="text-[7px] text-gray-400 ml-1">(缓存)</span>}
            </div>
          ))}
        </div>
      )}

      {/* Gate failure items */}
      {result && result.gates.filter((g) => g.status === "failed").map((g) => (
        <div key={g.gate} className="space-y-1">
          {(g.items || []).filter((it) => !it.ok).map((it, i) => (
            <div key={i} className="flex items-center gap-2 text-[9px]">
              <span className="text-red-500">⚠</span>
              <span className="text-gray-700">{it.check}：{it.issue}</span>
              {it.action === "confirm_archive" && (
                <button
                  onClick={() => onConfirmKnowledge(g.items?.filter((x) => x.action === "confirm_archive") || [])}
                  className="text-[8px] font-bold px-1.5 py-0.5 bg-[#6B46C1] text-white"
                >
                  确认归档
                </button>
              )}
            </div>
          ))}
        </div>
      ))}

      {/* Test results */}
      {result && result.tests && result.tests.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400">测试用例</div>
          {result.tests.map((t) => (
            <div key={t.index} className="border border-gray-200 bg-white">
              <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-100">
                <span className={`text-[9px] font-bold ${t.score >= 70 ? "text-[#00CC99]" : "text-red-500"}`}>
                  {t.score}分
                </span>
                <span className="text-[8px] text-gray-500 flex-1 truncate">{t.test_input}</span>
              </div>
              <div className="px-2 py-1 text-[8px] text-gray-500">
                {t.detail.reason || ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!running && result && (
        <div className="flex items-center gap-2 pt-1">
          {result.passed && (
            <PixelButton size="sm" onClick={onSubmit}>提交审核</PixelButton>
          )}
          <PixelButton size="sm" variant="secondary" onClick={onRerun}>
            {result.passed ? "重新检测" : "修复后重检"}
          </PixelButton>
        </div>
      )}
    </div>
  );
}

// ─── Knowledge Confirm Modal ─────────────────────────────────────────────────

function KnowledgeConfirmModal({
  skillId,
  items,
  onDone,
  onCancel,
}: {
  skillId: number;
  items: { check: string; ok: boolean; issue?: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [confirmations, setConfirmations] = useState(
    items.map((it) => ({ filename: it.check, target_board: "", target_category: "general", display_title: it.check.replace(/\.[^.]+$/, "") }))
  );
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  async function handleConfirmAll() {
    setSaving(true);
    try {
      await apiFetch(`/sandbox/preflight/${skillId}/knowledge-confirm`, {
        method: "POST",
        body: JSON.stringify({ confirmations }),
      });
      onDone();
    } catch (err) {
      console.error("Knowledge confirm failed", err);
    } finally { setSaving(false); }
  }

  const current = confirmations[step];
  if (!current) return null;

  function updateField(field: string, value: string) {
    setConfirmations((prev) => prev.map((c, i) => i === step ? { ...c, [field]: value } : c));
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] w-[480px] max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b-2 border-[#1A202C] bg-[#EBF4F7] flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">确认知识库归档</span>
          <span className="text-[8px] text-gray-400 ml-auto">{step + 1} / {confirmations.length}</span>
        </div>

        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">文件名</div>
            <div className="text-[10px] font-mono text-gray-700 bg-[#F0F4F8] px-3 py-2 border border-gray-200">{current.filename}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">条目标题</div>
            <input
              value={current.display_title}
              onChange={(e) => updateField("display_title", e.target.value)}
              className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-[10px] focus:outline-none focus:border-[#6B46C1]"
            />
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">归档板块</div>
            <input
              value={current.target_board}
              onChange={(e) => updateField("target_board", e.target.value)}
              placeholder="如：A.渠道与平台"
              className="w-full border-2 border-gray-300 px-3 py-1.5 text-[10px] focus:outline-none focus:border-[#6B46C1]"
            />
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">分类</div>
            <select
              value={current.target_category}
              onChange={(e) => updateField("target_category", e.target.value)}
              className="w-full border-2 border-gray-300 px-3 py-1.5 text-[10px] focus:outline-none focus:border-[#6B46C1]"
            >
              <option value="general">通用</option>
              <option value="experience">经验</option>
              <option value="external_intel">外部情报</option>
              <option value="methodology">方法论</option>
              <option value="sop">SOP</option>
            </select>
          </div>
          <div className="text-[8px] text-gray-400">
            命名建议：使用「领域-主题-类型」格式，如「投放-抖音ROI分析-SOP」
          </div>
        </div>

        <div className="px-4 py-3 border-t-2 border-[#1A202C] flex items-center gap-2">
          {step > 0 && (
            <PixelButton size="sm" variant="secondary" onClick={() => setStep(step - 1)}>上一个</PixelButton>
          )}
          {step < confirmations.length - 1 ? (
            <PixelButton size="sm" onClick={() => setStep(step + 1)}>下一个</PixelButton>
          ) : (
            <PixelButton size="sm" onClick={handleConfirmAll} disabled={saving}>
              {saving ? "入库中..." : "全部入库"}
            </PixelButton>
          )}
          <PixelButton size="sm" variant="secondary" onClick={onCancel}>取消</PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─── Tool suggestion card ─────────────────────────────────────────────────────

function ToolSuggestionCard({
  suggestion,
  skillId,
  onBound,
  onDevStudio,
}: {
  suggestion: StudioToolSuggestion;
  skillId: number | null;
  onBound: () => void;
  onDevStudio: (desc: string) => void;
}) {
  const [binding, setBinding] = useState<number | null>(null);

  async function handleBind(toolId: number) {
    if (!skillId) return;
    setBinding(toolId);
    try {
      await apiFetch(`/tools/skill/${skillId}/tools/${toolId}`, { method: "POST" });
      onBound();
    } catch (err) {
      console.error("Bind failed", err);
    } finally { setBinding(null); }
  }

  return (
    <div className="border-2 border-[#6B46C1] bg-[#6B46C1]/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Package size={10} className="text-[#6B46C1]" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">工具建议</span>
      </div>
      {suggestion.suggestions.map((s, i) => (
        <div key={i} className="flex items-start gap-2 pl-1">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-gray-800">{s.name}</div>
            <div className="text-[9px] text-gray-500 mt-0.5">{s.reason}</div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {s.action === "bind_existing" && s.tool_id ? (
              <button
                onClick={() => handleBind(s.tool_id!)}
                disabled={binding === s.tool_id}
                className="text-[8px] font-bold px-2 py-1 bg-[#6B46C1] text-white disabled:opacity-50"
              >
                {binding === s.tool_id ? "..." : "绑定"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => onDevStudio(s.name + "：" + s.reason)}
                  className="text-[8px] font-bold px-2 py-1 bg-[#6B46C1] text-white flex items-center gap-1"
                >
                  <ExternalLink size={7} />
                  Dev Studio
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({
  summary,
  onConfirm,
  onConfirmEdited,
  onDiscard,
}: {
  summary: StudioSummary;
  onConfirm: () => void;
  onConfirmEdited: (editedItems: { label: string; value: string }[]) => void;
  onDiscard: () => void;
}) {
  const [editedItems, setEditedItems] = useState(() =>
    summary.items.map((item) => ({ ...item }))
  );
  const hasEdits = editedItems.some((item, i) => item.value !== summary.items[i]?.value);

  return (
    <div className="mx-3 my-2 border-2 border-[#00CC99] bg-[#F0FFF9] flex-shrink-0">
      <div className="px-3 py-2 border-b border-[#CCFFF0] flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99] flex-1">
          ◈ {summary.title || "需求理解摘要"}
        </span>
        <span className="text-[8px] text-gray-400">可直接编辑后确认</span>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        {editedItems.map((item, i) => (
          <div key={i} className="flex gap-2 text-[9px] items-start">
            <span className="font-bold text-[#00CC99] flex-shrink-0 w-16 truncate pt-0.5">{item.label}</span>
            <input
              type="text"
              value={item.value}
              onChange={(e) => {
                const next = [...editedItems];
                next[i] = { ...next[i], value: e.target.value };
                setEditedItems(next);
              }}
              className="flex-1 border border-gray-200 px-1.5 py-0.5 text-[9px] font-mono focus:outline-none focus:border-[#00CC99] bg-white"
            />
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-[#CCFFF0] flex gap-2">
        <PixelButton
          size="sm"
          onClick={() => hasEdits ? onConfirmEdited(editedItems) : onConfirm()}
          className="flex-1"
        >
          {hasEdits ? "✓ 按修改后的理解生成" : "✓ 确认，开始生成"}
        </PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={onDiscard}>重新描述</PixelButton>
      </div>
    </div>
  );
}

// ─── Draft card ───────────────────────────────────────────────────────────────

function DraftCard({
  draft,
  currentPrompt,
  onApply,
  onDiscard,
}: {
  draft: StudioDraft;
  currentPrompt: string;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const hasDiff = currentPrompt !== draft.system_prompt;

  return (
    <div className="mx-3 my-2 border-2 border-[#00A3C4] bg-[#F0FAFF] flex-shrink-0">
      <div className="px-3 py-2 border-b border-[#CCE8F4] flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] flex-1">
          ✦ 待采纳草稿{draft.name ? `：${draft.name}` : ""}
        </span>
        {hasDiff && (
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="text-[8px] font-bold uppercase text-gray-400 hover:text-[#00A3C4]"
          >
            {showPreview ? "收起" : "预览变更"}
          </button>
        )}
      </div>
      {draft.change_note && (
        <div className="px-3 py-1.5 text-[9px] text-gray-600 border-b border-[#CCE8F4]">{draft.change_note}</div>
      )}
      {showPreview && hasDiff && (
        <div className="max-h-48 overflow-auto border-b border-[#CCE8F4]">
          <DiffViewer oldText={currentPrompt} newText={draft.system_prompt} />
        </div>
      )}
      <div className="px-3 py-2 flex gap-2">
        <PixelButton size="sm" onClick={onApply} className="flex-1">✓ 应用到编辑框</PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={onDiscard}>丢弃</PixelButton>
      </div>
    </div>
  );
}

// ─── File split card ─────────────────────────────────────────────────────────

function FileSplitCard({
  split,
  currentPrompt,
  skillId,
  splitting,
  onConfirm,
  onDiscard,
}: {
  split: StudioFileSplit;
  currentPrompt: string;
  skillId: number | null;
  splitting: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const hasDiff = currentPrompt !== split.main_prompt_after_split;

  return (
    <div className="mx-3 my-2 border-2 border-[#E9D5FF] bg-[#FAF5FF] flex-shrink-0">
      <div className="px-3 py-2 border-b border-[#E9D5FF] flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1] flex-1">
          ✦ 文件拆分建议
        </span>
        <span className="text-[8px] text-gray-400">{split.files.length} 个文件待拆出</span>
      </div>
      {split.change_note && (
        <div className="px-3 py-1.5 text-[9px] text-gray-600 border-b border-[#E9D5FF]">{split.change_note}</div>
      )}
      <div className="px-3 py-2 space-y-1.5">
        {split.files.map((f, i) => {
          const cfg = CATEGORY_CONFIG[f.category] || CATEGORY_CONFIG.other;
          const CatIcon = cfg.icon;
          return (
            <div key={i} className="flex items-start gap-2">
              <CatIcon size={10} className="text-[#6B46C1] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-bold text-gray-800">{f.filename}</span>
                  <span className="text-[7px] px-1 py-0.5 bg-[#6B46C1]/10 text-[#6B46C1] font-bold">{cfg.label}</span>
                </div>
                <div className="text-[8px] text-gray-500 mt-0.5">{f.reason}</div>
              </div>
            </div>
          );
        })}
      </div>
      {hasDiff && (
        <div className="px-3 py-1 border-t border-[#E9D5FF]">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#6B46C1]"
          >
            {showPreview ? "收起主文件变更" : "预览主文件变更"}
          </button>
        </div>
      )}
      {showPreview && hasDiff && (
        <div className="max-h-48 overflow-auto border-t border-[#E9D5FF]">
          <DiffViewer oldText={currentPrompt} newText={split.main_prompt_after_split} />
        </div>
      )}
      <div className="px-3 py-2 border-t border-[#E9D5FF] flex gap-2">
        <PixelButton size="sm" onClick={onConfirm} disabled={splitting || !skillId} className="flex-1">
          {splitting ? "拆分中..." : "✓ 确认拆分"}
        </PixelButton>
        <PixelButton size="sm" variant="secondary" onClick={onDiscard} disabled={splitting}>不拆分</PixelButton>
      </div>
    </div>
  );
}

// ─── Stage indicator ─────────────────────────────────────────────────────────

const STUDIO_STAGE_LABELS: Record<string, string> = {
  connecting: "连接服务...",
  matching_skill: "识别意图...",
  checking_context: "检索知识 & 校验输入...",
  compiling_prompt: "组装提示词...",
  preparing: "匹配 Skill & 组装上下文...",
  generating: "生成中...",
  tool_calling: "调用工具中...",
  uploading: "上传文件中...",
  parsing: "解析文件内容...",
  summarizing: "生成结构化摘要...",
  pev_start: "分析任务复杂度...",
  replanning: "重新规划中...",
  ingest_parsing: "识别内容类型...",
  ingest_splitting: "拆分内容块...",
  ingest_saving: "存储子文件...",
  ingest_analyzing: "分析与 Skill 的关系...",
};

function stageLabel(stage: string | null): string {
  if (!stage) return "等待响应...";
  if (stage.startsWith("executing:")) return `执行：${stage.slice(10)}`;
  if (stage.startsWith("retrying:")) return `重试：${stage.slice(9)}`;
  return STUDIO_STAGE_LABELS[stage] || `处理中（${stage}）...`;
}

function StageIndicator({ stage }: { stage: string | null }) {
  return (
    <span className="text-[#00A3C4] flex items-center gap-1.5">
      <span className="flex gap-0.5">
        <span className="w-1 h-1 bg-[#00A3C4] animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1 h-1 bg-[#00A3C4] animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1 h-1 bg-[#00A3C4] animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>
      <span className="text-[8px] font-bold uppercase tracking-widest">{stageLabel(stage)}</span>
    </span>
  );
}

// ─── Token estimation ─────────────────────────────────────────────────────────

const TOKEN_COMPRESS_THRESHOLD = 180_000;

function estimateTokens(text: string): number {
  if (!text) return 0;
  // 中文字符：约 1.5 token/字；英文/数字：约 0.25 token/word
  let tokens = 0;
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  tokens += cjkCount * 1.5;
  const rest = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ");
  const words = rest.split(/\s+/).filter(Boolean);
  tokens += words.length * 1.3; // 英文 word 约 1.3 token
  return Math.ceil(tokens);
}

function estimateMessagesTokens(msgs: ChatMessage[]): number {
  return msgs.reduce((sum, m) => sum + estimateTokens(m.text) + 4, 0); // +4 per msg overhead
}

// ─── Right panel (Studio Chat) ─────────────────────────────────────────────────

function StudioChat({
  convId,
  skillId,
  currentPrompt,
  editorIsDirty,
  allSkills,
  memo,
  onApplyDraft,
  onNewSession,
  onToolBound,
  onDevStudio,
  onFileSplitDone,
  onMemoRefresh,
  onOpenSandbox,
  selectedSourceFile,
  onEditorTarget,
  clearRef,
  setInputRef,
  onViewReport,
  sandboxReportId,
}: {
  convId: number;
  skillId: number | null;
  currentPrompt: string;
  editorIsDirty: boolean;
  selectedSourceFile: string | null;
  allSkills: SkillDetail[];
  memo: SkillMemo | null;
  onApplyDraft: (draft: StudioDraft) => void;
  onNewSession: () => void;
  onToolBound: () => void;
  onDevStudio: (desc: string) => void;
  onFileSplitDone: () => void;
  onMemoRefresh: () => void;
  onOpenSandbox: (skillId: number) => void;
  onEditorTarget: (fileType: string, filename: string) => void;
  clearRef?: { current: (() => void) | null };
  setInputRef?: { current: ((text: string) => void) | null };
  onViewReport?: () => void;
  sandboxReportId?: string;
}) {
  // 消息主存在后端 DB，localStorage 只做草稿和 UI 状态缓存
  const _storageKey = `studio_msgs_${convId}`;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [backendLoaded, setBackendLoaded] = useState(false);
  const [backendFailed, setBackendFailed] = useState(false);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamStage, setStreamStage] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<StudioDraft | null>(null);
  const [pendingSummary, setPendingSummary] = useState<StudioSummary | null>(null);
  const [pendingToolSuggestion, setPendingToolSuggestion] = useState<StudioToolSuggestion | null>(null);
  const [pendingFileSplit, setPendingFileSplit] = useState<StudioFileSplit | null>(null);
  const [splitting, setSplitting] = useState(false);

  // V2 会话状态
  const [sessionState, setSessionState] = useState<{
    scenario: string; mode: string; goal: string;
    confirmed_facts: string[]; active_constraints: string[];
    rejected: string[]; file_status: string;
    readiness: number; has_draft: boolean; total_rounds: number;
  } | null>(null);
  const [reconciledFacts, setReconciledFacts] = useState<{ type: string; text: string }[]>([]);
  const [directionShift, setDirectionShift] = useState<{ from: string; to: string } | null>(null);
  const [fileNeedStatus, setFileNeedStatus] = useState<{ status: string; forbidden_countdown: number } | null>(null);
  const [repeatBlocked, setRepeatBlocked] = useState<string | null>(null);

  // ── Memo action handlers ──
  async function handleMemoStartTask(taskId: string) {
    if (!skillId) return;
    try {
      const result = await apiFetch<{ ok: boolean; editor_target?: { mode: string; file_type: string; filename: string } }>(`/skills/${skillId}/memo/tasks/${taskId}/start`, {
        method: "POST",
        body: JSON.stringify({ source: "studio_chat" }),
      });
      onMemoRefresh();
      // 如果后端返回了 editor_target，自动打开对应文件
      if (result.editor_target?.filename) {
        onEditorTarget(result.editor_target.file_type || "asset", result.editor_target.filename);
      }
    } catch (err) {
      console.error("handleMemoStartTask failed:", err);
      setMessages((prev) => [...prev,
        { role: "assistant", text: `任务启动失败：${err instanceof Error ? err.message : "未知错误"}`, loading: false },
      ]);
    }
  }

  async function handleMemoDirectTest() {
    if (!skillId) return;
    try {
      await apiFetch(`/skills/${skillId}/memo/direct-test`, {
        method: "POST",
        body: JSON.stringify({ source: "persistent_notice" }),
      });
      onMemoRefresh();
      // 自动弹出沙盒测试 Modal
      onOpenSandbox(skillId);
    } catch (err) {
      console.error("handleMemoDirectTest failed:", err);
      setMessages((prev) => [...prev,
        { role: "assistant", text: `操作失败：${err instanceof Error ? err.message : "未知错误"}`, loading: false },
      ]);
    }
  }

  const [hashQuery, setHashQuery] = useState<string | null>(null);
  const [hashActiveIdx, setHashActiveIdx] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 注册清空聊天的回调给父组件
  useEffect(() => {
    if (clearRef) {
      clearRef.current = () => {
        abortRef.current?.abort();
        setMessages([]);
        setStreaming(false);
        setStreamStage(null);
        setPendingDraft(null);
        setPendingSummary(null);
        setPendingFileSplit(null);
        try { localStorage.removeItem(_storageKey); } catch { /* ignore */ }
        // 同步清除后端消息
        apiFetch(`/conversations/${convId}/messages`, { method: "DELETE" }).catch(() => {});
      };
    }
    return () => { if (clearRef) clearRef.current = null; };
  }, [clearRef, _storageKey, convId]);

  // 注册 setInput 回调给父组件（用于意见采纳填充）
  useEffect(() => {
    if (setInputRef) {
      setInputRef.current = (text: string) => {
        setInput(text);
        setTimeout(() => inputRef.current?.focus(), 50);
      };
    }
    return () => { if (setInputRef) setInputRef.current = null; };
  }, [setInputRef]);

  // convId 切换时从后端加载历史
  useEffect(() => {
    setBackendLoaded(false);
    setBackendFailed(false);
    setPendingDraft(null);
    setPendingSummary(null);
    setPendingFileSplit(null);

    // 先从 localStorage 快速显示（避免白屏）
    try {
      const raw = localStorage.getItem(_storageKey);
      if (raw) setMessages(JSON.parse(raw) as ChatMessage[]);
      else setMessages([]);
    } catch { setMessages([]); }

    const url = `/conversations/${convId}/messages`;

    apiFetch<{ id: number; role: string; content: string; metadata?: Record<string, unknown> }[]>(url)
      .then((dbMsgs) => {
        const mapped: ChatMessage[] = dbMsgs.map((m) => ({
          role: m.role as "user" | "assistant",
          text: m.content,
          loading: false,
        }));
        setMessages(mapped);
        try { localStorage.setItem(_storageKey, JSON.stringify(mapped)); } catch { /* ignore */ }
        setBackendLoaded(true);
      })
      .catch(() => {
        setBackendFailed(true);
        setBackendLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId, _storageKey]);

  // 每次 messages 变化时同步到 localStorage（仅作缓存）
  useEffect(() => {
    if (!backendLoaded) return;
    try { localStorage.setItem(_storageKey, JSON.stringify(messages)); } catch { /* quota exceeded */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, backendLoaded]);

  // 18w token 自动压缩
  const [compressing, setCompressing] = useState(false);
  useEffect(() => {
    if (streaming || compressing || messages.length < 6) return;
    const totalTokens = estimateMessagesTokens(messages);
    if (totalTokens < TOKEN_COMPRESS_THRESHOLD) return;
    setCompressing(true);
    apiFetch<{ messages: ChatMessage[] }>(`/conversations/${convId}/messages/compress`, {
      method: "POST",
      body: JSON.stringify({ skill_id: skillId, messages }),
    })
      .then((res) => {
        if (res.messages && res.messages.length > 0) {
          setMessages(res.messages);
        }
      })
      .catch(() => { /* 压缩失败静默忽略 */ })
      .finally(() => setCompressing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, streaming]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const filteredSkills = hashQuery !== null
    ? allSkills.filter((s) => s.name.toLowerCase().includes(hashQuery.toLowerCase()))
    : [];

  function handleInputChange(v: string, cursorPos: number) {
    setInput(v);
    const before = v.slice(0, cursorPos);
    const hashIdx = before.lastIndexOf("#");
    if (hashIdx !== -1) {
      const q = before.slice(hashIdx + 1);
      if (!q.includes(" ") && !q.includes("\n")) {
        setHashQuery(q);
        setHashActiveIdx(0);
        return;
      }
    }
    setHashQuery(null);
  }

  function selectHashSkill(skill: SkillDetail) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? input.length;
    const before = input.slice(0, cursor);
    const hashIdx = before.lastIndexOf("#");
    const newVal = input.slice(0, hashIdx) + `#${skill.name} ` + input.slice(cursor);
    setInput(newVal);
    setHashQuery(null);
    setTimeout(() => {
      el?.focus();
      const pos = hashIdx + skill.name.length + 2;
      el?.setSelectionRange(pos, pos);
    }, 0);
  }

  const CONTENT_MAX = 6000;

  async function ingestLongText(userText: string) {
    let msgIdx = -1;
    setMessages((prev) => {
      msgIdx = prev.length + 1;
      return [...prev,
        { role: "user", text: userText.slice(0, 300) + `…\n\n_（共 ${userText.length.toLocaleString()} 字符，正在分析…）_` },
        { role: "assistant", text: "", loading: true },
      ];
    });
    setStreaming(true);
    setStreamStage("ingest_parsing");
    setInput("");

    try {
      const token = getToken();
      const resp = await fetch(`/api/proxy/skills/${skillId}/ingest-paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: userText }),
      });
      if (!resp.ok) {
        let errMsg = `长文本分析失败 (${resp.status})`;
        try {
          const errData = await resp.json();
          if (errData.detail) errMsg = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
        } catch { /* use default */ }
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: errMsg, loading: false } : m
        ));
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) {
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: "无法读取响应", loading: false } : m
        ));
        return;
      }
      const decoder = new TextDecoder();
      let buf = "", curEvt = "stage";
      let savedFiles: string[] = [];
      let summary = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { curEvt = line.slice(7).trim(); }
          else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (curEvt === "stage") {
                setStreamStage(data.stage);
              } else if (curEvt === "ingest_files_saved") {
                savedFiles = data.files;
                onFileSplitDone();
              } else if (curEvt === "ingest_result") {
                summary = data.summary;
              } else if (curEvt === "error") {
                setMessages((prev) => prev.map((m, i) =>
                  i === msgIdx ? { ...m, text: data.message || "长文本分析失败", loading: false } : m
                ));
                return;
              }
            } catch { /* skip */ }
            curEvt = "stage";
          }
        }
      }

      // 展示分析结果
      const fileList = savedFiles.map(f => `\`${f}\``).join("、");
      setMessages((prev) => prev.map((m, i) =>
        i === msgIdx ? { ...m, text: `已存储 ${savedFiles.length} 个子文件（${fileList}），正在分析与 Skill 的关系…`, loading: false } : m
      ));
      setStreaming(false);
      setStreamStage(null);

      // 刷新 memo 状态（后端 ingest 已更新 memo 任务树）
      onMemoRefresh();

      // 写入 _memo.md 归档 ingest 记录
      if (skillId && savedFiles.length > 0) {
        try {
          const now = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
          const fileListMd = savedFiles.map(f => `- \`${f}\``).join("\n");
          const newEntry = `## ${now} 长文本粘贴\n\n${summary || "用户粘贴了长文本内容"}\n\n存储文件：\n${fileListMd}\n\n---\n`;

          let existing = "";
          try {
            const res = await apiFetch<{ content: string }>(`/skills/${skillId}/files/_memo.md`);
            existing = res.content || "";
          } catch { /* 文件不存在 */ }

          const header = existing ? "" : `# Skill Memo - Ingest Log\n\n`;
          const content = header + newEntry + existing.replace(/^# Skill Memo.*\n\n/, "");

          await apiFetch(`/skills/${skillId}/files/${encodeURIComponent("_memo.md")}`, {
            method: "PUT",
            body: JSON.stringify({ content }),
          });
        } catch { /* memo 写入失败不阻塞 */ }
      }

      // 自动发送 summary 继续与 Studio Agent 交互
      if (summary) {
        send(summary);
      }
    } catch {
      setMessages((prev) => prev.map((m, i) =>
        i === msgIdx ? { ...m, text: "长文本分析失败，请重试", loading: false } : m
      ));
    } finally {
      setStreaming(false);
      setStreamStage(null);
    }
  }

  async function send(userText: string) {
    if (!userText.trim() || streaming) return;

    // 长文本拦截：超过 CONTENT_MAX 走 ingest 管线
    if (userText.length > CONTENT_MAX) {
      if (!skillId) {
        setMessages((prev) => [...prev,
          { role: "user", text: userText.slice(0, 200) + "…" },
          { role: "assistant", text: `文本较长（${userText.length.toLocaleString()} 字符）。请先选中一个 Skill，系统会自动分析并存储为子文件。`, loading: false },
        ]);
        setInput("");
        return;
      }
      return ingestLongText(userText);
    }

    // 立即添加用户消息 + assistant loading 气泡，让用户马上看到反馈
    let msgIdx = -1;
    setMessages((prev) => {
      msgIdx = prev.length + 1; // assistant 在 user 之后
      return [...prev,
        { role: "user", text: userText },
        { role: "assistant", text: "", loading: true },
      ];
    });
    setStreaming(true);
    setInput("");
    setReconciledFacts([]);
    setDirectionShift(null);
    setRepeatBlocked(null);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const token = getToken();
    let accText = "";

    setStreamStage("connecting");
    const timeout = setTimeout(() => ctrl.abort(), 30_000);

    try {
      const resp = await fetch(`/api/proxy/conversations/${convId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          content: userText,
          selected_skill_id: skillId ?? undefined,
          editor_prompt: currentPrompt || undefined,
          editor_is_dirty: editorIsDirty,
          selected_source_filename: selectedSourceFile || undefined,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        if (resp.status === 401) {
          dispatchAuthExpired();
        }
        let errText = `发送失败 (${resp.status})`;
        if (resp.status === 401) {
          errText = "登录已过期，请重新登录";
        } else if (resp.status === 422) {
          try {
            const errData = await resp.json();
            const detail = errData.detail;
            errText = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg).join("；") : `请求参数错误 (422)`;
          } catch { errText = "请求参数错误 (422)"; }
        }
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: errText, loading: false } : m
        ));
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) {
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: "无法读取响应", loading: false } : m
        ));
        return;
      }
      const decoder = new TextDecoder();
      let buf = "", curEvt = "delta";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { curEvt = line.slice(7).trim(); }
          else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (curEvt === "status" && data.stage) {
                setStreamStage(data.stage as string);
              } else if (curEvt === "studio_summary") {
                setPendingSummary(data as StudioSummary);
              } else if (curEvt === "studio_draft") {
                setPendingDraft(data as StudioDraft);
              } else if (curEvt === "studio_diff") {
                const diff = data as StudioDiff;
                if (diff.ops && diff.ops.length > 0) {
                  const newPrompt = applyOps(currentPrompt, diff.ops);
                  setPendingDraft({ system_prompt: newPrompt, change_note: diff.change_note || "AI 局部修改" });
                } else if (diff.system_prompt?.new) {
                  // 向后兼容老格式
                  setPendingDraft({ system_prompt: diff.system_prompt.new, change_note: "AI 建议修改" });
                }
              } else if (curEvt === "studio_tool_suggestion") {
                setPendingToolSuggestion(data as StudioToolSuggestion);
              } else if (curEvt === "studio_file_split") {
                setPendingFileSplit(data as StudioFileSplit);
              } else if (curEvt === "studio_memo_status" || curEvt === "studio_task_focus" || curEvt === "studio_persistent_notices") {
                // Memo-related SSE events — refresh memo state from backend
                onMemoRefresh();
              } else if (curEvt === "studio_state_update") {
                setSessionState(data as NonNullable<typeof sessionState>);
              } else if (curEvt === "studio_reconciled_facts") {
                setReconciledFacts((data as { facts: typeof reconciledFacts }).facts || []);
              } else if (curEvt === "studio_direction_shift") {
                setDirectionShift(data as NonNullable<typeof directionShift>);
              } else if (curEvt === "studio_file_need_status") {
                setFileNeedStatus(data as NonNullable<typeof fileNeedStatus>);
              } else if (curEvt === "studio_repeat_blocked") {
                setRepeatBlocked((data as { reason: string }).reason || null);
              } else if (curEvt === "studio_editor_target") {
                // AI requests to open/create a specific file
                const target = data as { file_type?: string; filename?: string };
                if (target.filename) {
                  onEditorTarget(target.file_type || "asset", target.filename);
                }
              } else if (curEvt === "studio_context_rollup") {
                // Task completed — compress related chat context
                const rollup = data as { task_id?: string; summary?: string };
                if (rollup.summary && skillId) {
                  // Replace older messages with rollup summary
                  setMessages((prev) => {
                    if (prev.length <= 2) return prev;
                    const kept = prev.slice(-2);
                    return [
                      { role: "assistant" as const, text: `[${rollup.summary}]` },
                      ...kept,
                    ];
                  });
                  onMemoRefresh();
                }
              } else if (curEvt === "error") {
                const errMsg = data.message || "服务端错误";
                setMessages((prev) => prev.map((m, i) =>
                  i === msgIdx ? { ...m, text: errMsg, loading: false } : m
                ));
                setStreamStage(null);
              } else if (curEvt === "done") {
                setMessages((prev) => prev.map((m, i) =>
                  i === msgIdx ? { ...m, loading: false } : m
                ));
                setStreamStage(null);
              } else if ((curEvt === "delta" || curEvt === "content_block_delta") && data.text) {
                accText += data.text;
                setStreamStage("generating");
                setMessages((prev) => prev.map((m, i) => i === msgIdx ? { ...m, text: accText } : m));
              }
            } catch { /* skip */ }
            curEvt = "delta";
          }
        }
      }
      setMessages((prev) => prev.map((m, i) => i === msgIdx ? { ...m, loading: false } : m));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        if (accText) {
          setMessages((prev) => prev.map((m, i) =>
            i === msgIdx ? { ...m, text: accText + "\n\n[连接中断，以上为已接收内容]", loading: false } : m
          ));
        } else {
          setMessages((prev) => prev.map((m, i) =>
            i === msgIdx ? { ...m, text: "连接中断，请重试", loading: false } : m
          ));
        }
      } else if (accText) {
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: accText, loading: false } : m
        ));
      } else {
        // abort 且无内容（超时或手动取消）
        setMessages((prev) => prev.map((m, i) =>
          i === msgIdx ? { ...m, text: "请求超时或已取消", loading: false } : m
        ));
      }
    } finally {
      clearTimeout(timeout);
      setStreaming(false);
      setStreamStage(null);
    }
  }

  function handleApplyDraft() {
    if (!pendingDraft) return;
    onApplyDraft(pendingDraft);
    setPendingDraft(null);
  }

  function handleConfirmSummary() {
    if (!pendingSummary) return;
    setPendingSummary(null);
    const action = pendingSummary.next_action ?? "generate_draft";
    const msg =
      action === "generate_outline"
        ? "好的，请根据以上摘要生成 Skill 的完整目录骨架"
        : action === "generate_section"
        ? "好的，请根据以上摘要扩充对应章节内容"
        : "好的，请根据以上摘要生成完整的 Skill 草稿";
    send(msg);
  }

  function handleConfirmEditedSummary(editedItems: { label: string; value: string }[]) {
    setPendingSummary(null);
    const edits = editedItems.map((item) => `${item.label}=${item.value}`).join("，");
    send(`按以下修正后的理解生成草稿：${edits}`);
  }

  async function handleConfirmSplit() {
    if (!pendingFileSplit || !skillId) return;
    setSplitting(true);
    try {
      for (const f of pendingFileSplit.files) {
        await apiFetch(`/skills/${skillId}/files/${encodeURIComponent(f.filename)}`, {
          method: "PUT",
          body: JSON.stringify({ content: f.content }),
        });
      }
      onApplyDraft({
        system_prompt: pendingFileSplit.main_prompt_after_split,
        change_note: pendingFileSplit.change_note || "拆分文件",
      });
      onFileSplitDone();
    } catch (err) {
      console.error("File split failed", err);
    } finally {
      setSplitting(false);
      setPendingFileSplit(null);
    }
  }

  return (
    <div className="flex flex-col flex-[1] min-w-0 border-l-2 border-[#1A202C] bg-white">
      {/* Header */}
      <div className="px-3 py-2.5 border-b-2 border-[#1A202C] flex items-center gap-2 flex-shrink-0 bg-[#EBF4F7]">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">Studio Chat</span>
        <span className="flex-1" />
        {messages.length > 0 && (
          <button
            onClick={() => {
              abortRef.current?.abort();
              setMessages([]);
              setStreaming(false);
              setPendingDraft(null);
              setPendingFileSplit(null);
            }}
            className="text-[8px] font-bold uppercase text-gray-400 hover:text-red-400 transition-colors"
          >
            清除
          </button>
        )}
        <button
          onClick={onNewSession}
          className="text-[8px] font-bold uppercase text-gray-400 hover:text-[#00A3C4] transition-colors"
        >
          新建会话
        </button>
      </div>
      {/* 状态提示条 */}
      {backendFailed && (
        <div className="px-3 py-1 bg-amber-50 border-b border-amber-200 text-[9px] text-amber-700 font-mono">
          正在显示本地缓存，服务器历史加载失败
        </div>
      )}
      {/* Memo panel: persistent notices + current task + latest test + fix tasks */}
      {memo && (
        <SkillMemoPanel
          memo={memo}
          onStartTask={handleMemoStartTask}
          onDirectTest={handleMemoDirectTest}
          onStartFixTask={(task) => {
            // 根据 target_ref 打开对应文件
            if (task.target_kind === "skill_prompt" || task.target_ref === "SKILL.md") {
              onEditorTarget("prompt", "SKILL.md");
            }
            // 自动将消息发送给 agent 开始修复
            const fixMessage = `请帮我修复以下测试问题：\n${task.title}\n${task.description || ""}\n验收标准：${task.acceptance_rule_text || ""}`;
            send(fixMessage);
          }}
          onTargetedRetest={async (taskId) => {
            // 按 fix task 的 problem_refs 调 targeted-rerun
            const allTasks = ((memo.memo as Record<string, unknown>)?.tasks as Array<{
              id: string;
              problem_refs?: string[];
              source_report_id?: number;
            }>) || [];
            const task = allTasks.find(t => t.id === taskId);
            if (!task?.problem_refs?.length || !task.source_report_id) {
              handleMemoDirectTest();
              return;
            }
            try {
              await apiFetch(
                `/sandbox/interactive/by-report/${task.source_report_id}/targeted-rerun`,
                { method: "POST", body: JSON.stringify({ issue_ids: task.problem_refs }) }
              );
              onMemoRefresh();
            } catch (err) {
              // 不静默 fallback，先展示失败原因
              const errMsg = err instanceof Error ? err.message : "未知错误";
              const fallback = confirm(`局部重测失败：${errMsg}\n\n是否改为打开完整测试？`);
              if (fallback) {
                handleMemoDirectTest();
              }
            }
          }}
          onViewReport={onViewReport}
          sandboxReportId={sandboxReportId}
        />
      )}

      {/* Fixing mode banner */}
      {memo && memo.lifecycle_stage === "fixing" && memo.latest_test?.status === "failed" && (
        <div className="px-3 py-2 bg-amber-50 border-b-2 border-amber-400 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700">
              整改模式
            </span>
            <span className="text-[8px] text-amber-600 flex-1 truncate">
              {memo.latest_test.summary}
            </span>
            {memo.current_task && (
              <span className="text-[7px] font-bold text-amber-500 border border-amber-400 px-1.5 py-0.5 rounded">
                当前: {memo.current_task.title.slice(0, 30)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* V2 当前理解面板 */}
      {sessionState && sessionState.total_rounds > 0 && (
        <div className="px-3 py-2 bg-[#F0F4F8] border-b border-gray-200 flex-shrink-0 space-y-1">
          <div className="flex items-center gap-2 text-[8px] font-mono text-gray-500">
            <span className="font-bold text-[#00A3C4] uppercase">{sessionState.scenario !== "unknown" ? sessionState.scenario.replace(/_/g, " ") : "识别中"}</span>
            <span className="text-gray-300">|</span>
            <span className="font-bold uppercase">{sessionState.mode}</span>
            <span className="text-gray-300">|</span>
            <span className="truncate flex-1">{sessionState.goal}</span>
            {(sessionState.file_status === "not_needed" || sessionState.file_status === "forbidden") && (
              <span className="text-amber-500 font-bold">{sessionState.file_status === "forbidden" ? "禁文件" : "无文件"}</span>
            )}
            <span className="text-gray-400">R{sessionState.total_rounds} S{sessionState.readiness}/5</span>
          </div>
          {/* 已确认事实（折叠） */}
          {sessionState.confirmed_facts.length > 0 && (
            <div className="text-[7px] text-gray-400 truncate">
              已知：{sessionState.confirmed_facts.slice(0, 3).map(f => f.slice(0, 30)).join("；")}
              {sessionState.confirmed_facts.length > 3 && `…等${sessionState.confirmed_facts.length}项`}
            </div>
          )}
          {/* 约束 */}
          {sessionState.active_constraints.length > 0 && (
            <div className="text-[7px] text-red-400 truncate">
              约束：{sessionState.active_constraints.slice(0, 2).map(c => c.slice(0, 25)).join("；")}
            </div>
          )}
          {/* 被否定 */}
          {sessionState.rejected.length > 0 && (
            <div className="text-[7px] text-gray-400 line-through truncate">
              否定：{sessionState.rejected.slice(0, 2).map(r => r.slice(0, 25)).join("；")}
            </div>
          )}
        </div>
      )}

      {/* 本轮已采纳标签 */}
      {reconciledFacts.length > 0 && (
        <div className="px-3 py-1 bg-[#F0FFF9] border-b border-[#CCFFF0] flex gap-2 flex-wrap flex-shrink-0">
          {reconciledFacts.map((f, i) => (
            <span key={i} className={`text-[7px] px-1.5 py-0.5 font-mono ${
              f.type === "correction" ? "bg-amber-100 text-amber-700" :
              f.type === "scenario_shift" ? "bg-purple-100 text-purple-700" :
              f.type === "file_rejection" ? "bg-red-100 text-red-600" :
              f.type === "execution_request" ? "bg-blue-100 text-blue-700" :
              f.type === "constraint" ? "bg-orange-100 text-orange-700" :
              "bg-green-100 text-green-700"
            }`}>
              {f.type === "correction" ? "已纠偏" :
               f.type === "scenario_shift" ? `切换→${f.text}` :
               f.type === "file_rejection" ? "已禁文件" :
               f.type === "execution_request" ? "直接出草稿" :
               f.type === "constraint" ? `约束：${f.text.slice(0, 15)}` :
               `已采纳：${f.text.slice(0, 15)}`}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !streaming && !memo && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[9px] text-gray-400 font-bold uppercase text-center">
              描述你想创建的 Skill，我会快速给出第一版草稿<br />
              <span className="text-gray-300 normal-case font-normal">如果你已有参考文件，可以在左侧选中后告诉我</span>
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[95%] px-2.5 py-2 text-[9px] font-mono leading-relaxed whitespace-pre-wrap border ${
              m.role === "user" ? "bg-[#1A202C] text-white border-[#1A202C]" : "bg-[#F0F4F8] text-[#1A202C] border-gray-200"
            }`}>
              {m.loading && !m.text ? (
                <StageIndicator stage={streaming ? streamStage : null} />
              ) : (
                <>
                  {m.text}
                  {m.loading && <span className="animate-pulse text-[#00A3C4]"> ▋</span>}
                </>
              )}
            </div>
            {/* 纠偏快捷按钮 — 仅最后一条 assistant 消息、非 loading 时显示 */}
            {m.role === "assistant" && !m.loading && i === messages.length - 1 && !streaming && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {[
                  { label: "方向不对", msg: "你理解的方向不对，我重新说一下：" , focusInput: true },
                  { label: "别重复问", msg: "这个问题你已经问过了，请基于已有信息继续推进" },
                  { label: "先别管文件", msg: "不要文件，直接基于对话内容推进" },
                  { label: "直接给草稿", msg: "信息够了，请直接输出 Skill 草稿" },
                  { label: "按上句改", msg: "按我刚才那句修正来调整方向" },
                ].map((action) => (
                  <button
                    key={action.label}
                    onClick={() => {
                      if (action.focusInput) {
                        setInput(action.msg);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      } else {
                        send(action.msg);
                      }
                    }}
                    className="text-[7px] px-1.5 py-0.5 border border-gray-300 text-gray-500 hover:border-[#00A3C4] hover:text-[#00A3C4] transition-colors font-mono uppercase tracking-wider"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pending summary card */}
      {pendingSummary && (
        <SummaryCard
          summary={pendingSummary}
          onConfirm={handleConfirmSummary}
          onConfirmEdited={handleConfirmEditedSummary}
          onDiscard={() => setPendingSummary(null)}
        />
      )}

      {/* Pending draft card */}
      {pendingDraft && (
        <DraftCard
          draft={pendingDraft}
          currentPrompt={currentPrompt}
          onApply={handleApplyDraft}
          onDiscard={() => setPendingDraft(null)}
        />
      )}

      {/* Tool suggestion card */}
      {pendingToolSuggestion && pendingToolSuggestion.suggestions.length > 0 && (
        <div className="px-3 py-2 flex-shrink-0">
          <ToolSuggestionCard
            suggestion={pendingToolSuggestion}
            skillId={skillId}
            onBound={() => { setPendingToolSuggestion(null); onToolBound(); }}
            onDevStudio={(desc) => { setPendingToolSuggestion(null); onDevStudio(desc); }}
          />
        </div>
      )}

      {/* File split card */}
      {pendingFileSplit && pendingFileSplit.files.length > 0 && (
        <FileSplitCard
          split={pendingFileSplit}
          currentPrompt={currentPrompt}
          skillId={skillId}
          splitting={splitting}
          onConfirm={handleConfirmSplit}
          onDiscard={() => setPendingFileSplit(null)}
        />
      )}

      {/* Compressing indicator */}
      {compressing && (
        <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-200 flex-shrink-0">
          <span className="text-[8px] font-bold uppercase tracking-widest text-amber-600 animate-pulse">
            正在压缩历史消息...
          </span>
        </div>
      )}

      {/* Input */}
      <div className="border-t-2 border-[#1A202C] p-3 flex-shrink-0">
        <div className="flex gap-2 relative">
          {hashQuery !== null && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border-2 border-[#1A202C] shadow-lg z-50 max-h-48 overflow-y-auto">
              {filteredSkills.length === 0 ? (
                <div className="px-3 py-2 text-[9px] font-bold text-gray-400 uppercase tracking-widest">无匹配 Skill</div>
              ) : (
                filteredSkills.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectHashSkill(s); }}
                    className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 flex flex-col gap-0.5 transition-colors ${
                      i === hashActiveIdx ? "bg-[#1A202C] text-white" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className={`text-[10px] font-bold flex items-center gap-1 ${i === hashActiveIdx ? "text-white" : "text-[#1A202C]"}`}>
                      <span className="text-[#00D1FF]">#</span>{s.name}
                    </span>
                    {s.description && (
                      <span className={`text-[8px] line-clamp-1 ${i === hashActiveIdx ? "text-gray-300" : "text-gray-400"}`}>{s.description}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            placeholder="描述需求、说「帮我测试」、# 引用 Skill，Ctrl+Enter 发送..."
            disabled={streaming}
            rows={2}
            className="flex-1 border-2 border-[#1A202C] px-2 py-1.5 text-[9px] font-mono focus:outline-none focus:border-[#00D1FF] disabled:opacity-50 resize-none"
            onKeyDown={(e) => {
              if (hashQuery !== null && filteredSkills.length > 0) {
                if (e.key === "ArrowDown") { e.preventDefault(); setHashActiveIdx((i) => (i + 1) % filteredSkills.length); return; }
                if (e.key === "ArrowUp") { e.preventDefault(); setHashActiveIdx((i) => (i - 1 + filteredSkills.length) % filteredSkills.length); return; }
                if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); selectHashSkill(filteredSkills[hashActiveIdx]); return; }
                if (e.key === "Escape") { setHashQuery(null); return; }
              }
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <PixelButton
            size="sm"
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
          >
            {streaming ? "..." : "发送"}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SkillStudio({
  convId,
  initialSkillId,
  fromSandbox,
  sandboxReportId,
  sandboxSessionId,
}: {
  convId: number;
  initialSkillId?: number;
  fromSandbox?: boolean;
  sandboxReportId?: string;
  sandboxSessionId?: string;
}) {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [selectedFile, _setSelectedFile] = useState<SelectedFile | null>(() => {
    // URL 的 initialSkillId 是权威来源，优先于 localStorage
    if (initialSkillId) return { skillId: initialSkillId, fileType: "prompt" as const };
    try {
      const saved = localStorage.getItem("skill_studio_selected");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const setSelectedFile = useCallback((f: SelectedFile | null) => {
    _setSelectedFile(f);
    try {
      if (f) localStorage.setItem("skill_studio_selected", JSON.stringify(f));
      else localStorage.removeItem("skill_studio_selected");
    } catch { /* ignore */ }
  }, []);
  const [isNew, setIsNew] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSandbox, setShowSandbox] = useState<number | null>(null);
  const [memo, setMemo] = useState<SkillMemo | null>(null);
  const [sandboxEntryHandled, setSandboxEntryHandled] = useState(false);
  const [memoSyncError, setMemoSyncError] = useState<string | null>(null);
  const [retryingMemoSync, setRetryingMemoSync] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");  // last persisted version for dirty tracking
  const [externalName, setExternalName] = useState<string | null>(null);
  const [pendingDiffBase, setPendingDiffBase] = useState<string | null>(null);
  const editorSaveRef = useRef<(() => void) | null>(null);
  const clearChatRef = useRef<(() => void) | null>(null);
  const setInputRef = useRef<((text: string) => void) | null>(null);

  const editorIsDirty = prompt !== savedPrompt && prompt.trim().length > 0;

  const router = useRouter();

  // Skill 切换时做页面级路由跳转：resolve 该 skill 的独立 conversation → router.replace
  const navigateToSkillConv = useCallback(async (skillId: number) => {
    try {
      const entry = await apiFetch<{ conversation_id: number }>(
        `/conversations/studio-entry?type=skill_studio&skill_id=${skillId}`
      );
      if (entry.conversation_id !== convId) {
        router.replace(`/chat/${entry.conversation_id}?ws=skill_studio&skill_id=${skillId}`);
      }
    } catch { /* resolve 失败则留在当前 conversation */ }
  }, [convId, router]);

  // 选择新 skill 时触发路由跳转
  useEffect(() => {
    const skillId = selectedFile?.skillId;
    if (skillId && skillId !== initialSkillId) {
      navigateToSkillConv(skillId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.skillId]);

  // URL skill_id 变化时（路由跳转但组件未重新挂载），强制同步 selectedFile
  useEffect(() => {
    if (initialSkillId && selectedFile?.skillId !== initialSkillId) {
      _setSelectedFile({ skillId: initialSkillId, fileType: "prompt" });
      // 同步写入 localStorage
      try { localStorage.setItem("skill_studio_selected", JSON.stringify({ skillId: initialSkillId, fileType: "prompt" })); } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSkillId]);

  // 旧共享会话迁移已移至管理员巡检脚本（opencode_audit.py --fix），
  // 不再在前端页面挂载时自动触发，避免大用户打开页面时扫描大量消息导致性能问题。

  const selectedSkill = selectedFile
    ? (skills.find((s) => s.id === selectedFile.skillId) ?? null)
    : null;

  // ── Memo: fetch when selected skill changes ──
  const fetchMemo = useCallback((skillId: number) => {
    apiFetch<SkillMemo>(`/skills/${skillId}/memo`)
      .then((data) => {
        // Backend returns { skill_id, memo: null } when no memo exists
        if (data && data.lifecycle_stage) {
          setMemo(data);
        } else {
          setMemo(null);
        }
      })
      .catch(() => setMemo(null));
  }, []);

  useEffect(() => {
    const skillId = selectedFile?.skillId;
    if (skillId) {
      fetchMemo(skillId);
    }
    return () => { setMemo(null); };
  }, [selectedFile?.skillId, fetchMemo]);

  // ── Sandbox report 入口：首次进入时刷新 memo，检测 fixing 状态 ──
  useEffect(() => {
    if (!fromSandbox || sandboxEntryHandled || !initialSkillId) return;
    setSandboxEntryHandled(true);
    setMemoSyncError(null);

    // 刷新 memo 并检测是否有 fixing 任务
    apiFetch<SkillMemo>(`/skills/${initialSkillId}/memo`)
      .then((data) => {
        if (data && data.lifecycle_stage) {
          setMemo(data);
          if (data.lifecycle_stage !== "fixing" && (!data.latest_test || data.latest_test.status !== "failed")) {
            setMemoSyncError("整改计划未导入 — Memo 中未检测到 fixing 状态");
          }
        } else {
          setMemoSyncError("整改计划未导入 — Memo 不存在");
        }
      })
      .catch(() => {
        setMemoSyncError("整改任务尚未同步到 Memo");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromSandbox, initialSkillId]);

  const handleRetryMemoSync = async () => {
    if (!sandboxSessionId || retryingMemoSync) return;
    setRetryingMemoSync(true);
    try {
      await apiFetch(`/sandbox/interactive/${sandboxSessionId}/retry-from-step`, {
        method: "POST",
        body: JSON.stringify({ step: "memo_sync" }),
      });
      setMemoSyncError(null);
      if (initialSkillId) fetchMemo(initialSkillId);
    } catch (err) {
      setMemoSyncError(err instanceof Error ? err.message : "重试 Memo 同步失败");
    } finally {
      setRetryingMemoSync(false);
    }
  };

  const handleMemoRefresh = () => {
    if (selectedFile?.skillId) fetchMemo(selectedFile.skillId);
  };

  // ── Memo: complete-from-save after file save ──
  async function handleFileSaved(filename: string, contentSize: number) {
    if (!selectedFile?.skillId || !memo?.current_task) return;
    try {
      const result = await apiFetch<{ ok: boolean; task_completed?: boolean }>(`/skills/${selectedFile.skillId}/memo/tasks/${memo.current_task.id}/complete-from-save`, {
        method: "POST",
        body: JSON.stringify({
          filename,
          file_type: filename === "SKILL.md" ? "prompt" : "asset",
          content_size: contentSize,
        }),
      });
      if (result.ok) handleMemoRefresh();
    } catch { /* ignore — memo may not exist for this skill */ }
  }

  // ── Memo: editor target switching ──
  function handleEditorTarget(fileType: string, filename: string) {
    if (!selectedFile?.skillId) return;
    if (fileType === "prompt" || filename === "SKILL.md") {
      setSelectedFile({ skillId: selectedFile.skillId, fileType: "prompt" });
    } else {
      setSelectedFile({ skillId: selectedFile.skillId, fileType: "asset", filename });
    }
  }

  const fetchSkills = useCallback(() => {
    setSkillsLoading(true);
    apiFetch<SkillDetail[]>("/skills?mine=true")
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]))
      .finally(() => setSkillsLoading(false));
  }, []);

  const [skillRefreshCounter, setSkillRefreshCounter] = useState(0);

  async function refreshSkill(skillId: number) {
    try {
      const updated = await apiFetch<SkillDetail>(`/skills/${skillId}`);
      setSkills((prev) => prev.map((s) => s.id === skillId ? { ...s, ...updated } : s));
      setSkillRefreshCounter((c) => c + 1);
    } catch { /* ignore */ }
  }

  const [globalSkills, setGlobalSkills] = useState<SkillDetail[]>([]);
  useEffect(() => {
    apiFetch<SkillDetail[]>("/skills")
      .then((data) => setGlobalSkills(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const allPublishedSkills = (() => {
    const seen = new Set<number>();
    return [...skills, ...globalSkills].filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; });
  })();

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetchSkills is a stable callback that fetches data
  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  function handleNew() {
    setSelectedFile(null);
    setIsNew(true);
    setPrompt("");
    setSavedPrompt("");
  }

  async function handleSaved(skill: SkillDetail) {
    setSelectedFile({ skillId: skill.id, fileType: "prompt" });
    setIsNew(false);
    setSavedPrompt(prompt);
    fetchSkills();

    // 将本轮 chat 摘要写入 skill 的 _memo.md 附属文件
    // convId 已经是该 skill 的独立 conversation，无需再按 skill_id 过滤
    const chatKey = `studio_msgs_${convId}`;
    try {
      let chatMsgs: ChatMessage[] = [];
      try {
        const dbMsgs = await apiFetch<{ role: string; content: string; metadata?: Record<string, unknown> }[]>(
          `/conversations/${convId}/messages`
        );
        chatMsgs = dbMsgs.map((m) => ({ role: m.role as "user" | "assistant", text: m.content, loading: false }));
      } catch {
        const raw = localStorage.getItem(chatKey);
        chatMsgs = raw ? JSON.parse(raw) : [];
      }
      if (chatMsgs.length > 0) {
        // 取最近 10 条消息作为摘要
        const recent = chatMsgs.slice(-10);
        const summary = recent.map((m) => {
          const prefix = m.role === "user" ? "👤" : "🤖";
          const text = m.text.length > 200 ? m.text.slice(0, 200) + "..." : m.text;
          return `${prefix} ${text}`;
        }).join("\n\n");

        const now = new Date().toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        const newEntry = `## ${now} 改动记录\n\n${summary}\n\n---\n`;

        // 读取已有 memo 内容并追加
        let existing = "";
        try {
          const res = await apiFetch<{ content: string }>(`/skills/${skill.id}/files/_memo.md`);
          existing = res.content || "";
        } catch { /* 文件不存在，忽略 */ }

        const header = existing ? "" : `# Skill Memo - ${skill.name}\n\n`;
        const content = header + newEntry + existing.replace(/^# Skill Memo.*\n\n/, "");

        await apiFetch(`/skills/${skill.id}/files/${encodeURIComponent("_memo.md")}`, {
          method: "PUT",
          body: JSON.stringify({ content }),
        });

        // 归档后清空本轮 chat
        localStorage.removeItem(chatKey);
        clearChatRef.current?.();
      }
    } catch { /* memo 写入失败不阻塞保存流程 */ }
  }

  async function handleFork() {
    if (!selectedSkill) return;
    try {
      const forked = await apiFetch<SkillDetail>(`/skills/${selectedSkill.id}/fork`, { method: "POST" }).catch(() => null);
      if (forked) { handleSaved(forked); return; }
      const detail = await apiFetch<SkillDetail>(`/skills/${selectedSkill.id}`);
      const srcPrompt = detail.versions?.[0]?.system_prompt ?? detail.system_prompt ?? "";
      const created = await apiFetch<SkillDetail>("/skills", {
        method: "POST",
        body: JSON.stringify({ name: `${selectedSkill.name}（副本）`, description: selectedSkill.description, system_prompt: srcPrompt, mode: "hybrid", variables: [], auto_inject: true }),
      });
      handleSaved(created);
    } catch (err) {
      console.error("Fork failed", err);
    }
  }

  function handleApplyDraft(draft: StudioDraft) {
    setPendingDiffBase(prompt);
    setPrompt(draft.system_prompt);
    if (draft.name) setExternalName(draft.name);
  }

  function handleNewSession() {
    // 通过 ref 调用 StudioChat 内部的清空逻辑
    clearChatRef.current?.();
  }

  function handleAdoptSuggestion(skillName: string, suggestion: Suggestion) {
    const text = `${skillName}-修改意见: ${suggestion.problem_desc}\n期望: ${suggestion.expected_direction}`;
    setInputRef.current?.(text);
    // Also register in memo if skill has one
    if (selectedSkill) {
      apiFetch(`/skills/${selectedSkill.id}/memo/adopt-feedback`, {
        method: "POST",
        body: JSON.stringify({
          source_type: "comment",
          source_id: (suggestion as unknown as { id?: number }).id ?? 0,
          summary: `${suggestion.problem_desc} → ${suggestion.expected_direction}`,
          task_blueprint: {},
        }),
      }).then(() => handleMemoRefresh()).catch(() => {});
    }
  }

  async function handleDevStudioJump(desc: string) {
    if (!selectedSkill) return;
    try {
      await apiFetch("/dev-studio/tool-task", {
        method: "POST",
        body: JSON.stringify({
          skill_id: selectedSkill.id,
          skill_name: selectedSkill.name,
          tool_description: desc,
        }),
      });
    } catch { /* best effort */ }

    // 自动在 workdir 中创建 skill 项目文件夹
    const safeName = selectedSkill.name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, "");
    const folderName = `skill-${selectedSkill.id}-${safeName}`;
    try {
      await apiFetch("/dev-studio/workdir/mkdir", {
        method: "POST",
        body: JSON.stringify({ path: folderName }),
      });
    } catch { /* 文件夹可能已存在，忽略 */ }

    window.open(`/dev-studio?from_skill=${selectedSkill.id}`, "_blank");
  }

  const showAssetEditor = selectedFile?.fileType === "asset" && selectedSkill !== null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b-2 border-[#1A202C] bg-[#EBF4F7] px-4 py-2.5 flex items-center gap-3">
        <SkillIcon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">Skill Studio</span>
        <span className="text-[8px] text-gray-400 font-mono ml-2">
          {selectedFile?.fileType === "asset"
            ? `${selectedSkill?.name ?? ""} / ${(selectedFile as { filename: string }).filename}`
            : selectedSkill
              ? `正在编辑：${selectedSkill.name} / SKILL.md`
              : isNew
                ? "新建 Skill"
                : "选择或新建 Skill 开始"}
        </span>
        <div className="ml-auto" />
      </div>

      {/* 工程文件区共用提示 */}
      <div className="flex-shrink-0 px-4 py-1 bg-violet-50 border-b border-violet-200 text-[9px] text-violet-600 font-mono flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 bg-violet-400 rounded-full inline-block" />
        当前与 OpenCode 共用个人工程文件区
      </div>

      {/* 沙盒报告入口提示 */}
      {fromSandbox && sandboxReportId && (
        <div className="flex-shrink-0 px-4 py-1.5 bg-amber-50 border-b-2 border-amber-300 text-[9px] flex items-center gap-2">
          <span className="text-amber-700 font-bold">
            来源：沙盒报告 #{sandboxReportId}
          </span>
          {memoSyncError && (
            <>
              <span className="text-red-500 font-bold ml-2">{memoSyncError}</span>
              <button
                onClick={handleRetryMemoSync}
                disabled={retryingMemoSync || !sandboxSessionId}
                className="text-[8px] font-bold text-[#00A3C4] border border-[#00A3C4] px-2 py-0.5 hover:bg-[#00A3C4] hover:text-white disabled:opacity-50 ml-1"
              >
                {retryingMemoSync ? "同步中..." : "重试同步"}
              </button>
            </>
          )}
          {!memoSyncError && memo?.lifecycle_stage === "fixing" && (
            <span className="text-[#00CC99] font-bold ml-2">已进入整改模式</span>
          )}
        </div>
      )}

      {/* Three-column body */}
      <div className="flex-1 flex overflow-hidden">
        <SkillList
          skills={skills}
          loading={skillsLoading}
          selectedFile={selectedFile}
          refreshCounter={skillRefreshCounter}
          onSelectFile={(f) => {
            setSelectedFile(f);
            setIsNew(false);
          }}
          onNew={handleNew}
          onImport={() => setShowImportModal(true)}
          onRefreshSkill={refreshSkill}
          onAdoptSuggestion={handleAdoptSuggestion}
        />

        {showAssetEditor && selectedSkill ? (
          <AssetFileEditor
            skill={selectedSkill}
            filename={(selectedFile as { filename: string }).filename}
            onDeleted={() => {
              refreshSkill(selectedSkill.id);
              setSelectedFile({ skillId: selectedSkill.id, fileType: "prompt" });
            }}
            onFileSaved={handleFileSaved}
          />
        ) : (
          <PromptEditor
            skill={selectedSkill}
            isNew={isNew}
            prompt={prompt}
            externalName={externalName}
            pendingDiffBase={pendingDiffBase}
            saveRef={editorSaveRef}
            onPromptChange={setPrompt}
            onSaved={handleSaved}
            onFork={handleFork}
            onFileSaved={handleFileSaved}
          />
        )}

        <StudioChat
          convId={convId}
          skillId={selectedSkill?.id ?? null}
          currentPrompt={prompt}
          editorIsDirty={editorIsDirty}
          selectedSourceFile={selectedFile?.fileType === "asset" ? (selectedFile as { filename: string }).filename : null}
          allSkills={allPublishedSkills}
          memo={memo}
          onApplyDraft={handleApplyDraft}
          onNewSession={handleNewSession}
          onToolBound={() => { if (selectedSkill) { refreshSkill(selectedSkill.id); handleMemoRefresh(); } }}
          onDevStudio={handleDevStudioJump}
          onFileSplitDone={() => { if (selectedSkill) refreshSkill(selectedSkill.id); }}
          onMemoRefresh={handleMemoRefresh}
          onOpenSandbox={(id) => setShowSandbox(id)}
          onEditorTarget={handleEditorTarget}
          clearRef={clearChatRef}
          setInputRef={setInputRef}
          onViewReport={selectedFile?.skillId ? () => setShowSandbox(selectedFile.skillId) : undefined}
          sandboxReportId={fromSandbox ? sandboxReportId : undefined}
        />
      </div>

      {/* Import modal */}
      {showSandbox && (
        <SandboxTestModal
          type="skill"
          id={showSandbox}
          name={skills.find(s => s.id === showSandbox)?.name ?? ""}
          onPassed={() => { setShowSandbox(null); handleMemoRefresh(); }}
          onCancel={() => { setShowSandbox(null); handleMemoRefresh(); }}
          onImportToStudio={() => {
            // 1. 关闭弹窗
            setShowSandbox(null);
            // 2. 刷新 memo（会自动加载 fixing 状态的 fix tasks）
            handleMemoRefresh();
            // 3. 确保 Skill 被选中并打开 prompt 编辑器
            const sandboxSkillId = showSandbox;
            if (sandboxSkillId) {
              setSelectedFile({ skillId: sandboxSkillId, fileType: "prompt" });
            }
          }}
        />
      )}

      {showImportModal && (
        <ImportSkillModal
          onImported={(skill) => {
            setShowImportModal(false);
            handleSaved(skill as SkillDetail);
            // Trigger memo analyze-import for the imported skill
            const imported = skill as SkillDetail;
            apiFetch(`/skills/${imported.id}/memo/analyze-import`, {
              method: "POST",
              body: JSON.stringify({ trigger: "import_zip" }),
            }).then(() => {
              if (imported.id) fetchMemo(imported.id);
            }).catch(() => {});
          }}
          onCancel={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}
