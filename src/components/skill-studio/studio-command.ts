import type { SkillMemoTask } from "@/lib/types";
import {
  buildFixTaskPrompt,
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
      content: string;
    };

export type StudioSendOptions = {
  source?: StudioMessageSource;
  command?: StudioCommand | null;
  skipNaturalLanguageResolvers?: boolean;
};

export function buildFixTaskStudioCommand(task: SkillMemoTask): StudioCommand {
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
    content: buildFixTaskPrompt(task),
  };
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
