"use client";

import { useEffect, useRef, useState } from "react";
import type { ContentBlock } from "@/lib/types";

type ToolCallBlock = Extract<ContentBlock, { type: "tool_call" }>;

const STATUS_LABEL: Record<string, string> = {
  running: "调用中...",
  done: "已完成",
  error: "失败",
};

const STATUS_COLOR: Record<string, string> = {
  running: "text-[#00A3C4] animate-pulse",
  done: "text-[#00CC99]",
  error: "text-red-500",
};

const PHASE_LABEL: Record<string, string> = {
  validating: "校验参数...",
  executing: "执行中...",
  completed: "已完成",
};

export function ToolCallCard({ block }: { block: ToolCallBlock }) {
  const [expanded, setExpanded] = useState(false);
  const startTimeRef = useRef<number>(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startTimeRef.current === 0) startTimeRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (block.status !== "running") {
      if (startTimeRef.current > 0) {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }
      return;
    }
    const timer = setInterval(() => {
      if (startTimeRef.current > 0) {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [block.status]);

  // 服务端返回的精确耗时（ms），转换为秒显示
  const serverDuration = block.duration_ms !== undefined
    ? (block.duration_ms / 1000).toFixed(1)
    : null;

  const phaseLabel = block.phase && block.status === "running"
    ? PHASE_LABEL[block.phase]
    : null;

  return (
    <div className={`my-2 border-2 ${
      block.status === "error" ? "border-red-400 bg-red-50" :
      "border-[#1A202C] bg-[#F0F4F8]"
    }`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[#00D1FF] text-sm">⚙</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">
            {block.tool}
          </span>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${STATUS_COLOR[block.status]}`}>
            {phaseLabel ?? STATUS_LABEL[block.status]}
          </span>
          {/* 服务端精确耗时（完成后显示） */}
          {serverDuration !== null && block.status !== "running" && (
            <span className="text-[8px] font-bold text-gray-400 tracking-widest">
              {serverDuration}s
            </span>
          )}
          {/* 客户端计时（运行中显示） */}
          {elapsed > 0 && block.status === "running" && (
            <span className="text-[8px] font-bold text-gray-300 tracking-widest">
              {elapsed}s
            </span>
          )}
        </div>
        <span className="text-[8px] text-gray-400">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && Object.keys(block.input).length > 0 && (
        <div className="px-3 pb-2 border-t border-gray-200">
          <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1 mt-1">参数</div>
          <pre className="text-[9px] font-mono text-gray-600 overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(block.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
