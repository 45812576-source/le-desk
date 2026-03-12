"use client";

import { useState, useRef, useCallback } from "react";

const WS_BASE = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000";

interface UseVoiceTranscriptionResult {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
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

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;

    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    wsRef.current?.close();
    wsRef.current = null;

    setIsRecording(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript("");
    confirmedRef.current = "";

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
      });
    } catch {
      setError("无法访问麦克风，请检查权限");
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
          const confirmed = (data.lines as { text?: string }[])
            .map((l) => l.text ?? "")
            .join("")
            .trim();
          if (confirmed) confirmedRef.current = confirmed;
        }
        const buffer = typeof data.buffer_transcription === "string" ? data.buffer_transcription : "";
        const combined = (confirmedRef.current + (buffer ? " " + buffer : "")).trim();
        if (combined) setTranscript(combined);
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

    // 用 Web Audio API 采集原始 PCM
    const audioCtx = new AudioContext({ sampleRate: 16000 });
    audioCtxRef.current = audioCtx;

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
