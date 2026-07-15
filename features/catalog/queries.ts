import prisma from "@/lib/db/prisma";

export async function getMaterialsCatalog() {
  return prisma.material.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { sheetFormats: true } },
    },
  });
}

export async function getSheetFormatsCatalog() {
  return prisma.sheetFormat.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { material: true },
  });
}

export async function getActiveMaterialsForSelect() {
  return prisma.material.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
}
