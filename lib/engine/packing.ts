import { formatPartMarkingLabel } from "@/lib/parts/part-marking";
import { computeFreeRects } from "./free-rects";
import type {
  EngineMachine,
  PackedSheet,
  PartInstance,
  PlacedPart,
  Strip,
  UsableArea,
} from "./types";

export type AxisMode = "vertical" | "horizontal";

interface Orientation {
  widthMm: number;
  heightMm: number;
  rotationDeg: 0 | 90;
}

function getOrientations(part: PartInstance): Orientation[] {
  const base: Orientation = {
    widthMm: part.widthMm,
    heightMm: part.heightMm,
    rotationDeg: 0,
  };

  if (!part.allowRotation || part.widthMm === part.heightMm) {
    return [base];
  }

  return [
    base,
    {
      widthMm: part.heightMm,
      heightMm: part.widthMm,
      rotationDeg: 90,
    },
  ];
}

/** На альбомном листе выгоднее узкие вертикальные полосы — меньше резов и аккуратнее обрезки. */
function sortOrientationsForNewStrip(orientations: Orientation[]): Orientation[] {
  return [...orientations].sort((a, b) => {
    if (a.widthMm !== b.widthMm) return a.widthMm - b.widthMm;
    return b.heightMm - a.heightMm;
  });
}

function createPlacement(
  part: PartInstance,
  orientation: Orientation,
  xMm: number,
  yMm: number,
): PlacedPart {
  return {
    ...part,
    xMm,
    yMm,
    widthMm: orientation.widthMm,
    heightMm: orientation.heightMm,
    rotationDeg: orientation.rotationDeg,
    label: formatPartMarkingLabel(
      part.partCode?.trim() || part.partName,
      part.instanceIndex,
      part.instanceCount,
    ),
  };
}

function stripUsedWidth(strips: Strip[], kerfMm: number): number {
  if (strips.length === 0) return 0;
  // Ширина занятого + kerf перед следующей полосой
  return (
    strips.reduce((sum, strip) => sum + strip.widthMm, 0) + strips.length * kerfMm
  );
}

function overlapsWithKerf(
  a: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  b: { xMm: number; yMm: number; widthMm: number; heightMm: number },
  kerfMm: number,
): boolean {
  return !(
    a.xMm + a.widthMm + kerfMm <= b.xMm ||
    b.xMm + b.widthMm + kerfMm <= a.xMm ||
    a.yMm + a.heightMm + kerfMm <= b.yMm ||
    b.yMm + b.heightMm + kerfMm <= a.yMm
  );
}

/** Свободный слот внутри полосы (в т.ч. справа от более узких деталей над широкой). */
function findFreeSlotInStrip(
  strip: Strip,
  orientation: Orientation,
  usable: UsableArea,
  kerfMm: number,
): { xMm: number; yMm: number; waste: number } | null {
  const stripRight = strip.xMm + strip.widthMm;
  const usableTop = usable.y + usable.height;

  const xs = new Set<number>([strip.xMm]);
  const ys = new Set<number>([usable.y]);
  for (const part of strip.parts) {
    xs.add(part.xMm + part.widthMm + kerfMm);
    ys.add(part.yMm + part.heightMm + kerfMm);
  }

  let best: { xMm: number; yMm: number; waste: number } | null = null;

  for (const xMm of [...xs].sort((a, b) => a - b)) {
    for (const yMm of [...ys].sort((a, b) => a - b)) {
      if (xMm + orientation.widthMm > stripRight + 0.01) continue;
      if (yMm + orientation.heightMm > usableTop + 0.01) continue;

      const candidate = {
        xMm,
        yMm,
        widthMm: orientation.widthMm,
        heightMm: orientation.heightMm,
      };
      if (strip.parts.some((part) => overlapsWithKerf(candidate, part, kerfMm))) {
        continue;
      }

      // Ниже и левее — меньше обрезков; одновысотные в ряду — рядом.
      const waste =
        yMm * 1_000_000 +
        xMm * 1_000 +
        (stripRight - xMm - orientation.widthMm) +
        (usableTop - yMm - orientation.heightMm) +
        sameHeightRowPenalty(strip.parts, orientation, xMm, yMm, kerfMm);

      if (!best || waste < best.waste) {
        best = { xMm, yMm, waste };
      }
    }
  }

  return best;
}

/**
 * В одном ряду (одинаковый y) одновысотные детали — рядом.
 */
