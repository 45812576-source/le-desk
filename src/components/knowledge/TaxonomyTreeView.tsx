"use client";

import { useState } from "react";
import { BookOpen, Target } from "lucide-react";
import { PixelIcon, ICONS } from "@/components/pixel";
import { useTheme } from "@/lib/theme";
import type { KnowledgeDetail } from "@/lib/types";
import type { GovernanceBlueprintLite } from "@/app/(app)/data/components/shared/types";
import FileTypeIcon from "./FileTypeIcon";

const BOARD_LABELS: Record<string, string> = {
  A: "A. 渠道与平台",
  B: "B. 投放策略与方法论",
  C: "C. 行业与客户知识",
  D: "D. 产品与工具知识",
  E: "E. 运营与管理",
  F: "F. 外部资料与研究",
};

const BOARD_ORDER = ["A", "B", "C", "D", "E", "F"];
const UNKNOWN_BU = "未分配事业部";

function ThemedFolderIcon({ size }: { size: number }) {
  const { theme } = useTheme();
  if (theme === "lab") return <PixelIcon pattern={ICONS.knowledgeMy.pattern} colors={ICONS.knowledgeMy.colors} size={size} />;
  return <BookOpen size={size} className="text-muted-foreground" />;
}

function groupByPrefix(boardEntries: KnowledgeDetail[]): Map<string, { label: string; entries: KnowledgeDetail[] }> {
  const map = new Map<string, { label: string; entries: KnowledgeDetail[] }>();
  for (const e of boardEntries) {
    if (!e.taxonomy_code) {
      const key = "__no_code__";
      if (!map.has(key)) map.set(key, { label: "其他", entries: [] });
      map.get(key)!.entries.push(e);
      continue;
    }
    const prefix = e.taxonomy_code.split(".")[0];
    const label = (e.taxonomy_path && e.taxonomy_path[1]) ? e.taxonomy_path[1] : prefix;
    if (!map.has(prefix)) map.set(prefix, { label, entries: [] });
    map.get(prefix)!.entries.push(e);
  }
  return map;
}

export type TreeViewMode = "taxonomy" | "governance";

interface TaxonomyTreeViewProps {
  entries: KnowledgeDetail[];
  selectedEntry: KnowledgeDetail | null;
  onSelectEntry: (e: KnowledgeDetail) => void;
  mode?: TreeViewMode;
  blueprint?: GovernanceBlueprintLite | null;
}

export default function TaxonomyTreeView({ entries, selectedEntry, onSelectEntry, mode = "taxonomy", blueprint }: TaxonomyTreeViewProps) {
  if (mode === "governance" && blueprint) {
    return <GovernanceTreeView blueprint={blueprint} entries={entries} selectedEntry={selectedEntry} onSelectEntry={onSelectEntry} />;
  }
  return <TaxonomyTree entries={entries} selectedEntry={selectedEntry} onSelectEntry={onSelectEntry} />;
}

/* ─── Governance 模式：Objective → Mission → KR → Element → Library ─── */

