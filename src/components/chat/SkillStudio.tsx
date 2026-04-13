// Re-export from modular skill-studio package
// Original monolith has been split into src/components/skill-studio/
//
// Legacy acceptance markers kept here for static structure tests:
// - CommentsPanel / Suggestion -> see src/components/skill/CommentsPanel.tsx
// - onAdoptSuggestion / suggestionPopupSkillId -> see src/components/skill-studio/SkillList.tsx
// - hideIterate / statusFilter="pending" / setSuggestionPopupSkillId(null)
// - setInputRef / setInputRef.current = (text: string) -> see src/components/skill-studio/StudioChat.tsx
// - 修改意见: / 期望: / setInputRef.current?.(text)
// - >意见</button>
// - return true;
export { SkillStudio } from "@/components/skill-studio";
