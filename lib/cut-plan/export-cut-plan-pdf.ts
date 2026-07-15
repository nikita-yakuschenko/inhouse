import type { PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";

import type {
  CutPlanPdfMeta,
  CutPlanPdfPage,
} from "@/lib/cut-plan/cut-plan-pdf-shared";
import { projectPdfTitle } from "@/lib/cut-plan/cut-plan-pdf-shared";
import type { MaterialsSpecSummary } from "@/lib/cut-plan/materials-spec";
import {
  buildPdfPageLegendLines,
  pdfWorkKindStampLabel,
  type PdfWorkKind,
} from "@/lib/cut-plan/pdf-page-legend";
import { mmToPt, PDF_COLORS } from "@/lib/cut-plan/pdf-coordinates";
import {
  createVectorPdfDocument,
  type PdfDocumentFonts,
} from "@/lib/cut-plan/pdf-document-fonts";
import { drawCutMapSheet, drawPdfTextLines } from "@/lib/cut-plan/pdf-draw-sheet-map";
import { drawPdfText, measurePdfTextWidth } from "@/lib/cut-plan/pdf-text";

export type { CutPlanPdfMeta, CutPlanPdfPage } from "@/lib/cut-plan/cut-plan-pdf-shared";

const PAGE_WIDTH_MM = 297; // A4 альбомная
const PAGE_HEIGHT_MM = 210;
const MARGIN_X_MM = 12;
const MARGIN_Y_MM = 10;
const FOOTER_HEIGHT_MM = 8;
const SHEET_TITLE_HEIGHT_MM = 7;
const PAGE_HEADER_HEIGHT_MM = 12;
const LEGEND_LINE_HEIGHT_MM = 3.4;
const LEGEND_FONT_SIZE_MM = 2.8;
const LEGEND_GAP_AFTER_MM = 2;
const STAMP_FONT_SIZE_MM = 3.2;
const STAMP_PAD_X_MM = 3.5;
const STAMP_PAD_Y_MM = 2.2;

const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_X_MM * 2;

function formatFileDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*]+/g, "_").trim() || "raskroy";
}

