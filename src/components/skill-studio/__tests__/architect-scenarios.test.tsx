import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GovernanceTimeline } from "../GovernanceTimeline";
import type {
  ArchitectArtifact,
  ChatMessage,
  ArchitectPhaseStatus,
  ArchitectQuestion,
  ArchitectPhaseSummary,
  ArchitectStructure,
  ArchitectPriorityMatrix,
  ArchitectOodaDecision,
  ArchitectReadyForDraft,
  AuditResult,
  PhaseProgress,
} from "../types";

// ─── Shared helpers ──────────────────────────────────────────────────────────

const noop = vi.fn();

/** Minimal required props for GovernanceTimeline */
function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    messages: [] as ChatMessage[],
    streaming: false,
    streamStage: null,
    governanceCards: [],
    auditResult: null,
    pendingGovernanceActions: [],
    onGovernanceAction: noop,
    onDismissGovernance: noop,
    onDismissAudit: noop,
    onAdoptGovernanceAction: noop,
    onQuickAction: noop,
    ...overrides,
  };
}

// ─── 场景 1：新建 Skill 从 Phase 1 开始 ──────────────────────────────────────

describe("场景 1：新建 Skill → Phase 1 全流程", () => {
  const phase: ArchitectPhaseStatus = {
    phase: "phase_1_why",
    mode_source: "create_new_skill",
    ooda_round: 0,
  };

  const questions: ArchitectQuestion[] = [
    { question: "这个 Skill 解决什么场景？", phase: "phase_1_why", framework: "jtbd", options: ["竞品分析", "用户调研"] },
    { question: "目标用户是谁？", phase: "phase_1_why", framework: "first_principles" },
  ];

  const summary: ArchitectPhaseSummary = {
    phase: "phase_1_why",
    summary: "核心问题是决策质量不稳定",
    deliverables: ["根因分析", "场景列表"],
    confidence: 80,
    ready_for_next: true,
  };

  it("渲染 Phase 1 状态卡 + 问题卡", () => {
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          architectQuestions: questions,
          answeredQuestionIdx: -1,
        })}
      />,
    );
    // Phase card renders
    expect(screen.getByText("Phase 1 · 问题定义")).toBeTruthy();
    // Both questions render
    expect(screen.getByText("这个 Skill 解决什么场景？")).toBeTruthy();
    expect(screen.getByText("目标用户是谁？")).toBeTruthy();
    // Options for Q1
    expect(screen.getByText("竞品分析")).toBeTruthy();
  });

  it("回答问题后 Q1 折叠，Q2 仍展开", () => {
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          architectQuestions: questions,
          answeredQuestionIdx: 0, // Q1 answered
        })}
      />,
    );
    // Q1 options should be hidden (answered → compact)
    expect(screen.queryByText("竞品分析")).toBeFalsy();
    // Q2 inline input should be visible (no options → input)
    expect(screen.getByPlaceholderText("输入你的回答...")).toBeTruthy();
  });

  it("阶段总结卡出现，可确认", () => {
    const onConfirm = vi.fn();
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          architectQuestions: questions,
          answeredQuestionIdx: 1,
          pendingPhaseSummary: summary,
          onArchitectConfirm: onConfirm,
        })}
      />,
    );
    expect(screen.getByText("核心问题是决策质量不稳定")).toBeTruthy();
    expect(screen.getByText("确认进入下一阶段")).toBeTruthy();
    fireEvent.click(screen.getByText("确认进入下一阶段"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("渲染 Why 阶段沉淀的结构化 artifacts", () => {
    const artifacts: ArchitectArtifact[] = [
      {
        id: "artifact:phase_1_why:why_chain:latest",
        artifactKey: "why_chain",
        title: "Why Chain",
        phase: "phase_1_why",
        cardId: "create:architect:5whys",
        contractId: "architect.why.5whys",
        data: ["表面需求", "流程判断不稳定", "缺少统一框架"],
      },
      {
        id: "artifact:phase_1_why:root_cause:latest",
        artifactKey: "root_cause",
        title: "真实根因",
        phase: "phase_1_why",
        cardId: "create:architect:5whys",
        contractId: "architect.why.5whys",
        data: "团队缺少统一的问题拆解方法",
      },
    ];

    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          architectArtifacts: artifacts,
        })}
      />,
    );

    expect(screen.getByText("Skill Architect 沉淀结果")).toBeTruthy();
    expect(screen.getByText("流程判断不稳定")).toBeTruthy();
    expect(screen.getByText("团队缺少统一的问题拆解方法")).toBeTruthy();
  });

  it("确认后显示 PhaseProgress", () => {
    const progress: PhaseProgress[] = [
      { completed_phase: "phase1", phase_label: "问题定义", deliverables: ["根因分析", "场景列表"], next_phase: "phase2", next_label: "要素拆解" },
    ];
    render(
      <GovernanceTimeline
        {...baseProps({
          phaseProgress: progress,
          confirmedPhases: ["phase_1_why"],
        })}
      />,
    );
    expect(screen.getByText(/问题定义/)).toBeTruthy();
    expect(screen.getByText("根因分析 · 场景列表")).toBeTruthy();
    expect(screen.getByText(/要素拆解/)).toBeTruthy();
  });
});

