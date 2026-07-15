import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

import {
  collectCutPlanPdfPages,
  collectCutPlanPdfSheets,
} from "@/lib/cut-plan/cut-plan-pdf-shared";
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
        code: null,
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
        contractNumber: "Д-45/26",
        materialLabel: "ЛДСП 16 мм",
        materialsSpec: {
          materialName: "ЛДСП",
          formatLabel: "2500×1250",
          thicknessLabel: "16",
          sheetsCount: 1,
          sheetsAreaLabel: "3.13 м²",
          partsAreaLabel: "0.15 м²",
          wastePercentLabel: "95.2%",
          markingSheets: 0,
          cuttingSheets: 1,
          hasCutPlan: true,
        },
      },
      collectCutPlanPdfSheets(panels),
    );

    const text = pdfText(bytes);
    const pdfDoc = await PDFDocument.load(bytes);

    expect(text.startsWith("%PDF-")).toBe(true);
    expect(pdfDoc.getPageCount()).toBe(2);
    const pageSize = pdfDoc.getPage(0)!.getSize();
    expect(pageSize.width).toBeCloseTo((297 * 72) / 25.4, 1);
    expect(pageSize.height).toBeCloseTo((210 * 72) / 25.4, 1);
    expect(text).not.toMatch(/\/Subtype\s*\/Image/);
    expect(text).not.toMatch(/\/DCTDecode/);
    expect(bytes.length).toBeGreaterThan(5_000);
    expect(bytes.length).toBeLessThan(500_000);
  });

  it("даёт одну страницу A4 на каждый лист заготовки", async () => {
    const makeSheet = (sheetIndex: number) => ({
      id: `sh${sheetIndex}`,
      sheetIndex,
      widthMm: 2500,
      heightMm: 1250,
      usableXmm: 5,
      usableYmm: 5,
      usableWidthMm: 2490,
      usableHeightMm: 1240,
      placements: [] as ClientPanel["cutPlans"][0]["sheets"][0]["placements"],
      operations: [] as ClientPanel["cutPlans"][0]["sheets"][0]["operations"],
      plannedOffcuts: [] as ClientPanel["cutPlans"][0]["sheets"][0]["plannedOffcuts"],
    });

    const panels: ClientPanel[] = [
      {
        id: "pn01",
        name: "Панель 1",
        code: null,
        parts: [],
        cutPlans: [
          {
            id: "cp01",
            totalSheetsCount: 3,
            totalOperationsCount: 0,
            wastePercent: 10,
            sheets: [makeSheet(1), makeSheet(2), makeSheet(3)],
          },
        ],
      },
    ];

    const bytes = await buildCutPlanPdfBytes(
      {
        projectName: "Тест 3 листа",
        projectId: "pr02",
        materialLabel: "ЛДСП 16 мм",
      },
      collectCutPlanPdfSheets(panels),
    );

    const pdfDoc = await PDFDocument.load(bytes);
    expect(pdfDoc.getPageCount()).toBe(3);
  });

  it("без спецификации — только карты; с договором в мета без ошибки", async () => {
    const panels: ClientPanel[] = [
      {
        id: "pn01",
        name: "Панель",
        code: "Ст-1",
        parts: [],
        cutPlans: [
          {
            id: "cp01",
            totalSheetsCount: 1,
            totalOperationsCount: 0,
            wastePercent: 0,
            sheets: [
              {
                id: "sh1",
                sheetIndex: 1,
                widthMm: 2500,
                heightMm: 1250,
                usableXmm: 0,
                usableYmm: 0,
                usableWidthMm: 2500,
                usableHeightMm: 1250,
                placements: [],
                operations: [],
                plannedOffcuts: [],
              },
            ],
          },
        ],
      },
    ];

    const bytes = await buildCutPlanPdfBytes(
      {
        projectName: "456",
        projectId: "pr03",
        contractNumber: "Д-1",
        materialLabel: "Плита",
      },
      collectCutPlanPdfSheets(panels),
    );

    const pdfDoc = await PDFDocument.load(bytes);
    expect(pdfDoc.getPageCount()).toBe(1);
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
        code: "Ст-1-01",
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
        code: null,
        parts: [],
        cutPlans: [],
      },
    ];

    const sheets = collectCutPlanPdfSheets(panels, {
      materialLabel: "ЛДСП",
    });
    expect(sheets).toHaveLength(1);
    expect(sheets[0]).toMatchObject({
      kind: "cut_map",
      workKind: "cutting_and_marking",
      panelName: "Ст-1-01",
      materialName: "ЛДСП",
      blankSheetsCount: 1,
      sheet: panels[0]!.cutPlans[0]!.sheets[0],
    });
  });
});

