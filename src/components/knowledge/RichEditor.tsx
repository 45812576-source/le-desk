"use client";

import { useCallback, useRef, useEffect, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
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
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, CodeXml,
  AlignLeft, AlignCenter, AlignRight,
  Grid3x3, ImagePlus, Link as LinkIcon,
  Undo2, Redo2, Highlighter, CheckSquare, Minus,
  Table as TableIcon, Trash2,
  Rows3, Columns3,
  MessageSquareWarning, Paperclip, Sigma,
} from "lucide-react";

// ─── Slash Command Menu ──────────────────────────────────────────────────────

interface SlashMenuItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  group: string;
  command: (editor: Editor, callbacks?: SlashCallbacks) => void;
}

interface SlashCallbacks {
  onImageUpload?: () => void;
  onFileUpload?: () => void;
}

const SLASH_ITEMS: SlashMenuItem[] = [
  // ── 基础 ──
  { group: "基础", title: "正文", description: "普通段落文本", icon: <AlignLeft size={16} />, command: (e) => e.chain().focus().setParagraph().run() },
  { group: "基础", title: "标题 1", description: "大标题", icon: <Heading1 size={16} />, command: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { group: "基础", title: "标题 2", description: "中标题", icon: <Heading2 size={16} />, command: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { group: "基础", title: "标题 3", description: "小标题", icon: <Heading3 size={16} />, command: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { group: "基础", title: "有序列表", description: "编号列表", icon: <ListOrdered size={16} />, command: (e) => e.chain().focus().toggleOrderedList().run() },
  { group: "基础", title: "无序列表", description: "项目符号列表", icon: <List size={16} />, command: (e) => e.chain().focus().toggleBulletList().run() },
  { group: "基础", title: "待办清单", description: "可勾选任务列表", icon: <CheckSquare size={16} />, command: (e) => e.chain().focus().toggleTaskList().run() },
  { group: "基础", title: "代码块", description: "代码片段", icon: <CodeXml size={16} />, command: (e) => e.chain().focus().toggleCodeBlock().run() },
  { group: "基础", title: "引用", description: "引用块", icon: <Quote size={16} />, command: (e) => e.chain().focus().toggleBlockquote().run() },
  { group: "基础", title: "高亮块", description: "彩色信息提示块", icon: <MessageSquareWarning size={16} />, command: (e) => e.chain().focus().setCallout({ type: "info" }).run() },
  { group: "基础", title: "表格", description: "插入 3×3 表格", icon: <TableIcon size={16} />, command: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { group: "基础", title: "链接", description: "插入超链接", icon: <LinkIcon size={16} />, command: (e) => {
    const url = window.prompt("链接地址", "https://");
    if (url) e.chain().focus().setLink({ href: url }).run();
  }},
  // ── 插入 ──
  { group: "插入", title: "图片", description: "上传图片", icon: <ImagePlus size={16} />, command: (_e, cb) => cb?.onImageUpload?.() },
  { group: "插入", title: "视频或文件", description: "上传视频、音频或文件", icon: <Paperclip size={16} />, command: (_e, cb) => cb?.onFileUpload?.() },
  { group: "插入", title: "分割线", description: "水平分隔线", icon: <Minus size={16} />, command: (e) => e.chain().focus().setHorizontalRule().run() },
  { group: "插入", title: "公式", description: "LaTeX 数学公式", icon: <Sigma size={16} />, command: (e) => e.chain().focus().insertContent({ type: "text", text: "$$  $$" }).run() },
  { group: "插入", title: "分栏", description: "两列并排布局", icon: <Columns3 size={16} />, command: (e) => e.chain().focus().setColumns(2).run() },
];

function SlashCommandMenu({
  editor,
  query,
  onClose,
  position,
  callbacks,
}: {
  editor: Editor;
  query: string;
  onClose: () => void;
  position: { top: number; left: number };
  callbacks?: SlashCallbacks;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const filtered = SLASH_ITEMS.filter(
    (item) => item.title.toLowerCase().includes(query.toLowerCase()) || item.description.includes(query)
  );

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const execItem = useCallback((item: SlashMenuItem) => {
    const { from } = editor.state.selection;
    const slashPos = from - query.length - 1;
    editor.chain().focus().deleteRange({ from: Math.max(0, slashPos), to: from }).run();
    item.command(editor, callbacks);
    onClose();
  }, [editor, query, onClose, callbacks]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => (i + 1) % filtered.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) execItem(filtered[selectedIndex]);
      } else if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [editor, filtered, selectedIndex, query, onClose, execItem]);

  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (filtered.length === 0) return null;

  // Group items
  let lastGroup = "";
  let flatIndex = -1;

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-[260px] max-h-[400px] overflow-y-auto"
      style={{ top: position.top, left: position.left }}
    >
      {filtered.map((item) => {
        flatIndex++;
        const i = flatIndex;
        const showGroupHeader = item.group !== lastGroup;
        lastGroup = item.group;
        return (
          <div key={item.title}>
            {showGroupHeader && (
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1 first:mt-0">{item.group}</div>
            )}
            <button
              data-index={i}
              onMouseDown={(e) => { e.preventDefault(); execItem(item); }}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                i === selectedIndex ? "bg-[#F0F9FF]" : "hover:bg-gray-50"
              }`}
            >
              <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md border ${
                i === selectedIndex ? "border-[#00D1FF] bg-[#E0F7FF] text-[#00A3C4]" : "border-gray-200 text-gray-500"
              }`}>
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-gray-800 truncate">{item.title}</div>
                <div className="text-[11px] text-gray-400 truncate">{item.description}</div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

function ToolBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1.5 rounded-md transition-all duration-100 select-none disabled:opacity-30 ${
        active
          ? "bg-[#E0F7FF] text-[#00A3C4] shadow-sm"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
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
      {/* Text formatting */}
      <ToolBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗 ⌘B"><Bold size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体 ⌘I"><Italic size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线 ⌘U"><UnderlineIcon size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线"><Strikethrough size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="行内代码"><Code size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="高亮"><Highlighter size={15} /></ToolBtn>

      <ToolDivider />

      {/* Headings */}
      <ToolBtn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="标题1"><Heading1 size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="标题2"><Heading2 size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="标题3"><Heading3 size={15} /></ToolBtn>

      <ToolDivider />

      {/* Lists & blocks */}
      <ToolBtn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表"><List size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表"><ListOrdered size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} title="待办清单"><CheckSquare size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用"><Quote size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="代码块"><CodeXml size={15} /></ToolBtn>

      <ToolDivider />

      {/* Alignment */}
      <ToolBtn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="左对齐"><AlignLeft size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="居中"><AlignCenter size={15} /></ToolBtn>
      <ToolBtn active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} title="右对齐"><AlignRight size={15} /></ToolBtn>

      <ToolDivider />

      {/* Insert */}
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

      {/* History */}
      <ToolBtn disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="撤销 ⌘Z"><Undo2 size={15} /></ToolBtn>
      <ToolBtn disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="重做 ⌘⇧Z"><Redo2 size={15} /></ToolBtn>
    </div>
  );
}

// ─── Floating Bubble Toolbar (on text selection) ─────────────────────────────

function BubbleToolbar({ editor }: { editor: Editor }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const { from, to, empty } = editor.state.selection;
      if (empty || from === to) { setPos(null); return; }
      const view = editor.view;
      const start = view.coordsAtPos(from);
      const end = view.coordsAtPos(to);
      const top = Math.min(start.top, end.top) - 48;
      const left = (start.left + end.left) / 2;
      setPos({ top: Math.max(0, top), left });
    };
    editor.on("selectionUpdate", update);
    editor.on("blur", () => setPos(null));
    return () => {
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("链接地址", prev || "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url }).run();
  };

  if (!pos) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-[9999] flex items-center gap-0.5 px-1.5 py-1 bg-[#1A202C] rounded-lg shadow-xl border border-gray-700 animate-in fade-in duration-150"
      style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
    >
      <BubbleBtn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗"><Bold size={14} /></BubbleBtn>
      <BubbleBtn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体"><Italic size={14} /></BubbleBtn>
      <BubbleBtn active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线"><UnderlineIcon size={14} /></BubbleBtn>
      <BubbleBtn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线"><Strikethrough size={14} /></BubbleBtn>
      <BubbleBtn active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} title="代码"><Code size={14} /></BubbleBtn>
      <BubbleBtn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} title="高亮"><Highlighter size={14} /></BubbleBtn>
      <span className="w-px h-4 bg-gray-600 mx-0.5" />
      <BubbleBtn active={editor.isActive("link")} onClick={setLink} title="链接"><LinkIcon size={14} /></BubbleBtn>
    </div>
  );
}

function BubbleBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={`p-1 rounded transition-colors ${active ? "bg-white/20 text-white" : "text-gray-400 hover:text-white hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}

// ─── RichEditor ──────────────────────────────────────────────────────────────
interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

export function RichEditor({ content, onChange, editable = true }: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [slashMenu, setSlashMenu] = useState<{ query: string; position: { top: number; left: number } } | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
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
      ...(editable
        ? [Placeholder.configure({ placeholder: ({ node }) => {
            if (node.type.name === "heading") return "标题";
            return "输入内容，或按 / 插入块…";
          }})]
        : []),
    ],
    content,
    editable,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      setTimeout(() => onChange(html), 0);
    },
    editorProps: {
      attributes: {
        class: "le-editor-body focus:outline-none",
      },
      handleKeyDown: (view, event) => {
        if (event.key === "/" && editable) {
          // Show slash menu after a small delay so the "/" character is inserted
          setTimeout(() => {
            const { from } = view.state.selection;
            const coords = view.coordsAtPos(from);
            setSlashMenu({ query: "", position: { top: coords.bottom + 4, left: coords.left } });
          }, 10);
          return false;
        }
        if (slashMenu && event.key === "Backspace") {
          if (slashMenu.query.length === 0) {
            setSlashMenu(null);
          } else {
            setSlashMenu((prev) => prev ? { ...prev, query: prev.query.slice(0, -1) } : null);
          }
        }
        return false;
      },
      handleTextInput: (_view, _from, _to, text) => {
        if (slashMenu && text !== "/") {
          setSlashMenu((prev) => prev ? { ...prev, query: prev.query + text } : null);
        }
        return false;
      },
    },
  }, []);

  // Close slash menu on click outside or blur
  useEffect(() => {
    if (!slashMenu) return;
    function close() { setSlashMenu(null); }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [slashMenu]);

  // Sync content on entry switch
  const lastContent = useRef(content);
  if (editor && content !== lastContent.current) {
    lastContent.current = content;
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

  const uploadMedia = useCallback(async (file: File) => {
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
      const src = `/api/proxy${url}`;
      const mime = file.type || "";
      let fileType = "file";
      if (mime.startsWith("video/")) fileType = "video";
      else if (mime.startsWith("audio/")) fileType = "audio";
      editor.chain().focus().setFileEmbed({ src, filename: file.name, fileType }).run();
    } catch {
      alert("文件上传失败");
    }
  }, [editor]);

  const slashCallbacks: SlashCallbacks = {
    onImageUpload: () => fileInputRef.current?.click(),
    onFileUpload: () => mediaInputRef.current?.click(),
  };

  if (!editor) return null;

  return (
    <div className={`flex flex-col ${editable ? "h-full" : ""} le-editor-wrapper`}>
      {editable && (
        <>
          <Toolbar editor={editor} onImageUpload={() => fileInputRef.current?.click()} />
          <BubbleToolbar editor={editor} />
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
      />
      <input
        ref={mediaInputRef}
        type="file"
        accept="video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMedia(f); e.target.value = ""; }}
      />

      <div className={editable ? "flex-1 overflow-y-auto" : ""}>
        <EditorContent editor={editor} className={editable ? "h-full" : ""} />
      </div>

      {slashMenu && editor && (
        <SlashCommandMenu
          editor={editor}
          query={slashMenu.query}
          position={slashMenu.position}
          onClose={() => setSlashMenu(null)}
          callbacks={slashCallbacks}
        />
      )}

      <style>{editorStyles}</style>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const editorStyles = `
/* === Base editor body === */
.le-editor-body {
  padding: 1.5rem 2.5rem;
  min-height: 400px;
  font-size: 15px;
  line-height: 1.75;
  color: #1a202c;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
}

/* === Placeholder === */
.le-editor-body p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #CBD5E0;
  pointer-events: none;
  height: 0;
  font-style: italic;
}
.le-editor-body .is-empty::before {
  content: attr(data-placeholder);
  float: left;
  color: #CBD5E0;
  pointer-events: none;
  height: 0;
}

/* === Typography === */
.le-editor-body p { margin: 0.35rem 0; }
.le-editor-body h1 {
  font-size: 1.75em;
  font-weight: 700;
  margin: 1.2rem 0 0.6rem;
  line-height: 1.3;
  color: #1a202c;
}
.le-editor-body h2 {
  font-size: 1.4em;
  font-weight: 700;
  margin: 1rem 0 0.5rem;
  line-height: 1.35;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #E2E8F0;
}
.le-editor-body h3 {
  font-size: 1.15em;
  font-weight: 600;
  margin: 0.8rem 0 0.4rem;
  line-height: 1.4;
}

/* === Lists === */
.le-editor-body ul { list-style-type: disc; padding-left: 1.5em; margin: 0.4rem 0; }
.le-editor-body ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.4rem 0; }
.le-editor-body li { margin: 0.15rem 0; }
.le-editor-body li p { margin: 0; }

