"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/lib/theme";

export interface SuggestedUser {
  id: number;
  username: string;
  display_name: string;
  department_name: string | null;
  hint: string;
}

interface PixelUserPickerProps {
  value: { user_id?: number; id?: number; display_name: string } | null;
  onChange: (user: SuggestedUser | null) => void;
  excludeIds?: number[];
  placeholder?: string;
  accentColor?: "cyan" | "purple"; // 需求方=cyan, 开发方=purple
}

const ACCENT = {
  cyan: {
    border: "border-[#00A3C4]",
    ring: "focus-within:border-[#00D1FF]",
    hover: "hover:bg-[#CCF2FF]",
    selectedBg: "#CCF2FF",
    tag: "bg-[#00A3C4] text-white",
    hint: "text-[#00A3C4]",
    avatarBg: "#00A3C4",
  },
  purple: {
    border: "border-[#6B46C1]",
    ring: "focus-within:border-[#9F7AEA]",
    hover: "hover:bg-[#E9D8FD]",
    selectedBg: "#E9D8FD",
    tag: "bg-[#6B46C1] text-white",
    hint: "text-[#6B46C1]",
    avatarBg: "#6B46C1",
  },
};

export function PixelUserPicker({
  value,
  onChange,
  excludeIds = [],
  placeholder = "选择成员",
  accentColor = "cyan",
}: PixelUserPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = ACCENT[accentColor];
  const { theme } = useTheme();
  const isFormal = theme === "light" || theme === "dark";

  // 关闭时点击外部
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchUsers = useCallback(
    (q: string) => {
      if (fetchTimer.current) clearTimeout(fetchTimer.current);
      fetchTimer.current = setTimeout(async () => {
        setLoading(true);
        try {
          const excludeParam = excludeIds.length
            ? `&exclude=${excludeIds.join(",")}`
            : "";
          const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
          const data = await apiFetch<SuggestedUser[]>(
            `/admin/users/suggested?${qParam}${excludeParam}`
          );
          setUsers(data);
          setActiveIndex(0);
        } catch {
          setUsers([]);
        } finally {
          setLoading(false);
        }
      }, q ? 200 : 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [excludeIds.join(",")]
  );

  function handleOpen() {
    setOpen(true);
    setQuery("");
    fetchUsers("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    // @ 前缀不影响搜索词
    fetchUsers(val.startsWith("@") ? val.slice(1) : val);
  }

  function handleSelect(user: SuggestedUser) {
    onChange(user);
    setOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, users.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (users[activeIndex]) handleSelect(users[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  // 首字母头像
  function Avatar({ name, small }: { name: string; small?: boolean }) {
    return (
      <div
        className={`flex-shrink-0 flex items-center justify-center font-bold text-white ${
          small ? "w-5 h-5 text-[8px]" : "w-6 h-6 text-[9px]"
        }`}
        style={{ backgroundColor: accent.avatarBg, imageRendering: "pixelated" }}
      >
        {name.charAt(0)}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className={`w-full flex items-center justify-between gap-2 border-2 px-2 py-1.5 transition-colors text-left ${
          open ? accent.border : "border-[#1A202C]"
        } ${accent.ring}`}
        style={{ backgroundColor: "var(--card)", color: "var(--foreground)" }}
      >
        {value ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={value.display_name} small />
            <span className="text-[10px] font-bold text-[#1A202C] truncate">
              {value.display_name}
            </span>
          </div>
        ) : (
          <span className="text-[10px] text-gray-400 font-bold">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              onClick={handleClear}
              className="text-[9px] text-gray-400 hover:text-red-400 px-0.5 cursor-pointer leading-none"
              title="清除"
            >
              ✕
            </span>
          )}
          <span className="text-[8px] text-gray-400">▾</span>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 top-full left-0 right-0 mt-0.5 border-2 border-[#1A202C]"
          style={{
            backgroundColor: "var(--card)",
            boxShadow: isFormal ? "0 4px 12px var(--border)" : "4px 4px 0px #1A202C",
          }}
        >
          {/* Search input */}
          <div className="border-b-2 border-[#1A202C] px-2 py-1.5 flex items-center gap-1.5">
            <span className="text-[9px] text-gray-400 font-bold">@</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="搜索姓名..."
              className="flex-1 text-[10px] font-bold text-[#1A202C] bg-transparent outline-none placeholder:text-gray-300 placeholder:font-normal"
            />
            {loading && (
              <div className="w-3 h-3 border border-gray-300 border-t-[#00A3C4] rounded-full animate-spin" />
            )}
          </div>

          {/* User list */}
          <div className="max-h-[220px] overflow-y-auto">
            {users.length === 0 && !loading ? (
              <div className="px-3 py-3 text-[9px] text-gray-400 text-center font-bold uppercase tracking-wide">
                {query ? "无匹配同事" : "暂无推荐"}
              </div>
            ) : (
              users.map((user, idx) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelect(user)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-left transition-colors border-b border-[#E2E8F0] last:border-b-0 ${
                    idx !== activeIndex ? accent.hover : ""
                  }`}
                  style={idx === activeIndex ? { backgroundColor: accent.selectedBg + (isFormal ? "33" : "80") } : undefined}
                >
                  <Avatar name={user.display_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-[#1A202C] truncate">
                        {user.display_name}
                      </span>
                      <span className="text-[8px] text-gray-400 truncate flex-shrink-0">
                        @{user.username}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {user.department_name && (
                        <span className="text-[8px] text-gray-400 truncate">
                          {user.department_name}
                        </span>
                      )}
                      <span className={`text-[7px] font-bold uppercase tracking-wide ${accent.hint} flex-shrink-0`}>
                        · {user.hint}
                      </span>
                    </div>
                  </div>
                  {idx === activeIndex && (
                    <span className="text-[8px] text-gray-300 flex-shrink-0">↵</span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer hint */}
          {!query && users.length > 0 && (
            <div className="border-t border-[#E2E8F0] px-2.5 py-1.5 flex items-center gap-1">
              <span className="text-[7px] text-gray-300 font-bold uppercase tracking-widest">
                输入 @ 搜索更多同事
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