function downloadPdf(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Штамп вида операции: рамка, правый верх, UPPERCASE. */
function drawOperationStamp(
  page: PDFPage,
  fonts: PdfDocumentFonts,
  workKind: PdfWorkKind,
) {
  const text = pdfWorkKindStampLabel(workKind);
  const sizePt = mmToPt(STAMP_FONT_SIZE_MM);
  const textWidthPt = measurePdfTextWidth(fonts, text, sizePt, "semiBold");
  const padXPt = mmToPt(STAMP_PAD_X_MM);
  const padYPt = mmToPt(STAMP_PAD_Y_MM);
  const boxWidthPt = textWidthPt + padXPt * 2;
  const boxHeightPt = sizePt + padYPt * 2;
  const pageHeightPt = page.getHeight();
  const pageWidthPt = page.getWidth();
  const xPt = pageWidthPt - mmToPt(MARGIN_X_MM) - boxWidthPt;
  const yPt = pageHeightPt - mmToPt(MARGIN_Y_MM + 1) - boxHeightPt;

  page.drawRectangle({
    x: xPt,
    y: yPt,
    width: boxWidthPt,
    height: boxHeightPt,
    borderColor: rgb(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b),
    borderWidth: 1.25,
  });

  drawPdfText(page, fonts, {
    text,
    x: xPt + padXPt,
    y: yPt + padYPt * 0.85,
    sizePt,
    weight: "semiBold",
    color: PDF_COLORS.text,
  });
}

function drawPageChrome(
  page: PDFPage,
  fonts: PdfDocumentFonts,
  projectTitle: string,
  subtitle: string,
  pageIndex: number,
  totalPages: number,
  workKind?: PdfWorkKind,
) {
  // Заголовок слева — место справа под штамп (~70 мм).
  const titleWidthMm = workKind
    ? CONTENT_WIDTH_MM - 72
    : CONTENT_WIDTH_MM;

  drawPdfTextLines(
    page,
    fonts,
    {
      xMm: MARGIN_X_MM,
      yTopMm: MARGIN_Y_MM,
      widthMm: titleWidthMm,
      heightMm: PAGE_HEADER_HEIGHT_MM,
    },
    [
      { text: projectTitle, yMm: 4, fontSizeMm: 5, bold: true },
      {
        text: subtitle,
        yMm: 9.5,
        fontSizeMm: 3.2,
        color: { r: 0.29, g: 0.34, b: 0.39 },
      },
    ],
  );

  if (workKind) {
    drawOperationStamp(page, fonts, workKind);
  }

  drawPdfTextLines(
    page,
    fonts,
    {
      xMm: MARGIN_X_MM,
      yTopMm: PAGE_HEIGHT_MM - FOOTER_HEIGHT_MM,
      widthMm: CONTENT_WIDTH_MM,
      heightMm: FOOTER_HEIGHT_MM,
    },
    [
      {
        text: `Smartcut · ${projectTitle}`,
        yMm: 4,
        fontSizeMm: 2.8,
        color: { r: 0.42, g: 0.45, b: 0.5 },
      },
      {
        text: `Стр. ${pageIndex + 1} из ${totalPages}`,
        yMm: 4,
        fontSizeMm: 2.8,
        color: { r: 0.42, g: 0.45, b: 0.5 },
        align: "right",
      },
    ],
  );
}

function legendBlockHeightMm(lineCount: number) {
  return lineCount * LEGEND_LINE_HEIGHT_MM + LEGEND_GAP_AFTER_MM;
}

function drawPageLegend(
  page: PDFPage,
  fonts: PdfDocumentFonts,
  yTopMm: number,
  lines: string[],
) {
  drawPdfTextLines(
    page,
    fonts,
    {
      xMm: MARGIN_X_MM,
      yTopMm,
      widthMm: CONTENT_WIDTH_MM,
      heightMm: legendBlockHeightMm(lines.length),
    },
    lines.map((text, index) => ({
      text,
      yMm: (index + 1) * LEGEND_LINE_HEIGHT_MM - 0.6,
      fontSizeMm: LEGEND_FONT_SIZE_MM,
      color: PDF_COLORS.mutedText,
    })),
  );

  return yTopMm + legendBlockHeightMm(lines.length);
}

function drawMaterialsSpecPage(
  page: PDFPage,
  fonts: PdfDocumentFonts,
  spec: MaterialsSpecSummary,
  projectTitle: string,
  subtitle: string,
  pageIndex: number,
  totalPages: number,
) {
  drawPageChrome(page, fonts, projectTitle, subtitle, pageIndex, totalPages);

  let yTop = MARGIN_Y_MM + PAGE_HEADER_HEIGHT_MM;

  drawPdfTextLines(
    page,
    fonts,
    {
      xMm: MARGIN_X_MM,
      yTopMm: yTop,
      widthMm: CONTENT_WIDTH_MM,
      heightMm: SHEET_TITLE_HEIGHT_MM,
    },
    [
      {
        text: "Спецификация материалов",
        yMm: 4.5,
        fontSizeMm: 3.8,
        bold: true,
      },
    ],
  );
  yTop += SHEET_TITLE_HEIGHT_MM + 4;

  const colXs = [0, 10, 70, 110, 140, 165, 200, 235].map(
    (x) => MARGIN_X_MM + x,
  );
  const headers = [
    "№",
    "Материал",
    "Формат",
    "Толщина",
    "Листов",
    "Пл. листов",
    "Пл. деталей",
    "Отход",
  ];
  const values = [
    "1",
    spec.materialName,
    spec.formatLabel,
    spec.thicknessLabel,
    spec.sheetsCount != null ? String(spec.sheetsCount) : "—",
    spec.sheetsAreaLabel ?? "—",
    spec.partsAreaLabel ?? "—",
    spec.wastePercentLabel ?? "—",
  ];

  const pageHeightPt = page.getHeight();
  const headerYPt = pageHeightPt - mmToPt(yTop + 4);
  const rowYPt = pageHeightPt - mmToPt(yTop + 10);

  for (let i = 0; i < headers.length; i += 1) {
    drawPdfText(page, fonts, {
      text: headers[i]!,
      x: mmToPt(colXs[i]!),
      y: headerYPt,
      sizePt: mmToPt(2.8),
      weight: "semiBold",
      color: PDF_COLORS.mutedText,
    });
    drawPdfText(page, fonts, {
      text: values[i]!,
      x: mmToPt(colXs[i]!),
      y: rowYPt,
      sizePt: mmToPt(3.2),
      weight: "regular",
      color: PDF_COLORS.text,
    });
  }

  const noteY = yTop + 18;
  if (spec.markingSheets > 0) {
    const note = spec.hasCutPlan
      ? `В том числе целых листов под маркировку без раскроя: ${spec.markingSheets} · листов в раскрое: ${spec.cuttingSheets}`
      : `В том числе целых листов под маркировку без раскроя: ${spec.markingSheets} · раскрой ещё не рассчитан`;
    drawPdfTextLines(
      page,
      fonts,
      {
        xMm: MARGIN_X_MM,
        yTopMm: noteY,
        widthMm: CONTENT_WIDTH_MM,
        heightMm: 8,
      },
      [
        {
          text: note,
          yMm: 4,
          fontSizeMm: 2.8,
          color: PDF_COLORS.mutedText,
        },
      ],
    );
  } else if (!spec.hasCutPlan) {
    drawPdfTextLines(
      page,
      fonts,
      {
        xMm: MARGIN_X_MM,
        yTopMm: noteY,
        widthMm: CONTENT_WIDTH_MM,
        heightMm: 8,
      },
      [
        {
          text: "Раскрой не рассчитан — количество листов раскроя появится после расчёта",
          yMm: 4,
          fontSizeMm: 2.8,
          color: PDF_COLORS.mutedText,
        },
      ],
    );
  }
}

function drawSheetContentPage(
  page: PDFPage,
  fonts: PdfDocumentFonts,
  input: {
    workKind: PdfWorkKind;
    title: string;
    partLines: CutPlanPdfPage["partLines"];
    materialName: string;
    blankSheetsCount: number;
    sheet: Extract<CutPlanPdfPage, { kind: "cut_map" }>["sheet"];
  },
  projectTitle: string,
  subtitle: string,
  pageIndex: number,
  totalPages: number,
) {
  drawPageChrome(
    page,
    fonts,
    projectTitle,
    subtitle,
    pageIndex,
    totalPages,
    input.workKind,
  );
  let yTop = MARGIN_Y_MM + PAGE_HEADER_HEIGHT_MM;

  drawPdfTextLines(
    page,
    fonts,
    {
      xMm: MARGIN_X_MM,
      yTopMm: yTop,
      widthMm: CONTENT_WIDTH_MM,
      heightMm: SHEET_TITLE_HEIGHT_MM,
    },
    [
      {
        text: input.title,
        yMm: 4.5,
        fontSizeMm: 3.8,
        bold: true,
      },
    ],
  );
  yTop += SHEET_TITLE_HEIGHT_MM;

  const legendLines = buildPdfPageLegendLines({
    partLines: input.partLines,
    materialName: input.materialName,
    blankSheetsCount: input.blankSheetsCount,
  });
  yTop = drawPageLegend(page, fonts, yTop, legendLines);

  const mapHeightMm = PAGE_HEIGHT_MM - yTop - MARGIN_Y_MM - FOOTER_HEIGHT_MM;
  drawCutMapSheet(
    page,
    fonts,
    {
      xMm: MARGIN_X_MM,
      yTopMm: yTop,
      widthMm: CONTENT_WIDTH_MM,
      heightMm: Math.max(mapHeightMm, 40),
    },
    input.sheet,
  );
}

/** Страницы карт/маркировки → A4; спецификация — последняя. */
export async function buildCutPlanPdfBytes(
  meta: CutPlanPdfMeta,
  pages: CutPlanPdfPage[],
) {
  if (pages.length === 0) {
    throw new Error("Нет карт раскроя и деталей под маркировку для выгрузки");
  }

  const { pdfDoc, fonts } = await createVectorPdfDocument();
  const includeSpec = Boolean(meta.materialsSpec);
  const totalPages = pages.length + (includeSpec ? 1 : 0);
  const generatedAt = formatFileDate(new Date());
  const projectTitle = projectPdfTitle(meta);
  const subtitle = [meta.materialLabel, `ID ${meta.projectId}`, generatedAt]
    .filter(Boolean)
    .join(" · ");

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pdfDoc.addPage([mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)]);
    const item = pages[pageIndex]!;

    if (item.kind === "cut_map") {
      drawSheetContentPage(
        page,
        fonts,
        {
          workKind: item.workKind,
          title: `${item.panelName} · Лист ${item.sheet.sheetIndex} · ${item.sheet.widthMm}×${item.sheet.heightMm} мм`,
          partLines: item.partLines,
          materialName: item.materialName,
          blankSheetsCount: item.blankSheetsCount,
          sheet: item.sheet,
        },
        projectTitle,
        subtitle,
        pageIndex,
        totalPages,
      );
    } else {
      drawSheetContentPage(
        page,
        fonts,
        {
          workKind: item.workKind,
          title: item.sheetTitle,
          partLines: item.partLines,
          materialName: item.materialName,
          blankSheetsCount: item.blankSheetsCount,
          sheet: item.sheet,
        },
        projectTitle,
        subtitle,
        pageIndex,
        totalPages,
      );
    }
  }

  if (meta.materialsSpec) {
    const page = pdfDoc.addPage([mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)]);
    drawMaterialsSpecPage(
      page,
      fonts,
      meta.materialsSpec,
      projectTitle,
      subtitle,
      pages.length,
      totalPages,
    );
  }

  return pdfDoc.save();
}

export async function exportCutPlanPdf(
  meta: CutPlanPdfMeta,
  pages: CutPlanPdfPage[],
) {
  const bytes = await buildCutPlanPdfBytes(meta, pages);
  downloadPdf(bytes, `${sanitizeFileName(meta.projectName)}_raskroy.pdf`);
}
