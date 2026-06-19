import type { MmRect } from "@/lib/cut-plan/operator-view";

export const OFFCUT_HATCH_STEP_MM = 12;

export function buildOffcutHatchLines(rect: MmRect) {
  const lines: Array<{ x1Mm: number; y1Mm: number; x2Mm: number; y2Mm: number }> = [];

  for (let offset = -rect.heightMm; offset <= rect.widthMm; offset += OFFCUT_HATCH_STEP_MM) {
    lines.push({
      x1Mm: rect.xMm + offset,
      y1Mm: rect.yMm,
      x2Mm: rect.xMm + offset - rect.heightMm,
      y2Mm: rect.yMm + rect.heightMm,
    });
  }

  return lines;
}

function pointInRect(x: number, y: number, rect: MmRect) {
  return (
    x >= rect.xMm &&
    x <= rect.xMm + rect.widthMm &&
    y >= rect.yMm &&
    y <= rect.yMm + rect.heightMm
  );
}

function segmentIntersection(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
) {
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-9) {
    return null;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  };
}

export function clipSegmentToRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: MmRect,
) {
  const minX = rect.xMm;
  const maxX = rect.xMm + rect.widthMm;
  const minY = rect.yMm;
  const maxY = rect.yMm + rect.heightMm;
  const points: Array<{ x: number; y: number }> = [];

  if (pointInRect(x1, y1, rect)) {
    points.push({ x: x1, y: y1 });
  }
  if (pointInRect(x2, y2, rect)) {
    points.push({ x: x2, y: y2 });
  }

  const edges = [
    [minX, minY, maxX, minY],
    [maxX, minY, maxX, maxY],
    [maxX, maxY, minX, maxY],
    [minX, maxY, minX, minY],
  ] as const;

  for (const [x3, y3, x4, y4] of edges) {
    const hit = segmentIntersection(x1, y1, x2, y2, x3, y3, x4, y4);
    if (hit) {
      points.push(hit);
    }
  }

  if (points.length < 2) {
    return null;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const sorted = [...points].sort((left, right) => {
    const leftT =
      Math.abs(dx) >= Math.abs(dy) ? (left.x - x1) / (dx || 1) : (left.y - y1) / (dy || 1);
    const rightT =
      Math.abs(dx) >= Math.abs(dy) ? (right.x - x1) / (dx || 1) : (right.y - y1) / (dy || 1);
    return leftT - rightT;
  });

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;

  return {
    x1Mm: first.x,
    y1Mm: first.y,
    x2Mm: last.x,
    y2Mm: last.y,
  };
}

export function clipOffcutHatchLines(rect: MmRect) {
  return buildOffcutHatchLines(rect)
    .map((line) =>
      clipSegmentToRect(line.x1Mm, line.y1Mm, line.x2Mm, line.y2Mm, rect),
    )
    .filter((line): line is NonNullable<typeof line> => line !== null);
}
