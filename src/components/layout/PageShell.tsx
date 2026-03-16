"use client";

import { useTheme } from "@/lib/theme";
import { PixelIcon, type PixelIconProps, ICONS } from "@/components/pixel";
import {
  MessageSquare, FolderKanban, CheckSquare, Code2,
  BookOpen, Zap, Table2, Rss,
  ClipboardCheck, ShieldCheck, LayoutDashboard,
  Bot, Wrench, Store, Key, Globe2,
  ShieldAlert, Lock, EyeOff, FileJson,
  BarChart2, ScrollText, Users, Settings,
} from "lucide-react";

// ICONS key → lucide component 映射（与 Sidebar 保持一致）
const LUCIDE_MAP: Record<string, React.ElementType> = {
  chat:            MessageSquare,
  project:         FolderKanban,
  tasks:           CheckSquare,
  devStudio:       Code2,
  knowledgeMy:     BookOpen,
  skills:          Zap,
  skillsAdmin:     Zap,
  data:            Table2,
  intel:           Rss,
  intelAdmin:      Globe2,
  review:          ClipboardCheck,
  bizTable:        Table2,
  workspaceAdmin:  LayoutDashboard,
  models:          Bot,
  tools:           Wrench,
  skillMarket:     Store,
  mcpToken:        Key,
  approvals:       ShieldCheck,
  skillPolicy:     ShieldAlert,
  maskConfig:      EyeOff,
  outputSchema:    FileJson,
  contrib:         BarChart2,
  audit:           ScrollText,
  users:           Users,
  settings:        Settings,
};

interface PageShellProps {
  title: string;
  icon?: PixelIconProps;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageShell({ title, icon, children, actions }: PageShellProps) {
  const { theme } = useTheme();
  const isLab = theme === "lab";

  // 通过 pattern 内容匹配 key（支持 Server Component 序列化后的对象）
  const iconKey = icon
    ? (Object.keys(ICONS) as (keyof typeof ICONS)[]).find(
        (k) => ICONS[k].pattern.join("") === icon.pattern.join("")
      )
    : undefined;
  const LucideIcon = iconKey ? LUCIDE_MAP[iconKey] : undefined;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b-2 border-[#1A202C] bg-card px-6 h-12 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          {icon && (
            isLab ? (
              <PixelIcon {...icon} size={16} />
            ) : LucideIcon ? (
              <LucideIcon size={16} className="text-muted-foreground" />
            ) : (
              <PixelIcon {...icon} size={16} />
            )
          )}
          <h1 className="text-xs font-bold uppercase tracking-widest text-[#1A202C]">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
