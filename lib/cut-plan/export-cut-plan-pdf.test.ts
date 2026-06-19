import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import { collectCutPlanPdfSheets } from "@/lib/cut-plan/cut-plan-pdf-shared";
import { buildCutPlanPdfBytes } from "@/lib/cut-plan/export-cut-plan-pdf";
import { buildSheetMapSvg } from "@/lib/cut-plan/sheet-map-svg";
import type { ClientPanel } from "@/features/projects/serialize-panels";

function pdfText(bytes: Uint8Array) {
  return new TextDecoder("latin1").decode(bytes);
}

describe("buildCutPlanPdfBytes", () => {
  it("produces a fully vector PDF with embedded cyrillic text and no raster images", async () => {
    const panels: ClientPanel[] = [
      {
        id: "pn01",
        name: "Панель П(Ц)-1",
        parts: [],
        cutPlans: [
          {
            id: "cp01",
            totalSheetsCount: 1,
            totalOperationsCount: 1,
            wastePercent: 5,
            sheets: [
              {
                id: "sh01",
                sheetIndex: 1,
                widthMm: 2500,
                heightMm: 1250,
                usableXmm: 5,
                usableYmm: 5,
                usableWidthMm: 2490,
                usableHeightMm: 1240,
                placements: [
                  {
                    id: "pl01",
                    partId: "pt01",
                    partInstanceIndex: 1,
                    xMm: 10,
                    yMm: 10,
                    widthMm: 500,
                    heightMm: 300,
                    rotationDeg: 0,
                    label: "01",
                  },
                ],
                operations: [
                  {
                    id: "op01",
                    sequenceNumber: 1,
                    operationType: "full_cut",
                    axis: "horizontal",
                    x1Mm: 0,
                    y1Mm: 320,
                    x2Mm: 2490,
                    y2Mm: 320,
                    note: null,
                  },
                ],
                plannedOffcuts: [
                  {
                    id: "of01",
                    xMm: 520,
                    yMm: 10,
                    widthMm: 400,
                    heightMm: 300,
                    isUseful: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const bytes = await buildCutPlanPdfBytes(
      {
        projectName: "Тестовый расчёт",
        projectId: "pr01",
        materialLabel: "ЛДСП 16 мм",
      },
      collectCutPlanPdfSheets(panels),
    );

    const text = pdfText(bytes);
    const pdfDoc = await PDFDocument.load(bytes);

    expect(text.startsWith("%PDF-")).toBe(true);
    expect(pdfDoc.getPageCount()).toBe(1);
    expect(text).not.toMatch(/\/Subtype\s*\/Image/);
    expect(text).not.toMatch(/\/DCTDecode/);
    expect(bytes.length).toBeGreaterThan(5_000);
    expect(bytes.length).toBeLessThan(500_000);
  });
});

describe("buildSheetMapSvg", () => {
  it("returns vector svg with placements, hatch lines and cut lines", () => {
    const svg = buildSheetMapSvg({
      mapId: "sheet01",
      sheetIndex: 1,
      widthMm: 2500,
      heightMm: 1250,
      usableXmm: 5,
      usableYmm: 5,
      usableWidthMm: 2490,
      usableHeightMm: 1240,
      placements: [
        {
          id: "pl01",
          partId: "pt01",
          partInstanceIndex: 1,
          xMm: 10,
          yMm: 10,
          widthMm: 500,
          heightMm: 300,
          rotationDeg: 0,
          label: "01",
        },
      ],
      operations: [
        {
          id: "op01",
          sequenceNumber: 1,
          operationType: "full_cut",
          axis: "horizontal",
          x1Mm: 0,
          y1Mm: 320,
          x2Mm: 2490,
          y2Mm: 320,
          note: null,
        },
      ],
      plannedOffcuts: [
        {
          id: "of01",
          xMm: 520,
          yMm: 10,
          widthMm: 400,
          heightMm: 300,
          isUseful: false,
        },
      ],
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain('fill="#fda4af"');
    expect(svg).toContain('stroke="#dc2626"');
    expect(svg).toContain('clipPath id="offcut-clip-sheet01-0"');
    expect(svg).not.toContain("<image");
  });
});

describe("collectCutPlanPdfSheets", () => {
  it("collects sheets only from panels with cut plans", () => {
    const panels: ClientPanel[] = [
      {
        id: "pn01",
        name: "Панель 1",
        parts: [],
        cutPlans: [
          {
            id: "cp01",
            totalSheetsCount: 1,
            totalOperationsCount: 1,
            wastePercent: 5,
            sheets: [
              {
                id: "sh01",
                sheetIndex: 1,
                widthMm: 2500,
                heightMm: 1250,
                usableXmm: 5,
                usableYmm: 5,
                usableWidthMm: 2490,
                usableHeightMm: 1240,
                placements: [],
                operations: [],
                plannedOffcuts: [],
              },
            ],
          },
        ],
      },
      {
        id: "pn02",
        name: "Панель 2",
        parts: [],
        cutPlans: [],
      },
    ];

    expect(collectCutPlanPdfSheets(panels)).toEqual([
      {
        panelName: "Панель 1",
        sheet: panels[0]!.cutPlans[0]!.sheets[0],
      },
    ]);
  });
});
