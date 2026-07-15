"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/db/prisma";
import { generateEntityId } from "@/lib/id";
import { SEED_IDS } from "@/lib/seed-ids";

const entityIdSchema = z.string().regex(/^[0-9A-Z]{8}$/, "Некорректный идентификатор");

/** «3,5» / «3.5» → Decimal (строковый конструктор, без float). */
function parseKerfMm(raw: FormDataEntryValue | null): Prisma.Decimal | null {
  if (raw == null) return null;
  const text = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  try {
    const value = new Prisma.Decimal(text);
    if (value.isNeg() || value.gt(20)) return null;
    return value;
  } catch {
    return null;
  }
}

function formatKerfResult(value: Prisma.Decimal): string {
  return value.toString();
}

function revalidateMachinePaths() {
  try {
    revalidatePath("/");
    revalidatePath("/settings/equipment");
    revalidatePath("/settings/cutting");
    revalidatePath("/catalog/machines");
  } catch (error) {
    console.error("revalidateMachinePaths failed", error);
  }
}

const nameSchema = z.string().trim().min(1, "Укажите название станка");

export async function createMachineProfileAction(formData: FormData) {
  const nameParsed = nameSchema.safeParse(formData.get("name"));
  const kerfRaw = formData.get("defaultKerfMm");
  const kerf = parseKerfMm(kerfRaw);

  if (!nameParsed.success) {
    return { ok: false as const, error: nameParsed.error.issues[0]?.message ?? "Некорректное название" };
  }
  if (!kerf) {
    return {
      ok: false as const,
      error: `Укажите ширину пропила числом, например 3,5 (получено: «${String(kerfRaw ?? "")}»)`,
    };
  }

  const name = nameParsed.data;

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
        defaultKerfMm: kerf,
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
    return { ok: true as const, id, name, kerfMm: formatKerfResult(kerf) };
  } catch (error) {
    console.error("createMachineProfileAction failed", error);
    return { ok: false as const, error: "Не удалось добавить оборудование" };
  }
}

export async function updateMachineProfileAction(formData: FormData) {
  const idParsed = entityIdSchema.safeParse(formData.get("id"));
  const nameParsed = nameSchema.safeParse(formData.get("name"));
  const kerfRaw = formData.get("defaultKerfMm");
  const kerf = parseKerfMm(kerfRaw);

  console.info("[updateMachineProfileAction] raw kerf:", JSON.stringify(kerfRaw), "→", kerf?.toString());

  if (!idParsed.success) {
    return { ok: false as const, error: "Некорректный идентификатор" };
  }
  if (!nameParsed.success) {
    return { ok: false as const, error: nameParsed.error.issues[0]?.message ?? "Некорректное название" };
  }
  if (!kerf) {
    return {
      ok: false as const,
      error: `Укажите ширину пропила числом, например 3,5 (получено: «${String(kerfRaw ?? "")}»)`,
    };
  }

  const id = idParsed.data;
  const name = nameParsed.data;

  try {
    const existing = await prisma.machineProfile.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false as const, error: "Оборудование не найдено" };
    }

    await prisma.machineProfile.update({
      where: { id },
      data: {
        name,
        defaultKerfMm: kerf,
      },
    });

    const saved = await prisma.machineProfile.findUnique({
      where: { id },
      select: { defaultKerfMm: true },
    });

    revalidateMachinePaths();
    return {
      ok: true as const,
      name,
      kerfMm: formatKerfResult(saved?.defaultKerfMm ?? kerf),
    };
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
