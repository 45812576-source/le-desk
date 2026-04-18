"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useChatStore, subscribeConvStream, getConvStreamSnapshot } from "@/lib/chat-store";
import { connectionManager } from "@/lib/connection";
import type { ConnectionState } from "@/lib/connection";
import type { ContentBlock, SandboxReport, SandboxSession, SkillDetail } from "@/lib/types";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { DevStudio } from "@/components/chat/DevStudio";
import { SkillStudio } from "@/components/chat/SkillStudio";
import { SandboxTestModal } from "@/components/skill/SandboxTestModal";
import { SkillGovernancePanel } from "@/components/skill-studio/SkillGovernancePanel";
import { useTheme } from "@/lib/theme";
import { isEditableSkillStatus, isPublishedSkillStatus } from "@/lib/skill-status";
import { findMentionedSkillIds } from "@/lib/test-flow-client";
import type { TestFlowResolveResponse, TestFlowSkillCandidate } from "@/lib/test-flow-types";

// Module-level workspace cache — survives route navigation
type WorkspaceData = { workspace_type?: string; welcome_message?: string; skills: { id: number; name: string; description?: string; status?: string }[]; tools: { id: number; name: string; display_name: string; description?: string; tool_type?: string }[] };
const _wsCache = new Map<number, WorkspaceData>();

interface SandboxHistoryItem extends SandboxSession {
  has_report: boolean;
  report_created_at: string | null;
  report_knowledge_entry_id: number | null;
  report_hash: string | null;
  source_case_plan_id?: number | null;
  source_case_plan_version?: number | null;
  test_entry_source?: string | null;
  test_decision_mode?: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  matching_skill: "识别意图...",
  checking_context: "检索知识 & 校验输入...",
  compiling_prompt: "组装提示词...",
  preparing: "匹配 Skill & 组装上下文...",
  generating: "生成中...",
  tool_calling: "调用工具中...",
  uploading: "上传文件中...",
  parsing: "解析文件内容...",
  summarizing: "生成 FOE 结构化摘要...",
  pev_start: "分析任务复杂度...",
  replanning: "重新规划中...",
};

function _parsePevStage(stage: string | null): string {
  if (!stage) return "思考中...";
  if (stage.startsWith("executing:")) return `执行：${stage.slice(10)}`;
  if (stage.startsWith("retrying:")) return `重试：${stage.slice(9)}`;
  return STAGE_LABELS[stage] || "思考中...";
}

const FILE_STAGES: { minSec: number; label: string }[] = [
  { minSec: 0,  label: "解析文件中..." },
  { minSec: 4,  label: "提取文本内容..." },
  { minSec: 10, label: "生成 FOE 结构化摘要..." },
  { minSec: 30, label: "校验 Input 是否充分..." },
  { minSec: 50, label: "调用 Skill 生成回复..." },
];

const ALLOWED_EXTS = [".txt", ".pdf", ".docx", ".pptx", ".md", ".xlsx", ".xls", ".csv",
  ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".mp3", ".wav", ".m4a", ".ogg", ".flac"];
const isAllowedFile = (f: File) =>
  ALLOWED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)) || f.type.startsWith("image/");

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string): string {
  switch (status) {
    case "completed": return "已完成";
    case "running": return "执行中";
    case "cannot_test": return "不可测试";
    case "ready_to_run": return "可运行";
    case "blocked": return "已阻断";
    case "draft": return "草稿";
    default: return status;
  }
}

function stepLabel(step: string): string {
  switch (step) {
    case "input_slot_review": return "输入确认";
    case "tool_review": return "工具确认";
    case "permission_review": return "权限确认";
    case "case_generation": return "生成用例";
    case "execution": return "执行测试";
    case "evaluation": return "质量评估";
    case "done": return "已结束";
    default: return step;
  }
}

