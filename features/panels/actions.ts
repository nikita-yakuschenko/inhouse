"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { ensurePanelsForProject } from "@/features/panels/ensure-panels";
import { entityIdSchema, generateEntityId } from "@/lib/id";

const createPanelSchema = z.object({
  projectId: entityIdSchema,
  name: z.string().min(1, "Укажите название панели"),
});

export async function createPanelAction(formData: FormData) {
  const parsed = createPanelSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные панели");
  }

  const panels = await ensurePanelsForProject(parsed.data.projectId);
  const nextOrder = panels.length;

  const panel = await prisma.panel.create({
    data: {
      id: generateEntityId(),
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      sortOrder: nextOrder,
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
  return panel.id;
}

export async function deletePanelAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const panelId = String(formData.get("panelId") ?? "");

  if (!projectId || !panelId) {
    throw new Error("Не удалось удалить панель");
  }

  const panels = await prisma.panel.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
  });

  if (panels.length <= 1) {
    throw new Error("Нельзя удалить единственную панель проекта");
  }

  const fallbackPanel = panels.find((panel) => panel.id !== panelId);
  if (!fallbackPanel) {
    throw new Error("Не удалось удалить панель");
  }

  await prisma.$transaction([
    prisma.part.updateMany({
      where: { panelId },
      data: { panelId: fallbackPanel.id },
    }),
    prisma.panel.delete({ where: { id: panelId } }),
  ]);

  revalidatePath(`/projects/${projectId}`);
}
