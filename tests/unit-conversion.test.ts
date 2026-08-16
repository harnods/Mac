import { describe, it, expect } from "vitest";
import { convertToItemUnit } from "../src/lib/units";

// Nested/chained custom unit conversions:
//   1 box = 1000 ml, 1 karton = 12 box  →  karton resolves karton→box→ml.
const milk = {
  unit: "ml",
  item_unit_conversions: [
    { from_unit: "box", factor: 1000, to_unit: "ml" },
    { from_unit: "karton", factor: 12, to_unit: "box" },
  ],
};

describe("convertToItemUnit — nested conversions", () => {
  it("resolves a direct custom unit to base (box → ml)", () => {
    expect(convertToItemUnit(1, "box", milk)).toBe(1000);
    expect(convertToItemUnit(3, "box", milk)).toBe(3000);
  });

  it("resolves a nested custom unit through the chain (karton → box → ml)", () => {
    expect(convertToItemUnit(1, "karton", milk)).toBe(12000);
    expect(convertToItemUnit(2, "karton", milk)).toBe(24000);
  });

  it("still handles built-in group conversions (l → ml)", () => {
    expect(convertToItemUnit(1, "l", milk)).toBe(1000);
  });

  it("returns the base value unchanged when unit is already base", () => {
    expect(convertToItemUnit(500, "ml", milk)).toBe(500);
  });

  it("does not infinite-loop on a cyclic definition", () => {
    const cyclic = {
      unit: "ml",
      item_unit_conversions: [
        { from_unit: "a", factor: 2, to_unit: "b" },
        { from_unit: "b", factor: 3, to_unit: "a" }, // cycle, never reaches ml
      ],
    };
    const result = convertToItemUnit(1, "a", cyclic);
    expect(Number.isFinite(result)).toBe(true);
  });
});
