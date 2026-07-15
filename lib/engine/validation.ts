import type { EngineInput, EnginePart, PartInstance, UsableArea } from "./types";
import {
  formatPartMarkingLabel,
  resolvePartMarking,
} from "@/lib/parts/part-marking";

export function getUsableArea(sheet: EngineInput["sheet"]): UsableArea {
  return {
    x: sheet.trimLeftMm,
    y: sheet.trimBottomMm,
    width: sheet.widthMm - sheet.trimLeftMm - sheet.trimRightMm,
    height: sheet.heightMm - sheet.trimTopMm - sheet.trimBottomMm,
  };
}

/** @deprecated use formatPartMarkingLabel — оставлено для совместимости импортов. */
export function formatPartLabel(
  marking: string,
  instanceIndex: number,
  instanceCount = 1,
): string {
  return formatPartMarkingLabel(marking, instanceIndex, instanceCount);
}

/** Показ маркировки: как сохранено при раскрое. */
export function resolvePlacementMarking(label: string, instanceIndex: number): string {
  const trimmed = label.trim();
  if (trimmed) return trimmed;
  return String(instanceIndex);
}

export function expandPartInstances(parts: EnginePart[]): PartInstance[] {
  const instances: PartInstance[] = [];

  parts.forEach((part, specOrder) => {
    for (let i = 0; i < part.quantity; i += 1) {
      const marking = resolvePartMarking(part.name, part.code);
      instances.push({
        partId: part.id,
        partName: part.name,
        partCode: marking,
        specOrder,
        instanceIndex: i + 1,
        instanceCount: part.quantity,
        widthMm: part.widthMm,
        heightMm: part.heightMm,
        allowRotation: part.allowRotation,
        priority: part.priority,
      });
    }
  });

  return instances;
}

/** Порядок кодов в спецификации (для отображения/сортировок списка). */
export function orderInstancesBySpec(instances: PartInstance[]): PartInstance[] {
  return [...instances].sort((a, b) => {
    const codeCompare = comparePartCodes(a.partCode, b.partCode);
    if (codeCompare !== 0) return codeCompare;
    if (a.specOrder !== b.specOrder) return a.specOrder - b.specOrder;
    return a.instanceIndex - b.instanceIndex;
  });
}

/** Для раскладки: сначала крупные, потом плотнее заполняем дыры. */
export function orderInstancesForPacking(instances: PartInstance[]): PartInstance[] {
  return [...instances].sort((a, b) => {
    const areaA = a.widthMm * a.heightMm;
    const areaB = b.widthMm * b.heightMm;
    if (areaA !== areaB) return areaB - areaA;
    const maxA = Math.max(a.widthMm, a.heightMm);
    const maxB = Math.max(b.widthMm, b.heightMm);
    if (maxA !== maxB) return maxB - maxA;
    const codeCompare = comparePartCodes(a.partCode, b.partCode);
    if (codeCompare !== 0) return codeCompare;
    return a.instanceIndex - b.instanceIndex;
  });
}

function comparePartCodes(a?: string, b?: string): number {
  const codeA = a ?? "";
  const codeB = b ?? "";
  if (codeA && codeB && codeA !== codeB) {
    return codeA.localeCompare(codeB, "ru", { numeric: true });
  }
  if (codeA && !codeB) return -1;
  if (!codeA && codeB) return 1;
  return 0;
}

export function validateEngineInput(input: EngineInput): string[] {
  const errors: string[] = [];
  const usable = getUsableArea(input.sheet);

  if (usable.width <= 0 || usable.height <= 0) {
    errors.push("Рабочая зона листа имеет нулевой или отрицательный размер.");
  }

  if (input.parts.length === 0) {
    errors.push("В проекте нет деталей для расчёта.");
  }

  for (const part of input.parts) {
    if (part.widthMm <= 0 || part.heightMm <= 0) {
      errors.push(`Деталь "${part.name}" имеет некорректные размеры.`);
      continue;
    }

    const fitsNormal =
      part.widthMm <= usable.width && part.heightMm <= usable.height;
    const fitsRotated =
      part.allowRotation &&
      part.heightMm <= usable.width &&
      part.widthMm <= usable.height;

    if (!fitsNormal && !fitsRotated) {
      errors.push(
        `Деталь "${part.name}" не помещается на лист ${input.sheet.widthMm}×${input.sheet.heightMm} с учётом отступов.`,
      );
    }

    if (
      part.widthMm < input.machine.minSafePartWidthMm ||
      part.heightMm < input.machine.minSafePartHeightMm
    ) {
      errors.push(`Деталь "${part.name}" меньше минимального безопасного размера.`);
    }
  }

  return errors;
}
