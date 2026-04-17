import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockApiFetch = vi.fn();
const mockStartPolling = vi.fn();
const mockStopPolling = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock("@/lib/useJobPoller", () => ({
  useJobPoller: () => ({
    jobStatus: null,
    startPolling: mockStartPolling,
    stopPolling: mockStopPolling,
  }),
}));

import BitablePanel from "../BitablePanel";

describe("BitablePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("粘贴带 table 参数的链接后自动读取字段和样例", async () => {
    mockApiFetch.mockResolvedValue({
      app_token: "app123",
      table_id: "tbl123",
      columns: [{ name: "客户名称", type: 1, nullable: true, comment: "" }],
      preview_rows: [{ 客户名称: "测试客户" }],
    });

    render(<BitablePanel onAdded={vi.fn()} />);

    fireEvent.paste(screen.getByPlaceholderText("支持 /base/ 或 /wiki/ 链接，粘贴后自动解析"), {
      clipboardData: {
        getData: () => "https://sample.feishu.cn/base/app123?table=tbl123",
      },
    });

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/business-tables/probe-bitable", {
        method: "POST",
        body: JSON.stringify({ app_token: "app123", table_id: "tbl123", display_name: "" }),
      });
    });

    expect(await screen.findByText("已读到 1 个字段 / 1 行样例，可以继续同步。")).toBeInTheDocument();
  });

  it("多表链接会先展示表选择，再在选择后自动预览", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        tables: [
          { table_id: "tbl_customer", name: "客户表" },
          { table_id: "tbl_order", name: "订单表" },
        ],
      })
      .mockResolvedValueOnce({
        app_token: "appmulti",
        table_id: "tbl_customer",
        columns: [{ name: "客户名称", type: 1, nullable: true, comment: "" }],
        preview_rows: [],
      });

    render(<BitablePanel onAdded={vi.fn()} />);

    fireEvent.paste(screen.getByPlaceholderText("支持 /base/ 或 /wiki/ 链接，粘贴后自动解析"), {
      clipboardData: {
        getData: () => "https://sample.feishu.cn/base/appmulti",
      },
    });

    expect(await screen.findByText("这个多维表格里有多个数据表，请先选择一个表再预览。")).toBeInTheDocument();

    fireEvent.click(screen.getByText("客户表"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenLastCalledWith("/business-tables/probe-bitable", {
        method: "POST",
        body: JSON.stringify({ app_token: "appmulti", table_id: "tbl_customer", display_name: "" }),
      });
    });

    expect(
      await screen.findByText("已读到 1 个字段，但样例为空；可能是源表为空、Table ID 选错，或飞书应用缺少记录读取权限。")
    ).toBeInTheDocument();
  });
});
