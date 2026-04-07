"use client";

import { useEffect, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { ExternalLink, Download, RefreshCw, ZoomIn, ZoomOut, X, Copy, Check } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { KnowledgeDetail } from "@/lib/types";

import "highlight.js/styles/github.css";

// OnlyOffice 支持的文件类型
const ONLYOFFICE_EXTS = new Set([
  ".docx", ".doc", ".odt", ".rtf",
  ".xlsx", ".xls", ".ods", ".csv",
  ".pptx", ".ppt", ".odp",
]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".svg"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".ogg", ".flac"]);
const VIDEO_EXTS = new Set([".mp4", ".webm", ".mov"]);
const CODE_EXTS = new Set([
  ".json", ".js", ".ts", ".jsx", ".tsx", ".py", ".html", ".css",
  ".sql", ".yaml", ".yml", ".xml", ".sh", ".bash",
]);

const EXT_TO_LANG: Record<string, string> = {
  ".js": "javascript", ".ts": "typescript", ".jsx": "javascript", ".tsx": "typescript",
  ".py": "python", ".html": "html", ".css": "css", ".json": "json",
  ".sql": "sql", ".yaml": "yaml", ".yml": "yaml", ".xml": "xml",
  ".sh": "bash", ".bash": "bash",
};

interface DocumentViewerProps {
  entry: KnowledgeDetail;
  onContentChange?: (content: string) => void;
}

export default function DocumentViewer({ entry }: DocumentViewerProps) {
  const ext = (entry.file_ext || "").toLowerCase();
  const hasOssFile = !!entry.oss_key;

  if (!hasOssFile || !ext) {
    return <RichTextViewer content={entry.content} />;
  }
  if (ONLYOFFICE_EXTS.has(ext)) return <OnlyOfficeViewer entry={entry} />;
  if (ext === ".pdf") {
    // PDF 转换成功后走 OnlyOffice，否则 fallback 到 iframe 预览
    if (entry.can_open_onlyoffice) return <OnlyOfficeViewer entry={entry} />;
    return <PdfViewer entry={entry} />;
  }
  if (IMAGE_EXTS.has(ext)) return <ImageViewer entry={entry} />;
  if (AUDIO_EXTS.has(ext)) return <AudioViewer entry={entry} />;
  if (VIDEO_EXTS.has(ext)) return <VideoViewer entry={entry} />;
  if (ext === ".md") return <MarkdownViewer content={entry.content} />;
  if (CODE_EXTS.has(ext)) return <CodeViewer content={entry.content} ext={ext} />;
  if (ext === ".txt") return <RichTextViewer content={entry.content} />;

  return (
    <div className="flex flex-col gap-4 p-4">
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
      <Download size={14} />
      {loading ? "获取中..." : "下载原始文件"}
      {entry.source_file && <span className="text-xs opacity-80">({entry.source_file})</span>}
    </button>
  );
}

function RichTextViewer({ content }: { content: string }) {
  const html = content.includes("<") ? content : `<p>${content.replace(/\n/g, "</p><p>")}</p>`;
  return (
    <div
      className="prose prose-sm max-w-none p-4 font-mono text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MarkdownViewer({ content }: { content: string }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <div className={`md-body p-4 ${isDark ? "md-dark" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

function CodeViewer({ content, ext }: { content: string; ext: string }) {
  const [copied, setCopied] = useState(false);
  const lang = EXT_TO_LANG[ext] || ext.replace(".", "") || "plaintext";
  const lines = content.split("\n");

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="h-full flex flex-col bg-[#1A202C] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#0D1117] border-b border-gray-700 flex-shrink-0">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[9px] text-gray-400 hover:text-white transition-colors"
        >
          {copied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制</>}
        </button>
      </div>
      {/* Code body */}
      <div className="flex-1 overflow-auto p-4">
        <table className="w-full border-collapse text-sm font-mono">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="leading-relaxed hover:bg-white/5">
                <td className="text-gray-600 text-right pr-4 select-none w-12 text-[11px] border-r border-gray-700">{i + 1}</td>
                <td className="pl-4 text-green-300 whitespace-pre">{line || " "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Image lightbox
function ImageLightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "+") setScale((s) => Math.min(s + 0.25, 4));
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.5));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(s - 0.25, 0.5)); }} className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full"><ZoomOut size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(s + 0.25, 4)); }} className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full"><ZoomIn size={16} /></button>
        <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-full"><X size={16} /></button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- lightbox overlay, no optimization needed */}
      <img
        src={url}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[90vh] object-contain transition-transform duration-200"
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}

