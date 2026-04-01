"use client";

import { useState, useCallback } from "react";
import type { DataApproval } from "../components/shared/types";
import { createApprovalRequest } from "../components/shared/api";

interface UseApprovalResult {
  approval: DataApproval | null;
  isLoading: boolean;
  error: string;
  submit: (payload: {
    approval_type: string;
    table_id: number;
    payload: Record<string, unknown>;
  }) => Promise<DataApproval | null>;
}

export function useApprovalRequest(): UseApprovalResult {
  const [approval, setApproval] = useState<DataApproval | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = useCallback(async (payload: {
    approval_type: string;
    table_id: number;
    payload: Record<string, unknown>;
  }): Promise<DataApproval | null> => {
    setIsLoading(true);
    setError("");
    try {
      const data = await createApprovalRequest(payload);
      setApproval(data);
      return data;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "提交审批失败");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { approval, isLoading, error, submit };
}