function sameHeightRowPenalty(
  parts: PlacedPart[],
  orientation: Orientation,
  xMm: number,
  yMm: number,
  kerfMm: number,
): number {
  const row = parts.filter((part) => Math.abs(part.yMm - yMm) < 0.5);
  if (row.length === 0) return 0;

  const sameHeight = row.filter(
    (part) => Math.abs(part.heightMm - orientation.heightMm) < 0.5,
  );

  for (const part of sameHeight) {
    const touchesLeft = Math.abs(part.xMm + part.widthMm + kerfMm - xMm) < 0.5;
    const touchesRight =
      Math.abs(xMm + orientation.widthMm + kerfMm - part.xMm) < 0.5;
    if (touchesLeft || touchesRight) return -50_000;
  }

  if (sameHeight.length === 0) return 0;

  const leftNeighbor = row
    .filter((part) => part.xMm + part.widthMm <= xMm + 0.5)
    .sort((a, b) => b.xMm - a.xMm)[0];
  if (
    leftNeighbor &&
    Math.abs(leftNeighbor.heightMm - orientation.heightMm) >= 0.5 &&
    sameHeight.some((part) => part.xMm > xMm)
  ) {
    return 40_000;
  }

  const dist = Math.min(...sameHeight.map((part) => Math.abs(part.xMm - xMm)));
  return dist;
}

/** В каждом ряду (одинаковый y) собрать детали одной высоты подряд. */
function regroupSameYByHeight(
  sheet: PackedSheet,
  usable: UsableArea,
  kerfMm: number,
): void {
  // Группируем по placements, не по strips: после compact полосы часто разваливаются.
  const byY = new Map<number, PlacedPart[]>();
  for (const part of sheet.placements) {
    const key = Math.round(part.yMm * 100) / 100;
    const list = byY.get(key) ?? [];
    list.push(part);
    byY.set(key, list);
  }

  for (const row of byY.values()) {
    if (row.length < 2) continue;

    const previous = row.map((part) => ({ part, xMm: part.xMm }));
    row.sort((a, b) => {
      if (a.heightMm !== b.heightMm) return b.heightMm - a.heightMm;
      if (a.widthMm !== b.widthMm) return b.widthMm - a.widthMm;
      return (a.partCode ?? "").localeCompare(b.partCode ?? "", "ru", {
        numeric: true,
      });
    });

    const startX = Math.min(...previous.map((item) => item.xMm));
    let x = startX;
    for (const part of row) {
      part.xMm = x;
      x += part.widthMm + kerfMm;
    }
    const newRight = x - kerfMm;

    // Откат только если ряд не влезает в лист или пересекается с другим рядом.
    // Не сравниваем с oldRight: исходный ряд мог быть без kerf между первыми деталями,
    // а после группировки kerf между всеми делает ряд на 1 резок шире — это нормально.
    const overflow = newRight > usable.x + usable.width + 0.01;
    const collision = row.some((part) =>
      sheet.placements.some(
        (other) =>
          other !== part &&
          Math.abs(other.yMm - part.yMm) >= 0.5 &&
          overlapsWithKerf(part, other, kerfMm),
      ),
    );
    if (overflow || collision) {
      for (const item of previous) {
        item.part.xMm = item.xMm;
      }
    }
  }

  // Пересобираем полосы из финальных координат.
  sheet.strips = rebuildStripsFromPlacements(sheet.placements);
  sheet.placements.sort((a, b) => {
    if (a.yMm !== b.yMm) return a.yMm - b.yMm;
    return a.xMm - b.xMm;
  });
}

/** Вертикальные полосы по x — для согласованности после перестановки в ряду. */
function rebuildStripsFromPlacements(placements: PlacedPart[]): Strip[] {
  if (placements.length === 0) return [];

  const minX = Math.min(...placements.map((part) => part.xMm));
  const maxRight = Math.max(...placements.map((part) => part.xMm + part.widthMm));
  const maxTop = Math.max(...placements.map((part) => part.yMm + part.heightMm));

  return [
    {
      xMm: minX,
      widthMm: maxRight - minX,
      heightUsedMm: maxTop,
      parts: [...placements],
    },
  ];
}

function placeInStripAt(
  strip: Strip,
  part: PartInstance,
  orientation: Orientation,
  xMm: number,
  yMm: number,
  usable: UsableArea,
): PlacedPart {
  const placement = createPlacement(part, orientation, xMm, yMm);
  strip.parts.push(placement);
  strip.heightUsedMm = Math.max(strip.heightUsedMm, yMm + orientation.heightMm - usable.y);
  strip.widthMm = Math.max(strip.widthMm, xMm + orientation.widthMm - strip.xMm);
  return placement;
}