describe("collectCutPlanPdfPages", () => {
  it("добавляет отдельную страницу маркировки после карт раскроя", async () => {
    const panels: ClientPanel[] = [
      {
        id: "pn01",
        name: "Домокомплект",
        code: null,
        parts: [
          {
            id: "cut1",
            name: "Обшивка Ст-1-01",
            code: "01",
            widthMm: 500,
            heightMm: 300,
            quantity: 1,
            allowRotation: true,
          },
          {
            id: "mark1",
            name: "Плита Ст-2-01",
            code: "01",
            widthMm: 3000,
            heightMm: 1250,
            quantity: 3,
            allowRotation: true,
          },
        ],
        cutPlans: [
          {
            id: "cp01",
            totalSheetsCount: 1,
            totalOperationsCount: 0,
            wastePercent: 5,
            sheets: [
              {
                id: "sh01",
                sheetIndex: 1,
                widthMm: 3000,
                heightMm: 1250,
                usableXmm: 0,
                usableYmm: 0,
                usableWidthMm: 3000,
                usableHeightMm: 1250,
                placements: [
                  {
                    id: "pl1",
                    partId: "cut1",
                    partInstanceIndex: 1,
                    xMm: 0,
                    yMm: 0,
                    widthMm: 500,
                    heightMm: 300,
                    rotationDeg: 0,
                    label: "Ст-1-01-01",
                  },
                ],
                operations: [],
                plannedOffcuts: [],
              },
            ],
          },
        ],
      },
    ];

    const pages = collectCutPlanPdfPages(panels, {
      materialsSpec: {
        materialName: "Плита ГСПВ",
        formatLabel: "3000×1250",
        thicknessLabel: "12,5",
        sheetsCount: 4,
        sheetsAreaLabel: null,
        partsAreaLabel: null,
        wastePercentLabel: "9.2%",
        markingSheets: 3,
        cuttingSheets: 1,
        hasCutPlan: true,
      },
      sheetWidthMm: 3000,
      sheetHeightMm: 1250,
    });

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      kind: "cut_map",
      workKind: "cutting_and_marking",
      partLines: [{ marking: "Ст-1-01-01", quantity: 1 }],
      blankSheetsCount: 1,
      materialName: "Плита ГСПВ",
    });
    expect(pages[1]).toMatchObject({
      kind: "marking_only",
      workKind: "marking_only",
      partLines: [{ marking: "Ст-2-01-01", quantity: 3 }],
      blankSheetsCount: 3,
      materialName: "Плита ГСПВ",
      sheetTitle: "Ст-2-01-01 · целый лист · 3000×1250 мм",
    });
    expect(pages[1]!.kind === "marking_only" && pages[1].sheet.placements).toEqual([
      expect.objectContaining({
        label: "Ст-2-01-01",
        widthMm: 3000,
        heightMm: 1250,
      }),
    ]);

    const bytes = await buildCutPlanPdfBytes(
      {
        projectName: "456",
        projectId: "pr-mark",
        materialLabel: "Плита ГСПВ",
        materialsSpec: {
          materialName: "Плита ГСПВ",
          formatLabel: "3000×1250",
          thicknessLabel: "12,5",
          sheetsCount: 4,
          sheetsAreaLabel: "15.00 м²",
          partsAreaLabel: "12.00 м²",
          wastePercentLabel: "9.2%",
          markingSheets: 3,
          cuttingSheets: 1,
          hasCutPlan: true,
        },
      },
      pages,
    );
    const pdfDoc = await PDFDocument.load(bytes);
    // карта + маркировка + спецификация
    expect(pdfDoc.getPageCount()).toBe(3);
  });
});
