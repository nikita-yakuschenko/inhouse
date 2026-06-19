"use client";

import type {
  ClientCutOperation,
  ClientPlacement,
  ClientPlannedOffcut,
} from "@/features/projects/serialize-panels";
import {
  enginePointToOperatorSvg,
  engineRectToOperatorSvg,
  getOperatorCanvasViewBox,
  getOperatorSheetSize,
} from "@/lib/cut-plan/operator-view";
import { getOperatorCutOperations } from "@/lib/cut-plan/operator-operations";
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
import { resolvePlacementMarking } from "@/lib/engine/validation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Розово-красная заливка готовой детали */
const PART_FILL = "#fda4af";
const PART_STROKE = "#e11d48";
const PART_LABEL_FILL = "#881337";
const OFFCUT_LABEL_FILL = "#334155";
const PART_LABEL_FONT = 'var(--font-ibm-plex), "IBM Plex Sans", system-ui, sans-serif';

function LabelBadgeRect({ badge, stroke }: { badge: LabelBadge; stroke: string }) {
  const radius = Math.min(
    LABEL_BADGE_RADIUS_MM,
    badge.widthMm / 2 - LABEL_BADGE_STROKE_MM,
    badge.heightMm / 2 - LABEL_BADGE_STROKE_MM,
  );

  return (
    <rect
      x={badge.xMm}
      y={badge.yMm}
      width={badge.widthMm}
      height={badge.heightMm}
      rx={Math.max(4, radius)}
      ry={Math.max(4, radius)}
      fill={LABEL_BADGE_FILL}
      stroke={stroke}
      strokeWidth={LABEL_BADGE_STROKE_MM}
    />
  );
}

function LabelText({
  item,
  fill,
  bold = false,
}: {
  item: PartLabelText;
  fill: string;
  bold?: boolean;
}) {
  const transform = item.rotateDeg
    ? `rotate(${item.rotateDeg} ${item.xMm} ${item.yMm})`
    : undefined;

  return (
    <text
      x={item.xMm}
      y={item.yMm}
      fontSize={item.fontSizeMm}
      fill={fill}
      fontFamily={PART_LABEL_FONT}
      fontWeight={bold ? 600 : 500}
      textAnchor={item.textAnchor ?? "start"}
      dominantBaseline={item.dominantBaseline}
      transform={transform}
    >
      {item.text}
    </text>
  );
}

function RotatedLabelGroup({
  item,
  badge,
  fill,
  bold = false,
}: {
  item: PartLabelText;
  badge: LabelBadge;
  fill: string;
  bold?: boolean;
}) {
  const rotateDeg = item.rotateDeg ?? 0;
  const radius = Math.min(
    LABEL_BADGE_RADIUS_MM,
    badge.widthMm / 2 - LABEL_BADGE_STROKE_MM,
    badge.heightMm / 2 - LABEL_BADGE_STROKE_MM,
  );

  return (
    <g transform={`translate(${item.xMm} ${item.yMm}) rotate(${rotateDeg})`}>
      <rect
        x={badge.xMm}
        y={badge.yMm}
        width={badge.widthMm}
        height={badge.heightMm}
        rx={Math.max(4, radius)}
        ry={Math.max(4, radius)}
        fill={LABEL_BADGE_FILL}
        stroke={fill}
        strokeWidth={LABEL_BADGE_STROKE_MM}
      />
      <text
        x={0}
        y={0}
        fontSize={item.fontSizeMm}
        fill={fill}
        fontFamily={PART_LABEL_FONT}
        fontWeight={bold ? 600 : 500}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {item.text}
      </text>
    </g>
  );
}

function RectLabelTexts({
  layout,
  fill = PART_LABEL_FILL,
}: {
  layout: PartLabelLayout;
  fill?: string;
}) {
  return (
    <>
      <LabelBadgeRect badge={layout.centerBadge} stroke={fill} />
      <LabelText item={layout.marking} fill={fill} bold />
      {layout.centerSize ? <LabelText item={layout.centerSize} fill={fill} bold /> : null}

      {layout.bottomSide && layout.bottomBadge ? (
        <>
          <LabelBadgeRect badge={layout.bottomBadge} stroke={fill} />
          <LabelText item={layout.bottomSide} fill={fill} />
        </>
      ) : null}

      {layout.rightSide && layout.rightBadge ? (
        <RotatedLabelGroup
          item={layout.rightSide}
          badge={layout.rightBadge}
          fill={fill}
        />
      ) : null}
    </>
  );
}

type SheetCanvasProps = {
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
  embedded?: boolean;
  showTitle?: boolean;
};

