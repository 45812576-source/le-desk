import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptEditor } from "../PromptEditor";
import type { DiffOp, StagedEdit } from "../types";

const mockApiFetch = vi.fn();

const mockStoreState: {
  stagedEdits: StagedEdit[];
  syncGovernanceCards: ReturnType<typeof vi.fn>;
  syncStagedEdits: ReturnType<typeof vi.fn>;
  setWorkflowState: ReturnType<typeof vi.fn>;
  preflightRefreshToken: number;
} = {
  stagedEdits: [],
  syncGovernanceCards: vi.fn(),
  syncStagedEdits: vi.fn(),
  setWorkflowState: vi.fn(),
  preflightRefreshToken: 0,
};

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  getToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ user: { id: 1, username: "tester" } }),
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "lab" }),
}));

vi.mock("@/lib/studio-store", () => ({
  useStudioStore: (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

vi.mock("@/components/pixel", () => ({
  ICONS: { skills: {} },
  PixelIcon: () => <div data-testid="pixel-icon" />,
}));

vi.mock("@/components/pixel/PixelButton", () => ({
  PixelButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));

vi.mock("../DiffViewer", () => ({
  DiffViewer: ({ oldText, newText }: { oldText: string; newText: string }) => (
    <div data-testid="diff-viewer">
      <div>{oldText}</div>
      <div>{newText}</div>
    </div>
  ),
  LineNumberedEditor: () => <div data-testid="line-editor" />,
}));

vi.mock("../PreflightReport", () => ({
  PreflightReport: () => null,
}));

vi.mock("../KnowledgeConfirmModal", () => ({
  KnowledgeConfirmModal: () => null,
}));

describe("PromptEditor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockStoreState.stagedEdits = [];
    mockStoreState.syncGovernanceCards.mockReset();
    mockStoreState.syncStagedEdits.mockReset();
    mockStoreState.setWorkflowState.mockReset();
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/skills/1") {
        return Promise.resolve({
          id: 1,
          name: "测试 Skill",
          description: "旧描述",
          status: "draft",
          versions: [{ id: 11, version: 1, system_prompt: "## 角色\n你是助手", created_at: "2026-04-17T00:00:00" }],
          system_prompt: "## 角色\n你是助手",
          data_queries: [],
        });
      }
      if (path === "/skills/1/files/SKILL.md") {
        return Promise.reject(new Error("missing"));
      }
      return Promise.resolve([]);
    });
  });

  it("shows metadata description diff preview for pending staged edit", async () => {
    mockStoreState.stagedEdits = [{
      id: "se-description",
      fileType: "metadata",
      filename: "metadata",
      status: "pending",
      changeNote: "更新 description",
      diff: [{ type: "replace", old: "description", new: "新描述" } satisfies DiffOp],
    }];

    render(
      <PromptEditor
        skill={{ id: 1, name: "测试 Skill", description: "旧描述", status: "draft" } as never}
        isNew={false}
        prompt="## 角色\n你是助手"
        onPromptChange={vi.fn()}
        onSaved={vi.fn()}
        onFork={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByDisplayValue("旧描述")).toBeTruthy());

    expect(screen.getByText("待确认治理修改：更新 description")).toBeTruthy();
    expect(screen.getByText("Skill 描述")).toBeTruthy();
    expect(screen.getByText("新描述")).toBeTruthy();
  });

  it("shows adopted prompt diff even after editor content is already updated", async () => {
    render(
      <PromptEditor
        skill={{ id: 1, name: "测试 Skill", description: "旧描述", status: "draft" } as never}
        isNew={false}
        prompt={"## 角色\n你是全新助手"}
        onPromptChange={vi.fn()}
        onSaved={vi.fn()}
        onFork={vi.fn()}
        adoptedPreviewEdit={{
          id: "se-adopted-prompt",
          fileType: "system_prompt",
          filename: "SKILL.md",
          status: "adopted",
          changeNote: "改写角色定义",
          diff: [{ type: "replace", old: "助手", new: "全新助手" }],
        }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("diff-viewer")).toBeTruthy());
    const diffViewer = screen.getByTestId("diff-viewer");
    expect(screen.getByText(/已采纳治理修改/)).toBeTruthy();
    expect(diffViewer.textContent).toContain("## 角色\n你是助手");
    expect(diffViewer.textContent).toContain("## 角色\n你是全新助手");
  });

  it("opens governance panel intent when preflight gate is blocked", async () => {
    const onOpenTestFlowPanel = vi.fn();

    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/skills/1") {
        return Promise.resolve({
          id: 1,
          name: "测试 Skill",
          description: "旧描述",
          status: "draft",
          versions: [{ id: 11, version: 1, system_prompt: "## 角色\n你是助手", created_at: "2026-04-17T00:00:00" }],
          system_prompt: "## 角色\n你是助手",
          data_queries: [],
        });
      }
      if (path === "/skills/1/files/SKILL.md") {
        return Promise.reject(new Error("missing"));
      }
      if (path === "/sandbox-case-plans/1/readiness") {
        return Promise.resolve({
          ok: true,
          data: {
            skill_id: 1,
            readiness: {
              ready: false,
              blocking_issues: ["missing_bound_assets"],
            },
          },
        });
      }
      if (path === "/test-flow/resolve-entry") {
        return Promise.resolve({
          ok: true,
          data: {
            action: "mount_blocked",
            skill: { id: 1, name: "测试 Skill" },
            latest_plan: null,
            mount_cta: "mount_data_assets",
            blocked_stage: "case_generation_gate",
            blocked_before: "case_generation",
            case_generation_allowed: false,
            quality_evaluation_started: false,
            verdict_label: "尚未开始质量检测",
            verdict_reason: "前置条件未完成：未绑定可测试数据资产",
            gate_summary: "需要先完成：未绑定可测试数据资产",
            gate_reasons: [{
              code: "missing_bound_assets",
              title: "未绑定可测试数据资产",
              detail: "Skill 未绑定任何数据表，无法生成测试用例。请先在治理面板绑定数据资产。",
              severity: "critical",
              step_id: "bind_assets",
              action: "go_bound_assets",
            }],
            guided_steps: [{
              id: "bind_assets",
              order: 1,
              title: "绑定数据资产",
              detail: "在治理面板中为 Skill 绑定需要测试的数据表。",
              status: "blocked",
              action: "go_bound_assets",
              action_label: "去绑定",
            }],
            primary_action: "go_bound_assets",
          },
        });
      }
      return Promise.resolve([]);
    });

    render(
      <PromptEditor
        skill={{ id: 1, name: "测试 Skill", description: "旧描述", status: "draft" } as never}
        isNew={false}
        prompt="## 角色\n你是助手"
        onPromptChange={vi.fn()}
        onSaved={vi.fn()}
        onFork={vi.fn()}
        onOpenTestFlowPanel={onOpenTestFlowPanel}
      />,
    );

    await waitFor(() => expect(screen.getAllByText("质量检测").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("质量检测")[0]!);

    await waitFor(() => {
      expect(onOpenTestFlowPanel).toHaveBeenCalledWith(expect.objectContaining({
        skillId: 1,
        mode: "mount_blocked",
        blockedStage: "case_generation_gate",
        verdictLabel: "尚未开始质量检测",
      }));
    });

    expect(screen.getByText("质量检测门禁未通过：未绑定可测试数据资产。请先在治理面板补齐前置条件后再运行质量检测。")).toBeTruthy();
  });

  it("normalizes preflight remediation cards before syncing store", async () => {
    const encoder = new TextEncoder();
    const sse = [
      "event: done",
      `data: ${JSON.stringify({
        passed: false,
        blocked_by: "quality",
        gates: [
          { gate: "quality", label: "质量", status: "failed" },
        ],
      })}`,
      "",
    ].join("\n");

    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader() {
            let done = false;
            return {
              async read() {
                if (done) return { done: true, value: undefined };
                done = true;
                return { done: false, value: encoder.encode(sse) };
              },
            };
          },
        },
      }),
    ));

    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/skills/1") {
        return Promise.resolve({
          id: 1,
          name: "测试 Skill",
          description: "旧描述",
          status: "draft",
          versions: [{ id: 11, version: 1, system_prompt: "## 角色\n你是助手", created_at: "2026-04-17T00:00:00" }],
          system_prompt: "## 角色\n你是助手",
          data_queries: [],
        });
      }
      if (path === "/skills/1/files/SKILL.md") {
        return Promise.reject(new Error("missing"));
      }
      if (path === "/sandbox-case-plans/1/readiness") {
        return Promise.resolve({
          ok: true,
          data: {
            skill_id: 1,
            readiness: {
              ready: true,
              blocking_issues: [],
            },
          },
        });
      }
      if (path === "/sandbox/preflight/1/remediation-actions") {
        return Promise.resolve({
          workflow_state: {
            session_mode: "optimize_existing_skill",
            workflow_mode: "governance_mode",
            phase: "governance_execution",
            next_action: "review_cards",
          },
          cards: [
            {
              title: "补齐权限声明",
              summary: "需要确认并补齐权限声明文本",
              suggested_action: "staged_edit",
              target_file: "SKILL.md",
              acceptance_rule_text: "声明内容与治理包一致",
            },
          ],
          staged_edits: [],
        });
      }
      return Promise.resolve([]);
    });

    render(
      <PromptEditor
        skill={{ id: 1, name: "测试 Skill", description: "旧描述", status: "draft" } as never}
        isNew={false}
        prompt="## 角色\n你是助手"
        onPromptChange={vi.fn()}
        onSaved={vi.fn()}
        onFork={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getAllByText("质量检测").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("质量检测")[0]!);

    await waitFor(() => {
      expect(mockStoreState.setWorkflowState).toHaveBeenCalledWith(expect.objectContaining({
        workflow_mode: "governance_mode",
        phase: "governance_execution",
        next_action: "review_cards",
      }));
      expect(mockStoreState.syncGovernanceCards).toHaveBeenCalled();
    });

    expect(mockStoreState.syncGovernanceCards).toHaveBeenCalledWith(
      "preflight:1",
      [
        expect.objectContaining({
          source: "preflight:1",
          type: "staged_edit",
          title: "补齐权限声明",
          status: "pending",
          actions: [
            expect.objectContaining({ type: "view_diff" }),
            expect.objectContaining({ type: "adopt" }),
          ],
          content: expect.objectContaining({
            target_ref: "SKILL.md",
            acceptance_rule: "声明内容与治理包一致",
          }),
        }),
      ],
    );
  });
});
