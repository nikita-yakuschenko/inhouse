import type {
  ClientCutPlan,
  ClientPart,
  ClientSheetContext,
} from "@/features/projects/serialize-panels";
import {
  markingOnlySheetsCount,
  totalMaterialSheetsCount,
} from "@/lib/parts/part-work-type";

export type MaterialsSpecSummary = {
  materialName: string;
  formatLabel: string;
  thicknessLabel: string;
  sheetsCount: number | null;
  sheetsAreaLabel: string | null;
  partsAreaLabel: string | null;
  wastePercentLabel: string | null;
  markingSheets: number;
  cuttingSheets: number;
  hasCutPlan: boolean;
};

function formatAreaM2(areaMm2: number): string {
  return `${(areaMm2 / 1_000_000).toFixed(2)} м²`;
}

function formatWastePercent(wastePercent: number | null | undefined): string | null {
  if (wastePercent === null || wastePercent === undefined) return null;
  return `${Number(wastePercent).toFixed(1)}%`;
}

/**
 * Данные строки спецификации материалов для UI и PDF.
 * Отход — только метрика раскроя (cutPlan.wastePercent): целые листы под
 * маркировку имеют нулевой отход и на процент не влияют.
 */
export function buildMaterialsSpecSummary(
  sheetContext: ClientSheetContext | null,
  parts: ClientPart[],
  cutPlan: ClientCutPlan | null,
): MaterialsSpecSummary | null {
  if (!sheetContext) return null;

  const sheetW = sheetContext.sheetWidthMm;
  const sheetH = sheetContext.sheetHeightMm;
  const sheetAreaMm2 = sheetW && sheetH ? sheetW * sheetH : null;

  const markingSheets = markingOnlySheetsCount(parts, sheetW, sheetH);
  const cuttingSheets = cutPlan?.totalSheetsCount ?? 0;
  const sheetsCount =
    cutPlan || markingSheets > 0
      ? totalMaterialSheetsCount(cuttingSheets, parts, sheetW, sheetH)
      : null;

  const sheetsAreaMm2 =
    sheetAreaMm2 !== null && sheetsCount !== null
      ? sheetAreaMm2 * sheetsCount
      : null;

  const partsAreaMm2 = parts.reduce(
    (sum, part) => sum + part.widthMm * part.heightMm * part.quantity,
    0,
  );

  const formatLabel =
    sheetW && sheetH
      ? `${sheetW}×${sheetH}`
      : (sheetContext.sheetFormatName ?? "—");

  return {
    materialName: sheetContext.materialName ?? "—",
    formatLabel,
    thicknessLabel:
      sheetContext.thicknessMm != null
        ? String(sheetContext.thicknessMm).replace(".", ",")
        : "—",
    sheetsCount,
    sheetsAreaLabel:
      sheetsAreaMm2 !== null ? formatAreaM2(sheetsAreaMm2) : null,
    partsAreaLabel: parts.length > 0 ? formatAreaM2(partsAreaMm2) : null,
    // Единая логика с картой раскроя / header / PDF карт.
    wastePercentLabel: formatWastePercent(cutPlan?.wastePercent),
    markingSheets,
    cuttingSheets,
    hasCutPlan: Boolean(cutPlan),
  };
}
