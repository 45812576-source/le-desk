import type { KnowledgeDetail } from "@/lib/types";

const PREVIEWABLE_MEDIA_EXTS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".svg",
  ".mp3", ".wav", ".m4a", ".ogg", ".flac",
  ".mp4", ".webm", ".mov",
]);

type PreviewRoutingEntry = Pick<
  KnowledgeDetail,
  "source_type" | "external_edit_mode" | "oss_key" | "file_ext" | "can_open_onlyoffice"
>;

export function shouldPreferDetachedCopySourcePreview(entry: PreviewRoutingEntry): boolean {
  const isDetachedLarkCopy =
    entry.source_type === "lark_doc" && entry.external_edit_mode === "detached_copy";

  if (!isDetachedLarkCopy || !entry.oss_key) {
    return false;
  }

  const ext = (entry.file_ext || "").toLowerCase();
  return PREVIEWABLE_MEDIA_EXTS.has(ext) || Boolean(entry.can_open_onlyoffice);
}
