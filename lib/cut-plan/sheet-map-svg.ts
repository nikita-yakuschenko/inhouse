import type {
  ClientCutOperation,
  ClientPlacement,
  ClientPlannedOffcut,
} from "@/features/projects/serialize-panels";
import { getOperatorCutOperations } from "@/lib/cut-plan/operator-operations";
import { buildOffcutHatchSvg } from "@/lib/cut-plan/offcut-hatch-svg";
import { SVG_FONT_FAMILY } from "@/lib/cut-plan/pdf-font";
import {
  buildPartLabelLayout,
  LABEL_BADGE_FILL,
  LABEL_BADGE_RADIUS_MM,
  LABEL_BADGE_STROKE_MM,
  sortOffcutsForLabeling,
  type LabelBadge,
  type PartLabelLayout,
  type PartLabelText,
} from "@/lib/cut-plan/part-label-layout";
import {
  enginePointToOperatorSvg,
  engineRectToOperatorSvg,
  getOperatorCanvasViewBox,
  getOperatorSheetSize,
} from "@/lib/cut-plan/operator-view";
import { resolvePlacementMarking } from "@/lib/engine/validation";

const PART_FILL = "#fda4af";
const PART_STROKE = "#e11d48";
const PART_LABEL_FILL = "#881337";
const OFFCUT_LABEL_FILL = "#334155";

export type SheetMapSvgInput = {
  mapId: string;
  sheetIndex: number;
  widthMm: number;
  heightMm: number;
  usableXmm: number;
  usableYmm: number;
  usableWidthMm: number;
  usableHeightMm: number;
  placements: ClientPlacement[];
  operations: ClientCutOperation[];
  plannedOffcuts: ClientPlannedOffcut[];
  showCutLines?: boolean;
  fontStyles?: string;
};

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function labelBadgeRect(badge: LabelBadge, stroke: string) {
  const radius = Math.min(
    LABEL_BADGE_RADIUS_MM,
    badge.widthMm / 2 - LABEL_BADGE_STROKE_MM,
    badge.heightMm / 2 - LABEL_BADGE_STROKE_MM,
  );

  return `<rect x="${badge.xMm}" y="${badge.yMm}" width="${badge.widthMm}" height="${badge.heightMm}" rx="${Math.max(4, radius)}" ry="${Math.max(4, radius)}" fill="${LABEL_BADGE_FILL}" stroke="${stroke}" stroke-width="${LABEL_BADGE_STROKE_MM}" />`;
}

function labelText(item: PartLabelText, fill: string, bold = false) {
  const transform = item.rotateDeg
    ? ` transform="rotate(${item.rotateDeg} ${item.xMm} ${item.yMm})"`
    : "";

  return `<text x="${item.xMm}" y="${item.yMm}" font-size="${item.fontSizeMm}" fill="${fill}" font-family="${SVG_FONT_FAMILY}, sans-serif" font-weight="${bold ? 600 : 400}" text-anchor="${item.textAnchor ?? "start"}" dominant-baseline="${item.dominantBaseline ?? "auto"}"${transform}>${escapeXml(item.text)}</text>`;
}

function rotatedLabelGroup(item: PartLabelText, badge: LabelBadge, fill: string) {
  const radius = Math.min(
    LABEL_BADGE_RADIUS_MM,
    badge.widthMm / 2 - LABEL_BADGE_STROKE_MM,
    badge.heightMm / 2 - LABEL_BADGE_STROKE_MM,
  );

  return `<g transform="translate(${item.xMm} ${item.yMm}) rotate(${item.rotateDeg ?? 0})">
    <rect x="${badge.xMm}" y="${badge.yMm}" width="${badge.widthMm}" height="${badge.heightMm}" rx="${Math.max(4, radius)}" ry="${Math.max(4, radius)}" fill="${LABEL_BADGE_FILL}" stroke="${fill}" stroke-width="${LABEL_BADGE_STROKE_MM}" />
    <text x="0" y="0" font-size="${item.fontSizeMm}" fill="${fill}" font-family="${SVG_FONT_FAMILY}, sans-serif" font-weight="400" text-anchor="middle" dominant-baseline="middle">${escapeXml(item.text)}</text>
  </g>`;
}

