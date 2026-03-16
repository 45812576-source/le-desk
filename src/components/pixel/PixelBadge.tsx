"use client";

import { useTheme } from "@/lib/theme";

interface PixelBadgeProps {
  children: React.ReactNode;
  color?: "cyan" | "green" | "yellow" | "red" | "purple" | "gray";
}

const labStyles = {
  cyan:   "bg-[#CCF2FF] text-[#00A3C4] border-[#00D1FF]",
  green:  "bg-[#C6F6D5] text-[#38A169] border-[#38A169]",
  yellow: "bg-[#FEFCBF] text-[#B7791F] border-[#D69E2E]",
  red:    "bg-[#FED7D7] text-[#C53030] border-[#C53030]",
  purple: "bg-[#E9D8FD] text-[#805AD5] border-[#805AD5]",
  gray:   "bg-gray-100 text-gray-600 border-gray-300",
};

const formalStyles = {
  cyan:   "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  green:  "bg-green-100 text-green-700 border-green-300 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  yellow: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  red:    "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  purple: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  gray:   "bg-muted text-muted-foreground border-border",
};

export function PixelBadge({ children, color = "cyan" }: PixelBadgeProps) {
  const { theme } = useTheme();
  const isLab = theme === "lab";
  const style = isLab ? labStyles[color] : formalStyles[color];

  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[8px] font-bold border rounded-sm ${isLab ? "uppercase tracking-widest" : ""} ${style}`}
    >
      {children}
    </span>
  );
}