function ImageViewer({ entry }: { entry: KnowledgeDetail }) {
  const [url, setUrl] = useState("");
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    fetch(`/api/proxy/knowledge/${entry.id}/file-url`)
      .then(r => r.json())
      .then(data => setUrl(data.url))
      .catch(() => {});
  }, [entry.id]);

  if (!url) return <LoadingPlaceholder text="加载图片..." />;

  return (
    <div className="p-4 flex justify-center">
      {lightbox && <ImageLightbox url={url} alt={entry.title} onClose={() => setLightbox(false)} />}
      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic blob URL from backend */}
      <img
        src={url}
        alt={entry.title}
        onClick={() => setLightbox(true)}
        className="max-w-full max-h-[80vh] object-contain border-2 border-[#1A202C] cursor-zoom-in hover:opacity-95 transition-opacity"
      />
    </div>
  );
}

function PdfViewer({ entry }: { entry: KnowledgeDetail }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    async function loadPdf() {
      setUrl("");
      setError("");
      try {
        const r = await fetch(`/api/proxy/knowledge/${entry.id}/file-url`);
        const data = await r.json();
        setUrl(data.url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      }
    }
    loadPdf();
  }, [entry.id, retryKey]);

  if (error) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="p-3 bg-red-50 border-2 border-red-300 text-sm">PDF 预览加载失败</div>
        <button onClick={() => setRetryKey(k => k + 1)} className="inline-flex items-center gap-2 text-[10px] font-bold text-[#00A3C4] hover:underline">
          <RefreshCw size={12} /> 重试
        </button>
        <RichTextViewer content={entry.content} />
      </div>
    );
  }

  if (!url) return <LoadingPlaceholder text="加载 PDF..." />;

  return (
    <div className="flex flex-col h-full">
      {/* PDF toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
        <span className="text-[10px] text-gray-500 font-mono flex-1 truncate">{entry.source_file}</span>
        <button
          onClick={async () => { window.open(url, "_blank"); }}
          className="flex items-center gap-1 text-[9px] font-bold text-[#00A3C4] hover:underline"
        >
          <ExternalLink size={12} /> 新标签页打开
        </button>
        <DownloadButton entry={entry} />
      </div>
      <iframe
        src={url}
        className="flex-1 border-0"
        title={entry.title}
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

  if (!url) return <LoadingPlaceholder text="加载视频..." />;

  return (
    <div className="p-4 flex justify-center">
      <video controls className="max-w-full max-h-[80vh] border-2 border-[#1A202C]" src={url}>
        浏览器不支持视频播放
      </video>
    </div>
  );
}

function OnlyOfficeViewer({ entry }: { entry: KnowledgeDetail }) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
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
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : "加载失败"); setLoading(false); }
      }
    }
    loadConfig();
    return () => { cancelled = true; };
  }, [entry.id]);

  if (loading) return <LoadingPlaceholder text="加载文档编辑器..." />;

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

  return (
    <div className="w-full h-full min-h-[600px]">
      <OnlyOfficeIframe config={config} onlyofficeUrl={onlyofficeUrl} />
    </div>
  );
}

function OnlyOfficeIframe({ config, onlyofficeUrl }: { config: Record<string, unknown> | null; onlyofficeUrl: string }) {
  const reactId = useId();
  const containerId = `onlyoffice-editor-${reactId}`;

  useEffect(() => {
    const scriptId = "onlyoffice-api-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const win = window as unknown as Record<string, { DocEditor: new (id: string, cfg: Record<string, unknown>) => unknown }>;
    const initEditor = () => {
      if (typeof win.DocsAPI === "undefined") return;
      new win.DocsAPI.DocEditor(containerId, {
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

function LoadingPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="space-y-2 w-2/3">
        <div className="h-4 bg-gray-200 animate-pulse rounded" />
        <div className="h-4 w-5/6 bg-gray-100 animate-pulse rounded" />
        <div className="h-4 w-4/6 bg-gray-100 animate-pulse rounded" />
      </div>
      <p className="text-[10px] text-gray-400 font-mono animate-pulse">{text}</p>
    </div>
  );
}
