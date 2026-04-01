"use client";

import { useSyncExternalStore } from "react";

const FLAG_KEY = "V2_DATA_ASSETS";

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(FLAG_KEY);
  if (stored !== null) return stored === "true";
  return process.env.NODE_ENV === "development";
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

/** 读取 V2 数据资产 feature flag */
export function useV2DataAssets(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** 手动设置 flag（调试用） */
export function setV2DataAssetsFlag(value: boolean) {
  localStorage.setItem(FLAG_KEY, String(value));
}

/** 清除 flag（回退到默认行为） */
export function clearV2DataAssetsFlag() {
  localStorage.removeItem(FLAG_KEY);
}
