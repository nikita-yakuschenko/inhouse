import { describe, expect, it } from "vitest";
import { runCuttingEngine, type EngineInput } from "@/lib/engine";

const base: EngineInput = {
  projectId: "pocket",
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
    allowRotationDefault: true,
    minUsefulOffcutWidthMm: 300,
    minUsefulOffcutHeightMm: 300,
  },
};

describe("fill useful side pocket", () => {
  it("345×490 укладывается в карман 496×602 на одном листе с 3000/2500/1300", () => {
    const result = runCuttingEngine({
      ...base,
      parts: [
        {
          id: "b",
          name: "b",
          code: "Ст-1-05-03",
          quantity: 1,
          widthMm: 3000,
          heightMm: 640,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "m",
          name: "m",
          code: "Ст-1-04-05",
          quantity: 1,
          widthMm: 2500,
          heightMm: 285,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "t",
          name: "t",
          code: "Ст-1-02-04",
          quantity: 1,
          widthMm: 1300,
          heightMm: 310,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "s",
          name: "s",
          code: "Ст-1-01-06",
          quantity: 1,
          widthMm: 345,
          heightMm: 490,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "w",
          name: "w",
          code: "Ст-1-02-02",
          quantity: 1,
          widthMm: 2680,
          heightMm: 640,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const dump = result.sheets
      .map((sheet) => {
        const lines = sheet.placements
          .map((p) => `${p.label} ${p.widthMm}x${p.heightMm}@${p.xMm},${p.yMm}`)
          .join("; ");
        return `sheet ${sheet.sheetIndex}: ${lines}`;
      })
      .join("\n");

    // eslint-disable-next-line no-console
    console.log(dump);

    const withPocketHost = result.sheets.find((sheet) =>
      sheet.placements.some((p) => p.label.includes("Ст-1-05-03")),
    );
    expect(withPocketHost).toBeDefined();
    expect(
      withPocketHost!.placements.some((p) => p.label.includes("Ст-1-01-06")),
    ).toBe(true);
  });
});
