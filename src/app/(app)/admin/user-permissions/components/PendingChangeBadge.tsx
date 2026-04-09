import type { PermissionChangeRequest } from "@/lib/types";

export function PendingChangeBadge({ change }: { change: PermissionChangeRequest }) {
  const targetLabel =
    typeof change.target_value === "boolean"
      ? change.target_value
        ? "开启"
        : "关闭"
      : "变更";

  return (
    <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] bg-amber-100 text-amber-700 border border-amber-300 font-bold">
      待审批 → {targetLabel}
      <span className="text-amber-500">#{change.id}</span>
    </span>
  );
}
