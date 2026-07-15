import type { EngineInput } from "@/lib/engine";
import type {
  MachineProfile,
  Material,
  Part,
  Project,
  SheetFormat,
} from "@/app/generated/prisma/client";
import { partitionPartsByWorkType } from "@/lib/parts/part-work-type";

function comparePartsBySpecOrder(a: Part, b: Part): number {
  const codeA = a.code ?? "";
  const codeB = b.code ?? "";
  if (codeA && codeB && codeA !== codeB) {
    return codeA.localeCompare(codeB, "ru", { numeric: true });
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export function buildEngineInput(params: {
  project: Project;
  parts: Part[];
  material: Material;
  sheetFormat: SheetFormat;
  machineProfile: MachineProfile;
}): EngineInput {
  const { project, parts, sheetFormat, machineProfile } = params;

  // Целые листы (только маркировка) в раскрой не кладём — отдельной позицией в спецификации.
  const { cuttingAndMarking } = partitionPartsByWorkType(
    parts,
    sheetFormat.widthMm,
    sheetFormat.heightMm,
  );

  return {
    projectId: project.id,
    mode: project.mode,
    machine: {
      kerfMm: Number(machineProfile.defaultKerfMm),
      minSafePartWidthMm: machineProfile.minSafePartWidthMm,
      minSafePartHeightMm: machineProfile.minSafePartHeightMm,
      supportsStopCut: machineProfile.supportsStopCut,
      supportsInternalCut: machineProfile.supportsInternalCut,
      requiresCornerDrillingForInternalCut:
        machineProfile.requiresCornerDrillingForInternalCut,
      preferredPrimaryAxis:
        machineProfile.preferredPrimaryAxis as EngineInput["machine"]["preferredPrimaryAxis"],
      minUsefulOffcutWidthMm: machineProfile.minUsefulOffcutWidthMm,
      minUsefulOffcutHeightMm: machineProfile.minUsefulOffcutHeightMm,
    },
    sheet: {
      widthMm: sheetFormat.widthMm,
      heightMm: sheetFormat.heightMm,
      // Заводской лист — рабочая зона на всю заготовку, без технологической подрезки
      trimLeftMm: 0,
      trimRightMm: 0,
      trimTopMm: 0,
      trimBottomMm: 0,
    },
    parts: [...cuttingAndMarking].sort(comparePartsBySpecOrder).map((part) => ({
      id: part.id,
      name: part.name,
      code: part.code ?? undefined,
      quantity: part.quantity,
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      shapeType: "rectangle",
      allowRotation: part.allowRotation,
      grainDirectionRequired: part.grainDirectionRequired,
      priority: part.priority,
    })),
    offcuts: [],
    settings: {
      useOffcutsFirst: true,
      allowRotationDefault: true,
      minUsefulOffcutWidthMm: machineProfile.minUsefulOffcutWidthMm,
      minUsefulOffcutHeightMm: machineProfile.minUsefulOffcutHeightMm,
    },
  };
}
