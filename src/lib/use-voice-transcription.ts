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

export function useVoiceTranscription(): UseVoiceTranscriptionResult {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // 已确认的文本（lines），单独存储，避免和 buffer 混合
  const confirmedRef = useRef("");

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;

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
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

        // FrontData 格式：lines（已确认）+ buffer_transcription（实时缓冲）
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

    await new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.OPEN) resolve();
      else ws.onopen = () => resolve();
    });

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        e.data.arrayBuffer().then((buf) => ws.send(buf));
      }
    };

    recorder.start(250); // 每 250ms 发一个 chunk
    setIsRecording(true);
  }, [stop]);

  return { isRecording, transcript, error, start, stop };
}
