"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useChatStore } from "@/lib/chat-store";
import type { Conversation, Workspace } from "@/lib/types";
import { ICONS } from "@/components/pixel";
import { ThemedPageIcon } from "@/components/layout/PageShell";
import { useTheme } from "@/lib/theme";

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

const ConversationTab = memo(function ConversationTab({
  conv,
  index,
  isActive,
  onDelete,
  onRename,
}: {
  conv: Conversation;
  index: number;
  isActive: boolean;
  onDelete: (id: number, e: React.MouseEvent) => void;
  onRename: (id: number, title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isOpencode = conv.workspace_type === "opencode";
  const isSkillStudio = conv.workspace_type === "skill_studio";
  const color = conv.workspace
    ? { bg: conv.workspace.color + "22", border: conv.workspace.color, text: conv.workspace.color }
    : getTabColor(index);
  const title = isOpencode ? "OpenCode 开发" : isSkillStudio ? "Skill Studio" : (conv.title || `对话 #${conv.id}`);

  function startEditing() {
    if (isOpencode || isSkillStudio) return;
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
    <Link
      href={`/chat/${conv.id}`}
      data-conv-id={conv.id}
      onDoubleClick={(e) => {
        e.preventDefault();
        if (!isOpencode) startEditing();
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
        <span className="truncate" title={isOpencode ? "OpenCode 开发工作台" : "双击重命名"}>
          {title}
        </span>
      )}
      {!editing && !isOpencode && !isSkillStudio && (
        <span
          onClick={(e) => { e.preventDefault(); onDelete(conv.id, e); }}
          className="ml-1 opacity-0 group-hover:opacity-100 text-[8px] hover:text-red-500 transition-opacity flex-shrink-0 cursor-pointer"
          title="删除"
        >
          x
        </span>
      )}
    </Link>
  );
});

// ─── Workspace picker modal ────────────────────────────────────────────────

function WsCard({ ws, onSelect }: { ws: Workspace; onSelect: (id: number) => void }) {
  const isOpencode = ws.workspace_type === "opencode";
  const isSandbox = ws.workspace_type === "sandbox";
  const isSkillStudio = ws.workspace_type === "skill_studio";
  const accentColor = isOpencode ? "#6B46C1" : isSandbox ? "#00CC99" : isSkillStudio ? "#00D1FF" : ws.color || "#00A3C4";
  const badge = isOpencode ? "DEV" : isSandbox ? "TEST" : isSkillStudio ? "SKILL" : null;

  return (
    <button
      onClick={() => onSelect(ws.id)}
      className="w-full text-left px-3 py-2.5 border-2 hover:bg-[#CCF2FF] transition-colors flex items-center gap-2.5 min-w-0"
      style={{ borderColor: accentColor }}
    >
      <div
        className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
        style={{ backgroundColor: accentColor }}
      >
        {ws.name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide truncate">{ws.name}</span>
          {badge && (
            <span className="text-[7px] font-bold px-1 border flex-shrink-0" style={{ borderColor: accentColor, color: accentColor }}>
              {badge}
            </span>
          )}
        </div>
        {ws.description && (
          <div className="text-[8px] text-gray-400 truncate">{ws.description}</div>
        )}
      </div>
    </button>
  );
}

function WorkspacePicker({
  workspaces,
  onSelect,
  onClose,
}: {
  workspaces: Workspace[];
  onSelect: (wsId: number | null) => void;
  onClose: () => void;
}) {
  // 系统内置：仅 opencode / sandbox / skill_studio 类型
  const systemWs = workspaces.filter(
    (w) => w.workspace_type === "opencode" || w.workspace_type === "sandbox" || w.workspace_type === "skill_studio"
  );
  // 管理员推荐的工作台
  const recommendedWs = workspaces.filter(
    (w) => w.workspace_type !== "opencode" && w.workspace_type !== "sandbox" && w.workspace_type !== "skill_studio"
      && (w as unknown as Record<string, unknown>).recommended_by
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-[#1A202C] p-5 w-[680px] max-h-[78vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">选择工作台</h2>
          <button onClick={onClose} className="text-[10px] font-bold text-gray-400 hover:text-[#1A202C]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* 系统内置 */}
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 px-0.5">系统内置</div>
            <div className="grid grid-cols-2 gap-2">
              {/* 自定义工作台始终第一 */}
              <button
                onClick={() => onSelect(null)}
                className="text-left px-3 py-2.5 border-2 border-[#1A202C] hover:bg-[#CCF2FF] transition-colors flex items-center gap-2.5"
              >
                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center text-[9px] font-bold bg-[#E2E8F0] border border-[#1A202C]">
                  ∞
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide">自定义工作台</div>
                  <div className="text-[8px] text-gray-400">使用个人工作台配置</div>
                </div>
              </button>
              {systemWs.map((ws) => <WsCard key={ws.id} ws={ws} onSelect={onSelect} />)}
            </div>
          </div>

          {/* 管理员推荐 */}
          {recommendedWs.length > 0 && (
            <div>
              <div className="text-[8px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 px-0.5">部门推荐</div>
              <div className="grid grid-cols-2 gap-2">
                {recommendedWs.map((ws) => <WsCard key={ws.id} ws={ws} onSelect={onSelect} />)}
              </div>
            </div>
          )}

          {workspaces.length === 0 && (
            <div className="py-6 text-center text-[9px] text-gray-400 font-bold uppercase tracking-widest">
              暂无可用工作台
            </div>)}
        </div>
      </div>
    </div>
  );
}

// ─── Layout ────────────────────────────────────────────────────────────────

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read from store (pre-populated by AppShell prefetch)
  const storeConversations = useChatStore((s) => s.conversations);
  const [conversations, setConversations] = useState<Conversation[]>(storeConversations);
  const [showPicker, setShowPicker] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const tabsRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isLab = theme === "lab";

  const activeId = pathname.match(/^\/chat\/(\d+)/)?.[1];

  // Keep local state in sync with store
  useEffect(() => {
    setConversations(storeConversations);
  }, [storeConversations]);

  const fetchConversations = useCallback(async () => {
    try {
      const data = await apiFetch<Conversation[]>("/conversations");
      setConversations(data);
      useChatStore.setState({ conversations: data });
    } catch {
      // ignore
    }
  }, []);

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
    // skill_studio 直接跳专属入口，不走新建对话流程
    if (workspaceId !== null) {
      const picked = workspaces.find((w) => w.id === workspaceId);
      if (picked?.workspace_type === "skill_studio") {
        router.push("/skill-studio");
        return;
      }
    }
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

  const handleDelete = useCallback(async (id: number, e: React.MouseEvent) => {
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
  }, [activeId, router]);

  const handleUpdateTitle = useCallback((id: number, title: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c))
    );
    useChatStore.getState().updateConvTitle(id, title);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="border-b-2 border-[#1A202C] px-6 h-12 flex items-center justify-between flex-shrink-0" style={{ backgroundColor: "var(--card)" }}>
        <div className="flex items-center gap-2">
          <ThemedPageIcon icon={ICONS.chat} size={16} />
          <h1 className={`text-xs font-bold uppercase tracking-widest ${isLab ? "text-[#1A202C]" : "text-foreground"}`}>
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
                onDelete={handleDelete}
                onRename={handleUpdateTitle}
              />
            ))}
          </div>
        </div>
      )}

      {/* Chat content */}
      <div className="flex-1 overflow-hidden">
        {children}
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
