import { describe, expect, it } from "vitest";
import {
  applySheetSelection,
  findSheetArrayIndex,
} from "@/lib/cut-plan/panel-workspace-state";
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

describe("panel-workspace-state", () => {
  const sheets = [sheet("a", 1), sheet("a", 2), sheet("b", 3)];
  const parts = [
    { id: "a", quantity: 2 },
    { id: "b", quantity: 1 },
  ];

  it("читает номер листа из query", () => {
    expect(findSheetArrayIndex(sheets, "2")).toBe(1);
    expect(findSheetArrayIndex(sheets, null)).toBe(0);
    expect(findSheetArrayIndex(sheets, "99")).toBe(0);
  });

  it("включает группировку при первичной загрузке листа серии", () => {
    expect(applySheetSelection(parts, sheets, 1)).toEqual({
      sheetIdx: 1,
      groupedPartId: "a",
    });
  });

  it("не группирует одиночную деталь при загрузке", () => {
    expect(applySheetSelection(parts, sheets, 2)).toEqual({
      sheetIdx: 2,
      groupedPartId: null,
    });
  });
});
