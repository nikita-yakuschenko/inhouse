import type { BarLayout } from "@/lib/engine-bar/cutting";

export type DimensionLeaderPoint = {
  /** Позиция линии на карте (мм от начала заготовки). */
  anchorMm: number;
  /** Накопительная координата для подписи (мм). */
  valueMm: number;
};

/**
 * Выноски между деталями: накопленная длина до начала каждой следующей детали
 * (конец предыдущей + полный пропил). Первая деталь с нуля — без метки.
 */
export function nextPieceStartLeaders(
  bar: BarLayout,
  kerfMm: number,
): DimensionLeaderPoint[] {
  const out: DimensionLeaderPoint[] = [];
  let x = 0;
  for (let i = 0; i < bar.pieces.length; i++) {
    x += bar.pieces[i].lengthMm;
    if (i < bar.pieces.length - 1) {
      x += kerfMm;
      out.push({ anchorMm: x, valueMm: x });
    }
  }
  return out;
}

/** Убираем выноски, если линии слишком близко по ширине бара. */
export function filterLeadersByGap(
  items: DimensionLeaderPoint[],
  stockLengthMm: number,
  minGapFrac: number,
): DimensionLeaderPoint[] {
  if (stockLengthMm <= 0 || items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.anchorMm - b.anchorMm);
  const out: DimensionLeaderPoint[] = [];
  let lastFrac = -Infinity;
  for (const it of sorted) {
    const f = it.anchorMm / stockLengthMm;
    if (out.length === 0 || f - lastFrac >= minGapFrac) {
      out.push(it);
      lastFrac = f;
    }
  }
  const lastVal = sorted[sorted.length - 1];
  if (lastVal != null && out[out.length - 1]?.anchorMm !== lastVal.anchorMm) {
    out.push(lastVal);
  }
  return out;
}

/** Близкие выноски — на разной высоте, чтобы не перекрывали текст. */
export function staggerLeaders(
  items: DimensionLeaderPoint[],
  stockLengthMm: number,
): (DimensionLeaderPoint & { lane: 0 | 1 })[] {
  if (items.length === 0 || stockLengthMm <= 0) return [];
  const sorted = [...items].sort((a, b) => a.anchorMm - b.anchorMm);
  const proximityMm = Math.max(150, stockLengthMm * 0.035);
  const out: (DimensionLeaderPoint & { lane: 0 | 1 })[] = [];
  let prevLane: 0 | 1 = 0;
  for (let i = 0; i < sorted.length; i++) {
    const it = sorted[i]!;
    let lane: 0 | 1 = 0;
    if (i > 0) {
      const gapMm = it.anchorMm - sorted[i - 1]!.anchorMm;
      if (gapMm < proximityMm) {
        lane = prevLane === 0 ? 1 : 0;
      }
    }
    prevLane = lane;
    out.push({ ...it, lane });
  }
  return out;
}
