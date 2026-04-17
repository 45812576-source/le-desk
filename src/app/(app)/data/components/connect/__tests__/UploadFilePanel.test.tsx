import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("@/lib/api", () => ({
  getToken: () => "token-demo",
}));

import UploadFilePanel from "../UploadFilePanel";

describe("UploadFilePanel", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("上传成功且有数据时展示可继续查看提示", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        display_name: "客户导入",
        rows_inserted: 12,
        columns: 4,
      })),
    });

    const { container } = render(<UploadFilePanel onAdded={vi.fn()} />);

    const file = new File(["name,age\nxia,18"], "customers.csv", { type: "text/csv" });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText("✓ 上传并创建数据表"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    expect(await screen.findByText("已导入 4 个字段 / 12 行数据，可以去数据资产页继续看样例和字段覆盖。")).toBeInTheDocument();
  });

  it("上传成功但没有数据行时展示空表提示", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        display_name: "模板文件",
        rows_inserted: 0,
        columns: 4,
      })),
    });

    const { container } = render(<UploadFilePanel onAdded={vi.fn()} />);

    const file = new File(["name,age"], "template.csv", { type: "text/csv" });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByText("✓ 上传并创建数据表"));

    expect(
      await screen.findByText("已识别 4 个字段，但没有导入数据行；如果这是模板文件，可以继续补数据后再给 Skill 使用。")
    ).toBeInTheDocument();
  });
});
