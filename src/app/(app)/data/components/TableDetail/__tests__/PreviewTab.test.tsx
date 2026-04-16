import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/components/pixel/PixelButton", () => ({
  PixelButton: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock("../shared/feature-flags", () => ({
  useV2DataAssets: () => false,
}));

vi.mock("../shared/EditableCell", () => ({
  default: ({ value }: { value: unknown }) => <span>{String(value ?? "")}</span>,
}));

import PreviewTab from "../PreviewTab";
import { makeTableDetail } from "@/__tests__/fixtures/data-assets";

describe("PreviewTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("分页接口空结果且记录数缓存为空时，自动降级展示采样行", async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.includes("/rows?")) {
        return Promise.resolve({ total: 0, page: 1, page_size: 20, columns: [], rows: [] });
      }
      if (path.includes("/sample?")) {
        return Promise.resolve({
          total: 1,
          columns: ["id", "name"],
          rows: [{ id: 1, name: "采样可见行" }],
          sample_strategy: { enum_fields: [], sampled: 1, max_rows: 200 },
        });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    const detail = makeTableDetail({
      table_name: "usr_preview_cache_empty",
      record_count: null,
      fields: [],
      role_groups: [],
    });

    render(
      <PreviewTab
        detail={detail}
        capabilities={{
          can_edit_schema: false,
          can_edit_rows: false,
          can_edit_meta: false,
          can_export: false,
          can_manage_views: false,
          can_manage_role_groups: false,
          can_manage_bindings: false,
          can_manage_publish: false,
          can_delete_table: false,
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("采样可见行")).toBeInTheDocument();
    });
    expect(screen.getByText("分页接口未返回数据，已自动降级显示采样结果。")).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith("/data/usr_preview_cache_empty/sample?max_rows=200");
  });
});
