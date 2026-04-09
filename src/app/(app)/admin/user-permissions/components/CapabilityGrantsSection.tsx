"use client";

import { useCallback, useEffect, useState } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";
import type { UserCapabilityGrant, UserCapabilityKey } from "@/lib/types";
import {
  CAPABILITY_LABELS,
  CAPABILITY_DESCRIPTIONS,
  CAPABILITY_RISK_LEVEL,
  SOURCE_LABELS,
  SOURCE_COLORS,
} from "@/lib/knowledge-permission-constants";
import { SectionHeader } from "./SectionHeader";

const ALL_CAPABILITY_KEYS: UserCapabilityKey[] = [
  "knowledge_asset_admin",
  "knowledge_asset_operator",
  "knowledge_folder_governance_admin",
  "skill_release_reviewer",
  "tool_release_reviewer",
  "data_asset_reviewer",
];

interface CapabilityGrantsSectionProps {
  userId: number;
}

export function CapabilityGrantsSection({ userId }: CapabilityGrantsSectionProps) {
  const [grants, setGrants] = useState<UserCapabilityGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [selectedKey, setSelectedKey] = useState<UserCapabilityKey | "">("");
  const [saving, setSaving] = useState(false);

  const fetchGrants = useCallback(() => {
    setLoading(true);
    apiFetch<UserCapabilityGrant[]>(`/admin/users/${userId}/capabilities`)
      .then(setGrants)
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    fetchGrants();
  }, [fetchGrants]);

  const grantedKeys = new Set(grants.map((g) => g.capability_key));
  const availableKeys = ALL_CAPABILITY_KEYS.filter((k) => !grantedKeys.has(k));

  async function handleGrant() {
    if (!selectedKey) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/users/${userId}/capabilities`, {
        method: "POST",
        body: JSON.stringify({ capability_key: selectedKey }),
      });
      setShowGrant(false);
      setSelectedKey("");
      fetchGrants();
    } catch (e) {
      if (e instanceof Error && e.message.includes("404")) {
        alert("该功能需后端支持，API /admin/users/{id}/capabilities 尚未就绪");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(grantId: number) {
    if (!confirm("确认回收此资格？")) return;
    try {
      await apiFetch(`/admin/users/${userId}/capabilities/${grantId}`, { method: "DELETE" });
      fetchGrants();
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-card border-2 border-border">
      <SectionHeader
        title="④ 资产管理资格等级"
        subtitle="全局能力资格，决定可管理哪类资产 / 审哪类工单"
      />
      <div className="p-4">
        {loading ? (
          <p className="text-[10px] font-bold uppercase text-[#00A3C4] animate-pulse">加载中…</p>
        ) : (
          <>
            {grants.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">暂无资产管理资格</p>
            ) : (
              <table className="w-full border-2 border-border text-xs font-mono mb-4">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-border">
                      资格
                    </th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-border">
                      说明
                    </th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-border w-20">
                      来源
                    </th>
                    <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] border-b-2 border-border w-16">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((g) => (
                    <tr key={g.id} className="border-b border-border hover:bg-muted">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {CAPABILITY_LABELS[g.capability_key] || g.capability_key}
                          </span>
                          {CAPABILITY_RISK_LEVEL[g.capability_key] === "high" && (
                            <PixelBadge color="red">高权限</PixelBadge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {CAPABILITY_DESCRIPTIONS[g.capability_key] || ""}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold ${SOURCE_COLORS[g.source] || ""}`}>
                          {SOURCE_LABELS[g.source] || g.source}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <PixelButton size="sm" variant="danger" onClick={() => handleRevoke(g.id)}>
                          回收
                        </PixelButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showGrant ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value as UserCapabilityKey)}
                  className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground"
                >
                  <option value="">选择资格…</option>
                  {availableKeys.map((k) => (
                    <option key={k} value={k}>{CAPABILITY_LABELS[k]}</option>
                  ))}
                </select>
                <PixelButton size="sm" onClick={handleGrant} disabled={saving || !selectedKey}>
                  {saving ? "保存中…" : "授予"}
                </PixelButton>
                <PixelButton size="sm" variant="ghost" onClick={() => setShowGrant(false)}>取消</PixelButton>
              </div>
            ) : (
              <PixelButton size="sm" variant="secondary" onClick={() => setShowGrant(true)}>
                + 授予资格
              </PixelButton>
            )}
          </>
        )}
      </div>
    </div>
  );
}
