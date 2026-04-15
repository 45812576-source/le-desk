"use client";

import type { FieldMeta, FieldType } from "./types";

export function normalizeFieldType(fieldType?: string | null): FieldType | undefined {
  if (!fieldType) return undefined;
  if (fieldType === "select") return "single_select";
  if (fieldType === "checkbox") return "boolean";
  return fieldType as FieldType;
}

export function normalizeOptionValues(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  if (Array.isArray(value)) {
    return dedupe(
      value.flatMap((item) => normalizeOptionValues(item))
    );
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        return normalizeOptionValues(JSON.parse(trimmed));
      } catch {
        return dedupe(trimmed.split(",").map((part) => part.trim()).filter(Boolean));
      }
    }
    if (trimmed.includes(",")) {
      return dedupe(trimmed.split(",").map((part) => part.trim()).filter(Boolean));
    }
    return [trimmed];
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["label", "text", "name", "value", "display_name"]) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
        return normalizeOptionValues(obj[key]);
      }
    }
    return [];
  }
  return [String(value)];
}

export function normalizeCellValueForField(value: unknown, fieldMeta?: FieldMeta): unknown {
  const fieldType = normalizeFieldType(fieldMeta?.field_type);
  if (fieldType === "multi_select") {
    return normalizeOptionValues(value);
  }
  if (fieldType === "single_select") {
    return normalizeOptionValues(value)[0] ?? "";
  }
  if (fieldType === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value === "string") {
      const lowered = value.trim().toLowerCase();
      return ["1", "true", "yes", "on"].includes(lowered);
    }
  }
  return value;
}

export function serializeCellValueForField(value: unknown, fieldMeta?: FieldMeta): unknown {
  const fieldType = normalizeFieldType(fieldMeta?.field_type);
  if (fieldType === "multi_select") {
    return normalizeOptionValues(value);
  }
  if (fieldType === "single_select") {
    return normalizeOptionValues(value)[0] ?? null;
  }
  if (fieldType === "boolean") {
    return Boolean(value);
  }
  return value;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}
