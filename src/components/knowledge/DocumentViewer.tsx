"use client";

import { useEffect, useState } from "react";
import { KnowledgeDetail } from "@/lib/types";

// OnlyOffice 支持的文件类型
const ONLYOFFICE_EXTS = new Set([
  ".docx", ".doc", ".odt", ".rtf",
  ".xlsx", ".xls", ".ods", ".csv",
  ".pptx", ".ppt", ".odp",
]);

// 图片类型
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".svg"]);

// 音频类型
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac"]);

// 视频类型
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);

// 代码文件类型
const CODE_EXTS = new Set([
  ".json", ".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css",
  ".sql", ".yaml", ".yml", ".xml", ".sh", ".bash",
]);

interface DocumentViewerProps {
  entry: KnowledgeDetail;
  onContentChange?: (content: string) => void;
}

/**
 * 全格式文档查看器：根据 file_ext 分发到不同的预览组件。
 */
export default function DocumentViewer({ entry, onContentChange }: DocumentViewerProps) {
  const ext = (entry.file_ext || "").toLowerCase();
  const hasOssFile = !!entry.oss_key;

  // 无原始文件 → 退回到富文本展示
  if (!hasOssFile || !ext) {
    return <RichTextViewer content={entry.content} />;
  }

  if (ONLYOFFICE_EXTS.has(ext)) {
    return <OnlyOfficeViewer entry={entry} />;
  }
  if (ext === ".pdf") {
    return <PdfViewer entry={entry} />;
  }
  if (IMAGE_EXTS.has(ext)) {
    return <ImageViewer entry={entry} />;
  }
  if (AUDIO_EXTS.has(ext)) {
    return <AudioViewer entry={entry} />;
  }
  if (VIDEO_EXTS.has(ext)) {
    return <VideoViewer entry={entry} />;
  }
  if (ext === ".md") {
    return <MarkdownViewer content={entry.content} />;
  }
  if (CODE_EXTS.has(ext)) {
    return <CodeViewer content={entry.content} ext={ext} />;
  }
  if (ext === ".txt") {
    return <RichTextViewer content={entry.content} />;
  }

  // 未知格式：显示提取的文本 + 下载链接
  return (
    <div className="flex flex-col gap-4">
      <div className="p-3 bg-yellow-50 border-2 border-yellow-300 text-sm">
        此文件类型 ({ext}) 暂不支持在线预览，可下载原始文件查看
      </div>
      <DownloadButton entry={entry} />
      <RichTextViewer content={entry.content} />
    </div>
  );
}

// ─── 子组件 ────────────────────────────────────────────────────────────────

function DownloadButton({ entry }: { entry: KnowledgeDetail }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/knowledge/${entry.id}/file-url`);
      if (!res.ok) throw new Error("获取下载链接失败");
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-[#00D1FF] text-white text-sm font-mono uppercase border-2 border-[#1A202C] hover:bg-[#00A3C4] disabled:opacity-50"
    >
      {loading ? "获取中..." : "下载原始文件"}
      {entry.source_file && <span className="text-xs opacity-80">({entry.source_file})</span>}
    </button>
  );
}

function RichTextViewer({ content }: { content: string }) {
  // 简单的 HTML 渲染，复用已有的 Tiptap 样式
  const html = content.includes("<") ? content : `<p>${content.replace(/\n/g, "</p><p>")}</p>`;
  return (
    <div
      className="prose prose-sm max-w-none p-4 font-mono text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MarkdownViewer({ content }: { content: string }) {
  // Markdown 用 <pre> 展示（后续可换 react-markdown）
  return (
    <div className="p-4">
      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[#1A202C]">
        {content}
      </pre>
    </div>
  );
}

function CodeViewer({ content, ext }: { content: string; ext: string }) {
  return (
    <div className="p-4 bg-[#1A202C] rounded overflow-auto">
      <pre className="text-sm font-mono text-green-400 leading-relaxed whitespace-pre-wrap">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function OnlyOfficeViewer({ entry }: { entry: KnowledgeDetail }) {
  const [config, setConfig] = useState<any>(null);
  const [onlyofficeUrl, setOnlyofficeUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const res = await fetch(`/api/proxy/onlyoffice/config/${entry.id}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "加载编辑器配置失败");
        }
        const data = await res.json();
        if (!cancelled) {
          setConfig(data.config);
          setOnlyofficeUrl(data.onlyoffice_url);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    }

    loadConfig();
    return () => { cancelled = true; };
  }, [entry.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 text-sm text-gray-500 font-mono">
        加载文档编辑器...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="p-3 bg-red-50 border-2 border-red-300 text-sm text-red-700">
          文档编辑器加载失败: {error}
        </div>
        <DownloadButton entry={entry} />
        <RichTextViewer content={entry.content} />
      </div>
    );
  }

  // OnlyOffice iframe 集成
  return (
    <div className="w-full h-full min-h-[600px]">
      <OnlyOfficeIframe config={config} onlyofficeUrl={onlyofficeUrl} />
    </div>
  );
}

