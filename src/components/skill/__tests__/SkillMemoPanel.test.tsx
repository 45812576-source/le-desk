import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SkillMemoPanel } from "../SkillMemoPanel";
import type { SkillMemo } from "@/lib/types";

const baseMemo: SkillMemo = {
  skill_id: 1,
  scenario_type: "import_remediation",
  lifecycle_stage: "fixing",
  status_summary: "等待修复",
  goal_summary: null,
  persistent_notices: [],
  current_task: {
    id: "task_current",
    title: "修复 evidence 展示",
    type: "fix_prompt_logic",
    status: "in_progress",
    priority: "high",
    description: "把 evidence 和 acceptance 展示在 UI 中",
    target_files: ["example.md"],
    acceptance_rule: { mode: "custom", text: "可点击打开目标文件" },
    depends_on: [],
    target_kind: "source_file",
    target_ref: "example.md",
    acceptance_rule_text: "点击任务可打开 example.md",
    evidence_snippets: ["证据片段 A"],
  },
  next_task: null,
  memo: {
    tasks: [
      {
        id: "task_current",
        title: "修复 evidence 展示",
        type: "fix_prompt_logic",
        status: "in_progress",
        priority: "high",
        description: "把 evidence 和 acceptance 展示在 UI 中",
        target_files: ["example.md"],
        acceptance_rule: { mode: "custom", text: "可点击打开目标文件" },
        depends_on: [],
        target_kind: "source_file",
        target_ref: "example.md",
        acceptance_rule_text: "点击任务可打开 example.md",
        evidence_snippets: ["证据片段 A"],
      },
    ],
  },
  latest_test: {
    id: "test_1",
    source: "sandbox_interactive",
    version: 1,
    status: "failed",
    summary: "缺少 evidence 展示",
    details: { approval_eligible: false, blocking_reasons: ["evidence_snippets 未展示"] },
    created_at: "2026-04-17T00:00:00Z",
    followup_task_ids: [],
  },
  workflow_recovery: null,
};

describe("SkillMemoPanel", () => {
  it("opens current target file and renders evidence and acceptance", () => {
    const onOpenTarget = vi.fn();

    render(
      <SkillMemoPanel
        memo={baseMemo}
        onStartTask={vi.fn()}
        onDirectTest={vi.fn()}
        onOpenTarget={onOpenTarget}
      />,
    );

    expect(screen.getByText("验收：点击任务可打开 example.md")).toBeInTheDocument();
    expect(screen.getByText("证据片段 A")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "example.md" })[0]);
    expect(onOpenTarget).toHaveBeenCalledWith("asset", "example.md");
  });
});
