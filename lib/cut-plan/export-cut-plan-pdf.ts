import type { CutPlanPdfMeta, CutPlanPdfSheet } from "@/lib/cut-plan/cut-plan-pdf-shared";
import { mmToPt } from "@/lib/cut-plan/pdf-coordinates";
import { createVectorPdfDocument } from "@/lib/cut-plan/pdf-document-fonts";
import { drawCutMapSheet, drawPdfTextLines } from "@/lib/cut-plan/pdf-draw-sheet-map";

export type { CutPlanPdfMeta, CutPlanPdfSheet } from "@/lib/cut-plan/cut-plan-pdf-shared";

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_X_MM = 12;
const MARGIN_Y_MM = 10;
const FOOTER_HEIGHT_MM = 8;
const SLOT_GAP_MM = 5;
const SLOT_TITLE_HEIGHT_MM = 6;
const SHEETS_PER_PAGE = 3;
const PAGE_HEADER_HEIGHT_MM = 14;

const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_X_MM * 2;
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - MARGIN_Y_MM * 2 - FOOTER_HEIGHT_MM;
const SLOT_HEIGHT_MM =
  (CONTENT_HEIGHT_MM - SLOT_GAP_MM * (SHEETS_PER_PAGE - 1)) / SHEETS_PER_PAGE;
const MAP_HEIGHT_MM = SLOT_HEIGHT_MM - SLOT_TITLE_HEIGHT_MM;

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

export async function buildCutPlanPdfBytes(meta: CutPlanPdfMeta, sheets: CutPlanPdfSheet[]) {
  if (sheets.length === 0) {
    throw new Error("Нет рассчитанных карт раскроя для выгрузки");
  }

  const { pdfDoc, fonts } = await createVectorPdfDocument();
  const totalPages = Math.ceil(sheets.length / SHEETS_PER_PAGE);
  const generatedAt = formatFileDate(new Date());

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const page = pdfDoc.addPage([mmToPt(PAGE_WIDTH_MM), mmToPt(PAGE_HEIGHT_MM)]);
    const pageSheets = sheets.slice(
      pageIndex * SHEETS_PER_PAGE,
      pageIndex * SHEETS_PER_PAGE + SHEETS_PER_PAGE,
    );
    const pageTopOffset = pageIndex === 0 ? PAGE_HEADER_HEIGHT_MM : 0;

    if (pageIndex === 0) {
      const subtitle = [meta.materialLabel, `ID ${meta.projectId}`, generatedAt]
        .filter(Boolean)
        .join(" · ");

      drawPdfTextLines(page, fonts, {
        xMm: MARGIN_X_MM,
        yTopMm: MARGIN_Y_MM,
        widthMm: CONTENT_WIDTH_MM,
        heightMm: PAGE_HEADER_HEIGHT_MM,
      }, [
        { text: meta.projectName, yMm: 4, fontSizeMm: 5, bold: true },
        { text: subtitle, yMm: 10, fontSizeMm: 3.2, color: { r: 0.29, g: 0.34, b: 0.39 } },
      ]);
    }

    for (let slotIndex = 0; slotIndex < pageSheets.length; slotIndex += 1) {
      const item = pageSheets[slotIndex]!;
      const slotTop =
        MARGIN_Y_MM + pageTopOffset + slotIndex * (SLOT_HEIGHT_MM + SLOT_GAP_MM);

      drawPdfTextLines(page, fonts, {
        xMm: MARGIN_X_MM,
        yTopMm: slotTop,
        widthMm: CONTENT_WIDTH_MM,
        heightMm: SLOT_TITLE_HEIGHT_MM,
      }, [
        {
          text: `${item.panelName} · Лист ${item.sheet.sheetIndex} · ${item.sheet.widthMm}×${item.sheet.heightMm} мм`,
          yMm: 4,
          fontSizeMm: 3.5,
          bold: true,
        },
      ]);

      drawCutMapSheet(
        page,
        fonts,
        {
          xMm: MARGIN_X_MM,
          yTopMm: slotTop + SLOT_TITLE_HEIGHT_MM,
          widthMm: CONTENT_WIDTH_MM,
          heightMm: MAP_HEIGHT_MM,
        },
        item.sheet,
      );
    }

    drawPdfTextLines(page, fonts, {
      xMm: MARGIN_X_MM,
      yTopMm: PAGE_HEIGHT_MM - FOOTER_HEIGHT_MM,
      widthMm: CONTENT_WIDTH_MM,
      heightMm: FOOTER_HEIGHT_MM,
    }, [
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
    ]);
  }

  return pdfDoc.save();
}

export async function exportCutPlanPdf(meta: CutPlanPdfMeta, sheets: CutPlanPdfSheet[]) {
  const bytes = await buildCutPlanPdfBytes(meta, sheets);
  downloadPdf(bytes, `${sanitizeFileName(meta.projectName)}_raskroy.pdf`);
}
