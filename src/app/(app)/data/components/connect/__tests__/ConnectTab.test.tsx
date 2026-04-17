import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

vi.mock("../UploadFilePanel", () => ({
  default: () => <div>upload-panel</div>,
}));

vi.mock("../BitablePanel", () => ({
  default: () => <div>bitable-panel</div>,
}));

vi.mock("../DbPanel", () => ({
  default: () => <div>db-panel</div>,
}));

vi.mock("../CreateBlankPanel", () => ({
  default: () => <div>blank-panel</div>,
}));

import ConnectTab from "../ConnectTab";

describe("ConnectTab", () => {
  it("展示 SkillStudio 边界说明且不再展示安全配置", () => {
    render(<ConnectTab onAdded={vi.fn()} />);

    expect(screen.getByText("使用边界")).toBeInTheDocument();
    expect(screen.getByText(/具体用户运行 Skill 时的权限、脱敏、审批和辅助挂载，统一在 SkillStudio 处理/)).toBeInTheDocument();
    expect(screen.queryByText("安全配置（可选）")).not.toBeInTheDocument();
  });
});
