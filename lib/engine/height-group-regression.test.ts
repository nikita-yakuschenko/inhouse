import { describe, expect, it } from "vitest";
import { runCuttingEngine, type EngineInput } from "@/lib/engine";

const base: EngineInput = {
  projectId: "group",
  mode: "production",
  machine: {
    kerfMm: 3.5,
    minSafePartWidthMm: 80,
    minSafePartHeightMm: 80,
    supportsStopCut: true,
    supportsInternalCut: true,
    requiresCornerDrillingForInternalCut: false,
    preferredPrimaryAxis: "auto",
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

describe("height grouping regression sheet 17", () => {
  it("лист 17: широкий низ + 580/550 чередование → 580,580,550,550", () => {
    const result = runCuttingEngine({
      ...base,
      parts: [
        {
          id: "w",
          name: "wide",
          code: "Ст-1-01-03",
          quantity: 1,
          widthMm: 2800,
          heightMm: 650,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "a",
          name: "a",
          code: "Ст-1-06-06",
          quantity: 1,
          widthMm: 785,
          heightMm: 580,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "b",
          name: "b",
          code: "Ст-1-03-05",
          quantity: 1,
          widthMm: 785,
          heightMm: 550,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "c",
          name: "c",
          code: "Ст-1-06-07",
          quantity: 1,
          widthMm: 635,
          heightMm: 580,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "d",
          name: "d",
          code: "Ст-1-03-06",
          quantity: 1,
          widthMm: 635,
          heightMm: 550,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    expect(result.status).toBe("success");

    const sheet =
      result.sheets.find((s) => s.placements.length >= 5) ?? result.sheets[0]!;

    const dump = [...sheet.placements]
      .sort((a, b) => a.yMm - b.yMm || a.xMm - b.xMm)
      .map((p) => `${p.label} x=${p.xMm} y=${p.yMm} ${p.widthMm}x${p.heightMm}`);
    // eslint-disable-next-line no-console
    console.log(dump.join("\n"));

    const topParts = sheet.placements
      .filter((p) => p.heightMm === 550 || p.heightMm === 580)
      .sort((a, b) => a.xMm - b.xMm);

    expect(topParts.map((p) => p.heightMm)).toEqual([580, 580, 550, 550]);
  });
});
