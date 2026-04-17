import { File, BookOpen, FileText, Lightbulb, Terminal, Layout } from "lucide-react";
import type { DiffOp, FileCategory, StagedEdit } from "./types";

// ─── Category config ────────────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<FileCategory, { icon: typeof File; label: string; hint: string }> = {
  "knowledge-base": { icon: BookOpen, label: "知识库", hint: "知识库文件 — AI 推理时作为领域知识注入" },
  "reference":      { icon: FileText, label: "参考资料", hint: "参考资料 — 方法论、API 文档" },
  "example":        { icon: Lightbulb, label: "示例", hint: "示例文件 — 提供输入输出样本" },
  "tool":           { icon: Terminal, label: "工具", hint: "工具脚本 — 可执行辅助脚本" },
  "template":       { icon: Layout, label: "模板", hint: "模板文件 — 输出格式模板" },
  "other":          { icon: File, label: "其他", hint: "" },
};

export const CATEGORY_ORDER: FileCategory[] = ["knowledge-base", "reference", "example", "tool", "template", "other"];

export const NEW_FILE_TEMPLATES: Partial<Record<FileCategory, string>> = {
  "knowledge-base": "# 知识库\n\n> AI 推理时参考此内容。\n\n",
  "example":        "# 示例\n\n## 输入\n\n## 期望输出\n",
  "reference":      "# 参考资料\n\n",
  "template":       "# 输出模板\n\n",
};

export const NEW_FILE_PREFIX: Partial<Record<FileCategory, string>> = {
  "knowledge-base": "-kb",
  "example":        "example-",
  "reference":      "reference-",
  "template":       "template-",
};

// ─── File helpers ────────────────────────────────────────────────────────────

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".py", ".js", ".ts", ".json", ".yaml", ".yml", ".sh", ".toml", ".xml", ".csv"]);

