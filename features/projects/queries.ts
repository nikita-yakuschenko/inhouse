import prisma from "@/lib/db/prisma";
import { ensurePanelsForProject } from "@/features/panels/ensure-panels";

const panelCutPlanInclude = {
  orderBy: { createdAt: "desc" as const },
  take: 1,
  include: {
    sheets: {
      orderBy: { sheetIndex: "asc" as const },
      include: {
        placements: true,
        operations: { orderBy: { sequenceNumber: "asc" as const } },
        plannedOffcuts: true,
      },
    },
  },
};

export async function getProjects() {
  return prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      panels: {
        orderBy: { sortOrder: "asc" },
        include: {
          parts: { orderBy: [{ code: "asc" }, { createdAt: "asc" }] },
          cutPlans: panelCutPlanInclude,
        },
      },
    },
  });
}

const projectDetailInclude = {
  material: true,
  sheetFormat: true,
  panels: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      parts: {
        orderBy: [{ code: "asc" as const }, { createdAt: "asc" as const }],
      },
      cutPlans: panelCutPlanInclude,
    },
  },
};

export async function getProjectById(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: projectDetailInclude,
  });

  if (!project) {
    return null;
  }

  if (project.panels.length === 0) {
    await ensurePanelsForProject(projectId);
    return prisma.project.findUnique({
      where: { id: projectId },
      include: projectDetailInclude,
    });
  }

  return project;
}

export async function getCatalogDefaults() {
  const [materials, sheetFormats, machineProfiles] = await Promise.all([
    prisma.material.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.sheetFormat.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { material: true },
    }),
    prisma.machineProfile.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Decimal нельзя передавать в Client Components — только number/string/plain.
  return {
    materials: materials.map((material) => ({
      ...material,
      thicknessMm: Number(material.thicknessMm),
      densityKgM2:
        material.densityKgM2 == null ? null : Number(material.densityKgM2),
      pricePerM2: material.pricePerM2 == null ? null : Number(material.pricePerM2),
    })),
    sheetFormats: sheetFormats.map((sheet) => ({
      ...sheet,
      thicknessMm: Number(sheet.thicknessMm),
      pricePerSheet:
        sheet.pricePerSheet == null ? null : Number(sheet.pricePerSheet),
      material: {
        ...sheet.material,
        thicknessMm: Number(sheet.material.thicknessMm),
        densityKgM2:
          sheet.material.densityKgM2 == null
            ? null
            : Number(sheet.material.densityKgM2),
        pricePerM2:
          sheet.material.pricePerM2 == null
            ? null
            : Number(sheet.material.pricePerM2),
      },
    })),
    machineProfiles: machineProfiles.map((machine) => ({
      ...machine,
      defaultKerfMm: Number(machine.defaultKerfMm),
    })),
  };
}

export async function getOperatorAssignments() {
  const projects = await getProjects();

  return projects.flatMap((project) =>
    project.panels
      .filter((panel) => panel.cutPlans.length > 0)
      .map((panel) => {
        const cutPlan = panel.cutPlans[0]!;
        const partsCount = panel.parts.length;
        const partsQuantity = panel.parts.reduce((sum, part) => sum + part.quantity, 0);

        return {
          projectId: project.id,
          projectName: project.name,
          panelId: panel.id,
          panelName: panel.name,
          sheetsCount: cutPlan.totalSheetsCount,
          wastePercent: cutPlan.wastePercent,
          partsCount,
          partsQuantity,
        };
      }),
  );
}

export async function getLatestCutPlanForPanel(panelId: string) {
  return prisma.cutPlan.findFirst({
    where: { panelId },
    orderBy: { createdAt: "desc" },
    include: {
      sheets: {
        orderBy: { sheetIndex: "asc" },
        include: {
          placements: { include: { part: true } },
          operations: { orderBy: { sequenceNumber: "asc" } },
          plannedOffcuts: true,
        },
      },
    },
  });
}
