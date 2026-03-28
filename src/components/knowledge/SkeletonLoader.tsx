"use client";

import { useTheme } from "@/lib/theme";

interface SkeletonLoaderProps {
  variant: "tree" | "preview";
}

const TREE_WIDTHS = ["60%", "80%", "45%", "70%", "55%", "90%", "40%", "75%"];

export default function SkeletonLoader({ variant }: SkeletonLoaderProps) {
  const { theme } = useTheme();
  const rounded = theme === "lab" ? "" : "rounded-md";

  if (variant === "tree") {
    return (
      <div className="p-3 space-y-2">
        {TREE_WIDTHS.map((width, i) => (
          <div
            key={i}
            className={`h-5 bg-gray-200 animate-pulse ${rounded}`}
            style={{ width }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className={`h-6 w-2/3 bg-gray-200 animate-pulse ${rounded}`} />
      <div className="space-y-2">
        <div className={`h-4 w-full bg-gray-100 animate-pulse ${rounded}`} />
        <div className={`h-4 w-5/6 bg-gray-100 animate-pulse ${rounded}`} />
        <div className={`h-4 w-4/6 bg-gray-100 animate-pulse ${rounded}`} />
      </div>
      <div className="space-y-2 pt-2">
        <div className={`h-4 w-full bg-gray-100 animate-pulse ${rounded}`} />
        <div className={`h-4 w-3/4 bg-gray-100 animate-pulse ${rounded}`} />
        <div className={`h-4 w-5/6 bg-gray-100 animate-pulse ${rounded}`} />
        <div className={`h-4 w-2/3 bg-gray-100 animate-pulse ${rounded}`} />
      </div>
    </div>
  );
}
