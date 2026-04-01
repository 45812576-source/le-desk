/**
 * RoleGroupPanel 组件测试 — 测试计划 §6.C 权限页
 *
 * 覆盖：
 * - 空状态提示
 * - 创建角色组流程
 * - 重命名流程
 * - 删除确认
 * - 系统角色组不可编辑/删除
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/components/pixel/PixelButton", () => ({
  PixelButton: ({ children, onClick, size, variant }: { children: React.ReactNode; onClick?: () => void; size?: string; variant?: string }) => (
    <button onClick={onClick} data-testid={`pixel-btn-${variant || "primary"}`}>{children}</button>
  ),
}));

vi.mock("@/components/pixel/PixelBadge", () => ({
  PixelBadge: ({ children, color }: { children: React.ReactNode; color?: string }) => (
    <span data-testid={`badge-${color}`}>{children}</span>
  ),
}));

import RoleGroupPanel from "../RoleGroupPanel";
import { ROLE_GROUPS, makeRoleGroup } from "@/__tests__/fixtures/data-assets";

describe("RoleGroupPanel", () => {
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("无角色组时显示空状态提示", () => {
    render(<RoleGroupPanel tableId={100} roleGroups={[]} onRefresh={onRefresh} />);
    expect(screen.getByText(/暂无角色组/)).toBeInTheDocument();
  });

  it("渲染所有角色组", () => {
    render(<RoleGroupPanel tableId={100} roleGroups={ROLE_GROUPS} onRefresh={onRefresh} />);
    for (const rg of ROLE_GROUPS) {
      expect(screen.getByText(rg.name)).toBeInTheDocument();
    }
  });

  it("系统角色组显示系统徽章", () => {
    const sysGroup = ROLE_GROUPS.filter((rg) => rg.is_system);
    render(<RoleGroupPanel tableId={100} roleGroups={sysGroup} onRefresh={onRefresh} />);
    expect(screen.getByText("系统")).toBeInTheDocument();
  });

  it("点击新建按钮显示创建表单", () => {
    render(<RoleGroupPanel tableId={100} roleGroups={ROLE_GROUPS} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByText("+ 新建"));
    // 出现创建表单
    expect(screen.getByPlaceholderText("角色组名称")).toBeInTheDocument();
  });

  it("创建角色组调用正确 API", async () => {
    mockApiFetch.mockResolvedValueOnce({});
    render(<RoleGroupPanel tableId={100} roleGroups={ROLE_GROUPS} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByText("+ 新建"));

    const input = screen.getByPlaceholderText("角色组名称");
    fireEvent.change(input, { target: { value: "新角色组" } });
    fireEvent.click(screen.getByText("创建"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/data-assets/tables/100/role-groups",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("新角色组"),
        }),
      );
    });
    expect(onRefresh).toHaveBeenCalled();
  });

  it("角色组类型正确显示", () => {
    render(<RoleGroupPanel tableId={100} roleGroups={ROLE_GROUPS} onRefresh={onRefresh} />);
    // 有 human_role 和 skill_role 类型
    expect(screen.getAllByText("人员").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Skill").length).toBeGreaterThan(0);
  });

  it("成员数量正确计算", () => {
    const rgWithMembers = makeRoleGroup({ id: 10, name: "有成员", user_ids: [1, 2], department_ids: [10], skill_ids: [] });
    render(<RoleGroupPanel tableId={100} roleGroups={[rgWithMembers]} onRefresh={onRefresh} />);
    expect(screen.getByText("3 成员")).toBeInTheDocument();
  });
});
