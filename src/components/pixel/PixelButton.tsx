"use client";

import { ButtonHTMLAttributes } from "react";

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}

const variantStyles = {
  primary:
    "bg-[#1A202C] text-white hover:bg-black border-2 border-[#1A202C]",
  secondary:
    "bg-white text-[#1A202C] hover:bg-[#CCF2FF] border-2 border-[#1A202C]",
  danger:
    "bg-[#C53030] text-white hover:bg-red-700 border-2 border-[#1A202C]",
  ghost:
    "bg-transparent text-[#1A202C] hover:bg-white/50 border border-transparent hover:border-gray-400",
};

const sizeStyles = {
  sm: "px-2 py-1 text-[9px]",
  md: "px-3 py-1.5 text-[10px]",
};

export function PixelButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: PixelButtonProps) {
  return (
    <button
      className={`font-bold uppercase tracking-wide transition-colors disabled:opacity-40 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
