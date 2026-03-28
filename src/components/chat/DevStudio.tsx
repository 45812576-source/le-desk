"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { useTheme } from "@/lib/theme";

// ─── Transfer Table Modal ─────────────────────────────────────────────────────

interface BusinessTableItem {
  id: number;
  table_name: string;
  display_name: string;
}

function TransferTableModal({ onClose }: { onClose: () => void }) {
  const [tables, setTables] = useState<BusinessTableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState("");
  const [format, setFormat] = useState("csv");
  const [filename, setFilename] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [result, setResult] = useState<{ filename: string; rows: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<BusinessTableItem[]>("/business-tables")
      .then((data) => {
        setTables(data);
        if (data.length > 0) setSelectedTable(data[0].table_name);
      })
      .catch(() => setError("加载数据表列表失败"))
      .finally(() => setLoading(false));
  }, []);

  // 自动填充文件名
  useEffect(() => {
    if (selectedTable) setFilename(`${selectedTable}.${format}`);
  }, [selectedTable, format]);

  async function handleTransfer() {
    if (!selectedTable) return;
    setTransferring(true);
    setError("");
    setResult(null);
    try {
      const res = await apiFetch<{ ok: boolean; filename: string; rows: number }>(
        "/dev-studio/transfer-table",
        {
          method: "POST",
          body: JSON.stringify({
            table_name: selectedTable,
            format,
            filename: filename.trim() || undefined,
          }),
        }
      );
      setResult({ filename: res.filename, rows: res.rows });
    } catch (err) {
      setError(err instanceof Error ? err.message : "传输失败");
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] p-6 w-[420px]">
        <div className="text-[10px] font-bold uppercase tracking-widest mb-4 text-[#00A3C4]">
          发送数据表到工作区
        </div>

        {loading ? (
          <div className="text-[9px] text-gray-400 animate-pulse py-4">加载数据表...</div>
        ) : tables.length === 0 ? (
          <div className="text-[9px] text-gray-400 py-4">暂无可用数据表</div>
        ) : (
          <div className="space-y-3">
            {/* 选择表 */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">选择数据表</div>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00A3C4] bg-white"
              >
                {tables.map((t) => (
                  <option key={t.table_name} value={t.table_name}>
                    {t.display_name || t.table_name}
                  </option>
                ))}
              </select>
            </div>

            {/* 格式 */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">导出格式</div>
              <div className="flex gap-2">
                {(["csv", "json", "sql"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 transition-colors ${
                      format === f
                        ? "border-[#00A3C4] bg-[#00A3C4]/10 text-[#00A3C4]"
                        : "border-gray-300 text-gray-500 hover:border-gray-500"
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* 文件名 */}
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                文件名
                <span className="ml-1 normal-case font-normal text-gray-300">（自动生成，可修改）</span>
              </div>
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00A3C4]"
              />
            </div>

            {/* 结果 / 错误 */}
            {result && (
              <div className="border border-[#00CC99] bg-[#F0FFF8] px-3 py-2 text-[9px] text-[#00A87A] font-bold">
                ✓ 已写入工作区：<span className="font-mono">{result.filename}</span>
                <span className="font-normal text-[#00A87A]/70 ml-2">（{result.rows} 行）</span>
              </div>
            )}
            {error && (
              <div className="border border-red-200 bg-red-50 px-3 py-2 text-[9px] text-red-500 font-bold">
                {error}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-5">
          {!result ? (
            <PixelButton
              onClick={handleTransfer}
              disabled={transferring || !selectedTable || loading}
            >
              {transferring ? "传输中..." : "发送到工作区"}
            </PixelButton>
          ) : (
            <PixelButton onClick={handleTransfer} disabled={transferring}>
              {transferring ? "传输中..." : "再次发送"}
            </PixelButton>
          )}
          <PixelButton variant="secondary" onClick={onClose}>
            {result ? "关闭" : "取消"}
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─── Save Modal ────────────────────────────────────────────────────────────────

type SaveMode = "tool" | "skill" | "webapp";

interface LatestFile {
  path: string;
  filename: string;
  content: string;
  tool: string;
  session_title: string;
}

function DirPicker({
  nodes,
  selected,
  onSelect,
  depth = 0,
}: {
  nodes: TreeNode[];
  selected: TreeNode | null;
  onSelect: (node: TreeNode) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const dirs = nodes.filter((n) => n.type === "dir");
  if (dirs.length === 0) return null;
  return (
    <div className={depth === 0 ? "border-2 border-[#1A202C] max-h-48 overflow-y-auto" : ""}>
      {dirs.map((d) => {
        const hasSubDirs = d.children?.some((c) => c.type === "dir");
        const isOpen = open[d.path];
        return (
          <div key={d.path}>
            <div
              className={`flex items-center gap-1 py-1 cursor-pointer transition-colors ${
                selected?.path === d.path ? "bg-[#00A3C4]/10" : "hover:bg-gray-50"
              }`}
              style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: "8px" }}
            >
              <button
                type="button"
                className="w-3 text-[9px] text-gray-400 flex-shrink-0"
                onClick={() => setOpen((o) => ({ ...o, [d.path]: !o[d.path] }))}
              >
                {hasSubDirs ? (isOpen ? "▾" : "▸") : " "}
              </button>
              <button
                type="button"
                className={`flex-1 text-left text-[9px] font-mono font-bold ${
                  selected?.path === d.path ? "text-[#00A3C4]" : "text-[#1A202C]"
                }`}
                onClick={() => onSelect(d)}
              >
                📁 {d.name}
              </button>
            </div>
            {isOpen && hasSubDirs && d.children && (
              <DirPicker nodes={d.children} selected={selected} onSelect={onSelect} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SaveModal({
  mode,
  onSave,
  onCancel,
}: {
  mode: SaveMode;
  onSave: (data: { name: string; shareUrl?: string; previewUrl?: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [latestFiles, setLatestFiles] = useState<LatestFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [htmlContent, setHtmlContent] = useState("");

  // webapp 专用：workdir 文件夹选择 + 分析状态
  const [workdirBase, setWorkdirBase] = useState("");
  const [workdirDirs, setWorkdirDirs] = useState<TreeNode[]>([]);
  const [selectedDir, setSelectedDir] = useState<TreeNode | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // webapp 模式：加载 workdir 目录树，只取顶层文件夹
  useEffect(() => {
    if (mode !== "webapp") return;
    setLoadingFiles(true);
    apiFetch<{ workdir: string; tree: TreeNode[] }>("/dev-studio/workdir/tree")
      .then((res) => {
        setWorkdirBase(res.workdir);
        const dirs = res.tree.filter((n) => n.type === "dir");
        setWorkdirDirs(dirs);
        if (dirs.length > 0) {
          setSelectedDir(dirs[0]);
          setName(dirs[0].name);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFiles(false));
  }, [mode]);

  // 加载最近产出文件（tool/skill 模式）
  useEffect(() => {
    if (mode === "webapp") { setLoadingFiles(false); return; }
    setLoadingFiles(true);
    apiFetch<LatestFile[]>("/dev-studio/latest-output?limit=10")
      .then((files) => {
        setLatestFiles(files);
        if (files.length > 0) {
          setSelectedFile(files[0].path);
          const f = files[0];
          const baseName = f.filename.replace(/\.[^.]+$/, "");
          setName(baseName);
          if (mode === "skill") {
            setSystemPrompt(f.content);
          } else {
            setDisplayName(baseName);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFiles(false));
  }, [mode]);

  function handleFileSelect(path: string) {
    setSelectedFile(path);
    const f = latestFiles.find((x) => x.path === path);
    if (!f) return;
    const baseName = f.filename.replace(/\.[^.]+$/, "");
    setName(baseName);
    if (mode === "skill") {
      setSystemPrompt(f.content);
    } else {
      setDisplayName(baseName);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "webapp") {
      if (!selectedDir) { setError("请选择一个项目文件夹"); return; }
      const fullPath = `${workdirBase}/${selectedDir.path}`;
      setAnalyzing(true);
      setError("");
      try {
        const res = await apiFetch<{ id: number; name: string; share_url: string; preview_url: string }>(
          "/dev-studio/analyze-project",
          {
            method: "POST",
            body: JSON.stringify({
              project_path: fullPath,
              name: name.trim(),
              description: description.trim(),
            }),
          }
        );
        onSave({ name: res.name, shareUrl: res.share_url, previewUrl: res.preview_url });
      } catch (err) {
        setError(err instanceof Error ? err.message : "分析失败");
      } finally {
        setAnalyzing(false);
      }
      return;
    }
    if (!name.trim()) { setError("名称不能为空"); return; }
    if (mode === "skill" && !systemPrompt.trim()) { setError("System Prompt 不能为空"); return; }
    setSaving(true);
    setError("");
    try {
      if (mode === "tool") {
        await apiFetch("/dev-studio/save-tool", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            display_name: displayName.trim() || name.trim(),
            description: description.trim(),
            tool_type: "http",
            input_schema: {},
            output_format: "text",
            config: {},
          }),
        });
        onSave({ name: name.trim() });
      } else if (mode === "skill") {
        await apiFetch("/dev-studio/save-skill", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            system_prompt: systemPrompt.trim(),
          }),
        });
        onSave({ name: name.trim() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] p-6 w-[480px] max-h-[85vh] overflow-y-auto">
        <div className={`text-[10px] font-bold uppercase tracking-widest mb-4 ${
          mode === "webapp" ? "text-[#00A3C4]" : "text-[#6B46C1]"
        }`}>
          保存为 {mode === "tool" ? "Tool" : mode === "skill" ? "Skill" : "Web App"}
        </div>

        {/* tool/skill：最近产出文件选择 */}
        {mode !== "webapp" && (
          <div className="mb-4 border-2 p-3 border-[#E9D8FD] bg-[#FAF5FF]">
            <div className="text-[9px] font-bold uppercase tracking-widest mb-2 text-[#6B46C1]">
              从最近写入文件中选择（自动预填）
            </div>
            {loadingFiles ? (
              <div className="text-[9px] text-gray-400 animate-pulse">读取中...</div>
            ) : latestFiles.length === 0 ? (
              <div className="text-[9px] text-gray-400">暂无最近写入文件，请手动填写</div>
            ) : (
              <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                {latestFiles.map((f) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => handleFileSelect(f.path)}
                    className={`text-left px-2 py-1.5 text-[9px] font-mono border transition-colors ${
                      selectedFile === f.path
                        ? "border-[#6B46C1] bg-[#6B46C1]/10 text-[#6B46C1] font-bold"
                        : "border-gray-200 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    <span className="font-bold">{f.filename}</span>
                    {f.session_title && (
                      <span className="text-gray-400 ml-2">· {f.session_title}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* webapp：工作区文件夹选择 */}
          {mode === "webapp" && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                选择项目文件夹
              </div>
              {loadingFiles ? (
                <div className="text-[9px] text-gray-400 animate-pulse">加载工作区...</div>
              ) : workdirDirs.length === 0 ? (
                <div className="text-[9px] text-gray-400 border-2 border-dashed border-gray-200 px-3 py-3">
                  工作区暂无文件夹，请先在文件管理里创建项目目录
                </div>
              ) : (
                <DirPicker
                  nodes={workdirDirs}
                  selected={selectedDir}
                  onSelect={(d) => { setSelectedDir(d); setName(d.name); }}
                />
              )}
            </div>
          )}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              {mode === "tool" ? "Tool 名称（英文）" : mode === "skill" ? "Skill 名称" : "应用名称（可选，默认取文件夹名）"}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={mode === "tool" ? "my_tool_name" : mode === "skill" ? "Skill 名称" : "我的小程序"}
              className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00A3C4]"
            />
          </div>
          {mode === "tool" && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">显示名称（中文可）</div>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="我的工具"
                className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#6B46C1]"
              />
            </div>
          )}
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">描述（可选）</div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={mode === "webapp" ? "这个小程序的功能说明" : "这个工具 / Skill 的用途"}
              className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00A3C4]"
            />
          </div>
          {mode === "skill" && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">System Prompt</div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                placeholder="粘贴由 AI 生成的 System Prompt 内容..."
                className="w-full border-2 border-[#1A202C] px-3 py-2 text-[10px] font-mono resize-y focus:outline-none focus:border-[#6B46C1]"
              />
            </div>
          )}
          {error && (
            <div className="text-[9px] text-red-500 font-bold border border-red-200 bg-red-50 px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <PixelButton type="submit" disabled={saving || analyzing}>
              {mode === "webapp"
                ? analyzing ? "发布中..." : "检查并发布"
                : saving ? "保存中..." : "保存"}
            </PixelButton>
            <PixelButton variant="secondary" onClick={onCancel} type="button">
              取消
            </PixelButton>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Requirements Banner ──────────────────────────────────────────────────────

interface ProjectHandoff {
  project_type: string;
  name: string;
  handoff: {
    handoff_status: string;
    requirements: string | null;
    acceptance_criteria: string | null;
    handoff_at: string | null;
  };
}

function RequirementsBanner({ workspaceId }: { workspaceId: number }) {
  const [data, setData] = useState<ProjectHandoff | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    apiFetch<ProjectHandoff | null>(`/projects/by-workspace/${workspaceId}`)
      .then((d) => {
        if (d && d.project_type === "dev" && d.handoff?.handoff_status === "submitted") {
          setData(d);
        }
      })
      .catch(() => {});
  }, [workspaceId]);

  if (!data || !data.handoff.requirements) return null;

  return (
    <div className="flex-shrink-0 border-b-2 border-[#6B46C1] bg-[#6B46C1]/5">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#6B46C1]" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#6B46C1]">
            需求上下文 · {data.name}
          </span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 border border-[#D97706] text-[#D97706]">
            已交接
          </span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[9px] text-[#6B46C1] font-bold hover:text-[#553C9A] transition-colors"
        >
          {collapsed ? "▸ 展开" : "▾ 收起"}
        </button>
      </div>
      {!collapsed && (
        <div className="px-4 pb-3 flex flex-col gap-2 max-h-48 overflow-y-auto">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-[#6B46C1] mb-1">功能需求</div>
            <pre className="text-[9px] text-gray-700 whitespace-pre-wrap leading-relaxed font-sans bg-white border border-[#E9D8FD] px-3 py-2">
              {data.handoff.requirements}
            </pre>
          </div>
          {data.handoff.acceptance_criteria && (
            <div>
              <div className="text-[8px] font-bold uppercase tracking-widest text-[#00CC99] mb-1">验收标准</div>
              <pre className="text-[9px] text-gray-700 whitespace-pre-wrap leading-relaxed font-sans bg-white border border-[#C6F6D5] px-3 py-2">
                {data.handoff.acceptance_criteria}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Workdir File Manager Panel ───────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  children?: TreeNode[];
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function TreeNodeRow({
  node,
  depth,
  onRename,
  onDelete,
  onDownload,
  dragSrc,
  onDragStart,
  onDropFolder,
}: {
  node: TreeNode;
  depth: number;
  onRename: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  onDownload: (node: TreeNode) => void;
  dragSrc: string | null;
  onDragStart: (path: string) => void;
  onDropFolder: (targetFolderPath: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const [dragOver, setDragOver] = useState(false);

  const isDropTarget = node.type === "dir" && dragSrc !== null && dragSrc !== node.path && !dragSrc.startsWith(node.path + "/");

  return (
    <>
      <div
        draggable
        onDragStart={(e) => { e.stopPropagation(); onDragStart(node.path); }}
        onDragEnd={() => setDragOver(false)}
        onDragOver={(e) => { if (!isDropTarget) return; e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!isDropTarget) return;
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          onDropFolder(node.path);
        }}
        className={`flex items-center gap-1 py-[3px] group cursor-grab active:cursor-grabbing transition-colors ${
          dragOver ? "bg-[#CCF2FF] border-l-2 border-[#00A3C4]" : "hover:bg-gray-50"
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: "8px" }}
      >
        {node.type === "dir" ? (
          <button onClick={() => setOpen(!open)} className="text-[9px] text-gray-400 w-3 flex-shrink-0">
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-3 flex-shrink-0 text-[9px] text-gray-300">·</span>
        )}
        <span className={`flex-1 text-[9px] font-mono truncate ${node.type === "dir" ? "font-bold text-[#1A202C]" : "text-gray-700"}`}>
          {node.name}
        </span>
        {node.type === "file" && node.size !== undefined && (
          <span className="text-[8px] text-gray-300 mr-1">{formatSize(node.size)}</span>
        )}
        <div className="hidden group-hover:flex items-center gap-1">
          {node.type === "file" && (
            <button onClick={() => onDownload(node)} className="text-[8px] text-gray-400 hover:text-[#00CC99] px-1" title="下载到本地">下</button>
          )}
          <button onClick={() => onRename(node)} className="text-[8px] text-gray-400 hover:text-[#00A3C4] px-1" title="重命名/移动">改</button>
          <button onClick={() => onDelete(node)} className="text-[8px] text-gray-400 hover:text-red-400 px-1" title="删除">删</button>
        </div>
      </div>
      {node.type === "dir" && open && node.children?.map((child) => (
        <TreeNodeRow key={child.path} node={child} depth={depth + 1}
          onRename={onRename} onDelete={onDelete} onDownload={onDownload}
          dragSrc={dragSrc} onDragStart={onDragStart} onDropFolder={onDropFolder}
        />
      ))}
    </>
  );
}

function WorkdirPanel({ onClose, onWorkdirChange }: { onClose: () => void; onWorkdirChange?: () => void }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mkdirPath, setMkdirPath] = useState("");
  const [mkdirBusy, setMkdirBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<TreeNode | null>(null);
  const [renameDst, setRenameDst] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [dragSrc, setDragSrc] = useState<string | null>(null);

  function loadTree() {
    setLoading(true);
    setError("");
    apiFetch<{ tree: TreeNode[] }>("/dev-studio/workdir/tree")
      .then((res) => setTree(res.tree))
      .catch(() => setError("加载失败"))
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadTree(); }, []);

  async function handleMkdir() {
    if (!mkdirPath.trim()) return;
    setMkdirBusy(true);
    try {
      await apiFetch("/dev-studio/workdir/mkdir", { method: "POST", body: JSON.stringify({ path: mkdirPath.trim() }) });
      setMkdirPath("");
      loadTree();
      onWorkdirChange?.();
    } catch (err) { setError(err instanceof Error ? err.message : "创建失败"); }
    finally { setMkdirBusy(false); }
  }

  async function handleRename() {
    if (!renameTarget || !renameDst.trim()) return;
    setRenameBusy(true);
    try {
      await apiFetch("/dev-studio/workdir/rename", { method: "POST", body: JSON.stringify({ src: renameTarget.path, dst: renameDst.trim() }) });
      setRenameTarget(null);
      loadTree();
      onWorkdirChange?.();
    } catch (err) { setError(err instanceof Error ? err.message : "重命名失败"); }
    finally { setRenameBusy(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await apiFetch("/dev-studio/workdir/delete", { method: "POST", body: JSON.stringify({ path: deleteTarget.path }) });
      setDeleteTarget(null);
      loadTree();
      onWorkdirChange?.();
    } catch (err) { setError(err instanceof Error ? err.message : "删除失败"); }
    finally { setDeleteBusy(false); }
  }

  function handleDownload(node: TreeNode) {
    const token = localStorage.getItem("token") ?? "";
    const url = `/api/proxy/dev-studio/workdir/download?path=${encodeURIComponent(node.path)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = node.name;
    // 通过 fetch + blob 携带认证 header，触发浏览器下载
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => {
        if (!res.ok) throw new Error("下载失败");
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => setError(`下载失败：${node.name}`));
  }

  async function handleDropToFolder(targetFolderPath: string) {
    if (!dragSrc) return;
    const filename = dragSrc.split("/").pop()!;
    const dst = `${targetFolderPath}/${filename}`;
    setDragSrc(null);
    try {
      await apiFetch("/dev-studio/workdir/rename", { method: "POST", body: JSON.stringify({ src: dragSrc, dst }) });
      loadTree();
      onWorkdirChange?.();
    } catch (err) { setError(err instanceof Error ? err.message : "移动失败"); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] w-[480px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-[#1A202C] flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#6B46C1]">工作区文件管理</span>
          <button onClick={onClose} className="text-[9px] text-gray-400 hover:text-gray-700 font-bold">✕ 关闭</button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 py-1">
          {loading ? (
            <div className="text-[9px] text-gray-400 animate-pulse px-4 py-4">加载中...</div>
          ) : tree.length === 0 ? (
            <div className="text-[9px] text-gray-400 px-4 py-4">工作区暂无文件</div>
          ) : (
            tree.map((node) => (
              <TreeNodeRow key={node.path} node={node} depth={0}
                onRename={(n) => { setRenameTarget(n); setRenameDst(n.path); }}
                onDelete={(n) => setDeleteTarget(n)}
                onDownload={handleDownload}
                dragSrc={dragSrc}
                onDragStart={setDragSrc}
                onDropFolder={handleDropToFolder}
              />
            ))
          )}
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 px-3 py-2 flex gap-2 items-center">
          <input
            value={mkdirPath}
            onChange={(e) => setMkdirPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleMkdir()}
            placeholder="新建文件夹，如 seed_data/v2"
            className="flex-1 border border-gray-300 px-2 py-1 text-[9px] font-mono focus:outline-none focus:border-[#6B46C1]"
          />
          <button onClick={handleMkdir} disabled={mkdirBusy || !mkdirPath.trim()}
            className="px-3 py-1 text-[9px] font-bold border-2 border-[#6B46C1] text-[#6B46C1] hover:bg-[#E9D8FD] disabled:opacity-40">
            {mkdirBusy ? "..." : "新建"}
          </button>
          <button onClick={loadTree} className="px-2 py-1 text-[9px] text-gray-400 hover:text-gray-700 border border-gray-200" title="刷新">↺</button>
        </div>

        {error && <div className="flex-shrink-0 px-3 pb-2 text-[9px] text-red-500 font-bold">{error}</div>}
      </div>

      {/* Rename dialog */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white border-2 border-[#1A202C] p-5 w-[380px]">
            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-3">
              重命名 / 移动：<span className="font-mono text-[#1A202C]">{renameTarget.path}</span>
            </div>
            <input value={renameDst} onChange={(e) => setRenameDst(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="w-full border-2 border-[#1A202C] px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-[#6B46C1] mb-3"
            />
            <div className="flex gap-2">
              <PixelButton onClick={handleRename} disabled={renameBusy || !renameDst.trim()}>
                {renameBusy ? "..." : "确认"}
              </PixelButton>
              <PixelButton variant="secondary" onClick={() => setRenameTarget(null)}>取消</PixelButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white border-2 border-[#1A202C] p-5 w-[360px]">
            <div className="text-[10px] font-bold text-[#1A202C] mb-2">确认删除？</div>
            <div className="text-[9px] font-mono text-gray-500 mb-4 break-all">{deleteTarget.path}</div>
            {deleteTarget.type === "dir" && (
              <div className="text-[9px] text-red-500 font-bold mb-3">⚠ 文件夹及其所有内容将被永久删除</div>
            )}
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleteBusy}
                className="px-4 py-1.5 text-[9px] font-bold border-2 border-red-400 text-red-500 hover:bg-red-50 disabled:opacity-40">
                {deleteBusy ? "删除中..." : "删除"}
              </button>
              <PixelButton variant="secondary" onClick={() => setDeleteTarget(null)}>取消</PixelButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upload Target Picker Modal ───────────────────────────────────────────────

function UploadTargetModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (targetPath: string) => void;
  onCancel: () => void;
}) {
  const [dirs, setDirs] = useState<TreeNode[]>([]);
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ tree: TreeNode[] }>("/dev-studio/workdir/tree")
      .then((res) => {
        setDirs(res.tree.filter((n) => n.type === "dir"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-[#1A202C] p-5 w-[400px]">
        <div className="text-[10px] font-bold uppercase tracking-widest mb-3 text-[#D97706]">
          选择上传目标文件夹
        </div>
        <div className="text-[9px] text-gray-400 mb-3">
          不选则上传到工作区根目录
        </div>
        {loading ? (
          <div className="text-[9px] text-gray-400 animate-pulse py-4">加载中...</div>
        ) : dirs.length === 0 ? (
          <div className="text-[9px] text-gray-400 border border-dashed border-gray-200 px-3 py-3 mb-3">
            工作区暂无子文件夹，将上传到根目录
          </div>
        ) : (
          <div className="mb-3">
            {/* 根目录选项 */}
            <div
              className={`flex items-center gap-2 py-1.5 px-2 cursor-pointer transition-colors ${
                selected === null ? "bg-[#FFF7ED] border-l-2 border-[#D97706]" : "hover:bg-gray-50"
              }`}
              onClick={() => setSelected(null)}
            >
              <span className="text-[9px] font-mono font-bold text-gray-500">/ 根目录</span>
            </div>
            <DirPicker nodes={dirs} selected={selected} onSelect={setSelected} />
          </div>
        )}
        {selected && (
          <div className="text-[9px] font-mono text-[#D97706] font-bold mb-3 bg-[#FFFBEB] border border-[#FCD34D] px-2 py-1.5">
            → {selected.path}
          </div>
        )}
        <div className="flex gap-2">
          <PixelButton onClick={() => onConfirm(selected?.path ?? "")}>
            确认
          </PixelButton>
          <PixelButton variant="secondary" onClick={onCancel}>
            取消
          </PixelButton>
        </div>
      </div>
    </div>
  );
}

// ─── Dev Studio ───────────────────────────────────────────────────────────────

// 受限模型 key 常量
const RESTRICTED_MODELS = ["lemondata/gpt-5.4"];

type Status = "loading" | "ready" | "error";

export function DevStudio({ convId: _convId, workspaceId }: { convId: number; workspaceId?: number }) {
  const { theme } = useTheme();
  const [status, setStatus] = useState<Status>("loading");
  const [opencodeUrl, setOpencodeUrl] = useState<string | null>(null);
  const [instanceKey, setInstanceKey] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [saveMode, setSaveMode] = useState<SaveMode | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveShareUrl, setSaveShareUrl] = useState<string | null>(null);
  const [savePreviewUrl, setSavePreviewUrl] = useState<string | null>(null);
  const [webApps, setWebApps] = useState<{ id: number; name: string; preview_url: string; share_url: string | null; created_at: string }[]>([]);
  const [showWebApps, setShowWebApps] = useState(false);
  const [grantedModels, setGrantedModels] = useState<string[]>([]);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showWorkdir, setShowWorkdir] = useState(false);
  const [showUploadPicker, setShowUploadPicker] = useState(false);
  const [uploadTargetPath, setUploadTargetPath] = useState("");
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 拉取当前用户的受限模型授权
  useEffect(() => {
    apiFetch<{ model_keys: string[] }>("/auth/model-grants")
      .then((data) => setGrantedModels(data.model_keys))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setStatus("loading");
      setErrorMsg(null);
      try {
        const info = await apiFetch<{ url: string; port: number }>("/dev-studio/instance");
        if (!cancelled) {
          // 把端口写入 cookie（备用），并直接编码进代理 URL（主用）
          document.cookie = `oc_port=${info.port}; path=/; SameSite=Lax`;
          // _oc_port 直接放进 URL，代理层优先读 query 参数，不依赖 cookie
          setOpencodeUrl(`/api/opencode?_oc_port=${info.port}`);
          setInstanceKey(Date.now());
          setStatus("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "连接失败");
          setStatus("error");
        }
      }
    }

    connect();
    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  function handleRetry() {
    setStatus("loading");
    setErrorMsg(null);
    apiFetch<{ url: string; port: number }>("/dev-studio/instance")
      .then((info) => {
        document.cookie = `oc_port=${info.port}; path=/; SameSite=Lax`;
        setOpencodeUrl(`/api/opencode?_oc_port=${info.port}`);
        setInstanceKey(Date.now());
        setStatus("ready");
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "连接失败");
        setStatus("error");
      });
  }

  async function handleRestart() {
    setRestarting(true);
    setStatus("loading");
    try {
      const info = await apiFetch<{ port: number }>("/dev-studio/restart", { method: "POST" });
      document.cookie = `oc_port=${info.port}; path=/; SameSite=Lax`;
      setOpencodeUrl(`/api/opencode?_oc_port=${info.port}`);
      setInstanceKey(Date.now());
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "重启失败");
      setStatus("error");
    } finally {
      setRestarting(false);
    }
  }

  async function fetchWebApps() {
    try {
      const data = await apiFetch<{ id: number; name: string; preview_url: string; share_url: string | null; created_at: string }[]>("/web-apps");
      setWebApps(data);
    } catch {}
  }

  function handleSaveSuccess(data: { name: string; shareUrl?: string; previewUrl?: string }) {
    setSaveMode(null);
    setSaveSuccess(`已发布：${data.name}`);
    setSaveShareUrl(data.shareUrl ?? null);
    setSavePreviewUrl(data.previewUrl ?? null);
    setShowWebApps(true);
    fetchWebApps();
    setTimeout(() => { setSaveSuccess(null); setSaveShareUrl(null); setSavePreviewUrl(null); }, 5000);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadMsg("上传中...");
    const results: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      if (uploadTargetPath) formData.append("target_path", uploadTargetPath);
      try {
        await apiFetch("/dev-studio/upload-file", { method: "POST", body: formData });
        const dest = uploadTargetPath ? `${uploadTargetPath}/${file.name}` : file.name;
        results.push(`✓ ${dest}`);
      } catch (err) {
        results.push(`✗ ${file.name}：${err instanceof Error ? err.message : "失败"}`);
      }
    }
    setUploadMsg(results.join("　"));
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadTargetPath("");
    // 上传完成后刷新 opencode iframe，让文件树显示新文件
    setInstanceKey(Date.now());
    setTimeout(() => setUploadMsg(null), 8000);
  }

  const statusBadge = {
    loading: { color: "yellow" as const, label: "连接中..." },
    ready:   { color: "green" as const,  label: "运行中" },
    error:   { color: "red" as const,    label: "错误" },
  }[status];

  return (
    <div className="h-full flex flex-col bg-[#F0F4F8]">
      {/* Requirements Banner (dev project context) */}
      {workspaceId && <RequirementsBanner workspaceId={workspaceId} />}

      {/* Header */}
      <div className="flex-shrink-0 border-b-2 border-[#1A202C] bg-white px-4 h-11 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#6B46C1]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#1A202C]">
            工具开发 Studio
          </span>
          <PixelBadge color={statusBadge.color}>{statusBadge.label}</PixelBadge>
          {status === "ready" && (
            <span className="text-[9px] text-gray-400 font-mono">百炼 Coding Plan</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "ready" && opencodeUrl && (
            <a
              href={opencodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#1A202C] bg-white text-[#1A202C] hover:bg-[#F0F4F8] transition-colors"
            >
              ↗ 独立窗口
            </a>
          )}
          <button
            onClick={handleRestart}
            disabled={restarting || status === "loading"}
            title="强制重启 OpenCode 进程（卡死时使用）"
            className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#D97706] text-[#D97706] hover:bg-[#FFFBEB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {restarting ? "重启中..." : "↺ 重启"}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 overflow-hidden relative">
        {status === "loading" && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-2 border-[#6B46C1] bg-[#6B46C1]/10 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-[#6B46C1] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B46C1] animate-pulse">
              正在连接 OpenCode...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-10 h-10 border-2 border-red-300 bg-red-50 flex items-center justify-center flex-shrink-0">
              <span className="text-red-400 font-bold text-sm">!</span>
            </div>
            <div className="text-center max-w-sm">
              <p className="text-[11px] font-bold text-red-500 mb-2">工作台服务未启动</p>
              <p className="text-[10px] text-gray-500 leading-relaxed mb-3">
                OpenCode 服务无法连接。请联系管理员检查后端服务是否正常运行。
              </p>
              {errorMsg && (
                <p className="text-[9px] text-gray-400 font-mono bg-gray-100 border border-gray-200 px-3 py-1.5 mb-4 text-left break-all">
                  {errorMsg}
                </p>
              )}
              <button
                onClick={handleRetry}
                className="px-4 py-2 text-[9px] font-bold uppercase tracking-widest border-2 border-[#6B46C1] text-[#6B46C1] hover:bg-[#6B46C1]/10 transition-colors"
              >
                重试连接
              </button>
            </div>
          </div>
        )}

        {status === "ready" && opencodeUrl && (
          <>
            <iframe
              src={`${opencodeUrl}?t=${instanceKey}`}
              className="w-full h-full border-none"
              title="OpenCode Dev Studio"
              allow="clipboard-read; clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
              style={{ colorScheme: theme === "dark" ? "dark" : "light" }}
            />
            {/* 受限模型遮罩：无权用户看到提示，有权用户不显示 */}
            {RESTRICTED_MODELS.some((k) => !grantedModels.includes(k)) && (
              <div className="absolute bottom-0 right-0 m-3 z-10 bg-white border-2 border-[#1A202C] px-4 py-3 max-w-xs shadow-lg">
                <div className="text-[9px] font-bold uppercase tracking-widest text-[#D97706] mb-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#D97706] inline-block" />
                  受限模型
                </div>
                <p className="text-[9px] text-gray-500 leading-relaxed">
                  <span className="font-bold text-[#1A202C]">GPT-5.4</span> 需要管理员授权后才可使用。请联系超级管理员开通权限。
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload result */}
      {uploadMsg && (
        <div className="flex-shrink-0 bg-amber-50 border-t-2 border-[#D97706] px-4 py-2 flex items-center gap-2">
          <span className="text-[9px] text-[#D97706] font-bold font-mono">{uploadMsg}</span>
        </div>
      )}

      {/* Save success */}
      {saveSuccess && (
        <div className="flex-shrink-0 bg-green-50 border-t-2 border-[#00CC99] px-4 py-2 flex items-center gap-2">
          <span className="text-[9px] text-[#00A87A] font-bold">✓ {saveSuccess}</span>
        </div>
      )}

      {/* 已发布版本列表 */}
      {showWebApps && (
        <div className="flex-shrink-0 border-t-2 border-[#00A3C4] bg-[#F0FAFF] max-h-[180px] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-[#B3E8F8]">
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">已发布版本</span>
            <div className="flex gap-2">
              <button
                onClick={fetchWebApps}
                className="text-[9px] text-[#00A3C4] hover:underline"
              >刷新</button>
              <button
                onClick={() => setShowWebApps(false)}
                className="text-[9px] text-gray-400 hover:text-gray-600"
              >收起</button>
            </div>
          </div>
          {webApps.length === 0 ? (
            <div className="px-4 py-3 text-[9px] text-gray-400">暂无发布记录</div>
          ) : (
            webApps.map((app) => (
              <div key={app.id} className="flex items-center justify-between px-4 py-1.5 border-b border-[#E0F4FB] hover:bg-[#E6F7FF]">
                <div>
                  <span className="text-[10px] font-bold text-[#1A202C]">{app.name}</span>
                  <span className="text-[9px] text-gray-400 ml-2">#{app.id}</span>
                  <span className="text-[9px] text-gray-400 ml-2">{app.created_at ? new Date(app.created_at + "Z").toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</span>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/web-app-preview/${app.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-bold text-white bg-[#00A3C4] px-2 py-0.5 hover:bg-[#007A99] transition-colors"
                  >预览</a>
                  {app.share_url && (
                    <a
                      href={app.share_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] font-bold text-white bg-[#6B46C1] px-2 py-0.5 hover:bg-[#553C9A] transition-colors"
                    >分享</a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!showWebApps && (
        <div className="flex-shrink-0 border-t border-[#B3E8F8] px-4 py-1 bg-[#F0FAFF]">
          <button
            onClick={() => { setShowWebApps(true); fetchWebApps(); }}
            className="text-[9px] text-[#00A3C4] hover:underline font-bold uppercase tracking-widest"
          >
            已发布版本 ▾
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex-shrink-0 border-t-2 border-[#1A202C] bg-white px-4 py-2.5 flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mr-2">
          保存产出 →
        </span>
        <button
          onClick={() => setSaveMode("tool")}
          disabled={status !== "ready"}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#00D1FF] text-[#00A3C4] hover:bg-[#CCF2FF] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          保存为 Tool
        </button>
        <button
          onClick={() => setSaveMode("skill")}
          disabled={status !== "ready"}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#00CC99] text-[#00A87A] hover:bg-[#C6F6D5] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          保存为 Skill
        </button>
        <button
          onClick={() => setSaveMode("webapp")}
          disabled={status !== "ready"}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#6B46C1] text-[#6B46C1] hover:bg-[#E9D8FD] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          发布 Web App
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowWorkdir(true)}
          disabled={status !== "ready"}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#6B46C1] text-[#6B46C1] hover:bg-[#E9D8FD] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          管理文件
        </button>
        <button
          onClick={() => setShowTransfer(true)}
          disabled={status !== "ready"}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#D97706] text-[#D97706] hover:bg-[#FFFBEB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ↓ 发送数据表
        </button>
        <button
          onClick={() => setShowUploadPicker(true)}
          disabled={status !== "ready"}
          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest border-2 border-[#D97706] text-[#D97706] hover:bg-[#FFFBEB] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ↑ 上传文件
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {saveMode && (
        <SaveModal
          mode={saveMode}
          onSave={handleSaveSuccess}
          onCancel={() => setSaveMode(null)}
        />
      )}

      {showTransfer && (
        <TransferTableModal onClose={() => setShowTransfer(false)} />
      )}

      {showWorkdir && (
        <WorkdirPanel
          onClose={() => setShowWorkdir(false)}
          onWorkdirChange={() => setInstanceKey(Date.now())}
        />
      )}

      {showUploadPicker && (
        <UploadTargetModal
          onConfirm={(targetPath) => {
            setUploadTargetPath(targetPath);
            setShowUploadPicker(false);
            fileInputRef.current?.click();
          }}
          onCancel={() => setShowUploadPicker(false)}
        />
      )}
    </div>
  );
}
