import prisma from "@/lib/db/prisma";
import { generateEntityId } from "@/lib/id";

export async function ensurePanelsForProject(projectId: string) {
  const panels = await prisma.panel.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
  });

  if (panels.length === 0) {
    const panel = await prisma.panel.create({
      data: {
        id: generateEntityId(),
        projectId,
        name: "Панель 1",
        sortOrder: 0,
      },
    });

    await prisma.part.updateMany({
      where: { projectId, panelId: null },
      data: { panelId: panel.id },
    });

    await prisma.cutPlan.updateMany({
      where: { projectId, panelId: null },
      data: { panelId: panel.id },
    });

    return [panel];
  }

  const defaultPanelId = panels[0]!.id;

  await prisma.part.updateMany({
    where: { projectId, panelId: null },
    data: { panelId: defaultPanelId },
  });

  await prisma.cutPlan.updateMany({
    where: { projectId, panelId: null },
    data: { panelId: defaultPanelId },
  });

  return panels;
}
