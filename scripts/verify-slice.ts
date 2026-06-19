import "dotenv/config";
import prisma from "@/lib/db/prisma";
import { buildEngineInput } from "@/lib/engine/build-input";
import { runCuttingEngine } from "@/lib/engine";
import { calculatePanel } from "@/features/cut-plans/service";
import { generateEntityId, generateEntityIds } from "@/lib/id";
import { SEED_IDS } from "@/lib/seed-ids";

async function main() {
  const projectId = generateEntityId();
  const panelId = generateEntityId();

  const project = await prisma.project.create({
    data: {
      id: projectId,
      organizationId: SEED_IDS.organization,
      name: "Проверка 20 деталей",
      materialId: SEED_IDS.material,
      sheetFormatId: SEED_IDS.sheetFormat,
      machineProfileId: SEED_IDS.machineProfile,
      status: "draft",
      mode: "production",
      panels: {
        create: {
          id: panelId,
          name: "Панель 1",
          sortOrder: 0,
        },
      },
    },
    include: {
      panels: true,
    },
  });

  const panel = project.panels[0]!;

  const partIds = generateEntityIds(20);

  await prisma.part.createMany({
    data: Array.from({ length: 20 }, (_, index) => ({
      id: partIds[index]!,
      projectId: project.id,
      panelId: panel.id,
      name: `Деталь ${index + 1}`,
      code: `P-${index + 1}`,
      widthMm: 400 + (index % 5) * 50,
      heightMm: 300 + (index % 4) * 40,
      quantity: 1,
      allowRotation: true,
      shapeType: "rectangle" as const,
    })),
  });

  const parts = await prisma.part.findMany({ where: { panelId: panel.id } });

  const [material, sheetFormat, machineProfile] = await Promise.all([
    prisma.material.findUniqueOrThrow({ where: { id: project.materialId! } }),
    prisma.sheetFormat.findUniqueOrThrow({ where: { id: project.sheetFormatId! } }),
    prisma.machineProfile.findUniqueOrThrow({ where: { id: project.machineProfileId! } }),
  ]);

  const engineResult = runCuttingEngine(
    buildEngineInput({
      project,
      parts,
      material,
      sheetFormat,
      machineProfile,
    }),
  );

  if (engineResult.status !== "success") {
    throw new Error(engineResult.errors?.join(", "));
  }

  const cutPlanId = await calculatePanel(panel.id);
  const savedPlan = await prisma.cutPlan.findUnique({
    where: { id: cutPlanId },
    include: {
      sheets: {
        include: {
          placements: true,
          operations: true,
        },
      },
    },
  });

  console.log("Verification OK:", {
    projectId: project.id,
    panelId: panel.id,
    cutPlanId,
    parts: parts.length,
    sheets: savedPlan?.totalSheetsCount,
    placements: savedPlan?.sheets.reduce((sum, sheet) => sum + sheet.placements.length, 0),
    operations: savedPlan?.totalOperationsCount,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