// ─── 场景 2：已有 Skill 框架层优化 ──────────────────────────────────────────

describe("场景 2：已有 Skill 优化 → 结构卡渲染", () => {
  const phase: ArchitectPhaseStatus = {
    phase: "phase_2_what",
    mode_source: "optimize_existing_skill",
    ooda_round: 0,
  };

  const tree: ArchitectStructure = {
    type: "issue_tree",
    root: "Skill 结构缺陷",
    nodes: [
      { id: "root", label: "Skill 结构缺陷", parent: null, children: ["a", "b"] },
      { id: "a", label: "知识库覆盖不全", parent: "root", children: [] },
      { id: "b", label: "逻辑链路不完整", parent: "root", children: [] },
    ],
  };

  it("渲染 Phase 2 状态卡 + issue tree", () => {
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          architectStructures: [tree],
        })}
      />,
    );
    expect(screen.getByText("Phase 2 · 要素拆解")).toBeTruthy();
    expect(screen.getByText(/Issue Tree/)).toBeTruthy();
    expect(screen.getByText("知识库覆盖不全")).toBeTruthy();
    expect(screen.getByText("逻辑链路不完整")).toBeTruthy();
  });

  it("优化模式标签正确显示", () => {
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
        })}
      />,
    );
    expect(screen.getByText(/优化 Skill/)).toBeTruthy();
  });
});

// ─── 场景 3：导入 Skill 质量差触发升级 ──────────────────────────────────────

describe("场景 3：导入 Skill 审计差 → 升级进入 architect", () => {
  const audit: AuditResult = {
    quality_score: 25,
    severity: "high",
    issues: [
      { dimension: "结构完整性", score: 20, detail: "缺少场景定义" },
      { dimension: "逻辑一致性", score: 30, detail: "多处矛盾" },
    ],
    recommended_path: "restructure",
    phase_entry: "phase1",
  };

  it("渲染审计报告卡（高严重度）", () => {
    render(
      <GovernanceTimeline
        {...baseProps({
          auditResult: audit,
        })}
      />,
    );
    expect(screen.getByText(/Skill 审计结论/)).toBeTruthy();
    expect(screen.getByText("25")).toBeTruthy();
    expect(screen.getByText("结构完整性")).toBeTruthy();
    expect(screen.getByText("缺少场景定义")).toBeTruthy();
  });

  it("审计后可进入 architect Phase 1", () => {
    const phase: ArchitectPhaseStatus = {
      phase: "phase_1_why",
      mode_source: "audit_imported_skill",
      ooda_round: 0,
      upgrade_reason: "审计评分过低(25/100)，建议重构",
    };
    render(
      <GovernanceTimeline
        {...baseProps({
          auditResult: audit,
          architectPhase: phase,
        })}
      />,
    );
    // Phase card shows
    expect(screen.getByText("Phase 1 · 问题定义")).toBeTruthy();
    // Expand detail to see upgrade_reason
    fireEvent.click(screen.getByText(/补充说明/));
    expect(screen.getByText(/审计评分过低/)).toBeTruthy();
  });
});

