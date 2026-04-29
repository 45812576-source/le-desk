import type { SkillMemoTask } from "@/lib/types";
import type { StudioDiff } from "./types";
import {
  buildFixTaskPrompt,
  buildInputSlotDefinitionStudioDiff,
  isInputSlotDefinitionFixTask,
  isMetadataDescriptionFixTask,
  isStudioFixTaskPrompt,
} from "./fix-task-prompt";

export type StudioMessageSource = "user_input" | "system_command" | "workflow_action";

export type StudioRouteName = "binding_action" | "test_flow";

export type StudioRequiredOutput =
  | "studio_diff"
  | "studio_governance_action"
  | "studio_draft"
  | "none";

export type StudioCommand =
  | {
      type: "fix_task";
      taskId: string;
      targetKind: string;
      targetRef: string | null;
      targetFiles: string[];
      requiredOutput: StudioRequiredOutput;
      forbiddenRoutes: StudioRouteName[];
      fallbackDiff?: StudioDiff;
      content: string;
    };

export type StudioSendOptions = {
  source?: StudioMessageSource;
  command?: StudioCommand | null;
  skipNaturalLanguageResolvers?: boolean;
};

export function buildFixTaskStudioCommand(task: SkillMemoTask): StudioCommand {
  const inputSlotFix = isInputSlotDefinitionFixTask(task);
  return {
    type: "fix_task",
    taskId: task.id,
    targetKind: task.target_kind || "unknown",
    targetRef: task.target_ref || null,
    targetFiles: task.target_files || [],
    requiredOutput: isMetadataDescriptionFixTask(task)
      ? "studio_governance_action"
      : "studio_diff",
    forbiddenRoutes: ["binding_action", "test_flow"],
    fallbackDiff: inputSlotFix ? buildInputSlotDefinitionStudioDiff() : undefined,
    content: buildFixTaskPrompt(task),
  };
}

export function buildStudioDiffBlock(diff: StudioDiff): string {
  return [
    "```studio_diff",
    JSON.stringify(diff, null, 2),
    "```",
  ].join("\n");
}

function extractStudioDiffBlocks(text: string): StudioDiff[] {
  const blocks: StudioDiff[] = [];
  const pattern = /```studio_diff\s*\n([\s\S]*?)\n```/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    try {
      blocks.push(JSON.parse(match[1] || "{}") as StudioDiff);
    } catch {
      // Ignore malformed blocks; the caller can fall back deterministically.
    }
  }
  return blocks;
}

export function hasStudioDiffOps(diff: StudioDiff | null | undefined): boolean {
  return Array.isArray(diff?.ops) && diff.ops.length > 0;
}

function isUnsafeFullPromptReplacement(input: {
  command: StudioCommand | null | undefined;
  diff: StudioDiff;
  currentPrompt: string;
}): boolean {
  if (input.command?.targetKind !== "input_slot_definition") return false;
  const promptLength = input.currentPrompt.trim().length;
  if (promptLength < 120) return false;
  if (typeof input.diff.system_prompt?.new === "string") return true;
  return (input.diff.ops || []).some((op) => {
    if (op.type !== "replace" || typeof op.old !== "string") return false;
    const oldLength = op.old.trim().length;
    const newLength = typeof op.new === "string" ? op.new.trim().length : 0;
    return oldLength >= promptLength * 0.7 && newLength < promptLength * 0.7;
  });
}

export function selectStudioDiffForCommand(input: {
  command: StudioCommand | null | undefined;
  diff: StudioDiff | null | undefined;
  currentPrompt: string;
}): StudioDiff | null {
  const { command, diff, currentPrompt } = input;
  if (!command || command.requiredOutput !== "studio_diff") return diff ?? null;
  if (diff && hasStudioDiffOps(diff) && !isUnsafeFullPromptReplacement({ command, diff, currentPrompt })) {
    return diff;
  }
  return command.fallbackDiff ?? null;
}

export function coerceRequiredStructuredResponseText(input: {
  text: string;
  command: StudioCommand | null | undefined;
  currentPrompt: string;
  final: boolean;
}): string {
  const { text, command, currentPrompt, final } = input;
  if (!command || command.requiredOutput !== "studio_diff") return text;

  const blocks = extractStudioDiffBlocks(text);
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const diff = selectStudioDiffForCommand({ command, diff: blocks[index], currentPrompt });
    if (diff) return buildStudioDiffBlock(diff);
  }

  if (final && command.fallbackDiff) {
    return buildStudioDiffBlock(command.fallbackDiff);
  }
  return text;
}

export function shouldRunNaturalLanguageResolvers(input: {
  text: string;
  source?: StudioMessageSource;
  command?: StudioCommand | null;
  skipNaturalLanguageResolvers?: boolean;
}) {
  if (input.skipNaturalLanguageResolvers) return false;
  if (input.command) return false;
  if ((input.source || "user_input") !== "user_input") return false;
  return !isStudioFixTaskPrompt(input.text);
}

export function commandTelemetryPayload(command: StudioCommand | null | undefined) {
  if (!command) return undefined;
  return {
    type: command.type,
    task_id: command.taskId,
    target_kind: command.targetKind,
    target_ref: command.targetRef,
    target_files: command.targetFiles,
    required_output: command.requiredOutput,
    forbidden_routes: command.forbiddenRoutes,
  };
}
