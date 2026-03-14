"use client";

import { useState, useRef, useCallback } from "react";

function getWsBase() {
  if (typeof window === "undefined") return "ws://localhost:8000";
  // HTTPS（内网穿透）走同源 wss 由反向代理转发；本地 HTTP 直连后端 8000
  if (window.location.protocol === "https:") {
    return `wss://${window.location.host}`;
  }
  return "ws://localhost:8000";
}
const WS_BASE = getWsBase();

interface UseVoiceTranscriptionResult {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

// Whisper 已知幻觉短语，在 lines 和 buffer 中过滤掉
const HALLUCINATION_PATTERNS = [
  "中文字幕提供", "字幕由", "字幕组", "翻译", "校对", "时间轴",
  "thank you for watching", "thanks for watching", "please subscribe",
  "subtitles by", "sub by", "caption by",
];
function isHallucination(text: string): boolean {
  const t = text.trim().toLowerCase();
  return HALLUCINATION_PATTERNS.some((p) => t === p.toLowerCase() || t.replace(/\s/g, "") === p.replace(/\s/g, ""));
}

/**
 * 检测并截断重复循环：
 * 找到文本中出现 3 次以上的重复片段（长度 4-30 字），截取第一次出现前的内容。
 */
/**
 * 检测并截断重复循环：
 * 只检测紧密连续的重复（第二次出现紧跟在第一次之后），避免误截正常句子中的常见词。
 */
function deduplicateRepetition(text: string): string {
  if (text.length < 30) return text;
  // 只检测较长片段（8字以上），且要求连续紧密重复（不隔超过5个字）
  for (let len = 8; len <= 40; len++) {
    for (let start = 0; start < text.length - len * 3; start++) {
      const chunk = text.slice(start, start + len);
      // 要求第二次出现紧跟着第一次（间隔 <= 5字，排除自然句子中的词汇重复）
      const second = text.indexOf(chunk, start + len);
      if (second === -1) continue;
      if (second - (start + len) > 5) continue;
      const third = text.indexOf(chunk, second + len);
      if (third === -1) continue;
      if (third - (second + len) > 5) continue;
      return text.slice(0, second).trimEnd();
    }
  }
  return text;
}

/**
 * 将浮点 PCM [-1, 1] 重采样到 16kHz 并转为 Int16 字节。
 * whisperlivekit 后端期望 16kHz 16-bit PCM LE。
 */
function resampleTo16kPCM(float32: Float32Array, inputSampleRate: number): ArrayBuffer {
  const ratio = inputSampleRate / 16000;
  const outputLength = Math.floor(float32.length / ratio);
  const int16 = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIdx = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, float32[srcIdx]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

export function useVoiceTranscription(): UseVoiceTranscriptionResult {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const confirmedRef = useRef("");
  const lastTranscriptRef = useRef("");  // 保留最后一次有内容的转录

  const stop = useCallback(() => {
    // 先停止采集，但先不关 WebSocket，等后端发 ready_to_stop 后再关
    processorRef.current?.disconnect();
    processorRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setIsRecording(false);

    // 发空包触发后端结束序列，等 ready_to_stop 后再关闭 WS（最多等 8 秒）
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      // 发空字节通知后端停止
      ws.send(new ArrayBuffer(0));

      const timeout = setTimeout(() => {
        ws.close();
        wsRef.current = null;
        if (lastTranscriptRef.current) setTranscript(lastTranscriptRef.current);
      }, 8000);

      const origOnMessage = ws.onmessage;
      ws.onmessage = (event) => {
        if (origOnMessage) origOnMessage.call(ws, event);
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ready_to_stop") {
            clearTimeout(timeout);
            ws.close();
            wsRef.current = null;
            if (lastTranscriptRef.current) setTranscript(lastTranscriptRef.current);
          }
        } catch { /* ignore */ }
      };
    } else {
      wsRef.current = null;
      if (lastTranscriptRef.current) setTranscript(lastTranscriptRef.current);
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    confirmedRef.current = "";
    lastTranscriptRef.current = "";

    // 强制清理上一次残留的资源，避免第二次录音时被旧 onclose 干扰
    processorRef.current?.disconnect();
    processorRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      oldWs.onclose = null;
      oldWs.onerror = null;
      if (oldWs.readyState === WebSocket.OPEN || oldWs.readyState === WebSocket.CONNECTING) {
        oldWs.close();
      }
    }

    // iOS Safari 要求 AudioContext 在用户手势同步上下文中创建
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1 },
      });
    } catch {
      setError("无法访问麦克风，请检查权限");
      audioCtx.close();
      audioCtxRef.current = null;
      return;
    }
    streamRef.current = stream;

    const ws = new WebSocket(`${WS_BASE}/asr`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as Record<string, unknown>;
        if (data.type === "ready_to_stop") return;

        if (Array.isArray(data.lines)) {
          // 拼接所有非静音行的文字
          const linesText = (data.lines as { text?: string; speaker?: number }[])
            .filter((l) => l.speaker !== -2 && l.text && !isHallucination(l.text))
            .map((l) => l.text!)
            .join("")
            .trim();
          if (linesText) {
            const prev = confirmedRef.current;
            // 防止 buffer trimming 重复：新文字必须是旧文字的延续
            if (linesText.length > prev.length && linesText.startsWith(prev)) {
              confirmedRef.current = linesText;
            } else if (!prev || linesText.startsWith(prev)) {
              confirmedRef.current = linesText;
            }
            // 如果新文字比旧文字短或不是延续，保留旧的（trimming 产生的重复）
          }
        }
        const rawBuffer = typeof data.buffer_transcription === "string" ? data.buffer_transcription : "";
        const buffer = isHallucination(rawBuffer) ? "" : rawBuffer;
        // buffer 可能和 confirmed 末尾重叠，去重拼接
        let combined = confirmedRef.current;
        if (buffer) {
          if (!combined.endsWith(buffer)) {
            combined = (combined + " " + buffer).trim();
          }
        }
        if (combined) {
          const cleaned = deduplicateRepetition(combined);
          lastTranscriptRef.current = cleaned;
          setTranscript(cleaned);
        }
      } catch {
        // 忽略解析错误
      }
    };

    ws.onerror = () => {
      setError("语音转录连接失败");
      stop();
    };

    ws.onclose = () => {
      if (streamRef.current) stop();
    };

    await new Promise<void>((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) resolve();
      else {
        ws.onopen = () => resolve();
        // 如果连接失败 onclose 会触发，这里给个超时兜底
        setTimeout(() => reject(new Error("WebSocket 连接超时")), 8000);
      }
    }).catch((e) => {
      setError(e.message);
      stop();
      throw e;
    });

    // 用 Web Audio API 采集原始 PCM（audioCtx 已在手势上下文中创建）

    const source = audioCtx.createMediaStreamSource(stream);
    // 4096 samples per buffer, mono
    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBytes = resampleTo16kPCM(inputData, audioCtx.sampleRate);
      ws.send(pcmBytes);
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);

    setIsRecording(true);
  }, [stop]);

  return { isRecording, transcript, error, start, stop };
}
