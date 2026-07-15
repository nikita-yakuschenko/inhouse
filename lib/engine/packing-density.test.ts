import { describe, expect, it } from "vitest";
import { runCuttingEngine, type EngineInput } from "@/lib/engine";

const base: EngineInput = {
  projectId: "pack",
  mode: "production",
  machine: {
    kerfMm: 3.5,
    minSafePartWidthMm: 80,
    minSafePartHeightMm: 80,
    supportsStopCut: true,
    supportsInternalCut: true,
    requiresCornerDrillingForInternalCut: false,
    preferredPrimaryAxis: "vertical",
    minUsefulOffcutWidthMm: 300,
    minUsefulOffcutHeightMm: 300,
  },
  sheet: {
    widthMm: 3000,
    heightMm: 1250,
    trimLeftMm: 0,
    trimRightMm: 0,
    trimTopMm: 0,
    trimBottomMm: 0,
  },
  parts: [],
  offcuts: [],
  settings: {
    useOffcutsFirst: true,
    allowRotationDefault: false,
    minUsefulOffcutWidthMm: 300,
    minUsefulOffcutHeightMm: 300,
  },
};

describe("packing density", () => {
  it("кладет мелкие детали в остаток над широкой, а не на отдельные листы", () => {
    const result = runCuttingEngine({
      ...base,
      parts: [
        {
          id: "small-late",
          name: "Мелкая",
          code: "Ст-1-01-06",
          quantity: 1,
          widthMm: 345,
          heightMm: 490,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "wide",
          name: "Широкая",
          code: "Ст-1-02-02",
          quantity: 1,
          widthMm: 2680,
          heightMm: 640,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "mid",
          name: "Средняя",
          code: "Ст-1-06-06",
          quantity: 1,
          widthMm: 785,
          heightMm: 580,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "mid2",
          name: "Средняя2",
          code: "Ст-1-06-07",
          quantity: 1,
          widthMm: 635,
          heightMm: 580,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    expect(result.status).toBe("success");
    // Все четыре должны уместиться на 1 лист (широкая снизу + три сверху).
    expect(result.metrics.sheetsCount).toBe(1);
    expect(result.sheets[0]?.placements).toHaveLength(4);
  });

  it("в одном ряду ставит одинаковые высоты подряд (580 рядом, не через 550)", () => {
    const result = runCuttingEngine({
      ...base,
      parts: [
        {
          id: "wide",
          name: "Широкая",
          code: "Ст-1-01-03",
          quantity: 1,
          widthMm: 2900,
          heightMm: 650,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "a580",
          name: "A",
          code: "Ст-1-06-06",
          quantity: 1,
          widthMm: 785,
          heightMm: 580,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "b550",
          name: "B",
          code: "Ст-1-03-05",
          quantity: 1,
          widthMm: 785,
          heightMm: 550,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "c550",
          name: "C",
          code: "Ст-1-03-06",
          quantity: 1,
          widthMm: 635,
          heightMm: 550,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "d580",
          name: "D",
          code: "Ст-1-06-07",
          quantity: 1,
          widthMm: 635,
          heightMm: 580,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    expect(result.status).toBe("success");
    expect(result.metrics.sheetsCount).toBe(1);

    const topRow = (result.sheets[0]?.placements ?? [])
      .filter((part) => part.heightMm === 550 || part.heightMm === 580)
      .sort((a, b) => a.xMm - b.xMm);

    expect(topRow.map((part) => part.heightMm)).toEqual([580, 580, 550, 550]);
  });
});