function GovernanceTreeView({
  blueprint,
  entries,
  selectedEntry,
  onSelectEntry,
}: {
  blueprint: GovernanceBlueprintLite;
  entries: KnowledgeDetail[];
  selectedEntry: KnowledgeDetail | null;
  onSelectEntry: (e: KnowledgeDetail) => void;
}) {
  const [openNodes, setOpenNodes] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const objectives = blueprint.objectives || [];
  const libraries = blueprint.resource_libraries || [];
  const missions = blueprint.department_missions || [];
  const krs = blueprint.krs || [];
  const elements = blueprint.required_elements || [];

  // 按 resource_library_id 索引文档
  const entriesByLibrary = new Map<number, KnowledgeDetail[]>();
  for (const e of entries) {
    const libId = (e as unknown as Record<string, unknown>).resource_library_id as number | undefined;
    if (libId) {
      if (!entriesByLibrary.has(libId)) entriesByLibrary.set(libId, []);
      entriesByLibrary.get(libId)!.push(e);
    }
  }

  function countForObjective(objId: number): number {
    return libraries
      .filter((l) => l.objective_id === objId)
      .reduce((sum, l) => sum + (entriesByLibrary.get(l.id)?.length || 0), 0);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {objectives.map((obj) => {
        const objKey = `obj:${obj.id}`;
        const isOpen = openNodes.has(objKey);
        const objLibraries = libraries.filter((l) => l.objective_id === obj.id);
        const docCount = countForObjective(obj.id);
        const objMissions = missions.filter((m) => m.objective_id === obj.id);

        return (
          <div key={objKey}>
            <div
              className="flex items-center gap-1 py-1 hover:bg-white group select-none cursor-pointer"
              style={{ paddingLeft: "8px", paddingRight: "8px" }}
              onClick={() => toggle(objKey)}
            >
              <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{isOpen ? "▾" : "▸"}</span>
              <Target size={12} className="text-[#0077B6] flex-shrink-0" />
              <span className="flex-1 text-[10px] font-bold truncate text-[#0077B6]">{obj.name}</span>
              <span className="text-[8px] text-gray-400 flex-shrink-0">{docCount}</span>
            </div>

            {isOpen && objMissions.length > 0 && objMissions.map((mission) => {
              const mKey = `mission:${mission.id}`;
              const mOpen = openNodes.has(mKey);
              const missionKrs = krs.filter((kr) => kr.mission_id === mission.id);

              return (
                <div key={mKey}>
                  <div
                    className="flex items-center gap-1 py-1 hover:bg-white select-none cursor-pointer"
                    style={{ paddingLeft: "24px", paddingRight: "8px" }}
                    onClick={() => toggle(mKey)}
                  >
                    <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{mOpen ? "▾" : "▸"}</span>
                    <span className="flex-1 text-[9px] font-semibold truncate text-slate-600">{mission.name}</span>
                  </div>

                  {mOpen && missionKrs.map((kr) => {
                    const krKey = `kr:${kr.id}`;
                    const krOpen = openNodes.has(krKey);
                    const krElements = elements.filter((el) => el.kr_id === kr.id);

                    return (
                      <div key={krKey}>
                        <div
                          className="flex items-center gap-1 py-1 hover:bg-white select-none cursor-pointer"
                          style={{ paddingLeft: "40px", paddingRight: "8px" }}
                          onClick={() => toggle(krKey)}
                        >
                          <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{krOpen ? "▾" : "▸"}</span>
                          <span className="flex-1 text-[9px] truncate text-slate-500">{kr.name}</span>
                        </div>

                        {krOpen && krElements.map((el) => {
                          const elKey = `el:${el.id}`;
                          const elOpen = openNodes.has(elKey);
                          const elLibCodes = el.required_library_codes || [];
                          const elLibraries = libraries.filter((l) => elLibCodes.includes(l.code));

                          return (
                            <div key={elKey}>
                              <div
                                className="flex items-center gap-1 py-1 hover:bg-white select-none cursor-pointer"
                                style={{ paddingLeft: "56px", paddingRight: "8px" }}
                                onClick={() => toggle(elKey)}
                              >
                                <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{elOpen ? "▾" : "▸"}</span>
                                <span className="flex-1 text-[8px] truncate text-gray-500">{el.name}</span>
                              </div>

                              {elOpen && elLibraries.map((lib) => {
                                const libEntries = entriesByLibrary.get(lib.id) || [];
                                const libKey = `lib:${lib.id}:${el.id}`;
                                const libOpen = openNodes.has(libKey);

                                return (
                                  <div key={libKey}>
                                    <div
                                      className="flex items-center gap-1 py-1 hover:bg-white select-none cursor-pointer"
                                      style={{ paddingLeft: "72px", paddingRight: "8px" }}
                                      onClick={() => toggle(libKey)}
                                    >
                                      <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{libOpen ? "▾" : "▸"}</span>
                                      <ThemedFolderIcon size={10} />
                                      <span className="flex-1 text-[8px] truncate text-emerald-700">{lib.name}</span>
                                      <span className="text-[7px] text-gray-400 flex-shrink-0">{libEntries.length}</span>
                                    </div>
                                    {libOpen && libEntries.map((e) => {
                                      const ext = e.file_ext || (e.source_file?.includes(".") ? `.${e.source_file.split(".").pop()}` : "");
                                      const extLabel = ext.replace(/^\./, "").toUpperCase() || "TXT";
                                      const isSelected = selectedEntry?.id === e.id;
                                      return (
                                        <div
                                          key={e.id}
                                          onClick={() => onSelectEntry(e)}
                                          className={`flex items-center gap-2 py-1.5 select-none border-b border-gray-100 cursor-pointer transition-colors ${
                                            isSelected ? "bg-[#CCF2FF]" : "hover:bg-white"
                                          }`}
                                          style={{ paddingLeft: "88px", paddingRight: "8px" }}
                                        >
                                          <FileTypeIcon ext={ext} size={14} />
                                          <span className="flex-1 text-xs truncate">{e.title || e.source_file}</span>
                                          <span className={`text-[7px] font-bold px-1 border flex-shrink-0 ${
                                            e.status === "approved" ? "border-green-400 text-green-600" :
                                            e.status === "pending" ? "border-yellow-400 text-yellow-600" :
                                            "border-gray-300 text-gray-400"
                                          }`}>{extLabel}</span>
                                        </div>
                                      );
                                    })}
                                    {libOpen && libEntries.length === 0 && (
                                      <div className="text-[8px] text-gray-400 py-1" style={{ paddingLeft: "88px" }}>暂无文档</div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* 直属资源库（不经过 mission 路径的） */}
            {isOpen && objLibraries.map((lib) => {
              const libEntries = entriesByLibrary.get(lib.id) || [];
              const libKey = `direct-lib:${lib.id}`;
              const libOpen = openNodes.has(libKey);
              // 跳过已在 mission 树中展示过的
              const inMission = missions.some((m) => m.objective_id === obj.id);
              if (inMission && objMissions.length > 0) return null;

              return (
                <div key={libKey}>
                  <div
                    className="flex items-center gap-1 py-1 hover:bg-white select-none cursor-pointer"
                    style={{ paddingLeft: "24px", paddingRight: "8px" }}
                    onClick={() => toggle(libKey)}
                  >
                    <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{libOpen ? "▾" : "▸"}</span>
                    <ThemedFolderIcon size={10} />
                    <span className="flex-1 text-[9px] truncate text-emerald-700">{lib.name}</span>
                    <span className="text-[7px] text-gray-400 flex-shrink-0">{libEntries.length}</span>
                  </div>
                  {libOpen && libEntries.map((e) => {
                    const ext = e.file_ext || (e.source_file?.includes(".") ? `.${e.source_file.split(".").pop()}` : "");
                    const extLabel = ext.replace(/^\./, "").toUpperCase() || "TXT";
                    const isSelected = selectedEntry?.id === e.id;
                    return (
                      <div
                        key={e.id}
                        onClick={() => onSelectEntry(e)}
                        className={`flex items-center gap-2 py-1.5 select-none border-b border-gray-100 cursor-pointer transition-colors ${
                          isSelected ? "bg-[#CCF2FF]" : "hover:bg-white"
                        }`}
                        style={{ paddingLeft: "44px", paddingRight: "8px" }}
                      >
                        <FileTypeIcon ext={ext} size={14} />
                        <span className="flex-1 text-xs truncate">{e.title || e.source_file}</span>
                        <span className={`text-[7px] font-bold px-1 border flex-shrink-0 ${
                          e.status === "approved" ? "border-green-400 text-green-600" :
                          e.status === "pending" ? "border-yellow-400 text-yellow-600" :
                          "border-gray-300 text-gray-400"
                        }`}>{extLabel}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}

      {objectives.length === 0 && (
        <div className="text-[9px] text-gray-400 px-4 py-3">尚未初始化治理蓝图，请先执行"种子数据初始化"</div>
      )}
    </div>
  );
}

/* ─── Taxonomy 模式（原有逻辑） ─── */

function TaxonomyTree({ entries, selectedEntry, onSelectEntry }: { entries: KnowledgeDetail[]; selectedEntry: KnowledgeDetail | null; onSelectEntry: (e: KnowledgeDetail) => void }) {
  const [openBusinessUnits, setOpenBusinessUnits] = useState<Set<string>>(new Set());
  const [openBoards, setOpenBoards] = useState<Set<string>>(new Set(["A"]));
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set());

  function toggleBusinessUnit(bu: string) {
    setOpenBusinessUnits((prev) => {
      const next = new Set(prev);
      if (next.has(bu)) next.delete(bu); else next.add(bu);
      return next;
    });
  }

  function toggleBoard(b: string) {
    setOpenBoards((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  }

  function toggleCode(code: string) {
    setOpenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  const byBusinessUnit = new Map<string, KnowledgeDetail[]>();

  for (const e of entries) {
    const bu = e.business_unit || UNKNOWN_BU;
    const list = byBusinessUnit.get(bu) ?? [];
    list.push(e);
    byBusinessUnit.set(bu, list);
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {Array.from(byBusinessUnit.entries()).map(([businessUnit, buEntries]) => {
        const buOpen = openBusinessUnits.has(businessUnit) || openBusinessUnits.size === 0;
        return (
          <div key={businessUnit}>
            <div
              className="flex items-center gap-1 py-1 hover:bg-white group select-none cursor-pointer"
              style={{ paddingLeft: "8px", paddingRight: "8px" }}
              onClick={() => toggleBusinessUnit(businessUnit)}
            >
              <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{buOpen ? "▾" : "▸"}</span>
              <span className="mr-1 flex-shrink-0"><ThemedFolderIcon size={12} /></span>
              <span className="flex-1 text-[10px] font-bold truncate">{businessUnit}</span>
              <span className="text-[8px] text-gray-400 flex-shrink-0">{buEntries.length}</span>
            </div>

            {buOpen && BOARD_ORDER.map((board) => {
              const boardEntries = buEntries.filter((entry) => entry.taxonomy_board === board);
              const grouped = groupByPrefix(boardEntries);
              const boardKey = `${businessUnit}:${board}`;
              const isOpen = openBoards.has(boardKey);
              return (
                <div key={boardKey}>
                  <div
                    className="flex items-center gap-1 py-1 hover:bg-white group select-none cursor-pointer"
                    style={{ paddingLeft: "24px", paddingRight: "8px" }}
                    onClick={() => toggleBoard(boardKey)}
                  >
                    <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{isOpen ? "▾" : "▸"}</span>
                    <span className="mr-1 flex-shrink-0"><ThemedFolderIcon size={12} /></span>
                    <span className="flex-1 text-[10px] font-bold truncate">{BOARD_LABELS[board]}</span>
                    <span className="text-[8px] text-gray-400 flex-shrink-0">{boardEntries.length}</span>
                  </div>
                  {isOpen && (
                    <>
                      {grouped.size === 0 && (
                        <div className="text-[9px] text-gray-400 px-8 py-1">暂无文件</div>
                      )}
                      {Array.from(grouped.entries()).map(([prefix, group]) => {
                        const codeKey = `${businessUnit}:${board}:${prefix}`;
                        const isCodeOpen = openCodes.has(codeKey);
                        return (
                          <div key={codeKey}>
                            <div
                              className="flex items-center gap-1 py-1 hover:bg-white select-none cursor-pointer"
                              style={{ paddingLeft: "40px", paddingRight: "8px" }}
                              onClick={() => toggleCode(codeKey)}
                            >
                              <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{isCodeOpen ? "▾" : "▸"}</span>
                              <span className="flex-1 text-[9px] font-bold truncate text-gray-600">{group.label}</span>
                              <span className="text-[8px] text-gray-400 flex-shrink-0">{group.entries.length}</span>
                            </div>
                            {isCodeOpen && group.entries.map((e) => {
                              const ext = e.file_ext || (e.source_file?.includes(".") ? `.${e.source_file.split(".").pop()}` : "");
                              const extLabel = ext.replace(/^\./, "").toUpperCase() || "TXT";
                              const isSelected = selectedEntry?.id === e.id;
                              return (
                                <div
                                  key={e.id}
                                  onClick={() => onSelectEntry(e)}
                                  className={`flex items-center gap-2 py-1.5 select-none border-b border-gray-100 cursor-pointer transition-colors ${
                                    isSelected ? "bg-[#CCF2FF]" : "hover:bg-white"
                                  }`}
                                  style={{ paddingLeft: "60px", paddingRight: "8px" }}
                                >
                                  <FileTypeIcon ext={ext} size={14} />
                                  <span className="flex-1 text-xs truncate">{e.title || e.source_file}</span>
                                  <span className={`text-[7px] font-bold px-1 border flex-shrink-0 ${
                                    e.status === "approved" ? "border-green-400 text-green-600" :
                                    e.status === "pending" ? "border-yellow-400 text-yellow-600" :
                                    "border-gray-300 text-gray-400"
                                  }`}>{extLabel}</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}

            {buOpen && (() => {
              const unclassified = buEntries.filter((entry) => !entry.taxonomy_board);
              const key = `${businessUnit}:__unclassified__`;
              const isOpen = openBoards.has(key);
              return (
                <div>
                  <div
                    className="flex items-center gap-1 py-1 hover:bg-white group select-none cursor-pointer"
                    style={{ paddingLeft: "24px", paddingRight: "8px" }}
                    onClick={() => toggleBoard(key)}
                  >
                    <span className="text-[10px] w-4 text-gray-400 flex-shrink-0 text-center">{isOpen ? "▾" : "▸"}</span>
                    <span className="mr-1 flex-shrink-0"><ThemedFolderIcon size={12} /></span>
                    <span className="flex-1 text-[10px] font-bold truncate text-gray-400">未分类</span>
                    <span className="text-[8px] text-gray-400 flex-shrink-0">{unclassified.length}</span>
                  </div>
                  {isOpen && unclassified.map((e) => {
                    const ext = e.file_ext || (e.source_file?.includes(".") ? `.${e.source_file.split(".").pop()}` : "");
                    const extLabel = ext.replace(/^\./, "").toUpperCase() || "TXT";
                    const isSelected = selectedEntry?.id === e.id;
                    return (
                      <div
                        key={e.id}
                        onClick={() => onSelectEntry(e)}
                        className={`flex items-center gap-2 py-1.5 select-none border-b border-gray-100 cursor-pointer transition-colors ${
                          isSelected ? "bg-[#CCF2FF]" : "hover:bg-white"
                        }`}
                        style={{ paddingLeft: "44px", paddingRight: "8px" }}
                      >
                        <FileTypeIcon ext={ext} size={14} />
                        <span className="flex-1 text-xs truncate">{e.title || e.source_file}</span>
                        <span className={`text-[7px] font-bold px-1 border flex-shrink-0 ${
                          e.status === "approved" ? "border-green-400 text-green-600" :
                          e.status === "pending" ? "border-yellow-400 text-yellow-600" :
                          "border-gray-300 text-gray-400"
                        }`}>{extLabel}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
