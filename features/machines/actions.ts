"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/db/prisma";
import { generateEntityId } from "@/lib/id";
import { SEED_IDS } from "@/lib/seed-ids";

const entityIdSchema = z.string().regex(/^[0-9A-Z]{8}$/, "Некорректный идентификатор");

function parseMmNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return value;
  return value.trim().replace(",", ".");
}

const machineFieldsSchema = z.object({
  name: z.string().trim().min(1, "Укажите название станка"),
  defaultKerfMm: z.coerce
    .number()
    .min(0, "Пропил не может быть отрицательным")
    .max(20, "Пропил слишком большой"),
});

function revalidateMachinePaths() {
  revalidatePath("/");
  revalidatePath("/settings/equipment");
  revalidatePath("/settings/cutting");
  revalidatePath("/catalog/machines");
}

export async function createMachineProfileAction(formData: FormData) {
  const parsed = machineFieldsSchema.safeParse({
    name: formData.get("name"),
    defaultKerfMm: parseMmNumber(formData.get("defaultKerfMm")),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные оборудования",
    };
  }

  const { name, defaultKerfMm } = parsed.data;

  try {
    const existingCount = await prisma.machineProfile.count({
      where: { isActive: true },
    });

    const id = generateEntityId();
    await prisma.machineProfile.create({
      data: {
        id,
        organizationId: SEED_IDS.organization,
        name,
        machineType: "vertical_panel_saw",
        maxSheetWidthMm: 3800,
        maxSheetHeightMm: 2200,
        maxSheetThicknessMm: 60,
        defaultKerfMm,
        minSafePartWidthMm: 80,
        minSafePartHeightMm: 80,
        minUsefulOffcutWidthMm: 300,
        minUsefulOffcutHeightMm: 300,
        preferredPrimaryAxis: "auto",
        coordinateOrigin: "bottom_left",
        isDefault: existingCount === 0,
        isActive: true,
      },
    });

    revalidateMachinePaths();
    return { ok: true as const, id, name };
  } catch (error) {
    console.error("createMachineProfileAction failed", error);
    return { ok: false as const, error: "Не удалось добавить оборудование" };
  }
}

export async function updateMachineProfileAction(formData: FormData) {
  const parsed = machineFieldsSchema
    .extend({ id: entityIdSchema })
    .safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      defaultKerfMm: parseMmNumber(formData.get("defaultKerfMm")),
    });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные параметры станка",
    };
  }

  const data = parsed.data;

  try {
    const existing = await prisma.machineProfile.findUnique({
      where: { id: data.id },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false as const, error: "Оборудование не найдено" };
    }

    await prisma.machineProfile.update({
      where: { id: data.id },
      data: {
        name: data.name,
        defaultKerfMm: data.defaultKerfMm,
      },
    });

    revalidateMachinePaths();
    return { ok: true as const, name: data.name };
  } catch (error) {
    console.error("updateMachineProfileAction failed", error);
    return { ok: false as const, error: "Не удалось сохранить оборудование" };
  }
}

export async function deleteMachineProfileAction(machineId: string) {
  if (!entityIdSchema.safeParse(machineId).success) {
    return { ok: false as const, error: "Некорректный идентификатор" };
  }

  try {
    const machine = await prisma.machineProfile.findUnique({
      where: { id: machineId },
      select: { id: true, name: true, isDefault: true },
    });

    if (!machine) {
      return { ok: false as const, error: "Оборудование не найдено" };
    }

    const [projectsCount, cutPlansCount] = await Promise.all([
      prisma.project.count({ where: { machineProfileId: machineId } }),
      prisma.cutPlan.count({ where: { machineProfileId: machineId } }),
    ]);

    if (projectsCount > 0 || cutPlansCount > 0) {
      return {
        ok: false as const,
        error: "Станок используется в расчётах — смените его в проектах",
      };
    }

    await prisma.machineProfile.delete({ where: { id: machineId } });

    if (machine.isDefault) {
      const next = await prisma.machineProfile.findFirst({
        where: { isActive: true },
        orderBy: { name: "asc" },
      });
      if (next) {
        await prisma.machineProfile.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    revalidateMachinePaths();
    return { ok: true as const, name: machine.name };
  } catch (error) {
    console.error("deleteMachineProfileAction failed", error);
    return { ok: false as const, error: "Не удалось удалить оборудование" };
  }
}
