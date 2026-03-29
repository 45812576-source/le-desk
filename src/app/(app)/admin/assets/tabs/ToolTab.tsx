"use client";

/**
 * Tool Tab — 直接复用 admin/tools/page 的核心内容。
 * 由于工具管理页面逻辑非常复杂（1000+ 行），这里用动态导入。
 * 原始页面通过 PageShell 包装，这里把它当做一个独立区块渲染。
 */

import dynamic from "next/dynamic";

const AdminToolsPage = dynamic(
  () => import("@/app/(app)/admin/tools/page"),
  { loading: () => <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">Loading...</div> }
);

export default function ToolTab() {
  return <AdminToolsPage />;
}
