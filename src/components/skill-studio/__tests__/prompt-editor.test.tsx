import { render, screen, waitFor } from "@testing-library/react";
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
});
