"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";

interface MemberInput {
  user_id: number;
  display_name: string;
  role_desc: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<MemberInput[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<User[]>("/admin/users")
      .then(setAllUsers)
      .catch(() => setAllUsers([]));
  }, []);

  function addMember() {
    if (members.length >= 5) return;
    setMembers((prev) => [...prev, { user_id: 0, display_name: "", role_desc: "" }]);
  }

  function removeMember(idx: number) {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMember(idx: number, field: keyof MemberInput, value: string | number) {
    setMembers((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );
  }

  function selectUser(idx: number, userId: number) {
    const user = allUsers.find((u) => u.id === userId);
    if (user) {
      setMembers((prev) =>
        prev.map((m, i) =>
          i === idx ? { ...m, user_id: userId, display_name: user.display_name } : m
        )
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("请填写项目名称"); return; }
    if (members.some((m) => !m.user_id)) { setError("请为每位成员选择用户"); return; }
    if (members.some((m) => !m.role_desc.trim())) { setError("请填写每位成员的分工描述"); return; }

    setError("");
    setSubmitting(true);
    try {
      const project = await apiFetch<{ id: number }>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          members: members.map((m) => ({ user_id: m.user_id, role_desc: m.role_desc })),
        }),
      });

      // 自动触发生成规划
      setGenerating(true);
      try {
        await apiFetch(`/projects/${project.id}/generate`, { method: "POST" });
        router.push(`/projects/${project.id}/plan`);
      } catch {
        // 即便生成失败也进入详情页
        router.push(`/projects/${project.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
      setGenerating(false);
    }
  }

  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.user_id === u.id)
  );

  return (
    <PageShell title="新建项目" icon={ICONS.project}>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex flex-col gap-6">
        {/* 基本信息 */}
        <div className="border-2 border-[#1A202C] bg-white p-5 flex flex-col gap-4">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] border-b border-[#E2E8F0] pb-2">
            — 项目信息
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-[#1A202C]">项目名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入项目名称"
              className="border-2 border-[#1A202C] px-3 py-2 text-[11px] font-bold bg-white focus:outline-none focus:border-[#00A3C4]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold uppercase text-[#1A202C]">项目背景</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="描述项目的背景、目标和整体要求，LLM 将据此为每位成员设计专属 workspace..."
              rows={5}
              className="border-2 border-[#1A202C] px-3 py-2 text-[11px] bg-white focus:outline-none focus:border-[#00A3C4] resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* 成员配置 */}
        <div className="border-2 border-[#1A202C] bg-white p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4]">
              — 成员分工（最多5人）
            </div>
            <button
              type="button"
              onClick={addMember}
              disabled={members.length >= 5}
              className="text-[9px] font-bold uppercase px-2 py-1 border border-[#00A3C4] text-[#00A3C4] hover:bg-[#CCF2FF] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              + 添加成员
            </button>
          </div>

          {members.length === 0 ? (
            <div className="text-[10px] text-gray-400 text-center py-4">
              点击「添加成员」配置项目成员
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {members.map((member, idx) => (
                <div key={idx} className="border border-[#E2E8F0] p-3 flex flex-col gap-2 bg-[#FAFBFC]">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase text-gray-500">成员 {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeMember(idx)}
                      className="text-[9px] font-bold text-red-400 hover:text-red-600"
                    >
                      移除
                    </button>
                  </div>
                  <select
                    value={member.user_id || ""}
                    onChange={(e) => selectUser(idx, Number(e.target.value))}
                    className="border-2 border-[#1A202C] px-2 py-1.5 text-[10px] font-bold bg-white focus:outline-none focus:border-[#00A3C4]"
                  >
                    <option value="">选择成员</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name} ({u.username})
                      </option>
                    ))}
                    {member.user_id ? (
                      <option value={member.user_id}>
                        {member.display_name}（当前选择）
                      </option>
                    ) : null}
                  </select>
                  <textarea
                    value={member.role_desc}
                    onChange={(e) => updateMember(idx, "role_desc", e.target.value)}
                    placeholder="描述该成员的分工职责，如：负责视觉设计，输出品牌VI方案..."
                    rows={2}
                    className="border-2 border-[#1A202C] px-2 py-1.5 text-[10px] bg-white focus:outline-none focus:border-[#00A3C4] resize-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="text-[10px] font-bold text-red-500 border border-red-300 px-3 py-2 bg-red-50">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-[10px] font-bold uppercase border-2 border-gray-400 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting || generating}
            className="flex-1 py-2 text-[10px] font-bold uppercase border-2 border-[#1A202C] bg-[#1A202C] text-white hover:bg-[#00A3C4] hover:border-[#00A3C4] disabled:opacity-50 transition-colors"
          >
            {generating ? "AI 生成规划中..." : submitting ? "创建中..." : "创建并生成规划 →"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
