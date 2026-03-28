"use client";

import {
  FileText,
  FileSpreadsheet,
  FileImage,
  FileAudio,
  FileVideo,
  FileCode,
  FileType,
  File,
  Presentation,
} from "lucide-react";
import { useTheme } from "@/lib/theme";

interface FileTypeIconProps {
  ext: string;
  size?: number;
  className?: string;
}

function getIconConfig(ext: string): { Icon: React.ElementType; colorClass: string; pixelColor: string } {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (e === "pdf") return { Icon: FileText, colorClass: "text-red-500", pixelColor: "#ef4444" };
  if (["docx", "doc", "odt", "rtf"].includes(e)) return { Icon: FileText, colorClass: "text-blue-500", pixelColor: "#3b82f6" };
  if (["xlsx", "xls", "ods", "csv"].includes(e)) return { Icon: FileSpreadsheet, colorClass: "text-green-500", pixelColor: "#22c55e" };
  if (["pptx", "ppt", "odp"].includes(e)) return { Icon: Presentation, colorClass: "text-orange-500", pixelColor: "#f97316" };
  if (["jpg", "jpeg", "png", "webp", "bmp", "gif", "svg"].includes(e)) return { Icon: FileImage, colorClass: "text-purple-500", pixelColor: "#a855f7" };
  if (["mp3", "wav", "m4a", "ogg", "flac"].includes(e)) return { Icon: FileAudio, colorClass: "text-teal-500", pixelColor: "#14b8a6" };
  if (["mp4", "webm", "mov"].includes(e)) return { Icon: FileVideo, colorClass: "text-pink-500", pixelColor: "#ec4899" };
  if (["py", "js", "ts", "jsx", "tsx", "html", "css", "json", "sql", "yaml", "yml", "xml", "sh", "bash"].includes(e)) return { Icon: FileCode, colorClass: "text-gray-500", pixelColor: "#6b7280" };
  if (e === "md") return { Icon: FileType, colorClass: "text-indigo-500", pixelColor: "#6366f1" };
  if (e === "txt") return { Icon: FileText, colorClass: "text-slate-400", pixelColor: "#94a3b8" };
  return { Icon: File, colorClass: "text-slate-400", pixelColor: "#94a3b8" };
}

export default function FileTypeIcon({ ext, size = 16, className = "" }: FileTypeIconProps) {
  const { theme } = useTheme();
  const { Icon, colorClass, pixelColor } = getIconConfig(ext);

  if (theme === "lab") {
    // Lab theme: small colored square with letter
    const letter = (ext || "?").replace(/^\./, "").slice(0, 2).toUpperCase();
    return (
      <span
        className={`inline-flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(6, size * 0.45),
          backgroundColor: pixelColor,
        }}
      >
        {letter}
      </span>
    );
  }

  return <Icon size={size} className={`${colorClass} flex-shrink-0 ${className}`} />;
}
