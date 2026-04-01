"use client";

import React from "react";

interface Props {
  totalTables: number;
  filedCount: number;
  withPermissions: number;
}

export default function GovernanceProgress({ totalTables, filedCount, withPermissions }: Props) {
  const filedPct = totalTables > 0 ? Math.round((filedCount / totalTables) * 100) : 0;
  const permPct = totalTables > 0 ? Math.round((withPermissions / totalTables) * 100) : 0;

  return (
    <div className="px-4 py-3 border-b-2 border-[#1A202C] bg-[#EBF4F7]">
      <div className="text-[8px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">治理进度</div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-[16px] font-bold text-[#1A202C]">{totalTables}</div>
          <div className="text-[7px] text-gray-400 uppercase">总表数</div>
        </div>
        <div>
          <div className="text-[16px] font-bold text-green-600">{filedCount}</div>
          <div className="text-[7px] text-gray-400 uppercase">已归档</div>
        </div>
        <div>
          <div className="text-[16px] font-bold text-[#00A3C4]">{withPermissions}</div>
          <div className="text-[7px] text-gray-400 uppercase">已配权限</div>
        </div>
      </div>
      {/* 进度条 */}
      <div className="mt-2 space-y-1">
        <div>
          <div className="flex items-center justify-between text-[7px] text-gray-400 mb-0.5">
            <span>归档进度</span>
            <span>{filedPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${filedPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[7px] text-gray-400 mb-0.5">
            <span>权限配置进度</span>
            <span>{permPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00A3C4] rounded-full transition-all"
              style={{ width: `${permPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
