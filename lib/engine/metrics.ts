import type { EngineMetrics, EngineResult, EngineSheetResult } from "./types";

export function calculateMetrics(sheets: EngineSheetResult[]): EngineMetrics {
  const partsAreaMm2 = sheets.reduce(
    (sum, sheet) =>
      sum +
      sheet.placements.reduce(
        (sheetSum, placement) => sheetSum + placement.widthMm * placement.heightMm,
        0,
      ),
    0,
  );

  const materialAreaMm2 = sheets.reduce(
    (sum, sheet) => sum + sheet.usableWidthMm * sheet.usableHeightMm,
    0,
  );

  const usefulOffcutsArea = sheets.reduce(
    (sum, sheet) =>
      sum +
      sheet.offcuts
        .filter((offcut) => offcut.isUseful)
        .reduce((offcutSum, offcut) => offcutSum + offcut.areaMm2, 0),
    0,
  );

  const wasteAreaMm2 = Math.max(0, materialAreaMm2 - partsAreaMm2 - usefulOffcutsArea);
  const operationsCount = sheets.reduce((sum, sheet) => sum + sheet.operations.length, 0);
  const manualOperationsCount = sheets.reduce(
    (sum, sheet) =>
      sum +
      sheet.operations.filter((op) => op.operationType === "manual_finish").length,
    0,
  );

  const setupChangesCount = sheets.reduce(
    (sum, sheet) =>
      sum +
      sheet.operations.filter((op) => op.operationType === "full_cut").length,
    0,
  );

  return {
    sheetsCount: sheets.length,
    partsAreaMm2,
    wasteAreaMm2,
    wastePercent: materialAreaMm2 > 0 ? (wasteAreaMm2 / materialAreaMm2) * 100 : 0,
    operationsCount,
    manualOperationsCount,
    setupChangesCount,
  };
}

export function calculateScore(metrics: EngineMetrics, sheets: EngineSheetResult[]): number {
  const riskyOperationsCount = sheets.reduce(
    (sum, sheet) =>
      sum + sheet.operations.filter((operation) => operation.riskLevel === "risky").length,
    0,
  );

  const smallUselessOffcutsCount = sheets.reduce(
    (sum, sheet) =>
      sum + sheet.offcuts.filter((offcut) => !offcut.isUseful).length,
    0,
  );

  const usefulOffcutsAreaMm2 = sheets.reduce(
    (sum, sheet) =>
      sum +
      sheet.offcuts
        .filter((offcut) => offcut.isUseful)
        .reduce((offcutSum, offcut) => offcutSum + offcut.areaMm2, 0),
    0,
  );

  return (
    metrics.sheetsCount * 100_000_000 +
    metrics.wasteAreaMm2 * 1 +
    metrics.operationsCount * 50_000 +
    metrics.setupChangesCount * 80_000 +
    metrics.manualOperationsCount * 120_000 +
    riskyOperationsCount * 150_000 +
    smallUselessOffcutsCount * 30_000 -
    usefulOffcutsAreaMm2 * 0.3
  );
}

export function attachMetrics(result: Omit<EngineResult, "score" | "metrics"> & {
  sheets: EngineSheetResult[];
}): EngineResult {
  const metrics = calculateMetrics(result.sheets);
  const score = calculateScore(metrics, result.sheets);
  return {
    ...result,
    metrics,
    score,
  };
}
