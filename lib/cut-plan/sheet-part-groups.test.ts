import { describe, expect, it } from "vitest";
import {
  buildSheetTabSegments,
  buildStructuralSheetTabSegments,
  getSheetIndicesForPart,
  resolveGroupedPartId,
} from "@/lib/cut-plan/sheet-part-groups";
import type { ClientCutPlanSheet } from "@/features/projects/serialize-panels";

function sheet(partId: string, sheetIndex: number): ClientCutPlanSheet {
  return {
    id: `S${sheetIndex}`,
    sheetIndex,
    widthMm: 1250,
    heightMm: 2500,
    usableXmm: 0,
    usableYmm: 0,
    usableWidthMm: 1250,
    usableHeightMm: 2500,
    placements: [
      {
        id: `P${sheetIndex}`,
        partId,
        partInstanceIndex: 1,
        xMm: 0,
        yMm: 0,
        widthMm: 900,
        heightMm: 1330,
        rotationDeg: 0,
        label: "test",
      },
    ],
    operations: [],
    plannedOffcuts: [],
  };
}

describe("sheet-part-groups", () => {
  it("находит индексы листов по partId", () => {
    const sheets = [sheet("a", 1), sheet("b", 2), sheet("a", 3)];
    expect(getSheetIndicesForPart(sheets, "a")).toEqual([0, 2]);
  });

  it("группирует подряд идущие вкладки одной детали", () => {
    expect(buildSheetTabSegments(5, [1, 2, 3])).toEqual([
      { kind: "single", indices: [0] },
      { kind: "group", indices: [1, 2, 3] },
      { kind: "single", indices: [4] },
    ]);
  });

  it("без группы возвращает одиночные сегменты", () => {
    expect(buildSheetTabSegments(3, null)).toEqual([
      { kind: "single", indices: [0] },
      { kind: "single", indices: [1] },
      { kind: "single", indices: [2] },
    ]);
  });

  it("включает группировку только для деталей с количеством 2 и более", () => {
    const sheets = [sheet("a", 1), sheet("a", 2), sheet("b", 3)];
    const parts = [
      { id: "a", quantity: 3 },
      { id: "b", quantity: 1 },
    ];

    expect(resolveGroupedPartId(parts, sheets, "a")).toBe("a");
    expect(resolveGroupedPartId(parts, sheets, "b")).toBeNull();
  });

  it("резервирует слоты группы для деталей с количеством 2 и более", () => {
    const sheets = [
      sheet("a", 1),
      sheet("a", 2),
      sheet("a", 3),
      sheet("b", 4),
      sheet("c", 5),
      sheet("c", 6),
    ];
    const parts = [
      { id: "a", quantity: 3 },
      { id: "b", quantity: 1 },
      { id: "c", quantity: 2 },
    ];

    expect(buildStructuralSheetTabSegments(sheets, parts)).toEqual([
      { kind: "group", indices: [0, 1, 2] },
      { kind: "single", indices: [3] },
      { kind: "group", indices: [4, 5] },
    ]);
  });
});
