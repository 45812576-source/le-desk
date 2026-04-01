"use client";

import { CloudUpload } from "lucide-react";
import { useRef } from "react";

interface DropZoneProps {
  onFiles: (files: FileList) => void;
  dragging: boolean;
}

export default function DropZone({ onFiles, dragging }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`mx-3 my-2 border-2 border-dashed flex flex-col items-center justify-center py-4 gap-2 transition-all cursor-pointer ${
        dragging
          ? "border-[#00D1FF] bg-[#CCF2FF]/30"
          : "border-gray-300 hover:border-[#00A3C4] hover:bg-[#F0FAFF]"
      }`}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); }}
      />
      <CloudUpload
        size={24}
        className={`transition-transform ${dragging ? "scale-110 text-[#00D1FF]" : "text-gray-400"}`}
      />
      <div className="text-center">
        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
          {dragging ? "松开以上传" : "拖拽文件到此处"}
        </p>
        {!dragging && (
          <>
            <p className="text-[8px] text-[#00A3C4] mt-0.5 font-bold underline">或 点击上传</p>
            <p className="text-[7px] text-gray-400 mt-0.5">支持 ZIP 批量上传</p>
          </>
        )}
      </div>
    </div>
  );
}
