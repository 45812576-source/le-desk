"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { apiFetch } from "@/lib/api";

const RESTRICTED_MODEL_KEYS = ["lemondata/gpt-5.4"];
const MODEL_LABELS: Record<string, string> = {
  "lemondata/gpt-5.4": "GPT-5.4 (LemonData)",
};

interface Grant {
  id: number;
  user_id: number;
  display_name: string;
  model_key: string;
  granted_by: number | null;
  granted_at: string | null;
}

interface User {
  id: number;
  display_name: string;
  username: string;
}

export default function ModelGrantsPage() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<number | "">("");
  const [selectedModel, setSelectedModel] = useState(RESTRICTED_MODEL_KEYS[0]);
  const [saving, setSaving] = useState(false);

  const fetchGrants = useCallback(() => {
    setLoading(true);
    apiFetch<Grant[]>("/admin/model-grants")
      .then(setGrants)
      .catch(() => setGrants([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchGrants();
    apiFetch<User[]>("/admin/users").then(setUsers).catch(() => {});
  }, [fetchGrants]);

  async function handleGrant() {
    if (!selectedUser || saving) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/model-grants/${selectedUser}?model_key=${encodeURIComponent(selectedModel)}`, {
        method: "POST",
      });
      setSelectedUser("");
      fetchGrants();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(userId: number, modelKey: string) {
    if (!confirm("确认撤销该用户的模型授权？")) return;
    try {
      await apiFetch(`/admin/model-grants/${userId}?model_key=${encodeURIComponent(modelKey)}`, {
        method: "DELETE",
      });
      fetchGrants();
    } catch {
      // ignore
    }
  }

  return (
    <PageShell title="模型授权" icon={ICONS.models}>
      {/* 授权表单 */}
      <div className="bg-white border-2 border-[#1A202C] p-4 mb-6">
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] mb-3">
          新增授权
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value ? Number(e.target.value) : "")}
            className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF] min-w-[180px]"
          >
            <option value="">选择用户</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name} (@{u.username})
              </option>
            ))}
          </select>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="border-2 border-[#1A202C] px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
          >
            {RESTRICTED_MODEL_KEYS.map((k) => (
              <option key={k} value={k}>{MODEL_LABELS[k] ?? k}</option>
            ))}
          </select>
          <PixelButton onClick={handleGrant} disabled={!selectedUser || saving}>
            {saving ? "授权中..." : "授权"}
          </PixelButton>
        </div>
      </div>

      {/* 授权列表 */}
      {loading ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] animate-pulse py-10 text-center">
          Loading...
        </div>
      ) : grants.length === 0 ? (
        <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 py-10 text-center">
          暂无授权记录
        </div>
      ) : (
        <table className="w-full border-2 border-[#1A202C]">
          <thead>
            <tr className="bg-[#EBF4F7]">
              {["用户", "模型", "授权时间", "操作"].map((h) => (
                <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-[#00A3C4] px-3 py-2 border-b-2 border-[#1A202C]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-3 py-2 text-xs font-bold">{g.display_name}</td>
                <td className="px-3 py-2">
                  <PixelBadge color="yellow">{MODEL_LABELS[g.model_key] ?? g.model_key}</PixelBadge>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {g.granted_at ? new Date(g.granted_at).toLocaleString("zh-CN") : "-"}
                </td>
                <td className="px-3 py-2">
                  <PixelButton size="sm" variant="danger" onClick={() => handleRevoke(g.user_id, g.model_key)}>
                    撤销
                  </PixelButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PageShell>
  );
}
