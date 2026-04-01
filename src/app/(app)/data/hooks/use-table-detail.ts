"use client";

import { useState, useEffect, useCallback } from "react";
import type { TableDetailV2 } from "../components/shared/types";
import { fetchTableDetail } from "../components/shared/api";

interface UseTableDetailResult {
  detail: TableDetailV2 | null;
  isLoading: boolean;
  error: string;
  retry: () => void;
}

export function useTableDetail(tableId: number): UseTableDetailResult {
  const [detail, setDetail] = useState<TableDetailV2 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchTableDetail(tableId);
      setDetail(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [tableId]);

  useEffect(() => { load(); }, [load]);

  return { detail, isLoading, error, retry: load };
}
