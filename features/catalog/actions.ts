"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/db/prisma";
import { generateEntityId } from "@/lib/id";
import { SEED_IDS } from "@/lib/seed-ids";

const materialSchema = z.object({
  name: z.string().trim().min(1, "Укажите название материала"),
  thicknessMm: z.coerce.number().int().positive("Толщина должна быть больше 0"),
  materialType: z.string().trim().min(1).default("sheet"),
  defaultSheetWidthMm: z.coerce.number().int().positive().optional(),
  defaultSheetHeightMm: z.coerce.number().int().positive().optional(),
});

const sheetFormatSchema = z.object({
  materialId: z.string().length(8),
  name: z.string().trim().optional(),
  widthMm: z.coerce.number().int().positive("Ширина должна быть больше 0"),
  heightMm: z.coerce.number().int().positive("Высота должна быть больше 0"),
  thicknessMm: z.coerce.number().int().positive().optional(),
});

export async function createMaterialAction(formData: FormData) {
  const parsed = materialSchema.safeParse({
    name: formData.get("name"),
    thicknessMm: formData.get("thicknessMm"),
    materialType: formData.get("materialType") || "sheet",
    defaultSheetWidthMm: formData.get("defaultSheetWidthMm") || undefined,
    defaultSheetHeightMm: formData.get("defaultSheetHeightMm") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные материала",
    };
  }

  try {
    const material = await prisma.material.create({
      data: {
        id: generateEntityId(),
        organizationId: SEED_IDS.organization,
        name: parsed.data.name,
        materialType: parsed.data.materialType,
        thicknessMm: parsed.data.thicknessMm,
        defaultSheetWidthMm: parsed.data.defaultSheetWidthMm,
        defaultSheetHeightMm: parsed.data.defaultSheetHeightMm,
        hasGrainDirection: false,
        isActive: true,
      },
    });

    revalidatePath("/");
    revalidatePath("/catalog/materials");
    revalidatePath("/catalog/sheets");
    return { ok: true as const, id: material.id, name: material.name };
  } catch (error) {
    console.error("createMaterialAction failed", error);
    return { ok: false as const, error: "Не удалось создать материал" };
  }
}

export async function createSheetFormatAction(formData: FormData) {
  const parsed = sheetFormatSchema.safeParse({
    materialId: formData.get("materialId"),
    name: formData.get("name") || undefined,
    widthMm: formData.get("widthMm"),
    heightMm: formData.get("heightMm"),
    thicknessMm: formData.get("thicknessMm") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные формата",
    };
  }

  try {
    const material = await prisma.material.findUniqueOrThrow({
      where: { id: parsed.data.materialId },
    });

    const thicknessMm = parsed.data.thicknessMm ?? material.thicknessMm;
    const name =
      parsed.data.name?.trim() ||
      `${parsed.data.widthMm}×${parsed.data.heightMm}`;

    const sheetFormat = await prisma.sheetFormat.create({
      data: {
        id: generateEntityId(),
        organizationId: SEED_IDS.organization,
        materialId: material.id,
        name,
        widthMm: parsed.data.widthMm,
        heightMm: parsed.data.heightMm,
        thicknessMm,
        trimLeftMm: 0,
        trimRightMm: 0,
        trimTopMm: 0,
        trimBottomMm: 0,
        isDefault: false,
        isActive: true,
      },
    });

    revalidatePath("/");
    revalidatePath("/catalog/materials");
    revalidatePath("/catalog/sheets");
    return { ok: true as const, id: sheetFormat.id, name: sheetFormat.name };
  } catch (error) {
    console.error("createSheetFormatAction failed", error);
    return { ok: false as const, error: "Не удалось создать формат листа" };
  }
}
