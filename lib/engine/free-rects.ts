import type { UsableArea } from "./types";

export type FreeRect = { x: number; y: number; w: number; h: number };

function rectanglesOverlap(
  a: FreeRect,
  b: FreeRect,
): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

/** Разность двух прямоугольников → до 4 свободных кусков. */
export function rectDifference(free: FreeRect, occupied: FreeRect): FreeRect[] {
  if (!rectanglesOverlap(free, occupied)) return [free];

  const eps = 0.01;
  const ix1 = Math.max(free.x, occupied.x);
  const iy1 = Math.max(free.y, occupied.y);
  const ix2 = Math.min(free.x + free.w, occupied.x + occupied.w);
  const iy2 = Math.min(free.y + free.h, occupied.y + occupied.h);

  const pieces: FreeRect[] = [];
  if (iy1 > free.y + eps) {
    pieces.push({ x: free.x, y: free.y, w: free.w, h: iy1 - free.y });
  }
  if (iy2 < free.y + free.h - eps) {
    pieces.push({
      x: free.x,
      y: iy2,
      w: free.w,
      h: free.y + free.h - iy2,
    });
  }
  if (ix1 > free.x + eps) {
    pieces.push({ x: free.x, y: iy1, w: ix1 - free.x, h: iy2 - iy1 });
  }
  if (ix2 < free.x + free.w - eps) {
    pieces.push({
      x: ix2,
      y: iy1,
      w: free.x + free.w - ix2,
      h: iy2 - iy1,
    });
  }

  return pieces.filter((piece) => piece.w > eps && piece.h > eps);
}

type PlacedLike = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
};

/**
 * Свободные прямоугольники на листе.
 * Занятие расширяем на kerf вправо/вверх — как между деталями в раскрое.
 */
export function computeFreeRects(
  placements: PlacedLike[],
  usable: UsableArea,
  kerfMm: number,
): FreeRect[] {
  const usableRight = usable.x + usable.width;
  const usableTop = usable.y + usable.height;

  let free: FreeRect[] = [
    { x: usable.x, y: usable.y, w: usable.width, h: usable.height },
  ];

  for (const part of placements) {
    const occupied: FreeRect = {
      x: part.xMm,
      y: part.yMm,
      w: Math.min(part.widthMm + kerfMm, usableRight - part.xMm),
      h: Math.min(part.heightMm + kerfMm, usableTop - part.yMm),
    };
    free = free.flatMap((rect) => rectDifference(rect, occupied));
  }

  return free;
}
