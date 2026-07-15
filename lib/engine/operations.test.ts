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

    // Поперечный рез между рядами — только по деталям, не через боковой карман.
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
    // Только в поясе верхнего ряда — не уводим рез в верхний обрезок.
    expect(midGapCut?.y2Mm).toBeCloseTo(643.5 + 580, 1);
  });

  it("межполосный рез только в поясе деталей, не в верхний обрезок", () => {
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
      expect(Math.min(cut.y1Mm ?? 0, cut.y2Mm ?? 0)).toBe(0);
      // Высота ряда = max(550, 490); выше в обрезок не режем.
      expect(Math.max(cut.y1Mm ?? 0, cut.y2Mm ?? 0)).toBe(550);
    }
  });

  it("штрихует карман рядом с короткой деталью над широкой, а не только верх и бок", () => {
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
          partName: "Широкая",
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
          label: "wide",
        },
        {
          partId: "top",
          partName: "Верх",
          specOrder: 1,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 643.5,
          widthMm: 2315,
          heightMm: 340,
          rotationDeg: 0,
          label: "top",
        },
      ],
    };

    const sheet = toSheetResult(packed, input, {
      x: 0,
      y: 0,
      width: 3000,
      height: 1250,
    });

    // Карман справа от верхней детали: ~365 × 340
    const pocket = sheet.offcuts.find(
      (offcut) =>
        Math.abs(offcut.xMm - (2315 + kerfMm)) < 0.5 &&
        Math.abs(offcut.yMm - 643.5) < 0.5,
    );

    expect(pocket).toBeDefined();
    expect(pocket!.widthMm).toBeGreaterThan(300);
    expect(pocket!.heightMm).toBeGreaterThan(300);
  });

  it("сквозные резы: ряд и бок от края до края (L-угол обрезков)", () => {
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
          partName: "wide",
          specOrder: 0,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 0,
          widthMm: 2800,
          heightMm: 650,
          rotationDeg: 0,
          label: "Ст-1-01-03",
        },
        {
          partId: "a",
          partName: "a",
          specOrder: 1,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 653.5,
          widthMm: 785,
          heightMm: 580,
          rotationDeg: 0,
          label: "Ст-1-06-06",
        },
        {
          partId: "b",
          partName: "b",
          specOrder: 2,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 788.5,
          yMm: 653.5,
          widthMm: 785,
          heightMm: 550,
          rotationDeg: 0,
          label: "Ст-1-03-05",
        },
        {
          partId: "c",
          partName: "c",
          specOrder: 3,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 1577,
          yMm: 653.5,
          widthMm: 635,
          heightMm: 580,
          rotationDeg: 0,
          label: "Ст-1-06-07",
        },
        {
          partId: "d",
          partName: "d",
          specOrder: 4,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 2215.5,
          yMm: 653.5,
          widthMm: 635,
          heightMm: 550,
          rotationDeg: 0,
          label: "Ст-1-03-06",
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

    const side = cuts.find(
      (cut) =>
        cut.axis === "vertical" &&
        Math.abs((cut.x1Mm ?? 0) - (2850.5 + kerfMm / 2)) < 0.01,
    );
    expect(side).toBeDefined();
    // Бок только напротив крайней детали верхнего ряда (550), не через весь лист.
    expect(side?.y1Mm).toBe(653.5);
    expect(side?.y2Mm).toBe(653.5 + 550);

    const rowCut = cuts.find(
      (cut) =>
        cut.axis === "horizontal" &&
        Math.abs((cut.y1Mm ?? 0) - (650 + kerfMm / 2)) < 0.01,
    );
    expect(rowCut).toBeDefined();
    expect(rowCut?.x1Mm).toBe(0);
    // Только по нижней детали (2800), не через весь лист / боковой карман.
    expect(rowCut?.x2Mm).toBe(2800);

    // Верхний обрезок над короткой — только над деталями, не через весь лист.
    const shortTop = cuts.filter(
      (cut) =>
        cut.axis === "horizontal" &&
        Math.abs((cut.y1Mm ?? 0) - (653.5 + 550 + kerfMm / 2)) < 0.01,
    );
    expect(shortTop.length).toBeGreaterThan(0);
    expect(Math.max(...shortTop.map((cut) => cut.x2Mm ?? 0))).toBeLessThan(3000);
    expect(
      shortTop.every((cut) => (cut.x2Mm ?? 0) - (cut.x1Mm ?? 0) <= 785.01),
    ).toBe(true);
  });

  it("не режет поперечный рез сквозь верхнюю деталь при разной высоте соседей", () => {
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

    // Как на листе 16: низ 285 и сосед 345, сверху 310 начинается после 285.
    const packed: PackedSheet = {
      sheetIndex: 0,
      strips: [],
      placements: [
        {
          partId: "bottom",
          partName: "bottom",
          specOrder: 0,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 0,
          widthMm: 3000,
          heightMm: 640,
          rotationDeg: 0,
          label: "bottom",
        },
        {
          partId: "mid",
          partName: "mid",
          specOrder: 1,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 643.5,
          widthMm: 2500,
          heightMm: 285,
          rotationDeg: 0,
          label: "Ст-1-04-05",
        },
        {
          partId: "tall",
          partName: "tall",
          specOrder: 2,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 2503.5,
          yMm: 643.5,
          widthMm: 490,
          heightMm: 345,
          rotationDeg: 0,
          label: "Ст-1-01-06",
        },
        {
          partId: "top",
          partName: "top",
          specOrder: 3,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 932,
          widthMm: 1300,
          heightMm: 310,
          rotationDeg: 0,
          label: "Ст-1-02-04",
        },
      ],
    };

    const sheet = toSheetResult(packed, input, {
      x: 0,
      y: 0,
      width: 3000,
      height: 1250,
    });

    const topPart = sheet.placements.find((p) => p.label === "Ст-1-02-04")!;
    const cutsThroughTop = sheet.operations.filter((cut) => {
      if (cut.operationType !== "full_cut" || cut.axis !== "horizontal") {
        return false;
      }
      const y = cut.y1Mm ?? 0;
      if (y <= topPart.yMm + 0.5 || y >= topPart.yMm + topPart.heightMm - 0.5) {
        return false;
      }
      const x1 = Math.min(cut.x1Mm ?? 0, cut.x2Mm ?? 0);
      const x2 = Math.max(cut.x1Mm ?? 0, cut.x2Mm ?? 0);
      return x1 < topPart.xMm + topPart.widthMm - 0.5 && x2 > topPart.xMm + 0.5;
    });

    expect(cutsThroughTop).toEqual([]);
  });

  it("рядный рез не дробит боковой деловой карман 496×602", () => {
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
          partId: "full",
          partName: "full",
          specOrder: 0,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 0,
          widthMm: 3000,
          heightMm: 640,
          rotationDeg: 0,
          label: "Ст-1-05-03",
        },
        {
          partId: "mid",
          partName: "mid",
          specOrder: 1,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 643.5,
          widthMm: 2500,
          heightMm: 285,
          rotationDeg: 0,
          label: "Ст-1-04-05",
        },
        {
          partId: "top",
          partName: "top",
          specOrder: 2,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 932,
          widthMm: 1300,
          heightMm: 310,
          rotationDeg: 0,
          label: "Ст-1-02-04",
        },
      ],
    };

    const sheet = toSheetResult(packed, input, {
      x: 0,
      y: 0,
      width: 3000,
      height: 1250,
    });

    const midTopCut = sheet.operations.filter(
      (cut) =>
        cut.operationType === "full_cut" &&
        cut.axis === "horizontal" &&
        Math.abs((cut.y1Mm ?? 0) - (643.5 + 285 + kerfMm / 2)) < 0.01,
    );

    expect(midTopCut.length).toBeGreaterThan(0);
    expect(Math.max(...midTopCut.map((cut) => cut.x2Mm ?? 0))).toBeLessThanOrEqual(
      2500.01,
    );
  });

  it("боковой рез не уходит в пустоту над широкой деталью", () => {
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
          partName: "wide",
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
          label: "wide",
        },
      ],
    };

    const sheet = toSheetResult(packed, input, {
      x: 0,
      y: 0,
      width: 3000,
      height: 1250,
    });

    const side = sheet.operations.find(
      (cut) =>
        cut.operationType === "full_cut" &&
        cut.axis === "vertical" &&
        Math.abs((cut.x1Mm ?? 0) - (2680 + kerfMm / 2)) < 0.01,
    );

    expect(side).toBeDefined();
    expect(side?.y1Mm).toBe(0);
    expect(side?.y2Mm).toBe(640);
  });

  it("не режет большой боковой карман верхним поперечным резом", () => {
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
          partName: "wide",
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
          label: "Ст-1-02-02 - 1",
        },
        {
          partId: "small",
          partName: "small",
          specOrder: 1,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 643.5,
          widthMm: 345,
          heightMm: 490,
          rotationDeg: 0,
          label: "Ст-1-01-06",
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

    const topAboveSmall = cuts.filter(
      (cut) =>
        cut.axis === "horizontal" &&
        Math.abs((cut.y1Mm ?? 0) - (643.5 + 490 + kerfMm / 2)) < 0.01,
    );
    expect(topAboveSmall).toHaveLength(1);
    expect(topAboveSmall[0]?.x1Mm).toBe(0);
    expect(topAboveSmall[0]?.x2Mm).toBe(345);

    // Большой карман справа от детали не перерезаем верхним резом.
    expect(
      topAboveSmall.every((cut) => (cut.x2Mm ?? 0) < 400),
    ).toBe(true);
  });

  it("вертикальный рез у правого края верхней детали, если снизу шире", () => {
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
          partName: "wide",
          specOrder: 0,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 0,
          widthMm: 2800,
          heightMm: 650,
          rotationDeg: 0,
          label: "wide",
        },
        {
          partId: "short",
          partName: "short",
          specOrder: 1,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 0,
          yMm: 653.5,
          widthMm: 785,
          heightMm: 550,
          rotationDeg: 0,
          label: "Ст-1-03-06",
        },
        {
          partId: "mid",
          partName: "mid",
          specOrder: 2,
          instanceIndex: 1,
          instanceCount: 1,
          allowRotation: false,
          priority: 0,
          xMm: 788.5,
          yMm: 653.5,
          widthMm: 635,
          heightMm: 550,
          rotationDeg: 0,
          label: "Ст-1-03-05",
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

    // Правый край верхнего ряда: 788.5+635=1423.5 → рез у детали, не только у 2800.
    const atPartRight = cuts.find(
      (cut) =>
        cut.axis === "vertical" &&
        Math.abs((cut.x1Mm ?? 0) - (1423.5 + kerfMm / 2)) < 0.01,
    );
    expect(atPartRight).toBeDefined();
    expect(atPartRight?.y1Mm).toBeGreaterThanOrEqual(650);
    expect(atPartRight?.y2Mm).toBeCloseTo(653.5 + 550, 1);

    const side = cuts.find(
      (cut) =>
        cut.axis === "vertical" &&
        Math.abs((cut.x1Mm ?? 0) - (2800 + kerfMm / 2)) < 0.01,
    );
    expect(side).toBeDefined();
    expect(side?.y1Mm).toBe(0);
    expect(side?.y2Mm).toBe(650);
  });
});
