import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";

import { AssetFileEditor } from "../AssetFileEditor";
import type { StagedEdit } from "../types";

const mockApiFetch = vi.fn();
const mockStoreState: { stagedEdits: StagedEdit[] } = { stagedEdits: [] };

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/lib/studio-store", () => ({
  useStudioStore: (selector: (state: typeof mockStoreState) => unknown) => selector(mockStoreState),
}));

vi.mock("@/components/pixel/PixelButton", () => ({
  PixelButton: ({ children, ...props }: React.ComponentProps<"button">) => <button {...props}>{children}</button>,
}));

vi.mock("../DiffViewer", () => ({
  DiffViewer: ({ oldText, newText }: { oldText: string; newText: string }) => (
    <div data-testid="diff-viewer">
      <pre data-testid="diff-old">{oldText}</pre>
      <pre data-testid="diff-new">{newText}</pre>
    </div>
  ),
  LineNumberedEditor: () => <div data-testid="line-editor" />,
}));

const skill = {
  id: 1,
  name: "测试 Skill",
  status: "draft",
  source_files: [{ filename: "docs/checklist.md", size: 24 }],
};

function renderEditor(props?: Partial<React.ComponentProps<typeof AssetFileEditor>>) {
  return render(
    <AssetFileEditor
      skill={skill as never}
      filename="docs/checklist.md"
      onDeleted={vi.fn()}
      {...props}
    />,
  );
}

describe("AssetFileEditor", () => {
  beforeEach(() => {
    mockStoreState.stagedEdits = [];
    mockApiFetch.mockReset();
  });

  it("shows pending source-file staged edit diff before adoption", async () => {
    mockStoreState.stagedEdits = [{
      id: "se-pending",
      fileType: "source_file",
      filename: "docs/checklist.md",
      status: "pending",
      changeNote: "补充清单",
      diff: [{ type: "append", content: "\nnew line" }],
    }];
    mockApiFetch.mockResolvedValue({ content: "hello" });

    renderEditor();

    await waitFor(() => expect(screen.getByTestId("diff-viewer")).toBeInTheDocument());
    expect(screen.getByText(/待确认治理修改/)).toBeInTheDocument();
    expect(screen.getByTestId("diff-old").textContent).toBe("hello");
    expect(screen.getByTestId("diff-new").textContent).toBe("hello\nnew line");
  });

  it("shows adopted source-file diff even after backend content is already updated", async () => {
    mockApiFetch.mockResolvedValue({ content: "hello\nnew line" });

    renderEditor({
      adoptedPreviewEdit: {
        id: "se-adopted",
        fileType: "source_file",
        filename: "docs/checklist.md",
        status: "adopted",
        changeNote: "补充清单",
        diff: [{ type: "append", content: "\nnew line" }],
      },
    });

    await waitFor(() => expect(screen.getByTestId("diff-viewer")).toBeInTheDocument());
    expect(screen.getByText(/已采纳治理修改/)).toBeInTheDocument();
    expect(screen.getByTestId("diff-old").textContent).toBe("hello");
    expect(screen.getByTestId("diff-new").textContent).toBe("hello\nnew line");
  });
});
