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

describe("runCuttingEngine", () => {
  it("раскладывает несколько деталей на один лист", () => {
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
    expect(result.metrics.sheetsCount).toBe(1);
    expect(result.sheets[0]?.placements).toHaveLength(3);
    expect(result.sheets[0]?.operations.length).toBeGreaterThan(0);
  });

  it("для 220 деталей 200x200 на 2500x1250 использует несколько деталей на лист", () => {
    const result = runCuttingEngine({
      ...baseInput,
      parts: [
        {
          id: "p1",
          name: "Квадрат",
          quantity: 220,
          widthMm: 200,
          heightMm: 200,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    expect(result.status).toBe("success");
    // usable 2500x1250, kerf 4 → до 12×6 = 72 на лист → ceil(220/72) = 4
    expect(result.metrics.sheetsCount).toBe(4);
    expect(result.sheets[0]?.placements.length).toBeGreaterThan(1);
    expect(
      result.sheets.reduce((sum, sheet) => sum + sheet.placements.length, 0),
    ).toBe(220);
  });

  it("рабочая зона на весь лист без технологической подрезки", () => {
    const result = runCuttingEngine({
      ...baseInput,
      sheet: {
        ...baseInput.sheet,
        trimLeftMm: 0,
        trimRightMm: 0,
        trimTopMm: 0,
        trimBottomMm: 0,
      },
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
    expect(sheet?.usableXmm).toBe(0);
    expect(sheet?.usableYmm).toBe(0);
    expect(sheet?.usableWidthMm).toBe(2500);
    expect(sheet?.placements[0]?.xMm).toBe(0);
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

  it("для 3×1200×570 + 5×1150×560 ставит детали вертикально и снижает число резов", () => {
    const result = runCuttingEngine({
      ...baseInput,
      machine: {
        ...baseInput.machine,
        preferredPrimaryAxis: "auto",
      },
      parts: [
        {
          id: "p1",
          name: "Деталь 1",
          quantity: 3,
          widthMm: 1200,
          heightMm: 570,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "p2",
          name: "Деталь 2",
          quantity: 5,
          widthMm: 1150,
          heightMm: 560,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    expect(result.status).toBe("success");
    expect(result.metrics.sheetsCount).toBe(2);

    const placements = result.sheets.flatMap((sheet) => sheet.placements);
    expect(placements).toHaveLength(8);
    // Узкие вертикальные полосы: ширина ≈ 560/570, высота ≈ 1150/1200
    expect(placements.every((p) => p.widthMm < p.heightMm)).toBe(true);
    expect(placements.every((p) => p.rotationDeg === 90)).toBe(true);

    // Полные резы: меньше, чем при «лежачей» раскладке (~20)
    expect(result.metrics.setupChangesCount).toBeLessThanOrEqual(12);
  });

  it("кладёт 580 мм деталь рядом с 550 мм в остаток над широкой, а не на новый лист", () => {
    const result = runCuttingEngine({
      ...baseInput,
      machine: { ...baseInput.machine, kerfMm: 3.5 },
      sheet: {
        widthMm: 3000,
        heightMm: 1250,
        trimLeftMm: 0,
        trimRightMm: 0,
        trimTopMm: 0,
        trimBottomMm: 0,
      },
      parts: [
        {
          id: "wide",
          name: "456 [02]",
          code: "02",
          quantity: 1,
          widthMm: 2680,
          heightMm: 640,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "p05",
          name: "456 [05]",
          code: "05",
          quantity: 1,
          widthMm: 785,
          heightMm: 550,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "p06a",
          name: "456 [06]",
          code: "06",
          quantity: 1,
          widthMm: 345,
          heightMm: 490,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "p06b",
          name: "456 [06]",
          code: "06",
          quantity: 1,
          widthMm: 635,
          heightMm: 550,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "p07",
          name: "456 [07]",
          code: "07",
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
    const labels = result.sheets[0]?.placements.map((p) => p.label) ?? [];
    expect(labels).toContain("07");
    expect(labels).toContain("05");
  });
});

