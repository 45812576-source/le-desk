"use client";

import { useState, useCallback } from "react";
import type { AccessSimulationRequest, AccessSimulationResult } from "../components/shared/types";
import { simulateAccess } from "../components/shared/api";

interface UseSimulationResult {
  result: AccessSimulationResult | null;
  isLoading: boolean;
  error: string;
  simulate: (req: AccessSimulationRequest) => Promise<void>;
  clear: () => void;
}

export function useAccessSimulation(): UseSimulationResult {
  const [result, setResult] = useState<AccessSimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const simulate = useCallback(async (req: AccessSimulationRequest) => {
    setIsLoading(true);
    setError("");
    try {
      const data = await simulateAccess(req);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "模拟失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError("");
  }, []);

  return { result, isLoading, error, simulate, clear };
}
