import type { EngineResult } from "@/lib/engine";
import prisma from "@/lib/db/prisma";
import { buildEngineInput } from "@/lib/engine/build-input";
import { runCuttingEngine } from "@/lib/engine";
import { generateEntityId } from "@/lib/id";
import { markingOnlySheetsCount } from "@/lib/parts/part-work-type";

const EMPTY_CUT_RESULT: EngineResult = {
  status: "success",
  algorithmVersion: "0.3.1",
  score: 0,
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
};

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

  // createMany вместо поштучных create — иначе крупные раскрои не укладываются в timeout
  const cutPlan = await prisma.$transaction(
    async (tx) => {
      await tx.cutPlan.deleteMany({ where: { projectId } });

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
            Math.round(
              result.sheets.reduce(
                (sum, sheet) => sum + sheet.usableWidthMm * sheet.usableHeightMm,
                0,
              ),
            ),
          ),
          totalPartsAreaMm2: BigInt(Math.round(result.metrics.partsAreaMm2)),
          totalWasteAreaMm2: BigInt(Math.round(result.metrics.wasteAreaMm2)),
          usefulOffcutsAreaMm2: BigInt(
            Math.round(
              result.sheets.reduce(
                (sum, sheet) =>
                  sum +
                  sheet.offcuts
                    .filter((offcut) => offcut.isUseful)
                    .reduce((offcutSum, offcut) => offcutSum + offcut.areaMm2, 0),
                0,
              ),
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

        if (sheet.placements.length > 0) {
          await tx.placement.createMany({
            data: sheet.placements.map((placement) => ({
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
            })),
          });
        }

        if (sheet.operations.length > 0) {
          await tx.cutOperation.createMany({
            data: sheet.operations.map((operation) => ({
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
            })),
          });
        }

        if (sheet.offcuts.length > 0) {
          await tx.plannedOffcut.createMany({
            data: sheet.offcuts.map((offcut) => ({
              id: generateEntityId(),
              cutPlanSheetId: createdSheet.id,
              materialId,
              xMm: offcut.xMm,
              yMm: offcut.yMm,
              widthMm: offcut.widthMm,
              heightMm: offcut.heightMm,
              areaMm2: BigInt(Math.round(offcut.areaMm2)),
              isUseful: offcut.isUseful,
              status: "planned",
            })),
          });
        }
      }

      await tx.project.update({
        where: { id: projectId },
        data: { status: "calculated" },
      });

      return createdPlan;
    },
    { timeout: 30_000 },
  );

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

  // Нет деталей для раскроя — только целые листы под маркировку.
  if (engineInput.parts.length === 0) {
    const markingSheets = markingOnlySheetsCount(
      panel.parts,
      sheetFormat.widthMm,
      sheetFormat.heightMm,
    );
    if (markingSheets === 0) {
      throw new Error("Добавьте хотя бы одну деталь на панель");
    }
    return saveCutPlanResult({
      projectId: project.id,
      panelId: panel.id,
      machineProfileId: machineProfile.id,
      sheetFormatId: sheetFormat.id,
      materialId: material.id,
      engineInput,
      result: EMPTY_CUT_RESULT,
    });
  }

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
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      parts: { orderBy: [{ code: "asc" }, { createdAt: "asc" }] },
      panels: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!project) {
    throw new Error("Проект не найден");
  }

  if (!project.materialId || !project.sheetFormatId || !project.machineProfileId) {
    throw new Error("Выберите материал, формат листа и профиль станка");
  }

  if (project.parts.length === 0) {
    throw new Error("Добавьте хотя бы одну деталь");
  }

  // Один раскрой на весь проект — без разбиения по стенам.
  let targetPanelId = project.panels[0]?.id;
  if (!targetPanelId) {
    targetPanelId = generateEntityId();
    await prisma.panel.create({
      data: {
        id: targetPanelId,
        projectId,
        name: "Спецификация",
        sortOrder: 0,
      },
    });
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
    parts: project.parts,
    material,
    sheetFormat,
    machineProfile,
  });

  if (engineInput.parts.length === 0) {
    const markingSheets = markingOnlySheetsCount(
      project.parts,
      sheetFormat.widthMm,
      sheetFormat.heightMm,
    );
    if (markingSheets === 0) {
      throw new Error("Добавьте хотя бы одну деталь");
    }
    return saveCutPlanResult({
      projectId: project.id,
      panelId: targetPanelId,
      machineProfileId: machineProfile.id,
      sheetFormatId: sheetFormat.id,
      materialId: material.id,
      engineInput,
      result: EMPTY_CUT_RESULT,
    });
  }

  const result = runCuttingEngine(engineInput);

  return saveCutPlanResult({
    projectId: project.id,
    panelId: targetPanelId,
    machineProfileId: machineProfile.id,
    sheetFormatId: sheetFormat.id,
    materialId: material.id,
    engineInput,
    result,
  });
}