export function isTextFile(filename: string) {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

export function inferCategory(filename: string): FileCategory {
  const lower = filename.toLowerCase();
  const base = lower.split("/").pop() || lower;
  if (base.endsWith(".js") || base.endsWith(".py") || base.endsWith(".sh") || base.endsWith(".ts")) return "tool";
  if (base.includes("template") || base.startsWith("_")) return "template";
  if (base.startsWith("example") || base.includes("example")) return "example";
  if (base.includes("-kb.") || base.includes("knowledge")) return "knowledge-base";
  if (base.includes("reference") || base.endsWith(".dot") || base.endsWith(".xml")) return "reference";
  return "other";
}

export function getFileCategory(file: { filename: string; category?: string }): FileCategory {
  if (file.category && file.category in CATEGORY_CONFIG) return file.category as FileCategory;
  return inferCategory(file.filename);
}

// ─── applyOps: 精准局部编辑 ─────────────────────────────────────────────────────

export function applyOps(text: string, ops: DiffOp[]): string {
  // 倒序应用 ops，避免前面的 op 改变后面 op 的偏移量
  const reversed = [...ops].reverse();
  let result = text;
  for (const op of reversed) {
    switch (op.type) {
      case "replace": {
        if (!op.old) break;
        const idx = result.indexOf(op.old);
        if (idx === -1) break;
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

function normalizeDiffOp(raw: DiffOp | Record<string, unknown>): DiffOp {
  const opType = typeof (raw as { type?: unknown }).type === "string"
    ? String((raw as { type?: unknown }).type)
    : typeof (raw as { op?: unknown }).op === "string"
      ? String((raw as { op?: unknown }).op)
      : "replace";

  if (opType === "replace") {
    return {
      type: "replace",
      old: typeof (raw as { old?: unknown }).old === "string" ? String((raw as { old?: unknown }).old) : undefined,
      new: typeof (raw as { new?: unknown }).new === "string"
        ? String((raw as { new?: unknown }).new)
        : typeof (raw as { content?: unknown }).content === "string"
          ? String((raw as { content?: unknown }).content)
          : undefined,
    };
  }

  if (opType === "insert" || opType === "insert_after") {
    return {
      type: "insert_after",
      anchor: typeof (raw as { anchor?: unknown }).anchor === "string"
        ? String((raw as { anchor?: unknown }).anchor)
        : typeof (raw as { old?: unknown }).old === "string"
          ? String((raw as { old?: unknown }).old)
          : undefined,
      content: typeof (raw as { content?: unknown }).content === "string"
        ? String((raw as { content?: unknown }).content)
        : typeof (raw as { new?: unknown }).new === "string"
          ? String((raw as { new?: unknown }).new)
          : undefined,
      old: typeof (raw as { old?: unknown }).old === "string" ? String((raw as { old?: unknown }).old) : undefined,
      new: typeof (raw as { new?: unknown }).new === "string" ? String((raw as { new?: unknown }).new) : undefined,
    };
  }

  if (opType === "insert_before") {
    return {
      type: "insert_before",
      anchor: typeof (raw as { anchor?: unknown }).anchor === "string"
        ? String((raw as { anchor?: unknown }).anchor)
        : typeof (raw as { old?: unknown }).old === "string"
          ? String((raw as { old?: unknown }).old)
          : undefined,
      content: typeof (raw as { content?: unknown }).content === "string"
        ? String((raw as { content?: unknown }).content)
        : typeof (raw as { new?: unknown }).new === "string"
          ? String((raw as { new?: unknown }).new)
          : undefined,
      old: typeof (raw as { old?: unknown }).old === "string" ? String((raw as { old?: unknown }).old) : undefined,
      new: typeof (raw as { new?: unknown }).new === "string" ? String((raw as { new?: unknown }).new) : undefined,
    };
  }

  if (opType === "append") {
    return {
      type: "append",
      content: typeof (raw as { content?: unknown }).content === "string"
        ? String((raw as { content?: unknown }).content)
        : typeof (raw as { new?: unknown }).new === "string"
          ? String((raw as { new?: unknown }).new)
          : undefined,
      new: typeof (raw as { new?: unknown }).new === "string" ? String((raw as { new?: unknown }).new) : undefined,
    };
  }

  return {
    type: "delete",
    old: typeof (raw as { old?: unknown }).old === "string" ? String((raw as { old?: unknown }).old) : undefined,
  };
}

export function normalizeStagedEditPayload(raw: Record<string, unknown>, source?: string): StagedEdit {
  const rawDiff = Array.isArray(raw.diff) ? raw.diff : Array.isArray(raw.diff_ops) ? raw.diff_ops : [];
  const rawFileType = typeof raw.fileType === "string"
    ? raw.fileType
    : typeof raw.target_type === "string"
      ? raw.target_type
      : "system_prompt";
  const fileType = rawFileType === "prompt" ? "system_prompt" : rawFileType;
  const filename = typeof raw.filename === "string" && raw.filename
    ? raw.filename
    : typeof raw.target_key === "string" && raw.target_key
      ? raw.target_key
      : fileType === "system_prompt"
        ? "SKILL.md"
        : "";

  return {
    id: String(raw.id ?? `se-${Date.now()}`),
    source,
    fileType,
    filename,
    diff: rawDiff.map((op) => normalizeDiffOp(op as DiffOp | Record<string, unknown>)),
    changeNote: typeof raw.changeNote === "string"
      ? raw.changeNote
      : typeof raw.change_note === "string"
        ? raw.change_note
        : typeof raw.summary === "string"
          ? raw.summary
          : undefined,
    status: (raw.status as StagedEdit["status"]) || "pending",
  };
}

export function getMetadataFieldPreview(edit: Pick<StagedEdit, "fileType" | "diff">, fieldName: string): string | null {
  if (edit.fileType !== "metadata") return null;
  let nextValue: string | null = null;
  for (const op of edit.diff) {
    if (op.old === fieldName && typeof op.new === "string") {
      nextValue = op.new;
    }
  }
  return nextValue;
}

// ─── Token estimation ─────────────────────────────────────────────────────────

export const TOKEN_COMPRESS_THRESHOLD = 180_000;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  let tokens = 0;
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  tokens += cjkCount * 1.5;
  const rest = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, " ");
  const words = rest.split(/\s+/).filter(Boolean);
  tokens += words.length * 1.3;
  return Math.ceil(tokens);
}

export function estimateMessagesTokens(msgs: { text: string }[]): number {
  return msgs.reduce((sum, m) => sum + estimateTokens(m.text) + 4, 0);
}

// ─── Stage labels ─────────────────────────────────────────────────────────────

export const STUDIO_STAGE_LABELS: Record<string, string> = {
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
  routing: "识别模式...",
  auditing: "审计中...",
  governance: "生成治理建议...",
  done: "完成",
};

export function stageLabel(stage: string | null): string {
  if (!stage) return "等待响应...";
  if (stage.startsWith("executing:")) return `执行：${stage.slice(10)}`;
  if (stage.startsWith("retrying:")) return `重试：${stage.slice(9)}`;
  return STUDIO_STAGE_LABELS[stage] || `处理中（${stage}）...`;
}

// ─── Architect phase → PHASE_THEME key mapping ──────────────────────────────

const ARCHITECT_PHASE_MAP: Record<string, string> = {
  phase_1_why: "phase1",
  phase_2_what: "phase2",
  phase_3_how: "phase3",
  ooda_iteration: "ooda",
  ready_for_draft: "ready",
};

export function architectPhaseToThemeKey(phase: string): string {
  return ARCHITECT_PHASE_MAP[phase] || "phase1";
}

export const ARCHITECT_PHASE_GOALS: Record<string, string> = {
  phase_1_why: "确认根因、真实使用场景、问题复杂度",
  phase_2_what: "穷举影响结论质量的输入维度",
  phase_3_how: "筛选关键决策要素，输出 P0/P1/P2",
  ooda_iteration: "收敛判断：是否需要回调上一阶段",
  ready_for_draft: "收敛完成，准备生成草稿",
};

export const ARCHITECT_MODE_LABELS: Record<string, string> = {
  create_new_skill: "新建 Skill",
  optimize_existing_skill: "优化 Skill",
  audit_imported_skill: "导入升级",
};

export const FRAMEWORK_LABELS: Record<string, string> = {
  "5_whys": "5 Whys",
  "first_principles": "第一性原理",
  "jtbd": "JTBD",
  "cynefin": "Cynefin",
  "mece_issue_tree": "MECE / Issue Tree",
  "scenario_planning": "场景推演",
  "value_chain": "价值链",
  "pyramid_principle": "金字塔原理",
  "pre_mortem": "Pre-Mortem",
  "red_team": "Red Team",
  "sensitivity_analysis": "敏感性分析",
  "zero_based": "归零思维",
  "ooda": "OODA Loop",
};
