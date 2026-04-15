import { describe, expect, it } from "vitest";
import {
  normalizeCellValueForField,
  normalizeFieldType,
  normalizeOptionValues,
  serializeCellValueForField,
} from "../value-normalization";

describe("data table value normalization", () => {
  it("normalizes legacy select type to single_select", () => {
    expect(normalizeFieldType("select")).toBe("single_select");
    expect(normalizeFieldType("checkbox")).toBe("boolean");
  });

  it("normalizes multi-select values without selecting all options", () => {
    expect(normalizeOptionValues(["A"])).toEqual(["A"]);
    expect(normalizeOptionValues("[\"A\",\"B\"]")).toEqual(["A", "B"]);
    expect(normalizeOptionValues("A,B,A")).toEqual(["A", "B"]);
  });

  it("serializes multi-select cells as string arrays", () => {
    const fieldMeta = {
      name: "tags",
      field_type: "multi_select" as const,
      options: ["A", "B", "C"],
      nullable: true,
      comment: "",
    };
    expect(normalizeCellValueForField("[\"A\"]", fieldMeta)).toEqual(["A"]);
    expect(serializeCellValueForField(["B"], fieldMeta)).toEqual(["B"]);
  });
});
