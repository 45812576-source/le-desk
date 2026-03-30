"use client";

import { PixelBadge } from "@/components/pixel/PixelBadge";
import { formatCellValue } from "./CellFormatters";

export default function PreviewTable({
  columns,
  rows,
  title,
}: {
  columns: { name: string; type: string | number }[];
  rows: Record<string, unknown>[];
  title: string;
}) {
  return (
    <div className="border-2 border-[#1A202C] bg-white">
      <div className="px-4 py-2.5 bg-[#EBF4F7] border-b-2 border-[#1A202C] flex items-center gap-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">— {title}</span>
        <PixelBadge color="green">{columns.length} 列</PixelBadge>
        <PixelBadge color="gray">前 {rows.length} 行</PixelBadge>
      </div>
      <div className="px-4 pt-3 pb-1">
        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">字段结构</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {columns.map((c) => (
            <span key={c.name} className="inline-flex items-center gap-1 border-2 border-[#1A202C] px-2 py-0.5 text-[9px] font-bold bg-white">
              {c.name}
              <span className="text-[8px] text-[#00A3C4] font-mono">{String(c.type)}</span>
            </span>
          ))}
        </div>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto border-t-2 border-[#1A202C]">
          <table className="text-[9px] w-full">
            <thead>
              <tr className="bg-[#EBF4F7]">
                {columns.map((c) => (
                  <th key={c.name} className="text-left px-3 py-2 font-bold uppercase tracking-widest text-[#00A3C4] border-r border-gray-200 whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#F8FBFD]"}`}>
                  {columns.map((c) => (
                    <td key={c.name} className="px-3 py-1.5 border-r border-gray-100 font-mono text-gray-700 max-w-[160px] truncate" title={formatCellValue(row[c.name])}>
                      {row[c.name] === null || row[c.name] === undefined
                        ? <span className="text-gray-300">NULL</span>
                        : formatCellValue(row[c.name])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
