"use client";

import { useTheme } from "@/lib/theme";
import { SelectHTMLAttributes } from "react";

interface PixelSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  pixelSize?: "sm" | "md";
}

const sizeStyles = {
  sm: "px-2 py-1 text-[9px]",
  md: "px-2 py-1.5 text-[10px]",
};

const formalSizeStyles = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-3 py-2 text-sm",
};

export function PixelSelect({
  pixelSize = "md",
  className = "",
  children,
  ...props
}: PixelSelectProps) {
  const { theme } = useTheme();
  const isLab = theme === "lab";

  if (isLab) {
    return (
      <select
        className={`w-full font-bold font-mono uppercase tracking-wide border-2 border-[#1A202C] bg-white text-[#1A202C] outline-none focus:border-[#00D1FF] disabled:opacity-40 appearance-none bg-no-repeat bg-right pr-6 ${sizeStyles[pixelSize]} ${className}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%231A202C'/%3E%3C/svg%3E")`,
          backgroundPosition: "right 8px center",
        }}
        {...props}
      >
        {children}
      </select>
    );
  }

  return (
    <select
      className={`w-full font-medium rounded-md border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-40 appearance-none bg-no-repeat bg-right pr-6 ${formalSizeStyles[pixelSize]} ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E")`,
        backgroundPosition: "right 8px center",
      }}
      {...props}
    >
      {children}
    </select>
  );
}
