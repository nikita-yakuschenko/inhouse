import type { EngineResult } from "@/lib/engine";
import prisma from "@/lib/db/prisma";
import { buildEngineInput } from "@/lib/engine/build-input";
import { runCuttingEngine } from "@/lib/engine";
import { generateEntityId } from "@/lib/id";

async function saveCutPlanResult(params: {
  projectId: string;
  panelId: string;
  machineProfileId: string;
  sheetFormatId: string;
  materialId: string;
  engineInput: ReturnType<typeof buildEngineInput>;
  result: EngineResult;
}) {
  const { projectId, panelId, machineProfileId, sheetFormatId, materialId, engineInput, result } =
    params;

  if (result.status === "failed") {
    throw new Error(result.errors?.join(" ") ?? "Расчёт завершился с ошибкой");
  }

  const cutPlan = await prisma.$transaction(async (tx) => {
    await tx.cutPlan.deleteMany({ where: { panelId } });

    const createdPlan = await tx.cutPlan.create({
      data: {
        id: generateEntityId(),
        projectId,
        panelId,
        machineProfileId,
        status: "calculated",
        algorithmVersion: result.algorithmVersion,
        score: result.score,
        totalSheetsCount: result.metrics.sheetsCount,
        totalMaterialAreaMm2: BigInt(
          result.sheets.reduce(
            (sum, sheet) => sum + sheet.usableWidthMm * sheet.usableHeightMm,
            0,
          ),
        ),
        totalPartsAreaMm2: BigInt(result.metrics.partsAreaMm2),
        totalWasteAreaMm2: BigInt(result.metrics.wasteAreaMm2),
        usefulOffcutsAreaMm2: BigInt(
          result.sheets.reduce(
            (sum, sheet) =>
              sum +
              sheet.offcuts
                .filter((offcut) => offcut.isUseful)
                .reduce((offcutSum, offcut) => offcutSum + offcut.areaMm2, 0),
            0,
          ),
        ),
        wastePercent: result.metrics.wastePercent,
        totalOperationsCount: result.metrics.operationsCount,
        totalSetupChangesCount: result.metrics.setupChangesCount,
        totalManualOperationsCount: result.metrics.manualOperationsCount,
        settingsJson: JSON.parse(JSON.stringify(engineInput.settings)),
      },
    });

    for (const sheet of result.sheets) {
      const createdSheet = await tx.cutPlanSheet.create({
        data: {
          id: generateEntityId(),
          cutPlanId: createdPlan.id,
          sourceType: "full_sheet",
          sourceSheetFormatId: sheetFormatId,
          sheetIndex: sheet.sheetIndex,
          widthMm: sheet.widthMm,
          heightMm: sheet.heightMm,
          usableXmm: sheet.usableXmm,
          usableYmm: sheet.usableYmm,
          usableWidthMm: sheet.usableWidthMm,
          usableHeightMm: sheet.usableHeightMm,
          materialId,
        },
      });

      for (const placement of sheet.placements) {
        await tx.placement.create({
          data: {
            id: generateEntityId(),
            cutPlanSheetId: createdSheet.id,
            partId: placement.partId,
            partInstanceIndex: placement.partInstanceIndex,
            xMm: placement.xMm,
            yMm: placement.yMm,
            widthMm: placement.widthMm,
            heightMm: placement.heightMm,
            rotationDeg: placement.rotationDeg,
            label: placement.label,
          },
        });
      }

      for (const operation of sheet.operations) {
        await tx.cutOperation.create({
          data: {
            id: generateEntityId(),
            cutPlanSheetId: createdSheet.id,
            sequenceNumber: operation.sequenceNumber,
            operationType: operation.operationType,
            axis: operation.axis,
            x1Mm: operation.x1Mm,
            y1Mm: operation.y1Mm,
            x2Mm: operation.x2Mm,
            y2Mm: operation.y2Mm,
            positionMm: operation.positionMm,
            targetPartId: operation.targetPartId,
            kerfMm: engineInput.machine.kerfMm,
            note: operation.note,
            riskLevel: operation.riskLevel,
          },
        });
      }

      for (const offcut of sheet.offcuts) {
        await tx.plannedOffcut.create({
          data: {
            id: generateEntityId(),
            cutPlanSheetId: createdSheet.id,
            materialId,
            xMm: offcut.xMm,
            yMm: offcut.yMm,
            widthMm: offcut.widthMm,
            heightMm: offcut.heightMm,
            areaMm2: BigInt(offcut.areaMm2),
            isUseful: offcut.isUseful,
            status: "planned",
          },
        });
      }
    }

    await tx.project.update({
      where: { id: projectId },
      data: { status: "calculated" },
    });

    return createdPlan;
  });

  return cutPlan.id;
}

export async function calculatePanel(panelId: string): Promise<string> {
  const panel = await prisma.panel.findUnique({
    where: { id: panelId },
    include: {
      parts: { orderBy: [{ code: "asc" }, { createdAt: "asc" }] },
      project: true,
    },
  });

  if (!panel) {
    throw new Error("Панель не найдена");
  }

  const project = panel.project;

  if (!project.materialId || !project.sheetFormatId || !project.machineProfileId) {
    throw new Error("Выберите материал, формат листа и профиль станка");
  }

  if (panel.parts.length === 0) {
    throw new Error("Добавьте хотя бы одну деталь на панель");
  }

  const [material, sheetFormat, machineProfile] = await Promise.all([
    prisma.material.findUniqueOrThrow({ where: { id: project.materialId } }),
    prisma.sheetFormat.findUniqueOrThrow({ where: { id: project.sheetFormatId } }),
    prisma.machineProfile.findUniqueOrThrow({
      where: { id: project.machineProfileId },
    }),
  ]);

  const engineInput = buildEngineInput({
    project,
    parts: panel.parts,
    material,
    sheetFormat,
    machineProfile,
  });

  const result = runCuttingEngine(engineInput);

  return saveCutPlanResult({
    projectId: project.id,
    panelId: panel.id,
    machineProfileId: machineProfile.id,
    sheetFormatId: sheetFormat.id,
    materialId: material.id,
    engineInput,
    result,
  });
}

export async function calculateProject(projectId: string): Promise<string> {
  const panels = await prisma.panel.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
    include: {
      parts: { select: { id: true } },
    },
  });

  if (panels.length === 0) {
    throw new Error("Создайте панель перед расчётом");
  }

  const panelsWithParts = panels.filter((panel) => panel.parts.length > 0);
  if (panelsWithParts.length === 0) {
    throw new Error("Добавьте детали на панели перед расчётом");
  }

  let lastCutPlanId = "";
  for (const panel of panelsWithParts) {
    lastCutPlanId = await calculatePanel(panel.id);
  }

  return lastCutPlanId;
}
