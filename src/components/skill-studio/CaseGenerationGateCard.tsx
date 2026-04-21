"use client";

import { AlertTriangle, CheckCircle, Circle, Lock } from "lucide-react";
import type { TestFlowGateReason, TestFlowGuidedStep } from "@/lib/test-flow-types";

const FLOW_STAGES = [
  { id: "gate", label: "前置门禁" },
  { id: "case_gen", label: "生成用例" },
  { id: "case_confirm", label: "确认用例" },
  { id: "execution", label: "执行测试" },
  { id: "quality", label: "质量检测" },
  { id: "verdict", label: "最终结论" },
];

export function CaseGenerationGateCard({
  verdictLabel,
  verdictReason,
  gateSummary,
  gateReasons,
  guidedSteps,
  primaryAction,
  onAction,
}: {
  verdictLabel?: string | null;
  verdictReason?: string | null;
  gateSummary?: string | null;
  gateReasons?: TestFlowGateReason[];
  guidedSteps?: TestFlowGuidedStep[];
  primaryAction?: string | null;
  onAction?: (action: string) => void;
}) {
  return (
    <div className="space-y-2">
      {/* 顶部结论 */}
      <div className="border-2 border-amber-400 bg-amber-50 px-3 py-2">
        <div className="text-[10px] font-bold text-amber-700">
          {verdictLabel || "还不能开始质量检测"}
        </div>
        {verdictReason && (
          <div className="text-[8px] text-amber-600 mt-0.5">{verdictReason}</div>
        )}
      </div>

      {/* 流程进度条 */}
      <div className="flex items-center gap-0.5 px-1">
        {FLOW_STAGES.map((stage, i) => {
          const isCurrent = stage.id === "gate";
          return (
            <div key={stage.id} className="flex items-center gap-0.5">
              <div className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest border ${
                isCurrent
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-gray-200 bg-gray-50 text-gray-400"
              }`}>
                {isCurrent ? <Lock size={8} /> : <Circle size={6} />}
                {stage.label}
              </div>
              {i < FLOW_STAGES.length - 1 && (
                <div className="w-1.5 h-px bg-gray-300" />
              )}
            </div>
          );
        })}
      </div>

      {/* 门禁摘要 */}
      {gateSummary && (
        <div className="text-[8px] font-bold text-slate-600 px-1">{gateSummary}</div>
      )}

      {/* 原因列表 */}
      {gateReasons && gateReasons.length > 0 && (
        <div className="space-y-1">
          {gateReasons.map((reason) => (
            <div
              key={reason.code}
              className={`border px-2 py-1.5 flex items-start gap-1.5 ${
                reason.severity === "critical"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <AlertTriangle size={10} className={
                reason.severity === "critical" ? "text-red-400 mt-px shrink-0" : "text-amber-400 mt-px shrink-0"
              } />
              <div className="min-w-0 flex-1">
                <div className={`text-[9px] font-bold ${
                  reason.severity === "critical" ? "text-red-700" : "text-amber-700"
                }`}>
                  {reason.title}
                </div>
                <div className="text-[8px] text-slate-500 mt-0.5">{reason.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新手步骤 */}
      {guidedSteps && guidedSteps.length > 0 && (
        <div className="space-y-1 mt-1">
          <div className="text-[8px] font-bold uppercase tracking-widest text-slate-500 px-1">
            操作步骤
          </div>
          {guidedSteps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 px-2 py-1.5 border ${
                step.status === "blocked"
                  ? "border-amber-300 bg-amber-50"
                  : step.status === "done"
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200 bg-gray-50"
              }`}
            >
              {step.status === "done" ? (
                <CheckCircle size={10} className="text-green-500 shrink-0" />
              ) : step.status === "blocked" ? (
                <AlertTriangle size={10} className="text-amber-500 shrink-0" />
              ) : (
                <Circle size={10} className="text-gray-300 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className={`text-[9px] font-bold ${
                  step.status === "blocked" ? "text-amber-700" : step.status === "done" ? "text-green-700" : "text-gray-400"
                }`}>
                  {step.order}. {step.title}
                </div>
                {step.status === "blocked" && (
                  <div className="text-[8px] text-slate-500 mt-0.5">{step.detail}</div>
                )}
              </div>
              {step.status === "blocked" && onAction && (
                <button
                  type="button"
                  onClick={() => onAction(step.action)}
                  className="px-2 py-0.5 text-[7px] font-bold border border-amber-500 text-amber-700 bg-white hover:bg-amber-100 shrink-0"
                >
                  {step.action_label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 主按钮 */}
      {primaryAction && onAction && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onAction(primaryAction)}
            className="w-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border-2 border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100"
          >
            {primaryAction === "go_bound_assets" ? "去绑定资产"
              : primaryAction === "generate_declaration" ? "生成权限声明"
              : primaryAction === "go_readiness" ? "查看治理缺口"
              : primaryAction === "refresh_governance" ? "刷新治理状态"
              : "开始解决"}
          </button>
        </div>
      )}
    </div>
  );
}
