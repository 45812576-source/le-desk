"use client";

import { memo } from "react";
import type { ArchitectStructure, ArchitectPriorityMatrix } from "../types";

// ─── Priority badge colors ──────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  P0: "text-red-600 bg-red-50",
  P1: "text-amber-600 bg-amber-50",
  P2: "text-gray-500 bg-gray-100",
};

const PRIORITY_ICONS: Record<string, string> = {
  P0: "●",
  P1: "◐",
  P2: "○",
};

const SENSITIVITY_COLORS: Record<string, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-gray-400",
};

const SENSITIVITY_ICONS: Record<string, string> = {
  high: "▲",
  medium: "■",
  low: "▽",
};

const TYPE_LABELS: Record<string, string> = {
  issue_tree: "Issue Tree",
  dimension_map: "Dimension Map",
  value_chain: "Value Chain",
};

// ─── TreeNode recursive renderer ────────────────────────────────────────────

function TreeNode({
  nodeId,
  nodes,
  depth,
  isLast,
}: {
  nodeId: string;
  nodes: ArchitectStructure["nodes"];
  depth: number;
  isLast: boolean;
}) {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const isRoot = depth === 0;
  const connector = isRoot ? "" : isLast ? "└── " : "├── ";

  return (
    <>
      <div className="flex items-start" style={{ paddingLeft: `${depth * 16}px` }}>
        <span className="text-gray-400 whitespace-pre select-none">{connector}</span>
        <span className={isRoot ? "font-bold text-[#1A202C]" : "text-gray-600"}>
          {isRoot && <span className="mr-1">●</span>}
          {node.label}
        </span>
      </div>
      {node.children.map((childId, i) => (
        <TreeNode
          key={childId}
          nodeId={childId}
          nodes={nodes}
          depth={depth + 1}
          isLast={i === node.children.length - 1}
        />
      ))}
    </>
  );
}

// ─── TreeView (issue_tree / dimension_map) ──────────────────────────────────

const TreeView = memo(function TreeView({ structure }: { structure: ArchitectStructure }) {
  const roots = structure.nodes.filter((n) => n.parent === null);
  return (
    <div className="space-y-0.5">
      {roots.map((root, i) => (
        <TreeNode key={root.id} nodeId={root.id} nodes={structure.nodes} depth={0} isLast={i === roots.length - 1} />
      ))}
    </div>
  );
});

// ─── ValueChain (linear flow) ───────────────────────────────────────────────

const ValueChainView = memo(function ValueChainView({ structure }: { structure: ArchitectStructure }) {
  const root = structure.nodes.find((n) => n.parent === null);
  if (!root) return null;

  const steps = root.children
    .map((id) => structure.nodes.find((n) => n.id === id))
    .filter(Boolean) as ArchitectStructure["nodes"];

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, i) => (
        <span key={step.id} className="flex items-center gap-1">
          <span className="px-1.5 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 text-[8px] font-bold">
            {step.label}
          </span>
          {i < steps.length - 1 && <span className="text-gray-400 text-[8px]">→</span>}
        </span>
      ))}
    </div>
  );
});

// ─── PriorityMatrix ─────────────────────────────────────────────────────────

const PriorityMatrixView = memo(function PriorityMatrixView({ matrix }: { matrix: ArchitectPriorityMatrix }) {
  return (
    <div className="mx-3 my-2 border-2 border-gray-300 bg-white text-[9px] font-mono">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-gray-300 flex items-center gap-2">
        <span className="font-bold text-[#1A202C] text-[8px] uppercase tracking-widest">◈ 优先级矩阵</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-2 py-1 text-left text-[8px] font-bold text-gray-500 uppercase tracking-widest">维度</th>
              <th className="px-2 py-1 text-left text-[8px] font-bold text-gray-500 uppercase tracking-widest">优先级</th>
              <th className="px-2 py-1 text-left text-[8px] font-bold text-gray-500 uppercase tracking-widest">敏感度</th>
              <th className="px-2 py-1 text-left text-[8px] font-bold text-gray-500 uppercase tracking-widest">原因</th>
            </tr>
          </thead>
          <tbody>
            {matrix.dimensions.map((dim, i) => {
              const pColor = PRIORITY_COLORS[dim.priority] || PRIORITY_COLORS.P2;
              const pIcon = PRIORITY_ICONS[dim.priority] || "○";
              const sColor = SENSITIVITY_COLORS[dim.sensitivity] || SENSITIVITY_COLORS.low;
              const sIcon = SENSITIVITY_ICONS[dim.sensitivity] || "▽";
              return (
                <tr key={i} className={i < matrix.dimensions.length - 1 ? "border-b border-gray-100" : ""}>
                  <td className="px-2 py-1 font-bold text-[#1A202C]">{dim.name}</td>
                  <td className="px-2 py-1">
                    <span className={`px-1 py-0.5 text-[8px] font-bold ${pColor}`}>
                      {dim.priority} {pIcon}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <span className={`text-[8px] font-bold ${sColor}`}>
                      {dim.sensitivity} {sIcon}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-gray-500">{dim.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

// ─── ArchitectStructureCard (Card D) ────────────────────────────────────────

export const ArchitectStructureCard = memo(function ArchitectStructureCard({
  structure,
}: {
  structure: ArchitectStructure;
}) {
  const typeLabel = TYPE_LABELS[structure.type] || structure.type;
  const isValueChain = structure.type === "value_chain";

  return (
    <div className="mx-3 my-2 border-2 border-gray-300 bg-white text-[9px] font-mono">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-gray-300 flex items-center gap-2">
        <span className="font-bold text-[#1A202C] text-[8px] uppercase tracking-widest">◈ {typeLabel}</span>
        <span className="text-[7px] text-gray-400">{structure.root}</span>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {isValueChain ? (
          <ValueChainView structure={structure} />
        ) : (
          <TreeView structure={structure} />
        )}
      </div>
    </div>
  );
});

// Re-export PriorityMatrixView for direct use
export { PriorityMatrixView };
