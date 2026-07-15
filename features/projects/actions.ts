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
  kind: z.enum(["sheet", "bar"]).default("sheet"),
  technology: technologySchema.optional(),
  description: z.string().optional(),
  customerName: z.string().optional(),
  materialId: entityIdSchema.optional(),
  sheetFormatId: entityIdSchema.optional(),
  machineProfileId: entityIdSchema.optional(),
});

export async function createProjectAction(formData: FormData) {
  const kindRaw = String(formData.get("kind") ?? "sheet");
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    contractNumber: formData.get("contractNumber"),
    kind: kindRaw === "bar" ? "bar" : "sheet",
    technology: formData.get("technology") || undefined,
    description: formData.get("description") || undefined,
    customerName: formData.get("customerName") || undefined,
    materialId: formData.get("materialId") || undefined,
    sheetFormatId: formData.get("sheetFormatId") || undefined,
    machineProfileId: formData.get("machineProfileId") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные проекта",
    };
  }

  const kind = parsed.data.kind;

  if (kind === "sheet") {
    if (!parsed.data.technology) {
      return { ok: false as const, error: "Выберите технологию" };
    }
    if (
      !parsed.data.materialId ||
      !parsed.data.sheetFormatId ||
      !parsed.data.machineProfileId
    ) {
      return {
        ok: false as const,
        error: "Выберите материал, формат листа и станок",
      };
    }
  }

  try {
    const projectId = generateEntityId();

    if (kind === "bar") {
      const stockId = generateEntityId();
      const project = await prisma.project.create({
        data: {
          id: projectId,
          organizationId: SEED_IDS.organization,
          name: parsed.data.name,
          contractNumber: parsed.data.contractNumber,
          description: parsed.data.description,
          customerName: parsed.data.customerName,
          kind: "bar",
          status: "draft",
          mode: "production",
          barKerfMm: 0,
          barApplyMiter: true,
          barStocks: {
            create: {
              id: stockId,
              lengthMm: 6000,
              quantity: null,
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
    }

    const panelId = generateEntityId();
    const project = await prisma.project.create({
      data: {
        id: projectId,
        organizationId: SEED_IDS.organization,
        name: parsed.data.name,
        contractNumber: parsed.data.contractNumber,
        technology: parsed.data.technology!,
        kind: "sheet",
        description: parsed.data.description,
        customerName: parsed.data.customerName,
        materialId: parsed.data.materialId!,
        sheetFormatId: parsed.data.sheetFormatId!,
        machineProfileId: parsed.data.machineProfileId!,
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
    .min(1, "Укажите название или заводской номер")
    .max(120, "Слишком длинное название"),
  contractNumber: z
    .string()
    .trim()
    .min(1, "Укажите номер договора")
    .max(120, "Слишком длинный номер договора"),
  technology: technologySchema.optional().nullable(),
});

export async function updateProjectAction(input: {
  projectId: string;
  name: string;
  contractNumber: string;
  technology?: string | null;
}) {
  const parsed = updateProjectSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
    };
  }

  try {
    const existing = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { kind: true },
    });
    if (!existing) {
      return { ok: false as const, error: "Проект не найден" };
    }
    if (existing.kind === "sheet" && !parsed.data.technology) {
      return { ok: false as const, error: "Выберите технологию" };
    }

    const project = await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: {
        name: parsed.data.name,
        contractNumber: parsed.data.contractNumber,
        ...(existing.kind === "sheet" && parsed.data.technology
          ? { technology: parsed.data.technology }
          : {}),
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
