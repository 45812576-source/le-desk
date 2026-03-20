"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Paperclip, Mic, MicOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useVoiceTranscription } from "@/lib/use-voice-transcription";
import type { ToolManifestDataSource } from "@/lib/types";

interface SkillOption {
  id: number;
  name: string;
  description?: string;
}

interface ToolOption {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  tool_type?: string;
  config?: { manifest?: { data_sources?: ToolManifestDataSource[] } };
}

interface ChatInputProps {
  onSend: (content: string, file?: File, toolId?: number, multiFiles?: Record<string, File>) => void;
  disabled?: boolean;
  quote?: string | null;
  onClearQuote?: () => void;
  workspaceSkills?: SkillOption[];
  activeSkill?: { id: number; name: string } | null;
  onSelectSkill?: (skill: SkillOption | null) => void;
  workspaceTools?: ToolOption[];
  prefill?: string | null;
  onClearPrefill?: () => void;
}

const ALLOWED_EXTS = [".txt", ".pdf", ".docx", ".pptx", ".md", ".xlsx", ".xls", ".csv",
  ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".mp3", ".wav", ".m4a", ".ogg", ".flac"];
const isAllowedFile = (f: File) =>
  ALLOWED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)) || f.type.startsWith("image/");

interface KbSuggestion {
  knowledge_id: number;
  title: string;
  text: string;
}

interface KbMention {
  id: number;
  title: string;
}

// 折叠显示：取前两行 + 总行数
function quotePreview(text: string) {
  const lines = text.split("\n").filter((l) => l.trim());
  const preview = lines.slice(0, 2).join(" ").slice(0, 80);
  const more = lines.length > 2 ? ` +${lines.length - 2} lines` : lines[0]?.length > 80 ? "..." : "";
  return { preview, more, total: lines.length };
}

