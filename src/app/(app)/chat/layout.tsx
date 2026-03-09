"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Conversation, Workspace } from "@/lib/types";
import { PixelIcon, ICONS } from "@/components/pixel";

// Color palette for tabs — cycles through like notebook binder rings
const TAB_COLORS = [
  { bg: "#CCF2FF", border: "#00A3C4", text: "#00A3C4" },
  { bg: "#C6F6D5", border: "#38A169", text: "#38A169" },
  { bg: "#FEFCBF", border: "#B7791F", text: "#B7791F" },
  { bg: "#E9D8FD", border: "#805AD5", text: "#805AD5" },
  { bg: "#FED7D7", border: "#C53030", text: "#C53030" },
  { bg: "#FED7E2", border: "#D53F8C", text: "#D53F8C" },
  { bg: "#BEE3F8", border: "#3182CE", text: "#3182CE" },
  { bg: "#B2F5EA", border: "#319795", text: "#319795" },
];

function getTabColor(index: number) {
  return TAB_COLORS[index % TAB_COLORS.length];
}

// ─── Editable tab ─────────────────────────────────────────────────────────

function ConversationTab({
  conv,
  index,
  isActive,
  onNavigate,
  onDelete,
  onRename,
}: {
  conv: Conversation;
  index: number;
  isActive: boolean;
  onNavigate: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (id: number, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const color = conv.workspace
    ? { bg: conv.workspace.color + "22", border: conv.workspace.color, text: conv.workspace.color }
    : getTabColor(index);
  const title = conv.title || `对话 #${conv.id}`;

  function startEditing() {
    setEditValue(conv.title || "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commitEdit() {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== conv.title) {
      onRename(conv.id, trimmed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  }

  return (
    <div
      data-conv-id={conv.id}
      onClick={onNavigate}
      onDoubleClick={(e) => {
        e.stopPropagation();
        startEditing();
      }}
      className="group relative flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold tracking-wide transition-all flex-shrink-0 max-w-[200px] cursor-pointer"
      style={{
        backgroundColor: isActive ? color.bg : "transparent",
        borderTop: `2px solid ${isActive ? color.border : "transparent"}`,
        borderLeft: `2px solid ${isActive ? color.border : "transparent"}`,
        borderRight: `2px solid ${isActive ? color.border : "transparent"}`,
        borderBottom: isActive ? "2px solid transparent" : "none",
        color: isActive ? color.text : "#718096",
        marginBottom: isActive ? "-2px" : "0",
        zIndex: isActive ? 10 : 1,
      }}
    >
      <span
        className="w-2 h-2 flex-shrink-0"
        style={{ backgroundColor: color.border }}
      />
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-b border-current outline-none text-[10px] font-bold w-full min-w-[60px]"
          maxLength={60}
        />
      ) : (
        <span className="truncate" title="双击重命名">
          {title}
        </span>
      )}
      {!editing && (
        <span
          onClick={onDelete}
          className="ml-1 opacity-0 group-hover:opacity-100 text-[8px] hover:text-red-500 transition-opacity flex-shrink-0 cursor-pointer"
          title="删除"
        >
          x
        </span>
      )}
    </div>
  );
}

// ─── Workspace picker modal ────────────────────────────────────────────────

function WorkspacePicker({
  workspaces,
  onSelect,
  onClose,
}: {
  workspaces: Workspace[];
  onSelect: (wsId: number | null) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white pixel-border p-5 w-[400px] max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">
            选择工作台
          </h2>
          <button
            onClick={onClose}
            className="text-[10px] font-bold text-gray-400 hover:text-[#1A202C]"
          >
            x
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {/* Default: no workspace */}
          <button
            onClick={() => onSelect(null)}
            className="w-full text-left px-3 py-2.5 border-2 border-[#1A202C] hover:bg-[#CCF2FF] transition-colors flex items-center gap-3"
          >
            <div
              className="w-7 h-7 flex-shrink-0 border-2 border-[#1A202C] flex items-center justify-center"
              style={{ backgroundColor: "#F0F4F8" }}
            >
              <span className="text-[10px] font-bold">?</span>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide">
                自由对话
              </div>
              <div className="text-[9px] text-gray-400">
                不绑定工作台，通用对话
              </div>
            </div>
          </button>

          {workspaces.map((ws) => (
            <button
              key={ws.id}
              onClick={() => onSelect(ws.id)}
              className="w-full text-left px-3 py-2.5 border-2 border-[#1A202C] hover:bg-[#CCF2FF] transition-colors flex items-center gap-3"
            >
              <div
                className="w-7 h-7 flex-shrink-0 border-2 border-[#1A202C] flex items-center justify-center"
                style={{ backgroundColor: ws.color }}
              >
                <span className="text-[10px] font-bold text-white">
                  {ws.icon?.slice(0, 2).toUpperCase() || ws.name[0]}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wide truncate">
                  {ws.name}
                </div>
                {ws.description && (
                  <div className="text-[9px] text-gray-400 truncate">
                    {ws.description}
                  </div>
                )}
              </div>
            </button>
          ))}

          {workspaces.length === 0 && (
            <div className="py-6 text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest">
              暂无可用工作台
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat context ──────────────────────────────────────────────────────────

interface ChatContextValue {
  onTitleUpdate: (id: number, title: string) => void;
}

export const ChatContext = createContext<ChatContextValue>({
  onTitleUpdate: () => {},
});

// ─── Layout ────────────────────────────────────────────────────────────────

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const tabsRef = useRef<HTMLDivElement>(null);

  const activeId = pathname.match(/^\/chat\/(\d+)/)?.[1];

  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiFetch<Conversation[]>("/conversations");
      setConversations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Scroll active tab into view
  useEffect(() => {
    if (!activeId || !tabsRef.current) return;
    const activeTab = tabsRef.current.querySelector(`[data-conv-id="${activeId}"]`);
    if (activeTab) {
      activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeId, conversations]);

  async function handleNewClick() {
    // Fetch workspaces then show picker
    try {
      const data = await apiFetch<Workspace[]>("/workspaces");
      console.log("[le-desk] workspaces response:", data);
      setWorkspaces(data);
    } catch (err) {
      console.error("[le-desk] workspaces fetch error:", err);
      setWorkspaces([]);
    }
    setShowPicker(true);
  }

  async function handleCreateConversation(workspaceId: number | null) {
    if (creating) return;
    setShowPicker(false);
    setCreating(true);
    try {
      const body: Record<string, unknown> = {};
      if (workspaceId !== null) body.workspace_id = workspaceId;
      const data = await apiFetch<{ id: number }>("/conversations", {
        method: "POST",
        body: JSON.stringify(body),
      });
      await fetchConversations();
      router.push(`/chat/${data.id}`);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await apiFetch(`/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === String(id)) {
        router.push("/chat");
      }
    } catch {
      // ignore
    }
  }

  function handleUpdateTitle(id: number, title: string) {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
    // Persist to backend (fire-and-forget)
    apiFetch(`/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    }).catch(() => {});
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="border-b-2 border-[#1A202C] bg-white px-6 h-12 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <PixelIcon {...ICONS.chat} size={16} />
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">
            对话
          </h1>
        </div>
        <button
          onClick={handleNewClick}
          disabled={creating}
          className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide bg-[#1A202C] text-white border-2 border-[#1A202C] hover:bg-black transition-colors disabled:opacity-40"
        >
          + 新建对话
        </button>
      </div>

      {/* Conversation tabs — notebook binder style */}
      {conversations.length > 0 && (
        <div className="bg-[#F0F4F8] border-b-2 border-[#1A202C] flex-shrink-0">
          <div
            ref={tabsRef}
            className="flex items-end gap-0 px-4 pt-2 overflow-x-auto no-scrollbar"
          >
            {conversations.map((conv, i) => (
              <ConversationTab
                key={conv.id}
                conv={conv}
                index={i}
                isActive={activeId === String(conv.id)}
                onNavigate={() => router.push(`/chat/${conv.id}`)}
                onDelete={(e) => handleDelete(conv.id, e)}
                onRename={handleUpdateTitle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Chat content */}
      <div className="flex-1 overflow-hidden">
        <ChatContext.Provider value={{ onTitleUpdate: handleUpdateTitle }}>
          {children}
        </ChatContext.Provider>
      </div>

      {/* Workspace picker modal — portal to body to escape overflow */}
      {showPicker &&
        createPortal(
          <WorkspacePicker
            workspaces={workspaces}
            onSelect={handleCreateConversation}
            onClose={() => setShowPicker(false)}
          />,
          document.body
        )}
    </div>
  );
}
