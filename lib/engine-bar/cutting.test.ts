import { describe, expect, it } from "vitest";

import {
  MAX_EXACT_PIECES,
  STOCK_UNLIMITED,
  barPatternKey,
  groupConsecutiveIdenticalBars,
  mergeStockSpecs,
  solveCuttingFromStocks,
  solveFFD,
  validateDemands,
  type DemandItem,
} from "@/lib/engine-bar/cutting";

function demand(
  id: string,
  lengthMm: number,
  quantity: number,
  colorIndex = 0,
): DemandItem {
  return { id, label: id, lengthMm, quantity, colorIndex };
}

describe("engine-bar / mergeStockSpecs", () => {
  it("суммирует одинаковые длины", () => {
    expect(
      mergeStockSpecs([
        { id: "a", lengthMm: 6000, quantity: 2 },
        { id: "b", lengthMm: 6000, quantity: 3 },
        { id: "c", lengthMm: 3000, quantity: 1 },
      ]),
    ).toEqual([
      { id: "stock-3000", lengthMm: 3000, quantity: 1 },
      { id: "stock-6000", lengthMm: 6000, quantity: 5 },
    ]);
  });
});

describe("engine-bar / validateDemands", () => {
  it("ловит деталь длиннее заготовки", () => {
    const err = validateDemands(6000, [demand("x", 7000, 1)]);
    expect(err).toMatch(/длиннее/);
  });

  it("пропускает валидные длины", () => {
    expect(validateDemands(6000, [demand("x", 5000, 2)])).toBeNull();
  });
});

describe("engine-bar / solveFFD", () => {
  it("упаковывает две детали на одну заготовку при достаточном месте", () => {
    const bars = solveFFD(6000, 0, [demand("a", 2000, 1), demand("b", 3000, 1)]);
    expect(bars).toHaveLength(1);
    expect(bars[0]!.pieces.map((p) => p.lengthMm).sort()).toEqual([2000, 3000]);
    expect(bars[0]!.wasteMm).toBe(1000);
  });

  it("учитывает пропил между деталями", () => {
    // 3000 + 4 + 3000 = 6004 > 6000 → две заготовки
    const bars = solveFFD(6000, 4, [demand("a", 3000, 2)]);
    expect(bars.length).toBe(2);
  });
});

describe("engine-bar / solveCuttingFromStocks", () => {
  it("exact: минимум заготовок при ≤ MAX_EXACT_PIECES", () => {
    const demands = [demand("a", 2000, 3)];
    expect(demands[0]!.quantity).toBeLessThanOrEqual(MAX_EXACT_PIECES);

    const result = solveCuttingFromStocks(
      [{ id: "s", lengthMm: 6000, quantity: STOCK_UNLIMITED }],
      0,
      demands,
    );

    expect(result.method).toBe("exact");
    expect(result.bars).toHaveLength(1);
    expect(result.bars[0]!.pieces).toHaveLength(3);
    expect(result.wastePercent).toBe(0);
    expect(result.totalCuts).toBe(2);
    expect(result.multiStock).toBe(false);
  });

  it("ffd: при большом числе деталей", () => {
    const result = solveCuttingFromStocks(
      [{ id: "s", lengthMm: 6000, quantity: STOCK_UNLIMITED }],
      0,
      [demand("a", 1000, MAX_EXACT_PIECES + 1)],
    );
    expect(result.method).toBe("ffd");
    expect(result.bars.length).toBeGreaterThan(1);
  });

  it("multi-stock: берёт наименьшую подходящую длину", () => {
    const result = solveCuttingFromStocks(
      [
        { id: "s3", lengthMm: 3000, quantity: 10 },
        { id: "s6", lengthMm: 6000, quantity: 10 },
      ],
      0,
      [demand("a", 2500, 1), demand("b", 5500, 1)],
    );

    expect(result.multiStock).toBe(true);
    expect(result.method).toBe("ffd");
    expect(result.bars).toHaveLength(2);
    const lengths = result.bars.map((b) => b.stockLengthMm).sort((a, b) => a - b);
    expect(lengths).toEqual([3000, 6000]);
  });

  it("пустой спрос — пустой результат", () => {
    const result = solveCuttingFromStocks(
      [{ id: "s", lengthMm: 6000, quantity: 1 }],
      4,
      [],
    );
    expect(result.bars).toHaveLength(0);
    expect(result.totalStockMm).toBe(0);
  });

  it("ошибка при исчерпании склада (несколько длин)", () => {
    expect(() =>
      solveCuttingFromStocks(
        [
          { id: "s6", lengthMm: 6000, quantity: 1 },
          { id: "s3", lengthMm: 3000, quantity: 0 },
        ],
        0,
        [demand("a", 5000, 2)],
      ),
    ).toThrow(/Нет заготовки/);
  });

  it("группы одинаковых схем подряд", () => {
    const result = solveCuttingFromStocks(
      [{ id: "s", lengthMm: 6000, quantity: STOCK_UNLIMITED }],
      0,
      [demand("a", 6000, 3)],
    );
    const groups = groupConsecutiveIdenticalBars(result.bars);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.count).toBe(3);
    expect(barPatternKey(groups[0]!.bar)).toBe("6000|6000");
  });
});
