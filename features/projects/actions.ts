"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { entityIdSchema, generateEntityId } from "@/lib/id";
import { SEED_IDS } from "@/lib/seed-ids";

const createProjectSchema = z.object({
  name: z.string().min(1, "Укажите название проекта"),
  description: z.string().optional(),
  customerName: z.string().optional(),
  materialId: entityIdSchema,
  sheetFormatId: entityIdSchema,
  machineProfileId: entityIdSchema,
});

export async function createProjectAction(formData: FormData) {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    customerName: formData.get("customerName") || undefined,
    materialId: formData.get("materialId"),
    sheetFormatId: formData.get("sheetFormatId"),
    machineProfileId: formData.get("machineProfileId"),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные проекта",
    };
  }

  try {
    const projectId = generateEntityId();
    const panelId = generateEntityId();

    const project = await prisma.project.create({
      data: {
        id: projectId,
        organizationId: SEED_IDS.organization,
        name: parsed.data.name,
        description: parsed.data.description,
        customerName: parsed.data.customerName,
        materialId: parsed.data.materialId,
        sheetFormatId: parsed.data.sheetFormatId,
        machineProfileId: parsed.data.machineProfileId,
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
    });

    revalidatePath("/");
    return {
      ok: true as const,
      projectId: project.id,
      name: project.name,
    };
  } catch (error) {
    console.error("createProjectAction failed", error);
    return { ok: false as const, error: "Не удалось создать проект" };
  }
}

export async function deleteProjectAction(projectId: string) {
  const parsed = entityIdSchema.safeParse(projectId);
  if (!parsed.success) {
    return { ok: false as const, error: "Некорректный идентификатор проекта" };
  }

  try {
    await prisma.project.delete({ where: { id: parsed.data } });
    revalidatePath("/");
    revalidatePath("/operator");
    return { ok: true as const };
  } catch (error) {
    console.error("deleteProjectAction failed", error);
    return { ok: false as const, error: "Не удалось удалить проект" };
  }
}
