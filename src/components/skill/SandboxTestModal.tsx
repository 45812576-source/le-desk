"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { PixelButton } from "@/components/pixel/PixelButton";

interface TestStep {
  step: string;
  label: string;
  ok: boolean;
  detail: string;
  duration_ms: number;
}

interface SkillTestResult {
  passed: boolean;
  skill_id?: number;
  tool_id?: number;
  skill_name?: string;
  tool_name?: string;
  test_input?: string;
  mock_params?: Record<string, unknown>;
  llm_response?: string;
  steps: TestStep[];
  summary: string;
}

interface SandboxTestModalProps {
  type: "skill" | "tool";
  id: number;
  name: string;
  onPassed: () => void;
  onCancel: () => void;
  passedLabel?: string;  // 测试通过后的按钮文案，默认"✓ 通过，继续发布"
}

export function SandboxTestModal({
  type,
  id,
  name,
  onPassed,
  onCancel,
  passedLabel = "✓ 通过，继续发布",
}: SandboxTestModalProps) {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [result, setResult] = useState<SkillTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setStatus("running");
    setError(null);
    setResult(null);
    try {
      const endpoint = type === "skill"
        ? `/sandbox/test-skill/${id}`
        : `/sandbox/test-tool/${id}`;
      const data = await apiFetch<SkillTestResult>(endpoint, { method: "POST" });
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "测试请求失败");
      setStatus("idle");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] w-[540px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-[#1A202C] bg-[#EBF4F7]">
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
            沙盒测试
          </span>
          <span className="text-xs font-bold text-[#1A202C] ml-1">— {name}</span>
          <span className="ml-auto text-[8px] font-mono text-gray-400 border border-gray-300 px-1.5 py-0.5">
            {type === "skill" ? "SKILL" : "TOOL"}
          </span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {status === "idle" && !result && (
            <div className="text-center py-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                {type === "skill"
                  ? "Agent 将读取 System Prompt，生成测试用例并实际运行，评估回复质量"
                  : "Agent 将分析工具结构，生成 Mock 参数并执行，验证配置是否正确"}
              </div>
              <div className="text-[8px] text-gray-300 font-mono mt-1">
                通过后方可提交审批
              </div>
            </div>
          )}

          {status === "running" && (
            <div className="text-center py-6">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse">
                测试中，请稍候...
              </div>
              <div className="text-[8px] text-gray-400 mt-2 font-mono">
                Agent 正在分析并执行测试
              </div>
            </div>
          )}

          {error && (
            <div className="border-2 border-red-400 bg-red-50 px-3 py-2 text-[9px] font-bold text-red-500">
              ✕ {error}
            </div>
          )}

          {result && (
            <>
              {/* Summary */}
              <div className={`border-2 px-3 py-2 text-xs font-bold ${
                result.passed
                  ? "border-[#00CC99] bg-[#F0FFF4] text-[#00CC99]"
                  : "border-red-400 bg-red-50 text-red-600"
              }`}>
                {result.summary}
              </div>

              {/* Steps */}
              <div className="space-y-2">
                {result.steps.map((step) => (
                  <div key={step.step} className="border border-gray-200 bg-[#F8FAFB]">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100">
                      <span className={`text-[9px] font-bold ${step.ok ? "text-[#00CC99]" : "text-red-500"}`}>
                        {step.ok ? "✓" : "✗"}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
                        {step.label}
                      </span>
                      <span className="ml-auto text-[8px] text-gray-400 font-mono">
                        {step.duration_ms}ms
                      </span>
                    </div>
                    <div className="px-3 py-2 text-[9px] text-gray-600 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {step.detail}
                    </div>
                  </div>
                ))}
              </div>

              {/* Test input / mock params */}
              {result.test_input && (
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    测试输入
                  </div>
                  <div className="border border-[#00A3C4] bg-[#F0FAFF] px-3 py-2 text-[9px] text-[#00A3C4] font-mono">
                    {result.test_input}
                  </div>
                </div>
              )}

              {result.mock_params && Object.keys(result.mock_params).length > 0 && (
                <div>
                  <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Mock 参数
                  </div>
                  <div className="border border-[#00A3C4] bg-[#F0FAFF] px-3 py-2 text-[9px] text-[#00A3C4] font-mono whitespace-pre-wrap">
                    {JSON.stringify(result.mock_params, null, 2)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t-2 border-[#1A202C]">
          {status === "idle" && !result && (
            <>
              <PixelButton onClick={runTest}>开始测试</PixelButton>
              <PixelButton variant="secondary" onClick={onCancel}>取消</PixelButton>
            </>
          )}
          {status === "running" && (
            <PixelButton variant="secondary" disabled>测试中...</PixelButton>
          )}
          {status === "done" && result && (
            <>
              {result.passed ? (
                <PixelButton onClick={onPassed}>{passedLabel}</PixelButton>
              ) : null}
              <PixelButton variant="secondary" onClick={runTest}>
                {result.passed ? "换一组测试用例" : "重新测试"}
              </PixelButton>
              <PixelButton variant="secondary" onClick={onCancel}>取消</PixelButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
