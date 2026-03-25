"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getToken } from "@/lib/api";

export default function WebAppPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const token = getToken();
    fetch(`/api/proxy/web-apps/${id}/preview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((html) => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        iframe.srcdoc = html;
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      });
  }, [id]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500 font-mono text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="fixed inset-0">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10 text-[11px] font-mono text-gray-400">
          加载中...
        </div>
      )}
      <iframe
        ref={iframeRef}
        className="w-full h-full border-none"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}
