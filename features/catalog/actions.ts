"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/db/prisma";
import { generateEntityId } from "@/lib/id";
import { SEED_IDS } from "@/lib/seed-ids";

/** Парсит мм с запятой или точкой: «12,5» → 12.5 */
function parseMmNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return value;
  return value.trim().replace(",", ".");
}

const sheetMaterialSchema = z.object({
  name: z.string().trim().min(1, "Укажите название материала"),
  thicknessMm: z.coerce
    .number()
    .positive("Толщина должна быть больше 0")
    .max(500, "Толщина слишком большая"),
  widthMm: z.coerce.number().int().positive("Ширина листа должна быть больше 0"),
  heightMm: z.coerce.number().int().positive("Высота листа должна быть больше 0"),
  materialType: z.string().trim().min(1).default("sheet"),
});

/** Один листовой материал со всеми характеристиками: название, толщина, размер листа. */
export async function createMaterialAction(formData: FormData) {
  const parsed = sheetMaterialSchema.safeParse({
    name: formData.get("name"),
    thicknessMm: parseMmNumber(formData.get("thicknessMm")),
    widthMm: formData.get("widthMm"),
    heightMm: formData.get("heightMm"),
    materialType: formData.get("materialType") || "sheet",
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные материала",
    };
  }

  const { name, thicknessMm, widthMm, heightMm, materialType } = parsed.data;
  const sheetName = `${widthMm}×${heightMm}`;

  try {
    const materialId = generateEntityId();
    const sheetFormatId = generateEntityId();

    await prisma.$transaction([
      prisma.material.create({
        data: {
          id: materialId,
          organizationId: SEED_IDS.organization,
          name,
          materialType,
          thicknessMm,
          defaultSheetWidthMm: widthMm,
          defaultSheetHeightMm: heightMm,
          hasGrainDirection: false,
          isActive: true,
        },
      }),
      prisma.sheetFormat.create({
        data: {
          id: sheetFormatId,
          organizationId: SEED_IDS.organization,
          materialId,
          name: sheetName,
          widthMm,
          heightMm,
          thicknessMm,
          trimLeftMm: 0,
          trimRightMm: 0,
          trimTopMm: 0,
          trimBottomMm: 0,
          isDefault: false,
          isActive: true,
        },
      }),
    ]);

    revalidatePath("/");
    revalidatePath("/catalog/materials");
    revalidatePath("/catalog/sheets");
    return {
      ok: true as const,
      id: materialId,
      name: `${name} · ${sheetName}×${thicknessMm}`,
    };
  } catch (error) {
    console.error("createMaterialAction failed", error);
    return { ok: false as const, error: "Не удалось создать материал" };
  }
}

export async function deleteMaterialAction(sheetFormatId: string) {
  if (!/^[0-9A-Z]{8}$/.test(sheetFormatId)) {
    return { ok: false as const, error: "Некорректный идентификатор материала" };
  }

  try {
    const sheet = await prisma.sheetFormat.findUnique({
      where: { id: sheetFormatId },
      select: { id: true, materialId: true, material: { select: { name: true } } },
    });

    if (!sheet) {
      return { ok: false as const, error: "Материал не найден" };
    }

    const [projectsCount, partsCount, cutPlanSheetsCount, offcutsCount] =
      await Promise.all([
      prisma.project.count({
        where: {
          OR: [
            { materialId: sheet.materialId },
            { sheetFormatId: sheet.id },
          ],
        },
      }),
      prisma.part.count({
        where: {
          OR: [
            { materialId: sheet.materialId },
            { sheetFormatId: sheet.id },
          ],
        },
      }),
      prisma.cutPlanSheet.count({
        where: {
          OR: [
            { materialId: sheet.materialId },
            { sourceSheetFormatId: sheet.id },
          ],
        },
      }),
      prisma.offcut.count({
        where: {
          OR: [
            { materialId: sheet.materialId },
            { sheetFormatId: sheet.id },
          ],
        },
      }),
    ]);

    if (
      projectsCount > 0 ||
      partsCount > 0 ||
      cutPlanSheetsCount > 0 ||
      offcutsCount > 0
    ) {
      return {
        ok: false as const,
        error: "Материал используется в расчётах — удалите или смените его в проектах",
      };
    }

    await prisma.$transaction([
      prisma.sheetFormat.delete({ where: { id: sheet.id } }),
      prisma.material.delete({ where: { id: sheet.materialId } }),
    ]);

    revalidatePath("/");
    revalidatePath("/catalog/materials");
    return { ok: true as const, name: sheet.material.name };
  } catch (error) {
    console.error("deleteMaterialAction failed", error);
    return { ok: false as const, error: "Не удалось удалить материал" };
  }
}
