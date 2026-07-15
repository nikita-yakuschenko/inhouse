import { formatPartMarkingLabel } from "@/lib/parts/part-marking";
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

      // Ниже и левее — меньше обрезков; штраф за неиспользуемую площадь слота.
      const waste =
        yMm * 1_000_000 +
        xMm * 1_000 +
        (stripRight - xMm - orientation.widthMm) +
        (usableTop - yMm - orientation.heightMm);

      if (!best || waste < best.waste) {
        best = { xMm, yMm, waste };
      }
    }
  }

  return best;
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

  return null;
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
