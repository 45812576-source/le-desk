"use client";

import { useState } from "react";
import type { WorkspaceSnapshotMissingItem } from "@/lib/types";

export default function SnapshotMissingItemsForm({
  items,
  onSubmit,
  onSkip,
  submitting,
}: {
  items: WorkspaceSnapshotMissingItem[];
  onSubmit: (answers: Record<string, string | string[] | boolean>) => void;
  onSkip: () => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[] | boolean>>(() => {
    const init: Record<string, string | string[] | boolean> = {};
    for (const item of items) {
      if (item.default_value !== undefined) {
        init[item.field_key] = item.default_value;
      } else if (item.input_type === "boolean") {
        init[item.field_key] = false;
      } else if (item.input_type === "multi_select") {
        init[item.field_key] = [];
      } else {
        init[item.field_key] = "";
      }
    }
    return init;
  });

  function setField(key: string, value: string | string[] | boolean) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function handleMultiSelectToggle(key: string, optionValue: string) {
    const current = (answers[key] as string[]) || [];
    const next = current.includes(optionValue)
      ? current.filter((v) => v !== optionValue)
      : [...current, optionValue];
    setField(key, next);
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium text-foreground">补充信息</div>
      <p className="text-xs text-muted-foreground">
        以下信息需要补充才能继续生成快照。也可以选择跳过，后续补充。
      </p>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-border bg-background px-4 py-3">
            <label className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{item.label}</span>
                {item.required && (
                  <span className="text-[10px] text-red-500">必填</span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">{item.description}</div>

              {/* text */}
              {item.input_type === "text" && (
                <input
                  value={(answers[item.field_key] as string) || ""}
                  onChange={(e) => setField(item.field_key, e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none"
                  placeholder="请输入..."
                />
              )}

              {/* select */}
              {item.input_type === "select" && (
                <select
                  value={(answers[item.field_key] as string) || ""}
                  onChange={(e) => setField(item.field_key, e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none"
                >
                  <option value="">请选择</option>
                  {item.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {/* multi_select */}
              {item.input_type === "multi_select" && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {item.options?.map((opt) => {
                    const selected = ((answers[item.field_key] as string[]) || []).includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleMultiSelectToggle(item.field_key, opt.value)}
                        className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                          selected
                            ? "border-[#00A3C4] bg-[#CCF2FF] text-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/30"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* boolean */}
              {item.input_type === "boolean" && (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!answers[item.field_key]}
                    onChange={(e) => setField(item.field_key, e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#00A3C4]"
                  />
                  <span className="text-xs text-muted-foreground">是</span>
                </div>
              )}

              {/* user_select / department_select / role_select */}
              {(item.input_type === "user_select" || item.input_type === "department_select" || item.input_type === "role_select") && (
                <input
                  value={(answers[item.field_key] as string) || ""}
                  onChange={(e) => setField(item.field_key, e.target.value)}
                  className="mt-1 w-full rounded border border-border bg-card px-3 py-1.5 text-xs text-foreground outline-none"
                  placeholder={
                    item.input_type === "user_select" ? "输入人员名称"
                      : item.input_type === "department_select" ? "输入部门名称"
                        : "输入岗位名称"
                  }
                />
              )}
            </label>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onSubmit(answers)}
          disabled={submitting}
          className="rounded bg-[#00A3C4] px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "提交中..." : "提交补充信息"}
        </button>
        <button
          onClick={onSkip}
          disabled={submitting}
          className="rounded border border-border bg-background px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30"
        >
          暂缺，继续生成
        </button>
      </div>
    </div>
  );
}
