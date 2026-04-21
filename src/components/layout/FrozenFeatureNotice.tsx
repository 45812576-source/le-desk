"use client";

import Link from "next/link";

export default function FrozenFeatureNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">
          已冻结
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{description}</p>

        <div className="mt-6 rounded-xl border border-dashed border-border bg-background px-4 py-4 text-sm leading-7 text-muted-foreground">
          当前主链路已收口为「资料接入 → 快照生成 → 治理版本生成 → 生效与影响」。
          如果需要继续操作，则请前往组织事实主页面完成资料与治理闭环。
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/org-management"
            className="rounded bg-[#00A3C4] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            前往组织事实 / 资料与治理
          </Link>
          <Link
            href="/knowledge"
            className="rounded border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50"
          >
            返回知识首页
          </Link>
        </div>
      </div>
    </div>
  );
}
