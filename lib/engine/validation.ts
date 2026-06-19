import type { EngineInput, EnginePart, PartInstance, UsableArea } from "./types";

export function getUsableArea(sheet: EngineInput["sheet"]): UsableArea {
  return {
    x: sheet.trimLeftMm,
    y: sheet.trimBottomMm,
    width: sheet.widthMm - sheet.trimLeftMm - sheet.trimRightMm,
    height: sheet.heightMm - sheet.trimTopMm - sheet.trimBottomMm,
  };
}

export function formatPartLabel(partName: string, instanceIndex: number): string {
  return `${partName} - ${instanceIndex}`;
}

/** Нормализует маркировку для отображения (в т.ч. старые записи без « - N»). */
export function resolvePlacementMarking(label: string, instanceIndex: number): string {
  const baseName = label.replace(/ - \d+$/, "");
  return formatPartLabel(baseName, instanceIndex);
}

export function expandPartInstances(parts: EnginePart[]): PartInstance[] {
  const instances: PartInstance[] = [];

  parts.forEach((part, specOrder) => {
    for (let i = 0; i < part.quantity; i += 1) {
      instances.push({
        partId: part.id,
        partName: part.name,
        partCode: part.code,
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

/** Порядок выполнения: код в спецификации, затем номер экземпляра. */
export function orderInstancesBySpec(instances: PartInstance[]): PartInstance[] {
  return [...instances].sort((a, b) => {
    const codeCompare = comparePartCodes(a.partCode, b.partCode);
    if (codeCompare !== 0) return codeCompare;
    if (a.specOrder !== b.specOrder) return a.specOrder - b.specOrder;
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
