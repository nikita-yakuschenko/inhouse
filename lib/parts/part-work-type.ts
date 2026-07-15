import type { ClientPart } from "@/features/projects/serialize-panels";

/** Деталь размером с лист — резать не нужно, только маркировка. Учитываем поворот 90°. */
export function isMarkingOnlyPart(
  part: Pick<ClientPart, "widthMm" | "heightMm">,
  sheetWidthMm: number | null | undefined,
  sheetHeightMm: number | null | undefined,
): boolean {
  if (!sheetWidthMm || !sheetHeightMm) return false;
  const { widthMm, heightMm } = part;
  return (
    (widthMm === sheetWidthMm && heightMm === sheetHeightMm) ||
    (widthMm === sheetHeightMm && heightMm === sheetWidthMm)
  );
}

export function partitionPartsByWorkType<T extends Pick<ClientPart, "widthMm" | "heightMm">>(
  parts: T[],
  sheetWidthMm: number | null | undefined,
  sheetHeightMm: number | null | undefined,
): { cuttingAndMarking: T[]; markingOnly: T[] } {
  const cuttingAndMarking: T[] = [];
  const markingOnly: T[] = [];

  for (const part of parts) {
    if (isMarkingOnlyPart(part, sheetWidthMm, sheetHeightMm)) {
      markingOnly.push(part);
    } else {
      cuttingAndMarking.push(part);
    }
  }

  return { cuttingAndMarking, markingOnly };
}
