import type { CutPlanPdfMeta, CutPlanPdfSheet } from "@/lib/cut-plan/cut-plan-pdf-shared";
import { mmToPt } from "@/lib/cut-plan/pdf-coordinates";
import { createVectorPdfDocument } from "@/lib/cut-plan/pdf-document-fonts";
import { drawCutMapSheet, drawPdfTextLines } from "@/lib/cut-plan/pdf-draw-sheet-map";

export type { CutPlanPdfMeta, CutPlanPdfSheet } from "@/lib/cut-plan/cut-plan-pdf-shared";

const PAGE_WIDTH_MM = 297; // A4 альбомная
const PAGE_HEIGHT_MM = 210;
const MARGIN_X_MM = 12;
const MARGIN_Y_MM = 10;
const FOOTER_HEIGHT_MM = 8;
const SHEET_TITLE_HEIGHT_MM = 7;
const PAGE_HEADER_HEIGHT_MM = 12;

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

/** Один лист заготовки карты раскроя → одна страница A4. */
export async function buildCutPlanPdfBytes(meta: CutPlanPdfMeta, sheets: CutPlanPdfSheet[]) {
  if (sheets.length === 0) {
    throw new Error("Нет рассчитанных карт раскроя для выгрузки");
  }

  const { pdfDoc, fonts } = await createVectorPdfDocument();
  const totalPages = sheets.length;
  const generatedAt = formatFileDate(new Date());
  const subtitle = [meta.materialLabel, `ID ${meta.projectId}`, generatedAt]
    .filter(Boolean)
    .join(" · ");

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const page = pdfDoc.addPage([mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)]);
    const item = sheets[pageIndex]!;
    let yTop = MARGIN_Y_MM;

    drawPdfTextLines(
      page,
      fonts,
      {
        xMm: MARGIN_X_MM,
        yTopMm: yTop,
        widthMm: CONTENT_WIDTH_MM,
        heightMm: PAGE_HEADER_HEIGHT_MM,
      },
      [
        { text: meta.projectName, yMm: 4, fontSizeMm: 5, bold: true },
        {
          text: subtitle,
          yMm: 9.5,
          fontSizeMm: 3.2,
          color: { r: 0.29, g: 0.34, b: 0.39 },
        },
      ],
    );
    yTop += PAGE_HEADER_HEIGHT_MM;

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
          text: `${item.panelName} · Лист ${item.sheet.sheetIndex} · ${item.sheet.widthMm}×${item.sheet.heightMm} мм`,
          yMm: 4.5,
          fontSizeMm: 3.8,
          bold: true,
        },
      ],
    );
    yTop += SHEET_TITLE_HEIGHT_MM;

    const mapHeightMm =
      PAGE_HEIGHT_MM - yTop - MARGIN_Y_MM - FOOTER_HEIGHT_MM;

    drawCutMapSheet(
      page,
      fonts,
      {
        xMm: MARGIN_X_MM,
        yTopMm: yTop,
        widthMm: CONTENT_WIDTH_MM,
        heightMm: mapHeightMm,
      },
      item.sheet,
    );

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
          text: `Smartcut · ${meta.projectName}`,
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

  return pdfDoc.save();
}

export async function exportCutPlanPdf(meta: CutPlanPdfMeta, sheets: CutPlanPdfSheet[]) {
  const bytes = await buildCutPlanPdfBytes(meta, sheets);
  downloadPdf(bytes, `${sanitizeFileName(meta.projectName)}_raskroy.pdf`);
}