export function ChatInput({ onSend, disabled, quote, onClearQuote, workspaceSkills = [], activeSkill, onSelectSkill, workspaceTools = [], prefill, onClearPrefill }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // 多文件拼盘：key = data_source.key, value = File
  const [multiFiles, setMultiFiles] = useState<Record<string, File>>({});
  const [mentions, setMentions] = useState<KbMention[]>([]);
  const [atQuery, setAtQuery] = useState<string | null>(null); // null = 未激活
  const [suggestions, setSuggestions] = useState<KbSuggestion[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const localSubmitting = false;
  const [hashQuery, setHashQuery] = useState<string | null>(null); // # 触发 skill/tool 选择
  const [skillActiveIdx, setSkillActiveIdx] = useState(0);
  const [activeTool, setActiveTool] = useState<{ id: number; display_name: string; config?: ToolOption["config"] } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const voice = useVoiceTranscription();
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const { theme } = useTheme();
  const isLab = theme === "lab";

  // 语音转录：实时同步 transcript 到输入框
  useEffect(() => {
    if (voice.transcript) {
      setValue(voice.transcript);
    }
  }, [voice.transcript]);

  // 语音错误：3 秒后自动消失
  useEffect(() => {
    if (voice.error) {
      setVoiceError(voice.error);
      const t = setTimeout(() => setVoiceError(null), 3000);
      return () => clearTimeout(t);
    }
  }, [voice.error]);

  // 预填：收到 prefill 时填入输入框并 focus
  useEffect(() => {
    if (!prefill) return;
    setValue(prefill);
    onClearPrefill?.();
    setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }, 0);
  }, [prefill, onClearPrefill]);

  // 监听输入，检测 @ / # 触发
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);

    const cursor = e.target.selectionStart ?? v.length;
    const before = v.slice(0, cursor);

    // # 触发 skill 选择
    const hashIdx = before.lastIndexOf("#");
    if (hashIdx !== -1) {
      const query = before.slice(hashIdx + 1);
      if (!query.includes(" ") && !query.includes("\n")) {
        setHashQuery(query);
        setSkillActiveIdx(0);
        setAtQuery(null);
        setSuggestions([]);
        return;
      }
    }
    setHashQuery(null);

    // @ 触发知识库
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1) {
      const query = before.slice(atIdx + 1);
      if (!query.includes(" ") && !query.includes("\n")) {
        setAtQuery(query);
        setActiveIdx(0);
        return;
      }
    }
    setAtQuery(null);
    setSuggestions([]);
  }

  // 搜索知识库
  useEffect(() => {
    if (atQuery === null) return;
    const ctrl = new AbortController();
    const search = async () => {
      setLoadingSuggest(true);
      try {
        const params = new URLSearchParams({ limit: "8" });
        if (atQuery) params.set("q", atQuery);
        const data = await apiFetch<KbSuggestion[]>(`/knowledge/chunks/search?${params}`);
        // 去重：同一 knowledge_id 只取第一条
        const seen = new Set<number>();
        const unique = data.filter((d) => {
          if (seen.has(d.knowledge_id)) return false;
          seen.add(d.knowledge_id);
          return true;
        });
        setSuggestions(unique.slice(0, 6));
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggest(false);
      }
    };
    const timer = setTimeout(search, 200);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [atQuery]);

  function selectSuggestion(s: KbSuggestion) {
    // 避免重复引用同一条目
    if (mentions.some((m) => m.id === s.knowledge_id)) {
      closeDropdown();
      return;
    }

    // 把 textarea 里 @query 部分删掉
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    const newValue = value.slice(0, atIdx) + value.slice(cursor);
    setValue(newValue);

    setMentions((prev) => [...prev, { id: s.knowledge_id, title: s.title }]);
    closeDropdown();

    // 焦点回到 textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const pos = atIdx;
      textareaRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }

  function closeDropdown() {
    setAtQuery(null);
    setSuggestions([]);
  }

  function selectSkill(skill: SkillOption) {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const hashIdx = before.lastIndexOf("#");
    const newValue = value.slice(0, hashIdx) + value.slice(cursor);
    setValue(newValue);
    setHashQuery(null);
    onSelectSkill?.(skill);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(hashIdx, hashIdx);
    }, 0);
  }

  function selectTool(tool: ToolOption) {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const hashIdx = before.lastIndexOf("#");
    const newValue = value.slice(0, hashIdx) + value.slice(cursor);
    setValue(newValue);
    setHashQuery(null);
    setActiveTool({ id: tool.id, display_name: tool.display_name, config: tool.config });
    setMultiFiles({});
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(hashIdx, hashIdx);
    }, 0);
  }

  function removeMention(id: number) {
    setMentions((prev) => prev.filter((m) => m.id !== id));
  }

  function buildQuotePrefix() {
    if (!quote) return "";
    return `[Pasted text #1${quote.split("\n").filter((l) => l.trim()).length > 1 ? ` +${quote.split("\n").filter((l) => l.trim()).length - 1} lines` : ""}]\n${quote}\n\n`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if ((!trimmed && !file && mentions.length === 0 && !quote) || disabled || localSubmitting) return;

    const quotePrefix = buildQuotePrefix();

    const pendingToolId = activeTool?.id;

    // 多文件拼盘：工具有 uploaded_file 数据源时走多文件路径
    const uploadSources = activeTool?.config?.manifest?.data_sources?.filter(
      (ds) => ds.type === "uploaded_file"
    ) ?? [];
    const isMultiUpload = uploadSources.length > 1;

    if (isMultiUpload) {
      const requiredKeys = uploadSources.filter((ds) => ds.required !== false).map((ds) => ds.key);
      const missingRequired = requiredKeys.filter((k) => !multiFiles[k]);
      if (missingRequired.length > 0) return; // 必填未全部填入，不允许发送
      onSend((quotePrefix + trimmed).trim(), undefined, pendingToolId, multiFiles);
      setValue("");
      setFile(null);
      setMultiFiles({});
      setMentions([]);
      setActiveTool(null);
      onClearQuote?.();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }

    if (file) {
      onSend((quotePrefix + trimmed).trim(), file, pendingToolId);
      setValue("");
      setFile(null);
      setMultiFiles({});
      setMentions([]);
      setActiveTool(null);
      onClearQuote?.();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      return;
    }

    // 有 @ 引用：先立即发送（气泡先显示），后台拉 summary 追加
    if (mentions.length > 0) {
      const baseContent = quotePrefix + (trimmed ? trimmed : "");
      // 先立即发送，让用户气泡先出现
      onSend(baseContent, undefined, pendingToolId);
    } else {
      onSend(quotePrefix + trimmed, undefined, pendingToolId);
    }

    setValue("");
    setFile(null);
    setMultiFiles({});
    setMentions([]);
    setActiveTool(null);
    onClearQuote?.();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // # skill/tool 下拉键盘导航
    if (hashQuery !== null && hashTotalItems > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSkillActiveIdx((i) => (i + 1) % hashTotalItems); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSkillActiveIdx((i) => (i - 1 + hashTotalItems) % hashTotalItems); return; }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (skillActiveIdx < filteredSkills.length) {
          selectSkill(filteredSkills[skillActiveIdx]);
        } else {
          selectTool(filteredTools[skillActiveIdx - filteredSkills.length]);
        }
        return;
      }
      if (e.key === "Escape") { setHashQuery(null); return; }
    }

    // 下拉激活时，用方向键 + Enter 选择
    if (atQuery !== null && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        selectSuggestion(suggestions[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        closeDropdown();
        return;
      }
    }

    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && isAllowedFile(f)) setFile(f);
    e.target.value = "";
  }, []);

  const filteredSkills = hashQuery !== null
    ? workspaceSkills.filter((s) => s.name.toLowerCase().includes(hashQuery.toLowerCase()))
    : [];
  const filteredTools = hashQuery !== null
    ? workspaceTools.filter((t) =>
        t.display_name.toLowerCase().includes(hashQuery.toLowerCase()) ||
        t.name.toLowerCase().includes(hashQuery.toLowerCase())
      )
    : [];
  const hashTotalItems = filteredSkills.length + filteredTools.length;
  const showSkillDropdown = hashQuery !== null && (workspaceSkills.length > 0 || workspaceTools.length > 0);
  const showDropdown = atQuery !== null && (suggestions.length > 0 || loadingSuggest);
  const isBlocked = disabled || localSubmitting;
  const uploadSources = activeTool?.config?.manifest?.data_sources?.filter((ds) => ds.type === "uploaded_file") ?? [];
  const isMultiUpload = uploadSources.length > 1;
  const requiredUploadKeys = uploadSources.filter((ds) => ds.required !== false).map((ds) => ds.key);
  const multiUploadReady = !isMultiUpload || requiredUploadKeys.every((k) => !!multiFiles[k]);
  const canSend = !isBlocked && multiUploadReady && (value.trim() || file || mentions.length > 0 || !!quote || (isMultiUpload && Object.keys(multiFiles).length > 0));

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t-2 border-[#1A202C] px-4 py-3 flex flex-col gap-2"
      style={{ backgroundColor: "var(--card)" }}
    >
      {/* Chips 区域：对话引用 + Skill + Tool + @ 引用 + 文件 */}
      {(quote || activeSkill || activeTool || mentions.length > 0 || file) && (
        <div className="flex flex-wrap gap-1.5">
          {/* 对话气泡引用 chip */}
          {quote && (() => {
            const { preview, more } = quotePreview(quote);
            return (
              <div className="flex items-center gap-1.5 px-2 py-1 border-2 border-gray-400 bg-gray-100 max-w-full">
                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wide shrink-0">引用</span>
                <span className="text-[9px] text-gray-600 truncate max-w-[200px]">{preview}</span>
                {more && <span className="text-[8px] text-gray-400 shrink-0">{more}</span>}
                <button
                  type="button"
                  onClick={onClearQuote}
                  className="text-gray-400 hover:text-red-500 text-xs font-bold leading-none ml-0.5 shrink-0"
                >
                  ×
                </button>
              </div>
            );
          })()}
          {/* 当前 Skill chip */}
          {activeSkill && (
            <div className="flex items-center gap-1.5 px-2 py-1 border-2 border-[#1A202C] bg-[#1A202C]">
              <span className="text-[8px] font-bold text-[#00D1FF] uppercase tracking-wide shrink-0">#</span>
              <span className="text-[9px] font-bold text-white max-w-[160px] truncate">{activeSkill.name}</span>
              <button
                type="button"
                onClick={() => onSelectSkill?.(null)}
                className="text-gray-400 hover:text-red-400 text-xs font-bold leading-none ml-0.5 shrink-0"
              >
                ×
              </button>
            </div>
          )}
          {/* 当前 Tool chip（临时，发送后清除）*/}
          {activeTool && (
            <div className="flex items-center gap-1.5 px-2 py-1 border-2 border-[#00CC99] bg-[#00CC99]/10">
              <span className="text-[8px] font-bold text-[#00CC99] uppercase tracking-wide shrink-0">工具</span>
              <span className="text-[9px] font-bold text-[#1A202C] max-w-[160px] truncate">{activeTool.display_name}</span>
              <button
                type="button"
                onClick={() => { setActiveTool(null); setMultiFiles({}); }}
                className="text-[#00CC99] hover:text-red-500 text-xs font-bold leading-none ml-0.5 shrink-0"
              >
                ×
              </button>
            </div>
          )}
          {mentions.map((m) => (
            <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 border-2 border-[#00A3C4] bg-[#CCF2FF]">
              <span className="text-[9px] font-bold text-[#00A3C4] uppercase tracking-wide">@</span>
              <span className="text-[9px] font-bold text-[#1A202C] max-w-[160px] truncate">{m.title}</span>
              <button
                type="button"
                onClick={() => removeMention(m.id)}
                className="text-[#00A3C4] hover:text-red-500 text-xs font-bold leading-none ml-0.5"
              >
                ×
              </button>
            </div>
          ))}
          {file && (
            <div className="flex items-center gap-1.5 px-2 py-1 border-2 border-[#00D1FF] bg-[#CCF2FF]">
              <span className="text-[9px] font-bold text-[#1A202C] max-w-[200px] truncate">📎 {file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-[#00A3C4] hover:text-red-500 text-xs font-bold leading-none"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* 多文件拼盘上传台 */}
      {isMultiUpload && (
        <MultiFileBoard
          sources={uploadSources}
          files={multiFiles}
          onChange={setMultiFiles}
          disabled={isBlocked}
        />
      )}

      <div className="flex gap-2 items-end relative">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXTS.join(",")}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* # Skill + Tool 下拉 */}
        {showSkillDropdown && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border-2 border-[#1A202C] shadow-lg z-50 max-h-56 overflow-y-auto">
            {hashTotalItems === 0 ? (
              <div className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                无匹配 Skill / 工具
              </div>
            ) : (
              <>
                {filteredSkills.length > 0 && (
                  <>
                    <div className="px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">
                      Skill
                    </div>
                    {filteredSkills.map((s, i) => (
                      <button
                        key={`skill-${s.id}`}
                        type="button"
                        onClick={() => selectSkill(s)}
                        className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 border-b border-gray-100 last:border-0 transition-colors ${
                          i === skillActiveIdx ? "bg-[#1A202C] text-white" : "hover:bg-gray-50"
                        }`}
                      >
                        <span className={`text-[10px] font-bold truncate flex items-center gap-1 ${i === skillActiveIdx ? "text-white" : "text-[#1A202C]"}`}>
                          <span className="text-[#00D1FF]">#</span>{s.name}
                        </span>
                        {s.description && (
                          <span className={`text-[9px] line-clamp-1 ${i === skillActiveIdx ? "text-gray-300" : "text-gray-400"}`}>
                            {s.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </>
                )}
                {filteredTools.length > 0 && (
                  <>
                    <div className="px-3 py-1 text-[8px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100">
                      工具
                    </div>
                    {filteredTools.map((t, i) => {
                      const globalIdx = filteredSkills.length + i;
                      return (
                        <button
                          key={`tool-${t.id}`}
                          type="button"
                          onClick={() => selectTool(t)}
                          className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 border-b border-gray-100 last:border-0 transition-colors ${
                            globalIdx === skillActiveIdx ? "bg-[#00CC99] text-white" : "hover:bg-gray-50"
                          }`}
                        >
                          <span className={`text-[10px] font-bold truncate flex items-center gap-1 ${globalIdx === skillActiveIdx ? "text-white" : "text-[#1A202C]"}`}>
                            <span className={globalIdx === skillActiveIdx ? "text-white" : "text-[#00CC99]"}>⚙</span>{t.display_name}
                          </span>
                          {t.description && (
                            <span className={`text-[9px] line-clamp-1 ${globalIdx === skillActiveIdx ? "text-white/70" : "text-gray-400"}`}>
                              {t.description}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* @ 提及下拉 */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full left-0 right-0 mb-1 bg-white border-2 border-[#1A202C] shadow-lg z-50 max-h-56 overflow-y-auto"
          >
            {loadingSuggest && suggestions.length === 0 ? (
              <div className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                搜索中...
              </div>
            ) : (
              suggestions.map((s, i) => (
                <button
                  key={`${s.knowledge_id}-${i}`}
                  type="button"
                  onClick={() => selectSuggestion(s)}
                  className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 border-b border-gray-100 last:border-0 transition-colors ${
                    i === activeIdx ? "bg-[#CCF2FF]" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="text-[10px] font-bold text-[#1A202C] truncate">{s.title}</span>
                  <span className="text-[9px] text-gray-400 line-clamp-1">{s.text}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* 📎 button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBlocked}
          title="上传文件（PDF/Word/PPT/Excel/TXT/图片/音频）"
          className={`flex-shrink-0 w-9 h-9 border-2 border-[#1A202C] flex items-center justify-center disabled:opacity-40 transition-colors ${
            isLab ? "bg-white text-[#1A202C] hover:bg-gray-100" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
          }`}
        >
          <Paperclip size={isLab ? 14 : 16} strokeWidth={isLab ? 2.5 : 2} />
        </button>

        {/* 🎤 麦克风按钮 */}
        <button
          type="button"
          onClick={() => {
            if (voice.isRecording) {
              voice.stop();
            } else {
              voice.start();
            }
          }}
          disabled={isBlocked}
          title={voice.isRecording ? "停止录音" : "语音输入"}
          className={`flex-shrink-0 w-9 h-9 border-2 border-[#1A202C] flex items-center justify-center transition-colors disabled:opacity-40 ${
            voice.isRecording
              ? "bg-red-500 text-white animate-pulse" + (isLab ? "" : " rounded-md")
              : isLab
                ? "bg-white text-[#1A202C] hover:bg-gray-100"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground rounded-md"
          }`}
        >
          {voice.isRecording
            ? <MicOff size={isLab ? 14 : 16} strokeWidth={isLab ? 2.5 : 2} />
            : <Mic size={isLab ? 14 : 16} strokeWidth={isLab ? 2.5 : 2} />
          }
        </button>

        <div className="flex-1 flex flex-col gap-1">
          {voiceError && (
            <div className="text-[9px] font-bold text-red-500 px-1">{voiceError}</div>
          )}
          <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={localSubmitting ? "正在获取知识摘要..." : file ? "补充说明（可选）" : "输入消息，@ 引用知识库，Enter 换行，Ctrl+Enter 发送"}
          rows={1}
          disabled={isBlocked}
          className={`w-full border-2 border-[#1A202C] px-3 py-2 text-xs font-bold resize-none focus:outline-none focus:border-[#00D1FF] disabled:opacity-40 ${isLab ? "" : "rounded-md"}`}
          style={{ minHeight: 36, maxHeight: 120, backgroundColor: "var(--card)", color: "var(--foreground)" }}
        />
        </div>
        <button
          type="submit"
          disabled={!canSend}
          className={`flex-shrink-0 px-4 py-2 text-[10px] font-bold uppercase tracking-wide border-2 border-[#1A202C] transition-colors disabled:opacity-40 ${
            isLab
              ? "bg-[#1A202C] text-white hover:bg-black"
              : "bg-primary text-primary-foreground hover:opacity-90 rounded-md"
          }`}
        >
          {localSubmitting ? "获取中..." : "发送"}
        </button>
      </div>
    </form>
  );
}

// ─── MultiFileBoard ────────────────────────────────────────────────────────────

function requiredNotFilled(sources: ToolManifestDataSource[], files: Record<string, File>) {
  return sources
    .filter((ds) => ds.required !== false && !files[ds.key])
    .map((ds) => ds.key);
}

const DS_ACCEPT_MAP: Record<string, string> = {
  ".xls": ".xlsx,.xls",
};

function MultiFileBoard({
  sources,
  files,
  onChange,
  disabled,
}: {
  sources: ToolManifestDataSource[];
  files: Record<string, File>;
  onChange: (files: Record<string, File>) => void;
  disabled: boolean;
}) {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function handleFile(key: string, file: File) {
    onChange({ ...files, [key]: file });
  }

  function removeFile(key: string) {
    const next = { ...files };
    delete next[key];
    onChange(next);
  }

  function buildAccept(ds: ToolManifestDataSource) {
    if (!ds.accept?.length) return "*";
    return ds.accept.map((a) => DS_ACCEPT_MAP[a] ?? a).join(",");
  }

  return (
    <div className="border-2 border-[#00CC99] bg-[#00CC99]/5 p-3 mb-1">
      <div className="text-[8px] font-bold uppercase tracking-widest text-[#00CC99] mb-2">
        此工具需要以下数据文件
      </div>
      <div className="flex flex-wrap gap-2">
        {sources.map((ds) => {
          const filled = !!files[ds.key];
          const isRequired = ds.required !== false;

          return (
            <div key={ds.key} className="relative group">
              {/* Slot */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOverKey(ds.key); }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverKey(null);
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(ds.key, f);
                }}
                onClick={() => !disabled && inputRefs.current[ds.key]?.click()}
                className={`relative w-32 h-20 border-2 flex flex-col items-center justify-center cursor-pointer transition-colors select-none ${
                  disabled ? "opacity-40 cursor-not-allowed" :
                  dragOverKey === ds.key ? "border-[#00D1FF] bg-[#CCF2FF]/40" :
                  filled ? "border-[#00CC99] bg-[#CCFFF0]/60" :
                  isRequired ? "border-dashed border-[#1A202C] hover:border-[#00CC99] hover:bg-[#00CC99]/5" :
                  "border-dashed border-gray-300 hover:border-[#00A3C4] hover:bg-[#CCF2FF]/20"
                }`}
              >
                <input
                  ref={(el) => { inputRefs.current[ds.key] = el; }}
                  type="file"
                  accept={buildAccept(ds)}
                  className="hidden"
                  disabled={disabled}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(ds.key, f);
                    e.target.value = "";
                  }}
                />

                {filled ? (
                  <>
                    <span className="text-lg mb-0.5">📄</span>
                    <span className="text-[8px] font-bold text-[#1A202C] text-center px-1 leading-tight line-clamp-2 max-w-full">
                      {files[ds.key].name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeFile(ds.key); }}
                      className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center border border-gray-300 bg-white text-[8px] font-bold text-gray-400 hover:text-red-500 hover:border-red-300"
                    >
                      ×
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-lg mb-0.5 opacity-30">📂</span>
                    <span className="text-[8px] font-bold text-gray-400 text-center px-1 leading-tight">
                      {ds.key}
                    </span>
                    {isRequired && (
                      <span className="text-[7px] text-red-400 font-bold uppercase mt-0.5">必填</span>
                    )}
                  </>
                )}
              </div>

              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-48 border-2 border-[#1A202C] bg-white shadow-lg p-2">
                <div className="text-[8px] font-bold text-[#1A202C] mb-1 uppercase tracking-wide">{ds.key}</div>
                {ds.description && (
                  <div className="text-[8px] text-gray-500 mb-1">{ds.description}</div>
                )}
                {ds.accept && ds.accept.length > 0 && (
                  <div className="text-[7px] font-mono text-[#00A3C4]">接受格式：{ds.accept.join("  ")}</div>
                )}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#1A202C]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 进度提示 */}
      <div className="mt-2 text-[8px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-2">
        <span>{Object.keys(files).length} / {sources.length} 已上传</span>
        {requiredNotFilled(sources, files).length > 0 && (
          <span className="text-red-400">
            还需：{requiredNotFilled(sources, files).join("、")}
          </span>
        )}
        {requiredNotFilled(sources, files).length === 0 && Object.keys(files).length > 0 && (
          <span className="text-[#00CC99]">✓ 可以发送</span>
        )}
      </div>
    </div>
  );
}
