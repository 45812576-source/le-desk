"use client";

import { useState, useEffect, useCallback } from "react";
import type { PolicyVersion } from "../components/shared/types";
import { fetchPolicyVersions } from "../components/shared/api";

interface UsePolicyVersionResult {
  versions: PolicyVersion[];
  isLoading: boolean;
  error: string;
  retry: () => void;
}

export function usePolicyVersions(policyId: number | null): UsePolicyVersionResult {
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!policyId) {
      setVersions([]);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchPolicyVersions(policyId);
      setVersions(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [policyId]);

  useEffect(() => { load(); }, [load]);

  return { versions, isLoading, error, retry: load };
}
