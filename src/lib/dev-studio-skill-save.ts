import type { SkillDetail } from "@/lib/types";

export type WorkspaceFileReader = (path: string) => Promise<string>;

export interface ResolvedDevStudioSkillSaveInput {
  name: string;
  description: string;
  system_prompt: string;
  source_files: string[];
  prompt_source: "manual" | "selected_markdown";
  prompt_path: string | null;
}

export function normalizeSelectedFilePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const path of paths) {
    const trimmed = path.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

export function findFirstMarkdownPath(paths: string[]): string | null {
  return normalizeSelectedFilePaths(paths).find((path) => path.toLowerCase().endsWith(".md")) ?? null;
}

export async function resolveDevStudioSkillSaveInput(params: {
  name: string;
  description: string;
  manualPrompt: string;
  selectedFiles: string[];
  readWorkspaceFile: WorkspaceFileReader;
}): Promise<ResolvedDevStudioSkillSaveInput> {
  const name = params.name.trim();
  const description = params.description.trim();
  const sourceFiles = normalizeSelectedFilePaths(params.selectedFiles);
  const manualPrompt = params.manualPrompt.trim();

  if (manualPrompt) {
    return {
      name,
      description,
      system_prompt: manualPrompt,
      source_files: sourceFiles,
      prompt_source: "manual",
      prompt_path: null,
    };
  }

  const promptPath = findFirstMarkdownPath(sourceFiles);
  if (!promptPath) {
    throw new Error("请填写 System Prompt，或至少选择一个 .md 文件作为主 Prompt");
  }

  const fileContent = await params.readWorkspaceFile(promptPath);
  if (!fileContent.trim()) {
    throw new Error(`主 Prompt 文件为空：${promptPath}`);
  }

  return {
    name,
    description,
    system_prompt: fileContent,
    source_files: sourceFiles,
    prompt_source: "selected_markdown",
    prompt_path: promptPath,
  };
}

export function findCreatedSkill(
  previousSkillIds: Set<number>,
  skills: SkillDetail[],
  expectedName?: string,
): SkillDetail | null {
  const created = skills.filter((skill) => !previousSkillIds.has(skill.id));
  const candidates = created.length > 0 ? created : skills;
  const trimmedExpectedName = expectedName?.trim();
  const exactMatch = trimmedExpectedName
    ? candidates.find((skill) => skill.name.trim() === trimmedExpectedName)
    : null;

  if (exactMatch) return exactMatch;

  return [...candidates].sort((left, right) => {
    const createdAtDiff = (Date.parse(right.created_at || "") || 0) - (Date.parse(left.created_at || "") || 0);
    if (createdAtDiff !== 0) return createdAtDiff;
    return right.id - left.id;
  })[0] ?? null;
}

export function buildSkillStudioUrl(skillId: number): string {
  return `/skill-studio?skill_id=${skillId}`;
}
