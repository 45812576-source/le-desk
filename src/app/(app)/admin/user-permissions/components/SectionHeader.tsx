export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-muted border-b-2 border-border px-4 py-2 flex items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[#00A3C4]">{title}</span>
      {subtitle && <span className="text-[10px] text-muted-foreground font-mono">{subtitle}</span>}
    </div>
  );
}
