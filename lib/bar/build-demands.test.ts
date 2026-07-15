import { describe, expect, it } from "vitest";

import {
  computeMiterDeltaMm,
  effectiveStockLengthMm,
  pieceDemandLengthMm,
} from "@/lib/bar/build-demands";

describe("build-demands / miter", () => {
  it("средняя длина при фаске", () => {
    expect(
      pieceDemandLengthMm({
        id: "1",
        label: "A",
        outerMm: 1000,
        innerMm: 800,
        quantity: 1,
      }),
    ).toBe(900);
  });

  it("max delta фасок и укорочение заготовки", () => {
    const delta = computeMiterDeltaMm([
      { id: "1", label: "A", outerMm: 1000, innerMm: 800, quantity: 1 },
      { id: "2", label: "B", outerMm: 1200, innerMm: 1000, quantity: 1 },
    ]);
    expect(delta).toBe(100);
    expect(effectiveStockLengthMm(6000, true, delta)).toBe(5900);
    expect(effectiveStockLengthMm(6000, false, delta)).toBe(6000);
  });
});
