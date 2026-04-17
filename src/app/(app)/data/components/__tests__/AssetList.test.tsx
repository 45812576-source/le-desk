import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockApiFetch = vi.fn();

vi.mock("../shared/feature-flags", () => ({
  useV2DataAssets: () => false,
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import AssetList from "../AssetList";
import type { DataAssetTable } from "../shared/types";

function makeTable(overrides: Partial<DataAssetTable> = {}): DataAssetTable {
  return {
    id: 1,
    table_name: "customer_table",
    display_name: "客户表",
    description: "客户基础数据",
    folder_id: null,
    source_type: "lark_bitable",
    sync_status: "success",
    last_synced_at: "2026-04-16T10:00:00Z",
    record_count: 20,
    field_count: 8,
    bound_skills: [],
    risk_warnings: [],
    is_archived: false,
    created_at: "2026-04-16T10:00:00Z",
    ...overrides,
  };
}

describe("AssetList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("展示同步异常和空表等可用性状态", () => {
    const onSelectTable = vi.fn();

    render(
      <AssetList
        tables={[
          makeTable({ id: 1, display_name: "同步失败表", sync_status: "failed", record_count: 12 }),
          makeTable({ id: 2, display_name: "空白表", record_count: 0 }),
          makeTable({ id: 4, display_name: "待同步表", record_count: null, last_synced_at: null, sync_status: "idle" }),
          makeTable({ id: 3, display_name: "正常表", sync_status: "success", record_count: 36 }),
        ]}
        selectedTableId={null}
        onSelectTable={onSelectTable}
        loading={false}
      />
    );

    expect(screen.getByText("同步异常")).toBeInTheDocument();
    expect(screen.getByText("空表")).toBeInTheDocument();
    expect(screen.getByText("待同步")).toBeInTheDocument();
    expect(screen.getByText("可预览")).toBeInTheDocument();
    expect(screen.getByText(/需要先修复同步/)).toBeInTheDocument();
  });

  it("点击列表项时触发选择", () => {
    const onSelectTable = vi.fn();

    render(
      <AssetList
        tables={[makeTable({ id: 9, display_name: "待选择表" })]}
        selectedTableId={null}
        onSelectTable={onSelectTable}
        loading={false}
      />
    );

    fireEvent.click(screen.getByText("待选择表"));
    expect(onSelectTable).toHaveBeenCalledWith(9);
  });

  it("支持按可用性过滤可预览数据表", () => {
    const onSelectTable = vi.fn();

    render(
      <AssetList
        tables={[
          makeTable({ id: 1, display_name: "同步失败表", sync_status: "failed", record_count: 12 }),
          makeTable({ id: 2, display_name: "空白表", record_count: 0 }),
          makeTable({ id: 3, display_name: "正常表", sync_status: "success", record_count: 36 }),
        ]}
        selectedTableId={null}
        onSelectTable={onSelectTable}
        loading={false}
        filter={{ availability: "ready" }}
      />
    );

    expect(screen.queryByText("同步失败表")).not.toBeInTheDocument();
    expect(screen.queryByText("空白表")).not.toBeInTheDocument();
    expect(screen.getByText("正常表")).toBeInTheDocument();
  });

  it("点击可用性按钮时回传新的筛选条件", () => {
    const onFilterChange = vi.fn();

    render(
      <AssetList
        tables={[makeTable({ id: 1, display_name: "正常表" })]}
        selectedTableId={null}
        onSelectTable={vi.fn()}
        loading={false}
        filter={{}}
        onFilterChange={onFilterChange}
      />
    );

    fireEvent.click(screen.getByText("⫶"));
    fireEvent.click(screen.getAllByText("可预览")[0]);

    expect(onFilterChange).toHaveBeenCalledWith({ availability: "ready" });
  });

  it("支持按待同步过滤数据表", () => {
    render(
      <AssetList
        tables={[
          makeTable({ id: 1, display_name: "待同步表", record_count: null, last_synced_at: null, sync_status: "idle" }),
          makeTable({ id: 2, display_name: "正常表", sync_status: "success", record_count: 36 }),
        ]}
        selectedTableId={null}
        onSelectTable={vi.fn()}
        loading={false}
        filter={{ availability: "pending_sync" }}
      />
    );

    expect(screen.getByText("待同步表")).toBeInTheDocument();
    expect(screen.queryByText("正常表")).not.toBeInTheDocument();
  });

  it("点击查看诊断时打开概览页", () => {
    const onOpenTableTab = vi.fn();

    render(
      <AssetList
        tables={[makeTable({ id: 11, display_name: "诊断表" })]}
        selectedTableId={null}
        onSelectTable={vi.fn()}
        onOpenTableTab={onOpenTableTab}
        loading={false}
      />
    );

    fireEvent.click(screen.getByText("查看诊断"));
    expect(onOpenTableTab).toHaveBeenCalledWith(11, "overview");
  });

  it("点击查看预览时打开预览页", () => {
    const onOpenTableTab = vi.fn();

    render(
      <AssetList
        tables={[makeTable({ id: 13, display_name: "可预览表", sync_status: "success", record_count: 36 })]}
        selectedTableId={null}
        onSelectTable={vi.fn()}
        onOpenTableTab={onOpenTableTab}
        loading={false}
      />
    );

    fireEvent.click(screen.getByText("查看预览"));
    expect(onOpenTableTab).toHaveBeenCalledWith(13, "preview");
  });

  it("点击重新同步时触发同步并刷新列表", async () => {
    mockApiFetch.mockResolvedValue({});
    const onTablesChange = vi.fn();
    const onOpenTableTab = vi.fn();

    render(
      <AssetList
        tables={[makeTable({ id: 12, display_name: "异常表", sync_status: "failed", record_count: 8 })]}
        selectedTableId={null}
        onSelectTable={vi.fn()}
        onOpenTableTab={onOpenTableTab}
        onTablesChange={onTablesChange}
        loading={false}
      />
    );

    fireEvent.click(screen.getByText("重新同步"));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith("/data-assets/tables/12/sync", { method: "POST" });
    });
    expect(onTablesChange).toHaveBeenCalled();
    expect(onOpenTableTab).toHaveBeenCalledWith(12, "overview");
  });
});
