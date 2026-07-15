import type { PDFPage } from "pdf-lib";
import { degrees, rgb } from "pdf-lib";

import type { ClientCutOperation, ClientPlacement, ClientPlannedOffcut } from "@/features/projects/serialize-panels";
import { getOperatorCutOperations } from "@/lib/cut-plan/operator-operations";
import { buildCutAxisLines } from "@/lib/cut-plan/cut-axes";
import {
  buildOffcutLabelLayout,
  buildPartLabelLayout,
  LABEL_BADGE_STROKE_MM,
  sortOffcutsForLabeling,
  type LabelBadge,
  type OffcutLabelLayout,
  type PartLabelLayout,
  type PartLabelText,
} from "@/lib/cut-plan/part-label-layout";
import {
  createMapCoordinateMapper,
  mmToPt,
  PDF_COLORS,
  type MapSlotMm,
  type PdfRgb,
} from "@/lib/cut-plan/pdf-coordinates";
import type { PdfDocumentFonts } from "@/lib/cut-plan/pdf-document-fonts";
import {
  mapRotatedBadgeBounds,
  rotatedTextBaselineSvg,
} from "@/lib/cut-plan/pdf-label-geometry";
import { drawPdfText, measurePdfTextWidth } from "@/lib/cut-plan/pdf-text";
import { clipOffcutHatchLines } from "@/lib/cut-plan/offcut-hatch";
import {
  enginePointToOperatorSvg,
  engineRectToOperatorSvg,
  getOperatorCanvasViewBox,
  getOperatorSheetSize,
} from "@/lib/cut-plan/operator-view";
import { resolvePlacementMarking } from "@/lib/engine/validation";

function toColor(color: PdfRgb) {
  return rgb(color.r, color.g, color.b);
}

function drawSvgRect(
  page: PDFPage,
  rect: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  mapper: ReturnType<typeof createMapCoordinateMapper>,
  options: {
    fillColor?: PdfRgb;
    borderColor?: PdfRgb;
    borderWidthMm?: number;
    dashArray?: number[];
  },
) {
  const box = mapper.mapRect(rect);
  page.drawRectangle({
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    color: options.fillColor ? toColor(options.fillColor) : undefined,
    borderColor: options.borderColor ? toColor(options.borderColor) : undefined,
    borderWidth: options.borderWidthMm ? mapper.mapLength(options.borderWidthMm) : 0,
    borderDashArray: options.dashArray?.map((value) => mapper.mapLength(value)),
  });
}

function drawSvgLine(
  page: PDFPage,
  x1Mm: number,
  y1Mm: number,
  x2Mm: number,
  y2Mm: number,
  mapper: ReturnType<typeof createMapCoordinateMapper>,
  options: {
    color: PdfRgb;
    widthMm: number;
    dashArray?: number[];
  },
) {
  const start = mapper.mapPoint(x1Mm, y1Mm);
  const end = mapper.mapPoint(x2Mm, y2Mm);
  page.drawLine({
    start,
    end,
    color: toColor(options.color),
    thickness: mapper.mapLength(options.widthMm),
    dashArray: options.dashArray?.map((value) => mapper.mapLength(value)),
  });
}

function drawBadge(
  page: PDFPage,
  badge: LabelBadge,
  stroke: PdfRgb,
  mapper: ReturnType<typeof createMapCoordinateMapper>,
) {
  drawSvgRect(page, badge, mapper, {
    fillColor: { r: 1, g: 1, b: 1 },
    borderColor: stroke,
    borderWidthMm: LABEL_BADGE_STROKE_MM,
  });
}

function drawLabelText(
  page: PDFPage,
  item: PartLabelText,
  text: string,
  fonts: PdfDocumentFonts,
  color: PdfRgb,
  mapper: ReturnType<typeof createMapCoordinateMapper>,
  semiBold = false,
) {
  const weight = semiBold ? "semiBold" : "regular";
  const sizePt = mapper.mapLength(item.fontSizeMm);
  const anchor = mapper.mapPoint(item.xMm, item.yMm);
  const textWidth = measurePdfTextWidth(fonts, text, sizePt, weight);
  let x = anchor.x;
  if (item.textAnchor === "middle") {
    x -= textWidth / 2;
  } else if (item.textAnchor === "end") {
    x -= textWidth;
  }

  let y = anchor.y;
  if (item.dominantBaseline === "middle") {
    y -= sizePt * 0.35;
  } else if (item.dominantBaseline === "hanging") {
    y -= sizePt * 0.85;
  }

  drawPdfText(page, fonts, {
    text,
    x,
    y,
    sizePt,
    weight,
    color,
    rotate: item.rotateDeg ? degrees(item.rotateDeg) : undefined,
  });
}

