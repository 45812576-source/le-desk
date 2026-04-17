"use client";

import React, { useState } from "react";
import BitablePanel from "./BitablePanel";
import DbPanel from "./DbPanel";
import CreateBlankPanel from "./CreateBlankPanel";
import UploadFilePanel from "./UploadFilePanel";
import { ConnectMode } from "../shared/types";

type ConnectMode3 = ConnectMode | "blank" | "upload";

function BoundaryNotice() {
  return (
    <div className="mt-4 border-2 border-[#1A202C] bg-[#F8FBFD] p-3">
      <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">使用边界</div>
      <div className="mt-1 text-[9px] text-gray-600 leading-relaxed">
        数据表这里先解决接入、字段、样例、视图范围和关联 Skill 回显。
        具体用户运行 Skill 时的权限、脱敏、审批和辅助挂载，统一在 SkillStudio 处理。
      </div>
    </div>
  );
}

function ConnectTab({ onAdded }: { onAdded: () => void }) {
  const [mode, setMode] = useState<ConnectMode3>("upload");

  const MODES: { key: ConnectMode3; icon: string; label: string }[] = [
    { key: "upload",   icon: "📄", label: "上传文件" },
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

      {mode === "upload" ? <UploadFilePanel onAdded={onAdded} /> :
       mode === "bitable" ? <BitablePanel onAdded={onAdded} /> :
       mode === "db" ? <DbPanel onAdded={onAdded} /> :
       <CreateBlankPanel onAdded={onAdded} />}

      <BoundaryNotice />
    </div>
  );
}

export default ConnectTab;
