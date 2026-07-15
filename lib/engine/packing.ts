import type {
  EngineMachine,
  PackedSheet,
  PartInstance,
  PlacedPart,
  Strip,
  UsableArea,
} from "./types";
import { formatPartLabel } from "./validation";

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
    label: formatPartLabel(part.partName, part.instanceIndex),
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

  for (const part of instances) {
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

  return sheets;
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
