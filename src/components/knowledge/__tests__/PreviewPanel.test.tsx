import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PreviewPanel from "@/components/knowledge/PreviewPanel";
import type { KnowledgeDetail } from "@/lib/types";
import { apiFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/knowledge/RichEditor", () => ({
  RichEditor: ({ content }: { content: string }) => <div data-testid="rich-editor">{content}</div>,
}));

vi.mock("@/components/knowledge/CollabEditor", () => ({
  CollabEditor: () => <div data-testid="collab-editor">collab</div>,
}));

vi.mock("@/components/knowledge/DocumentViewer", () => ({
  default: () => <div data-testid="document-viewer">viewer</div>,
}));

vi.mock("@/components/governance/GovernanceReviewCard", () => ({
  default: () => null,
}));

vi.mock("@/lib/theme", () => ({
  useTheme: () => ({ theme: "light" }),
}));

const mockApiFetch = vi.mocked(apiFetch);

function makeEntry(overrides: Partial<KnowledgeDetail> = {}): KnowledgeDetail {
  const {
    folder_id = null,
    folder_name = null,
    review_level = 1,
    review_level_label = "L1",
    review_stage = "approved",
    review_stage_label = "已通过",
    sensitivity_flags = [],
    auto_review_note = null,
    source_file = null,
    capture_mode = "upload",
    reviewed_by = null,
    review_note = null,
    taxonomy_board = null,
    taxonomy_code = null,
    taxonomy_path = [],
    ...rest
  } = overrides;

  return {
    id: 1,
    title: "测试文档",
    content: "提取后的文本",
    category: "experience",
    tags: [],
    status: "approved",
    created_by: 7,
    created_at: "2026-04-16T00:00:00Z",
    source_type: "upload",
    oss_key: "knowledge/demo.png",
    file_ext: ".png",
    file_type: "image/png",
    content_html: "<p>提取后的文本</p>",
    doc_render_status: "ready",
    can_open_onlyoffice: false,
    external_edit_mode: null,
    folder_id,
    folder_name,
    review_level,
    review_level_label,
    review_stage,
    review_stage_label,
    sensitivity_flags,
    auto_review_note,
    source_file,
    capture_mode,
    reviewed_by,
    review_note,
    taxonomy_board,
    taxonomy_code,
    taxonomy_path,
    ...rest,
  };
}

describe("PreviewPanel media editing routing", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockApiFetch.mockImplementation(async (path: string) => {
      if (String(path).includes("/edit-permission")) {
        return {
          can_edit: false,
          is_owner: false,
          pending_request: false,
          grants: [],
        };
      }
      if (String(path).includes("/share-links")) return [];
      return null;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ url: "https://example.com/file" }),
      })),
    );
  });

  it("routes media with extracted content into the editor and keeps raw preview strip", async () => {
    render(
      <PreviewPanel
        entry={makeEntry()}
        currentUser={null}
        onUpdateContent={vi.fn(async () => {})}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("rich-editor")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("document-viewer")).not.toBeInTheDocument();
    await screen.findByText("原始文件预览");
    expect(global.fetch).toHaveBeenCalledWith("/api/proxy/knowledge/1/file-url");
  });

  it("keeps media without extracted content on the native viewer path", async () => {
    render(
      <PreviewPanel
        entry={makeEntry({
          content: "",
          content_html: "",
          doc_render_status: "ready",
        })}
        currentUser={null}
        onUpdateContent={vi.fn(async () => {})}
        onDelete={vi.fn()}
        onRename={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("rich-editor")).not.toBeInTheDocument();
  });
});
