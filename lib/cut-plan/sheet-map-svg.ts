import type {
  ClientCutOperation,
  ClientPlacement,
  ClientPlannedOffcut,
} from "@/features/projects/serialize-panels";
import { getOperatorCutOperations } from "@/lib/cut-plan/operator-operations";
import { buildCutAxisLines } from "@/lib/cut-plan/cut-axes";
import { buildOffcutHatchSvg } from "@/lib/cut-plan/offcut-hatch-svg";
import { SVG_FONT_FAMILY } from "@/lib/cut-plan/pdf-font";
import {
  buildOffcutLabelLayout,
  buildPartLabelLayout,
  LABEL_BADGE_FILL,
  LABEL_BADGE_RADIUS_MM,
  LABEL_BADGE_STROKE_MM,
  sortOffcutsForLabeling,
  type LabelBadge,
  type OffcutLabelLayout,
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
const CUT_AXIS_STROKE = "#94a3b8";
const CUT_SEGMENT_STROKE = "#dc2626";

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

function renderOffcutLabelLayout(layout: OffcutLabelLayout, fill = OFFCUT_LABEL_FILL) {
  if (layout.type === "inline") {
    return renderLabelLayout(layout.layout, fill);
  }

  return [
    `<line x1="${layout.anchorXMm}" y1="${layout.anchorYMm}" x2="${layout.leaderEndXMm}" y2="${layout.leaderEndYMm}" stroke="${fill}" stroke-width="2" />`,
    `<circle cx="${layout.anchorXMm}" cy="${layout.anchorYMm}" r="6" fill="${fill}" />`,
    labelBadgeRect(layout.badge, fill),
    labelText(layout.marking, fill, true),
    layout.size.text ? labelText(layout.size, fill, true) : "",
  ].join("");
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
    input.heightMm,
  );

  const cutOperations = getOperatorCutOperations(input.operations);
  const labeledOffcuts = sortOffcutsForLabeling(input.plannedOffcuts);

  const offcutShapes = labeledOffcuts
    .map((offcut, index) => {
      const rect = engineRectToOperatorSvg(offcut, input.heightMm);
      const marking = String(index + 1);
      const labelLayout = buildOffcutLabelLayout(
        rect,
        marking,
        offcut.widthMm,
        offcut.heightMm,
        operatorSheet,
        {
          xMm: canvasViewBox.xMm,
          yMm: canvasViewBox.yMm,
          widthMm: canvasViewBox.widthMm,
          heightMm: canvasViewBox.heightMm,
        },
      );
      const clipId = `offcut-clip-${input.mapId}-${index}`;

      return `<g>
        ${buildOffcutHatchSvg(rect, clipId)}
        <rect x="${rect.xMm}" y="${rect.yMm}" width="${rect.widthMm}" height="${rect.heightMm}" fill="none" stroke="${offcut.isUseful ? "#64748b" : "#94a3b8"}" stroke-width="1.5" />
        ${renderOffcutLabelLayout(labelLayout)}
      </g>`;
    })
    .join("");

  const placementShapes = input.placements
    .map((placement) => {
      const rect = engineRectToOperatorSvg(placement, input.heightMm);
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

  const cutAxisLines =
    input.showCutLines === false
      ? ""
      : buildCutAxisLines(cutOperations, {
          xMm: 0,
          yMm: 0,
          widthMm: input.widthMm,
          heightMm: input.heightMm,
        })
          .map((line) => {
            const p1 = enginePointToOperatorSvg(
              { xMm: line.x1Mm, yMm: line.y1Mm },
              input.heightMm,
            );
            const p2 = enginePointToOperatorSvg(
              { xMm: line.x2Mm, yMm: line.y2Mm },
              input.heightMm,
            );
            return `<line x1="${p1.xMm}" y1="${p1.yMm}" x2="${p2.xMm}" y2="${p2.yMm}" stroke="${CUT_AXIS_STROKE}" stroke-width="1.25" />`;
          })
          .join("");

  const cutSegmentLines =
    input.showCutLines === false
      ? ""
      : cutOperations
          .map((operation) => {
            const p1 = enginePointToOperatorSvg(
              { xMm: operation.x1Mm ?? 0, yMm: operation.y1Mm ?? 0 },
              input.heightMm,
            );
            const p2 = enginePointToOperatorSvg(
              { xMm: operation.x2Mm ?? 0, yMm: operation.y2Mm ?? 0 },
              input.heightMm,
            );

            return `<line x1="${p1.xMm}" y1="${p1.yMm}" x2="${p2.xMm}" y2="${p2.yMm}" stroke="${CUT_SEGMENT_STROKE}" stroke-width="2.5" stroke-dasharray="16 10" />`;
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
    ${
      input.usableXmm > 0 ||
      input.usableYmm > 0 ||
      input.usableWidthMm < input.widthMm ||
      input.usableHeightMm < input.heightMm
        ? `<rect x="${usableRect.xMm}" y="${usableRect.yMm}" width="${usableRect.widthMm}" height="${usableRect.heightMm}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="8 5" />`
        : ""
    }
    ${offcutShapes}
    ${placementShapes}
    ${cutAxisLines}
    ${cutSegmentLines}
  </svg>`;
}
