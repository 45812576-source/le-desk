"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, File, Upload, Trash2, Zap, Plus, Package, X, Search } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch, getToken } from "@/lib/api";
import type { SkillDetail, BoundTool } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { ICONS, PixelIcon } from "@/components/pixel";
import { CommentsPanel, type Suggestion } from "@/components/skill/CommentsPanel";
import { SKILL_STATUS_BADGE as STATUS_BADGE, isEditableSkillStatus, isPublishedSkillStatus, isVisibleInSkillStudio } from "@/lib/skill-status";
import type { SelectedFile, FileCategory } from "./types";
import { CATEGORY_CONFIG, CATEGORY_ORDER, NEW_FILE_TEMPLATES, NEW_FILE_PREFIX, getFileCategory } from "./utils";

export function SkillIcon({ size }: { size: number }) {
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

// ─── SkillList component ──────────────────────────────────────────────────────

export function SkillList({
  skills,
  loading,
  selectedFile,
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

  const visibleSkills = skills.filter((s) => isVisibleInSkillStudio(s.status));
  const drafts = visibleSkills.filter((s) => isEditableSkillStatus(s.status));
  const published = visibleSkills.filter((s) => isPublishedSkillStatus(s.status) || s.status === "archived");

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

    const [showNewFile, setShowNewFile] = useState(false);
    const [newFileCategory, setNewFileCategory] = useState<FileCategory>("knowledge-base");
    const [newFileName, setNewFileName] = useState("");
    const [creating, setCreating] = useState(false);

    const [boundTools, setBoundTools] = useState<BoundTool[]>([]);
    const [showToolBind, setShowToolBind] = useState(false);
    const toolUploadRef = useRef<HTMLInputElement>(null);
    const [uploadingTool, setUploadingTool] = useState(false);

    useEffect(() => {
      if (!isOpen) return;
      apiFetch<BoundTool[]>(`/skills/${skill.id}/bound-tools`)
        .then((data) => setBoundTools(Array.isArray(data) ? data : []))
        .catch(() => setBoundTools([]));
    }, [isOpen, skill.id]);

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

            {/* Bound tools */}
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

            {/* Tool actions */}
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