function drawLabelLayout(
  page: PDFPage,
  layout: PartLabelLayout,
  fonts: PdfDocumentFonts,
  color: PdfRgb,
  mapper: ReturnType<typeof createMapCoordinateMapper>,
) {
  drawBadge(page, layout.centerBadge, color, mapper);
  drawLabelText(page, layout.marking, layout.marking.text, fonts, color, mapper, true);
  if (layout.centerSize) {
    drawLabelText(page, layout.centerSize, layout.centerSize.text, fonts, color, mapper, true);
  }
  if (layout.bottomSide && layout.bottomBadge) {
    drawBadge(page, layout.bottomBadge, color, mapper);
    drawLabelText(page, layout.bottomSide, layout.bottomSide.text, fonts, color, mapper);
  }
  if (layout.rightSide && layout.rightBadge) {
    drawRotatedBadge(
      page,
      layout.rightSide,
      layout.rightBadge,
      color,
      mapper,
    );
    drawRotatedSideLabelText(page, layout.rightSide, fonts, color, mapper);
  }
}

function drawOffcutLabelLayout(
  page: PDFPage,
  layout: OffcutLabelLayout,
  fonts: PdfDocumentFonts,
  color: PdfRgb,
  mapper: ReturnType<typeof createMapCoordinateMapper>,
) {
  if (layout.type === "inline") {
    drawLabelLayout(page, layout.layout, fonts, color, mapper);
    return;
  }

  drawSvgLine(
    page,
    layout.anchorXMm,
    layout.anchorYMm,
    layout.leaderEndXMm,
    layout.leaderEndYMm,
    mapper,
    { color, widthMm: 2 },
  );

  const anchor = mapper.mapPoint(layout.anchorXMm, layout.anchorYMm);
  const radiusPt = mapper.mapLength(6);
  page.drawCircle({
    x: anchor.x,
    y: anchor.y,
    size: radiusPt,
    color: toColor(color),
  });

  drawBadge(page, layout.badge, color, mapper);
  drawLabelText(page, layout.marking, layout.marking.text, fonts, color, mapper, true);
  if (layout.size.text) {
    drawLabelText(page, layout.size, layout.size.text, fonts, color, mapper, true);
  }
}

function drawRotatedSideLabelText(
  page: PDFPage,
  item: PartLabelText,
  fonts: PdfDocumentFonts,
  color: PdfRgb,
  mapper: ReturnType<typeof createMapCoordinateMapper>,
) {
  const sizePt = mapper.mapLength(item.fontSizeMm);
  const textWidthPt = measurePdfTextWidth(fonts, item.text, sizePt, "regular");
  // Ширина в мм карты (scale учитывает mapper.mapLength).
  const textWidthMm =
    sizePt > 0 ? (item.fontSizeMm * textWidthPt) / sizePt : item.fontSizeMm;
  const baseline = rotatedTextBaselineSvg(item, textWidthMm, item.fontSizeMm);
  const origin = mapper.mapPoint(baseline.xMm, baseline.yMm);

  drawPdfText(page, fonts, {
    text: item.text,
    x: origin.x,
    y: origin.y,
    sizePt,
    weight: "regular",
    color,
    rotate: degrees(baseline.rotateDeg),
  });
}

function drawRotatedBadge(
  page: PDFPage,
  anchor: PartLabelText,
  badge: LabelBadge,
  color: PdfRgb,
  mapper: ReturnType<typeof createMapCoordinateMapper>,
) {
  // Ось-align AABB: надёжная белая заливка (drawSvgPath fill часто не виден).
  const bounds = mapRotatedBadgeBounds(anchor, badge, anchor.rotateDeg ?? 0);
  drawBadge(page, bounds, color, mapper);
}

function drawOffcutHatch(
  page: PDFPage,
  rect: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  mapper: ReturnType<typeof createMapCoordinateMapper>,
) {
  drawSvgRect(page, rect, mapper, { fillColor: PDF_COLORS.offcutFill });

  for (const line of clipOffcutHatchLines(rect)) {
    drawSvgLine(
      page,
      line.x1Mm,
      line.y1Mm,
      line.x2Mm,
      line.y2Mm,
      mapper,
      { color: PDF_COLORS.usableStroke, widthMm: 1.2 },
    );
  }
}

