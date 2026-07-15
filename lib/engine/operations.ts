import type {
  EngineInput,
  EngineOffcut,
  EngineOperation,
  EngineSheetResult,
  PackedSheet,
  PlacedPart,
  UsableArea,
} from "./types";
import { computeFreeRects } from "./free-rects";

/** Правый край занятой зоны по фактическим placement. */
function getUsedWidth(placements: PlacedPart[], usable: UsableArea): number {
  if (placements.length === 0) return 0;
  return placements.reduce(
    (max, part) => Math.max(max, part.xMm + part.widthMm - usable.x),
    0,
  );
}

type Interval = { a: number; b: number };

/** Участки деталей, которые пересекает линия реза (внутрь габарита). */
function blockedOnAxis(
  cutPos: number,
  placements: PlacedPart[],
  axis: "vertical" | "horizontal",
): Interval[] {
  return placements
    .filter((part) => {
      if (axis === "vertical") {
        return part.xMm < cutPos && part.xMm + part.widthMm > cutPos;
      }
      return part.yMm < cutPos && part.yMm + part.heightMm > cutPos;
    })
    .map((part) =>
      axis === "vertical"
        ? { a: part.yMm, b: part.yMm + part.heightMm }
        : { a: part.xMm, b: part.xMm + part.widthMm },
    );
}

/**
 * Сквозной рез заготовки: от края до края usable, минус только то, где линия
 * вошла бы внутрь детали. Короткие (stop) резы — отдельно, для Г/Т.
 */
function throughCutSegments(
  from: number,
  to: number,
  blocked: Interval[],
): Interval[] {
  if (to - from <= 0.5) return [];

  const sorted = [...blocked]
    .map((item) => ({
      a: Math.max(from, item.a),
      b: Math.min(to, item.b),
    }))
    .filter((item) => item.b > item.a)
    .sort((left, right) => left.a - right.a);

  const free: Interval[] = [];
  let cursor = from;

  for (const block of sorted) {
    if (block.a > cursor + 0.5) {
      free.push({ a: cursor, b: Math.min(block.a, to) });
    }
    cursor = Math.max(cursor, block.b);
    if (cursor >= to) break;
  }

  if (to - cursor > 0.5) {
    free.push({ a: cursor, b: to });
  }

  return free;
}

function groupRowsByY(placements: PlacedPart[]): Array<{
  yMm: number;
  parts: PlacedPart[];
  topMm: number;
}> {
  const byY = new Map<number, PlacedPart[]>();
  for (const part of placements) {
    const key = Math.round(part.yMm * 100) / 100;
    const list = byY.get(key) ?? [];
    list.push(part);
    byY.set(key, list);
  }

  return [...byY.entries()]
    .sort(([a], [b]) => a - b)
    .map(([yMm, parts]) => {
      const ordered = [...parts].sort((a, b) => a.xMm - b.xMm);
      const topMm = ordered.reduce(
        (top, part) => Math.max(top, part.yMm + part.heightMm),
        yMm,
      );
      return { yMm, parts: ordered, topMm };
    });
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.a - b.a);
  const merged: Interval[] = [{ a: sorted[0]!.a, b: sorted[0]!.b }];
  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1]!;
    const next = sorted[i]!;
    if (next.a <= last.b + 0.5) {
      last.b = Math.max(last.b, next.b);
    } else {
      merged.push({ a: next.a, b: next.b });
    }
  }
  return merged;
}

