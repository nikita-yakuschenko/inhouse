import { attachMetrics } from "./metrics";
import { toSheetResult } from "./operations";
import { chooseAxis, packPartsSequentially } from "./packing";
import type { EngineInput, EngineResult } from "./types";
import {
  expandPartInstances,
  getUsableArea,
  orderInstancesBySpec,
  validateEngineInput,
} from "./validation";

const ALGORITHM_VERSION = "0.1.0";

export function runCuttingEngine(input: EngineInput): EngineResult {
  const errors = validateEngineInput(input);
  if (errors.length > 0) {
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

  const usable = getUsableArea(input.sheet);
  const instances = orderInstancesBySpec(expandPartInstances(input.parts));
  const axis = chooseAxis(instances, usable, input.machine);
  const packedSheets = packPartsSequentially(instances, usable, input.machine.kerfMm, axis);
  const sheets = packedSheets.map((packed) => toSheetResult(packed, input, usable));

  return attachMetrics({
    status: "success",
    algorithmVersion: ALGORITHM_VERSION,
    sheets,
    warnings: [],
  });
}
