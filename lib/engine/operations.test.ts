import { describe, expect, it } from "vitest";
import { runCuttingEngine, type EngineInput, type PackedSheet } from "@/lib/engine";
import { toSheetResult } from "@/lib/engine/operations";

const singlePartInput: EngineInput = {
  projectId: "test",
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
    widthMm: 1250,
    heightMm: 2500,
    trimLeftMm: 0,
    trimRightMm: 0,
    trimTopMm: 0,
    trimBottomMm: 0,
  },
  parts: [
    {
      id: "p1",
      name: "Панель",
      quantity: 1,
      widthMm: 900,
      heightMm: 1330,
      shapeType: "rectangle",
      allowRotation: false,
      grainDirectionRequired: false,
      priority: 0,
    },
  ],
  offcuts: [],
  settings: {
    useOffcutsFirst: true,
    allowRotationDefault: true,
    minUsefulOffcutWidthMm: 300,
    minUsefulOffcutHeightMm: 300,
  },
};

describe("buildGuillotineCuts", () => {
  it("размещает деталь у нижнего упора", () => {
    const result = runCuttingEngine(singlePartInput);
    const placement = result.sheets[0]?.placements[0];
    expect(placement?.xMm).toBe(0);
    expect(placement?.yMm).toBe(0);
    expect(placement?.label).toBe("Панель");
  });

  it("нумерует одинаковые детали в маркировке", () => {
    const result = runCuttingEngine({
      ...singlePartInput,
      parts: [
        {
          id: "p1",
          name: "П(Ц)-1 [01]",
          quantity: 3,
          widthMm: 400,
          heightMm: 400,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const labels = result.sheets.flatMap((sheet) =>
      sheet.placements.map((placement) => placement.label),
    );

    expect(labels).toEqual([
      "П(Ц)-1 [01] - 1",
      "П(Ц)-1 [01] - 2",
      "П(Ц)-1 [01] - 3",
    ]);
    expect(result.metrics.sheetsCount).toBe(1);
  });

  it("на карте пишет код детали, а не длинное имя", () => {
    const result = runCuttingEngine({
      ...singlePartInput,
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
          id: "p1",
          name: "Плитная обшивка внешняя Ст-1-01",
          code: "02",
          quantity: 1,
          widthMm: 1000,
          heightMm: 2900,
          shapeType: "rectangle",
          allowRotation: true,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    expect(result.status).toBe("success");
    expect(result.sheets[0]?.placements[0]?.label).toBe("Ст-1-01-02");
  });
  it("раскладывает детали по порядку спецификации и экземпляров", () => {
    const result = runCuttingEngine({
      ...singlePartInput,
      parts: [
        {
          id: "p2",
          name: "П(Ц)-1 [02]",
          code: "02",
          quantity: 1,
          widthMm: 400,
          heightMm: 400,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
        {
          id: "p1",
          name: "П(Ц)-1 [01]",
          code: "01",
          quantity: 2,
          widthMm: 400,
          heightMm: 400,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const labels = result.sheets.flatMap((sheet) =>
      sheet.placements.map((placement) => placement.label),
    );

    expect(labels).toEqual([
      "01 - 1",
      "01 - 2",
      "02",
    ]);
  });

  it("строит резы: сначала поперёк листа, затем продольно в нижней зоне", () => {
    const result = runCuttingEngine(singlePartInput);
    const cuts = result.sheets[0]?.operations.filter(
      (operation) => operation.operationType === "full_cut",
    );

    expect(cuts).toHaveLength(2);
    expect(cuts?.[0]?.axis).toBe("vertical");
    expect(cuts?.[0]?.x1Mm).toBe(902);
    expect(cuts?.[1]?.axis).toBe("horizontal");
    expect(cuts?.[1]?.y1Mm).toBe(1332);
  });

  it("учитывает дробный пропил в размере бокового обрезка", () => {
    const result = runCuttingEngine({
      ...singlePartInput,
      machine: { ...singlePartInput.machine, kerfMm: 3.5 },
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
          id: "p1",
          name: "Деталь",
          quantity: 1,
          widthMm: 2680,
          heightMm: 1250,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const sheet = result.sheets[0];
    const placement = sheet?.placements[0];
    const rightOffcut = sheet?.offcuts.find((offcut) => offcut.xMm > 0);

    expect(placement?.widthMm).toBe(2680);
    // 3000 − 2680 − kerf3.5 = 316.5
    expect(rightOffcut?.widthMm).toBe(316.5);
    expect(rightOffcut?.xMm).toBe(2683.5);
    expect(
      (placement?.widthMm ?? 0) + 3.5 + (rightOffcut?.widthMm ?? 0),
    ).toBe(3000);
  });

  it("учитывает ширину пропила в размере бокового обрезка", () => {
    const result = runCuttingEngine({
      ...singlePartInput,
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
          id: "p1",
          name: "Деталь",
          quantity: 1,
          widthMm: 2680,
          heightMm: 1250,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const sheet = result.sheets[0];
    const placement = sheet?.placements[0];
    const rightOffcut = sheet?.offcuts.find((offcut) => offcut.xMm > 0);

    expect(placement?.widthMm).toBe(2680);
    // 3000 − 2680 − kerf4 = 316, а не 320
    expect(rightOffcut?.widthMm).toBe(316);
    expect(rightOffcut?.xMm).toBe(2684);
    expect(
      (placement?.widthMm ?? 0) +
        singlePartInput.machine.kerfMm +
        (rightOffcut?.widthMm ?? 0),
    ).toBe(3000);
  });

  it("строит поперечный рез для детали на всю ширину листа", () => {
    const result = runCuttingEngine({
      ...singlePartInput,
      parts: [
        {
          id: "p4",
          name: "П(Ц)-1 [04]",
          quantity: 1,
          widthMm: 1250,
          heightMm: 2010,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const cuts = result.sheets[0]?.operations.filter(
      (operation) => operation.operationType === "full_cut",
    );

    expect(cuts).toHaveLength(1);
    expect(cuts?.[0]?.axis).toBe("horizontal");
    expect(cuts?.[0]?.y1Mm).toBe(2012);
  });

  it("не добавляет подрезку кромок даже при ненулевом trim", () => {
    const result = runCuttingEngine({
      ...singlePartInput,
      sheet: {
        ...singlePartInput.sheet,
        trimLeftMm: 5,
        trimRightMm: 5,
        trimTopMm: 5,
        trimBottomMm: 5,
      },
    });

    const trimCuts = result.sheets[0]?.operations.filter(
      (operation) => operation.operationType === "trim_cut",
    );

    expect(trimCuts).toEqual([]);
  });

  it("не проводит продольные резы через широкую деталь под узкими полосами", () => {
    // Раскладка как на карте: широкая снизу, две узкие сверху с разными x.
    const kerfMm = 3.5;
    const input: EngineInput = {
      ...singlePartInput,
      machine: { ...singlePartInput.machine, kerfMm },
      sheet: {
        widthMm: 3000,
        heightMm: 1250,
        trimLeftMm: 0,
        trimRightMm: 0,
        trimTopMm: 0,
        trimBottomMm: 0,
      },
      parts: [],
    };

    const packed: PackedSheet = {
      sheetIndex: 0,
      strips: [],
      placements: [
        {
          partId: "wide",
          partName: "456 [02]",
          specOrder: 0,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 0,
          widthMm: 2680,
          heightMm: 640,
          rotationDeg: 0,
          label: "456 [02] - 1",
        },
        {
          partId: "left",
          partName: "456 [06]",
          specOrder: 1,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 643.5,
          widthMm: 785,
          heightMm: 580,
          rotationDeg: 0,
          label: "456 [06] - 1",
        },
        {
          partId: "mid",
          partName: "456 [07]",
          specOrder: 2,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 788.5,
          yMm: 643.5,
          widthMm: 635,
          heightMm: 580,
          rotationDeg: 0,
          label: "456 [07] - 1",
        },
      ],
    };

    const sheet = toSheetResult(packed, input, {
      x: 0,
      y: 0,
      width: 3000,
      height: 1250,
    });

    const cuts = sheet.operations.filter(
      (operation) => operation.operationType === "full_cut",
    );

    // Было: вертикальный рез на всю высоту через 2680×640 — больше не должен.
    const verticalThroughWide = cuts.filter((cut) => {
      if (cut.axis !== "vertical") return false;
      const x = cut.x1Mm ?? 0;
      if (x <= 0.5 || x >= 2679.5) return false;
      const y1 = Math.min(cut.y1Mm ?? 0, cut.y2Mm ?? 0);
      const y2 = Math.max(cut.y1Mm ?? 0, cut.y2Mm ?? 0);
      return y1 < 639.5 && y2 > 0.5;
    });
    expect(verticalThroughWide).toEqual([]);

    for (const cut of cuts) {
      for (const part of sheet.placements) {
        if (cut.axis === "vertical") {
          const x = cut.x1Mm ?? 0;
          const insideX = x > part.xMm + 0.5 && x < part.xMm + part.widthMm - 0.5;
          if (!insideX) continue;

          const y1 = Math.min(cut.y1Mm ?? 0, cut.y2Mm ?? 0);
          const y2 = Math.max(cut.y1Mm ?? 0, cut.y2Mm ?? 0);
          const overlapsY =
            y1 < part.yMm + part.heightMm - 0.5 && y2 > part.yMm + 0.5;
          expect(overlapsY).toBe(false);
        }

        if (cut.axis === "horizontal") {
          const y = cut.y1Mm ?? 0;
          const insideY = y > part.yMm + 0.5 && y < part.yMm + part.heightMm - 0.5;
          if (!insideY) continue;

          const x1 = Math.min(cut.x1Mm ?? 0, cut.x2Mm ?? 0);
          const x2 = Math.max(cut.x1Mm ?? 0, cut.x2Mm ?? 0);
          const overlapsX =
            x1 < part.xMm + part.widthMm - 0.5 && x2 > part.xMm + 0.5;
          expect(overlapsX).toBe(false);
        }
      }
    }

    // Поперечный рез под верхней деталью — по её ширине, не по 2680.
    const leftCross = cuts.find(
      (cut) =>
        cut.axis === "horizontal" &&
        cut.targetPartId === "wide" &&
        Math.abs((cut.y1Mm ?? 0) - 641.75) < 0.01,
    );
    expect(leftCross).toBeDefined();
    expect(Math.abs((leftCross?.x2Mm ?? 0) - (leftCross?.x1Mm ?? 0))).toBe(2680);

    const midGapCut = cuts.find(
      (cut) =>
        cut.axis === "vertical" &&
        Math.abs((cut.x1Mm ?? 0) - (788.5 - kerfMm / 2)) < 0.01,
    );
    expect(midGapCut).toBeDefined();
    expect(midGapCut?.y1Mm).toBeGreaterThanOrEqual(640);
    // Не тянем рез в пустоту выше обеих верхних деталей.
    expect(midGapCut?.y2Mm).toBeLessThanOrEqual(643.5 + 580 + 0.01);
  });

  it("не тянет межполосный рез в пустоту выше более низкой детали", () => {
    const kerfMm = 3.5;
    const input: EngineInput = {
      ...singlePartInput,
      machine: { ...singlePartInput.machine, kerfMm },
      sheet: {
        widthMm: 3000,
        heightMm: 1250,
        trimLeftMm: 0,
        trimRightMm: 0,
        trimTopMm: 0,
        trimBottomMm: 0,
      },
      parts: [],
    };

    const packed: PackedSheet = {
      sheetIndex: 0,
      strips: [],
      placements: [
        {
          partId: "tall",
          partName: "A",
          specOrder: 0,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 0,
          widthMm: 785,
          heightMm: 550,
          rotationDeg: 0,
          label: "A - 1",
        },
        {
          partId: "short",
          partName: "B",
          specOrder: 1,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 788.5,
          yMm: 0,
          widthMm: 345,
          heightMm: 490,
          rotationDeg: 0,
          label: "B - 1",
        },
      ],
    };

    const sheet = toSheetResult(packed, input, {
      x: 0,
      y: 0,
      width: 3000,
      height: 1250,
    });

    const gapCuts = sheet.operations.filter(
      (cut) =>
        cut.operationType === "full_cut" &&
        cut.axis === "vertical" &&
        Math.abs((cut.x1Mm ?? 0) - (788.5 - kerfMm / 2)) < 0.01,
    );

    expect(gapCuts.length).toBeGreaterThan(0);
    for (const cut of gapCuts) {
      // Пересечение высот 550 и 490 → рез не выше 490.
      expect(Math.max(cut.y1Mm ?? 0, cut.y2Mm ?? 0)).toBeLessThanOrEqual(490.01);
    }
  });
});
