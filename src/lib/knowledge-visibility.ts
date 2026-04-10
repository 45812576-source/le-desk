import type { KnowledgeDetail } from "@/lib/types";

export function isVisibleInMyOrganize(
  entry: Pick<KnowledgeDetail, "created_by" | "is_in_my_knowledge">,
  currentUserId?: number | null,
  hasSharedEditPermission = false,
): boolean {
  if (currentUserId != null && entry.created_by === currentUserId) return true;
  if (hasSharedEditPermission) return true;
  return entry.is_in_my_knowledge === true;
}