// ─── 场景 4：用户已有 spec 直接进 Phase 3 ──────────────────────────────────

describe("场景 4：完整 spec → 直接 Phase 3 + 优先级矩阵", () => {
  const phase: ArchitectPhaseStatus = {
    phase: "phase_3_how",
    mode_source: "create_new_skill",
    ooda_round: 0,
  };

  const matrix: ArchitectPriorityMatrix = {
    dimensions: [
      { name: "竞品对比", priority: "P0", sensitivity: "high", reason: "直接影响决策" },
      { name: "成本估算", priority: "P1", sensitivity: "medium", reason: "辅助参考" },
      { name: "历史数据", priority: "P2", sensitivity: "low", reason: "锦上添花" },
    ],
  };

  const summary: ArchitectPhaseSummary = {
    phase: "phase_3_how",
    summary: "验证收敛完成，所有维度已覆盖",
    deliverables: ["优先级矩阵", "失败预防清单"],
    confidence: 90,
    ready_for_next: true,
  };

  it("渲染 Phase 3 状态卡 + 优先级矩阵", () => {
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          architectPriorities: [matrix],
        })}
      />,
    );
    expect(screen.getByText("Phase 3 · 验证收敛")).toBeTruthy();
    expect(screen.getByText("竞品对比")).toBeTruthy();
    expect(screen.getByText("直接影响决策")).toBeTruthy();
    expect(screen.getByText("成本估算")).toBeTruthy();
    expect(screen.getByText("历史数据")).toBeTruthy();
  });

  it("Phase 3 确认后可生成草稿", () => {
    const onConfirm = vi.fn();
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          architectPriorities: [matrix],
          pendingPhaseSummary: summary,
          onArchitectConfirm: onConfirm,
        })}
      />,
    );
    expect(screen.getByText("验证收敛完成，所有维度已覆盖")).toBeTruthy();
    fireEvent.click(screen.getByText("确认进入下一阶段"));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe("快捷 chat：Skill 创作工作台", () => {
  it("默认不再展示硬编码内容型快捷动作", () => {
    render(
      <GovernanceTimeline
        {...baseProps({
          messages: [{ role: "assistant", text: "已进入创作模式", loading: false }],
        })}
      />,
    );

    expect(screen.queryByText("补齐描述")).toBeNull();
    expect(screen.queryByText("重写定位")).toBeNull();
    expect(screen.queryByText("输出草稿")).toBeNull();
    expect(screen.queryByText("只改这段")).toBeNull();
    expect(screen.queryByText("收敛成版")).toBeNull();
  });

  it("只展示上层透传的快捷动作并回传 dispatch", () => {
    const onQuickAction = vi.fn();
    render(
      <GovernanceTimeline
        {...baseProps({
          messages: [{ role: "assistant", text: "已进入创作模式", loading: false }],
          onQuickAction,
          overrideQuickActions: [{
            label: "直接输出草稿",
            msg: "信息足够了，请直接输出完整可用的 SKILL.md 草稿",
            dispatch: "agent",
          }],
        })}
      />,
    );

    fireEvent.click(screen.getByText("直接输出草稿"));
    expect(onQuickAction).toHaveBeenCalledWith({
      label: "直接输出草稿",
      msg: "信息足够了，请直接输出完整可用的 SKILL.md 草稿",
      dispatch: "agent",
    });
  });
});

// ─── 场景 5：两轮 OODA 后进入 ready for draft ────────────────────────────────

