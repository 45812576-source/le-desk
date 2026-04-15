// ─── Cell value formatter ─────────────────────────────────────────────────────
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => formatCellValue(item)).join("、");
        }
      } catch {
        // ignore
      }
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => formatCellValue(item)).join("、");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.text === "string") return obj.text;
    if (typeof obj.display_name === "string") return obj.display_name;
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    // 毫秒时间戳（13位）
    if (value >= 1e12 && value <= 9.999e12) {
      return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    }
    // 秒时间戳（10位）
    if (value >= 1e9 && value <= 9.999e9) {
      return new Date(value * 1000).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    }
  }
  return String(value);
}
