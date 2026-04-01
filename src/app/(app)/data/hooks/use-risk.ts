"use client";

import { useState, useEffect, useCallback } from "react";
import type { RiskAssessment } from "../components/shared/types";
import { fetchRiskAssessment } from "../components/shared/api";

interface UseRiskResult {
  risk: RiskAssessment | null;
  isLoading: boolean;
  error: string;
  retry: () => void;
}

export function useRiskAssessment(tableId: number): UseRiskResult {
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchRiskAssessment(tableId);
      setRisk(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [tableId]);

  useEffect(() => { load(); }, [load]);

  return { risk, isLoading, error, retry: load };
}
