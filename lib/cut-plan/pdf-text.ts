import type { PDFPage, Rotation } from "pdf-lib";
import { rgb, type Color } from "pdf-lib";

import type { PdfDocumentFonts } from "@/lib/cut-plan/pdf-document-fonts";
import type { PdfRgb } from "@/lib/cut-plan/pdf-coordinates";

export type PdfFontWeight = "regular" | "semiBold";

function toColor(color: PdfRgb): Color {
  return rgb(color.r, color.g, color.b);
}

function pickFont(fonts: PdfDocumentFonts, weight: PdfFontWeight) {
  return weight === "semiBold" ? fonts.semiBold : fonts.regular;
}

export function measurePdfTextWidth(
  fonts: PdfDocumentFonts,
  text: string,
  sizePt: number,
  weight: PdfFontWeight = "regular",
) {
  const font = pickFont(fonts, weight);
  return font.widthOfTextAtSize(text, sizePt);
}

export function drawPdfText(
  page: PDFPage,
  fonts: PdfDocumentFonts,
  {
    text,
    x,
    y,
    sizePt,
    weight = "regular",
    color,
    rotate,
  }: {
    text: string;
    x: number;
    y: number;
    sizePt: number;
    weight?: PdfFontWeight;
    color: PdfRgb;
    rotate?: Rotation;
  },
) {
  const font = pickFont(fonts, weight);
  page.drawText(text, {
    x,
    y,
    size: sizePt,
    font,
    color: toColor(color),
    rotate,
  });
}
