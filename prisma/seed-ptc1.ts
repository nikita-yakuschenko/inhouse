import "dotenv/config";
import prisma from "@/lib/db/prisma";
import { calculatePanel } from "@/features/cut-plans/service";
import { PTC1_IDS, SEED_IDS } from "@/lib/seed-ids";

/** Спецификация внутренней плитной обшивки П(Ц)-1, плита OSB-3 1250×2500×22 */
const PTC1_PARTS = [
  { code: "01", name: "П(Ц)-1 [01]", widthMm: 1250, heightMm: 1970, quantity: 3 },
  { code: "02", name: "П(Ц)-1 [02]", widthMm: 1250, heightMm: 1330, quantity: 3 },
  { code: "03", name: "П(Ц)-1 [03]", widthMm: 1250, heightMm: 1290, quantity: 2 },
  { code: "04", name: "П(Ц)-1 [04]", widthMm: 1250, heightMm: 2010, quantity: 2 },
  { code: "05", name: "П(Ц)-1 [05]", widthMm: 900, heightMm: 1330, quantity: 1 },
  { code: "06", name: "П(Ц)-1 [06]", widthMm: 900, heightMm: 1970, quantity: 1 },
  { code: "07", name: "П(Ц)-1 [07]", widthMm: 1250, heightMm: 1330, quantity: 1 },
  { code: "08", name: "П(Ц)-1 [08]", widthMm: 1250, heightMm: 1970, quantity: 1 },
] as const;

async function main() {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: SEED_IDS.organization },
  });

  await prisma.machineProfile.findUniqueOrThrow({
    where: { id: SEED_IDS.machineProfile },
  });

  const material = await prisma.material.upsert({
    where: { id: PTC1_IDS.material },
    update: {
      name: "Плита OSB-3 1250×2500×22",
      isActive: true,
    },
    create: {
      id: PTC1_IDS.material,
      organizationId: organization.id,
      name: "Плита OSB-3 1250×2500×22",
      materialType: "osb",
      thicknessMm: 22,
      defaultSheetWidthMm: 1250,
      defaultSheetHeightMm: 2500,
      hasGrainDirection: false,
      isActive: true,
    },
  });

  const sheetFormat = await prisma.sheetFormat.upsert({
    where: { id: PTC1_IDS.sheetFormat },
    update: {
      name: "OSB 1250×2500×22",
      widthMm: 1250,
      heightMm: 2500,
      thicknessMm: 22,
      trimLeftMm: 0,
      trimRightMm: 0,
      trimTopMm: 0,
      trimBottomMm: 0,
      isActive: true,
    },
    create: {
      id: PTC1_IDS.sheetFormat,
      organizationId: organization.id,
      materialId: material.id,
      name: "OSB 1250×2500×22",
      widthMm: 1250,
      heightMm: 2500,
      thicknessMm: 22,
      trimLeftMm: 0,
      trimRightMm: 0,
      trimTopMm: 0,
      trimBottomMm: 0,
      isDefault: false,
      isActive: true,
    },
  });

  await prisma.project.upsert({
    where: { id: PTC1_IDS.project },
    update: {
      name: "П(Ц)-1",
      description: "Спецификация внутренней плитной обшивки",
      materialId: material.id,
      sheetFormatId: sheetFormat.id,
      machineProfileId: SEED_IDS.machineProfile,
      status: "draft",
    },
    create: {
      id: PTC1_IDS.project,
      organizationId: organization.id,
      name: "П(Ц)-1",
      description: "Спецификация внутренней плитной обшивки",
      customerName: "Демо-производство",
      materialId: material.id,
      sheetFormatId: sheetFormat.id,
      machineProfileId: SEED_IDS.machineProfile,
      status: "draft",
      mode: "production",
    },
  });

  await prisma.panel.upsert({
    where: { id: PTC1_IDS.panel },
    update: {
      name: "П(Ц)-1",
      code: "П(Ц)-1",
      sortOrder: 0,
    },
    create: {
      id: PTC1_IDS.panel,
      projectId: PTC1_IDS.project,
      name: "П(Ц)-1",
      code: "П(Ц)-1",
      sortOrder: 0,
    },
  });

  await prisma.cutPlan.deleteMany({ where: { panelId: PTC1_IDS.panel } });
  await prisma.part.deleteMany({ where: { panelId: PTC1_IDS.panel } });

  await prisma.part.createMany({
    data: PTC1_PARTS.map((part) => ({
      id: PTC1_IDS.parts[part.code as keyof typeof PTC1_IDS.parts],
      projectId: PTC1_IDS.project,
      panelId: PTC1_IDS.panel,
      materialId: material.id,
      sheetFormatId: sheetFormat.id,
      name: part.name,
      code: part.code,
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      quantity: part.quantity,
      allowRotation: true,
      shapeType: "rectangle" as const,
    })),
  });

  const cutPlanId = await calculatePanel(PTC1_IDS.panel);
  const cutPlan = await prisma.cutPlan.findUniqueOrThrow({ where: { id: cutPlanId } });

  const totalPieces = PTC1_PARTS.reduce((sum, part) => sum + part.quantity, 0);

  console.log("П(Ц)-1 загружена:", {
    projectId: PTC1_IDS.project,
    panelId: PTC1_IDS.panel,
    partTypes: PTC1_PARTS.length,
    totalPieces,
    totalAreaM2: "27.72",
    cutPlanId,
    sheets: cutPlan.totalSheetsCount,
    wastePercent: Number(cutPlan.wastePercent ?? 0).toFixed(1) + "%",
    operations: cutPlan.totalOperationsCount,
    url: `http://localhost:3000/projects/${PTC1_IDS.project}?panel=${PTC1_IDS.panel}`,
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
