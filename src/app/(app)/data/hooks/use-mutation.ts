"use client";

import { useState, useCallback } from "react";

interface MutationConfig<TData, TResult> {
  mutationFn: (data: TData) => Promise<TResult>;
  onSuccess?: (result: TResult) => void;
  onError?: (error: string) => void;
}

interface MutationResult<TData, TResult> {
  mutate: (data: TData) => Promise<TResult | null>;
  isLoading: boolean;
  error: string;
  result: TResult | null;
  reset: () => void;
}

/**
 * 通用 mutation hook，封装加载/错误/成功回调
 * 高风险写操作的影响分析和审批前置钩子由调用方在 mutationFn 中实现
 */
export function useDataAssetMutation<TData, TResult = unknown>(
  config: MutationConfig<TData, TResult>
): MutationResult<TData, TResult> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TResult | null>(null);

  const mutate = useCallback(async (data: TData): Promise<TResult | null> => {
    setIsLoading(true);
    setError("");
    try {
      const res = await config.mutationFn(data);
      setResult(res);
      config.onSuccess?.(res);
      return res;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "操作失败";
      setError(msg);
      config.onError?.(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  const reset = useCallback(() => {
    setError("");
    setResult(null);
  }, []);

  return { mutate, isLoading, error, result, reset };
}
