"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { Zap, Download, Search } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { apiFetch, getToken } from "@/lib/api";
import type { SkillDetail, SkillVersion } from "@/lib/types";
import { useTheme } from "@/lib/theme";
import { useStudioStore } from "@/lib/studio-store";
import { ICONS, PixelIcon } from "@/components/pixel";
import { DiffViewer, LineNumberedEditor } from "./DiffViewer";
import { PreflightReport } from "./PreflightReport";
import { KnowledgeConfirmModal } from "./KnowledgeConfirmModal";
import type { GovernanceCardData, PreflightResult, PreflightGate, StagedEdit, DiffOp } from "./types";

function SkillIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon {...ICONS.skills} size={size} />;
  return <Zap size={size} className="text-muted-foreground" />;
}

export function PromptEditor({
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
  sandboxVersionMismatch,
  sandboxVersionMismatchMessage,
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
  sandboxVersionMismatch?: boolean;
  sandboxVersionMismatchMessage?: string | null;
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
  const pendingStagedEditCount = useStudioStore((s) => s.stagedEdits.filter((e) => e.status === "pending").length);
  const syncGovernanceCards = useStudioStore((s) => s.syncGovernanceCards);
  const syncStagedEdits = useStudioStore((s) => s.syncStagedEdits);
  const preflightRefreshToken = useStudioStore((s) => s.preflightRefreshToken);
  const deferredPrompt = useDeferredValue(prompt);
  const isLargeText = prompt.length > 50 * 1024;
  const preflightSource = skill ? `preflight:${skill.id}` : null;
  const handledPreflightRefreshRef = useRef(0);

  function normalizeStagedEdit(raw: Record<string, unknown>): StagedEdit {
    return {
      id: String(raw.id ?? Date.now()),
      fileType: (raw.target_type as string) || "system_prompt",
      filename: raw.target_key ? String(raw.target_key) : ((raw.target_type as string) === "system_prompt" ? "SKILL.md" : ""),
      diff: (((raw.diff_ops as DiffOp[]) || []).map((op) => ({
        type: (op as unknown as { op?: string }).op === "replace"
          ? "replace"
          : (op as unknown as { op?: string }).op === "insert"
            ? "insert_after"
            : "delete",
        old: op.old,
        new: op.new || op.content,
      })) as DiffOp[]),
      changeNote: raw.summary as string,
      status: (raw.status as StagedEdit["status"]) || "pending",
    };
  }

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
        const trimmedName = name.trim();
        const trimmedDescription = description.trim();
        const nameChanged = trimmedName !== skill.name;
        const descriptionChanged = trimmedDescription !== (skill.description ?? "");

        if (nameChanged) {
          await apiFetch(`/skills/${skill.id}/rename`, {
            method: "PATCH",
            body: JSON.stringify({
              display_name: trimmedName,
              rename_folder: true,
            }),
          });
        }

        if (descriptionChanged) {
          await apiFetch(`/skills/${skill.id}`, {
            method: "PUT",
            body: JSON.stringify({
              name: trimmedName,
              description: trimmedDescription,
              mode: skill.mode,
              department_id: skill.department_id ?? null,
              knowledge_tags: skill.knowledge_tags ?? [],
              auto_inject: skill.auto_inject ?? true,
              system_prompt: prompt.trim(),
              variables: [],
              required_inputs: [],
              model_config_id: null,
              output_schema: null,
            }),
          });
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
                const finalResult = data as PreflightResult;
                setPreflightResult(finalResult);
                setPreflightStage(null);
                if (preflightSource) {
                  if (finalResult.passed && !finalResult.blocked_by) {
                    syncGovernanceCards(preflightSource, []);
                    syncStagedEdits(preflightSource, []);
                  } else {
                    try {
                      const remediation = await apiFetch<{ cards: GovernanceCardData[]; staged_edits: Record<string, unknown>[] }>(
                        `/sandbox/preflight/${skill.id}/remediation-actions`,
                        {
                          method: "POST",
                          body: JSON.stringify({ result: finalResult }),
                        }
                      );
                      syncGovernanceCards(preflightSource, remediation.cards || []);
                      syncStagedEdits(preflightSource, (remediation.staged_edits || []).map(normalizeStagedEdit));
                    } catch (remediationErr) {
                      console.error("Preflight remediation sync failed", remediationErr);
                    }
                  }
                }
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

  useEffect(() => {
    if (!skill || preflightRefreshToken <= 0 || handledPreflightRefreshRef.current === preflightRefreshToken) return;
    handledPreflightRefreshRef.current = preflightRefreshToken;
    runPreflight();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preflightRefreshToken, skill?.id]);

  async function handleSubmitReview() {
    if (!skill) return;
    if (sandboxVersionMismatch) {
      setSaveMsg(sandboxVersionMismatchMessage || "当前报告版本已过期，请重新运行质量检测");
      return;
    }
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
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-white">
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
    <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
      {isReadOnly && (
        <div className="px-4 py-2 bg-amber-50 border-b-2 border-amber-300 flex items-center gap-3 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-600">已发布（只读）</span>
          <PixelButton size="sm" onClick={onFork}>Fork 并编辑</PixelButton>
        </div>
      )}
      {pendingStagedEditCount > 0 && (
        <div className="px-4 py-1.5 bg-[#F0FFF9] border-b border-[#00CC99]/30 flex items-center gap-2 flex-shrink-0">
          <span className="w-1.5 h-1.5 bg-[#00CC99] animate-pulse" />
          <span className="text-[8px] font-bold uppercase tracking-widest text-[#00CC99]">
            {pendingStagedEditCount} 项待采纳修改
          </span>
          <span className="text-[7px] text-gray-400 ml-auto">在 Chat 中操作采纳或拒绝</span>
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
        {isLargeText && (
          <div className="px-2 py-1 bg-amber-50 border border-amber-200 text-[8px] font-mono text-amber-600 mb-1 flex-shrink-0">
            文本超过 50KB（{Math.round(prompt.length / 1024)}KB），建议拆分为多个文件以提升编辑体验
          </div>
        )}
        {showDiff && diffBase !== null ? (
          <DiffViewer oldText={diffBase} newText={deferredPrompt} />
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
      {!isReadOnly ? (
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
      ) : skill && (
        <div className="px-4 py-3 border-t-2 border-[#1A202C] flex items-center gap-3 flex-shrink-0">
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

      {/* Knowledge Confirm Modal */}
      {showKbConfirm && skill && (
        <KnowledgeConfirmModal
          skillId={skill.id}
          items={showKbConfirm.map((it) => ({ check: it.check, ok: it.ok, issue: it.issue }))}
          onDone={(info) => {
            setShowKbConfirm(null);
            if (info && info.knowledgeEntryCount > 0) {
              setSaveMsg(`✓ 已确认归档 ${info.confirmed} 项，返回 ${info.knowledgeEntryCount} 个知识库条目`);
            } else {
              setSaveMsg("⚠ 已提交归档确认，但接口未返回知识库条目 ID，请到知识库中核对是否真正落档");
            }
            runPreflight();
          }}
          onCancel={() => setShowKbConfirm(null)}
        />
      )}
    </div>
  );
}
