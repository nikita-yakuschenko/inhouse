import "dotenv/config";
import prisma from "@/lib/db/prisma";
import { SEED_IDS } from "@/lib/seed-ids";

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: SEED_IDS.organization },
    update: {},
    create: {
      id: SEED_IDS.organization,
      name: "Демо-производство",
    },
  });

  const material = await prisma.material.upsert({
    where: { id: SEED_IDS.material },
    update: {},
    create: {
      id: SEED_IDS.material,
      organizationId: organization.id,
      name: "ГКЛ 12.5 мм",
      materialType: "gkl",
      thicknessMm: 13,
      defaultSheetWidthMm: 2500,
      defaultSheetHeightMm: 1250,
      hasGrainDirection: false,
      isActive: true,
    },
  });

  const sheetFormat = await prisma.sheetFormat.upsert({
    where: { id: SEED_IDS.sheetFormat },
    update: {
      trimLeftMm: 0,
      trimRightMm: 0,
      trimTopMm: 0,
      trimBottomMm: 0,
    },
    create: {
      id: SEED_IDS.sheetFormat,
      organizationId: organization.id,
      materialId: material.id,
      name: "2500×1250",
      widthMm: 2500,
      heightMm: 1250,
      thicknessMm: 13,
      // Заводской лист — без технологической подрезки кромок
      trimLeftMm: 0,
      trimRightMm: 0,
      trimTopMm: 0,
      trimBottomMm: 0,
      isDefault: true,
      isActive: true,
    },
  });

  await prisma.machineProfile.upsert({
    where: { id: SEED_IDS.machineProfile },
    update: {},
    create: {
      id: SEED_IDS.machineProfile,
      organizationId: organization.id,
      name: "Вертикальный форматно-раскроечный станок",
      machineType: "vertical_panel_saw",
      maxSheetWidthMm: 3800,
      maxSheetHeightMm: 2200,
      maxSheetThicknessMm: 60,
      defaultKerfMm: 4,
      minSafePartWidthMm: 80,
      minSafePartHeightMm: 80,
      minUsefulOffcutWidthMm: 300,
      minUsefulOffcutHeightMm: 300,
      preferredPrimaryAxis: "auto",
      coordinateOrigin: "bottom_left",
      isDefault: true,
      isActive: true,
    },
  });

  console.log("Seed completed:", {
    organization: organization.name,
    material: material.name,
    sheetFormat: sheetFormat.name,
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
