"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { IconMinus, IconPlus, IconZoomReset } from "@tabler/icons-react";
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
import { resolvePlacementMarking } from "@/lib/engine/validation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const MIN_SCALE = 1;
const MAX_SCALE = 12;
const ZOOM_FACTOR = 1.25;

type CanvasBase = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

type Viewport = {
  scale: number;
  xMm: number;
  yMm: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createViewport(base: CanvasBase): Viewport {
  return { scale: 1, xMm: base.xMm, yMm: base.yMm };
}

function clampViewport(viewport: Viewport, base: CanvasBase): Viewport {
  const scale = clamp(viewport.scale, MIN_SCALE, MAX_SCALE);
  const visibleWidthMm = base.widthMm / scale;
  const visibleHeightMm = base.heightMm / scale;
  const maxX = base.xMm + base.widthMm - visibleWidthMm;
  const maxY = base.yMm + base.heightMm - visibleHeightMm;

  return {
    scale,
    xMm: clamp(viewport.xMm, base.xMm, maxX),
    yMm: clamp(viewport.yMm, base.yMm, maxY),
  };
}

function zoomViewport(
  viewport: Viewport,
  base: CanvasBase,
  nextScale: number,
  focusXMm: number,
  focusYMm: number,
): Viewport {
  const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
  if (scale === viewport.scale) {
    return clampViewport(viewport, base);
  }

  const ratio = viewport.scale / scale;
  return clampViewport(
    {
      scale,
      xMm: focusXMm - (focusXMm - viewport.xMm) * ratio,
      yMm: focusYMm - (focusYMm - viewport.yMm) * ratio,
    },
    base,
  );
}

function clientToSvgPoint(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { xMm: number; yMm: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;

  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const mapped = point.matrixTransform(ctm.inverse());
  return { xMm: mapped.x, yMm: mapped.y };
}

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

function OffcutLabelTexts({
  layout,
  fill = OFFCUT_LABEL_FILL,
}: {
  layout: OffcutLabelLayout;
  fill?: string;
}) {
  if (layout.type === "inline") {
    return <RectLabelTexts layout={layout.layout} fill={fill} />;
  }

  return (
    <>
      <line
        x1={layout.anchorXMm}
        y1={layout.anchorYMm}
        x2={layout.leaderEndXMm}
        y2={layout.leaderEndYMm}
        stroke={fill}
        strokeWidth={2}
      />
      <circle
        cx={layout.anchorXMm}
        cy={layout.anchorYMm}
        r={6}
        fill={fill}
      />
      <LabelBadgeRect badge={layout.badge} stroke={fill} />
      <LabelText item={layout.marking} fill={fill} bold />
      {layout.size.text ? <LabelText item={layout.size} fill={fill} bold /> : null}
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
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    lastClientX: number;
    lastClientY: number;
  } | null>(null);

  const operatorSheet = getOperatorSheetSize(props.widthMm, props.heightMm);
  const canvasViewBox = getOperatorCanvasViewBox(props.widthMm, props.heightMm);
  const base: CanvasBase = {
    xMm: canvasViewBox.xMm,
    yMm: canvasViewBox.yMm,
    widthMm: canvasViewBox.widthMm,
    heightMm: canvasViewBox.heightMm,
  };

  const [viewport, setViewport] = useState<Viewport>(() => createViewport(base));

  // Сброс при смене листа / размера заготовки
  useEffect(() => {
    setViewport(
      createViewport({
        xMm: canvasViewBox.xMm,
        yMm: canvasViewBox.yMm,
        widthMm: canvasViewBox.widthMm,
        heightMm: canvasViewBox.heightMm,
      }),
    );
    dragRef.current = null;
  }, [
    props.sheetIndex,
    canvasViewBox.xMm,
    canvasViewBox.yMm,
    canvasViewBox.widthMm,
    canvasViewBox.heightMm,
  ]);

  // wheel на SVG по умолчанию passive — иначе страница скроллится вместо зума
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const canvasBase: CanvasBase = {
      xMm: canvasViewBox.xMm,
      yMm: canvasViewBox.yMm,
      widthMm: canvasViewBox.widthMm,
      heightMm: canvasViewBox.heightMm,
    };

    const onWheel = (event: globalThis.WheelEvent) => {
      event.preventDefault();
      const focus = clientToSvgPoint(svg, event.clientX, event.clientY);
      if (!focus) return;

      const factor = event.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
      setViewport((current) =>
        zoomViewport(current, canvasBase, current.scale * factor, focus.xMm, focus.yMm),
      );
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [
    canvasViewBox.xMm,
    canvasViewBox.yMm,
    canvasViewBox.widthMm,
    canvasViewBox.heightMm,
  ]);

  const visibleWidthMm = base.widthMm / viewport.scale;
  const visibleHeightMm = base.heightMm / viewport.scale;
  const viewBox = `${viewport.xMm} ${viewport.yMm} ${visibleWidthMm} ${visibleHeightMm}`;
  const zoomPercent = Math.round(viewport.scale * 100);

  const usableRect = engineRectToOperatorSvg(
    {
      xMm: props.usableXmm,
      yMm: props.usableYmm,
      widthMm: props.usableWidthMm,
      heightMm: props.usableHeightMm,
    },
    props.heightMm,
  );

  const cutOperations = getOperatorCutOperations(props.operations);
  const offcutPatternId = `offcut-hatch-${props.sheetIndex}`;
  const labeledOffcuts = sortOffcutsForLabeling(props.plannedOffcuts);

  function zoomBy(factor: number, focusXMm?: number, focusYMm?: number) {
    setViewport((current) => {
      const focusX = focusXMm ?? current.xMm + base.widthMm / current.scale / 2;
      const focusY = focusYMm ?? current.yMm + base.heightMm / current.scale / 2;
      return zoomViewport(current, base, current.scale * factor, focusX, focusY);
    });
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    event.preventDefault(); // не давать браузеру выделять подписи на SVG
    dragRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!ctm || ctm.a === 0 || ctm.d === 0) return;

    const dxMm = (event.clientX - drag.lastClientX) / ctm.a;
    const dyMm = (event.clientY - drag.lastClientY) / ctm.d;
    drag.lastClientX = event.clientX;
    drag.lastClientY = event.clientY;

    setViewport((current) =>
      clampViewport(
        {
          ...current,
          xMm: current.xMm - dxMm,
          yMm: current.yMm - dyMm,
        },
        base,
      ),
    );
  }

  function handlePointerUp(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  }

  function handleDoubleClick() {
    setViewport(createViewport(base));
  }

  const zoomControls = (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-md border bg-background/95 p-1 shadow-xs backdrop-blur-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => zoomBy(1 / ZOOM_FACTOR)}
        disabled={viewport.scale <= MIN_SCALE}
        aria-label="Отдалить"
      >
        <IconMinus />
      </Button>
      <span className="min-w-12 px-1 text-center text-xs tabular-nums text-muted-foreground">
        {zoomPercent}%
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => zoomBy(ZOOM_FACTOR)}
        disabled={viewport.scale >= MAX_SCALE}
        aria-label="Приблизить"
      >
        <IconPlus />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={() => setViewport(createViewport(base))}
        disabled={viewport.scale === 1}
        aria-label="Сбросить масштаб"
        title="Сбросить"
      >
        <IconZoomReset />
      </Button>
    </div>
  );

  const canvasBody = (
    <>
      <div className="relative min-h-0 flex-1 w-full">
        {zoomControls}
        <svg
          ref={svgRef}
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full touch-none select-none cursor-grab active:cursor-grabbing [&_text]:select-none"
          role="img"
          aria-label={`Карта раскроя листа ${props.sheetIndex}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
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
              const rect = engineRectToOperatorSvg(offcut, props.heightMm);
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
                  <OffcutLabelTexts layout={labelLayout} />
                </g>
              );
            })}

            {props.placements.map((placement) => {
              const rect = engineRectToOperatorSvg(placement, props.heightMm);
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
                  props.heightMm,
                );
                const p2 = enginePointToOperatorSvg(
                  {
                    xMm: operation.x2Mm ?? 0,
                    yMm: operation.y2Mm ?? 0,
                  },
                  props.heightMm,
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
        <p className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/80 px-2 py-1 text-[11px] text-muted-foreground">
          Колесо — масштаб · перетаскивание — сдвиг · двойной клик — сброс
        </p>
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
