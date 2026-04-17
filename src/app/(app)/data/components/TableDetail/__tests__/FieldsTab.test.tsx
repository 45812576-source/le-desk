/**
 * FieldsTab 组件测试 — 测试计划 §6.B 字段字典页
 *
 * 覆盖：
 * - 空字段提示
 * - 字段列表渲染
 * - 枚举/free text 标签
 * - 敏感字段标记
 * - 字段角色标签
 * - 字典面板展开
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/components/pixel/PixelBadge", () => ({
  PixelBadge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/pixel/PixelButton", () => ({
  PixelButton: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import FieldsTab from "../FieldsTab";
import { makeTableDetail, ENUM_DICTIONARY } from "@/__tests__/fixtures/data-assets";

describe("FieldsTab", () => {
  const onRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // FieldsTab 内部 useEffect 调用 apiFetch 获取 enum-suggestions，需返回 Promise
    mockApiFetch.mockResolvedValue({ suggestions: [] });
  });

  it("无字段时显示空提示", () => {
    const detail = makeTableDetail({ fields: [] });
    render(<FieldsTab detail={detail} />);
    expect(screen.getByText("暂无字段信息")).toBeInTheDocument();
  });

  it("字段画像待分析时显示对应提示", () => {
    const detail = makeTableDetail({ fields: [], field_profile_status: "pending" });
    render(<FieldsTab detail={detail} />);
    expect(screen.getByText("字段画像待分析")).toBeInTheDocument();
  });

  it("渲染所有字段", () => {
    const detail = makeTableDetail();
    render(<FieldsTab detail={detail} onRefresh={onRefresh} />);
    // 至少能看到部分字段名
    expect(screen.getByText("姓名")).toBeInTheDocument();
    expect(screen.getByText("部门")).toBeInTheDocument();
    expect(screen.getByText("金额")).toBeInTheDocument();
  });

  it("枚举字段显示枚举标签", () => {
    const detail = makeTableDetail();
    render(<FieldsTab detail={detail} onRefresh={onRefresh} />);
    const enumBadges = screen.getAllByText("枚举");
    expect(enumBadges.length).toBeGreaterThan(0);
  });

  it("free text 字段显示自由文本标签", () => {
    const detail = makeTableDetail();
    render(<FieldsTab detail={detail} onRefresh={onRefresh} />);
    const ftBadges = screen.getAllByText("自由文本");
    expect(ftBadges.length).toBeGreaterThan(0);
  });

  it("敏感字段显示敏感标记", () => {
    const detail = makeTableDetail();
    render(<FieldsTab detail={detail} onRefresh={onRefresh} />);
    // 姓名、手机号、身份证号都标记为敏感
    const sensitiveMarks = screen.getAllByText(/敏感/);
    expect(sensitiveMarks.length).toBeGreaterThanOrEqual(3);
  });

  it("系统字段显示 SYS 标记", () => {
    const detail = makeTableDetail();
    render(<FieldsTab detail={detail} onRefresh={onRefresh} />);
    const sysMarks = screen.getAllByText("SYS");
    expect(sysMarks.length).toBeGreaterThanOrEqual(2);
  });

  it("枚举字段显示选项数量", () => {
    const detail = makeTableDetail();
    render(<FieldsTab detail={detail} onRefresh={onRefresh} />);
    // 部门和项目都有 3 个选项，状态有 4 个
    expect(screen.getAllByText("3 选项").length).toBe(2); // department + project
    expect(screen.getByText("4 选项")).toBeInTheDocument(); // status
  });

  it("点击枚举字段展开字典面板", async () => {
    // 第一次调用：EnumSuggestionsPanel 的 enum-suggestions
    // 第二次调用：FieldDictionaryPanel 的 dictionary
    mockApiFetch
      .mockResolvedValueOnce({ suggestions: [] })
      .mockResolvedValueOnce({ items: ENUM_DICTIONARY });
    const detail = makeTableDetail();
    render(<FieldsTab detail={detail} onRefresh={onRefresh} />);

    // 点击枚举标签
    const enumBadges = screen.getAllByText("枚举");
    fireEvent.click(enumBadges[0]);

    // 等字典面板加载
    await waitFor(() => {
      expect(screen.getByText("枚举值字典")).toBeInTheDocument();
    });
  });

  it("字段角色标签正确显示", () => {
    const detail = makeTableDetail();
    render(<FieldsTab detail={detail} onRefresh={onRefresh} />);
    // 维度标签
    expect(screen.getAllByText("维度").length).toBeGreaterThan(0);
    // 指标标签
    expect(screen.getAllByText("指标").length).toBeGreaterThan(0);
  });
});
