"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";
import { PixelUserPicker, type SuggestedUser } from "@/components/pixel/PixelUserPicker";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface MemberInput {
  user_id: number;
  display_name: string;
  role_desc: string;
}

type ProjectType = "dev" | "custom";

export default function NewProjectPage() {
  const router = useRouter();
  useAuth(); // ensure authenticated
  const [projectType, setProjectType] = useState<ProjectType>("custom");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // custom 模式
  const [members, setMembers] = useState<MemberInput[]>([]);

  // dev 模式
  const [requester, setRequester] = useState<SuggestedUser | null>(null);
  const [developer, setDeveloper] = useState<SuggestedUser | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // ── custom 模式成员操作 ─────────────────────────────────────────────────────
  function addMember() {
    if (members.length >= 5) return;
    setMembers((prev) => [...prev, { user_id: 0, display_name: "", role_desc: "" }]);
  }

  function removeMember(idx: number) {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateMemberUser(idx: number, user: SuggestedUser | null) {
    setMembers((prev) =>
      prev.map((m, i) =>
        i === idx
          ? { ...m, user_id: user?.id ?? 0, display_name: user?.display_name ?? "" }
          : m
      )
    );
  }

  function updateMemberRole(idx: number, role_desc: string) {
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, role_desc } : m)));
  }

  // ── 提交 ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("请填写项目名称"); return; }
    setError("");
    setSubmitting(true);

    try {
      if (projectType === "dev") {
        if (!requester || !developer) { setError("请选择需求方和开发方"); setSubmitting(false); return; }
        const project = await apiFetch<{ id: number }>("/projects", {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), description: description.trim(), project_type: "dev" }),
        });
        await apiFetch(`/projects/${project.id}/apply-dev-template`, {
          method: "POST",
          body: JSON.stringify({ requester_user_id: requester.id, developer_user_id: developer.id }),
        });
        router.push(`/projects/${project.id}`);
      } else {
        if (members.some((m) => !m.user_id)) { setError("请为每位成员选择用户"); setSubmitting(false); return; }
        if (members.some((m) => !m.role_desc.trim())) { setError("请填写每位成员的分工描述"); setSubmitting(false); return; }

        const project = await apiFetch<{ id: number }>("/projects", {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            project_type: "custom",
            members: members.map((m) => ({ user_id: m.user_id, role_desc: m.role_desc })),
          }),
        });
        setGenerating(true);
        try {
          await apiFetch(`/projects/${project.id}/generate`, { method: "POST" });
          router.push(`/projects/${project.id}/plan`);
        } catch {
          router.push(`/projects/${project.id}`);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSubmitting(false);
      setGenerating(false);
    }
  }

  // 已选的 user_id 列表（用于 exclude，避免重复选人）
  const selectedCustomIds = members.map((m) => m.user_id).filter(Boolean);
  const devExcludeForRequester = [developer?.id].filter(Boolean) as number[];
  const devExcludeForDeveloper = [requester?.id].filter(Boolean) as number[];

  return (
    <PageShell title="新建项目" icon={ICONS.project}>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex flex-col gap-6">

        {/* 项目类型选择 */}
        <div className="border-2 border-[#1A202C] bg-white p-5 flex flex-col gap-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] border-b border-[#E2E8F0] pb-2">
            — 项目类型
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProjectType("dev")}
              className={`p-4 border-2 text-left transition-colors ${
                projectType === "dev"
                  ? "border-[#6B46C1] bg-[#6B46C1]/5"
                  : "border-[#E2E8F0] hover:border-[#6B46C1]/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#6B46C1] text-white">DEV</span>
                <span className="text-[11px] font-bold text-[#1A202C]">开发项目</span>
              </div>
              <p className="text-[9px] text-gray-500 leading-relaxed">
                业务出需求 → 研发写代码。需求上下文从 Chat 无缝交接到 OpenCode。
              </p>
            </button>
            <button
              type="button"
              onClick={() => setProjectType("custom")}
              className={`p-4 border-2 text-left transition-colors ${
                projectType === "custom"
                  ? "border-[#00A3C4] bg-[#CCF2FF]/30"
                  : "border-[#E2E8F0] hover:border-[#00A3C4]/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#00A3C4] text-white">TEAM</span>
                <span className="text-[11px] font-bold text-[#1A202C]">自定义项目</span>
              </div>
              <p className="text-[9px] text-gray-500 leading-relaxed">
                自由组合团队协作。AI 根据成员分工自动规划 workspace。
              </p>
            </button>
          </div>
        </div>

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
              placeholder={
                projectType === "dev"
                  ? "描述项目的背景和目标，将作为需求方和研发方的上下文..."
                  : "描述项目的背景、目标和整体要求，LLM 将据此为每位成员设计专属 workspace..."
              }
              rows={5}
              className="border-2 border-[#1A202C] px-3 py-2 text-[11px] bg-white focus:outline-none focus:border-[#00A3C4] resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* 成员配置 */}
        {projectType === "dev" ? (
          <div className="border-2 border-[#1A202C] bg-white p-5 flex flex-col gap-4">
            <div className="text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] border-b border-[#E2E8F0] pb-2">
              — 成员配置（固定角色）
            </div>
            <div className="flex flex-col gap-3">
              {/* 需求方 */}
              <div className="border border-[#E2E8F0] p-3 flex flex-col gap-2 bg-[#FAFBFC]">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#00A3C4] text-white">需求方</span>
                  <span className="text-[9px] text-gray-500">Chat Workspace — 负责提出需求</span>
                </div>
                <PixelUserPicker
                  value={requester ? { user_id: requester.id, display_name: requester.display_name } : null}
                  onChange={(u) => setRequester(u)}
                  excludeIds={devExcludeForRequester}
                  placeholder="选择需求方成员"
                  accentColor="cyan"
                />
              </div>

              {/* 开发方 */}
              <div className="border border-[#E2E8F0] p-3 flex flex-col gap-2 bg-[#FAFBFC]">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-[#6B46C1] text-white">开发方</span>
                  <span className="text-[9px] text-gray-500">OpenCode Workspace — 负责代码实施</span>
                </div>
                <PixelUserPicker
                  value={developer ? { user_id: developer.id, display_name: developer.display_name } : null}
                  onChange={(u) => setDeveloper(u)}
                  excludeIds={devExcludeForDeveloper}
                  placeholder="选择开发方成员"
                  accentColor="purple"
                />
              </div>
            </div>

            <div className="text-[9px] text-gray-400 bg-[#F0F4F8] p-2 leading-relaxed">
              创建后：需求方在 Chat 与 AI 讨论需求 → 点击「提取需求并推送」→ 研发在 OpenCode 工作台看到需求上下文
            </div>
          </div>
        ) : (
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
                    <PixelUserPicker
                      value={
                        member.user_id
                          ? { user_id: member.user_id, display_name: member.display_name }
                          : null
                      }
                      onChange={(u) => updateMemberUser(idx, u)}
                      excludeIds={selectedCustomIds.filter((id) => id !== member.user_id).filter(Boolean) as number[]}
                      placeholder="选择成员"
                      accentColor="cyan"
                    />
                    <textarea
                      value={member.role_desc}
                      onChange={(e) => updateMemberRole(idx, e.target.value)}
                      placeholder="描述该成员的分工职责，如：负责视觉设计，输出品牌VI方案..."
                      rows={2}
                      className="border-2 border-[#1A202C] px-2 py-1.5 text-[10px] bg-white focus:outline-none focus:border-[#00A3C4] resize-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

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
            {projectType === "dev"
              ? submitting ? "创建中..." : "创建开发项目 →"
              : generating ? "AI 生成规划中..." : submitting ? "创建中..." : "创建并生成规划 →"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}
