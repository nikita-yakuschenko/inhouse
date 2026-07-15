import prisma from "@/lib/db/prisma";

export async function getMachineProfilesForSettings() {
  return prisma.machineProfile.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}
