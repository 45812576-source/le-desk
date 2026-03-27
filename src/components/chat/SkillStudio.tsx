"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, File, FileCode, Upload, Trash2, Zap } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch, getToken } from "@/lib/api";
import type { SkillDetail, SkillVersion } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { ICONS, PixelIcon } from "@/components/pixel";

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

interface StudioDiff {
  system_prompt?: { old: string; new: string };
  [key: string]: unknown;
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

// ─── Left panel ───────────────────────────────────────────────────────────────

function SkillList({
  skills,
  loading,
  selectedFile,
  onSelectFile,
  onNew,
  onRefreshSkill,
}: {
  skills: SkillDetail[];
  loading: boolean;
  selectedFile: SelectedFile | null;
  onSelectFile: (f: SelectedFile) => void;
  onNew: () => void;
  onRefreshSkill: (skillId: number) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);

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
        </button>

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

            {/* Asset files */}
            {assetFiles.map((f) => {
              const isSelected =
                isThisSkillSelected &&
                selectedFile?.fileType === "asset" &&
                (selectedFile as { filename: string }).filename === f.filename;
              return (
                <div
                  key={f.filename}
                  className={`w-full flex items-center gap-1.5 pl-7 pr-2 py-1.5 transition-colors group ${
                    isSelected ? "bg-[#CCF2FF]" : "hover:bg-[#F0F4F8]"
                  }`}
                >
                  <button
                    className="flex-1 flex items-center gap-1.5 min-w-0 text-left"
                    onClick={() => onSelectFile({ skillId: skill.id, fileType: "asset", filename: f.filename })}
                  >
                    <FileCode size={9} className={`flex-shrink-0 ${isSelected ? "text-[#00A3C4]" : "text-gray-400"}`} />
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
            })}

            {/* Upload button */}
            {!isReadOnly && (
              <div className="pl-7 pr-3 py-1.5">
                <button
                  onClick={() => {
                    setUploadingFor(skill.id);
                    uploadInputRef.current?.click();
                  }}
                  className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] transition-colors"
                >
                  <Upload size={8} />
                  上传附属文件
                </button>
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
        <PixelButton size="sm" onClick={onNew}>+ 新建</PixelButton>
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
  let newNum = 0, oldNum = 0;
  const LINE_H = 20;

  return (
    <div className="flex-1 overflow-auto border-2 border-[#1A202C] bg-white font-mono text-[10px] min-h-0">
      {diff.map((line, i) => {
        let bgClass = "", textClass = "text-[#1A202C]", indClass = "text-gray-200", ind = " ", lineNum = "";
        if (line.type === "unchanged") {
          oldNum++; newNum++;
          lineNum = String(newNum);
        } else if (line.type === "added") {
          newNum++;
          bgClass = "bg-green-50"; textClass = "text-green-900"; indClass = "text-green-600 font-bold"; ind = "+"; lineNum = String(newNum);
        } else {
          oldNum++;
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
}: {
  skill: SkillDetail;
  filename: string;
  onDeleted: () => void;
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

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0 w-0 flex-[1]">
      {isReadOnly && (
        <div className="px-4 py-2 bg-amber-50 border-b-2 border-amber-300 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">已发布（只读）</span>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-[#1A202C] flex items-center gap-3 flex-shrink-0">
        <FileCode size={12} className="text-[#00A3C4] flex-shrink-0" />
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
      }
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "保存失败");
    } finally { setSaving(false); }
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
              <button onClick={() => setShowVersions((v) => !v)}
                className="text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4]">
                {showVersions ? "▲ 收起历史" : "▼ 版本历史"}
              </button>
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
          {saveMsg && (
            <span className={`text-[9px] font-bold ${saveMsg.startsWith("✓") ? "text-[#00CC99]" : "text-red-500"}`}>{saveMsg}</span>
          )}
        </div>
      )}
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

// ─── Right panel (Studio Chat) ─────────────────────────────────────────────────

function StudioChat({
  convId,
  skillId,
  currentPrompt,
  allSkills,
  onApplyDraft,
}: {
  convId: number;
  skillId: number | null;
  currentPrompt: string;
  allSkills: SkillDetail[];
  onApplyDraft: (draft: StudioDraft) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<StudioDraft | null>(null);
  const [studioConvId, setStudioConvId] = useState<number | null>(null);

  const [hashQuery, setHashQuery] = useState<string | null>(null);
  const [hashActiveIdx, setHashActiveIdx] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  async function ensureConv(): Promise<number> {
    if (studioConvId) return studioConvId;
    const workspaces = await apiFetch<{ id: number; workspace_type: string }[]>("/workspaces");
    const studioWs = workspaces.find((ws) => ws.workspace_type === "skill_studio");
    if (studioWs) {
      const newConv = await apiFetch<{ id: number }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ workspace_id: studioWs.id }),
      });
      setStudioConvId(newConv.id);
      return newConv.id;
    }
    return convId;
  }

  async function send(userText: string) {
    if (!userText.trim() || streaming) return;
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setStreaming(true);
    setInput("");

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const token = getToken();

    try {
      const targetConvId = await ensureConv();
      const resp = await fetch(`/api/proxy/conversations/${targetConvId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: userText }),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: `发送失败 (${resp.status})` }]);
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buf = "", accText = "", curEvt = "delta";
      let msgIdx = -1;
      setMessages((prev) => { msgIdx = prev.length; return [...prev, { role: "assistant", text: "", loading: true }]; });

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
              if (curEvt === "studio_draft") {
                setPendingDraft(data as StudioDraft);
              } else if (curEvt === "studio_diff") {
                const diff = data as StudioDiff;
                if (diff.system_prompt?.new) {
                  setPendingDraft({ system_prompt: diff.system_prompt.new, change_note: "AI 建议修改" });
                }
              } else if ((curEvt === "delta" || curEvt === "content_block_delta") && data.text) {
                accText += data.text;
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
        setMessages((prev) => [...prev, { role: "assistant", text: "连接中断" }]);
      }
    } finally {
      setStreaming(false);
    }
  }

  function handleApplyDraft() {
    if (!pendingDraft) return;
    onApplyDraft(pendingDraft);
    setPendingDraft(null);
  }

  return (
    <div className="flex flex-col flex-[1] min-w-0 border-l-2 border-[#1A202C] bg-white">
      {/* Header */}
      <div className="px-3 py-2.5 border-b-2 border-[#1A202C] flex items-center gap-2 flex-shrink-0 bg-[#EBF4F7]">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] flex-1">Studio Chat</span>
        {messages.length > 0 && (
          <button
            onClick={() => {
              abortRef.current?.abort();
              setMessages([]);
              setStreaming(false);
              setStudioConvId(null);
              setPendingDraft(null);
            }}
            className="text-[8px] font-bold uppercase text-gray-400 hover:text-red-400 transition-colors"
          >
            清除对话
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[9px] text-gray-400 font-bold uppercase text-center">
              描述你想创建或修改的 Skill<br />
              <span className="text-gray-300 normal-case font-normal">说"帮我测试"可以触发测试</span>
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[95%] px-2.5 py-2 text-[9px] font-mono leading-relaxed whitespace-pre-wrap border ${
              m.role === "user" ? "bg-[#1A202C] text-white border-[#1A202C]" : "bg-[#F0F4F8] text-[#1A202C] border-gray-200"
            }`}>
              {m.loading && !m.text ? (
                <span className="animate-pulse text-[#00A3C4]">▋</span>
              ) : (
                <>
                  {m.text}
                  {m.loading && <span className="animate-pulse text-[#00A3C4]">▋</span>}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pending draft card */}
      {pendingDraft && (
        <DraftCard
          draft={pendingDraft}
          currentPrompt={currentPrompt}
          onApply={handleApplyDraft}
          onDiscard={() => setPendingDraft(null)}
        />
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

export function SkillStudio({ convId }: { convId: number }) {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isNew, setIsNew] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [externalName, setExternalName] = useState<string | null>(null);
  const [pendingDiffBase, setPendingDiffBase] = useState<string | null>(null);
  const editorSaveRef = useRef<(() => void) | null>(null);

  const selectedSkill = selectedFile
    ? (skills.find((s) => s.id === selectedFile.skillId) ?? null)
    : null;

  const fetchSkills = useCallback(() => {
    setSkillsLoading(true);
    apiFetch<SkillDetail[]>("/skills?mine=true")
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]))
      .finally(() => setSkillsLoading(false));
  }, []);

  async function refreshSkill(skillId: number) {
    try {
      const updated = await apiFetch<SkillDetail>(`/skills/${skillId}`);
      setSkills((prev) => prev.map((s) => s.id === skillId ? { ...s, source_files: updated.source_files } : s));
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

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  function handleNew() {
    setSelectedFile(null);
    setIsNew(true);
    setPrompt("");
  }

  function handleSaved(skill: SkillDetail) {
    setSelectedFile({ skillId: skill.id, fileType: "prompt" });
    setIsNew(false);
    fetchSkills();
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

      {/* Three-column body */}
      <div className="flex-1 flex overflow-hidden">
        <SkillList
          skills={skills}
          loading={skillsLoading}
          selectedFile={selectedFile}
          onSelectFile={(f) => {
            setSelectedFile(f);
            setIsNew(false);
          }}
          onNew={handleNew}
          onRefreshSkill={refreshSkill}
        />

        {showAssetEditor && selectedSkill ? (
          <AssetFileEditor
            skill={selectedSkill}
            filename={(selectedFile as { filename: string }).filename}
            onDeleted={() => {
              refreshSkill(selectedSkill.id);
              setSelectedFile({ skillId: selectedSkill.id, fileType: "prompt" });
            }}
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
          />
        )}

        <StudioChat
          convId={convId}
          skillId={selectedSkill?.id ?? null}
          currentPrompt={prompt}
          allSkills={allPublishedSkills}
          onApplyDraft={handleApplyDraft}
        />
      </div>
    </div>
  );
}
