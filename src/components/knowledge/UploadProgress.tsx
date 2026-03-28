"use client";

import { formatFileSize } from "@/lib/format";
import FileTypeIcon from "./FileTypeIcon";

export interface UploadingFile {
  name: string;
  size: number;
  progress: number; // 0-100
  status: "uploading" | "done" | "error";
  ext: string;
}

interface UploadProgressProps {
  files: UploadingFile[];
}

export default function UploadProgress({ files }: UploadProgressProps) {
  if (files.length === 0) return null;

  const totalProgress = files.reduce((sum, f) => sum + f.progress, 0) / files.length;
  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div className="mx-3 my-2 border-2 border-[#1A202C] bg-white p-2 space-y-2">
      {/* Overall progress */}
      <div className="flex items-center justify-between text-[9px] font-bold text-gray-600">
        <span>上传中 {doneCount}/{files.length}</span>
        <span>{Math.round(totalProgress)}%</span>
      </div>
      <div className="h-1.5 bg-gray-200 w-full">
        <div
          className="h-full bg-[#00D1FF] transition-all duration-300"
          style={{ width: `${totalProgress}%` }}
        />
      </div>

      {/* Per-file rows */}
      {files.map((f) => (
        <div key={f.name} className="flex items-center gap-2">
          <FileTypeIcon ext={f.ext} size={14} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[9px] truncate max-w-[140px]">{f.name}</span>
              <span className="text-[8px] text-gray-400 flex-shrink-0 ml-1">
                {f.status === "done" ? "✓" : f.status === "error" ? "✕" : `${f.progress}%`}
              </span>
            </div>
            <div className="h-1 bg-gray-100 mt-0.5">
              <div
                className={`h-full transition-all duration-300 ${
                  f.status === "error" ? "bg-red-400" :
                  f.status === "done" ? "bg-[#00CC99]" :
                  "bg-[#00D1FF]"
                }`}
                style={{ width: `${f.progress}%` }}
              />
            </div>
            <div className="text-[8px] text-gray-400 mt-0.5">{formatFileSize(f.size)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