/* === Task List === */
.le-editor-body ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}
.le-editor-body ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 0.25rem 0;
}
.le-editor-body ul[data-type="taskList"] li > label {
  flex-shrink: 0;
  margin-top: 0.2rem;
}
.le-editor-body ul[data-type="taskList"] li > label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  accent-color: #00D1FF;
  cursor: pointer;
}
.le-editor-body ul[data-type="taskList"] li[data-checked="true"] > div > p {
  text-decoration: line-through;
  color: #A0AEC0;
}

/* === Blockquote === */
.le-editor-body blockquote {
  border-left: 3px solid #00D1FF;
  padding: 0.5rem 0 0.5rem 1rem;
  margin: 0.75rem 0;
  color: #4A5568;
  background: #F7FAFC;
  border-radius: 0 6px 6px 0;
}

/* === Code === */
.le-editor-body code {
  font-family: "JetBrains Mono", "Fira Code", "Roboto Mono", monospace;
  background: #F1F5F9;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.875em;
  color: #E53E3E;
}
.le-editor-body .hljs-code-block {
  font-family: "JetBrains Mono", "Fira Code", "Roboto Mono", monospace;
  background: #1E293B;
  color: #E2E8F0;
  padding: 1rem 1.25rem;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
  margin: 0.75rem 0;
  overflow-x: auto;
}
.le-editor-body .hljs-code-block code {
  background: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

/* === Horizontal Rule === */
.le-editor-body hr {
  border: none;
  border-top: 1px solid #E2E8F0;
  margin: 1.5rem 0;
}

/* === Link === */
.le-editor-body .editor-link {
  color: #00A3C4;
  text-decoration: underline;
  text-decoration-color: #00D1FF60;
  text-underline-offset: 2px;
  cursor: pointer;
  transition: text-decoration-color 0.15s;
}
.le-editor-body .editor-link:hover {
  text-decoration-color: #00A3C4;
}

/* === Image === */
.le-editor-body .editor-image {
  max-width: 100%;
  border-radius: 8px;
  margin: 0.75rem 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* === Highlight === */
.le-editor-body mark {
  background-color: #FEFCBF;
  padding: 0.1em 0.2em;
  border-radius: 2px;
}

/* === Table === */
.le-editor-body table {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
  border-radius: 6px;
  overflow: hidden;
}
.le-editor-body table td,
.le-editor-body table th {
  border: 1px solid #E2E8F0;
  padding: 0.5rem 0.75rem;
  min-width: 100px;
  vertical-align: top;
  font-size: 14px;
}
.le-editor-body table th {
  background: #F7FAFC;
  font-weight: 600;
  color: #4A5568;
}
.le-editor-body table .selectedCell::after {
  background: rgba(0, 209, 255, 0.15);
  content: "";
  left: 0; right: 0; top: 0; bottom: 0;
  pointer-events: none;
  position: absolute;
  z-index: 2;
}
.le-editor-body table .column-resize-handle {
  background-color: #00D1FF;
  bottom: -2px;
  position: absolute;
  right: -2px;
  top: 0;
  width: 3px;
  pointer-events: none;
}

/* === Dark theme === */
[data-theme="dark"] .le-editor-body {
  color: var(--foreground);
}
[data-theme="dark"] .le-editor-body h2 {
  border-bottom-color: var(--border);
}
[data-theme="dark"] .le-editor-body blockquote {
  background: var(--muted);
  border-left-color: var(--border);
  color: var(--muted-foreground);
}
[data-theme="dark"] .le-editor-body code {
  background: var(--muted);
  color: #FC8181;
}
[data-theme="dark"] .le-editor-body table td,
[data-theme="dark"] .le-editor-body table th {
  border-color: var(--border);
}
[data-theme="dark"] .le-editor-body table th {
  background: var(--muted);
  color: var(--foreground);
}
[data-theme="dark"] .le-editor-body hr {
  border-top-color: var(--border);
}
[data-theme="dark"] .le-editor-body mark {
  background-color: #744210;
  color: #FEFCBF;
}
[data-theme="dark"] .le-editor-body .editor-link {
  color: #63B3ED;
}

/* === Callout === */
.le-editor-body .callout {
  padding: 0.75rem 1rem;
  margin: 0.75rem 0;
  border-radius: 8px;
  border-left: 4px solid;
}
.le-editor-body .callout p { margin: 0.15rem 0; }
.le-editor-body .callout-info {
  background: #EFF6FF;
  border-left-color: #3B82F6;
}
.le-editor-body .callout-warning {
  background: #FFFBEB;
  border-left-color: #F59E0B;
}
.le-editor-body .callout-success {
  background: #F0FDF4;
  border-left-color: #22C55E;
}
.le-editor-body .callout-error {
  background: #FEF2F2;
  border-left-color: #EF4444;
}

/* === Columns === */
.le-editor-body .column-block {
  display: grid;
  gap: 1.5rem;
  margin: 0.75rem 0;
}
.le-editor-body .column {
  min-width: 0;
  padding: 0.5rem;
  border: 1px dashed #E2E8F0;
  border-radius: 6px;
}
.le-editor-body .column > *:first-child { margin-top: 0; }
.le-editor-body .column > *:last-child { margin-bottom: 0; }

/* === File Embed === */
.le-editor-body .file-embed {
  margin: 0.75rem 0;
}
.le-editor-body .file-embed-video {
  max-width: 100%;
  border-radius: 8px;
}
.le-editor-body .file-embed-audio {
  width: 100%;
}
.le-editor-body .file-embed-card {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  background: #F7FAFC;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
}
.le-editor-body .file-embed-link {
  color: #00A3C4;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}
.le-editor-body .file-embed-link:hover {
  text-decoration: underline;
}
.le-editor-body .file-embed-link::before {
  content: "📎 ";
}

/* === KaTeX === */
.le-editor-body .Tiptap-mathematics-editor {
  font-family: "JetBrains Mono", monospace;
  background: #F1F5F9;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 14px;
}
.le-editor-body .Tiptap-mathematics-render {
  padding: 0.1em 0.2em;
}

/* === Dark: Callout === */
[data-theme="dark"] .le-editor-body .callout-info {
  background: #1E293B; border-left-color: #60A5FA;
}
[data-theme="dark"] .le-editor-body .callout-warning {
  background: #1C1917; border-left-color: #FBBF24;
}
[data-theme="dark"] .le-editor-body .callout-success {
  background: #14231A; border-left-color: #4ADE80;
}
[data-theme="dark"] .le-editor-body .callout-error {
  background: #1F1215; border-left-color: #F87171;
}

/* === Dark: Columns === */
[data-theme="dark"] .le-editor-body .column {
  border-color: var(--border);
}

/* === Dark: File Embed === */
[data-theme="dark"] .le-editor-body .file-embed-card {
  background: var(--muted);
  border-color: var(--border);
}
[data-theme="dark"] .le-editor-body .file-embed-link {
  color: #63B3ED;
}

/* === Dark: KaTeX === */
[data-theme="dark"] .le-editor-body .Tiptap-mathematics-editor {
  background: var(--muted);
  color: var(--foreground);
}

/* === Selection === */
.le-editor-body ::selection {
  background: rgba(0, 209, 255, 0.2);
}

/* === Focus ring for wrapper === */
.le-editor-wrapper:focus-within {
  outline: none;
}
`;