export function drawCutMapSheet(
  page: PDFPage,
  fonts: PdfDocumentFonts,
  slot: MapSlotMm,
  sheet: {
    widthMm: number;
    heightMm: number;
    usableXmm: number;
    usableYmm: number;
    usableWidthMm: number;
    usableHeightMm: number;
    placements: ClientPlacement[];
    operations: ClientCutOperation[];
    plannedOffcuts: ClientPlannedOffcut[];
  },
) {
  const viewBox = getOperatorCanvasViewBox(sheet.widthMm, sheet.heightMm);
  const operatorSheet = getOperatorSheetSize(sheet.widthMm, sheet.heightMm);
  const mapper = createMapCoordinateMapper(slot, viewBox, page.getHeight());

  drawSvgRect(
    page,
    { xMm: 0, yMm: 0, widthMm: operatorSheet.widthMm, heightMm: operatorSheet.heightMm },
    mapper,
    { borderColor: PDF_COLORS.sheetStroke, borderWidthMm: 2 },
  );

  const usableInset =
    sheet.usableXmm > 0 ||
    sheet.usableYmm > 0 ||
    sheet.usableWidthMm < sheet.widthMm ||
    sheet.usableHeightMm < sheet.heightMm;

  if (usableInset) {
    drawSvgRect(
      page,
      engineRectToOperatorSvg(
        {
          xMm: sheet.usableXmm,
          yMm: sheet.usableYmm,
          widthMm: sheet.usableWidthMm,
          heightMm: sheet.usableHeightMm,
        },
        sheet.heightMm,
      ),
      mapper,
      { borderColor: PDF_COLORS.usableStroke, borderWidthMm: 1.5, dashArray: [8, 5] },
    );
  }

  for (const [index, offcut] of sortOffcutsForLabeling(sheet.plannedOffcuts).entries()) {
    const rect = engineRectToOperatorSvg(offcut, sheet.heightMm);
    drawOffcutHatch(page, rect, mapper);
    drawSvgRect(page, rect, mapper, {
      borderColor: offcut.isUseful ? PDF_COLORS.offcutStroke : PDF_COLORS.usableStroke,
      borderWidthMm: 1.5,
    });
    drawOffcutLabelLayout(
      page,
      buildOffcutLabelLayout(
        rect,
        String(index + 1),
        offcut.widthMm,
        offcut.heightMm,
        operatorSheet,
        {
          xMm: viewBox.xMm,
          yMm: viewBox.yMm,
          widthMm: viewBox.widthMm,
          heightMm: viewBox.heightMm,
        },
      ),
      fonts,
      PDF_COLORS.offcutLabel,
      mapper,
    );
  }

  for (const placement of sheet.placements) {
    const rect = engineRectToOperatorSvg(placement, sheet.heightMm);
    const marking = resolvePlacementMarking(placement.label, placement.partInstanceIndex);
    drawSvgRect(page, rect, mapper, {
      fillColor: PDF_COLORS.partFill,
      borderColor: PDF_COLORS.partStroke,
      borderWidthMm: 2,
    });
    drawLabelLayout(
      page,
      buildPartLabelLayout(rect, marking, placement.widthMm, placement.heightMm),
      fonts,
      PDF_COLORS.partLabel,
      mapper,
    );
  }

  const cutOperations = getOperatorCutOperations(sheet.operations);

  for (const line of buildCutAxisLines(cutOperations, {
    xMm: 0,
    yMm: 0,
    widthMm: sheet.widthMm,
    heightMm: sheet.heightMm,
  })) {
    const p1 = enginePointToOperatorSvg(
      { xMm: line.x1Mm, yMm: line.y1Mm },
      sheet.heightMm,
    );
    const p2 = enginePointToOperatorSvg(
      { xMm: line.x2Mm, yMm: line.y2Mm },
      sheet.heightMm,
    );
    drawSvgLine(page, p1.xMm, p1.yMm, p2.xMm, p2.yMm, mapper, {
      color: PDF_COLORS.cutAxis,
      widthMm: 1.25,
    });
  }

  for (const operation of cutOperations) {
    const p1 = enginePointToOperatorSvg(
      { xMm: operation.x1Mm ?? 0, yMm: operation.y1Mm ?? 0 },
      sheet.heightMm,
    );
    const p2 = enginePointToOperatorSvg(
      { xMm: operation.x2Mm ?? 0, yMm: operation.y2Mm ?? 0 },
      sheet.heightMm,
    );
    drawSvgLine(page, p1.xMm, p1.yMm, p2.xMm, p2.yMm, mapper, {
      color: PDF_COLORS.cutLine,
      widthMm: 2.5,
      dashArray: [16, 10],
    });
  }
}

export function drawPdfTextLines(
  page: PDFPage,
  fonts: PdfDocumentFonts,
  slot: MapSlotMm,
  lines: Array<{
    text: string;
    yMm: number;
    fontSizeMm: number;
    bold?: boolean;
    color?: PdfRgb;
    align?: "left" | "right";
  }>,
) {
  const pageHeightPt = page.getHeight();
  for (const line of lines) {
    const weight = line.bold ? "semiBold" : "regular";
    const sizePt = mmToPt(line.fontSizeMm);
    const yPt = pageHeightPt - mmToPt(slot.yTopMm + line.yMm);
    const color = line.color ?? PDF_COLORS.text;
    const textWidth = measurePdfTextWidth(fonts, line.text, sizePt, weight);
    const xPt =
      line.align === "right"
        ? mmToPt(slot.xMm + slot.widthMm) - textWidth
        : mmToPt(slot.xMm);

    drawPdfText(page, fonts, {
      text: line.text,
      x: xPt,
      y: yPt,
      sizePt,
      weight,
      color,
    });
  }
}
