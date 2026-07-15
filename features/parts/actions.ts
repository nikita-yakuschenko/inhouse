"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { entityIdSchema, generateEntityId, generateEntityIds } from "@/lib/id";
import { countUniqueWallMarks } from "@/lib/parts/part-marking";
import { parseSpecificationXlsx } from "@/lib/parts/parse-specification-xlsx";

const partSchema = z.object({
  projectId: entityIdSchema,
  panelId: entityIdSchema,
  name: z.string().min(1, "Укажите название детали"),
  code: z.string().optional(),
  widthMm: z.coerce.number().int().positive(),
  heightMm: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
  allowRotation: z.coerce.boolean().optional(),
});

export async function createPartAction(formData: FormData) {
  const parsed = partSchema.safeParse({
    projectId: formData.get("projectId"),
    panelId: formData.get("panelId"),
    name: formData.get("name"),
    code: formData.get("code") || undefined,
    widthMm: formData.get("widthMm"),
    heightMm: formData.get("heightMm"),
    quantity: formData.get("quantity") || 1,
    allowRotation:
      formData.get("allowRotation") === null
        ? true
        : formData.get("allowRotation") === "on" ||
          formData.get("allowRotation") === "true",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные детали");
  }

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: parsed.data.projectId },
  });

  await prisma.part.create({
    data: {
      id: generateEntityId(),
      projectId: parsed.data.projectId,
      panelId: parsed.data.panelId,
      materialId: project.materialId,
      sheetFormatId: project.sheetFormatId,
      name: parsed.data.name,
      code: parsed.data.code,
      widthMm: parsed.data.widthMm,
      heightMm: parsed.data.heightMm,
      quantity: parsed.data.quantity,
      // Поворот по умолчанию — иначе раскрой часто остаётся «лёжа» и растёт число резов
      allowRotation: parsed.data.allowRotation ?? true,
      shapeType: "rectangle",
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
}

const importPartsSchema = z.object({
  projectId: entityIdSchema,
});

export async function importPartsFromXlsxAction(formData: FormData) {
  const parsed = importPartsSchema.safeParse({
    projectId: formData.get("projectId"),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные импорта",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false as const, error: "Выберите файл Excel (.xlsx, .xls)" };
  }

  try {
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: parsed.data.projectId },
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const importedParts = parseSpecificationXlsx(buffer);

    // Одна панель на проект: марка стены живёт в коде детали (Ст-1-02-01), не в табах.
    const existingPanels = await prisma.panel.findMany({
      where: { projectId: parsed.data.projectId },
      orderBy: { sortOrder: "asc" },
    });

    let panelId = existingPanels[0]?.id;
    if (!panelId) {
      panelId = generateEntityId();
      await prisma.panel.create({
        data: {
          id: panelId,
          projectId: parsed.data.projectId,
          name: "Спецификация",
          code: null,
          sortOrder: 0,
        },
      });
    } else {
      await prisma.panel.update({
        where: { id: panelId },
        data: { name: "Спецификация", code: null },
      });
    }

    // Сброс старых раскроев и деталей по всему проекту.
    await prisma.cutPlan.deleteMany({ where: { projectId: parsed.data.projectId } });
    await prisma.part.deleteMany({ where: { projectId: parsed.data.projectId } });

    // Лишние панели (бывшие Ст-1-0x) убираем — оставляем одну.
    if (existingPanels.length > 1) {
      await prisma.panel.deleteMany({
        where: {
          projectId: parsed.data.projectId,
          id: { not: panelId },
        },
      });
    }

    const ids = generateEntityIds(importedParts.length);
    await prisma.part.createMany({
      data: importedParts.map((part, index) => ({
        id: ids[index]!,
        projectId: parsed.data.projectId,
        panelId,
        materialId: project.materialId,
        sheetFormatId: project.sheetFormatId,
        name: part.name,
        code: part.code,
        widthMm: part.widthMm,
        heightMm: part.heightMm,
        quantity: part.quantity,
        allowRotation: true,
        shapeType: "rectangle",
      })),
    });

    revalidatePath(`/projects/${parsed.data.projectId}`);
    return {
      ok: true as const,
      importedCount: importedParts.length,
      panelsCount: countUniqueWallMarks(importedParts),
    };
  } catch (error) {
    console.error("importPartsFromXlsxAction failed", error);
    const message =
      error instanceof Error ? error.message : "Не удалось загрузить спецификацию";
    return { ok: false as const, error: message };
  }
}

export async function deletePartAction(formData: FormData) {
  const partId = String(formData.get("partId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");

  if (!partId || !projectId) {
    throw new Error("Не удалось удалить деталь");
  }

  await prisma.part.delete({ where: { id: partId } });
  revalidatePath(`/projects/${projectId}`);
}
