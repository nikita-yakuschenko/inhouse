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

function canFitInVerticalStrip(
  strip: Strip,
  orientation: Orientation,
  usable: UsableArea,
  kerfMm: number,
): boolean {
  if (orientation.widthMm > strip.widthMm) return false;
  const kerf = strip.parts.length > 0 ? kerfMm : 0;
  return strip.heightUsedMm + kerf + orientation.heightMm <= usable.height;
}

function placeInVerticalStrip(
  strip: Strip,
  part: PartInstance,
  orientation: Orientation,
  usable: UsableArea,
  kerfMm: number,
): PlacedPart {
  const kerf = strip.parts.length > 0 ? kerfMm : 0;
  const yMm = usable.y + strip.heightUsedMm + kerf;
  const placement = createPlacement(part, orientation, strip.xMm, yMm);
  strip.parts.push(placement);
  strip.heightUsedMm += kerf + orientation.heightMm;
  strip.widthMm = Math.max(strip.widthMm, orientation.widthMm);
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

  const placement = placeInVerticalStrip(strip, part, orientation, usable, kerfMm);
  sheet.strips.push(strip);
  return placement;
}

function tryPlaceVertical(
  sheet: PackedSheet,
  part: PartInstance,
  usable: UsableArea,
  kerfMm: number,
): PlacedPart | null {
  let best: { placement: PlacedPart; waste: number } | null = null;

  for (const orientation of getOrientations(part)) {
    for (const strip of sheet.strips) {
      if (!canFitInVerticalStrip(strip, orientation, usable, kerfMm)) continue;

      const kerf = strip.parts.length > 0 ? kerfMm : 0;
      const remainingHeight =
        usable.height - strip.heightUsedMm - kerf - orientation.heightMm;
      const remainingWidth = strip.widthMm - orientation.widthMm;
      const waste = remainingWidth * usable.height + remainingHeight * strip.widthMm;

      const placement = createPlacement(
        part,
        orientation,
        strip.xMm,
        usable.y + strip.heightUsedMm + kerf,
      );

      if (!best || waste < best.waste) {
        best = { placement, waste };
      }
    }
  }

  if (best) {
    const strip = sheet.strips.find((item) => item.xMm === best!.placement.xMm);
    const orientation = getOrientations(part).find(
      (item) =>
        item.widthMm === best!.placement.widthMm &&
        item.heightMm === best!.placement.heightMm,
    );
    if (strip && orientation) {
      const placement = placeInVerticalStrip(strip, part, orientation, usable, kerfMm);
      sheet.placements.push(placement);
      return placement;
    }
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
