import type {
  EngineInput,
  EngineOffcut,
  EngineOperation,
  EngineSheetResult,
  PackedSheet,
  PlacedPart,
  UsableArea,
} from "./types";

function buildTrimOperations(
  input: EngineInput,
  usable: UsableArea,
  startSequence: number,
): EngineOperation[] {
  const ops: EngineOperation[] = [];
  let seq = startSequence;
  const { sheet } = input;

  if (sheet.trimBottomMm > 0) {
    ops.push({
      sequenceNumber: seq++,
      operationType: "trim_cut",
      axis: "horizontal",
      positionMm: usable.y,
      note: "Подрезка нижнего края",
      riskLevel: "normal",
    });
  }

  if (sheet.trimTopMm > 0) {
    ops.push({
      sequenceNumber: seq++,
      operationType: "trim_cut",
      axis: "horizontal",
      positionMm: sheet.heightMm - sheet.trimTopMm,
      note: "Подрезка верхнего края",
      riskLevel: "normal",
    });
  }

  if (sheet.trimLeftMm > 0) {
    ops.push({
      sequenceNumber: seq++,
      operationType: "trim_cut",
      axis: "vertical",
      positionMm: usable.x,
      note: "Подрезка левого края",
      riskLevel: "normal",
    });
  }

  if (sheet.trimRightMm > 0) {
    ops.push({
      sequenceNumber: seq++,
      operationType: "trim_cut",
      axis: "vertical",
      positionMm: sheet.widthMm - sheet.trimRightMm,
      note: "Подрезка правого края",
      riskLevel: "normal",
    });
  }

  return ops;
}

function getWorkingStripHeight(packed: PackedSheet, usable: UsableArea): number {
  if (packed.strips.length === 0) {
    return usable.y;
  }

  return packed.strips.reduce((maxHeight, strip) => {
    const stripTop = strip.parts.reduce(
      (top, part) => Math.max(top, part.yMm + part.heightMm),
      usable.y,
    );
    return Math.max(maxHeight, stripTop);
  }, usable.y);
}

function getWorkingStripDepth(packed: PackedSheet): number {
  return packed.strips.reduce((maxDepth, strip) => Math.max(maxDepth, strip.widthMm), 0);
}

/** Гильотинная последовательность за одну установку: сначала поперёк всего листа, затем в нижней полосе. */
function buildGuillotineCuts(
  packed: PackedSheet,
  input: EngineInput,
  usable: UsableArea,
  startSequence: number,
): EngineOperation[] {
  const ops: EngineOperation[] = [];
  let seq = startSequence;
  const kerf = input.machine.kerfMm;
  const workingHeight = getWorkingStripHeight(packed, usable);
  const workingDepth = getWorkingStripDepth(packed);

  // 1. Продольный рез по всей длине — отделяет нижнюю полосу (на схеме оператора это горизонтальная линия).
  if (workingDepth < usable.width) {
    const x = usable.x + workingDepth + kerf / 2;
    ops.push({
      sequenceNumber: seq++,
      operationType: "full_cut",
      axis: "vertical",
      x1Mm: x,
      y1Mm: usable.y,
      x2Mm: x,
      y2Mm: usable.y + usable.height,
      note: "Отделение нижней полосы от верхнего обрезка",
      riskLevel: "normal",
    });
  }

  // 2. Поперечные резы внутри нижней полосы (между деталями и вдоль подачи).
  for (const strip of packed.strips) {
    for (let i = 0; i < strip.parts.length - 1; i += 1) {
      const part = strip.parts[i];
      const cutY = part.yMm + part.heightMm + kerf / 2;
      ops.push({
        sequenceNumber: seq++,
        operationType: "full_cut",
        axis: "horizontal",
        x1Mm: strip.xMm,
        y1Mm: cutY,
        x2Mm: strip.xMm + strip.widthMm,
        y2Mm: cutY,
        targetPartId: part.partId,
        note: `Отделение детали ${part.label}`,
        riskLevel: "normal",
      });
    }

    if (workingHeight < usable.y + usable.height) {
      ops.push({
        sequenceNumber: seq++,
        operationType: "full_cut",
        axis: "horizontal",
        x1Mm: strip.xMm,
        y1Mm: workingHeight,
        x2Mm: strip.xMm + strip.widthMm,
        y2Mm: workingHeight,
        note: "Отделение обрезка вдоль подачи",
        riskLevel: "normal",
      });
    }
  }

  // 3. Продольные резы между полосами — только в нижней зоне.
  for (let i = 1; i < packed.strips.length; i += 1) {
    const x = packed.strips[i].xMm - kerf / 2;
    ops.push({
      sequenceNumber: seq++,
      operationType: "full_cut",
      axis: "vertical",
      x1Mm: x,
      y1Mm: usable.y,
      x2Mm: x,
      y2Mm: workingHeight,
      note: `Разделение полосы ${i}`,
      riskLevel: "normal",
    });
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
  const trimOps = buildTrimOperations(input, usable, 1);
  const nextSeq = trimOps.length + 1;
  const cutOps = buildGuillotineCuts(packed, input, usable, nextSeq);
  const labelOps = buildLabelOperations(
    packed.placements,
    nextSeq + cutOps.length,
  );

  return [...trimOps, ...cutOps, ...labelOps];
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

  // Simple free-rectangle scan along vertical strips gaps
  for (const strip of packed.strips) {
    const maxPartHeight = strip.parts.reduce(
      (max, part) => Math.max(max, part.yMm + part.heightMm),
      usable.y,
    );
    const freeHeight = usable.y + usable.height - maxPartHeight;
    if (freeHeight > 0) {
      const widthMm = strip.widthMm;
      const heightMm = freeHeight;
      const areaMm2 = widthMm * heightMm;
      offcuts.push({
        xMm: strip.xMm,
        yMm: maxPartHeight,
        widthMm,
        heightMm,
        areaMm2,
        isUseful: widthMm >= minW && heightMm >= minH,
      });
    }
  }

  // Right-side remainder of sheet
  const usedWidth = packed.strips.reduce((max, strip) => {
    return Math.max(max, strip.xMm + strip.widthMm);
  }, usable.x);

  const rightWidth = usable.x + usable.width - usedWidth;
  if (rightWidth > 0) {
    const areaMm2 = rightWidth * usable.height;
    offcuts.push({
      xMm: usedWidth,
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
      partName: part.partName,
      partCode: part.partCode,
      xMm: part.xMm,
      yMm: part.yMm,
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      rotationDeg: part.rotationDeg,
      label: part.label,
    })),
    operations,
    offcuts,
    warnings: [],
  };
}
