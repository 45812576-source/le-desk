/**
 * SkillBindingsTab 组件测试 — 测试计划 §6.D Skill 授权页
 *
 * 覆盖：
 * - 空绑定提示
 * - 绑定列表渲染
 * - legacy_unbound 状态显示
 * - 删除绑定
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/components/pixel/PixelBadge", () => ({
  PixelBadge: ({ children, color }: { children: React.ReactNode; color?: string }) => (
    <span data-testid={`badge-${color}`}>{children}</span>
  ),
}));

import SkillBindingsTab from "../SkillBindingsTab";
import { makeTableDetail, BINDINGS } from "@/__tests__/fixtures/data-assets";

describe("SkillBindingsTab", () => {
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无绑定时显示空提示", () => {
    const detail = makeTableDetail({ bindings: [] });
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);
    expect(screen.getByText(/暂无 Skill 绑定/)).toBeInTheDocument();
  });

  it("渲染所有绑定", () => {
    const detail = makeTableDetail();
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);
    // BindingRelationGraph 也会渲染 skill 名，用 getAllByText
    expect(screen.getAllByText("内部分析 Skill").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("外部汇总 Skill").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("高敏审批 Skill").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("旧 Skill").length).toBeGreaterThanOrEqual(1);
  });

  it("healthy 绑定显示已绑定徽章", () => {
    const detail = makeTableDetail();
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);
    const greenBadges = screen.getAllByTestId("badge-green");
    expect(greenBadges.length).toBeGreaterThanOrEqual(3);
  });

  it("legacy_unbound 显示待迁移提示", () => {
    const detail = makeTableDetail();
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);
    expect(screen.getByText("待迁移")).toBeInTheDocument();
    expect(screen.getByText(/旧 Skill，尚未绑定具体视图/)).toBeInTheDocument();
  });

  it("绑定显示视图名", () => {
    const detail = makeTableDetail();
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);
    // BindingRelationGraph + binding rows 都渲染视图名
    expect(screen.getAllByText(/运营明细视图/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/汇总视图/).length).toBeGreaterThanOrEqual(1);
  });

  it("删除绑定调用正确 API", async () => {
    mockApiFetch.mockResolvedValueOnce({});
    global.confirm = vi.fn(() => true);

    const detail = makeTableDetail();
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);

    // 找到删除按钮（✕）并点击
    const deleteButtons = screen.getAllByTitle("解除绑定");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/data-assets/bindings/${BINDINGS[0].binding_id}`,
        { method: "DELETE" },
      );
    });
    expect(onRefresh).toHaveBeenCalled();
  });
});
