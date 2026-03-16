"use client";

import { useTheme, type Theme } from "@/lib/theme";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";

const THEMES: { value: Theme; label: string; desc: string; preview: string }[] =
  [
    {
      value: "lab",
      label: "Lab Edition",
      desc: "像素艺术风格，实验室版",
      preview: "pixel",
    },
    {
      value: "light",
      label: "正式 Light",
      desc: "清爽白色，商务正式",
      preview: "light",
    },
    {
      value: "dark",
      label: "正式 Dark",
      desc: "深色护眼，长时间使用",
      preview: "dark",
    },
  ];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <PageShell title="设置" icon={ICONS.settings}>
      <div className="max-w-xl">
        <section>
          <h2 className="text-sm font-semibold mb-1 text-foreground">外观主题</h2>
          <p className="text-xs text-muted-foreground mb-4">切换即时生效，自动保存</p>
          <div className="flex flex-col gap-3">
            {THEMES.map((t) => {
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg border text-left transition-all ${
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-card hover:bg-muted/50"
                  }`}
                >
                  {/* 主题预览色块 */}
                  <div
                    className="w-10 h-10 rounded flex-shrink-0 border border-border flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background:
                        t.preview === "pixel"
                          ? "#EBF4F7"
                          : t.preview === "dark"
                            ? "#1a1a1a"
                            : "#ffffff",
                      color:
                        t.preview === "dark" ? "#f5f5f5" : "#1A202C",
                      borderColor:
                        t.preview === "pixel" ? "#1A202C" : undefined,
                      borderWidth: t.preview === "pixel" ? 2 : undefined,
                    }}
                  >
                    {t.preview === "pixel" ? "px" : t.preview === "dark" ? "dk" : "lt"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>

                  {/* 选中指示 */}
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                      active
                        ? "border-primary bg-primary"
                        : "border-muted-foreground"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
