"use client";

import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { getToken } from "@/lib/api";

function UploadFilePanel({ onAdded }: { onAdded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ display_name: string; rows_inserted: number; columns: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    setResult(null);
  }

  async function handleUpload() {
    if (!file) { setError("请先选择文件"); return; }
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getToken();
      const res = await fetch("/api/proxy/business-tables/upload-file", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || `上传失败 (${res.status})`);
        return;
      }
      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onAdded();
    } catch {
      setError("网络错误");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="border-2 border-[#1A202C] bg-white">
        <div className="px-4 py-2.5 bg-[#EBF4F7] border-b-2 border-[#1A202C]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— 上传 CSV / Excel 文件</span>
        </div>
        <div className="p-4 space-y-3">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-[#00D1FF] p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors"
          >
            <Upload size={24} className="text-gray-400" />
            {file ? (
              <span className="text-[11px] font-bold text-[#1A202C]">{file.name} ({(file.size / 1024).toFixed(0)} KB)</span>
            ) : (
              <span className="text-[10px] text-gray-400">点击选择 .csv / .xlsx / .xls 文件（最大 50MB）</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />

          {error && <p className="text-[10px] text-red-500 font-bold">{error}</p>}

          {result && (
            <div className="border-2 border-[#00CC99] bg-[#00CC99]/5 p-3">
              <p className="text-[10px] font-bold text-[#00CC99]">
                「{result.display_name}」创建成功 — {result.columns} 列，{result.rows_inserted} 行数据
              </p>
            </div>
          )}

          <PixelButton onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? "上传中..." : "✓ 上传并创建数据表"}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

export default UploadFilePanel;
