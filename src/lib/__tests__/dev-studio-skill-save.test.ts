import { describe, expect, it, vi } from "vitest";
import type { SkillDetail } from "@/lib/types";
import {
  buildSkillStudioUrl,
  findCreatedSkill,
  findFirstMarkdownPath,
  normalizeSelectedFilePaths,
  resolveDevStudioSkillSaveInput,
} from "@/lib/dev-studio-skill-save";

describe("dev studio skill save helpers", () => {
  it("deduplicates selected paths while preserving order", () => {
    expect(normalizeSelectedFilePaths([" docs/a.md ", "docs/a.md", "", "src/index.ts"])).toEqual([
      "docs/a.md",
      "src/index.ts",
    ]);
  });

  it("finds the first markdown file from the selected paths", () => {
    expect(findFirstMarkdownPath(["src/index.ts", "docs/SKILL.md", "README.md"])).toBe("docs/SKILL.md");
  });

  it("keeps manual prompt when provided", async () => {
    const readWorkspaceFile = vi.fn(async () => "should not be used");

    await expect(resolveDevStudioSkillSaveInput({
      name: "  Demo Skill  ",
      description: "  description  ",
      manualPrompt: "  manual prompt  ",
      selectedFiles: ["docs/SKILL.md"],
      readWorkspaceFile,
    })).resolves.toMatchObject({
      name: "Demo Skill",
      description: "description",
      system_prompt: "manual prompt",
      source_files: ["docs/SKILL.md"],
      prompt_source: "manual",
      prompt_path: null,
    });

    expect(readWorkspaceFile).not.toHaveBeenCalled();
  });

  it("falls back to the first selected markdown file", async () => {
    const readWorkspaceFile = vi.fn(async (path: string) => `content from ${path}`);

    await expect(resolveDevStudioSkillSaveInput({
      name: "Demo Skill",
      description: "",
      manualPrompt: "   ",
      selectedFiles: ["src/index.ts", "docs/SKILL.md", "README.md"],
      readWorkspaceFile,
    })).resolves.toMatchObject({
      system_prompt: "content from docs/SKILL.md",
      prompt_source: "selected_markdown",
      prompt_path: "docs/SKILL.md",
    });

    expect(readWorkspaceFile).toHaveBeenCalledWith("docs/SKILL.md");
  });

  it("rejects save when neither prompt nor markdown file is available", async () => {
    await expect(resolveDevStudioSkillSaveInput({
      name: "Demo Skill",
      description: "",
      manualPrompt: "",
      selectedFiles: ["src/index.ts"],
      readWorkspaceFile: async () => "",
    })).rejects.toThrow(".md");
  });

  it("detects the newly created skill from refreshed own skills", () => {
    const skills: SkillDetail[] = [
      {
        id: 10,
        name: "旧 Skill",
        description: "",
        scope: "personal",
        department_id: null,
        created_by: 1,
        is_active: true,
        created_at: "2026-04-14T00:00:00Z",
        mode: "hybrid",
        status: "draft",
        knowledge_tags: [],
        auto_inject: true,
        current_version: 1,
      },
      {
        id: 11,
        name: "新 Skill",
        description: "",
        scope: "personal",
        department_id: null,
        created_by: 1,
        is_active: true,
        created_at: "2026-04-15T00:00:00Z",
        mode: "hybrid",
        status: "draft",
        knowledge_tags: [],
        auto_inject: true,
        current_version: 1,
      },
    ];

    expect(findCreatedSkill(new Set([10]), skills, "新 Skill")?.id).toBe(11);
  });

  it("builds a direct skill studio url for the created skill", () => {
    expect(buildSkillStudioUrl(42)).toBe("/skill-studio?skill_id=42");
  });
});
