"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelIcon, ICONS } from "@/components/pixel";

interface NavItemProps {
  href: string;
  label: string;
  icon: { pattern: readonly string[]; colors: Readonly<Record<string, string>> };
  collapsed: boolean;
  badge?: number;
}

function NavItem({ href, label, icon, collapsed, badge }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="relative">
      <Link
        href={href}
        title={collapsed ? label : undefined}
        className={`flex items-center gap-2 px-2 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
          collapsed ? "justify-center" : ""
        } ${
          isActive
            ? "bg-[#CCF2FF] border-2 border-[#1A202C] text-[#1A202C]"
            : "text-[#1A202C] opacity-60 hover:opacity-100 hover:bg-white/50"
        }`}
      >
        <PixelIcon {...icon} size={14} />
        {!collapsed && <span>{label}</span>}
      </Link>
      {badge !== undefined && badge > 0 && (
        <span
          className="absolute top-1 right-2 min-w-[16px] h-4 bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-1 pointer-events-none"
          style={{ borderRadius: 0 }}
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
}: {
  label: string;
  children: React.ReactNode;
  storageKey: string;
  collapsed: boolean;
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
        <div className="mx-2 border-t border-[#00A3C4]/40" />
        {children}
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-3 pt-4 pb-1 text-[9px] font-bold text-[#00A3C4] uppercase tracking-widest hover:text-[#007A96] transition-colors"
      >
        <span>— {label}</span>
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

  return (
    <aside
      className={`flex-shrink-0 border-r-2 border-[#1A202C] bg-[#EBF4F7] flex flex-col justify-between transition-all duration-200 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <div className="overflow-y-auto flex-1">
        {/* Branding */}
        <div
          className={`border-b-2 border-[#1A202C] flex items-center flex-shrink-0 h-12 ${
            collapsed ? "justify-center px-2" : "px-4 space-x-3"
          }`}
        >
          <div className="w-8 h-8 bg-[#00D1FF] pixel-border flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4"
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
              <h1 className="text-xs font-bold uppercase tracking-tight leading-none">
                Le Desk
              </h1>
              <p className="text-[10px] text-[#00A3C4] font-bold uppercase mt-0.5">
                AI Workbench
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={`${collapsed ? "px-1 py-2" : "px-2 py-2"} space-y-0`}>
          <NavGroup
            label="工作台"
            storageKey="nav_group_workspace"
            collapsed={collapsed}
          >
            <NavItem
              href="/chat"
              label="对话"
              icon={ICONS.chat}
              collapsed={collapsed}
            />
            <NavItem
              href="/projects"
              label="项目"
              icon={ICONS.project}
              collapsed={collapsed}
            />
            <NavItem
              href="/tasks"
              label="待办中心"
              icon={ICONS.tasks}
              collapsed={collapsed}
              badge={taskPending}
            />
            <NavItem
              href="/dev-studio"
              label="工具开发"
              icon={ICONS.devStudio}
              collapsed={collapsed}
            />
          </NavGroup>

          <NavGroup
            label="知识管理"
            storageKey="nav_group_knowledge"
            collapsed={collapsed}
          >
            <NavItem
              href="/knowledge"
              label="我的知识"
              icon={ICONS.knowledgeMy}
              collapsed={collapsed}
            />
            <NavItem
              href="/skills"
              label="Skill"
              icon={ICONS.skills}
              collapsed={collapsed}
            />
            <NavItem
              href="/data"
              label="数据表"
              icon={ICONS.data}
              collapsed={collapsed}
            />
            <NavItem
              href="/intel"
              label="行业情报"
              icon={ICONS.intel}
              collapsed={collapsed}
            />
          </NavGroup>

          {isAdmin && (
            <>
              <NavGroup
                label="内容管理"
                storageKey="nav_group_admin_content"
                collapsed={collapsed}
              >
                <NavItem
                  href="/admin/knowledge"
                  label="知识审核"
                  icon={ICONS.review}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/skills"
                  label="Skill管理"
                  icon={ICONS.skillsAdmin}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/business-tables"
                  label="业务表管理"
                  icon={ICONS.bizTable}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/workspaces"
                  label="工作台管理"
                  icon={ICONS.workspaceAdmin}
                  collapsed={collapsed}
                />
              </NavGroup>

              <NavGroup
                label="AI 配置"
                storageKey="nav_group_admin_ai"
                collapsed={collapsed}
              >
                <NavItem
                  href="/admin/models"
                  label="模型配置"
                  icon={ICONS.models}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/tools"
                  label="工具管理"
                  icon={ICONS.tools}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/skill-market"
                  label="外部市场"
                  icon={ICONS.skillMarket}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/mcp-tokens"
                  label="MCP Token"
                  icon={ICONS.mcpToken}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/intel"
                  label="情报管理"
                  icon={ICONS.intelAdmin}
                  collapsed={collapsed}
                />
              </NavGroup>

              <NavGroup
                label="权限安全"
                storageKey="nav_group_admin_perm"
                collapsed={collapsed}
              >
                <NavItem
                  href="/admin/approvals"
                  label="审批管理"
                  icon={ICONS.approvals}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/skill-policies"
                  label="Skill策略"
                  icon={ICONS.skillPolicy}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/mask-config"
                  label="脱敏配置"
                  icon={ICONS.maskConfig}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/output-schemas"
                  label="输出Schema"
                  icon={ICONS.outputSchema}
                  collapsed={collapsed}
                />
              </NavGroup>

              <NavGroup
                label="系统运营"
                storageKey="nav_group_admin_ops"
                collapsed={collapsed}
              >
                <NavItem
                  href="/admin/contributions"
                  label="贡献排行"
                  icon={ICONS.contrib}
                  collapsed={collapsed}
                />
                <NavItem
                  href="/admin/audit"
                  label="操作审计"
                  icon={ICONS.audit}
                  collapsed={collapsed}
                />
                {isSuperAdmin && (
                  <NavItem
                    href="/admin/users"
                    label="用户管理"
                    icon={ICONS.users}
                    collapsed={collapsed}
                  />
                )}
              </NavGroup>
            </>
          )}
        </nav>
      </div>

      {/* User footer + collapse toggle */}
      <div className="border-t-2 border-[#1A202C] bg-white/40 flex-shrink-0">
        {!collapsed && (
          <div className="p-3 flex items-center space-x-2">
            <div className="w-7 h-7 bg-[#00CC99] pixel-border flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase truncate">
                {user.display_name}
              </div>
              <div className="text-[9px] text-[#00A3C4] font-bold uppercase">
                {user.role === "super_admin"
                  ? "超管"
                  : user.role === "dept_admin"
                    ? "部门管理员"
                    : "员工"}
              </div>
            </div>
          </div>
        )}

        <div
          className={`${collapsed ? "p-1" : "px-3 pb-3"} flex flex-col gap-1`}
        >
          {!collapsed && (
            <>
              <NavItem
                href="/settings"
                label="设置"
                icon={ICONS.settings}
                collapsed={false}
              />
              <button
                onClick={onLogout}
                className="w-full text-left px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:bg-white/60 border border-transparent hover:border-gray-400 transition-colors"
              >
                [退出登录]
              </button>
            </>
          )}
          {collapsed && (
            <NavItem
              href="/settings"
              label="设置"
              icon={ICONS.settings}
              collapsed={true}
            />
          )}
          <button
            onClick={toggleSidebar}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            className={`${collapsed ? "mx-auto" : "ml-auto"} flex items-center justify-center w-8 h-8 border-2 border-[#1A202C] bg-white hover:bg-[#CCF2FF] transition-colors`}
          >
            <span className="text-[10px] font-bold text-[#1A202C]">
              {collapsed ? "»" : "«"}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
