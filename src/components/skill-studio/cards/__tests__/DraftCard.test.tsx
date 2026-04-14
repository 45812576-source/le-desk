import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DraftCard } from "../DraftCard";

describe("DraftCard", () => {
  it("shows preview for description-only drafts", () => {
    render(
      <DraftCard
        draft={{
          system_prompt: "## 角色\n你是助手",
          description: "用于检索、展示和审核的 Skill 描述",
        }}
        currentPrompt="## 角色\n你是助手"
        currentDescription=""
        onApply={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("预览变更"));

    expect(screen.getByText("Skill 描述")).toBeTruthy();
    expect(screen.getByText("用于检索、展示和审核的 Skill 描述")).toBeTruthy();
  });
});
