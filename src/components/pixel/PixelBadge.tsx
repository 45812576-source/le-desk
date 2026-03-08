interface PixelBadgeProps {
  children: React.ReactNode;
  color?: "cyan" | "green" | "yellow" | "red" | "purple" | "gray";
}

const colorStyles = {
  cyan: "bg-[#CCF2FF] text-[#00A3C4] border-[#00D1FF]",
  green: "bg-[#C6F6D5] text-[#38A169] border-[#38A169]",
  yellow: "bg-[#FEFCBF] text-[#B7791F] border-[#D69E2E]",
  red: "bg-[#FED7D7] text-[#C53030] border-[#C53030]",
  purple: "bg-[#E9D8FD] text-[#805AD5] border-[#805AD5]",
  gray: "bg-gray-100 text-gray-600 border-gray-300",
};

export function PixelBadge({ children, color = "cyan" }: PixelBadgeProps) {
  return (
    <span
      className={`inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest border ${colorStyles[color]}`}
    >
      {children}
    </span>
  );
}
