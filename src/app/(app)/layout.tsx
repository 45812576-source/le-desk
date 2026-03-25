"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useChatStore } from "@/lib/chat-store";
import { apiFetch } from "@/lib/api";

function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const prefetchedRef = useRef(false);

  // Prefetch conversations immediately on mount — don't wait for auth to settle
  useEffect(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    const token = localStorage.getItem("token");
    if (!token) return;
    apiFetch("/conversations").then((data) => {
      useChatStore.setState({ conversations: data as never });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  // No user at all (no cache, no token) → show loading briefly
  if (loading && !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar user={user} taskPending={0} onLogout={logout} />
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
