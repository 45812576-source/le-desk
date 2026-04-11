"use client";

export function AssistSkillsBar({
  skills,
}: {
  skills: { id: number; name: string; status: string }[];
}) {
  if (skills.length === 0) return null;
  return (
    <div className="px-3 py-1 bg-purple-50 border-b border-purple-200 flex items-center gap-2 flex-shrink-0">
      <span className="text-[7px] font-bold uppercase tracking-widest text-purple-500">辅助 Skill</span>
      <div className="flex gap-1 flex-wrap">
        {skills.map((s) => (
          <span
            key={s.id}
            className={`text-[7px] px-1.5 py-0.5 font-mono border ${
              s.status === "active"
                ? "bg-purple-100 text-purple-700 border-purple-300"
                : "bg-gray-100 text-gray-400 border-gray-200"
            }`}
          >
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
