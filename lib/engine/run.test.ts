import { describe, expect, it } from "vitest";
import { runCuttingEngine, type EngineInput } from "@/lib/engine";

const baseInput: EngineInput = {
  projectId: "test-project",
  mode: "production",
  machine: {
    kerfMm: 4,
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
    widthMm: 2500,
    heightMm: 1250,
    trimLeftMm: 5,
    trimRightMm: 5,
    trimTopMm: 5,
    trimBottomMm: 5,
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

describe("runCuttingEngine", () => {
  it("выделяет отдельный лист на каждый экземпляр детали", () => {
    const result = runCuttingEngine({
      ...baseInput,
      parts: [
        {
          id: "p1",
          name: "Панель A",
          quantity: 2,
          widthMm: 600,
          heightMm: 700,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "p2",
          name: "Панель B",
          quantity: 1,
          widthMm: 900,
          heightMm: 500,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    expect(result.status).toBe("success");
    expect(result.metrics.sheetsCount).toBe(3);
    expect(result.sheets.every((sheet) => sheet.placements.length === 1)).toBe(true);
    expect(result.sheets[0]?.operations.length).toBeGreaterThan(0);
  });

  it("учитывает kerf и trim в рабочей зоне", () => {
    const result = runCuttingEngine({
      ...baseInput,
      parts: [
        {
          id: "p1",
          name: "Малая",
          quantity: 1,
          widthMm: 200,
          heightMm: 200,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const sheet = result.sheets[0];
    expect(sheet?.usableXmm).toBe(5);
    expect(sheet?.usableYmm).toBe(5);
    expect(sheet?.usableWidthMm).toBe(2490);
    expect(sheet?.placements[0]?.xMm).toBeGreaterThanOrEqual(5);
  });

  it("возвращает ошибку если деталь не помещается", () => {
    const result = runCuttingEngine({
      ...baseInput,
      parts: [
        {
          id: "p1",
          name: "Гигант",
          quantity: 1,
          widthMm: 3000,
          heightMm: 3000,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    expect(result.status).toBe("failed");
    expect(result.errors?.[0]).toContain("не помещается");
  });

  it("может использовать поворот детали", () => {
    const result = runCuttingEngine({
      ...baseInput,
      sheet: {
        widthMm: 1000,
        heightMm: 600,
        trimLeftMm: 0,
        trimRightMm: 0,
        trimTopMm: 0,
        trimBottomMm: 0,
      },
      parts: [
        {
          id: "p1",
          name: "Поворачиваемая",
          quantity: 1,
          widthMm: 500,
          heightMm: 900,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    expect(result.status).toBe("success");
    expect(result.sheets[0]?.placements[0]?.rotationDeg).toBe(90);
  });
});