function createVerticalStrip(
  sheet: PackedSheet,
  part: PartInstance,
  orientation: Orientation,
  usable: UsableArea,
  kerfMm: number,
): PlacedPart | null {
  const offset = stripUsedWidth(sheet.strips, kerfMm);
  if (offset + orientation.widthMm > usable.width) return null;
  if (orientation.heightMm > usable.height) return null;

  const strip: Strip = {
    xMm: usable.x + offset,
    widthMm: orientation.widthMm,
    heightUsedMm: 0,
    parts: [],
  };

  const placement = placeInStripAt(
    strip,
    part,
    orientation,
    strip.xMm,
    usable.y,
    usable,
  );
  sheet.strips.push(strip);
  return placement;
}

function placeAtPosition(
  sheet: PackedSheet,
  part: PartInstance,
  orientation: Orientation,
  xMm: number,
  yMm: number,
  usable: UsableArea,
): PlacedPart {
  let strip =
    sheet.strips.find(
      (item) =>
        item.xMm <= xMm + 0.01 &&
        item.xMm + item.widthMm >= xMm + orientation.widthMm - 0.01,
    ) ??
    sheet.strips.find((item) => Math.abs(item.xMm - xMm) < 0.5);

  if (!strip) {
    strip = {
      xMm,
      widthMm: orientation.widthMm,
      heightUsedMm: 0,
      parts: [],
    };
    sheet.strips.push(strip);
  }

  const placement = placeInStripAt(strip, part, orientation, xMm, yMm, usable);
  sheet.placements.push(placement);
  return placement;
}

/**
 * Укладка в свободный прямоугольник листа (деловые карманы справа/сверху),
 * если полосная модель место не нашла.
 */
function tryPlaceInFreeRect(
  sheet: PackedSheet,
  part: PartInstance,
  usable: UsableArea,
  kerfMm: number,
): PlacedPart | null {
  if (sheet.placements.length === 0) return null;

  const free = computeFreeRects(sheet.placements, usable, kerfMm).sort(
    (a, b) => a.y - b.y || a.x - b.x || b.w * b.h - a.w * a.h,
  );

  let best: {
    orientation: Orientation;
    xMm: number;
    yMm: number;
    waste: number;
  } | null = null;

  for (const orientation of getOrientations(part)) {
    for (const rect of free) {
      if (orientation.widthMm > rect.w + 0.01) continue;
      if (orientation.heightMm > rect.h + 0.01) continue;

      const candidate = {
        xMm: rect.x,
        yMm: rect.y,
        widthMm: orientation.widthMm,
        heightMm: orientation.heightMm,
      };
      if (
        sheet.placements.some((other) =>
          overlapsWithKerf(candidate, other, kerfMm),
        )
      ) {
        continue;
      }

      const waste =
        rect.y * 1_000_000 +
        rect.x * 1_000 +
        (rect.w - orientation.widthMm) +
        (rect.h - orientation.heightMm);

      if (!best || waste < best.waste) {
        best = {
          orientation,
          xMm: rect.x,
          yMm: rect.y,
          waste,
        };
      }
    }
  }

  if (!best) return null;
  return placeAtPosition(
    sheet,
    part,
    best.orientation,
    best.xMm,
    best.yMm,
    usable,
  );
}

function tryPlaceVertical(
  sheet: PackedSheet,
  part: PartInstance,
  usable: UsableArea,
  kerfMm: number,
): PlacedPart | null {
  let best: {
    strip: Strip;
    orientation: Orientation;
    xMm: number;
    yMm: number;
    waste: number;
  } | null = null;

  for (const orientation of getOrientations(part)) {
    for (const strip of sheet.strips) {
      if (orientation.widthMm > strip.widthMm + 0.01) continue;
      const slot = findFreeSlotInStrip(strip, orientation, usable, kerfMm);
      if (!slot) continue;

      if (!best || slot.waste < best.waste) {
        best = {
          strip,
          orientation,
          xMm: slot.xMm,
          yMm: slot.yMm,
          waste: slot.waste,
        };
      }
    }
  }

  if (best) {
    const placement = placeInStripAt(
      best.strip,
      part,
      best.orientation,
      best.xMm,
      best.yMm,
      usable,
    );
    sheet.placements.push(placement);
    return placement;
  }

  const pocket = tryPlaceInFreeRect(sheet, part, usable, kerfMm);
  if (pocket) return pocket;

  for (const orientation of sortOrientationsForNewStrip(getOrientations(part))) {
    const placement = createVerticalStrip(sheet, part, orientation, usable, kerfMm);
    if (placement) {
      sheet.placements.push(placement);
      return placement;
    }
  }

  return null;
}

