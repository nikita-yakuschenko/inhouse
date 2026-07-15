import { describe, expect, it } from "vitest";
import { runCuttingEngine, type EngineInput } from "@/lib/engine";

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
    expect(placement?.label).toBe("Панель - 1");
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
      "П(Ц)-1 [01] - 1",
      "П(Ц)-1 [01] - 2",
      "П(Ц)-1 [02] - 1",
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
});
