"use client";

import { useCallback, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
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

// ─── Toolbar button ───────────────────────────────────────────────────────────
function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`px-1.5 py-0.5 text-[10px] font-bold border transition-colors select-none ${
        active
          ? "border-[#1A202C] bg-[#1A202C] text-white"
          : "border-transparent text-[#1A202C] hover:border-[#1A202C] hover:bg-[#F0F4F8]"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-4 bg-gray-300 mx-0.5 flex-shrink-0" />;
}

// ─── RichEditor ───────────────────────────────────────────────────────────────
interface RichEditorProps {
  content: string;         // HTML string
  onChange: (html: string) => void;
  editable?: boolean;
}

export function RichEditor({ content, onChange, editable = true }: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ codeBlock: { HTMLAttributes: { class: "bg-gray-100 rounded p-2 font-mono text-xs" } } }),
      Underline,
      TextStyle,
      Color,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-[#00A3C4] underline" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false, HTMLAttributes: { class: "max-w-full border border-gray-200 my-2" } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setTimeout(() => onChange(html), 0);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] px-5 py-4 text-[12px] leading-relaxed",
      },
    },
  }, []);

  // Update content when switching entries (editor instance survives, content changes)
  const lastContent = useRef(content);
  if (editor && content !== lastContent.current) {
    lastContent.current = content;
    // Only update if editor content differs (avoids cursor reset on keystroke)
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  }

  const uploadImage = useCallback(async (file: File) => {
    if (!editor) return;
    const form = new FormData();
    form.append("file", file);
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    try {
      const res = await fetch("/api/proxy/knowledge/image-upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error("upload failed");
      const { url } = await res.json();
      editor.chain().focus().setImage({ src: `/api/proxy${url}` }).run();
    } catch {
      alert("图片上传失败");
    }
  }, [editor]);

  if (!editor) return null;

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("链接地址", prev || "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className={`flex flex-col border-2 border-[#00D1FF] ${editable ? "h-full" : ""}`}>
      {editable && (
        <div className="flex items-center flex-wrap gap-0.5 px-2 py-1 border-b-2 border-[#1A202C] bg-[#F8FAFC] flex-shrink-0">
          {/* Text style */}
          <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗">B</Btn>
          <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体"><i>I</i></Btn>
          <Btn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线"><u>U</u></Btn>
          <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线"><s>S</s></Btn>
          <Btn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="行内代码">{"`"}</Btn>

          <Divider />

          {/* Headings */}
          {([1, 2, 3] as const).map((level) => (
            <Btn key={level} active={editor.isActive("heading", { level })} onClick={() => editor.chain().focus().toggleHeading({ level }).run()} title={`H${level}`}>H{level}</Btn>
          ))}

          <Divider />

          {/* Lists */}
          <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表">• 列表</Btn>
          <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表">1. 列表</Btn>
          <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用">❝</Btn>
          <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="代码块">{"</>"}</Btn>

          <Divider />

          {/* Align */}
          <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="左对齐">≡L</Btn>
          <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="居中">≡C</Btn>
          <Btn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="右对齐">≡R</Btn>

          <Divider />

          {/* Table */}
          <Btn onClick={addTable} title="插入表格">⊞ 表格</Btn>
          {editor.isActive("table") && (
            <>
              <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} title="插入列">+列</Btn>
              <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title="插入行">+行</Btn>
              <Btn onClick={() => editor.chain().focus().deleteColumn().run()} title="删除列">-列</Btn>
              <Btn onClick={() => editor.chain().focus().deleteRow().run()} title="删除行">-行</Btn>
              <Btn onClick={() => editor.chain().focus().deleteTable().run()} title="删除表格">✕表</Btn>
            </>
          )}

          <Divider />

          {/* Image */}
          <Btn onClick={() => fileInputRef.current?.click()} title="插入图片">🖼 图片</Btn>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
          />

          {/* Link */}
          <Btn active={editor.isActive("link")} onClick={setLink} title="插入链接">🔗</Btn>

          <Divider />

          {/* History */}
          <Btn onClick={() => editor.chain().focus().undo().run()} title="撤销">↩</Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="重做">↪</Btn>
        </div>
      )}

      <div className={editable ? "flex-1 overflow-y-auto" : ""}>
        <EditorContent editor={editor} className={editable ? "h-full" : ""} />
      </div>

      <style>{`
        .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 8px 0;
        }
        .ProseMirror table td,
        .ProseMirror table th {
          border: 1px solid #CBD5E0;
          padding: 4px 8px;
          min-width: 80px;
          vertical-align: top;
          font-size: 11px;
        }
        .ProseMirror table th {
          background: #F0F4F8;
          font-weight: bold;
        }
        [data-theme="dark"] .ProseMirror table td,
        [data-theme="dark"] .ProseMirror table th {
          border-color: var(--border);
          background-color: var(--card);
          color: var(--foreground);
        }
        [data-theme="dark"] .ProseMirror table th {
          background-color: var(--muted);
        }
        .ProseMirror table .selectedCell::after {
          background: rgba(0, 209, 255, 0.2);
          content: "";
          left: 0; right: 0; top: 0; bottom: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }
        .ProseMirror table .column-resize-handle {
          background-color: #00D1FF;
          bottom: -2px;
          position: absolute;
          right: -2px;
          top: 0;
          width: 4px;
          pointer-events: none;
        }
        .ProseMirror p { margin: 0.25rem 0; }
        .ProseMirror h1 { font-size: 1.4em; font-weight: bold; margin: 0.5rem 0; }
        .ProseMirror h2 { font-size: 1.2em; font-weight: bold; margin: 0.4rem 0; }
        .ProseMirror h3 { font-size: 1.05em; font-weight: bold; margin: 0.3rem 0; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 1.4em; margin: 0.25rem 0; }
        .ProseMirror blockquote { border-left: 3px solid #00D1FF; padding-left: 0.75em; color: #718096; margin: 0.5rem 0; }
        [data-theme="dark"] .ProseMirror blockquote { border-left-color: var(--border); color: var(--muted-foreground); }
        [data-theme="light"] .ProseMirror, [data-theme="dark"] .ProseMirror { color: var(--foreground); }
        [data-theme="dark"] .ProseMirror code { background: var(--muted); color: var(--foreground); }
      `}</style>
    </div>
  );
}