describe("场景 5：OODA 两轮迭代 → ready for draft", () => {
  const phase: ArchitectPhaseStatus = {
    phase: "ooda_iteration",
    mode_source: "create_new_skill",
    ooda_round: 2,
  };

  const decisions: ArchitectOodaDecision[] = [
    {
      ooda_round: 1,
      observation: "Phase 2 缺少竞品维度",
      orientation: "需要补充竞品分析框架",
      decision: "回调 Phase 2 补充 MECE 拆解",
      delta_from_last: "初始迭代",
    },
    {
      ooda_round: 2,
      observation: "竞品维度已补充，覆盖率达标",
      orientation: "所有维度满足阈值",
      decision: "进入 ready for draft",
      delta_from_last: "新增 3 个竞品维度",
    },
  ];

  const ready: ArchitectReadyForDraft = {
    key_elements: [
      { name: "竞品分析", priority: "P0", source_phase: "Phase 2" },
      { name: "用户画像", priority: "P0", source_phase: "Phase 1" },
      { name: "成本模型", priority: "P1", source_phase: "Phase 3" },
    ],
    failure_prevention: ["竞品数据可能过时，需定期更新", "用户画像样本量不足"],
    draft_approach: "先输出结构骨架，再逐章填充",
  };

  it("渲染两轮 OODA 决策卡", () => {
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          oodaDecisions: decisions,
        })}
      />,
    );
    // OODA phase card with round badge
    expect(screen.getByText("OODA · 迭代收敛")).toBeTruthy();
    // Both rounds visible
    expect(screen.getByText(/OODA · 第 1 轮/)).toBeTruthy();
    expect(screen.getByText(/OODA · 第 2 轮/)).toBeTruthy();
    // Content from decisions
    expect(screen.getByText("Phase 2 缺少竞品维度")).toBeTruthy();
    expect(screen.getByText("竞品维度已补充，覆盖率达标")).toBeTruthy();
  });

  it("OODA 继续推进按钮可点击", () => {
    const onContinue = vi.fn();
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          oodaDecisions: [decisions[0]],
          onOodaContinue: onContinue,
        })}
      />,
    );
    fireEvent.click(screen.getByText("继续推进"));
    expect(onContinue).toHaveBeenCalled();
  });

  it("ready for draft 渲染关键要素 + 生成按钮", () => {
    const onGenerate = vi.fn();
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          oodaDecisions: decisions,
          architectReady: ready,
          onGenerateDraft: onGenerate,
        })}
      />,
    );
    // Key elements
    expect(screen.getByText("竞品分析")).toBeTruthy();
    expect(screen.getByText("用户画像")).toBeTruthy();
    expect(screen.getByText("成本模型")).toBeTruthy();
    // Failure prevention
    expect(screen.getByText("竞品数据可能过时，需定期更新")).toBeTruthy();
    expect(screen.getByText("用户画像样本量不足")).toBeTruthy();
    // Generate button
    expect(screen.getByText("生成 Skill 草稿")).toBeTruthy();
    fireEvent.click(screen.getByText("生成 Skill 草稿"));
    expect(onGenerate).toHaveBeenCalled();
  });

  it("完整流程：OODA → ready → 点击生成", () => {
    const onGenerate = vi.fn();
    const onContinue = vi.fn();
    render(
      <GovernanceTimeline
        {...baseProps({
          architectPhase: phase,
          oodaDecisions: decisions,
          architectReady: ready,
          onOodaContinue: onContinue,
          onGenerateDraft: onGenerate,
        })}
      />,
    );
    // Verify full rendering chain: phase → ooda decisions → ready
    expect(screen.getByText("OODA · 迭代收敛")).toBeTruthy(); // phase card
    expect(screen.getByText(/OODA · 第 1 轮/)).toBeTruthy(); // decision 1
    expect(screen.getByText(/OODA · 第 2 轮/)).toBeTruthy(); // decision 2
    expect(screen.getByText("生成 Skill 草稿")).toBeTruthy(); // ready card

    // Click generate
    fireEvent.click(screen.getByText("生成 Skill 草稿"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});
