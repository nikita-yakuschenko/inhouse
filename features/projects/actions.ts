"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { entityIdSchema, generateEntityId } from "@/lib/id";
import { PROJECT_TECHNOLOGY_VALUES } from "@/lib/projects/technology";
import { SEED_IDS } from "@/lib/seed-ids";

const technologySchema = z.enum(PROJECT_TECHNOLOGY_VALUES, {
  message: "Выберите технологию",
});

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Укажите заводской номер домокомплекта"),
  contractNumber: z.string().trim().min(1, "Укажите номер договора"),
  technology: technologySchema,
  description: z.string().optional(),
  customerName: z.string().optional(),
  materialId: entityIdSchema,
  sheetFormatId: entityIdSchema,
  machineProfileId: entityIdSchema,
});

export async function createProjectAction(formData: FormData) {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    contractNumber: formData.get("contractNumber"),
    technology: formData.get("technology"),
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
        contractNumber: parsed.data.contractNumber,
        technology: parsed.data.technology,
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

const updateProjectSchema = z.object({
  projectId: entityIdSchema,
  name: z
    .string()
    .trim()
    .min(1, "Укажите заводской номер домокомплекта")
    .max(120, "Слишком длинный заводской номер"),
  contractNumber: z
    .string()
    .trim()
    .min(1, "Укажите номер договора")
    .max(120, "Слишком длинный номер договора"),
  technology: technologySchema,
});

export async function updateProjectAction(input: {
  projectId: string;
  name: string;
  contractNumber: string;
  technology: string;
}) {
  const parsed = updateProjectSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
    };
  }

  try {
    const project = await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: {
        name: parsed.data.name,
        contractNumber: parsed.data.contractNumber,
        technology: parsed.data.technology,
      },
      select: {
        id: true,
        name: true,
        contractNumber: true,
        technology: true,
      },
    });

    revalidatePath("/");
    revalidatePath("/operator");
    revalidatePath(`/projects/${project.id}`);
    return {
      ok: true as const,
      name: project.name,
      contractNumber: project.contractNumber,
      technology: project.technology,
    };
  } catch (error) {
    console.error("updateProjectAction failed", error);
    return { ok: false as const, error: "Не удалось сохранить расчёт" };
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
