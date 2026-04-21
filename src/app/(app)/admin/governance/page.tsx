"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import FrozenFeatureNotice from "@/components/layout/FrozenFeatureNotice";
import { useAuth } from "@/lib/auth";

export default function AdminGovernancePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === "employee") {
      router.replace("/knowledge");
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (user.role === "employee") {
    return null;
  }

  return (
    <FrozenFeatureNotice
      title="知识治理入口已冻结"
      description="如果本轮目标只围绕资料接入、快照生成、治理版本生成与 Skill 运行时消费，则旧治理页不再属于主流程。本页已从主导航移出，保留路由仅供内部复盘和历史比对。"
    />
  );
}
