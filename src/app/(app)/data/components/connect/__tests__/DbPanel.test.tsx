import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import DbPanel from "../DbPanel";

describe("DbPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("连接成功且有样例时展示可导入提示", async () => {
    mockApiFetch.mockResolvedValue({
      table_name: "orders",
      columns: [{ name: "订单号", type: "text", nullable: false, comment: "" }],
      preview_rows: [{ 订单号: "A001" }],
    });

    render(<DbPanel onAdded={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("mysql+pymysql://user:pass@host:3306/dbname"), {
      target: { value: "mysql://demo" },
    });
    fireEvent.change(screen.getByPlaceholderText("例：orders"), {
      target: { value: "orders" },
    });
    fireEvent.click(screen.getByText("▶ 连接并预览"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/business-tables/probe", {
        method: "POST",
        body: JSON.stringify({ db_url: "mysql://demo", table_name: "orders" }),
      });
    });

    expect(await screen.findByText("已连通数据库并读到 1 个字段 / 1 行样例，可以直接导入。")).toBeInTheDocument();
  });

  it("连接成功但样例为空时展示诊断提示", async () => {
    mockApiFetch.mockResolvedValue({
      table_name: "orders",
      columns: [{ name: "订单号", type: "text", nullable: false, comment: "" }],
      preview_rows: [],
    });

    render(<DbPanel onAdded={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("mysql+pymysql://user:pass@host:3306/dbname"), {
      target: { value: "mysql://demo" },
    });
    fireEvent.change(screen.getByPlaceholderText("例：orders"), {
      target: { value: "orders" },
    });
    fireEvent.click(screen.getByText("▶ 连接并预览"));

    expect(
      await screen.findByText("已连通数据库并识别 1 个字段，但样例为空；可能是原表为空，或当前账号没有可读数据行。")
    ).toBeInTheDocument();
  });
});
