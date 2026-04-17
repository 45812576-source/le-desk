/**
 * SkillBindingsTab 组件测试 — 测试计划 §6.D Skill 授权页
 *
 * 覆盖：
 * - 空绑定提示
 * - 绑定列表渲染
 * - legacy_unbound 状态显示
 * - 只读投影说明
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockApiFetch = vi.fn();

vi.mock("@/components/pixel/PixelBadge", () => ({
  PixelBadge: ({ children, color }: { children: React.ReactNode; color?: string }) => (
    <span data-testid={`badge-${color}`}>{children}</span>
  ),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import SkillBindingsTab from "../SkillBindingsTab";
import { makeTableDetail } from "@/__tests__/fixtures/data-assets";

describe("SkillBindingsTab", () => {
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiFetch.mockImplementation((path: string) => {
      if (path === "/org-management/departments") {
        return Promise.resolve([{ id: 10, name: "销售部", parent_id: null }]);
      }
      return Promise.reject(new Error(`unexpected path: ${path}`));
    });
  });

  it("无绑定时显示空提示", () => {
    const detail = makeTableDetail({ bindings: [], skill_grants: [], role_groups: [], permission_policies: [] });
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);
    expect(screen.getByText(/暂无关联 Skill/)).toBeInTheDocument();
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
    expect(screen.getByText("待补视图")).toBeInTheDocument();
    expect(screen.getAllByText(/未绑定视图/).length).toBeGreaterThan(0);
  });

  it("绑定显示视图名", () => {
    const detail = makeTableDetail();
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);
    // BindingRelationGraph + binding rows 都渲染视图名
    expect(screen.getAllByText(/运营明细视图/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/汇总视图/).length).toBeGreaterThanOrEqual(1);
  });

  it("显示只读投影提示和 SkillStudio 跳转", () => {
    const detail = makeTableDetail();
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);
    expect(screen.getByText(/只读投影页/)).toBeInTheDocument();
    expect(screen.getAllByText("去 SkillStudio").length).toBeGreaterThan(0);
  });

  it("显示真实部门名称而不是部门 id", async () => {
    const detail = makeTableDetail();
    render(<SkillBindingsTab detail={detail} onRefresh={onRefresh} />);

    await waitFor(() => {
      expect(screen.getAllByText(/部门：销售部/).length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/部门：部门 #10/)).not.toBeInTheDocument();
  });
});
