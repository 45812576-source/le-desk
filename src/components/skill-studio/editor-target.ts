import type { SelectedFile, StagedEdit } from "./types";
import type { WorkflowActionResult } from "./workflow-protocol";
import { resolveStagedEditEditorTarget } from "./utils";

export type StudioEditorTarget =
  | { kind: "empty" }
  | { kind: "prompt"; skillId: number; filename: "SKILL.md"; reason?: string }
  | { kind: "asset"; skillId: number; filename: string; reason?: string }
  | { kind: "loading"; next: SelectedFile; previous?: SelectedFile | null; reason?: string }
  | { kind: "error"; message: string; fallback: SelectedFile | null; reason?: string };

export function buildPromptEditorTarget(skillId: number, reason?: string): StudioEditorTarget {
  return { kind: "prompt", skillId, filename: "SKILL.md", reason };
}

export function buildAssetEditorTarget(skillId: number, filename: string, reason?: string): StudioEditorTarget {
  return { kind: "asset", skillId, filename, reason };
}

export function buildAssetLoadingTarget(next: Extract<SelectedFile, { fileType: "asset" }>, previous?: SelectedFile | null, reason?: string): StudioEditorTarget {
  return { kind: "loading", next, previous, reason };
}

export function buildEditorErrorTarget(message: string, fallback: SelectedFile | null, reason?: string): StudioEditorTarget {
  return { kind: "error", message, fallback, reason };
}

export function editorTargetFromSelectedFile(selectedFile: SelectedFile | null, reason?: string): StudioEditorTarget {
  if (!selectedFile) return { kind: "empty" };
  if (selectedFile.fileType === "prompt") {
    return buildPromptEditorTarget(selectedFile.skillId, reason);
  }
  return buildAssetEditorTarget(selectedFile.skillId, selectedFile.filename, reason);
}

export function selectedFileFromEditorTarget(target: StudioEditorTarget): SelectedFile | null {
  if (target.kind === "prompt") {
    return { skillId: target.skillId, fileType: "prompt" };
  }
  if (target.kind === "asset") {
    return { skillId: target.skillId, fileType: "asset", filename: target.filename };
  }
  if (target.kind === "loading") {
    return target.next;
  }
  if (target.kind === "error") {
    return target.fallback;
  }
  return null;
}

export function resolveWorkflowActionEditorTarget(params: {
  skillId: number | null;
  actionResult?: WorkflowActionResult | null;
  stagedEdit?: Pick<StagedEdit, "fileType" | "filename"> | null;
}): StudioEditorTarget | null {
  if (!params.skillId) return null;
  const targetType = typeof params.actionResult?.target_type === "string"
    ? params.actionResult.target_type
    : typeof params.actionResult?.result?.target_type === "string"
      ? params.actionResult.result.target_type
      : null;
  const targetKey = typeof params.actionResult?.target_key === "string"
    ? params.actionResult.target_key
    : typeof params.actionResult?.result?.target_key === "string"
      ? params.actionResult.result.target_key
      : null;

  if (targetType === "system_prompt" || targetType === "prompt" || targetType === "metadata") {
    return buildPromptEditorTarget(params.skillId, "workflow_action");
  }
  if (targetType === "source_file" && targetKey) {
    return buildAssetEditorTarget(params.skillId, targetKey, "workflow_action");
  }

  const fallbackTarget = params.stagedEdit ? resolveStagedEditEditorTarget(params.stagedEdit) : null;
  if (!fallbackTarget) return null;
  return fallbackTarget.fileType === "prompt"
    ? buildPromptEditorTarget(params.skillId, "staged_edit_fallback")
    : buildAssetEditorTarget(params.skillId, fallbackTarget.filename, "staged_edit_fallback");
}
