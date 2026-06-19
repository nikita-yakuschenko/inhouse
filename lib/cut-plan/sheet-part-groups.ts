import type { ClientCutPlanSheet } from "@/features/projects/serialize-panels";

export type SheetTabSegment = {
  kind: "single" | "group";
  indices: number[];
};

export function getSheetIndicesForPart(
  sheets: ClientCutPlanSheet[],
  partId: string,
): number[] {
  return sheets.reduce<number[]>((indices, sheet, index) => {
    if (sheet.placements[0]?.partId === partId) {
      indices.push(index);
    }
    return indices;
  }, []);
}

/** Разбивает вкладки на одиночные и сгруппированные сегменты без изменения порядка. */
export function buildSheetTabSegments(
  sheetCount: number,
  groupedIndices: number[] | null,
): SheetTabSegment[] {
  if (!groupedIndices || groupedIndices.length < 2) {
    return Array.from({ length: sheetCount }, (_, index) => ({
      kind: "single" as const,
      indices: [index],
    }));
  }

  const groupedSet = new Set(groupedIndices);
  const segments: SheetTabSegment[] = [];
  let index = 0;

  while (index < sheetCount) {
    if (!groupedSet.has(index)) {
      segments.push({ kind: "single", indices: [index] });
      index += 1;
      continue;
    }

    const indices: number[] = [];
    while (index < sheetCount && groupedSet.has(index)) {
      indices.push(index);
      index += 1;
    }
    segments.push({ kind: "group", indices });
  }

  return segments;
}

/** Постоянные сегменты вкладок: слоты группы резервируются для деталей с qty ≥ 2. */
export function buildStructuralSheetTabSegments(
  sheets: ClientCutPlanSheet[],
  parts: { id: string; quantity: number }[],
): SheetTabSegment[] {
  if (sheets.length === 0) return [];

  const quantityByPartId = new Map(parts.map((part) => [part.id, part.quantity]));
  const segments: SheetTabSegment[] = [];
  let index = 0;

  while (index < sheets.length) {
    const partId = sheets[index]?.placements[0]?.partId;
    const quantity = partId ? (quantityByPartId.get(partId) ?? 0) : 0;

    if (!partId || quantity < 2) {
      segments.push({ kind: "single", indices: [index] });
      index += 1;
      continue;
    }

    const indices: number[] = [];
    while (
      index < sheets.length &&
      sheets[index]?.placements[0]?.partId === partId
    ) {
      indices.push(index);
      index += 1;
    }

    if (indices.length >= 2) {
      segments.push({ kind: "group", indices });
      continue;
    }

    for (const singleIndex of indices) {
      segments.push({ kind: "single", indices: [singleIndex] });
    }
  }

  return segments;
}

export function resolveGroupedPartId(
  parts: { id: string; quantity: number }[],
  sheets: ClientCutPlanSheet[],
  partId: string | null | undefined,
): string | null {
  if (!partId) return null;

  const part = parts.find((item) => item.id === partId);
  if (!part || part.quantity < 2) return null;

  const indices = getSheetIndicesForPart(sheets, partId);
  return indices.length >= 2 ? partId : null;
}
