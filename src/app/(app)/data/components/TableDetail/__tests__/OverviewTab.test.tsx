import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockApiFetch = vi.fn();
const mockPatchTableMeta = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("../shared/api", () => ({
  patchTableMeta: (...args: unknown[]) => mockPatchTableMeta(...args),
}));

vi.mock("@/components/pixel/PixelButton", () => ({
  PixelButton: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}));

vi.mock("../shared/feature-flags", () => ({
  useV2DataAssets: () => false,
}));

vi.mock("./source/SourceProfilePanel", () => ({
  default: () => null,
}));

vi.mock("./source/DegradationAlert", () => ({
  default: () => null,
}));

import OverviewTab from "../OverviewTab";
import { makeTableDetail } from "@/__tests__/fixtures/data-assets";

describe("OverviewTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("summary 接口不存在时，降级显示本地规则摘要", async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/data-assets/folders") {
        return Promise.resolve({ items: [] });
      }
      if (path === "/data-assets/tables/100/summary") {
        return Promise.reject(new Error("HTTP 404"));
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    render(<OverviewTab detail={makeTableDetail()} onRefresh={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("规则推断")).toBeInTheDocument();
    });
    expect(screen.getByText("这张表能提供什么")).toBeInTheDocument();
    expect(screen.getByText(/具体用户运行时的权限、脱敏和审批统一在 SkillStudio 处理/)).toBeInTheDocument();
    expect(screen.getAllByText(/含敏感字段的测试表/).length).toBeGreaterThan(0);
  });

  it("summary 接口成功时，显示接口摘要并支持手动刷新", async () => {
    mockApiFetch.mockImplementation((path: string, options?: { method?: string }) => {
      if (path === "/data-assets/folders") {
        return Promise.resolve({ items: [] });
      }
      if (path === "/data-assets/tables/100/summary") {
        return Promise.resolve({
          summary: "这是一张客户经营分析表。",
          capability_summary: "适合销售复盘 Skill、经营分析 Skill",
          related_departments: ["销售部", "商务部"],
          limitation_summary: "不适合作为最终运行时权限依据。",
        });
      }
      if (path === "/data-assets/tables/100/summarize" && options?.method === "POST") {
        return Promise.resolve({
          summary: "刷新后的经营分析摘要。",
          capability_summary: "适合销售复盘 Skill、客户洞察 Skill",
          related_departments: ["销售部", "市场部"],
          limitation_summary: "运行时权限仍以 SkillStudio 为准。",
        });
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });

    render(<OverviewTab detail={makeTableDetail()} onRefresh={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("接口摘要")).toBeInTheDocument();
    });
    expect(screen.getByText("这是一张客户经营分析表。")).toBeInTheDocument();
    expect(screen.getByText("销售部、商务部")).toBeInTheDocument();

    fireEvent.click(screen.getByText("刷新摘要"));

    await waitFor(() => {
      expect(screen.getByText("刷新后的经营分析摘要。")).toBeInTheDocument();
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/data-assets/tables/100/summarize", { method: "POST" });
  });
});
