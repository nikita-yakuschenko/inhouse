import { describe, expect, it } from "vitest";
import {
  aggregateMarkingOnlyPartQty,
  aggregatePartQtyOnSheet,
  buildMarkingOnlySheetMap,
  buildPdfPageLegendLines,
  formatPdfBlankSheetsLine,
  formatPdfPartQtyLine,
  pdfWorkKindStampLabel,
} from "@/lib/cut-plan/pdf-page-legend";
import type {
  ClientCutPlanSheet,
  ClientPart,
} from "@/features/projects/serialize-panels";

describe("pdf-page-legend", () => {
  it("форматирует штамп UPPERCASE и строки шапки", () => {
    expect(pdfWorkKindStampLabel("cutting_and_marking")).toBe(
      "РАСКРОЙ И МАРКИРОВКА",
    );
    expect(pdfWorkKindStampLabel("cutting_only")).toBe("РАСКРОЙ");
    expect(pdfWorkKindStampLabel("marking_only")).toBe("МАРКИРОВКА");
    expect(formatPdfPartQtyLine({ marking: "Ст-1-02-01", quantity: 2 })).toBe(
      "Деталь Ст-1-02-01 - 2 шт",
    );
    expect(formatPdfBlankSheetsLine("Плита ГСПВ", 14)).toBe(
      "Листов заготовки Плита ГСПВ - 14 шт",
    );
  });

  it("собирает легенду без типа работ (он в штампе)", () => {
    expect(
      buildPdfPageLegendLines({
        partLines: [
          { marking: "Ст-1-01-01", quantity: 1 },
          { marking: "Ст-1-01-02", quantity: 3 },
        ],
        materialName: "Плита",
        blankSheetsCount: 4,
      }),
    ).toEqual([
      "Деталь Ст-1-01-01 - 1 шт",
      "Деталь Ст-1-01-02 - 3 шт",
      "Листов заготовки Плита - 4 шт",
    ]);
  });

  it("агрегирует детали на листе раскроя по маркировке", () => {
    const partsById = new Map<string, ClientPart>([
      [
        "pt1",
        {
          id: "pt1",
          name: "Обшивка Ст-1-02",
          code: "01",
          widthMm: 500,
          heightMm: 300,
          quantity: 2,
          allowRotation: true,
        },
      ],
      [
        "pt2",
        {
          id: "pt2",
          name: "Обшивка Ст-1-02",
          code: "02",
          widthMm: 400,
          heightMm: 300,
          quantity: 1,
          allowRotation: true,
        },
      ],
    ]);

    const sheet = {
      id: "sh1",
      sheetIndex: 1,
      widthMm: 3000,
      heightMm: 1250,
      usableXmm: 0,
      usableYmm: 0,
      usableWidthMm: 3000,
      usableHeightMm: 1250,
      placements: [
        {
          id: "a",
          partId: "pt1",
          partInstanceIndex: 1,
          xMm: 0,
          yMm: 0,
          widthMm: 500,
          heightMm: 300,
          rotationDeg: 0,
          label: "Ст-1-02-01",
        },
        {
          id: "b",
          partId: "pt1",
          partInstanceIndex: 2,
          xMm: 510,
          yMm: 0,
          widthMm: 500,
          heightMm: 300,
          rotationDeg: 0,
          label: "Ст-1-02-01 - 2",
        },
        {
          id: "c",
          partId: "pt2",
          partInstanceIndex: 1,
          xMm: 1020,
          yMm: 0,
          widthMm: 400,
          heightMm: 300,
          rotationDeg: 0,
          label: "Ст-1-02-02",
        },
      ],
      operations: [],
      plannedOffcuts: [],
    } as ClientCutPlanSheet;

    expect(aggregatePartQtyOnSheet(sheet, partsById)).toEqual([
      { marking: "Ст-1-02-01", quantity: 2 },
      { marking: "Ст-1-02-02", quantity: 1 },
    ]);
  });

  it("собирает только детали под маркировку с количеством", () => {
    const parts: ClientPart[] = [
      {
        id: "cut",
        name: "Резать Ст-1-01",
        code: "01",
        widthMm: 500,
        heightMm: 300,
        quantity: 2,
        allowRotation: true,
      },
      {
        id: "m1",
        name: "Целый Ст-2-01",
        code: "01",
        widthMm: 3000,
        heightMm: 1250,
        quantity: 5,
        allowRotation: true,
      },
      {
        id: "m2",
        name: "Целый Ст-2-02",
        code: "01",
        widthMm: 1250,
        heightMm: 3000,
        quantity: 2,
        allowRotation: true,
      },
    ];

    expect(aggregateMarkingOnlyPartQty(parts, 3000, 1250)).toEqual([
      { marking: "Ст-2-01-01", quantity: 5 },
      { marking: "Ст-2-02-01", quantity: 2 },
    ]);
  });

  it("строит схему целого листа под маркировку", () => {
    const sheet = buildMarkingOnlySheetMap({
      sheetWidthMm: 3000,
      sheetHeightMm: 1250,
      marking: "Ст-2-01-01",
      partId: "m1",
      partWidthMm: 3000,
      partHeightMm: 1250,
    });
    expect(sheet.widthMm).toBe(3000);
    expect(sheet.heightMm).toBe(1250);
    expect(sheet.placements).toHaveLength(1);
    expect(sheet.placements[0]).toMatchObject({
      label: "Ст-2-01-01",
      widthMm: 3000,
      heightMm: 1250,
      xMm: 0,
      yMm: 0,
    });
  });
});
