"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Typography from "@tiptap/extension-typography";
import { Mathematics } from "@tiptap/extension-mathematics";
import "katex/dist/katex.min.css";
import { Callout } from "@/components/knowledge/extensions/Callout";
import { FileEmbed } from "@/components/knowledge/extensions/FileEmbed";
import { ColumnBlock, Column } from "@/components/knowledge/extensions/Columns";
import * as Y from "yjs";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, CodeXml,
  AlignLeft, AlignCenter, AlignRight,
  Grid3x3, ImagePlus, Link as LinkIcon,
  Undo2, Redo2, Highlighter, CheckSquare, Minus,
  Columns3, Trash2, Rows3,
  Users, Wifi, WifiOff, Save,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 安全地将 Uint8Array 编码为 base64（避免大数组 stack overflow） */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollabEditorProps {
  knowledgeId: number;
  initialHtml?: string;
  editable?: boolean;
  userName: string;
  userColor?: string;
  onSave?: (html: string, text: string) => void;
}

interface PresenceUser {
  user_id: number;
  name: string;
  color: string;
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

function ToolBtn({ active, disabled, onClick, title, children }: {
  active?: boolean; disabled?: boolean; onClick: () => void; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-md transition-all duration-100 select-none disabled:opacity-30 ${
        active ? "bg-[#E0F7FF] text-[#00A3C4] shadow-sm" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

function ToolDivider() {
  return <span className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />;
}

function Toolbar({ editor, onImageUpload }: { editor: Editor; onImageUpload: () => void }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("链接地址", prev || "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center flex-wrap gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-white/80 backdrop-blur-sm flex-shrink-0 sticky top-0 z-10">
      <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗 ⌘B"><Bold size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体 ⌘I"><Italic size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线 ⌘U"><UnderlineIcon size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线"><Strikethrough size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="行内代码"><Code size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="高亮"><Highlighter size={15} /></ToolBtn>
      <ToolDivider />
      <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="标题1"><Heading1 size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="标题2"><Heading2 size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="标题3"><Heading3 size={15} /></ToolBtn>
      <ToolDivider />
      <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表"><List size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表"><ListOrdered size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="待办清单"><CheckSquare size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用"><Quote size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="代码块"><CodeXml size={15} /></ToolBtn>
      <ToolDivider />
      <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="左对齐"><AlignLeft size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="居中"><AlignCenter size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="右对齐"><AlignRight size={15} /></ToolBtn>
      <ToolDivider />
      <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="插入表格"><Grid3x3 size={15} /></ToolBtn>
      {editor.isActive("table") && (
        <>
          <ToolBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="插入列"><Columns3 size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="插入行"><Rows3 size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().deleteTable().run()} title="删除表格"><Trash2 size={14} /></ToolBtn>
        </>
      )}
      <ToolBtn onClick={onImageUpload} title="插入图片"><ImagePlus size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("link")} onClick={setLink} title="插入链接"><LinkIcon size={15} /></ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分割线"><Minus size={15} /></ToolBtn>
      <div className="flex-1" />
      <ToolBtn disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="撤销 ⌘Z"><Undo2 size={15} /></ToolBtn>
      <ToolBtn disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="重做 ⌘⇧Z"><Redo2 size={15} /></ToolBtn>
    </div>
  );
}

// ─── Presence Bar ─────────────────────────────────────────────────────────────

function PresenceBar({ users, connected }: { users: PresenceUser[]; connected: boolean }) {
  if (users.length === 0 && connected) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-100 bg-gray-50/50">
      <div className="flex items-center gap-1 text-[11px] text-gray-400">
        {connected ? <Wifi size={12} className="text-green-500" /> : <WifiOff size={12} className="text-red-400" />}
        <span>{connected ? "协同就绪" : "离线编辑"}</span>
      </div>
      {users.length > 0 && (
        <>
          <span className="w-px h-3 bg-gray-200" />
          <div className="flex items-center gap-1">
            <Users size={12} className="text-gray-400" />
            <span className="text-[11px] text-gray-400">{users.length} 人在线</span>
          </div>
          <div className="flex -space-x-1.5">
            {users.slice(0, 5).map((u) => (
              <div
                key={u.user_id}
                title={u.name}
                className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: u.color }}
              >
                {u.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {users.length > 5 && (
              <div className="w-5 h-5 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-[9px] font-bold text-gray-600">
                +{users.length - 5}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── CollabEditor ─────────────────────────────────────────────────────────────

export function CollabEditor({
  knowledgeId,
  initialHtml,
  editable = true,
  userName,
  onSave,
}: CollabEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [docReady, setDocReady] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Editor | null>(null);

  // 初始化 Yjs doc + WebSocket
  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    let cancelled = false;

    apiFetch<{ yjs_doc_key: string; has_yjs_state: boolean }>(
      `/knowledge/${knowledgeId}/doc`,
      { token },
    ).then((docInfo) => {
      if (cancelled) return;

      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/knowledge/collab/${knowledgeId}?token=${encodeURIComponent(token)}`;

      try {
        const ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer";
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onerror = () => setConnected(false);

        ws.onmessage = (ev) => {
          if (typeof ev.data === "string") {
            try {
              const msg = JSON.parse(ev.data);
              if (msg.type === "sync_state") {
                // 服务端发来完整 Yjs 快照 → 应用到本地 ydoc
                if (msg.state) {
                  const bytes = Uint8Array.from(atob(msg.state), c => c.charCodeAt(0));
                  Y.applyUpdate(ydoc, bytes, "remote");
                }
                // 如果 ydoc 为空且有初始 HTML，注入内容
                // 这里不直接注入——等 editor 创建后由 Collaboration extension 处理
                // 标记 ydoc 已同步完成
                setDocReady(true);
              } else if (msg.type === "user_joined" || msg.type === "user_left") {
                apiFetch<PresenceUser[]>(`/knowledge/${knowledgeId}/presence`, { token })
                  .then(setPresenceUsers)
                  .catch(() => {});
              }
            } catch {}
          } else if (ev.data instanceof ArrayBuffer) {
            // 其他客户端的增量 Yjs update
            Y.applyUpdate(ydoc, new Uint8Array(ev.data), "remote");
          }
        };

        // 本地编辑产生的 Yjs update → 广播给其他客户端
        ydoc.on("update", (update: Uint8Array, origin: unknown) => {
          if (origin === "remote") return;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(update);
          }
        });

        // 构造 save_state 消息（附带 html/text 供后端同步回写）
        const buildSaveMsg = () => {
          const state = Y.encodeStateAsUpdate(ydoc);
          const b64 = uint8ToBase64(state);
          const msg: Record<string, string> = { type: "save_state", state: b64 };
          if (editorRef.current) {
            msg.html = editorRef.current.getHTML();
            msg.text = editorRef.current.getText();
          }
          return JSON.stringify(msg);
        };

        // 定期发送完整 Yjs state 快照到后端持久化（每 30 秒）
        const saveInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(buildSaveMsg());
          }
        }, 30000);

        // 关闭前发送最终快照
        const handleBeforeUnload = () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(buildSaveMsg());
          }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        // Cleanup refs for teardown
        const cleanup = () => {
          clearInterval(saveInterval);
          window.removeEventListener("beforeunload", handleBeforeUnload);
          // 发送最终快照
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(buildSaveMsg()); } catch {}
          }
          ws.close();
        };
        wsRef.current = ws;
        // Store cleanup fn for effect teardown
        (ws as unknown as { _cleanup?: () => void })._cleanup = cleanup;
      } catch (err) {
        console.warn("WebSocket connection failed, working in offline mode:", err);
        setDocReady(true);
      }

      // 如果没有服务端状态，先标记 ready（sync_state 消息会再覆盖）
      if (!docInfo.has_yjs_state) {
        setDocReady(true);
      }
    }).catch((err) => {
      if (cancelled) return;
      console.error("Failed to init collab doc:", err);
      const ydoc = new Y.Doc();
      ydocRef.current = ydoc;
      setDocReady(true);
    });

    return () => {
      cancelled = true;
      const ws = wsRef.current;
      if (ws) {
        const cleanup = (ws as unknown as { _cleanup?: () => void })._cleanup;
        if (cleanup) cleanup();
        else ws.close();
      }
      ydocRef.current?.destroy();
    };
  }, [knowledgeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        undoRedo: false, // Yjs 管理 undo/redo
        codeBlock: { HTMLAttributes: { class: "hljs-code-block" } },
        horizontalRule: false,
      }),
      HorizontalRule,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "editor-link" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, HTMLAttributes: { class: "editor-image" } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Callout,
      FileEmbed,
      ColumnBlock,
      Column,
      Mathematics,
      ...(ydocRef.current
        ? [Collaboration.configure({ document: ydocRef.current })]
        : []),
      ...(editable
        ? [Placeholder.configure({
            placeholder: ({ node }) => {
              if (node.type.name === "heading") return "标题";
              return "输入内容，或按 / 插入块…";
            },
          })]
        : []),
    ],
    content: initialHtml || "",
    editable,
    editorProps: {
      attributes: { class: "le-editor-body focus:outline-none" },
    },
  }, [docReady]);

  // Store editor ref
  useEffect(() => { editorRef.current = editor; }, [editor]);

  // 新文档：Yjs fragment 为空时注入 initialHtml
  useEffect(() => {
    if (!editor || !initialHtml || !ydocRef.current) return;
    const fragment = ydocRef.current.getXmlFragment("default");
    if (fragment.length === 0) {
      editor.commands.setContent(initialHtml);
    }
  }, [editor, initialHtml]);

  // 自动保存 debounce（10秒）
  useEffect(() => {
    if (!editor || !editable || !onSave) return;
    const autoSave = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onSave(editor.getHTML(), editor.getText());
      }, 10000);
    };
    editor.on("update", autoSave);
    return () => {
      editor.off("update", autoSave);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [editor, editable, onSave]);

  const uploadImage = useCallback(async (file: File) => {
    if (!editorRef.current) return;
    const form = new FormData();
    form.append("file", file);
    const token = localStorage.getItem("token") || "";
    try {
      const res = await fetch("/api/proxy/knowledge/image-upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error("upload failed");
      const { url } = await res.json();
      editorRef.current.chain().focus().setImage({ src: `/api/proxy${url}` }).run();
    } catch {
      alert("图片上传失败");
    }
  }, []);

  const handleManualSave = useCallback(() => {
    if (!editorRef.current || !onSave) return;
    onSave(editorRef.current.getHTML(), editorRef.current.getText());
  }, [onSave]);

  if (!docReady) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        正在初始化协同文档...
      </div>
    );
  }

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full le-editor-wrapper">
      <PresenceBar users={presenceUsers} connected={connected} />

      {editable && (
        <div className="flex items-center">
          <div className="flex-1">
            <Toolbar editor={editor} onImageUpload={() => fileInputRef.current?.click()} />
          </div>
          {onSave && (
            <button
              type="button"
              onClick={handleManualSave}
              className="px-2.5 py-1 mr-2 text-[11px] text-gray-500 hover:text-[#00A3C4] hover:bg-[#E0F7FF] rounded transition-colors flex items-center gap-1"
              title="手动保存"
            >
              <Save size={13} />
              保存
            </button>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
      />

      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} className="h-full" />
      </div>

      <style>{collabStyles}</style>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const collabStyles = `
.collaboration-cursor__caret {
  border-left: 1px solid #0d0d0d;
  border-right: 1px solid #0d0d0d;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}
.collaboration-cursor__label {
  border-radius: 3px 3px 3px 0;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 0.1rem 0.3rem;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
`;
