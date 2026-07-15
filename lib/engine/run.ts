import { attachMetrics, calculateScore, calculateMetrics } from "./metrics";
import { toSheetResult } from "./operations";
import { packParts, type AxisMode } from "./packing";
import type { EngineInput, EngineResult, PackedSheet } from "./types";
import {
  expandPartInstances,
  getUsableArea,
  orderInstancesForPacking,
  validateEngineInput,
} from "./validation";

const ALGORITHM_VERSION = "0.3.1";

function emptyFailed(errors: string[]): EngineResult {
  return {
    status: "failed",
    algorithmVersion: ALGORITHM_VERSION,
    score: Number.POSITIVE_INFINITY,
    metrics: {
      sheetsCount: 0,
      partsAreaMm2: 0,
      wasteAreaMm2: 0,
      wastePercent: 0,
      operationsCount: 0,
      manualOperationsCount: 0,
      setupChangesCount: 0,
    },
    sheets: [],
    warnings: [],
    errors,
  };
}

function packAndScore(
  input: EngineInput,
  instances: ReturnType<typeof expandPartInstances>,
  usable: ReturnType<typeof getUsableArea>,
  axis: AxisMode,
): { packed: PackedSheet[]; score: number; sheetsCount: number; setupChanges: number } {
  const packed = packParts(instances, usable, input.machine.kerfMm, axis);
  const sheets = packed.map((sheet) => toSheetResult(sheet, input, usable));
  const metrics = calculateMetrics(sheets);
  return {
    packed,
    score: calculateScore(metrics, sheets),
    sheetsCount: metrics.sheetsCount,
    setupChanges: metrics.setupChangesCount,
  };
}

function resolveAxis(
  input: EngineInput,
  instances: ReturnType<typeof expandPartInstances>,
  usable: ReturnType<typeof getUsableArea>,
): { axis: AxisMode; packed: PackedSheet[] } {
  const preferred = input.machine.preferredPrimaryAxis;

  if (preferred === "vertical" || preferred === "horizontal") {
    const packed = packParts(instances, usable, input.machine.kerfMm, preferred);
    return { axis: preferred, packed };
  }

  // auto: сравниваем полный score (листы + резы + отходы), не только число листов
  const vertical = packAndScore(input, instances, usable, "vertical");
  const horizontal = packAndScore(input, instances, usable, "horizontal");

  if (horizontal.score < vertical.score) {
    return { axis: "horizontal", packed: horizontal.packed };
  }
  return { axis: "vertical", packed: vertical.packed };
}

export function runCuttingEngine(input: EngineInput): EngineResult {
  const errors = validateEngineInput(input);
  if (errors.length > 0) {
    return emptyFailed(errors);
  }

  const usable = getUsableArea(input.sheet);
  const instances = orderInstancesForPacking(expandPartInstances(input.parts));
  const { packed } = resolveAxis(input, instances, usable);
  const sheets = packed.map((sheet) => toSheetResult(sheet, input, usable));

  return attachMetrics({
    status: "success",
    algorithmVersion: ALGORITHM_VERSION,
    sheets,
    warnings: [],
  });
}
