import type { PDFPage } from "pdf-lib";
import { degrees, rgb } from "pdf-lib";

import type { ClientCutOperation, ClientPlacement, ClientPlannedOffcut } from "@/features/projects/serialize-panels";
import { getOperatorCutOperations } from "@/lib/cut-plan/operator-operations";
import {
  buildPartLabelLayout,
  LABEL_BADGE_STROKE_MM,
  sortOffcutsForLabeling,
  type LabelBadge,
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
import { mapRotatedBadgeCorners } from "@/lib/cut-plan/pdf-label-geometry";
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
    const sizePt = mapper.mapLength(layout.rightSide.fontSizeMm);
    const anchor = mapper.mapPoint(layout.rightSide.xMm, layout.rightSide.yMm);
    drawPdfText(page, fonts, {
      text: layout.rightSide.text,
      x: anchor.x,
      y: anchor.y,
      sizePt,
      weight: "regular",
      color,
      rotate: degrees(layout.rightSide.rotateDeg ?? 0),
    });
  }
}

function drawRotatedBadge(
  page: PDFPage,
  anchor: PartLabelText,
  badge: LabelBadge,
  color: PdfRgb,
  mapper: ReturnType<typeof createMapCoordinateMapper>,
) {
  const corners = mapRotatedBadgeCorners(anchor, badge, anchor.rotateDeg ?? 0);
  const mapped = corners.map((corner) => mapper.mapPoint(corner.xMm, corner.yMm));
  const [first, second, third, fourth] = mapped;
  if (!first || !second || !third || !fourth) {
    return;
  }

  page.drawSvgPath(
    `M ${first.x} ${first.y} L ${second.x} ${second.y} L ${third.x} ${third.y} L ${fourth.x} ${fourth.y} Z`,
    {
      color: toColor({ r: 1, g: 1, b: 1 }),
      borderWidth: 0,
    },
  );

  const border = {
    color,
    widthMm: LABEL_BADGE_STROKE_MM,
  };
  for (let index = 0; index < corners.length; index += 1) {
    const start = corners[index]!;
    const end = corners[(index + 1) % corners.length]!;
    drawSvgLine(page, start.xMm, start.yMm, end.xMm, end.yMm, mapper, border);
  }
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

  drawSvgRect(
    page,
    engineRectToOperatorSvg(
      {
        xMm: sheet.usableXmm,
        yMm: sheet.usableYmm,
        widthMm: sheet.usableWidthMm,
        heightMm: sheet.usableHeightMm,
      },
      sheet.widthMm,
    ),
    mapper,
    { borderColor: PDF_COLORS.usableStroke, borderWidthMm: 1.5, dashArray: [8, 5] },
  );

  for (const [index, offcut] of sortOffcutsForLabeling(sheet.plannedOffcuts).entries()) {
    const rect = engineRectToOperatorSvg(offcut, sheet.widthMm);
    drawOffcutHatch(page, rect, mapper);
    drawSvgRect(page, rect, mapper, {
      borderColor: offcut.isUseful ? PDF_COLORS.offcutStroke : PDF_COLORS.usableStroke,
      borderWidthMm: 1.5,
    });
    drawLabelLayout(
      page,
      buildPartLabelLayout(rect, String(index + 1), offcut.widthMm, offcut.heightMm),
      fonts,
      PDF_COLORS.offcutLabel,
      mapper,
    );
  }

  for (const placement of sheet.placements) {
    const rect = engineRectToOperatorSvg(placement, sheet.widthMm);
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

  for (const operation of getOperatorCutOperations(sheet.operations)) {
    const p1 = enginePointToOperatorSvg(
      { xMm: operation.x1Mm ?? 0, yMm: operation.y1Mm ?? 0 },
      sheet.widthMm,
    );
    const p2 = enginePointToOperatorSvg(
      { xMm: operation.x2Mm ?? 0, yMm: operation.y2Mm ?? 0 },
      sheet.widthMm,
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
