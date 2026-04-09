"use client";

import { useRouter } from "next/navigation";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { PixelButton } from "@/components/pixel/PixelButton";
import { ROLE_LABELS, ROLE_COLORS } from "../constants";
import type { UserRow } from "./UserList";

export function UserHeader({ user }: { user: UserRow }) {
  const router = useRouter();

  return (
    <div className="bg-card border-2 border-border p-4 flex items-center gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm font-mono text-foreground">
            {user.display_name}
          </span>
          <PixelBadge color={ROLE_COLORS[user.role] || "cyan"}>
            {ROLE_LABELS[user.role] || user.role}
          </PixelBadge>
          {!user.is_active && <PixelBadge color="red">已停用</PixelBadge>}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
          @{user.username}
          {user.department_name ? ` · ${user.department_name}` : ""}
        </div>
      </div>
      <div className="ml-auto">
        <PixelButton variant="secondary" size="sm" onClick={() => router.push("/admin/users")}>
          去编辑用户
        </PixelButton>
      </div>
    </div>
  );
}
