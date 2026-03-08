import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";

export default function Page() {
  return (
    <PageShell title="外部 Skill 市场" icon={ICONS.skillMarket}>
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 bg-[#00D1FF] pixel-border flex items-center justify-center text-lg mb-4">
          🚧
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          外部 Skill 市场 — 开发中
        </p>
      </div>
    </PageShell>
  );
}