function tryPlaceHorizontal(
  sheet: PackedSheet,
  part: PartInstance,
  usable: UsableArea,
  kerfMm: number,
): PlacedPart | null {
  let rowY = usable.y;
  let rowHeight = 0;
  let rowX = usable.x;

  for (const strip of sheet.strips) {
    rowY = strip.xMm;
    rowHeight = strip.widthMm;
    rowX = usable.x + strip.heightUsedMm;
  }

  const orientations = sortOrientationsForNewStrip(getOrientations(part));

  for (const orientation of orientations) {
    const fitsInRow =
      rowX + orientation.widthMm <= usable.x + usable.width &&
      orientation.heightMm <= (rowHeight || usable.height);
    if (rowHeight > 0 && fitsInRow) {
      const placement = createPlacement(part, orientation, rowX, rowY);
      const strip = sheet.strips[sheet.strips.length - 1];
      strip.heightUsedMm += orientation.widthMm + kerfMm;
      strip.parts.push(placement);
      sheet.placements.push(placement);
      return placement;
    }

    if (orientation.widthMm <= usable.width) {
      const nextRowY = rowY + rowHeight + (rowHeight > 0 ? kerfMm : 0);
      if (nextRowY + orientation.heightMm <= usable.y + usable.height) {
        const strip: Strip = {
          xMm: nextRowY,
          widthMm: orientation.heightMm,
          heightUsedMm: orientation.widthMm,
          parts: [],
        };
        const placement = createPlacement(part, orientation, usable.x, nextRowY);
        strip.parts.push(placement);
        sheet.strips.push(strip);
        sheet.placements.push(placement);
        return placement;
      }
    }
  }

  return tryPlaceInFreeRect(sheet, part, usable, kerfMm);
}

function tryPlaceOnSheet(
  sheet: PackedSheet,
  part: PartInstance,
  usable: UsableArea,
  kerfMm: number,
  axis: AxisMode,
): PlacedPart | null {
  if (axis === "vertical") {
    return tryPlaceVertical(sheet, part, usable, kerfMm);
  }
  return tryPlaceHorizontal(sheet, part, usable, kerfMm);
}

export function packPartsSequentially(
  instances: PartInstance[],
  usable: UsableArea,
  kerfMm: number,
  axis: AxisMode,
): PackedSheet[] {
  const sheets: PackedSheet[] = [];

  for (const part of instances) {
    const newSheet: PackedSheet = {
      sheetIndex: sheets.length + 1,
      strips: [],
      placements: [],
    };
    const placed = tryPlaceOnSheet(newSheet, part, usable, kerfMm, axis);
    if (!placed) {
      throw new Error(`Не удалось разместить деталь "${part.partName}".`);
    }
    sheets.push(newSheet);
  }

  return sheets;
}

export function packParts(
  instances: PartInstance[],
  usable: UsableArea,
  kerfMm: number,
  axis: AxisMode,
): PackedSheet[] {
  const sheets: PackedSheet[] = [];
  // Сначала крупные — мелкие потом добивают пустоты на уже открытых листах.
  const ordered = [...instances].sort((a, b) => {
    const areaA = a.widthMm * a.heightMm;
    const areaB = b.widthMm * b.heightMm;
    if (areaA !== areaB) return areaB - areaA;
    // Одинаковая «крупность» — сначала выравниваем по высоте, чтобы ряд не чередовался.
    if (a.heightMm !== b.heightMm) return b.heightMm - a.heightMm;
    const maxA = Math.max(a.widthMm, a.heightMm);
    const maxB = Math.max(b.widthMm, b.heightMm);
    if (maxA !== maxB) return maxB - maxA;
    return (a.partCode ?? "").localeCompare(b.partCode ?? "", "ru", { numeric: true });
  });

  for (const part of ordered) {
    let placed: PlacedPart | null = null;

    for (const sheet of sheets) {
      placed = tryPlaceOnSheet(sheet, part, usable, kerfMm, axis);
      if (placed) break;
    }

    if (!placed) {
      const newSheet: PackedSheet = {
        sheetIndex: sheets.length + 1,
        strips: [],
        placements: [],
      };
      placed = tryPlaceOnSheet(newSheet, part, usable, kerfMm, axis);
      if (!placed) {
        throw new Error(`Не удалось разместить деталь "${part.partName}".`);
      }
      sheets.push(newSheet);
    }
  }

  if (axis === "vertical") {
    compactIntoGaps(sheets, usable, kerfMm);
  }

  // Всегда: в ряду одной высоты — подряд (после compact полосы часто разбиты).
  for (const sheet of sheets) {
    regroupSameYByHeight(sheet, usable, kerfMm);
  }

  return sheets;
}

