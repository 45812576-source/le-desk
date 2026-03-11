import type { ContentBlock } from "@/lib/types";

type FileRefBlock = Extract<ContentBlock, { type: "file_ref" }>;

const MIME_ICON: Record<string, string> = {
  "application/pdf": "📄",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "📊",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "text/plain": "📃",
  "image/": "🖼",
};

function getIcon(mime?: string): string {
  if (!mime) return "📎";
  for (const [key, icon] of Object.entries(MIME_ICON)) {
    if (mime.startsWith(key)) return icon;
  }
  return "📎";
}

export function FileRefCard({ block }: { block: FileRefBlock }) {
  return (
    <div className="my-2 flex items-center gap-2 border-2 border-[#1A202C] bg-[#F8FAFC] px-3 py-2 w-fit">
      <span className="text-base">{getIcon(block.mime)}</span>
      <span className="text-[10px] font-bold text-[#1A202C]">{block.filename}</span>
      {block.url && (
        <a
          href={block.url}
          download={block.filename}
          className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 bg-[#00D1FF] text-[#1A202C] border border-[#1A202C] hover:bg-[#00A3C4] transition-colors"
        >
          下载
        </a>
      )}
    </div>
  );
}
