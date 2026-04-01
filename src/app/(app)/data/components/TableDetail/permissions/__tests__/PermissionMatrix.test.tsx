/**
 * PermissionMatrix 组件测试 — 测试计划 §6.C 权限页
 *
 * 覆盖：
 * - 角色组为空时提示
 * - 从 policies 初始化 drafts
 * - 修改后 dirty 状态
 * - 保存调用正确 API
 * - 默认拒绝 UI 可识别
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock apiFetch
const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// Mock PixelButton
vi.mock("@/components/pixel/PixelButton", () => ({
  PixelButton: ({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button onClick={onClick} disabled={disabled} data-testid="pixel-btn">{children}</button>
  ),
}));

import PermissionMatrix from "../PermissionMatrix";
import { ROLE_GROUPS, POLICIES, makeRoleGroup, makePolicy } from "@/__tests__/fixtures/data-assets";

describe("PermissionMatrix", () => {
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("角色组为空时显示提示", () => {
    render(<PermissionMatrix tableId={100} roleGroups={[]} policies={[]} onRefresh={onRefresh} />);
    expect(screen.getByText("请先创建角色组")).toBeInTheDocument();
  });

  it("渲染每个角色组的行", () => {
    render(<PermissionMatrix tableId={100} roleGroups={ROLE_GROUPS} policies={POLICIES} onRefresh={onRefresh} />);
    for (const rg of ROLE_GROUPS) {
      expect(screen.getByText(rg.name)).toBeInTheDocument();
    }
  });

  it("从 policies 正确初始化下拉值", () => {
    const { container } = render(
      <PermissionMatrix tableId={100} roleGroups={ROLE_GROUPS.slice(0, 1)} policies={POLICIES} onRefresh={onRefresh} />
    );
    // 全员角色组的策略: row=all, field=blocklist, disclosure=L1
    const selects = container.querySelectorAll("select");
    expect(selects.length).toBeGreaterThanOrEqual(4);
    // 行权限 select
    expect(selects[0]).toHaveValue("all");
    // 字段权限 select
    expect(selects[1]).toHaveValue("blocklist");
    // 披露级别 select
    expect(selects[2]).toHaveValue("L1");
  });

  it("修改 select 后出现保存按钮", () => {
    render(<PermissionMatrix tableId={100} roleGroups={ROLE_GROUPS.slice(0, 1)} policies={POLICIES} onRefresh={onRefresh} />);
    // 初始不显示保存按钮
    expect(screen.queryByText("保存策略")).not.toBeInTheDocument();
    // 修改行权限
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "owner" } });
    // 显示保存按钮
    expect(screen.getByText("保存策略")).toBeInTheDocument();
  });

  it("保存调用 PUT /data-assets/tables/{id}/permission-policies", async () => {
    mockApiFetch.mockResolvedValueOnce({});
    render(<PermissionMatrix tableId={100} roleGroups={ROLE_GROUPS.slice(0, 1)} policies={POLICIES} onRefresh={onRefresh} />);

    // 修改触发 dirty
    const selects = document.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "owner" } });
    // 点击保存
    fireEvent.click(screen.getByText("保存策略"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/data-assets/tables/100/permission-policies",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining("owner"),
        }),
      );
    });
    expect(onRefresh).toHaveBeenCalled();
  });

  it("无 policy 时默认值为 none/all/L0/deny/false", () => {
    // 角色组没有对应 policy
    const emptyRg = makeRoleGroup({ id: 999, name: "新组" });
    const { container } = render(
      <PermissionMatrix tableId={100} roleGroups={[emptyRg]} policies={[]} onRefresh={onRefresh} />
    );
    const selects = container.querySelectorAll("select");
    expect(selects[0]).toHaveValue("none"); // row_access_mode
    expect(selects[1]).toHaveValue("all");  // field_access_mode
    expect(selects[2]).toHaveValue("L0");   // disclosure_level
    expect(selects[3]).toHaveValue("deny"); // tool_permission_mode
  });
});
