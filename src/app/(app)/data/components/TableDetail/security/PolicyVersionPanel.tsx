"use client";

import React, { useState, useEffect } from "react";
import { fetchPolicyVersions } from "../../shared/api";
import { apiFetch } from "@/lib/api";
import type { PolicyVersion, TablePermissionPolicy } from "../../shared/types";

interface Props {
  policies: TablePermissionPolicy[];
  onRefresh: () => void;
}

export default function PolicyVersionPanel({ policies, onRefresh }: Props) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<number | null>(policies[0]?.id ?? null);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [diffPair, setDiffPair] = useState<[number, number] | null>(null);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (!selectedPolicyId) return;
    setLoading(true);
    fetchPolicyVersions(selectedPolicyId)
      .then(setVersions)
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [selectedPolicyId]);

  async function handleRollback(versionId: number) {
    if (!confirm("确认回滚到此版本？此操作将覆盖当前策略配置。")) return;
    setRolling(true);
    try {
      await apiFetch(`/data-assets/policies/${selectedPolicyId}/rollback`, {
        method: "POST",
        body: JSON.stringify({ target_version_id: versionId }),
      });
      onRefresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "回滚失败");
    } finally {
      setRolling(false);
    }
  }

  if (policies.length === 0) {
    return (
      <div className="border-2 border-[#1A202C] p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-2">策略版本历史</div>
        <div className="text-[8px] text-gray-400">暂无策略记录</div>
      </div>
    );
  }

  return (
    <div className="border-2 border-[#1A202C] p-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">策略版本历史</div>
        {policies.length > 1 && (
          <select
            value={selectedPolicyId ?? ""}
            onChange={(e) => setSelectedPolicyId(Number(e.target.value))}
            className="text-[8px] border border-gray-300 rounded px-1 py-0.5"
          >
            {policies.map((p) => (
              <option key={p.id} value={p.id}>策略 #{p.id}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-[9px] text-gray-400 animate-pulse">加载中...</div>
      ) : versions.length === 0 ? (
        <div className="text-[8px] text-gray-400">暂无版本记录</div>
      ) : (
        <div className="space-y-0">
          {versions.map((v, i) => {
            const isLatest = i === 0;
            const showDiff = diffPair && diffPair[0] === v.id;
            const prevVersion = i < versions.length - 1 ? versions[i + 1] : null;

            return (
              <div key={v.id} className="relative pl-4 pb-3 border-l-2 border-gray-200 last:border-transparent">
                {/* 时间线圆点 */}
                <div className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${isLatest ? "bg-[#00D1FF]" : "bg-gray-300"}`} />

                <div className="flex items-center gap-2 text-[9px]">
                  <span className="font-bold">v{v.version}</span>
                  {isLatest && <span className="text-[7px] font-bold px-1 py-px bg-[#F0FBFF] text-[#00A3C4] rounded">当前</span>}
                  <span className="text-gray-400">
                    {new Date(v.created_at).toLocaleString("zh-CN")}
                  </span>
                  {v.changed_by_name && <span className="text-gray-400">by {v.changed_by_name}</span>}
                </div>

                {v.change_reason && (
                  <div className="text-[8px] text-gray-500 mt-0.5">{v.change_reason}</div>
                )}

                <div className="flex items-center gap-1 mt-1">
                  {prevVersion && (
                    <button
                      onClick={() => setDiffPair(showDiff ? null : [v.id, prevVersion.id])}
                      className="text-[7px] text-[#00A3C4] hover:underline"
                    >
                      {showDiff ? "收起对比" : "对比上一版"}
                    </button>
                  )}
                  {!isLatest && (
                    <button
                      onClick={() => handleRollback(v.id)}
                      disabled={rolling}
                      className="text-[7px] text-orange-500 hover:underline ml-1"
                    >
                      回滚到此版本
                    </button>
                  )}
                </div>

                {/* Diff 视图 */}
                {showDiff && prevVersion && (
                  <PolicyDiff current={v.snapshot} previous={prevVersion.snapshot} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PolicyDiff({ current, previous }: { current: TablePermissionPolicy; previous: TablePermissionPolicy }) {
  const fields = ["row_access_mode", "field_access_mode", "disclosure_level", "export_permission", "tool_permission_mode"] as const;
  const labels: Record<string, string> = {
    row_access_mode: "行访问",
    field_access_mode: "字段访问",
    disclosure_level: "披露等级",
    export_permission: "导出权限",
    tool_permission_mode: "工具权限",
  };

  const changes = fields.filter((f) => JSON.stringify(current[f]) !== JSON.stringify(previous[f]));

  if (changes.length === 0) {
    return <div className="text-[8px] text-gray-400 mt-1 ml-2">无差异</div>;
  }

  return (
    <div className="mt-1 ml-2 border border-gray-200 rounded p-2 text-[8px]">
      {changes.map((f) => (
        <div key={f} className="flex items-center gap-2 py-0.5">
          <span className="text-gray-400 w-16">{labels[f]}</span>
          <span className="text-red-400 line-through">{String(previous[f])}</span>
          <span className="text-gray-300">→</span>
          <span className="text-green-500 font-bold">{String(current[f])}</span>
        </div>
      ))}
    </div>
  );
}
