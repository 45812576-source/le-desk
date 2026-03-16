"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelIcon, ICONS } from "@/components/pixel";
import { useTheme } from "@/lib/theme";

interface NavItemProps {
  href: string;
  label: string;
  icon: { pattern: readonly string[]; colors: Readonly<Record<string, string>> };
  collapsed: boolean;
  badge?: number;
  isLab: boolean;
}

function NavItem({ href, label, icon, collapsed, badge, isLab }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  const activeClass = isLab
    ? "bg-[#CCF2FF] border-2 border-[#1A202C] text-[#1A202C]"
    : "bg-accent text-accent-foreground font-semibold";
  const inactiveClass = isLab
    ? "text-[#1A202C] opacity-60 hover:opacity-100 hover:bg-white/50"
    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground";
  const baseClass = isLab
    ? "text-xs font-bold uppercase tracking-wide"
    : "text-sm font-medium";

  return (
    <div className="relative">
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-2 px-2 py-2 rounded-md transition-colors ${baseClass} ${
          collapsed ? "justify-center" : ""
        } ${isActive ? activeClass : inactiveClass}`}
      >
        <PixelIcon {...icon} size={14} />
        {!collapsed && <span>{label}</span>}
      </Link>
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute top-1 right-2 min-w-[16px] h-4 bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-1 pointer-events-none"
          style={{ borderRadius: isLab ? 0 : 4 }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </div>
  );
}

function NavGroup({
  label,
  children,
  storageKey,
  collapsed: sidebarCollapsed,
  isLab,
}: {
  label: string;
  children: React.ReactNode;
  storageKey: string;
  collapsed: boolean;
  isLab: boolean;
}) {
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem(storageKey);
    return saved === null ? true : saved === "true";
  });

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem(storageKey, String(next));
  }

  if (sidebarCollapsed) {
    return (
      <div className="my-2">
        <div className={`mx-2 border-t ${isLab ? "border-[#00A3C4]/40" : "border-border"}`} />
        {children}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        onClick={toggle}
        className={`w-full flex items-center justify-between px-3 pt-4 pb-1 uppercase tracking-widest transition-colors ${
          isLab
            ? "text-[9px] font-bold text-[#00A3C4] hover:text-[#007A96]"
            : "text-[10px] font-semibold text-muted-foreground hover:text-foreground"
        }`}
      >
        <span>{isLab ? `— ${label}` : label}</span>
        <PixelIcon
          {...(open ? ICONS.chevronDown : ICONS.chevronRight)}
          size={8}
        />
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

interface SidebarProps {
  user: {
    display_name: string;
    role: string;
  };
  taskPending?: number;
  onLogout?: () => void;
}

export function Sidebar({ user, taskPending = 0, onLogout }: SidebarProps) {
  const { theme } = useTheme();
  const isLab = theme === "lab";

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar_collapsed") === "true";
  });

  const isAdmin = user.role === "super_admin" || user.role === "dept_admin";
  const isSuperAdmin = user.role === "super_admin";

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar_collapsed", String(next));
  }

  const asideBorder = isLab ? "border-r-2 border-[#1A202C]" : "border-r border-border";
  const asideBg = isLab ? "bg-[#EBF4F7]" : "bg-sidebar";
  const headerBorder = isLab ? "border-b-2 border-[#1A202C]" : "border-b border-border";
  const logoBg = isLab ? "bg-[#00D1FF] pixel-border" : "bg-primary rounded-md";
  const logoText = isLab ? "text-[#1A202C]" : "text-primary-foreground";
  const subText = isLab ? "text-[10px] text-[#00A3C4] font-bold uppercase mt-0.5" : "text-[11px] text-muted-foreground mt-0.5";
  const footerBorder = isLab ? "border-t-2 border-[#1A202C]" : "border-t border-border";
  const footerBg = isLab ? "bg-white/40" : "bg-sidebar";
  const avatarBg = isLab ? "bg-[#00CC99] pixel-border" : "bg-primary/20 rounded-full";
  const toggleBtnClass = isLab
    ? "border-2 border-[#1A202C] bg-white hover:bg-[#CCF2FF]"
    : "border border-border bg-background hover:bg-accent rounded-md";

  const navItemProps = { isLab, collapsed };

  return (
    <aside
      className={`flex-shrink-0 ${asideBorder} ${asideBg} flex flex-col justify-between transition-all duration-200 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <div className="overflow-y-auto flex-1">
        {/* Branding */}
        <div
          className={`${headerBorder} flex items-center flex-shrink-0 h-12 ${
            collapsed ? "justify-center px-2" : "px-4 space-x-3"
          }`}
        >
          <div className={`w-8 h-8 ${logoBg} flex items-center justify-center flex-shrink-0`}>
            <svg
              className={`w-4 h-4 ${logoText}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <h1 className={`text-xs font-bold uppercase tracking-tight leading-none ${isLab ? "" : "text-foreground"}`}>
                Le Desk
              </h1>
              <p className={subText}>
                {isLab ? "AI Workbench" : theme === "dark" ? "AI Workbench · Dark" : "AI Workbench · Light"}
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`${collapsed ? "px-1 py-2" : "px-2 py-2"} space-y-0`}>
          <NavGroup label="工作台" storageKey="nav_group_workspace" collapsed={collapsed} isLab={isLab}>
            <NavItem href="/chat" label="对话" icon={ICONS.chat} {...navItemProps} />
            <NavItem href="/projects" label="项目" icon={ICONS.project} {...navItemProps} />
            <NavItem href="/tasks" label="待办中心" icon={ICONS.tasks} {...navItemProps} badge={taskPending} />
            <NavItem href="/dev-studio" label="工具开发" icon={ICONS.devStudio} {...navItemProps} />
          </NavGroup>

          <NavGroup label="知识管理" storageKey="nav_group_knowledge" collapsed={collapsed} isLab={isLab}>
            <NavItem href="/knowledge" label="我的知识" icon={ICONS.knowledgeMy} {...navItemProps} />
            <NavItem href="/skills" label="Skill" icon={ICONS.skills} {...navItemProps} />
            <NavItem href="/data" label="数据表" icon={ICONS.data} {...navItemProps} />
            <NavItem href="/intel" label="行业情报" icon={ICONS.intel} {...navItemProps} />
          </NavGroup>

          {isAdmin && (
            <>
              <NavGroup label="内容管理" storageKey="nav_group_admin_content" collapsed={collapsed} isLab={isLab}>
                <NavItem href="/admin/knowledge" label="知识审核" icon={ICONS.review} {...navItemProps} />
                <NavItem href="/admin/skills" label="Skill管理" icon={ICONS.skillsAdmin} {...navItemProps} />
                <NavItem href="/admin/business-tables" label="业务表管理" icon={ICONS.bizTable} {...navItemProps} />
                <NavItem href="/admin/workspaces" label="工作台管理" icon={ICONS.workspaceAdmin} {...navItemProps} />
              </NavGroup>

              <NavGroup label="AI 配置" storageKey="nav_group_admin_ai" collapsed={collapsed} isLab={isLab}>
                <NavItem href="/admin/models" label="模型配置" icon={ICONS.models} {...navItemProps} />
                <NavItem href="/admin/tools" label="工具管理" icon={ICONS.tools} {...navItemProps} />
                <NavItem href="/admin/skill-market" label="外部市场" icon={ICONS.skillMarket} {...navItemProps} />
                <NavItem href="/admin/mcp-tokens" label="MCP Token" icon={ICONS.mcpToken} {...navItemProps} />
                <NavItem href="/admin/intel" label="情报管理" icon={ICONS.intelAdmin} {...navItemProps} />
              </NavGroup>

              <NavGroup label="权限安全" storageKey="nav_group_admin_perm" collapsed={collapsed} isLab={isLab}>
                <NavItem href="/admin/approvals" label="审批管理" icon={ICONS.approvals} {...navItemProps} />
                <NavItem href="/admin/skill-policies" label="Skill策略" icon={ICONS.skillPolicy} {...navItemProps} />
                <NavItem href="/admin/mask-config" label="脱敏配置" icon={ICONS.maskConfig} {...navItemProps} />
                <NavItem href="/admin/output-schemas" label="输出Schema" icon={ICONS.outputSchema} {...navItemProps} />
              </NavGroup>

              <NavGroup label="系统运营" storageKey="nav_group_admin_ops" collapsed={collapsed} isLab={isLab}>
                <NavItem href="/admin/contributions" label="贡献排行" icon={ICONS.contrib} {...navItemProps} />
                <NavItem href="/admin/audit" label="操作审计" icon={ICONS.audit} {...navItemProps} />
                {isSuperAdmin && (
                  <NavItem href="/admin/users" label="用户管理" icon={ICONS.users} {...navItemProps} />
                )}
              </NavGroup>
            </>
          )}
        </nav>
      </div>

      {/* User footer + collapse toggle */}
      <div className={`${footerBorder} ${footerBg} flex-shrink-0`}>
        {!collapsed && (
          <div className="p-3 flex items-center space-x-2">
            <div className={`w-7 h-7 ${avatarBg} flex-shrink-0`} />
            <div className="min-w-0">
              <div className={`truncate ${isLab ? "text-[10px] font-bold uppercase" : "text-xs font-medium text-foreground"}`}>
                {user.display_name}
              </div>
              <div className={isLab ? "text-[9px] text-[#00A3C4] font-bold uppercase" : "text-[11px] text-muted-foreground"}>
                {user.role === "super_admin" ? "超管" : user.role === "dept_admin" ? "部门管理员" : "员工"}
              </div>
            </div>
          </div>
        )}

        <div className={`${collapsed ? "p-1" : "px-3 pb-3"} flex flex-col gap-1`}>
          {!collapsed && (
            <>
              <NavItem href="/settings" label="设置" icon={ICONS.settings} collapsed={false} isLab={isLab} />
              <button
                onClick={onLogout}
                className={`w-full text-left px-2 py-1.5 transition-colors ${
                  isLab
                    ? "text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:bg-white/60 border border-transparent hover:border-gray-400"
                    : "text-xs text-muted-foreground hover:bg-accent rounded-md hover:text-foreground"
                }`}
              >
                {isLab ? "[退出登录]" : "退出登录"}
              </button>
            </>
          )}
          {collapsed && (
            <NavItem href="/settings" label="设置" icon={ICONS.settings} collapsed={true} isLab={isLab} />
          )}
          <button
            onClick={toggleSidebar}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            className={`${collapsed ? "mx-auto" : "ml-auto"} flex items-center justify-center w-8 h-8 transition-colors ${toggleBtnClass}`}
          >
            <span className={`text-[10px] font-bold ${isLab ? "text-[#1A202C]" : "text-foreground"}`}>
              {collapsed ? "»" : "«"}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
