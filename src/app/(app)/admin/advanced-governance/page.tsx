"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import FrozenFeatureNotice from "@/components/layout/FrozenFeatureNotice";
import { useAuth } from "@/lib/auth";

export default function AdvancedGovernancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role !== "super_admin") {
      router.replace("/admin/governance");
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (user.role !== "super_admin") {
    return null;
  }

  return (
    <FrozenFeatureNotice
      title="高级治理入口已冻结"
      description="如果当前唯一主链路已经收敛为组织资料接入与治理版本生效，则策略统计、迁移、实验与 Schema 等低频能力暂不继续扩展。本页保留原路由，仅用于内部直链回看。"
    />
  );
}
