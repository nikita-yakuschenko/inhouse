/**
 * Осевая линия реза (серая) — ось, вдоль которой может идти пила.
 * Красный пунктир на карте — фактический отрезок траектории на этой оси.
 */

export type CutSegmentLike = {
  axis: string;
  x1Mm?: number | null;
  y1Mm?: number | null;
  x2Mm?: number | null;
  y2Mm?: number | null;
};

export type CutAxis = {
  axis: "vertical" | "horizontal";
  /** X для vertical, Y для horizontal (двигатель / заготовка). */
  positionMm: number;
};

export type AxisLineMm = {
  x1Mm: number;
  y1Mm: number;
  x2Mm: number;
  y2Mm: number;
};

export type SheetBoundsMm = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

function roundPos(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Уникальные оси по фактическим отрезкам реза. */
export function buildCutAxesFromSegments(segments: CutSegmentLike[]): CutAxis[] {
  const vertical = new Set<number>();
  const horizontal = new Set<number>();

  for (const segment of segments) {
    if (segment.axis === "vertical") {
      const x = segment.x1Mm ?? segment.x2Mm;
      if (x != null && Number.isFinite(x)) vertical.add(roundPos(x));
    } else if (segment.axis === "horizontal") {
      const y = segment.y1Mm ?? segment.y2Mm;
      if (y != null && Number.isFinite(y)) horizontal.add(roundPos(y));
    }
  }

  return [
    ...[...vertical]
      .sort((a, b) => a - b)
      .map((positionMm) => ({ axis: "vertical" as const, positionMm })),
    ...[...horizontal]
      .sort((a, b) => a - b)
      .map((positionMm) => ({ axis: "horizontal" as const, positionMm })),
  ];
}

/** Полная осевая линия по границам заготовки/рабочей зоны. */
export function cutAxisToLine(axis: CutAxis, bounds: SheetBoundsMm): AxisLineMm {
  if (axis.axis === "vertical") {
    return {
      x1Mm: axis.positionMm,
      y1Mm: bounds.yMm,
      x2Mm: axis.positionMm,
      y2Mm: bounds.yMm + bounds.heightMm,
    };
  }

  return {
    x1Mm: bounds.xMm,
    y1Mm: axis.positionMm,
    x2Mm: bounds.xMm + bounds.widthMm,
    y2Mm: axis.positionMm,
  };
}

export function buildCutAxisLines(
  segments: CutSegmentLike[],
  bounds: SheetBoundsMm,
): AxisLineMm[] {
  return buildCutAxesFromSegments(segments).map((axis) =>
    cutAxisToLine(axis, bounds),
  );
}
