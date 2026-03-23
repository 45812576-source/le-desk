"use client";

import { useEffect, useRef, useState } from "react";

interface ToolGifPreviewProps {
  toolId: number;
  toolName: string;
  toolType?: string;
  inputSchema: Record<string, unknown> | null;
  testParams: Record<string, string>;
  testResult: { ok: boolean; result?: unknown; error?: string; duration_ms?: number } | null;
  onClose: () => void;
  anchorPos: { top: number; left: number };
}

const GIF_CACHE_PREFIX = "le_desk_tool_gif_v2_";

function getCache(toolId: number): string | null {
  try { return localStorage.getItem(GIF_CACHE_PREFIX + toolId); } catch { return null; }
}
function setCache(toolId: number, dataUrl: string) {
  try { localStorage.setItem(GIF_CACHE_PREFIX + toolId, dataUrl); } catch { /* quota */ }
}

// ── Canvas drawing helpers ────────────────────────────────────────────────────

const W = 320;
const H = 220;

// Le Desk design tokens
const PAGE_BG = "#F0F4F8";
const WHITE = "#FFFFFF";
const BORDER = "#1A202C";
const TEXT = "#1A202C";
const DIM = "#718096";
const CYAN = "#00D1FF";
const CYAN_DARK = "#00A3C4";
const GREEN = "#00CC99";
const RED = "#E53E3E";
const ACCENT_BG = "#EBF4F7";

// terminal phase colors
const TERM_BG = "#0D1117";
const DOT_RED = "#FF5F57";
const DOT_YLW = "#FFBD2E";
const DOT_GRN = "#28C840";
const TERM_BLUE = "#58A6FF";
const TERM_GREEN = "#3FB950";
const TERM_RED = "#F85149";
const TERM_DIM = "#8B949E";
const TERM_PANEL = "#161B22";
const TERM_BORDER = "#30363D";

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string, lw = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

// ── Phase 1 & 2: terminal style (unchanged) ───────────────────────────────────
function drawTerminalFrame(
  ctx: CanvasRenderingContext2D,
  phase: "input" | "running",
  toolName: string,
  params: Record<string, string>,
  tick: number,
) {
  ctx.fillStyle = TERM_BG;
  ctx.fillRect(0, 0, W, H);

  // dots
  const dotY = 18;
  [DOT_RED, DOT_YLW, DOT_GRN].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(14 + i * 18, dotY, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = TERM_DIM;
  ctx.font = "bold 10px monospace";
  ctx.textAlign = "center";
  ctx.fillText(toolName.slice(0, 30), W / 2, dotY + 4);
  ctx.textAlign = "left";
  ctx.strokeStyle = TERM_BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(W, 32); ctx.stroke();

  const bY = 44;

  if (phase === "input") {
    ctx.fillStyle = TERM_GREEN;
    ctx.font = "bold 11px monospace";
    ctx.fillText("❯", 12, bY);
    ctx.fillStyle = TERM_BLUE;
    ctx.fillText(`invoke ${toolName.slice(0, 20)}`, 26, bY);
    if (tick % 6 < 3) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(26 + ctx.measureText(`invoke ${toolName.slice(0, 20)}`).width + 2, bY - 10, 7, 12);
    }
    Object.entries(params).filter(([, v]) => v !== "").slice(0, 5).forEach(([k, v], i) => {
      const y = bY + 20 + i * 18;
      ctx.fillStyle = "#A5D6FF";
      ctx.font = "bold 10px monospace";
      ctx.fillText(`${k}:`, 12, y);
      const kw = ctx.measureText(`${k}:`).width;
      ctx.fillStyle = "#C9D1D9";
      ctx.font = "10px monospace";
      ctx.fillText(` ${String(v).slice(0, 28)}`, 12 + kw, y);
    });
  }

  if (phase === "running") {
    ctx.fillStyle = TERM_GREEN;
    ctx.font = "bold 11px monospace";
    ctx.fillText("❯", 12, bY);
    ctx.fillStyle = TERM_BLUE;
    ctx.fillText(`invoke ${toolName.slice(0, 20)}`, 26, bY);
    const spinners = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
    ctx.fillStyle = DOT_YLW;
    ctx.font = "bold 12px monospace";
    ctx.fillText(spinners[tick % spinners.length], 12, bY + 22);
    ctx.fillStyle = "#C9D1D9";
    ctx.font = "11px monospace";
    ctx.fillText(" running...", 26, bY + 22);
    const steps = ["validating params", "calling handler", "processing output"];
    const vis = Math.min(steps.length, Math.floor(tick / 3) + 1);
    steps.slice(0, vis).forEach((s, i) => {
      const done = i < vis - 1;
      ctx.fillStyle = done ? TERM_GREEN : TERM_DIM;
      ctx.font = "10px monospace";
      ctx.fillText(`  ${done ? "✓" : "·"} ${s}`, 12, bY + 44 + i * 16);
    });
    const barY = H - 28;
    for (let d = 0; d < 16; d++) {
      ctx.fillStyle = (tick + d) % 16 < 5 ? "#00D1FF" : "#1C2128";
      ctx.fillRect(12 + d * 18, barY, 10, 6);
    }
  }
}