function OnlyOfficeIframe({ config, onlyofficeUrl }: { config: any; onlyofficeUrl: string }) {
  const containerId = `onlyoffice-editor-${Date.now()}`;

  useEffect(() => {
    // 动态加载 OnlyOffice API script
    const scriptId = "onlyoffice-api-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initEditor = () => {
      if (typeof (window as any).DocsAPI === "undefined") return;

      new (window as any).DocsAPI.DocEditor(containerId, {
        ...config,
        width: "100%",
        height: "100%",
      });
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = `${onlyofficeUrl}/web-apps/apps/api/documents/api.js`;
      script.onload = initEditor;
      document.head.appendChild(script);
    } else {
      initEditor();
    }
  }, [config, onlyofficeUrl, containerId]);

  return <div id={containerId} className="w-full h-full min-h-[600px]" />;
}

function PdfViewer({ entry }: { entry: KnowledgeDetail }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/proxy/knowledge/${entry.id}/file-url`)
      .then(r => r.json())
      .then(data => setUrl(data.url))
      .catch(e => setError(e.message));
  }, [entry.id]);

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="p-3 bg-red-50 border-2 border-red-300 text-sm">PDF 预览加载失败</div>
        <RichTextViewer content={entry.content} />
      </div>
    );
  }

  if (!url) {
    return <div className="flex items-center justify-center h-96 text-sm text-gray-500 font-mono">加载 PDF...</div>;
  }

  return (
    <iframe
      src={url}
      className="w-full h-full min-h-[700px] border-0"
      title={entry.title}
    />
  );
}

function ImageViewer({ entry }: { entry: KnowledgeDetail }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetch(`/api/proxy/knowledge/${entry.id}/file-url`)
      .then(r => r.json())
      .then(data => setUrl(data.url))
      .catch(() => {});
  }, [entry.id]);

  if (!url) return <div className="p-4 text-sm text-gray-500 font-mono">加载图片...</div>;

  return (
    <div className="p-4 flex justify-center">
      <img
        src={url}
        alt={entry.title}
        className="max-w-full max-h-[80vh] object-contain border-2 border-[#1A202C]"
      />
    </div>
  );
}

function AudioViewer({ entry }: { entry: KnowledgeDetail }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetch(`/api/proxy/knowledge/${entry.id}/file-url`)
      .then(r => r.json())
      .then(data => setUrl(data.url))
      .catch(() => {});
  }, [entry.id]);

  return (
    <div className="p-6 flex flex-col gap-4">
      {url && (
        <audio controls className="w-full" src={url}>
          浏览器不支持音频播放
        </audio>
      )}
      {/* 同时展示转写的文本 */}
      {entry.content && (
        <div className="mt-4">
          <h4 className="text-xs font-mono uppercase text-gray-500 mb-2">语音转写内容</h4>
          <RichTextViewer content={entry.content} />
        </div>
      )}
    </div>
  );
}

function VideoViewer({ entry }: { entry: KnowledgeDetail }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetch(`/api/proxy/knowledge/${entry.id}/file-url`)
      .then(r => r.json())
      .then(data => setUrl(data.url))
      .catch(() => {});
  }, [entry.id]);

  if (!url) return <div className="p-4 text-sm text-gray-500 font-mono">加载视频...</div>;

  return (
    <div className="p-4 flex justify-center">
      <video
        controls
        className="max-w-full max-h-[80vh] border-2 border-[#1A202C]"
        src={url}
      >
        浏览器不支持视频播放
      </video>
    </div>
  );
}
