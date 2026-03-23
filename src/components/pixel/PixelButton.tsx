"use client";

import { forwardRef } from "react";
import { useTheme } from "@/lib/theme";

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}

const labVariant = {
  primary:   "bg-[#1A202C] text-white hover:bg-black border-2 border-[#1A202C]",
  secondary: "bg-white text-[#1A202C] hover:bg-[#CCF2FF] border-2 border-[#1A202C]",
  danger:    "bg-[#C53030] text-white hover:bg-red-700 border-2 border-[#1A202C]",
  ghost:     "bg-transparent text-[#1A202C] hover:bg-white/50 border border-transparent hover:border-gray-400",
};

const formalVariant = {
  primary:   "bg-primary text-primary-foreground hover:bg-primary/90 border border-transparent",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border",
  danger:    "bg-destructive text-white hover:bg-destructive/90 border border-transparent",
  ghost:     "bg-transparent text-foreground hover:bg-accent border border-transparent",
};

const labSize = {
  sm: "px-2 py-1 text-[9px]",
  md: "px-3 py-1.5 text-[10px]",
};

const formalSize = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(function PixelButton(
  { variant = "primary", size = "md", className = "", children, ...props },
  ref
) {
  const { theme } = useTheme();
  const isLab = theme === "lab";

  const variantClass = isLab ? labVariant[variant] : formalVariant[variant];
  const sizeClass = isLab ? labSize[size] : formalSize[size];
  const baseClass = isLab
    ? "font-bold uppercase tracking-wide transition-colors disabled:opacity-40"
    : "font-medium rounded-md transition-colors disabled:opacity-40";

  return (
    <button
      ref={ref}
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
