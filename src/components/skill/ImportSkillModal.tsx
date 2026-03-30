"use client";

import { useRef, useState } from "react";
import { Upload, FileText, AlertTriangle, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch, getToken } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────────

interface RemovedSection {
  section: string;
  reason: string;
}

interface ConvertResult {
  name: string;
  description: string;
  system_prompt: string;
  original_content: string;
  removed_sections: RemovedSection[];
  warnings: string[];
  has_frontend_content: boolean;
  frontend_detail: string;
  ai_converted: boolean;
}

interface ImportSkillModalProps {
  onImported: (skill: { id: number; name: string }) => void;
  onCancel: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ImportSkillModal({ onImported, onCancel }: ImportSkillModalProps) {
  const [step, setStep] = useState<"input" | "preview" | "saving">("input");
  const [inputMode, setInputMode] = useState<"file" | "paste">("file");
  const [pasteContent, setPasteContent] = useState("");
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [showRemoved, setShowRemoved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleConvert() {
    setConverting(true);
    setConvertError(null);

    try {
      let data: ConvertResult;

      if (inputMode === "file" && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const token = getToken();
        const resp = await fetch("/api/proxy/skills/import-convert", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
          throw new Error(err.detail || `请求失败 (${resp.status})`);
        }
        data = await resp.json();
      } else if (inputMode === "paste" && pasteContent.trim()) {
        // 用 FormData 发送 content 字段
        const formData = new FormData();
        formData.append("content", pasteContent);
        const token = getToken();
        const resp = await fetch("/api/proxy/skills/import-convert", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ detail: `HTTP ${resp.status}` }));
          throw new Error(err.detail || `请求失败 (${resp.status})`);
        }
        data = await resp.json();
      } else {
        throw new Error("请选择文件或输入内容");
      }

      setResult(data);
      setEditName(data.name || "");
      setEditDesc(data.description || "");
      setStep("preview");
    } catch (err) {
      setConvertError(err instanceof Error ? err.message : "转换失败");
    } finally {
      setConverting(false);
    }
  }

  async function handleConfirmImport() {
    if (!result) return;
    setStep("saving");
    setSaveError(null);

    try {
      const created = await apiFetch<{ id: number; name: string }>("/skills", {
        method: "POST",
        body: JSON.stringify({
          name: editName.trim() || result.name,
          description: editDesc.trim() || result.description,
          system_prompt: result.system_prompt,
          mode: "hybrid",
          variables: [],
          auto_inject: true,
        }),
      });
      onImported(created);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "创建失败");
      setStep("preview");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] w-[600px] max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-[#1A202C] bg-[#EBF4F7]">
          <Upload size={12} className="text-[#00A3C4]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            导入外部 Skill
          </span>
          <span className="text-[8px] text-gray-400 ml-2">
            {step === "input" ? "上传或粘贴" : step === "preview" ? "预览确认" : "保存中..."}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* ── Step 1: Input ── */}
          {step === "input" && (
            <>
              {/* Mode tabs */}
              <div className="flex gap-1">
                <button
                  onClick={() => setInputMode("file")}
                  className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 border-2 transition-colors ${
                    inputMode === "file"
                      ? "border-[#00A3C4] bg-[#CCF2FF] text-[#00A3C4]"
                      : "border-gray-300 text-gray-500 hover:border-[#00A3C4]"
                  }`}
                >
                  上传文件
                </button>
                <button
                  onClick={() => setInputMode("paste")}
                  className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 border-2 transition-colors ${
                    inputMode === "paste"
                      ? "border-[#00A3C4] bg-[#CCF2FF] text-[#00A3C4]"
                      : "border-gray-300 text-gray-500 hover:border-[#00A3C4]"
                  }`}
                >
                  粘贴内容
                </button>
              </div>

              {inputMode === "file" ? (
                <div className="space-y-2">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 hover:border-[#00A3C4] transition-colors p-6 text-center cursor-pointer"
                  >
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText size={14} className="text-[#00A3C4]" />
                        <span className="text-[10px] font-bold text-[#1A202C]">{selectedFile.name}</span>
                        <span className="text-[8px] text-gray-400">
                          ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={20} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-[9px] text-gray-400 font-bold">
                          点击选择 .md / .txt / .zip 文件
                        </p>
                        <p className="text-[8px] text-gray-300 mt-1">
                          支持 Claude Code SKILL.md、自定义 markdown、导出的 zip 包
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".md,.txt,.markdown,.zip"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setSelectedFile(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              ) : (
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={"粘贴 Skill 内容...\n\n支持各种格式：\n- 带 frontmatter 的 SKILL.md\n- 纯 prompt 文本\n- Claude Code 社区格式"}
                  rows={12}
                  className="w-full border-2 border-[#1A202C] px-3 py-2 text-[10px] font-mono focus:outline-none focus:border-[#00D1FF] resize-none"
                />
              )}

              {convertError && (
                <div className="border-2 border-red-400 bg-red-50 px-3 py-2 text-[9px] font-bold text-red-500">
                  {convertError}
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Preview ── */}
          {step === "preview" && result && (
            <>
              {/* Frontend warning banner */}
              {result.has_frontend_content && (
                <div className="border-2 border-red-400 bg-red-50 px-3 py-2.5 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[9px] font-bold text-red-600 mb-1">
                      检测到前端相关内容
                    </div>
                    <div className="text-[8px] text-red-500">
                      {result.frontend_detail || "Le Desk 的 tool 不带前端界面，Skill 应专注于数据处理、分析、文案生成等后端能力。"}
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && !result.has_frontend_content && (
                <div className="border-2 border-amber-400 bg-amber-50 px-3 py-2 space-y-1">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="text-[9px] text-amber-700 flex items-start gap-1.5">
                      <span className="text-amber-500 flex-shrink-0">⚠</span>
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* AI badge */}
              {result.ai_converted && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] px-1.5 py-0.5 bg-[#6B46C1]/10 text-[#6B46C1] font-bold border border-[#6B46C1]/20">
                    AI 转换
                  </span>
                  <span className="text-[8px] text-gray-400">
                    内容已由 AI 智能解析，请确认转换结果
                  </span>
                </div>
              )}

              {/* Name / Description editing */}
              <div className="space-y-2">
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">
                    Skill 名称
                  </label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
                  />
                </div>
                <div>
                  <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">
                    描述
                  </label>
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full border-2 border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:border-[#00D1FF]"
                  />
                </div>
              </div>

              {/* System prompt preview */}
              <div>
                <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1 block">
                  System Prompt 预览
                </label>
                <div className="border-2 border-[#1A202C] bg-[#F8FAFB] max-h-48 overflow-y-auto">
                  <pre className="px-3 py-2 text-[9px] font-mono text-[#1A202C] whitespace-pre-wrap leading-relaxed">
                    {result.system_prompt}
                  </pre>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[8px] text-gray-400">
                    {result.system_prompt.length} 字
                  </span>
                </div>
              </div>

              {/* Removed sections */}
              {result.removed_sections.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowRemoved((v) => !v)}
                    className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4]"
                  >
                    {showRemoved ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                    已移除的不兼容内容 ({result.removed_sections.length})
                  </button>
                  {showRemoved && (
                    <div className="mt-1 border border-gray-200 bg-[#F8FAFB] divide-y divide-gray-100">
                      {result.removed_sections.map((s, i) => (
                        <div key={i} className="px-3 py-2">
                          <div className="text-[9px] font-mono text-gray-600 line-clamp-2">{s.section}</div>
                          <div className="text-[8px] text-gray-400 mt-0.5">{s.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {saveError && (
                <div className="border-2 border-red-400 bg-red-50 px-3 py-2 text-[9px] font-bold text-red-500">
                  {saveError}
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Saving ── */}
          {step === "saving" && (
            <div className="py-8 text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
                正在创建 Skill...
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t-2 border-[#1A202C]">
          {step === "input" && (
            <>
              <PixelButton
                onClick={handleConvert}
                disabled={converting || (inputMode === "file" ? !selectedFile : !pasteContent.trim())}
              >
                {converting ? "解析中..." : "解析并预览"}
              </PixelButton>
              <PixelButton variant="secondary" onClick={onCancel}>取消</PixelButton>
            </>
          )}
          {step === "preview" && result && (
            <>
              <PixelButton
                onClick={handleConfirmImport}
                disabled={!editName.trim() || !result.system_prompt.trim()}
              >
                确认导入
              </PixelButton>
              <PixelButton variant="secondary" onClick={() => setStep("input")}>
                返回修改
              </PixelButton>
              <PixelButton variant="secondary" onClick={onCancel}>取消</PixelButton>
            </>
          )}
          {step === "saving" && (
            <PixelButton variant="secondary" disabled>保存中...</PixelButton>
          )}
        </div>
      </div>
    </div>
  );
}
