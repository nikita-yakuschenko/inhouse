import type {
  EngineInput,
  EngineOffcut,
  EngineOperation,
  EngineSheetResult,
  PackedSheet,
  PlacedPart,
  UsableArea,
} from "./types";

function getStripTop(strip: { parts: { yMm: number; heightMm: number }[] }, usable: UsableArea): number {
  if (strip.parts.length === 0) return usable.y;
  return strip.parts.reduce(
    (top, part) => Math.max(top, part.yMm + part.heightMm),
    usable.y,
  );
}

/** Восстанавливаем вертикальные полосы из размещений — независим от оси packing. */
function rebuildVerticalStrips(placements: PlacedPart[]): PackedSheet["strips"] {
  const byX = new Map<number, PlacedPart[]>();
  for (const part of placements) {
    const list = byX.get(part.xMm) ?? [];
    list.push(part);
    byX.set(part.xMm, list);
  }

  return [...byX.entries()]
    .sort(([a], [b]) => a - b)
    .map(([xMm, parts]) => {
      const ordered = [...parts].sort((a, b) => a.yMm - b.yMm);
      const widthMm = ordered.reduce((max, part) => Math.max(max, part.widthMm), 0);
      const last = ordered[ordered.length - 1];
      const heightUsedMm = last ? last.yMm + last.heightMm - (ordered[0]?.yMm ?? 0) : 0;
      return {
        xMm,
        widthMm,
        heightUsedMm,
        parts: ordered,
      };
    });
}

/** Ширина занятой рабочей зоны (сумма полос), а не max(width полосы). */
function getUsedWidth(strips: PackedSheet["strips"], usable: UsableArea): number {
  if (strips.length === 0) return 0;
  return strips.reduce(
    (max, strip) => Math.max(max, strip.xMm + strip.widthMm - usable.x),
    0,
  );
}

/** Точки y, где рез по X пересекает готовую деталь (внутрь её габарита). */
function blockedYByPlacements(
  cutX: number,
  placements: PlacedPart[],
): Array<{ y1: number; y2: number }> {
  return placements
    .filter((part) => part.xMm < cutX && part.xMm + part.widthMm > cutX)
    .map((part) => ({ y1: part.yMm, y2: part.yMm + part.heightMm }));
}

/** Свободные отрезки [yStart, yEnd] за вычетом занятых деталями. */
function freeYIntervals(
  yStart: number,
  yEnd: number,
  blocked: Array<{ y1: number; y2: number }>,
): Array<{ y1: number; y2: number }> {
  if (yEnd - yStart <= 0.5) return [];

  const sorted = [...blocked]
    .map((b) => ({
      y1: Math.max(yStart, b.y1),
      y2: Math.min(yEnd, b.y2),
    }))
    .filter((b) => b.y2 > b.y1)
    .sort((a, b) => a.y1 - b.y1);

  const free: Array<{ y1: number; y2: number }> = [];
  let cursor = yStart;

  for (const block of sorted) {
    if (block.y1 > cursor + 0.5) {
      free.push({ y1: cursor, y2: Math.min(block.y1, yEnd) });
    }
    cursor = Math.max(cursor, block.y2);
    if (cursor >= yEnd) break;
  }

  if (yEnd - cursor > 0.5) {
    free.push({ y1: cursor, y2: yEnd });
  }

  return free;
}

function mergeYIntervals(
  intervals: Array<{ y1: number; y2: number }>,
): Array<{ y1: number; y2: number }> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.y1 - b.y1);
  const merged: Array<{ y1: number; y2: number }> = [
    { y1: sorted[0].y1, y2: sorted[0].y2 },
  ];

  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1];
    const next = sorted[i];
    if (next.y1 <= last.y2 + 0.5) {
      last.y2 = Math.max(last.y2, next.y2);
    } else {
      merged.push({ y1: next.y1, y2: next.y2 });
    }
  }

  return merged;
}

function intersectYIntervals(
  left: Array<{ y1: number; y2: number }>,
  right: Array<{ y1: number; y2: number }>,
): Array<{ y1: number; y2: number }> {
  const out: Array<{ y1: number; y2: number }> = [];
  for (const a of left) {
    for (const b of right) {
      const y1 = Math.max(a.y1, b.y1);
      const y2 = Math.min(a.y2, b.y2);
      if (y2 - y1 > 0.5) out.push({ y1, y2 });
    }
  }
  return mergeYIntervals(out);
}