function SandboxTestFlowPromptCard({
  candidates,
  onPick,
  onDismiss,
}: {
  candidates: TestFlowSkillCandidate[];
  onPick: (skillId: number) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-3 border-2 border-[#00A3C4] bg-[#F0FAFF] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            选择待测 Skill
          </div>
          <div className="text-[9px] text-slate-500 mt-1">
            当前消息命中了多个 Skill。先选 1 个目标，再直接进入测试用例流程。
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="px-2 py-1 text-[8px] font-bold uppercase tracking-widest border border-[#1A202C] bg-white text-[#1A202C]"
        >
          关闭
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {candidates.map((skill) => (
          <button
            key={skill.id}
            type="button"
            onClick={() => onPick(skill.id)}
            className="px-2 py-1 text-[9px] font-bold border-2 border-[#00A3C4] bg-white text-[#00A3C4] hover:bg-[#CCF2FF] transition-colors"
          >
            {skill.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Status Indicator ── */

function StatusIndicator({ stage, isFileUpload }: { stage: string | null; isFileUpload: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    Promise.resolve().then(() => setElapsed(0));
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, [stage, isFileUpload]);

  let label: string;
  if (isFileUpload) {
    label = [...FILE_STAGES].reverse().find((s) => elapsed >= s.minSec)?.label ?? FILE_STAGES[0].label;
  } else {
    label = _parsePevStage(stage);
  }

  return (
    <div className="flex justify-start mb-3">
      <div className="bg-white border-2 border-[#1A202C] px-4 py-3 flex items-center gap-3">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-[#00A3C4] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 bg-[#00A3C4] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 bg-[#00A3C4] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-[9px] font-bold tracking-widest text-gray-400 transition-all">
          {label}
          {isFileUpload && <span className="ml-1 text-gray-300">({elapsed}s)</span>}
        </span>
      </div>
    </div>
  );
}

import { ToolCallCard } from "@/components/chat/blocks/ToolCallCard";
import { MarkdownBlock } from "@/components/chat/blocks/MarkdownBlock";
import { ThinkingBlock } from "@/components/chat/blocks/ThinkingBlock";
import { ToolResultCard } from "@/components/chat/blocks/ToolResultCard";

/* ── Agent Loop Progress ── */

function AgentLoopProgress({ round, maxRounds }: { round: number; maxRounds: number }) {
  if (round <= 0 || maxRounds <= 0) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 mb-2">
      <div className="flex gap-1">
        {Array.from({ length: maxRounds }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-2 border border-[#1A202C] transition-all ${
              i < round
                ? "bg-[#00A3C4]"
                : i === round
                ? "bg-[#00D1FF] animate-pulse"
                : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <span className="text-[8px] font-bold uppercase tracking-widest text-gray-400">
        Agent 轮次 {round}/{maxRounds}
      </span>
    </div>
  );
}

/* ── Streaming Blocks Bubble ── */

function StreamingBlocksBubble({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%]">
        <div className="px-4 py-3 bg-white border-2 border-[#1A202C] text-[#1A202C]">
          {blocks.filter((b): b is ContentBlock => b != null).map((block, i) => {
            if (block.type === "text") {
              return (
                <div key={i}>
                  <MarkdownBlock text={block.text} />
                  {i === blocks.length - 1 && (
                    <span className="inline-block w-1.5 h-3.5 bg-[#00A3C4] ml-0.5 animate-pulse" />
                  )}
                </div>
              );
            }
            if (block.type === "thinking") {
              return <ThinkingBlock key={i} text={block.text} streaming={true} />;
            }
            if (block.type === "tool_call") {
              return <ToolCallCard key={i} block={block} />;
            }
            if (block.type === "tool_result") {
              return <ToolResultCard key={i} block={block} />;
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Streaming Bubble ── */

function StreamingBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[75%]">
        <div className="px-4 py-3 bg-white border-2 border-[#1A202C] text-[#1A202C]">
          <div className="text-xs whitespace-pre-wrap break-words leading-relaxed select-text">
            {text}
            <span className="inline-block w-1.5 h-3.5 bg-[#00A3C4] ml-0.5 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SandboxHistoryModal({
  open,
  loading,
  detailLoading,
  error,
  items,
  selectedSessionId,
  sessionDetail,
  reportDetail,
  onClose,
  onSelectSession,
  onViewReport,
}: {
  open: boolean;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  items: SandboxHistoryItem[];
  selectedSessionId: number | null;
  sessionDetail: SandboxSession | null;
  reportDetail: SandboxReport | null;
  onClose: () => void;
  onSelectSession: (sessionId: number) => void;
  onViewReport: (sessionId: number) => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-30 bg-[#1A202C]/35 flex justify-end">
      <div className="w-full max-w-5xl h-full bg-[#F8FCFE] border-l-2 border-[#1A202C] flex">
        <div className="w-[44%] border-r-2 border-[#1A202C] flex flex-col">
          <div className="px-4 py-3 border-b-2 border-[#1A202C] bg-white flex items-center justify-between">
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99]">历史测试记录</div>
              <div className="text-[9px] text-gray-400 mt-1">清空聊天后，这里的 session 与报告仍可找回</div>
            </div>
            <button
              onClick={onClose}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8] transition-colors"
            >
              关闭
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {loading ? (
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">加载中...</div>
            ) : error ? (
              <div className="border-2 border-red-300 bg-red-50 px-3 py-2 text-[10px] text-red-500">{error}</div>
            ) : items.length === 0 ? (
              <div className="border-2 border-dashed border-[#00CC99] bg-white px-4 py-6 text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#00CC99] mb-2">暂无历史测试</div>
                <div className="text-[10px] text-gray-500 leading-relaxed">如果当前还没有保存过沙盒测试，则这里会在第一次产出 session 或报告后出现记录。</div>
              </div>
            ) : (
              items.map((item) => {
                const selected = item.session_id === selectedSessionId;
                return (
                  <button
                    key={item.session_id}
                    onClick={() => onSelectSession(item.session_id)}
                    className={`w-full text-left border-2 px-3 py-3 transition-colors ${
                      selected
                        ? "border-[#00CC99] bg-[#F0FFF9]"
                        : "border-[#1A202C] bg-white hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold text-[#1A202C]">
                          {item.target_name || `${item.target_type} #${item.target_id}`}
                        </div>
                        <div className="text-[9px] text-gray-400 mt-1">
                          v{item.target_version ?? "?"} · {formatDateTime(item.created_at)}
                        </div>
                      </div>
                      <div className={`px-2 py-0.5 text-[8px] font-bold border ${item.has_report ? "border-[#00CC99] text-[#00CC99]" : "border-gray-300 text-gray-400"}`}>
                        {item.has_report ? "有报告" : "无报告"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-[8px] font-bold uppercase tracking-widest text-gray-500">
                      <span>{statusLabel(item.status)}</span>
                      <span>•</span>
                      <span>{stepLabel(item.current_step)}</span>
                      {item.parent_session_id ? (
                        <>
                          <span>•</span>
                          <span>重测</span>
                        </>
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-3 border-b-2 border-[#1A202C] bg-white">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A202C]">记录详情</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {detailLoading ? (
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">加载详情...</div>
            ) : !sessionDetail ? (
              <div className="border-2 border-dashed border-gray-300 bg-white px-4 py-6 text-[10px] text-gray-500">
                选择左侧一条历史记录后，这里会显示对应 session 与报告摘要。
              </div>
            ) : (
              <>
                <div className="border-2 border-[#1A202C] bg-white p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-[#00CC99]">Session #{sessionDetail.session_id}</div>
                      <div className="text-[11px] font-bold text-[#1A202C] mt-1">
                        {sessionDetail.target_name || `${sessionDetail.target_type} #${sessionDetail.target_id}`}
                      </div>
                    </div>
                    {sessionDetail.report_id ? (
                      <button
                        onClick={() => onViewReport(sessionDetail.session_id)}
                        className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#00CC99] bg-[#F0FFF9] text-[#00CC99] hover:bg-[#DDFBED] transition-colors"
                      >
                        查看报告
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div><span className="text-gray-400">状态：</span><span className="font-bold text-[#1A202C]">{statusLabel(sessionDetail.status)}</span></div>
                    <div><span className="text-gray-400">阶段：</span><span className="font-bold text-[#1A202C]">{stepLabel(sessionDetail.current_step)}</span></div>
                    <div><span className="text-gray-400">创建：</span><span className="font-bold text-[#1A202C]">{formatDateTime(sessionDetail.created_at)}</span></div>
                    <div><span className="text-gray-400">完成：</span><span className="font-bold text-[#1A202C]">{formatDateTime(sessionDetail.completed_at)}</span></div>
                  </div>
                  {sessionDetail.blocked_reason ? (
                    <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] text-amber-700">
                      阻断原因：{sessionDetail.blocked_reason}
                    </div>
                  ) : null}
                </div>
                <div className="border-2 border-[#1A202C] bg-white p-4">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-[#1A202C] mb-3">测试摘要</div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div><span className="text-gray-400">输入槽位：</span><span className="font-bold text-[#1A202C]">{sessionDetail.detected_slots?.length ?? 0}</span></div>
                    <div><span className="text-gray-400">工具确认：</span><span className="font-bold text-[#1A202C]">{sessionDetail.tool_review?.length ?? 0}</span></div>
                    <div><span className="text-gray-400">理论组合：</span><span className="font-bold text-[#1A202C]">{sessionDetail.theoretical_combo_count ?? "—"}</span></div>
                    <div><span className="text-gray-400">已执行用例：</span><span className="font-bold text-[#1A202C]">{sessionDetail.executed_case_count ?? "—"}</span></div>
                    <div><span className="text-gray-400">质量通过：</span><span className="font-bold text-[#1A202C]">{sessionDetail.quality_passed == null ? "—" : sessionDetail.quality_passed ? "是" : "否"}</span></div>
                    <div><span className="text-gray-400">可提审：</span><span className="font-bold text-[#1A202C]">{sessionDetail.approval_eligible == null ? "—" : sessionDetail.approval_eligible ? "是" : "否"}</span></div>
                  </div>
                </div>
                {reportDetail ? (
                  <div className="border-2 border-[#00CC99] bg-[#F0FFF9] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99]">报告 #{reportDetail.report_id}</div>
                      <div className="text-[9px] text-[#00CC99]/70">
                        {formatDateTime(reportDetail.created_at)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div><span className="text-gray-500">知识库存证：</span><span className="font-bold text-[#1A202C]">{reportDetail.knowledge_entry_id ?? "—"}</span></div>
                      <div><span className="text-gray-500">Hash：</span><span className="font-bold text-[#1A202C]">{reportDetail.report_hash?.slice(0, 12) ?? "—"}</span></div>
                      <div><span className="text-gray-500">质量通过：</span><span className="font-bold text-[#1A202C]">{reportDetail.quality_passed == null ? "—" : reportDetail.quality_passed ? "是" : "否"}</span></div>
                      <div><span className="text-gray-500">反幻觉通过：</span><span className="font-bold text-[#1A202C]">{reportDetail.anti_hallucination_passed == null ? "—" : reportDetail.anti_hallucination_passed ? "是" : "否"}</span></div>
                    </div>
                    <pre className="text-[9px] leading-relaxed whitespace-pre-wrap break-words bg-white border border-[#BEEFD7] p-3 overflow-x-auto">
                      {JSON.stringify(reportDetail.part3_evaluation ?? {}, null, 2)}
                    </pre>
                  </div>
                ) : sessionDetail.report_id ? (
                  <div className="border border-dashed border-[#00CC99] bg-white px-4 py-3 text-[10px] text-gray-500">
                    这条记录已生成报告，点击“查看报告”即可加载详情。
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */

export default function ChatDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const convId = Number(params.id);
  const { theme } = useTheme();

  // If URL carries ws=skill_studio hint, render immediately without waiting for API
  const wsHint = searchParams.get("ws");

  // Store state — messages via zustand, stream state via out-of-store subscription
  const storeMessages = useChatStore((s) => s.messagesMap.get(convId));
  const messages = useMemo(() => storeMessages ?? [], [storeMessages]);
  const [convStream, setConvStream] = useState(() => getConvStreamSnapshot(convId));
  useEffect(() => {
    setConvStream(getConvStreamSnapshot(convId));
    return subscribeConvStream(convId, () => setConvStream({ ...getConvStreamSnapshot(convId) }));
  }, [convId]);

  const streamingText = convStream.streamingText;
  const streamBlocks = convStream.streamingBlocks;
  const streamStage = convStream.streamStage;
  const isSending = convStream.isSending;
  const isFileUpload = convStream.isFileUpload;
  const currentRound = convStream.currentRound;
  const maxRounds = convStream.maxRounds;
  const streamError = convStream.streamError;
  const tokenUsage = convStream.tokenUsage;

  // UI-only state
  const [loading, setLoading] = useState(true);
  const [isOpencode, setIsOpencode] = useState(false);
  const [opencodeWorkspaceId, setOpencodeWorkspaceId] = useState<number | null>(null);
  const [isSkillStudio, setIsSkillStudio] = useState(wsHint === "skill_studio");
  const [isDragOver, setIsDragOver] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<string | null>(null);
  const [workspaceSkills, setWorkspaceSkills] = useState<{ id: number; name: string; description?: string; status?: string }[]>([]);
  const [workspaceTools, setWorkspaceTools] = useState<{ id: number; name: string; display_name: string; description?: string; tool_type?: string }[]>([]);
  const [activeSkill, setActiveSkill] = useState<{ id: number; name: string } | null>(null);
  const [enabledSkillIds, setEnabledSkillIds] = useState<Set<number> | null>(null);
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [workspaceType, setWorkspaceType] = useState<string | null | undefined>(undefined);
  const [sandboxSkills, setSandboxSkills] = useState<{ id: number; name: string; status: string }[]>([]);
  const [sandboxSkillId, setSandboxSkillId] = useState<number | null>(null);
  const [sandboxLoaded, setSandboxLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [sandboxHistory, setSandboxHistory] = useState<SandboxHistoryItem[]>([]);
  const [selectedHistorySessionId, setSelectedHistorySessionId] = useState<number | null>(null);
  const [selectedHistorySession, setSelectedHistorySession] = useState<SandboxSession | null>(null);
  const [selectedHistoryReport, setSelectedHistoryReport] = useState<SandboxReport | null>(null);
  const [sandboxTestFlowPrompt, setSandboxTestFlowPrompt] = useState<{
    resolved: TestFlowResolveResponse;
    content: string;
  } | null>(null);
  const [sandboxGovernanceSkill, setSandboxGovernanceSkill] = useState<SkillDetail | null>(null);
  const [sandboxGovernanceLoading, setSandboxGovernanceLoading] = useState(false);
  const [sandboxTestFlowIntent, setSandboxTestFlowIntent] = useState<{
    mode: "mount_blocked" | "choose_existing_plan" | "generate_cases";
    entrySource: "sandbox_chat";
    conversationId: number;
    triggerMessage: string;
    latestPlan: TestFlowResolveResponse["latest_plan"];
  } | null>(null);
  const [sandboxTestSessionModal, setSandboxTestSessionModal] = useState<{
    skillId: number;
    skillName: string;
    sessionId: number;
  } | null>(null);
  const visibleWorkspaceSkills = useMemo(
    () => workspaceSkills.filter((skill) => !skill.status || isPublishedSkillStatus(skill.status)),
    [workspaceSkills],
  );

  // Connection state
  const [connState, setConnState] = useState<ConnectionState>(connectionManager.getState());
  useEffect(() => connectionManager.subscribe(setConnState), []);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages + workspace concurrently
  useEffect(() => {
    // ── Messages ──────────────────────────────────────────────────
    const cached = useChatStore.getState().messagesMap.get(convId);
    if (cached) {
      setLoading(false);
    } else {
      setLoading(true);
      useChatStore.getState().loadMessages(convId).finally(() => setLoading(false));
    }

    // Reset sandbox state on conv change
    setSandboxLoaded(false);
    setSandboxSkills([]);
    setSandboxSkillId(null);
    // 有 wsHint 时不重置这些状态，避免 API 返回前 SkillStudio 被 unmount 再重挂
    if (wsHint !== "skill_studio") {
      setWorkspaceType(null);
      setIsSkillStudio(false);
    }

    // ── Workspace (concurrent, doesn't block messages) ────────────
    const loadWorkspace = async () => {
      let convs = useChatStore.getState().conversations;
      if (convs.length === 0) {
        try { convs = await apiFetch<typeof convs>("/conversations"); } catch { return; }
      }
      const conv = convs.find((c) => c.id === convId) as { id: number; workspace_id?: number | null; skill_id?: number | null } | undefined;
      if (!conv?.workspace_id) { setWorkspaceType(null); return; }

      let ws = _wsCache.get(conv.workspace_id);
      if (!ws) {
        try {
          ws = await apiFetch<WorkspaceData>(`/workspaces/${conv.workspace_id}`);
          _wsCache.set(conv.workspace_id, ws);
        } catch { return; }
      }

      if (ws.workspace_type === "opencode") {
        setIsOpencode(true);
        setOpencodeWorkspaceId(conv.workspace_id);
        return;
      }
      if (ws.workspace_type === "skill_studio") {
        setIsSkillStudio(true);
        return;
      }
      setWorkspaceType(ws.workspace_type ?? null);
      setWelcomeMessage(ws.welcome_message ?? null);
      if (ws.workspace_type === "sandbox") {
        apiFetch<{ id: number; name: string; status: string }[]>("/skills?mine=true").then((skills) => {
          const unpublished = skills.filter((s) => isEditableSkillStatus(s.status));
          setSandboxSkills(unpublished);
          if (unpublished.length > 0) setSandboxSkillId(unpublished[0].id);
        }).catch(() => {}).finally(() => setSandboxLoaded(true));
      } else {
        setWorkspaceSkills((ws.skills ?? []).filter((skill) => !skill.status || isPublishedSkillStatus(skill.status)));
        setWorkspaceTools(ws.tools ?? []);
      }
      if ((conv as { skill_id?: number | null }).skill_id) {
        const sk = (ws.skills ?? []).find((s) => s.id === (conv as { skill_id?: number | null }).skill_id && (!s.status || isPublishedSkillStatus(s.status)));
        if (sk) setActiveSkill({ id: sk.id, name: sk.name });
        else setActiveSkill(null);
      }
    };
    loadWorkspace();
  }, [convId, wsHint]);

  useEffect(() => {
    if (enabledSkillIds === null) return;
    const visibleIds = new Set(visibleWorkspaceSkills.map((skill) => skill.id));
    const next = new Set(Array.from(enabledSkillIds).filter((id) => visibleIds.has(id)));
    if (next.size === visibleWorkspaceSkills.length) {
      setEnabledSkillIds(null);
      return;
    }
    if (next.size !== enabledSkillIds.size) {
      setEnabledSkillIds(next);
    }
  }, [enabledSkillIds, visibleWorkspaceSkills]);

  useEffect(() => {
    if (activeSkill && !visibleWorkspaceSkills.some((skill) => skill.id === activeSkill.id)) {
      setActiveSkill(null);
    }
  }, [activeSkill, visibleWorkspaceSkills]);

  const loadSandboxHistory = useCallback(async () => {
    if (workspaceType !== "sandbox") return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (sandboxSkillId) {
        params.set("target_type", "skill");
        params.set("target_id", String(sandboxSkillId));
      }
      const path = `/sandbox/interactive/history?${params.toString()}`;
      const data = await apiFetch<SandboxHistoryItem[]>(path);
      setSandboxHistory(data);
      setSelectedHistorySessionId((prev) =>
        prev && data.some((item) => item.session_id === prev) ? prev : data[0]?.session_id ?? null
      );
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "加载历史记录失败");
      setSandboxHistory([]);
      setSelectedHistorySessionId(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [sandboxSkillId, workspaceType]);

  useEffect(() => {
    if (!historyOpen || workspaceType !== "sandbox") return;
    loadSandboxHistory();
  }, [historyOpen, loadSandboxHistory, workspaceType]);

  useEffect(() => {
    if (!historyOpen || workspaceType !== "sandbox" || !selectedHistorySessionId) {
      if (!selectedHistorySessionId) {
        setSelectedHistorySession(null);
        setSelectedHistoryReport(null);
      }
      return;
    }
    let cancelled = false;
    const loadDetails = async () => {
      setHistoryDetailLoading(true);
      setHistoryError(null);
      try {
        const session = await apiFetch<SandboxSession>(`/sandbox/interactive/${selectedHistorySessionId}`);
        if (cancelled) return;
        setSelectedHistorySession(session);
        if (session.report_id) {
          const report = await apiFetch<SandboxReport>(`/sandbox/interactive/${selectedHistorySessionId}/report`);
          if (!cancelled) setSelectedHistoryReport(report);
        } else if (!cancelled) {
          setSelectedHistoryReport(null);
        }
      } catch (error) {
        if (!cancelled) {
          setHistoryError(error instanceof Error ? error.message : "加载历史详情失败");
          setSelectedHistorySession(null);
          setSelectedHistoryReport(null);
        }
      } finally {
        if (!cancelled) setHistoryDetailLoading(false);
      }
    };
    loadDetails();
    return () => {
      cancelled = true;
    };
  }, [historyOpen, selectedHistorySessionId, workspaceType]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isSending, streamingText, streamBlocks]);

  // Prevent browser file drop
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent, true);
    window.addEventListener("drop", prevent, true);
    return () => {
      window.removeEventListener("dragover", prevent, true);
      window.removeEventListener("drop", prevent, true);
    };
  }, []);

  async function handleSelectSkill(skill: { id: number; name: string } | null) {
    setActiveSkill(skill);
    await apiFetch(`/conversations/${convId}`, {
      method: "PATCH",
      body: JSON.stringify({ skill_id: skill ? skill.id : -1 }),
    }).catch(() => {});
  }

  function handleStop() {
    useChatStore.getState().stopGeneration(convId);
  }

  async function handleClearConversation() {
    if (isSending) {
      window.alert("当前测试进行中，请先停止生成后再清空。");
      return;
    }
    const confirmed = window.confirm("只清除当前聊天记录，历史测试 session、memo 和测试报告会保留。确认清空吗？");
    if (!confirmed) return;
    try {
      await useChatStore.getState().clearMessages(convId);
      setQuote(null);
      setPrefill(null);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "清空失败，请重试");
    }
  }

  function handleOpenHistory() {
    setHistoryOpen(true);
  }

  function handleCloseHistory() {
    setHistoryOpen(false);
  }

  function handleSelectHistorySession(sessionId: number) {
    setSelectedHistorySessionId(sessionId);
    setSelectedHistoryReport(null);
  }

  async function handleViewHistoryReport(sessionId: number) {
    setHistoryDetailLoading(true);
    setHistoryError(null);
    try {
      const report = await apiFetch<SandboxReport>(`/sandbox/interactive/${sessionId}/report`);
      setSelectedHistoryReport(report);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "加载报告失败");
    } finally {
      setHistoryDetailLoading(false);
    }
  }

  const openSandboxGovernancePanel = useCallback(async (
    skillId: number,
    intent: {
      mode: "mount_blocked" | "choose_existing_plan" | "generate_cases";
      triggerMessage: string;
      latestPlan: TestFlowResolveResponse["latest_plan"];
    },
  ) => {
    setSandboxGovernanceLoading(true);
    try {
      const skill = await apiFetch<SkillDetail>(`/skills/${skillId}`);
      setSandboxGovernanceSkill(skill);
      setSandboxTestFlowIntent({
        mode: intent.mode,
        entrySource: "sandbox_chat",
        conversationId: convId,
        triggerMessage: intent.triggerMessage,
        latestPlan: intent.latestPlan,
      });
    } finally {
      setSandboxGovernanceLoading(false);
    }
  }, [convId]);

  const startSandboxTestFlow = useCallback(async (content: string, overrideSkillId?: number | null) => {
    const candidateSkills = sandboxSkills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      status: skill.status,
    }));
    const mentionedSkillIds = findMentionedSkillIds(content, candidateSkills);
    const response = await apiFetch<{ ok: boolean; data: TestFlowResolveResponse }>("/test-flow/resolve-entry", {
      method: "POST",
      body: JSON.stringify({
        entry_source: "sandbox_chat",
        conversation_id: convId,
        content,
        selected_skill_id: overrideSkillId ?? sandboxSkillId ?? null,
        mentioned_skill_ids: mentionedSkillIds,
        candidate_skills: candidateSkills,
      }),
    });
    const resolved = response.data;
    if (resolved.action === "pick_skill") {
      setSandboxTestFlowPrompt({ resolved, content });
      return true;
    }
    if (resolved.action === "chat_default") {
      setSandboxTestFlowPrompt(null);
      return false;
    }
    const skillId = resolved.skill?.id ?? overrideSkillId ?? sandboxSkillId;
    if (!skillId) return false;
    setSandboxTestFlowPrompt(null);
    await openSandboxGovernancePanel(skillId, {
      mode: resolved.action,
      triggerMessage: content,
      latestPlan: resolved.latest_plan ?? null,
    });
    return true;
  }, [convId, openSandboxGovernancePanel, sandboxSkillId, sandboxSkills]);

  // Esc to stop generation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isSending) {
        e.preventDefault();
        handleStop();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSending]);

  /* ── Send message via store ── */

  async function sendConversationMessage(content: string, files?: File[], toolId?: number, multiFiles?: Record<string, File>) {
    await useChatStore.getState().sendMessage(convId, content, {
      activeSkillIds: enabledSkillIds !== null ? Array.from(enabledSkillIds) : undefined,
      toolId,
      files,
      multiFiles,
      forceSkillId: workspaceType === "sandbox" && sandboxSkillId ? sandboxSkillId : undefined,
    });
  }

  async function handleSend(content: string, files?: File[], toolId?: number, multiFiles?: Record<string, File>) {
    const hasFiles = Boolean(files && files.length > 0);
    const hasMultiFiles = Boolean(multiFiles && Object.keys(multiFiles).length > 0);
    if (workspaceType !== "sandbox" || hasFiles || hasMultiFiles || toolId) {
      await sendConversationMessage(content, files, toolId, multiFiles);
      return;
    }

    try {
      const handled = await startSandboxTestFlow(content);
      if (!handled) {
        await sendConversationMessage(content, files, toolId, multiFiles);
      }
    } catch {
      await sendConversationMessage(content, files, toolId, multiFiles);
    }
  }

  const handleQuote = useCallback((text: string) => setQuote(text), []);
  const handleQuickReply = useCallback((text: string) => setPrefill(text), []);

  /* ── Retry on error ── */
  function handleRetry() {
    useChatStore.getState().clearStreamError(convId);
    // Find the last user message and resend
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      handleSend(lastUserMsg.content);
    }
  }

  // Drag & drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isAllowedFile);
    if (droppedFiles.length > 0) handleSend("", droppedFiles);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
          Loading messages...
        </div>
      </div>
    );
  }

  if (isOpencode) {
    const fromSkillId = searchParams.get("from_skill") ? Number(searchParams.get("from_skill")) : undefined;
    const initialViewId = searchParams.get("view_id") ? Number(searchParams.get("view_id")) : undefined;
    return <DevStudio convId={convId} workspaceId={opencodeWorkspaceId ?? undefined} fromSkillId={fromSkillId} initialViewId={initialViewId} />;
  }

  if (isSkillStudio) {
    const skillIdParam = searchParams.get("skill_id");
    const fromParam = searchParams.get("from") ?? undefined;
    const reportIdParam = searchParams.get("report_id") ?? undefined;
    const sessionIdParam = searchParams.get("session_id") ?? undefined;
    return (
      <SkillStudio
        convId={convId}
        initialSkillId={skillIdParam ? Number(skillIdParam) : undefined}
        fromSandbox={fromParam === "sandbox_report"}
        sandboxReportId={reportIdParam}
        sandboxSessionId={sessionIdParam}
      />
    );
  }

  return (
    <div
      className={`h-full flex flex-col relative transition-colors ${isDragOver ? "bg-[#CCF2FF]/20" : ""} ${sandboxGovernanceSkill ? "pr-[420px]" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {sandboxTestSessionModal && (
        <SandboxTestModal
          type="skill"
          id={sandboxTestSessionModal.skillId}
          name={sandboxTestSessionModal.skillName}
          initialSessionId={sandboxTestSessionModal.sessionId}
          onPassed={() => {
            setSandboxTestSessionModal(null);
            void loadSandboxHistory();
          }}
          onCancel={() => {
            setSandboxTestSessionModal(null);
            void loadSandboxHistory();
          }}
        />
      )}
      <SandboxHistoryModal
        open={historyOpen}
        loading={historyLoading}
        detailLoading={historyDetailLoading}
        error={historyError}
        items={sandboxHistory}
        selectedSessionId={selectedHistorySessionId}
        sessionDetail={selectedHistorySession}
        reportDetail={selectedHistoryReport}
        onClose={handleCloseHistory}
        onSelectSession={handleSelectHistorySession}
        onViewReport={handleViewHistoryReport}
      />
      {/* Connection status bar */}
      {connState === "failed" && (
        <div className="bg-red-50 border-b-2 border-red-300 px-4 py-1.5 text-[9px] font-bold text-red-500 flex items-center justify-between">
          <span>连接已断开</span>
          <button
            onClick={() => connectionManager.connect()}
            className="px-2 py-0.5 border border-red-300 bg-white text-red-500 hover:bg-red-50 transition-colors"
          >
            重新连接
          </button>
        </div>
      )}

      {/* Token usage warning */}
      {tokenUsage && tokenUsage.used > tokenUsage.limit * 0.8 && (
        <div className="text-[8px] font-bold text-amber-500 px-4 py-1 bg-amber-50 border-b border-amber-200">
          上下文已使用 {Math.round(tokenUsage.used / tokenUsage.limit * 100)}%，建议新建对话
        </div>
      )}

      {workspaceType === "sandbox" && (
        <div className={`border-b-2 border-[#00CC99] px-4 py-2 flex items-center justify-between gap-3 ${theme === "dark" ? "bg-[#0D2B22]" : "bg-[#F0FFF9]"}`}>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99]">
              沙盒短期聊天记录
            </div>
            <div className="text-[9px] text-[#00CC99]/70 mt-0.5">
              清空只影响当前聊天，历史 session、memo 和报告会保留。
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenHistory}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#00CC99] bg-white text-[#00CC99] hover:bg-[#DDFBED] transition-colors"
            >
              历史测试记录
            </button>
            <button
              onClick={handleClearConversation}
              disabled={isSending || messages.length === 0}
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              清空当前对话
            </button>
          </div>
        </div>
      )}

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-20 border-4 border-dashed border-[#00D1FF] bg-[#CCF2FF]/50 pointer-events-none flex items-center justify-center">
          <div className="bg-white border-2 border-[#1A202C] px-6 py-3 flex items-center gap-2">
            <span className="text-lg">📎</span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#1A202C]">松开以上传文件</span>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {sandboxTestFlowPrompt?.resolved.action === "pick_skill" && sandboxTestFlowPrompt.resolved.candidates && (
          <SandboxTestFlowPromptCard
            candidates={sandboxTestFlowPrompt.resolved.candidates}
            onDismiss={() => setSandboxTestFlowPrompt(null)}
            onPick={async (skillId) => {
              setSandboxSkillId(skillId);
              const pendingContent = sandboxTestFlowPrompt.content;
              setSandboxTestFlowPrompt(null);
              try {
                const handled = await startSandboxTestFlow(pendingContent, skillId);
                if (!handled) {
                  await sendConversationMessage(pendingContent, undefined, undefined, undefined);
                }
              } catch {
                await sendConversationMessage(pendingContent, undefined, undefined, undefined);
              }
            }}
          />
        )}
        {messages.length === 0 && !isSending && workspaceType !== undefined && (
          <div className="h-full flex flex-col items-center justify-center px-8">
            {workspaceType === "sandbox" ? (
              <div className={`max-w-md w-full border-2 border-[#00CC99] p-5 ${theme === "dark" ? "bg-[#0D2B22]" : "bg-[#F0FFF9]"}`}>
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#00CC99] mb-3">
                  🧪 Skill / Tool 沙盒测试
                </div>
                {!sandboxLoaded ? (
                  <div className="text-[11px] text-gray-400 leading-relaxed">加载中...</div>
                ) : sandboxSkills.length > 0 ? (
                  <div className="text-[11px] text-[#1A202C] leading-relaxed">
                    在下方选择要测试的 Skill，然后直接发送任意消息触发测试。
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500 leading-relaxed">
                    你还没有待测试的 Skill。去「Skills &amp; Tools」页面点击「▶ 沙盒测试」来发起测试。
                  </div>
                )}
              </div>
            ) : welcomeMessage ? (
              <div className="max-w-lg w-full border-2 border-[#00A3C4] bg-[#F0FAFF] p-5">
                <div className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">欢迎</div>
                <div className="text-[11px] text-[#1A202C] leading-relaxed whitespace-pre-wrap">
                  {welcomeMessage}
                </div>
              </div>
            ) : (
              <>
                <div className="w-8 h-8 bg-[#CCF2FF] border-2 border-[#00A3C4] flex items-center justify-center mb-3">
                  <span className="text-[#00A3C4] text-xs font-bold">?</span>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                  开始你的对话
                </p>
                <p className="text-[9px] text-gray-300 mt-1">
                  拖放文件到此处，或点击 📎 上传
                </p>
              </>
            )}
          </div>
        )}
        {/* 不显示消息时的沙盒 skill 选择提示 — 已在 welcome 卡片展示 */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} onQuote={handleQuote} onQuickReply={handleQuickReply} />
        ))}

        {/* Agent Loop progress */}
        {isSending && currentRound > 0 && (
          <AgentLoopProgress round={currentRound} maxRounds={maxRounds} />
        )}

        {/* Streaming: show block-level progress or plain text bubble */}
        {isSending && streamBlocks.length > 0 && (
          <StreamingBlocksBubble blocks={streamBlocks} />
        )}
        {isSending && streamBlocks.length === 0 && streamingText && (
          <StreamingBubble text={streamingText} />
        )}
        {isSending && streamBlocks.length === 0 && !streamingText && (
          <StatusIndicator stage={streamStage} isFileUpload={isFileUpload} />
        )}

        {/* Stream error with retry */}
        {streamError && !isSending && (
          <div className="flex justify-start mb-3">
            <div className="bg-red-50 border-2 border-red-300 px-4 py-3 max-w-[75%]">
              <div className="text-[10px] font-bold text-red-500 mb-1">
                {streamError.type === "rate_limit" ? "请求频率超限" :
                 streamError.type === "context_overflow" ? "上下文长度超限" :
                 streamError.type === "network" ? "网络连接错误" :
                 "服务端错误"}
              </div>
              <div className="text-[9px] text-red-400 mb-2">{streamError.message}</div>
              <button
                onClick={handleRetry}
                className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-red-300 bg-white text-red-500 hover:bg-red-50 transition-colors"
              >
                重试
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stop generation button */}
      {isSending && !isFileUpload && (
        <div className="flex justify-center py-1.5 border-t border-gray-100 bg-white/80">
          <button
            onClick={handleStop}
            className="px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8] transition-colors flex items-center gap-1.5"
          >
            <span className="w-2 h-2 bg-[#1A202C]" />
            停止生成
          </button>
        </div>
      )}

      {/* Sandbox skill selector */}
      {workspaceType === "sandbox" && sandboxSkills.length > 0 && (
        <div className={`border-t-2 border-[#00CC99] px-4 py-2 space-y-1.5 ${theme === "dark" ? "bg-[#0D2B22]" : "bg-[#F0FFF9]"}`}>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold uppercase tracking-widest text-[#00CC99]">选择测试对象</span>
            {sandboxSkillId && (
              <span className="text-[8px] text-[#00CC99]/60">— 选好后发消息即可触发测试</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sandboxSkills.map((sk) => (
              <button
                key={sk.id}
                onClick={() => setSandboxSkillId(sk.id)}
                className={`px-2 py-0.5 text-[9px] font-bold border-2 transition-colors ${
                  sandboxSkillId === sk.id
                    ? "border-[#00CC99] bg-[#00CC99] text-white"
                    : "border-[#00CC99] text-[#00CC99] bg-transparent hover:bg-[#00CC99]/20"
                }`}
              >
                {sk.name}
                {sk.status === "draft" && (
                  <span className="ml-1 text-[7px] opacity-60">草稿</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Workspace Skill filter panel */}
      {visibleWorkspaceSkills.length > 1 && (
        <div className="border-t border-gray-200 bg-[#F8FCFE]">
          <button
            onClick={() => setSkillPanelOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#00A3C4] transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span className="text-[#00D1FF]">▣</span>
              工作空间 Skill
              {enabledSkillIds !== null && (
                <span className="ml-1 px-1 py-0.5 bg-[#1A202C] text-[#00D1FF] text-[8px] font-bold">
                  {enabledSkillIds.size}/{visibleWorkspaceSkills.length}
                </span>
              )}
            </span>
            <span>{skillPanelOpen ? "▲" : "▼"}</span>
          </button>
          {skillPanelOpen && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => setEnabledSkillIds(null)}
                className={`px-2 py-1 text-[9px] font-bold border-2 transition-colors ${
                  enabledSkillIds === null
                    ? "border-[#1A202C] bg-[#1A202C] text-white"
                    : "border-gray-300 text-gray-400 hover:border-[#1A202C] hover:text-[#1A202C]"
                }`}
              >
                全部
              </button>
              {visibleWorkspaceSkills.map((sk) => {
                const enabled = enabledSkillIds === null || enabledSkillIds.has(sk.id);
                return (
                  <button
                    key={sk.id}
                    title={sk.description || sk.name}
                    onClick={() => {
                      setEnabledSkillIds((prev) => {
                        const base = prev ?? new Set(visibleWorkspaceSkills.map((s) => s.id));
                        const next = new Set(base);
                        if (next.has(sk.id)) { next.delete(sk.id); } else { next.add(sk.id); }
                        if (next.size === visibleWorkspaceSkills.length) return null;
                        return next;
                      });
                    }}
                    className={`px-2 py-1 text-[9px] font-bold border-2 transition-colors ${
                      enabled
                        ? "border-[#00A3C4] bg-[#CCF2FF] text-[#00A3C4]"
                        : "border-gray-200 bg-white text-gray-300"
                    }`}
                  >
                    <span className="text-[#00D1FF]">#</span> {sk.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isSending}
        quote={quote}
        onClearQuote={() => setQuote(null)}
        workspaceSkills={enabledSkillIds !== null ? visibleWorkspaceSkills.filter((s) => enabledSkillIds.has(s.id)) : visibleWorkspaceSkills}
        activeSkill={activeSkill}
        onSelectSkill={handleSelectSkill}
        workspaceTools={workspaceTools}
        prefill={prefill}
        onClearPrefill={() => setPrefill(null)}
      />

      {(sandboxGovernanceSkill || sandboxGovernanceLoading) && (
        <div className="absolute inset-y-0 right-0 z-20 w-[420px] border-l-2 border-[#1A202C] bg-white">
          {sandboxGovernanceLoading || !sandboxGovernanceSkill ? (
            <div className="h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-[#00A3C4]">
              加载测试流程...
            </div>
          ) : (
            <SkillGovernancePanel
              skill={sandboxGovernanceSkill}
              testFlowIntent={sandboxTestFlowIntent}
              onClose={() => {
                setSandboxGovernanceSkill(null);
                setSandboxTestFlowIntent(null);
              }}
              onMaterializedSession={(sessionId) => {
                setSandboxTestSessionModal({
                  skillId: sandboxGovernanceSkill.id,
                  skillName: sandboxGovernanceSkill.name,
                  sessionId,
                });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