/** Гильотина прямоугольников: режем заготовку, но не дробим пустые обрезки лишними проходами. */
function buildGuillotineCuts(
  placements: PlacedPart[],
  input: EngineInput,
  usable: UsableArea,
  startSequence: number,
): EngineOperation[] {
  const ops: EngineOperation[] = [];
  let seq = startSequence;
  const kerf = input.machine.kerfMm;
  const usedWidth = getUsedWidth(placements, usable);
  const usableRight = usable.x + usable.width;
  const usableTop = usable.y + usable.height;
  const rows = groupRowsByY(placements);
  const panelRight = usable.x + usedWidth;

  /** Вертикальный рез только в заданном поясе (не уводим в пустой обрезок выше/ниже). */
  const pushVerticalBand = (
    x: number,
    y1: number,
    y2: number,
    note: string,
  ) => {
    for (const seg of throughCutSegments(
      y1,
      y2,
      blockedOnAxis(x, placements, "vertical"),
    )) {
      ops.push({
        sequenceNumber: seq++,
        operationType: "full_cut",
        axis: "vertical",
        x1Mm: x,
        y1Mm: seg.a,
        x2Mm: x,
        y2Mm: seg.b,
        note,
        riskLevel: "normal",
      });
    }
  };

  // 1. Боковой обрезок — только напротив деталей у правого края (не в пустоту сверху).
  if (usedWidth > 0 && usedWidth + kerf < usable.width) {
    const cutX = usable.x + usedWidth + kerf / 2;
    const abuttingBands = mergeIntervals(
      placements
        .filter((part) => Math.abs(part.xMm + part.widthMm - panelRight) < 0.5)
        .map((part) => ({ a: part.yMm, b: part.yMm + part.heightMm })),
    );
    for (const band of abuttingBands) {
      pushVerticalBand(cutX, band.a, band.b, "Отделение бокового обрезка");
    }
  }

  // 2. Поперечные резы — у верха каждой детали по её ширине.
  // Нельзя брать max высоты «ряда»: сосед выше после более низкой детали
  // окажется ниже этого max → рез пройдёт сквозь него.
  const flushHorizontalRun = (
    cutY: number,
    runStart: number,
    runEnd: number,
    note: string,
    targetPartId?: string,
  ) => {
    for (const seg of throughCutSegments(
      runStart,
      runEnd,
      blockedOnAxis(cutY, placements, "horizontal"),
    )) {
      ops.push({
        sequenceNumber: seq++,
        operationType: "full_cut",
        axis: "horizontal",
        x1Mm: seg.a,
        y1Mm: cutY,
        x2Mm: seg.b,
        y2Mm: cutY,
        targetPartId,
        note,
        riskLevel: "normal",
      });
    }
  };

  const topsByY = new Map<number, PlacedPart[]>();
  for (const part of placements) {
    const top = part.yMm + part.heightMm;
    if (top + kerf >= usableTop) continue;
    const cutY = Math.round((top + kerf / 2) * 100) / 100;
    const list = topsByY.get(cutY) ?? [];
    list.push(part);
    topsByY.set(cutY, list);
  }

  for (const [cutY, partsAtTop] of [...topsByY.entries()].sort(
    ([a], [b]) => a - b,
  )) {
    const ordered = [...partsAtTop].sort((a, b) => a.xMm - b.xMm);
    let runStart = ordered[0]!.xMm;
    let runEnd = ordered[0]!.xMm + ordered[0]!.widthMm;
    let runTarget = ordered[0]!.partId;

    for (let i = 1; i < ordered.length; i += 1) {
      const part = ordered[i]!;
      if (part.xMm <= runEnd + kerf + 0.5) {
        runEnd = Math.max(runEnd, part.xMm + part.widthMm);
      } else {
        flushHorizontalRun(
          cutY,
          runStart,
          runEnd,
          "Отделение по верху детали",
          runTarget,
        );
        runStart = part.xMm;
        runEnd = part.xMm + part.widthMm;
        runTarget = part.partId;
      }
    }
    flushHorizontalRun(
      cutY,
      runStart,
      runEnd,
      "Отделение по верху детали",
      runTarget,
    );
  }

  // 3. Продольные резы в ряду — только в поясе ряда, не в верхний обрезок.
  for (const row of rows) {
    for (let i = 1; i < row.parts.length; i += 1) {
      const left = row.parts[i - 1];
      const right = row.parts[i];
      const gapStart = left.xMm + left.widthMm;
      const gapEnd = right.xMm;
      const x =
        gapEnd > gapStart + 0.5
          ? (gapStart + gapEnd) / 2
          : right.xMm - kerf / 2;

      if (x <= usable.x || x >= usableRight) continue;
      pushVerticalBand(x, row.yMm, row.topMm, `Разделение ряда y=${row.yMm}`);
    }

    const last = row.parts[row.parts.length - 1];
    if (!last) continue;
    const lastRight = last.xMm + last.widthMm;
    if (lastRight + kerf < panelRight - 0.5) {
      pushVerticalBand(
        lastRight + kerf / 2,
        row.yMm,
        row.topMm,
        `Отделение ряда y=${row.yMm} от бокового кармана`,
      );
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

export function buildOffcuts(
  packed: PackedSheet,
  input: EngineInput,
  usable: UsableArea,
): EngineOffcut[] {
  const minW = input.settings.minUsefulOffcutWidthMm;
  const minH = input.settings.minUsefulOffcutHeightMm;
  const kerf = input.machine.kerfMm;
  const eps = 0.01;
  const minVisible = Math.max(1, kerf * 0.75);

  return computeFreeRects(packed.placements, usable, kerf)
    .filter((rect) => rect.w > minVisible + eps && rect.h > minVisible + eps)
    .map((rect) => ({
      xMm: rect.x,
      yMm: rect.y,
      widthMm: rect.w,
      heightMm: rect.h,
      areaMm2: rect.w * rect.h,
      isUseful: rect.w >= minW && rect.h >= minH,
    }));
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
