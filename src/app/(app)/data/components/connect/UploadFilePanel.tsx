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
  const [uploadNotice, setUploadNotice] = useState("");
  const [result, setResult] = useState<{ display_name: string; rows_inserted: number; columns: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    setUploadNotice("");
    setResult(null);
  }

  async function handleUpload() {
    if (!file) { setError("请先选择文件"); return; }
    setUploading(true);
    setError("");
    setUploadNotice("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = getToken();
      const res = await fetch("/api/proxy/business-tables/upload-file", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const tryParseJson = async () => {
        const text = await res.text().catch(() => "");
        if (!text) return null;
        try {
          return JSON.parse(text) as { detail?: string; display_name?: string; rows_inserted?: number; columns?: number };
        } catch {
          return null;
        }
      };
      if (!res.ok) {
        let detail = `上传失败 (${res.status})`;
        const j = await tryParseJson();
        detail = j?.detail || detail;
        setError(detail);
        return;
      }
      const data = await tryParseJson();
      const nextResult =
        data && typeof data.display_name === "string"
          ? {
              display_name: data.display_name,
              rows_inserted: Number(data.rows_inserted || 0),
              columns: Number(data.columns || 0),
            }
          : {
              display_name: file.name.replace(/\.(csv|xlsx|xls)$/i, ""),
              rows_inserted: 0,
              columns: 0,
            };
      setResult(nextResult);
      if (nextResult.columns === 0) {
        setUploadNotice("文件已上传，但没有识别到字段；请确认首行是否为表头，或文件是否为空白模板。");
      } else if (nextResult.rows_inserted === 0) {
        setUploadNotice(`已识别 ${nextResult.columns} 个字段，但没有导入数据行；如果这是模板文件，可以继续补数据后再给 Skill 使用。`);
      } else {
        setUploadNotice(`已导入 ${nextResult.columns} 个字段 / ${nextResult.rows_inserted} 行数据，可以去数据资产页继续看样例和字段覆盖。`);
      }
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? `网络错误: ${err.message}` : "网络错误，请检查后端服务是否启动");
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
          {uploadNotice && (
            <p className={`text-[10px] font-bold ${
              uploadNotice.includes("可以去数据资产页继续看样例") ? "text-green-600" : "text-amber-600"
            }`}>
              {uploadNotice}
            </p>
          )}

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
