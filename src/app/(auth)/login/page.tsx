"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/proxy/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || "登录失败");
        return;
      }
      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      if (data.user) localStorage.setItem("cached_user", JSON.stringify(data.user));
      router.replace("/chat");
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center">
      <div className="w-80">
        {/* Logo */}
        <div className="flex items-center justify-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-[#00D1FF] pixel-border flex items-center justify-center">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold uppercase tracking-tight leading-none">
              Le Desk
            </h1>
            <p className="text-[10px] text-[#00A3C4] font-bold uppercase mt-0.5">
              AI Workbench
            </p>
          </div>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white pixel-border p-6 space-y-4"
        >
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border-2 border-[#1A202C] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold uppercase tracking-widest text-[#00A3C4] mb-1">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border-2 border-[#1A202C] px-3 py-2 text-xs font-bold focus:outline-none focus:border-[#00D1FF]"
            />
          </div>

          {error && (
            <div className="border-2 border-red-400 bg-red-50 px-3 py-2 text-[10px] font-bold text-red-700 uppercase text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A202C] text-white py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors disabled:opacity-40 border-2 border-[#1A202C]"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
