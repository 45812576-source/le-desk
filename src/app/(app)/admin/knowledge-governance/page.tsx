"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KnowledgeGovernanceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/governance");
  }, [router]);
  return null;
}
