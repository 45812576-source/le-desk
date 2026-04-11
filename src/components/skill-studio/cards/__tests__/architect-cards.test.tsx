import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArchitectQuestionCard } from "../ArchitectQuestionCard";
import { ArchitectConfirmCard } from "../ArchitectConfirmCard";
import { ArchitectStructureCard, PriorityMatrixView } from "../ArchitectStructureCard";
import { OodaDecisionView, ReadyForDraftView } from "../ArchitectDecisionCard";
import { ArchitectPhaseCard } from "../ArchitectPhaseCard";
import type {
  ArchitectQuestion,
  ArchitectPhaseSummary,
  ArchitectStructure,
  ArchitectPriorityMatrix,
  ArchitectOodaDecision,
  ArchitectReadyForDraft,
  ArchitectPhaseStatus,
} from "../../types";

// ─── ArchitectQuestionCard ──────────────────────────────────────────────────

describe("ArchitectQuestionCard", () => {
  const baseQuestion: ArchitectQuestion = {
    question: "这个 Skill 解决什么场景？",
    phase: "phase_1_why",
    framework: "jtbd",
    options: ["竞品分析", "用户调研", "内部决策"],
  };

  it("renders the question text and options", () => {
    render(
      <ArchitectQuestionCard
        question={baseQuestion}
        answered={false}
        onAnswer={vi.fn()}
        onCustom={vi.fn()}
      />,
    );
    expect(screen.getByText("这个 Skill 解决什么场景？")).toBeTruthy();
    expect(screen.getByText("竞品分析")).toBeTruthy();
    expect(screen.getByText("用户调研")).toBeTruthy();
    expect(screen.getByText("内部决策")).toBeTruthy();
  });

  it("calls onAnswer when an option is clicked", () => {
    const onAnswer = vi.fn();
    render(
      <ArchitectQuestionCard
        question={baseQuestion}
        answered={false}
        onAnswer={onAnswer}
        onCustom={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("竞品分析"));
    expect(onAnswer).toHaveBeenCalledWith("竞品分析");
  });

  it("renders compact mode when answered", () => {
    const { container } = render(
      <ArchitectQuestionCard
        question={baseQuestion}
        answered={true}
        onAnswer={vi.fn()}
        onCustom={vi.fn()}
      />,
    );
    // Compact mode has opacity-60
    expect(container.querySelector(".opacity-60")).toBeTruthy();
    // Options should not be rendered
    expect(screen.queryByText("用户调研")).toBeFalsy();
  });

  it("renders inline input when no options", () => {
    const noOptionsQ: ArchitectQuestion = {
      question: "请描述目标用户",
      phase: "phase_1_why",
      framework: "first_principles",
    };
    render(
      <ArchitectQuestionCard
        question={noOptionsQ}
        answered={false}
        onAnswer={vi.fn()}
        onCustom={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("输入你的回答...")).toBeTruthy();
  });
});

// ─── ArchitectConfirmCard ───────────────────────────────────────────────────

describe("ArchitectConfirmCard", () => {
  const baseSummary: ArchitectPhaseSummary = {
    phase: "phase_1_why",
    summary: "已确认核心问题是决策质量不稳定",
    deliverables: ["根因分析", "场景列表"],
    confidence: 75,
    ready_for_next: true,
  };

  it("renders summary and deliverables", () => {
    render(
      <ArchitectConfirmCard
        summary={baseSummary}
        confirmed={false}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(screen.getByText("已确认核心问题是决策质量不稳定")).toBeTruthy();
    expect(screen.getByText("根因分析")).toBeTruthy();
    expect(screen.getByText("场景列表")).toBeTruthy();
  });

  it("renders confirm and revise buttons", () => {
    render(
      <ArchitectConfirmCard
        summary={baseSummary}
        confirmed={false}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(screen.getByText("确认进入下一阶段")).toBeTruthy();
    expect(screen.getByText("我想修正")).toBeTruthy();
  });

  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ArchitectConfirmCard
        summary={baseSummary}
        confirmed={false}
        onConfirm={onConfirm}
        onRevise={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("确认进入下一阶段"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("renders compact mode when confirmed", () => {
    const { container } = render(
      <ArchitectConfirmCard
        summary={baseSummary}
        confirmed={true}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(container.querySelector(".opacity-60")).toBeTruthy();
    expect(screen.getByText("已确认")).toBeTruthy();
    expect(screen.queryByText("确认进入下一阶段")).toBeFalsy();
  });

  it("shows low confidence hint when not ready", () => {
    const lowConfidence: ArchitectPhaseSummary = {
      ...baseSummary,
      confidence: 30,
      ready_for_next: false,
    };
    render(
      <ArchitectConfirmCard
        summary={lowConfidence}
        confirmed={false}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(screen.getByText("信心度不足，建议补充更多信息后再确认")).toBeTruthy();
    expect(screen.getByText("继续完善")).toBeTruthy();
  });
});

// ─── ArchitectStructureCard ─────────────────────────────────────────────────

describe("ArchitectStructureCard", () => {
  it("renders issue tree with root and children", () => {
    const tree: ArchitectStructure = {
      type: "issue_tree",
      root: "决策质量不稳定",
      nodes: [
        { id: "root", label: "决策质量不稳定", parent: null, children: ["a", "b"] },
        { id: "a", label: "输入维度不全", parent: "root", children: [] },
        { id: "b", label: "逻辑框架缺失", parent: "root", children: [] },
      ],
    };
    render(<ArchitectStructureCard structure={tree} />);
    expect(screen.getByText(/Issue Tree/)).toBeTruthy();
    expect(screen.getAllByText("决策质量不稳定").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("输入维度不全")).toBeTruthy();
    expect(screen.getByText("逻辑框架缺失")).toBeTruthy();
  });

  it("renders value chain as linear flow", () => {
    const chain: ArchitectStructure = {
      type: "value_chain",
      root: "数据流程",
      nodes: [
        { id: "root", label: "数据流程", parent: null, children: ["s1", "s2", "s3"] },
        { id: "s1", label: "采集", parent: "root", children: [] },
        { id: "s2", label: "清洗", parent: "root", children: [] },
        { id: "s3", label: "分析", parent: "root", children: [] },
      ],
    };
    render(<ArchitectStructureCard structure={chain} />);
    expect(screen.getByText(/Value Chain/)).toBeTruthy();
    expect(screen.getByText("采集")).toBeTruthy();
    expect(screen.getByText("清洗")).toBeTruthy();
    expect(screen.getByText("分析")).toBeTruthy();
  });
});

describe("PriorityMatrixView", () => {
  it("renders dimensions with priority colors", () => {
    const matrix: ArchitectPriorityMatrix = {
      dimensions: [
        { name: "竞品分析", priority: "P0", sensitivity: "high", reason: "影响核心结论" },
        { name: "成本模型", priority: "P2", sensitivity: "low", reason: "锦上添花" },
      ],
    };
    render(<PriorityMatrixView matrix={matrix} />);
    expect(screen.getByText("竞品分析")).toBeTruthy();
    expect(screen.getByText("影响核心结论")).toBeTruthy();
    expect(screen.getByText("成本模型")).toBeTruthy();
  });
});

// ─── OODA Decision & ReadyForDraft ──────────────────────────────────────────

describe("OodaDecisionView", () => {
  it("renders OODA fields and continue button", () => {
    const decision: ArchitectOodaDecision = {
      ooda_round: 2,
      observation: "上一轮新增了竞品维度",
      orientation: "核心逻辑框架仍有缺口",
      decision: "回调 Phase 2 补充 MECE 拆解",
      delta_from_last: "新增 2 个维度",
    };
    const onContinue = vi.fn();
    render(
      <OodaDecisionView decision={decision} phaseStatus={null} onContinue={onContinue} />,
    );
    expect(screen.getByText(/OODA · 第 2 轮/)).toBeTruthy();
    expect(screen.getByText("上一轮新增了竞品维度")).toBeTruthy();
    expect(screen.getByText("继续推进")).toBeTruthy();
    fireEvent.click(screen.getByText("继续推进"));
    expect(onContinue).toHaveBeenCalled();
  });
});

describe("ReadyForDraftView", () => {
  it("renders key elements and generate button", () => {
    const ready: ArchitectReadyForDraft = {
      key_elements: [
        { name: "竞品分析", priority: "P0", source_phase: "Phase 2" },
        { name: "用户画像", priority: "P1", source_phase: "Phase 1" },
      ],
      failure_prevention: ["竞品数据可能过时"],
      draft_approach: "先输出结构骨架，再逐章填充",
    };
    const onGenerate = vi.fn();
    render(<ReadyForDraftView ready={ready} onGenerateDraft={onGenerate} />);
    expect(screen.getByText("竞品分析")).toBeTruthy();
    expect(screen.getByText("竞品数据可能过时")).toBeTruthy();
    expect(screen.getByText("生成 Skill 草稿")).toBeTruthy();
    fireEvent.click(screen.getByText("生成 Skill 草稿"));
    expect(onGenerate).toHaveBeenCalled();
  });
});

// ─── ArchitectPhaseCard (P2-2: framework collapsible) ───────────────────────

describe("ArchitectPhaseCard", () => {
  const phase: ArchitectPhaseStatus = {
    phase: "phase_1_why",
    mode_source: "create_new_skill",
    ooda_round: 0,
  };

  it("renders phase label and goal", () => {
    render(<ArchitectPhaseCard phase={phase} />);
    expect(screen.getByText("Phase 1 · 问题定义")).toBeTruthy();
    expect(screen.getByText(/确认根因/)).toBeTruthy();
  });

  it("hides frameworks by default (P2-2 collapsed)", () => {
    render(<ArchitectPhaseCard phase={phase} />);
    // Frameworks should not be visible initially
    expect(screen.queryByText("5 Whys")).toBeFalsy();
    expect(screen.queryByText("JTBD")).toBeFalsy();
    // But toggle button should exist
    expect(screen.getByText(/框架与细节/)).toBeTruthy();
  });

  it("shows frameworks after clicking toggle", () => {
    render(<ArchitectPhaseCard phase={phase} />);
    fireEvent.click(screen.getByText(/框架与细节/));
    expect(screen.getByText("5 Whys")).toBeTruthy();
    expect(screen.getByText("JTBD")).toBeTruthy();
    expect(screen.getByText("第一性原理")).toBeTruthy();
  });
});
