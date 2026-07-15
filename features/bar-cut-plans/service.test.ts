import { describe, expect, it } from "vitest";

import {
  buildBarDemands,
  buildBarStockSpecs,
} from "@/features/bar-cut-plans/service";

describe("bar-cut-plans / build helpers", () => {
  it("строит спрос по средней длине фаски", () => {
    const { demands, error } = buildBarDemands([
      {
        id: "AAAAAAAA",
        label: "A",
        outerMm: 1000,
        innerMm: 800,
        quantity: 2,
        colorIndex: 0,
        material: null,
      },
    ]);
    expect(error).toBeNull();
    expect(demands[0]!.lengthMm).toBe(900);
    expect(demands[0]!.quantity).toBe(2);
  });

  it("укорачивает заготовку при фасках", () => {
    const { specs, error } = buildBarStockSpecs(
      [{ id: "BBBBBBBB", lengthMm: 6000, quantity: null, name: null }],
      true,
      [
        {
          id: "AAAAAAAA",
          label: "A",
          outerMm: 1000,
          innerMm: 800,
          quantity: 1,
        },
      ],
    );
    expect(error).toBeNull();
    expect(specs[0]!.lengthMm).toBe(5900);
  });
});