/** Y-диапазоны, где рез реально разделяет детали слева и справа — без пустот. */
function neededYForVerticalCut(
  cutX: number,
  placements: PlacedPart[],
): Array<{ y1: number; y2: number }> {
  const left = mergeYIntervals(
    placements
      .filter((part) => part.xMm + part.widthMm <= cutX + 0.01)
      .map((part) => ({ y1: part.yMm, y2: part.yMm + part.heightMm })),
  );
  const right = mergeYIntervals(
    placements
      .filter((part) => part.xMm >= cutX - 0.01)
      .map((part) => ({ y1: part.yMm, y2: part.yMm + part.heightMm })),
  );
  return intersectYIntervals(left, right);
}

/** Гильотинная последовательность: отделение остатка, поперечные резы, продольные между полосами. */
function buildGuillotineCuts(
  placements: PlacedPart[],
  input: EngineInput,
  usable: UsableArea,
  startSequence: number,
): EngineOperation[] {
  const ops: EngineOperation[] = [];
  let seq = startSequence;
  const kerf = input.machine.kerfMm;
  const strips = rebuildVerticalStrips(placements);
  const usedWidth = getUsedWidth(strips, usable);
  const usableTop = usable.y + usable.height;

  // 1. Продольный рез — отделяет правый обрезок по всей высоте листа.
  if (usedWidth > 0 && usedWidth + kerf < usable.width) {
    const x = usable.x + usedWidth + kerf / 2;
    ops.push({
      sequenceNumber: seq++,
      operationType: "full_cut",
      axis: "vertical",
      x1Mm: x,
      y1Mm: usable.y,
      x2Mm: x,
      y2Mm: usableTop,
      note: "Отделение бокового обрезка",
      riskLevel: "normal",
    });
  }

  // 2. Поперечные резы между деталями внутри полосы — только по ширине нижней детали.
  for (const strip of strips) {
    for (let i = 0; i < strip.parts.length - 1; i += 1) {
      const part = strip.parts[i];
      const cutY = part.yMm + part.heightMm + kerf / 2;
      ops.push({
        sequenceNumber: seq++,
        operationType: "full_cut",
        axis: "horizontal",
        x1Mm: part.xMm,
        y1Mm: cutY,
        x2Mm: part.xMm + part.widthMm,
        y2Mm: cutY,
        targetPartId: part.partId,
        note: `Отделение детали ${part.label}`,
        riskLevel: "normal",
      });
    }
  }

  // 3. Поперечные резы обрезка сверху — по фактической ширине верхних деталей полосы.
  const topByY = new Map<number, { x1: number; x2: number }>();
  for (const strip of strips) {
    const top = getStripTop(strip, usable);
    if (top + kerf >= usableTop) continue;

    const reaching = strip.parts.filter(
      (part) => Math.abs(part.yMm + part.heightMm - top) < 0.01,
    );
    if (reaching.length === 0) continue;

    const x1 = Math.min(...reaching.map((part) => part.xMm));
    const x2 = Math.max(...reaching.map((part) => part.xMm + part.widthMm));
    const span = topByY.get(top) ?? { x1, x2 };
    span.x1 = Math.min(span.x1, x1);
    span.x2 = Math.max(span.x2, x2);
    topByY.set(top, span);
  }

  const tops = [...topByY.entries()].sort(([a], [b]) => a - b);
  for (const [top, span] of tops) {
    const cutY = top + kerf / 2;
    ops.push({
      sequenceNumber: seq++,
      operationType: "full_cut",
      axis: "horizontal",
      x1Mm: span.x1,
      y1Mm: cutY,
      x2Mm: span.x2,
      y2Mm: cutY,
      note: "Отделение обрезка вдоль подачи",
      riskLevel: "normal",
    });
  }

  // 4. Продольные резы между полосами — только где слева и справа есть детали.
  for (let i = 1; i < strips.length; i += 1) {
    const left = strips[i - 1];
    const right = strips[i];
    const gapStart = left.xMm + left.widthMm;
    const gapEnd = right.xMm;
    // Если «ширина полосы» раздута широкой деталью снизу, режем по левому краю правой полосы.
    const x =
      gapEnd > gapStart
        ? (gapStart + gapEnd) / 2
        : right.xMm - kerf / 2;

    if (x <= usable.x || x >= usable.x + usable.width) continue;

    const needed = neededYForVerticalCut(x, placements);
    const blocked = blockedYByPlacements(x, placements);

    for (const span of needed) {
      for (const segment of freeYIntervals(span.y1, span.y2, blocked)) {
        ops.push({
          sequenceNumber: seq++,
          operationType: "full_cut",
          axis: "vertical",
          x1Mm: x,
          y1Mm: segment.y1,
          x2Mm: x,
          y2Mm: segment.y2,
          note: `Разделение полосы ${i}`,
          riskLevel: "normal",
        });
      }
    }
  }

  return ops;
}

