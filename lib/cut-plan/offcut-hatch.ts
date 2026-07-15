import type { MmRect } from "@/lib/cut-plan/operator-view";

export const OFFCUT_HATCH_STEP_MM = 12;

/**
 * Диагонали: x+y=const (y вниз). Offset 0…width+height — иначе
 * правый нижний угол прямоугольника без штрихов (треугольная дыра).
 */
export function buildOffcutHatchLines(rect: MmRect) {
  const lines: Array<{ x1Mm: number; y1Mm: number; x2Mm: number; y2Mm: number }> = [];
  const maxOffset = rect.widthMm + rect.heightMm;

  for (let offset = 0; offset <= maxOffset; offset += OFFCUT_HATCH_STEP_MM) {
    lines.push({
      x1Mm: rect.xMm + offset,
      y1Mm: rect.yMm,
      x2Mm: rect.xMm + offset - rect.heightMm,
      y2Mm: rect.yMm + rect.heightMm,
    });
  }

  return lines;
}

/** Liang–Barsky: clip отрезка к axis-aligned rect. */
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

  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;

  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) {
      return q >= 0;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };

  if (
    !clip(-dx, x1 - minX) ||
    !clip(dx, maxX - x1) ||
    !clip(-dy, y1 - minY) ||
    !clip(dy, maxY - y1)
  ) {
    return null;
  }

  if (t1 < t0) return null;

  const cx1 = x1 + t0 * dx;
  const cy1 = y1 + t0 * dy;
  const cx2 = x1 + t1 * dx;
  const cy2 = y1 + t1 * dy;

  if (Math.hypot(cx2 - cx1, cy2 - cy1) < 1e-6) {
    return null;
  }

  return {
    x1Mm: cx1,
    y1Mm: cy1,
    x2Mm: cx2,
    y2Mm: cy2,
  };
}

export function clipOffcutHatchLines(rect: MmRect) {
  return buildOffcutHatchLines(rect)
    .map((line) =>
      clipSegmentToRect(line.x1Mm, line.y1Mm, line.x2Mm, line.y2Mm, rect),
    )
    .filter((line): line is NonNullable<typeof line> => line !== null);
}
