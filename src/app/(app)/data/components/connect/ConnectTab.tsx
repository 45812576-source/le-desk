"use client";

import React, { useState } from "react";
import BitablePanel from "./BitablePanel";
import DbPanel from "./DbPanel";
import CreateBlankPanel from "./CreateBlankPanel";
import { ConnectMode } from "../shared/types";

type ConnectMode3 = ConnectMode | "blank";

function ConnectTab({ onAdded }: { onAdded: () => void }) {
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
    </div>
  );
}

export default ConnectTab;