function buildLabelOperations(
  placements: PlacedPart[],
  startSequence: number,
): EngineOperation[] {
  return placements.map((placement, index) => ({
    sequenceNumber: startSequence + index,
    operationType: "label_part" as const,
    axis: "none" as const,
    targetPartId: placement.partId,
    note: `Маркировка детали ${placement.label}`,
    riskLevel: "normal" as const,
  }));
}

export function buildSheetOperations(
  packed: PackedSheet,
  input: EngineInput,
  usable: UsableArea,
): EngineOperation[] {
  const cutOps = buildGuillotineCuts(packed.placements, input, usable, 1);
  const labelOps = buildLabelOperations(packed.placements, cutOps.length + 1);
  return [...cutOps, ...labelOps];
}

function rectanglesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

export function buildOffcuts(
  packed: PackedSheet,
  input: EngineInput,
  usable: UsableArea,
): EngineOffcut[] {
  const offcuts: EngineOffcut[] = [];
  const minW = input.settings.minUsefulOffcutWidthMm;
  const minH = input.settings.minUsefulOffcutHeightMm;
  const kerf = input.machine.kerfMm;
  const strips = rebuildVerticalStrips(packed.placements);
  const usableRight = usable.x + usable.width;
  const usableTop = usable.y + usable.height;

  for (const strip of strips) {
    const maxPartHeight = getStripTop(strip, usable);
    // Пропил отделяет обрезок от детали — kerf уходит в опилки, не в обрезок.
    const offcutY = maxPartHeight + kerf;
    const heightMm = usableTop - offcutY;
    if (heightMm > 0) {
      const widthMm = strip.widthMm;
      const areaMm2 = widthMm * heightMm;
      offcuts.push({
        xMm: strip.xMm,
        yMm: offcutY,
        widthMm,
        heightMm,
        areaMm2,
        isUseful: widthMm >= minW && heightMm >= minH,
      });
    }
  }

  const usedRight = strips.reduce((max, strip) => {
    return Math.max(max, strip.xMm + strip.widthMm);
  }, usable.x);

  const offcutX = usedRight + kerf;
  const rightWidth = usableRight - offcutX;
  if (rightWidth > 0) {
    const areaMm2 = rightWidth * usable.height;
    offcuts.push({
      xMm: offcutX,
      yMm: usable.y,
      widthMm: rightWidth,
      heightMm: usable.height,
      areaMm2,
      isUseful: rightWidth >= minW && usable.height >= minH,
    });
  }

  return offcuts.filter((offcut, index, list) => {
    return !list.slice(0, index).some((other) =>
      rectanglesOverlap(
        { x: offcut.xMm, y: offcut.yMm, w: offcut.widthMm, h: offcut.heightMm },
        { x: other.xMm, y: other.yMm, w: other.widthMm, h: other.heightMm },
      ),
    );
  });
}

export function toSheetResult(
  packed: PackedSheet,
  input: EngineInput,
  usable: UsableArea,
): EngineSheetResult {
  const operations = buildSheetOperations(packed, input, usable);
  const offcuts = buildOffcuts(packed, input, usable);

  return {
    sheetIndex: packed.sheetIndex,
    widthMm: input.sheet.widthMm,
    heightMm: input.sheet.heightMm,
    usableXmm: usable.x,
    usableYmm: usable.y,
    usableWidthMm: usable.width,
    usableHeightMm: usable.height,
    placements: packed.placements.map((part) => ({
      partId: part.partId,
      partInstanceIndex: part.instanceIndex,
      xMm: part.xMm,
      yMm: part.yMm,
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      rotationDeg: part.rotationDeg,
      label: part.label,
    })),
    operations,
    offcuts,
  };
}
