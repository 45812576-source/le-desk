import type { TimelineQuickAction } from "./GovernanceTimeline";

export function buildContextualSystemQuickActions(input: {
  skillId: number | null;
  editorExpanded?: boolean;
  selectedSourceFile: string | null;
  activeCardTarget?: string | null;
}): TimelineQuickAction[] {
  if (!input.skillId || input.editorExpanded) return [];

  const actions: TimelineQuickAction[] = [];
  const target = typeof input.activeCardTarget === "string" ? input.activeCardTarget.trim() : "";
  const selectedSourceFile = typeof input.selectedSourceFile === "string" ? input.selectedSourceFile.trim() : "";

  if (target) {
    actions.push({
      label: target === "SKILL.md" ? "打开 SKILL.md" : "打开关联文件",
      msg: target === "SKILL.md" ? "打开 SKILL.md" : `打开关联文件：${target}`,
      dispatch: "ui",
      payload: {
        kind: "open_editor_target",
        fileType: target === "SKILL.md" ? "prompt" : "asset",
        filename: target,
      },
    });
  }

  if (selectedSourceFile && selectedSourceFile !== target) {
    actions.push({
      label: "打开当前文件",
      msg: `打开当前文件：${selectedSourceFile}`,
      dispatch: "ui",
      payload: {
        kind: "open_editor_target",
        fileType: "asset",
        filename: selectedSourceFile,
      },
    });
  }

  if (!actions.some((action) => action.payload?.filename === "SKILL.md")) {
    actions.push({
      label: "打开 SKILL.md",
      msg: "打开 SKILL.md",
      dispatch: "ui",
      payload: {
        kind: "open_editor_target",
        fileType: "prompt",
        filename: "SKILL.md",
      },
    });
  }

  return actions;
}