export function SheetCanvas({
  embedded = false,
  showTitle = true,
  ...props
}: SheetCanvasProps) {
  const operatorSheet = getOperatorSheetSize(props.widthMm, props.heightMm);
  const canvasViewBox = getOperatorCanvasViewBox(props.widthMm, props.heightMm);
  const viewBox = `${canvasViewBox.xMm} ${canvasViewBox.yMm} ${canvasViewBox.widthMm} ${canvasViewBox.heightMm}`;

  const usableRect = engineRectToOperatorSvg(
    {
      xMm: props.usableXmm,
      yMm: props.usableYmm,
      widthMm: props.usableWidthMm,
      heightMm: props.usableHeightMm,
    },
    props.widthMm,
  );

  const cutOperations = getOperatorCutOperations(props.operations);
  const offcutPatternId = `offcut-hatch-${props.sheetIndex}`;
  const labeledOffcuts = sortOffcutsForLabeling(props.plannedOffcuts);

  const canvasBody = (
    <>
      <div className="min-h-0 flex-1 w-full">
        <svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full"
          role="img"
          aria-label={`Карта раскроя листа ${props.sheetIndex}`}
        >
            <defs>
              <pattern
                id={offcutPatternId}
                patternUnits="userSpaceOnUse"
                width={16}
                height={16}
                patternTransform="rotate(45)"
              >
                <rect width={16} height={16} fill="#f1f5f9" />
                <line x1={0} y1={0} x2={0} y2={16} stroke="#94a3b8" strokeWidth={2} />
              </pattern>
            </defs>

            <rect
              x={0}
              y={0}
              width={operatorSheet.widthMm}
              height={operatorSheet.heightMm}
              fill="#ffffff"
              stroke="#334155"
              strokeWidth={2}
            />

            <rect
              x={usableRect.xMm}
              y={usableRect.yMm}
              width={usableRect.widthMm}
              height={usableRect.heightMm}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="8 5"
            />

            {labeledOffcuts.map((offcut, index) => {
              const rect = engineRectToOperatorSvg(offcut, props.widthMm);
              const marking = String(index + 1);
              const labelLayout = buildPartLabelLayout(
                rect,
                marking,
                offcut.widthMm,
                offcut.heightMm,
              );

              return (
                <g key={offcut.id}>
                  <title>{`Обрезок ${marking} — ${offcut.widthMm}×${offcut.heightMm} мм`}</title>
                  <rect
                    x={rect.xMm}
                    y={rect.yMm}
                    width={rect.widthMm}
                    height={rect.heightMm}
                    fill={`url(#${offcutPatternId})`}
                    stroke={offcut.isUseful ? "#64748b" : "#94a3b8"}
                    strokeWidth={1.5}
                  />
                  <RectLabelTexts layout={labelLayout} fill={OFFCUT_LABEL_FILL} />
                </g>
              );
            })}

            {props.placements.map((placement) => {
              const rect = engineRectToOperatorSvg(placement, props.widthMm);
              const marking = resolvePlacementMarking(
                placement.label,
                placement.partInstanceIndex,
              );
              const labelLayout = buildPartLabelLayout(
                rect,
                marking,
                placement.widthMm,
                placement.heightMm,
              );

              return (
                <g key={placement.id}>
                  <title>{`${marking} — ${placement.widthMm}×${placement.heightMm} мм`}</title>
                  <rect
                    x={rect.xMm}
                    y={rect.yMm}
                    width={rect.widthMm}
                    height={rect.heightMm}
                    fill={PART_FILL}
                    stroke={PART_STROKE}
                    strokeWidth={2}
                  />
                  <RectLabelTexts layout={labelLayout} />
                </g>
              );
            })}

            {cutOperations.map((operation) => {
                const p1 = enginePointToOperatorSvg(
                  {
                    xMm: operation.x1Mm ?? 0,
                    yMm: operation.y1Mm ?? 0,
                  },
                  props.widthMm,
                );
                const p2 = enginePointToOperatorSvg(
                  {
                    xMm: operation.x2Mm ?? 0,
                    yMm: operation.y2Mm ?? 0,
                  },
                  props.widthMm,
                );
                return (
                  <line
                    key={operation.id}
                    x1={p1.xMm}
                    y1={p1.yMm}
                    x2={p2.xMm}
                    y2={p2.yMm}
                    stroke="#dc2626"
                    strokeWidth={2.5}
                    strokeDasharray="16 10"
                  />
                );
              })}
        </svg>
      </div>
    </>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col p-4 md:p-6">{canvasBody}</div>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="flex shrink-0 flex-row flex-wrap items-start justify-between gap-2 space-y-0 py-3">
        {showTitle ? (
          <div>
            <CardTitle className="text-base">Лист {props.sheetIndex}</CardTitle>
            <CardDescription>
              {props.widthMm}×{props.heightMm} мм
            </CardDescription>
          </div>
        ) : (
          <div>
            <CardDescription>
              {props.widthMm}×{props.heightMm} мм
            </CardDescription>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 pb-3">{canvasBody}</CardContent>
    </Card>
  );
}
