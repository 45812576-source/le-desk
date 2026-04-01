"use client";

import { useState, useEffect, useCallback } from "react";
import type { DataAssetTableV2 } from "../components/shared/types";
import { fetchAssetTables } from "../components/shared/api";

interface UseAssetListResult {
  tables: DataAssetTableV2[];
  total: number;
  isLoading: boolean;
  error: string;
  retry: () => void;
}

export function useAssetList(params?: {
  folder_id?: number;
  source_type?: string;
  risk_level?: string;
}): UseAssetListResult {
  const [tables, setTables] = useState<DataAssetTableV2[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await fetchAssetTables(params);
      setTables(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [params?.folder_id, params?.source_type, params?.risk_level]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return { tables, total, isLoading, error, retry: load };
}