function removePlacementFromSheet(sheet: PackedSheet, placement: PlacedPart): PartInstance {
  sheet.placements = sheet.placements.filter((item) => item !== placement);
  for (const strip of sheet.strips) {
    strip.parts = strip.parts.filter((item) => item !== placement);
    if (strip.parts.length === 0) {
      strip.heightUsedMm = 0;
      strip.widthMm = 0;
    } else {
      strip.widthMm = strip.parts.reduce(
        (max, part) => Math.max(max, part.xMm + part.widthMm - strip.xMm),
        0,
      );
      strip.heightUsedMm = strip.parts.reduce(
        (max, part) => Math.max(max, part.yMm + part.heightMm),
        0,
      );
    }
  }
  sheet.strips = sheet.strips.filter((strip) => strip.parts.length > 0);

  // Вернуть исходные габариты до поворота раскладки.
  const widthMm =
    placement.rotationDeg === 90 ? placement.heightMm : placement.widthMm;
  const heightMm =
    placement.rotationDeg === 90 ? placement.widthMm : placement.heightMm;

  return {
    partId: placement.partId,
    partName: placement.partName,
    partCode: placement.partCode,
    specOrder: placement.specOrder,
    instanceIndex: placement.instanceIndex,
    instanceCount: placement.instanceCount,
    widthMm,
    heightMm,
    allowRotation: placement.allowRotation,
    priority: placement.priority,
  };
}

/**
 * Перекладывает мелкие детали с «дырявых» листов в свободные слоты более заполненных.
 * Повторяет, пока есть переносы — меньше листов и пустот.
 */
function compactIntoGaps(
  sheets: PackedSheet[],
  usable: UsableArea,
  kerfMm: number,
): void {
  let changed = true;
  let guard = 0;

  while (changed && guard < 200) {
    changed = false;
    guard += 1;

    // Сначала пытаемся забрать детали с самых пустых листов.
    const sources = [...sheets].sort(
      (a, b) => a.placements.length - b.placements.length,
    );

    for (const source of sources) {
      if (source.placements.length === 0) continue;

      const candidates = [...source.placements].sort(
        (a, b) => a.widthMm * a.heightMm - b.widthMm * b.heightMm,
      );

      for (const placement of candidates) {
        const targets = sheets.filter((sheet) => sheet !== source);
        if (targets.length === 0) continue;

        const instance = removePlacementFromSheet(source, placement);
        let moved = false;

        for (const target of targets) {
          const placed = tryPlaceOnSheet(target, instance, usable, kerfMm, "vertical");
          if (placed) {
            moved = true;
            changed = true;
            break;
          }
        }

        if (!moved) {
          // Вернуть на исходный лист как было.
          const restored = tryPlaceOnSheet(source, instance, usable, kerfMm, "vertical");
          if (!restored) {
            // Аварийно: положить обратно вручную в конец новых координат нельзя — не должны терять.
            source.placements.push(placement);
            let strip = source.strips.find((item) => item.xMm === placement.xMm);
            if (!strip) {
              strip = {
                xMm: placement.xMm,
                widthMm: placement.widthMm,
                heightUsedMm: placement.yMm + placement.heightMm,
                parts: [],
              };
              source.strips.push(strip);
            }
            strip.parts.push(placement);
            strip.widthMm = Math.max(strip.widthMm, placement.widthMm);
            strip.heightUsedMm = Math.max(
              strip.heightUsedMm,
              placement.yMm + placement.heightMm,
            );
          }
        } else {
          break;
        }
      }
      if (changed) break;
    }

    for (let i = sheets.length - 1; i >= 0; i -= 1) {
      if (sheets[i].placements.length === 0) sheets.splice(i, 1);
    }
    sheets.forEach((sheet, index) => {
      sheet.sheetIndex = index + 1;
    });
  }
}

export function chooseAxis(
  instances: PartInstance[],
  usable: UsableArea,
  machine: EngineMachine,
): AxisMode {
  if (machine.preferredPrimaryAxis === "vertical") return "vertical";
  if (machine.preferredPrimaryAxis === "horizontal") return "horizontal";

  const verticalSheets = packParts(instances, usable, machine.kerfMm, "vertical");
  const horizontalSheets = packParts(instances, usable, machine.kerfMm, "horizontal");

  return verticalSheets.length <= horizontalSheets.length ? "vertical" : "horizontal";
}