// ── Phase 3: Le Desk chat UI style ────────────────────────────────────────────
function drawChatFrame(
  ctx: CanvasRenderingContext2D,
  toolName: string,
  result: { ok: boolean; result?: unknown; error?: string; duration_ms?: number },
  tick: number, // 0-based, used for text reveal animation
) {
  // Page background
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, W, H);

  // Sidebar strip
  ctx.fillStyle = ACCENT_BG;
  ctx.fillRect(0, 0, 36, H);
  ctx.strokeStyle = "#D1E8F0";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(36, 0); ctx.lineTo(36, H); ctx.stroke();

  // Sidebar icons (pixel dots)
  [[18, 30], [18, 60], [18, 90], [18, 120]].forEach(([x, y]) => {
    ctx.fillStyle = "#B0D4E0";
    ctx.fillRect(x - 5, y - 5, 10, 10);
  });
  // active icon highlight
  ctx.fillStyle = CYAN;
  ctx.fillRect(13, 55, 10, 10);

  // Chat area background
  ctx.fillStyle = WHITE;
  ctx.fillRect(36, 0, W - 36, H);

  // Top bar
  ctx.fillStyle = WHITE;
  ctx.fillRect(36, 0, W - 36, 28);
  ctx.strokeStyle = "#E2ECF0";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(36, 28); ctx.lineTo(W, 28); ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.font = "bold 10px monospace";
  ctx.fillText(toolName.slice(0, 24), 46, 18);
  // status dot
  ctx.fillStyle = GREEN;
  ctx.beginPath(); ctx.arc(W - 16, 14, 4, 0, Math.PI * 2); ctx.fill();

  let y = 36;
  const PAD = 8;
  const contentW = W - 36 - PAD * 2;

  // ── ToolCallCard ──────────────────────────────────────────────────────────
  // border-2 bg-[#F0F4F8] border-[#1A202C]
  const cardH = 28;
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(36 + PAD, y, contentW, cardH);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.strokeRect(36 + PAD, y, contentW, cardH);

  // ⚙ icon
  ctx.fillStyle = CYAN;
  ctx.font = "11px sans-serif";
  ctx.fillText("⚙", 36 + PAD + 6, y + 18);

  // tool name
  ctx.fillStyle = TEXT;
  ctx.font = "bold 9px monospace";
  ctx.fillText(toolName.slice(0, 18).toUpperCase(), 36 + PAD + 22, y + 17);

  // status
  const nameW = ctx.measureText(toolName.slice(0, 18).toUpperCase()).width;
  ctx.fillStyle = result.ok ? GREEN : RED;
  ctx.font = "bold 8px monospace";
  ctx.fillText(result.ok ? "已完成" : "失败", 36 + PAD + 26 + nameW, y + 17);

  // duration
  if (result.duration_ms !== undefined) {
    const dur = `${(result.duration_ms / 1000).toFixed(1)}s`;
    ctx.fillStyle = DIM;
    ctx.font = "8px monospace";
    const statusW = ctx.measureText(result.ok ? "已完成" : "失败").width;
    ctx.fillText(dur, 36 + PAD + 30 + nameW + statusW, y + 17);
  }

  // collapse arrow
  ctx.fillStyle = DIM;
  ctx.font = "8px monospace";
  ctx.textAlign = "right";
  ctx.fillText("▼", W - PAD - 2, y + 17);
  ctx.textAlign = "left";

  y += cardH + 4;

  // ── ToolResultCard ────────────────────────────────────────────────────────
  // border-l-4 border-l-[#00CC99] bg-[#F0FFF8]
  const resultText = result.ok
    ? (typeof result.result === "string" ? result.result : JSON.stringify(result.result))
    : (result.error ?? "error");

  // Measure how many chars to reveal based on tick (text type-on effect)
  const charsPerTick = 18;
  const revealed = Math.min(resultText.length, tick * charsPerTick);
  const visibleText = resultText.slice(0, revealed);

  // wrap into lines of ~38 chars each
  const maxLineChars = 38;
  const resultLines: string[] = [];
  for (let i = 0; i < visibleText.length; i += maxLineChars) {
    resultLines.push(visibleText.slice(i, i + maxLineChars));
  }
  const resultCardH = Math.max(36, 20 + resultLines.length * 12 + 8);

  ctx.fillStyle = result.ok ? "#F0FFF8" : "#FFF5F5";
  ctx.fillRect(36 + PAD, y, contentW, resultCardH);
  // left border strip (4px)
  ctx.fillStyle = result.ok ? GREEN : RED;
  ctx.fillRect(36 + PAD, y, 4, resultCardH);
  // thin outer border
  ctx.strokeStyle = "#E2ECF0";
  ctx.lineWidth = 1;
  ctx.strokeRect(36 + PAD, y, contentW, resultCardH);

  // header row
  ctx.fillStyle = result.ok ? GREEN : RED;
  ctx.font = "9px monospace";
  ctx.fillText(result.ok ? "✓" : "✗", 36 + PAD + 10, y + 14);
  ctx.fillStyle = DIM;
  ctx.font = "bold 8px monospace";
  ctx.fillText("工具结果", 36 + PAD + 22, y + 14);

  ctx.fillStyle = DIM;
  ctx.font = "8px monospace";
  ctx.textAlign = "right";
  ctx.fillText("展开", W - PAD - 2, y + 14);
  ctx.textAlign = "left";

  // separator
  ctx.strokeStyle = "#E2ECF0";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(36 + PAD + 4, y + 20); ctx.lineTo(W - PAD, y + 20); ctx.stroke();

  // result text lines
  ctx.fillStyle = result.ok ? "#2D7A5A" : RED;
  ctx.font = "8px monospace";
  resultLines.slice(0, 4).forEach((line, i) => {
    ctx.fillText(line, 36 + PAD + 10, y + 30 + i * 12);
  });

  // cursor blink at end of typing
  if (revealed < resultText.length && tick % 4 < 2) {
    const lastLine = resultLines[resultLines.length - 1] ?? "";
    const cx = 36 + PAD + 10 + ctx.measureText(lastLine).width;
    const cy = y + 30 + (resultLines.length - 1) * 12 - 8;
    ctx.fillStyle = result.ok ? GREEN : RED;
    ctx.fillRect(cx, cy, 5, 9);
  }

  y += resultCardH + 6;

  // ── Assistant reply bubble (appears after a few ticks) ────────────────────
  if (tick >= 3) {
    const replyReveal = (tick - 3) * 12;
    const replyText = result.ok
      ? "工具已执行完毕，结果已返回。"
      : "工具调用失败，请检查参数。";
    const replyVisible = replyText.slice(0, replyReveal);

    const bubbleW = Math.min(contentW - 20, Math.max(60, ctx.measureText(replyVisible).width + 20));
    const bubbleH = 22;
    const bubbleX = W - PAD - bubbleW;

    // assistant bubble: pixel style border
    ctx.fillStyle = WHITE;
    ctx.fillRect(bubbleX, y, bubbleW, bubbleH);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(bubbleX, y, bubbleW, bubbleH);

    // cyan left accent
    ctx.fillStyle = CYAN;
    ctx.fillRect(bubbleX, y, 3, bubbleH);

    ctx.fillStyle = TEXT;
    ctx.font = "9px monospace";
    ctx.fillText(replyVisible, bubbleX + 8, y + 14);

    // cursor
    if (replyReveal < replyText.length && tick % 4 < 2) {
      const cx2 = bubbleX + 8 + ctx.measureText(replyVisible).width;
      ctx.fillStyle = CYAN_DARK;
      ctx.fillRect(cx2, y + 5, 5, 9);
    }
  }

  // ── Input bar at bottom ───────────────────────────────────────────────────
  const inputY = H - 22;
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(36, inputY, W - 36, 22);
  ctx.strokeStyle = "#D1E8F0";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(36, inputY); ctx.lineTo(W, inputY); ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.fillRect(44, inputY + 4, W - 44 - 32, 14);
  ctx.strokeRect(44, inputY + 4, W - 44 - 32, 14);
  ctx.fillStyle = DIM;
  ctx.font = "8px monospace";
  ctx.fillText("输入消息...", 48, inputY + 14);
  // send button
  ctx.fillStyle = BORDER;
  ctx.fillRect(W - 28, inputY + 4, 22, 14);
  ctx.fillStyle = WHITE;
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("▶", W - 17, inputY + 14);
  ctx.textAlign = "left";
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ToolGifPreview({
  toolId,
  toolName,
  testParams,
  testResult,
  onClose,
  anchorPos,
}: ToolGifPreviewProps) {
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  // Live preview canvas
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const liveTickRef = useRef(0);
  const livePhaseRef = useRef<"input" | "running" | "result">("input");
  const liveResultRef = useRef<typeof testResult>(null);
  const liveRafRef = useRef<number | null>(null);

  // On mount: check cache
  useEffect(() => {
    const cached = getCache(toolId);
    if (cached) setGifUrl(cached);
  }, [toolId]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Live preview animation while generating
  useEffect(() => {
    if (!generating || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    function animate() {
      if (!ctx) return;
      const ph = livePhaseRef.current;
      if (ph === "result" && liveResultRef.current) {
        drawChatFrame(ctx, toolName, liveResultRef.current, frame);
      } else if (ph === "input" || ph === "running") {
        drawTerminalFrame(ctx, ph, toolName, testParams, frame);
      }
      frame++;
      liveRafRef.current = requestAnimationFrame(animate);
    }
    liveRafRef.current = requestAnimationFrame(animate);
    return () => { if (liveRafRef.current) cancelAnimationFrame(liveRafRef.current); };
  }, [generating, toolName, testParams]);

  async function generateGif() {
    if (!testResult) return;
    setGenerating(true);
    setGenError(null);
    liveTickRef.current = 0;
    livePhaseRef.current = "input";
    liveResultRef.current = testResult;

    try {
      const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
      const gif = GIFEncoder();

      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D not available");

      // [phase, tick, delay_ms]
      type FrameSpec = ["input" | "running" | "result", number, number];
      const frames: FrameSpec[] = [
        ["input", 0, 120], ["input", 2, 120], ["input", 4, 120],
        ["input", 0, 120], ["input", 2, 240],
        ["running", 0, 80], ["running", 2, 80], ["running", 4, 80],
        ["running", 6, 80], ["running", 8, 80], ["running", 9, 120],
        ["result", 0, 120], ["result", 1, 120], ["result", 2, 120],
        ["result", 3, 120], ["result", 4, 150], ["result", 5, 200],
        ["result", 6, 300], ["result", 7, 500],
      ];

      for (const [ph, tick, delay] of frames) {
        livePhaseRef.current = ph;
        if (ph === "result") {
          drawChatFrame(ctx, toolName, testResult, tick);
        } else {
          drawTerminalFrame(ctx, ph, toolName, testParams, tick);
        }

        const imageData = ctx.getImageData(0, 0, W, H);
        const pixels = new Uint8ClampedArray(imageData.data.buffer);
        const palette = quantize(pixels, 256);
        const idx = applyPalette(pixels, palette);
        gif.writeFrame(idx, W, H, { palette, delay: Math.round(delay / 10), repeat: 0 });
      }

      gif.finish();
      const bytes = gif.bytes() as Uint8Array<ArrayBuffer>;
      const blob = new Blob([bytes], { type: "image/gif" });

      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setCache(toolId, dataUrl);
          setGifUrl(dataUrl);
          resolve();
        };
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  const hasResult = testResult !== null;
  const popoverW = 356;

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: anchorPos.top,
        left: Math.min(anchorPos.left, window.innerWidth - popoverW - 12),
        zIndex: 9999,
        width: popoverW,
      }}
      className="border-2 border-[#00D1FF] bg-white shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#00D1FF]/10 border-b border-[#00D1FF]/30">
        <span className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4]">
          GIF 预览 — {toolName}
        </span>
        <div className="flex items-center gap-2">
          {gifUrl && (
            <button
              onClick={() => {
                setGifUrl(null);
                try { localStorage.removeItem(GIF_CACHE_PREFIX + toolId); } catch { /* ignore */ }
              }}
              className="text-[8px] text-[#00A3C4] hover:text-[#1A202C] font-bold uppercase tracking-widest"
            >
              ↺ 重新生成
            </button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-[12px] leading-none font-bold ml-1">
            ×
          </button>
        </div>
      </div>

      <div className="p-3">
        {gifUrl ? (
          <div>
            <img
              src={gifUrl}
              alt={`${toolName} 预览`}
              style={{ width: "100%", border: "1px solid #E2E8F0", display: "block" }}
            />
            <p className="text-[7px] text-gray-400 font-bold uppercase tracking-widest mt-1.5 text-center">
              已缓存 · 点击「重新生成」可刷新
            </p>
          </div>
        ) : generating ? (
          <div>
            <canvas
              ref={previewCanvasRef}
              width={W}
              height={H}
              style={{ width: "100%", display: "block", border: "1px solid #E2E8F0" }}
            />
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse text-center mt-2">
              正在生成 GIF...
            </div>
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center gap-3">
            {!hasResult && (
              <p className="text-[9px] text-amber-600 font-bold text-center border border-amber-200 bg-amber-50 px-3 py-2 w-full">
                ⚠ 工具测试中，请稍候...
              </p>
            )}
            <button
              onClick={generateGif}
              disabled={!hasResult}
              className={`px-4 py-2 border-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                hasResult
                  ? "border-[#00D1FF] bg-[#00D1FF] text-white hover:bg-[#00A3C4]"
                  : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              ▶ 生成预览 GIF
            </button>
            {genError && (
              <p className="text-[8px] text-red-500 font-mono text-center break-all">{genError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