function renderLabelLayout(layout: PartLabelLayout, fill = PART_LABEL_FILL) {
  const parts = [
    labelBadgeRect(layout.centerBadge, fill),
    labelText(layout.marking, fill, true),
    layout.centerSize ? labelText(layout.centerSize, fill, true) : "",
    layout.bottomSide && layout.bottomBadge
      ? labelBadgeRect(layout.bottomBadge, fill) + labelText(layout.bottomSide, fill)
      : "",
    layout.rightSide && layout.rightBadge
      ? rotatedLabelGroup(layout.rightSide, layout.rightBadge, fill)
      : "",
  ];

  return parts.join("");
}

export function buildSheetMapSvg(input: SheetMapSvgInput): string {
  const operatorSheet = getOperatorSheetSize(input.widthMm, input.heightMm);
  const canvasViewBox = getOperatorCanvasViewBox(input.widthMm, input.heightMm);
  const viewBox = `${canvasViewBox.xMm} ${canvasViewBox.yMm} ${canvasViewBox.widthMm} ${canvasViewBox.heightMm}`;

  const usableRect = engineRectToOperatorSvg(
    {
      xMm: input.usableXmm,
      yMm: input.usableYmm,
      widthMm: input.usableWidthMm,
      heightMm: input.usableHeightMm,
    },
    input.widthMm,
  );

  const cutOperations = getOperatorCutOperations(input.operations);
  const labeledOffcuts = sortOffcutsForLabeling(input.plannedOffcuts);

  const offcutShapes = labeledOffcuts
    .map((offcut, index) => {
      const rect = engineRectToOperatorSvg(offcut, input.widthMm);
      const marking = String(index + 1);
      const labelLayout = buildPartLabelLayout(rect, marking, offcut.widthMm, offcut.heightMm);
      const clipId = `offcut-clip-${input.mapId}-${index}`;

      return `<g>
        ${buildOffcutHatchSvg(rect, clipId)}
        <rect x="${rect.xMm}" y="${rect.yMm}" width="${rect.widthMm}" height="${rect.heightMm}" fill="none" stroke="${offcut.isUseful ? "#64748b" : "#94a3b8"}" stroke-width="1.5" />
        ${renderLabelLayout(labelLayout, OFFCUT_LABEL_FILL)}
      </g>`;
    })
    .join("");

  const placementShapes = input.placements
    .map((placement) => {
      const rect = engineRectToOperatorSvg(placement, input.widthMm);
      const marking = resolvePlacementMarking(placement.label, placement.partInstanceIndex);
      const labelLayout = buildPartLabelLayout(
        rect,
        marking,
        placement.widthMm,
        placement.heightMm,
      );

      return `<g>
        <rect x="${rect.xMm}" y="${rect.yMm}" width="${rect.widthMm}" height="${rect.heightMm}" fill="${PART_FILL}" stroke="${PART_STROKE}" stroke-width="2" />
        ${renderLabelLayout(labelLayout)}
      </g>`;
    })
    .join("");

  const cutLines =
    input.showCutLines === false
      ? ""
      : cutOperations
          .map((operation) => {
            const p1 = enginePointToOperatorSvg(
              { xMm: operation.x1Mm ?? 0, yMm: operation.y1Mm ?? 0 },
              input.widthMm,
            );
            const p2 = enginePointToOperatorSvg(
              { xMm: operation.x2Mm ?? 0, yMm: operation.y2Mm ?? 0 },
              input.widthMm,
            );

            return `<line x1="${p1.xMm}" y1="${p1.yMm}" x2="${p2.xMm}" y2="${p2.yMm}" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="16 10" />`;
          })
          .join("");

  const fontStyles = input.fontStyles
    ? `<style type="text/css"><![CDATA[${input.fontStyles}]]></style>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${canvasViewBox.widthMm}" height="${canvasViewBox.heightMm}">
    <defs>
      ${fontStyles}
    </defs>
    <rect x="0" y="0" width="${operatorSheet.widthMm}" height="${operatorSheet.heightMm}" fill="#ffffff" stroke="#334155" stroke-width="2" />
    <rect x="${usableRect.xMm}" y="${usableRect.yMm}" width="${usableRect.widthMm}" height="${usableRect.heightMm}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8 5" />
    ${offcutShapes}
    ${placementShapes}
    ${cutLines}
  </svg>`;
}
