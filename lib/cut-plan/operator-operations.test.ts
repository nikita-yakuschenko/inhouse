import { describe, expect, it } from "vitest";
import { runCuttingEngine, type EngineInput } from "@/lib/engine";
import { buildOperatorWorkflowSteps, resolveOperationsSheetContext } from "@/lib/cut-plan/operator-operations";

const baseInput: EngineInput = {
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
  parts: [],
  offcuts: [],
  settings: {
    useOffcutsFirst: true,
    allowRotationDefault: true,
    minUsefulOffcutWidthMm: 300,
    minUsefulOffcutHeightMm: 300,
  },
};

describe("buildOperatorWorkflowSteps", () => {
  it("строит семь шагов для детали П(Ц)-1 [01] - 1", () => {
    const result = runCuttingEngine({
      ...baseInput,
      parts: [
        {
          id: "p1",
          name: "П(Ц)-1 [01]",
          quantity: 1,
          widthMm: 1250,
          heightMm: 1970,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const sheet = result.sheets[0]!;
    const steps = buildOperatorWorkflowSteps(sheet.operations, sheet.placements);

    expect(steps.map((step) => step.description)).toEqual([
      "Установить заготовку",
      "Выполнить позиционирование пилы для реза № 1",
      "Выполнить рез № 1",
      "Отделить и удалить обрезок № 1",
      "Нанести маркировку на деталь П(Ц)-1 [01] - 1",
      "Извлечь готовую деталь П(Ц)-1 [01] - 1",
      "Разместить готовую деталь П(Ц)-1 [01] - 1 в месте складирования",
    ]);
  });

  it("строит десять шагов для детали П(Ц)-1 [06] - 1 с двумя резами", () => {
    const result = runCuttingEngine({
      ...baseInput,
      parts: [
        {
          id: "p6",
          name: "П(Ц)-1 [06]",
          quantity: 1,
          widthMm: 900,
          heightMm: 1970,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const sheet = result.sheets[0]!;
    const steps = buildOperatorWorkflowSteps(sheet.operations, sheet.placements);

    expect(steps.map((step) => step.description)).toEqual([
      "Установить заготовку",
      "Выполнить позиционирование пилы для реза № 1",
      "Выполнить рез № 1",
      "Отделить и удалить обрезок № 1",
      "Выполнить позиционирование пилы для реза № 2",
      "Выполнить рез № 2",
      "Отделить и удалить обрезок № 2",
      "Нанести маркировку на деталь П(Ц)-1 [06] - 1",
      "Извлечь готовую деталь П(Ц)-1 [06] - 1",
      "Разместить готовую деталь П(Ц)-1 [06] - 1 в месте складирования",
    ]);
  });
});

describe("resolveOperationsSheetContext", () => {
  it("возвращает марку детали, экземпляр и лист для заголовка", () => {
    const result = runCuttingEngine({
      ...baseInput,
      parts: [
        {
          id: "p2",
          name: "П(Ц)-1 [02]",
          quantity: 1,
          widthMm: 1250,
          heightMm: 1330,
          shapeType: "rectangle",
          allowRotation: false,
          grainDirectionRequired: false,
          priority: 0,
        },
      ],
    });

    const sheet = result.sheets[0]!;

    expect(
      resolveOperationsSheetContext(sheet, [
        {
          id: "p2",
          name: "П(Ц)-1 [02]",
          code: "02",
          widthMm: 1250,
          heightMm: 1330,
          quantity: 1,
          allowRotation: false,
        },
      ]),
    ).toEqual({
      placementLabel: "П(Ц)-1 [02] - 1",
    });
  });
});
