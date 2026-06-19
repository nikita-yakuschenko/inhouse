import type { ClientCutPlanSheet } from "@/features/projects/serialize-panels";

import { resolveGroupedPartId } from "./sheet-part-groups";

export type SheetWorkspaceSelection = {
  sheetIdx: number;
  groupedPartId: string | null;
};

export function findSheetArrayIndex(
  sheets: ClientCutPlanSheet[],
  sheetIndexParam: string | null,
): number {
  if (sheets.length === 0) return 0;
  if (!sheetIndexParam) return 0;

  const sheetNumber = Number.parseInt(sheetIndexParam, 10);
  if (!Number.isFinite(sheetNumber)) return 0;

  const found = sheets.findIndex((sheet) => sheet.sheetIndex === sheetNumber);
  return found >= 0 ? found : 0;
}

export function applySheetSelection(
  parts: { id: string; quantity: number }[],
  sheets: ClientCutPlanSheet[],
  arrayIndex: number,
): SheetWorkspaceSelection {
  if (sheets.length === 0) {
    return { sheetIdx: 0, groupedPartId: null };
  }

  const sheetIdx = Math.max(0, Math.min(arrayIndex, sheets.length - 1));
  const partId = sheets[sheetIdx]?.placements[0]?.partId ?? null;

  return {
    sheetIdx,
    groupedPartId: resolveGroupedPartId(parts, sheets, partId),
  };
}

export function getSheetIndexParam(
  sheets: ClientCutPlanSheet[],
  arrayIndex: number,
): number | null {
  const sheet = sheets[arrayIndex];
  return sheet?.sheetIndex ?? null;
}
