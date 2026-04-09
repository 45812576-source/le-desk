"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface ImportWizardProps {
  importType: string;
  open?: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

interface ImportSession {
  session_id: string;
  row_count: number;
  parsed_count: number;
  ai_parsed_data: unknown;
  ai_parse_note: string;
  status: string;
}

const STEP_LABELS = ["上传文件", "预览解析", "确认写入", "完成"];

export default function ImportWizard({
  importType,
  open = true,
  onClose,
  onComplete,
}: ImportWizardProps) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ImportSession | null>(null);

  function reset() {
    setStep(0);
    setFile(null);
    setLoading(false);
    setError(null);
    setSession(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiFetch<ImportSession>(
        `/org-management/import/upload?import_type=${encodeURIComponent(importType)}`,
        { method: "POST", body: formData },
      );
      setSession(data);
      setStep(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleReparse() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ImportSession>(
        `/org-management/import/${session.session_id}/reparse`,
        { method: "POST" },
      );
      setSession(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "重新解析失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ImportSession>(
        `/org-management/import/${session.session_id}/confirm`,
        { method: "POST" },
      );
      setSession(data);
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "确认失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        `/org-management/import/${session.session_id}/apply`,
        { method: "POST" },
      );
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "写入失败");
    } finally {
      setLoading(false);
    }
  }

  function handleDone() {
    onComplete?.();
    handleClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        {/* 步骤指示器 */}
        <div className="mb-6 flex items-center gap-2">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  i <= step
                    ? "bg-[#00D1FF] text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-sm ${
                  i <= step ? "font-semibold text-[#1A202C]" : "text-gray-400"
                }`}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div className="mx-1 h-px w-6 bg-gray-300" />
              )}
            </div>
          ))}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 0: 上传 */}
        {step === 0 && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-[#1A202C]">
              上传文件
            </h3>
            <p className="mb-3 text-sm text-gray-500">
              支持 CSV / XLSX 格式，类型：{importType}
            </p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mb-4 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-[#00D1FF] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#00A3C4]"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || loading}
                className="rounded bg-[#00D1FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00A3C4] disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        d="M4 12a8 8 0 018-8"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        className="opacity-75"
                      />
                    </svg>
                    上传中...
                  </span>
                ) : (
                  "上传"
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 1: 预览 */}
        {step === 1 && session && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-[#1A202C]">
              AI 解析预览
            </h3>
            <div className="mb-3 flex gap-4 text-sm text-gray-600">
              <span>
                总行数：<strong>{session.row_count}</strong>
              </span>
              <span>
                已解析：<strong>{session.parsed_count}</strong>
              </span>
            </div>
            {session.ai_parse_note && (
              <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
                {session.ai_parse_note}
              </div>
            )}
            <pre className="mb-4 max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs">
              <code>
                {JSON.stringify(session.ai_parsed_data, null, 2)}
              </code>
            </pre>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleReparse}
                disabled={loading}
                className="rounded border border-[#00D1FF] px-4 py-2 text-sm font-semibold text-[#00D1FF] hover:bg-[#00D1FF]/10 disabled:opacity-50"
              >
                {loading ? "解析中..." : "重新解析"}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="rounded bg-[#00D1FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00A3C4] disabled:opacity-50"
              >
                确认
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 确认写入 */}
        {step === 2 && (
          <div>
            <h3 className="mb-4 text-lg font-bold text-[#1A202C]">
              确认写入
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              数据已确认，点击下方按钮写入正式表。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleApply}
                disabled={loading}
                className="rounded bg-[#00CC99] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00b386] disabled:opacity-50"
              >
                {loading ? "写入中..." : "写入正式表"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 完成 */}
        {step === 3 && (
          <div className="text-center">
            <div className="mb-4 text-4xl">&#10003;</div>
            <h3 className="mb-2 text-lg font-bold text-[#1A202C]">
              导入完成
            </h3>
            <p className="mb-6 text-sm text-gray-500">
              数据已成功写入正式表。
            </p>
            <button
              onClick={handleDone}
              className="rounded bg-[#00D1FF] px-6 py-2 text-sm font-semibold text-white hover:bg-[#00A3C4]"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
