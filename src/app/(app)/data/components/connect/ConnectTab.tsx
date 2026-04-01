"use client";

import React, { useState } from "react";
import BitablePanel from "./BitablePanel";
import DbPanel from "./DbPanel";
import CreateBlankPanel from "./CreateBlankPanel";
import { ConnectMode } from "../shared/types";
import { useV2DataAssets } from "../shared/feature-flags";

type ConnectMode3 = ConnectMode | "blank";

function SecurityConfigSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-2 border-[#1A202C]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#EBF4F7] text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]"
      >
        <span>安全配置（可选）</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="p-3 space-y-3 text-[9px]">
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-400 block mb-1">默认敏感级别</label>
            <select className="border border-gray-300 rounded px-2 py-1 w-full text-[9px] focus:outline-none focus:border-[#00D1FF]">
              <option value="S0_public">S0 公开</option>
              <option value="S1_internal">S1 内部</option>
              <option value="S2_sensitive">S2 敏感</option>
            </select>
            <div className="text-[8px] text-gray-400 mt-0.5">新同步字段将使用此默认级别</div>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-3 h-3" />
              <span className="text-[9px]">同步时自动启用小样本保护</span>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-3 h-3" />
              <span className="text-[9px]">同步完成后自动触发字段画像分析</span>
            </label>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" defaultChecked className="w-3 h-3" />
              <span className="text-[9px]">同步失败时发送通知</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectTab({ onAdded }: { onAdded: () => void }) {
  const isV2 = useV2DataAssets();
  const [mode, setMode] = useState<ConnectMode3>("bitable");

  const MODES: { key: ConnectMode3; icon: string; label: string }[] = [
    { key: "bitable", icon: "🪁", label: "飞书多维表格" },
    { key: "db",      icon: "🗄", label: "外部数据库" },
    { key: "blank",   icon: "✦", label: "新建空白表" },
  ];

  return (
    <div className="max-w-3xl">
      {/* Source type toggle */}
      <div className="flex gap-1 mb-5">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex items-center gap-2 px-4 py-2 border-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              mode === m.key
                ? "border-[#1A202C] bg-[#1A202C] text-white"
                : "border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8]"
            }`}
          >
            <span>{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {mode === "bitable" ? <BitablePanel onAdded={onAdded} /> :
       mode === "db" ? <DbPanel onAdded={onAdded} /> :
       <CreateBlankPanel onAdded={onAdded} />}

      {/* V2: 外部源安全配置 */}
      {isV2 && mode !== "blank" && <SecurityConfigSection />}
    </div>
  );
}

export default ConnectTab;
