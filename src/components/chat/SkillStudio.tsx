"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Zap } from "lucide-react";
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

type RightMode = "test" | "ai";

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
  selectedId,
  onSelect,
  onNew,
}: {
  skills: SkillDetail[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (skill: SkillDetail) => void;
  onNew: () => void;
}) {
  const drafts = skills.filter((s) => s.status === "draft" || s.status === "reviewing");
  const published = skills.filter((s) => s.status === "published" || s.status === "archived");

  function SkillItem({ skill }: { skill: SkillDetail }) {
    const isSelected = skill.id === selectedId;
    const badge = STATUS_BADGE[skill.status] ?? STATUS_BADGE.draft;
    return (
      <button
        onClick={() => onSelect(skill)}
        className={`w-full text-left px-3 py-2 border-b border-gray-100 last:border-0 transition-colors flex items-start gap-2 ${
          isSelected ? "bg-[#CCF2FF]" : "hover:bg-[#F0F4F8]"
        }`}
      >
        <div className="mt-0.5 flex-shrink-0"><SkillIcon size={10} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold truncate ${isSelected ? "text-[#00A3C4]" : ""}`}>
              {skill.name}
            </span>
            <PixelBadge color={badge.color}>{badge.label}</PixelBadge>
          </div>
          {skill.description && (
            <p className="text-[8px] text-gray-400 truncate mt-0.5">{skill.description}</p>
          )}
        </div>
      </button>
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
                {drafts.map((s) => <SkillItem key={s.id} skill={s} />)}
              </div>
            )}
            {published.length > 0 && (
              <div>
                <div className="px-3 py-1.5 text-[8px] font-bold uppercase tracking-widest text-gray-400 bg-[#F0F4F8] border-b border-gray-200">
                  已发布 ({published.length})
                </div>
                {published.map((s) => <SkillItem key={s.id} skill={s} />)}
              </div>
            )}
            {drafts.length === 0 && published.length === 0 && (
              <div className="p-4 text-center text-[9px] text-gray-400">暂无 Skill，点击新建</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Middle panel ─────────────────────────────────────────────────────────────

function PromptEditor({
  skill,
  isNew,
  prompt,
  externalName,
  onPromptChange,
  onSaved,
  onAiOptimize,
  onFork,
}: {
  skill: SkillDetail | null;
  isNew: boolean;
  prompt: string;
  externalName?: string | null;
  onPromptChange: (p: string) => void;
  onSaved: (skill: SkillDetail) => void;
  onAiOptimize: () => void;
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

  const isReadOnly = skill?.status === "published" || skill?.status === "archived";

  useEffect(() => {
    if (!skill) {
      if (isNew) { setName(""); setDescription(""); setVersions([]); }
      return;
    }
    apiFetch<SkillDetail>(`/skills/${skill.id}`)
      .then((d) => {
        setName(d.name);
        setDescription(d.description ?? "");
        const p = d.versions?.[0]?.system_prompt ?? d.system_prompt ?? "";
        onPromptChange(p);
        setVersions(d.versions ?? []);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill?.id]);

  useEffect(() => {
    if (isNew) { setName(""); setDescription(""); setVersions([]); onPromptChange(""); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  // Sync name from AI suggestion
  useEffect(() => {
    if (externalName) setName(externalName);
  }, [externalName]);

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
        setSaveMsg("✓ 已保存新版本");
        const d = await apiFetch<SkillDetail>(`/skills/${skill.id}`);
        setVersions(d.versions ?? []);
        onSaved(d);
      }
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "保存失败");
    } finally { setSaving(false); }
  }

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
      <div className="flex-1 flex flex-col px-4 py-3 overflow-hidden">
        <div className="flex items-center justify-between mb-2 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            System Prompt{versions.length > 0 && <span className="ml-2 text-gray-400">v{versions[0].version}</span>}
          </span>
          {versions.length > 1 && (
            <button onClick={() => setShowVersions((v) => !v)}
              className="text-[8px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4]">
              {showVersions ? "▲ 收起历史" : "▼ 版本历史"}
            </button>
          )}
        </div>
        {showVersions && (
          <div className="mb-2 border-2 border-[#1A202C] max-h-40 overflow-y-auto flex-shrink-0">
            {versions.map((v) => (
              <button key={v.id} onClick={() => { onPromptChange(v.system_prompt ?? ""); setShowVersions(false); }}
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
        <textarea value={prompt} onChange={(e) => onPromptChange(e.target.value)} disabled={isReadOnly}
          placeholder="在此输入 System Prompt..."
          className="flex-1 w-full border-2 border-[#1A202C] px-3 py-2 text-[10px] font-mono resize-none focus:outline-none focus:border-[#00D1FF] disabled:opacity-50 disabled:bg-gray-50" />
      </div>

      {/* Toolbar */}
      {!isReadOnly && (
        <div className="px-4 py-3 border-t-2 border-[#1A202C] flex items-center gap-2 flex-wrap flex-shrink-0">
          <PixelButton size="sm" onClick={onAiOptimize} disabled={!prompt.trim() || !skill}>
            ✦ AI 优化
          </PixelButton>
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

// ─── Right panel ──────────────────────────────────────────────────────────────

function RightPanel({
  skillId,
  skillName,
  isNew,
  triggerAiMode,
  onAdoptPrompt,
  onAdoptVersion,
  onAutoCreated,
}: {
  skillId: number | null;
  skillName: string;
  isNew: boolean;
  triggerAiMode: number;
  onAdoptPrompt: (newPrompt: string, name?: string) => void;
  onAdoptVersion: () => void;
  onAutoCreated: (skill: SkillDetail) => void;
}) {
  const [mode, setMode] = useState<RightMode>("test");

  // Test state
  const [testMessages, setTestMessages] = useState<ChatMessage[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testConvId, setTestConvId] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const testScrollRef = useRef<HTMLDivElement>(null);
  const testAbortRef = useRef<AbortController | null>(null);

  // AI state
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiRunning, setAiRunning] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);

  // Switch to AI mode on mount if new, or when triggered externally
  useEffect(() => {
    if (isNew) setMode("ai");
  }, [isNew]);

  // Switch to AI mode when triggered externally
  useEffect(() => {
    if (triggerAiMode > 0) setMode("ai");
  }, [triggerAiMode]);

  // Scroll test messages
  useEffect(() => {
    testScrollRef.current?.scrollTo({ top: testScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [testMessages]);

  async function ensureTestConv(): Promise<number> {
    if (testConvId) return testConvId;
    const conv = await apiFetch<{ id: number }>("/conversations", { method: "POST", body: JSON.stringify({}) });
    setTestConvId(conv.id);
    return conv.id;
  }

  async function handleTest() {
    if (!testInput.trim() || testing || !skillId) return;
    const userText = testInput.trim();
    setTestInput("");
    setTestMessages((prev) => [...prev, { role: "user", text: userText }]);
    setTesting(true);
    const ctrl = new AbortController();
    testAbortRef.current = ctrl;
    try {
      const convId = await ensureTestConv();
      const token = getToken();
      const resp = await fetch(`/api/proxy/conversations/${convId}/messages/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content: userText, force_skill_id: skillId }),
        signal: ctrl.signal,
      });
      if (!resp.ok) {
        setTestMessages((prev) => [...prev, { role: "assistant", text: "请求失败，请确认 Skill 有已保存的版本" }]);
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buf = "", accText = "", curEvt = "delta";
      let msgIdx = -1;
      setTestMessages((prev) => { msgIdx = prev.length; return [...prev, { role: "assistant", text: "", loading: true }]; });
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
              if ((curEvt === "delta" || curEvt === "content_block_delta") && data.text) {
                accText += data.text;
                setTestMessages((prev) => prev.map((m, i) => i === msgIdx ? { ...m, text: accText } : m));
              }
            } catch { /* skip */ }
            curEvt = "delta";
          }
        }
      }
      setTestMessages((prev) => prev.map((m, i) => i === msgIdx ? { ...m, loading: false } : m));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setTestMessages((prev) => [...prev, { role: "assistant", text: "连接中断" }]);
      }
    } finally { setTesting(false); }
  }

  async function handleAiOptimize() {
    if (!aiInput.trim() || aiRunning) return;
    const instruction = aiInput.trim();
    setAiInput("");
    setAiMessages((prev) => [...prev, { role: "user", text: instruction }]);
    setAiRunning(true); setPendingPrompt(null);

    try {
      // 新建模式：先用描述创建一个草稿 skill，再 AI 优化
      let targetId = skillId;
      if (!targetId) {
        setAiMessages((prev) => [...prev, { role: "assistant", text: "正在创建草稿 Skill...", loading: true }]);
        const created = await apiFetch<SkillDetail>("/skills", {
          method: "POST",
          body: JSON.stringify({
            name: "草稿",
            description: instruction.slice(0, 100),
            system_prompt: instruction,
            mode: "hybrid",
            variables: [],
            auto_inject: true,
          }),
        });
        targetId = created.id;
        onAutoCreated(created);
        setAiMessages((prev) => prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, text: "草稿已创建，AI 正在生成 Prompt...", loading: true } : m
        ));
      }

      const result = await apiFetch<{ proposed: { system_prompt?: string; name?: string; change_note?: string }; diff_summary?: string }>(
        `/skills/${targetId}/edit-with-ai`, { method: "POST", body: JSON.stringify({ instruction }) }
      );
      const newPrompt = result.proposed?.system_prompt ?? "";
      const suggestedName = result.proposed?.name;
      const note = result.proposed?.change_note ?? result.diff_summary ?? "AI 生成";

      setAiMessages((prev) => {
        // 替换掉 loading 的临时消息
        const filtered = prev.filter((m) => !m.loading);
        return [...filtered, { role: "assistant", text: `**${note}**\n\n${newPrompt}` }];
      });
      setPendingPrompt(newPrompt);
      setPendingName(suggestedName ?? null);
    } catch (err) {
      setAiMessages((prev) => {
        const filtered = prev.filter((m) => !m.loading);
        return [...filtered, { role: "assistant", text: `生成失败：${err instanceof Error ? err.message : "未知错误"}` }];
      });
    } finally { setAiRunning(false); }
  }

  function handleAdoptAiEdit() {
    if (!pendingPrompt) return;
    onAdoptPrompt(pendingPrompt, pendingName ?? undefined);
    setPendingPrompt(null);
    setPendingName(null);
    setAiMessages((prev) => [...prev, { role: "assistant", text: "✓ 修改已采纳到编辑器" }]);
  }

  const msgs = mode === "test" ? testMessages : aiMessages;

  return (
    <div className="flex flex-col flex-[1] min-w-0 border-l-2 border-[#1A202C] bg-white">
      {/* Mode tabs */}
      <div className="flex border-b-2 border-[#1A202C] flex-shrink-0">
        {(["test", "ai"] as RightMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-2.5 text-[9px] font-bold uppercase tracking-widest border-r last:border-r-0 border-[#1A202C] transition-colors ${
              mode === m ? "bg-[#1A202C] text-white" : "bg-[#EBF4F7] text-[#1A202C] hover:bg-[#D8EEF5]"
            }`}>
            {m === "test" ? "测试" : "✦ AI 优化"}
          </button>
        ))}
      </div>

      {/* Sub-header */}
      <div className="px-3 py-1.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0">
        <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400 flex-1 truncate">
          {mode === "test"
            ? (skillName || "未选择 Skill")
            : "用自然语言描述修改需求"}
        </span>
        {mode === "test" && testMessages.length > 0 && (
          <button onClick={() => { testAbortRef.current?.abort(); setTestMessages([]); setTestConvId(null); setTesting(false); }}
            className="text-[8px] font-bold uppercase text-gray-400 hover:text-red-400 transition-colors">清除</button>
        )}
      </div>

      {/* Messages */}
      <div ref={mode === "test" ? testScrollRef : undefined} className="flex-1 overflow-y-auto p-3 space-y-3">
        {msgs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-[9px] text-gray-400 font-bold uppercase text-center">
              {mode === "test"
                ? (skillId ? "输入消息测试当前 Skill" : "请先选择或保存一个 Skill")
                : "描述你想要什么样的 Skill，AI 帮你生成"}
            </p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[95%] px-2.5 py-2 text-[9px] font-mono leading-relaxed whitespace-pre-wrap border ${
              m.role === "user" ? "bg-[#1A202C] text-white border-[#1A202C]" : "bg-[#F0F4F8] text-[#1A202C] border-gray-200"
            }`}>
              {m.text || (m.loading ? <span className="animate-pulse text-[#00A3C4]">▋</span> : null)}
              {m.loading && m.text && <span className="animate-pulse text-[#00A3C4]">▋</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Adopt AI edit button */}
      {mode === "ai" && pendingPrompt && (
        <div className="px-3 py-2 border-t border-[#00CC99] bg-[#F0FFF4] flex-shrink-0">
          <PixelButton size="sm" onClick={handleAdoptAiEdit} className="w-full">✓ 采纳修改到编辑器</PixelButton>
        </div>
      )}

      {/* Input area */}
      <div className="border-t-2 border-[#1A202C] p-3 space-y-2 flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={mode === "test" ? testInput : aiInput}
            onChange={(e) => mode === "test" ? setTestInput(e.target.value) : setAiInput(e.target.value)}
            placeholder={
              mode === "test"
                ? (skillId ? "输入测试消息..." : "请先选择 Skill")
                : "描述你想要的 Skill，或告诉 AI 如何修改..."
            }
            disabled={mode === "test" ? (!skillId || testing) : aiRunning}
            className="flex-1 border-2 border-[#1A202C] px-2 py-1.5 text-[9px] font-mono focus:outline-none focus:border-[#00D1FF] disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                mode === "test" ? handleTest() : handleAiOptimize();
              }
            }}
          />
          <PixelButton size="sm"
            onClick={mode === "test" ? handleTest : handleAiOptimize}
            disabled={mode === "test" ? (!skillId || testing || !testInput.trim()) : (aiRunning || !aiInput.trim())}>
            {(mode === "test" ? testing : aiRunning) ? "..." : "发送"}
          </PixelButton>
        </div>
        {mode === "test" && testMessages.length > 0 && (
          <PixelButton size="sm" onClick={onAdoptVersion} className="w-full">✓ 采纳此版本</PixelButton>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SkillStudio() {
  const [skills, setSkills] = useState<SkillDetail[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [isNew, setIsNew] = useState(false);

  // Shared prompt state: lifted to page so both editor and right panel can read/write
  const [prompt, setPrompt] = useState("");
  const [externalName, setExternalName] = useState<string | null>(null);

  // Trigger AI mode in right panel by incrementing this counter
  const [triggerAiMode, setTriggerAiMode] = useState(0);

  // Trigger save in editor via ref
  const editorSaveRef = useRef<(() => void) | null>(null);

  const fetchSkills = useCallback(() => {
    setSkillsLoading(true);
    apiFetch<SkillDetail[]>("/skills?mine=true")
      .then((data) => setSkills(Array.isArray(data) ? data : []))
      .catch(() => setSkills([]))
      .finally(() => setSkillsLoading(false));
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  function handleSelectSkill(skill: SkillDetail) {
    setSelectedSkill(skill);
    setIsNew(false);
  }

  function handleNew() {
    setSelectedSkill(null);
    setIsNew(true);
    setPrompt("");
  }

  function handleSaved(skill: SkillDetail) {
    setSelectedSkill(skill);
    setIsNew(false);
    fetchSkills();
  }

  async function handleFork() {
    if (!selectedSkill) return;
    try {
      // Try fork endpoint first
      const forked = await apiFetch<SkillDetail>(`/skills/${selectedSkill.id}/fork`, { method: "POST" }).catch(() => null);
      if (forked) { handleSaved(forked); return; }
      // Fallback: create copy
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

  // Called when user wants to adopt the current test result as a saved version
  function handleAdoptVersion() {
    // Trigger editor save
    editorSaveRef.current?.();
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b-2 border-[#1A202C] bg-[#EBF4F7] px-4 py-2.5 flex items-center gap-3">
        <SkillIcon size={14} />
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">Skill Studio</span>
        <span className="text-[8px] text-gray-400 font-mono ml-2">
          {selectedSkill ? `正在编辑：${selectedSkill.name}` : isNew ? "新建 Skill" : "选择或新建 Skill 开始"}
        </span>
        <div className="ml-auto" />
      </div>

      {/* Three-column body */}
      <div className="flex-1 flex overflow-hidden">
        <SkillList
          skills={skills}
          loading={skillsLoading}
          selectedId={selectedSkill?.id ?? null}
          onSelect={handleSelectSkill}
          onNew={handleNew}
        />

        <PromptEditor
          skill={selectedSkill}
          isNew={isNew}
          prompt={prompt}
          externalName={externalName}
          onPromptChange={setPrompt}
          onSaved={handleSaved}
          onAiOptimize={() => setTriggerAiMode((n) => n + 1)}
          onFork={handleFork}
        />

        <RightPanel
          skillId={selectedSkill?.id ?? null}
          skillName={selectedSkill?.name ?? ""}
          isNew={isNew}
          triggerAiMode={triggerAiMode}
          onAdoptPrompt={(newPrompt, name) => {
            setPrompt(newPrompt);
            if (name) setExternalName(name);
          }}
          onAdoptVersion={handleAdoptVersion}
          onAutoCreated={(skill) => {
            setSelectedSkill(skill);
            setIsNew(false);
            fetchSkills();
          }}
        />
      </div>
    </div>
  );
}
