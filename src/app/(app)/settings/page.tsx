"use client";

import { useRef, useState } from "react";
import { useTheme, type Theme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { PageShell } from "@/components/layout/PageShell";
import { ICONS } from "@/components/pixel";

const THEMES: { value: Theme; label: string; desc: string; preview: string }[] = [
  { value: "lab", label: "Lab Edition", desc: "像素艺术风格，实验室版", preview: "pixel" },
  { value: "light", label: "正式 Light", desc: "清爽白色，商务正式", preview: "light" },
  { value: "dark", label: "正式 Dark", desc: "深色护眼，长时间使用", preview: "dark" },
];

function AvatarSection() {
  const { user, refreshUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [avatarTs, setAvatarTs] = useState(0);

  const avatarUrl = user?.avatar_url
    ? `/api/proxy${user.avatar_url.replace(/^\/api/, "")}${avatarTs ? `?t=${avatarTs}` : ""}`
    : null;
  const initials = user?.display_name?.slice(0, 2) ?? "?";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiFetch("/auth/avatar", { method: "POST", body: form });
      await refreshUser();
      setAvatarTs(Date.now());
      setMsg({ text: "头像已更新，正在刷新...", ok: true });
      setTimeout(() => window.location.reload(), 800);
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : "上传失败", ok: false });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-border flex-shrink-0 group focus:outline-none"
        title="点击更换头像"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="头像" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
            {initials}
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
          {uploading ? "上传中..." : "更换"}
        </div>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFile}
      />
      <div>
        <div className="text-sm font-semibold text-foreground">{user?.display_name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">@{user?.username}</div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="mt-1.5 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors disabled:opacity-50"
        >
          {uploading ? "上传中..." : "更换头像"}
        </button>
        {msg && (
          <div className={`text-xs mt-1 ${msg.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setMsg({ text: "两次输入的新密码不一致", ok: false });
      return;
    }
    if (next.length < 6) {
      setMsg({ text: "新密码至少 6 位", ok: false });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await apiFetch("/auth/change_password", {
        method: "POST",
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setMsg({ text: "密码已修改", ok: true });
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : "修改失败", ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
      <div>
        <label className="text-xs font-medium text-foreground block mb-1">当前密码</label>
        <input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground block mb-1">新密码</label>
        <input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          placeholder="至少 6 位"
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-foreground block mb-1">确认新密码</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="w-full border border-border rounded-md px-3 py-2 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {msg && (
        <div className={`text-xs ${msg.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
          {msg.text}
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !current || !next || !confirm}
        className="self-start px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {loading ? "保存中..." : "修改密码"}
      </button>
    </form>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <PageShell title="设置" icon={ICONS.settings}>
      <div className="max-w-xl flex flex-col gap-10">

        {/* 账户信息 */}
        <section>
          <h2 className="text-sm font-semibold mb-1 text-foreground">账户</h2>
          <p className="text-xs text-muted-foreground mb-4">头像和基本信息</p>
          <AvatarSection />
        </section>

        {/* 修改密码 */}
        <section>
          <h2 className="text-sm font-semibold mb-1 text-foreground">修改密码</h2>
          <p className="text-xs text-muted-foreground mb-4">建议使用强密码并定期更换</p>
          <ChangePasswordSection />
        </section>

        {/* 外观主题 */}
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
                  <div
                    className="w-10 h-10 rounded flex-shrink-0 border border-border flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: t.preview === "pixel" ? "#EBF4F7" : t.preview === "dark" ? "#1a1a1a" : "#ffffff",
                      color: t.preview === "dark" ? "#f5f5f5" : "#1A202C",
                      borderColor: t.preview === "pixel" ? "#1A202C" : undefined,
                      borderWidth: t.preview === "pixel" ? 2 : undefined,
                    }}
                  >
                    {t.preview === "pixel" ? "px" : t.preview === "dark" ? "dk" : "lt"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.desc}</div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                    active ? "border-primary bg-primary" : "border-muted-foreground"
                  }`} />
                </button>
              );
            })}
          </div>
        </section>

      </div>
    </PageShell>
  );
}
