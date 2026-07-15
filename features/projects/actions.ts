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

    // Станок: из формы или дефолт из справочника; материал — позже в проекте.
    let machineProfileId = parsed.data.machineProfileId ?? null;
    if (!machineProfileId) {
      const defaultMachine = await prisma.machineProfile.findFirst({
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true },
      });
      machineProfileId = defaultMachine?.id ?? null;
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
        materialId: null,
        sheetFormatId: null,
        machineProfileId,
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
  sheetFormatId: entityIdSchema.optional().nullable(),
  machineProfileId: entityIdSchema.optional().nullable(),
});

export async function updateProjectAction(input: {
  projectId: string;
  name: string;
  contractNumber: string;
  technology?: string | null;
  sheetFormatId?: string | null;
  machineProfileId?: string | null;
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
      select: {
        kind: true,
        sheetFormatId: true,
        machineProfileId: true,
        panels: {
          select: {
            cutPlans: { take: 1, select: { id: true } },
          },
        },
      },
    });
    if (!existing) {
      return { ok: false as const, error: "Проект не найден" };
    }
    if (existing.kind === "sheet" && !parsed.data.technology) {
      return { ok: false as const, error: "Выберите технологию" };
    }

    let nextMaterialId: string | null | undefined;
    let nextSheetFormatId: string | null | undefined;
    if (existing.kind === "sheet" && parsed.data.sheetFormatId !== undefined) {
      if (parsed.data.sheetFormatId === null) {
        nextMaterialId = null;
        nextSheetFormatId = null;
      } else {
        const sheet = await prisma.sheetFormat.findUnique({
          where: { id: parsed.data.sheetFormatId },
          select: { id: true, materialId: true, isActive: true },
        });
        if (!sheet || !sheet.isActive) {
          return { ok: false as const, error: "Материал не найден в справочнике" };
        }
        nextMaterialId = sheet.materialId;
        nextSheetFormatId = sheet.id;
      }
    }

    if (existing.kind === "sheet" && parsed.data.machineProfileId) {
      const machine = await prisma.machineProfile.findUnique({
        where: { id: parsed.data.machineProfileId },
        select: { id: true, isActive: true },
      });
      if (!machine || !machine.isActive) {
        return { ok: false as const, error: "Станок не найден в справочнике" };
      }
    }

    const materialChanged =
      nextSheetFormatId !== undefined &&
      nextSheetFormatId !== existing.sheetFormatId;
    const machineChanged =
      parsed.data.machineProfileId !== undefined &&
      parsed.data.machineProfileId !== null &&
      parsed.data.machineProfileId !== existing.machineProfileId;
    const hasCutPlan = existing.panels.some((p) => p.cutPlans.length > 0);
    const afterSheetFormatId =
      nextSheetFormatId !== undefined
        ? nextSheetFormatId
        : existing.sheetFormatId;
    const afterMachineId = machineChanged
      ? parsed.data.machineProfileId!
      : existing.machineProfileId;
    const shouldRecalculate =
      existing.kind === "sheet" &&
      hasCutPlan &&
      (materialChanged || machineChanged) &&
      Boolean(afterSheetFormatId) &&
      Boolean(afterMachineId);

    const project = await prisma.project.update({
      where: { id: parsed.data.projectId },
      data: {
        name: parsed.data.name,
        contractNumber: parsed.data.contractNumber,
        ...(existing.kind === "sheet" && parsed.data.technology
          ? { technology: parsed.data.technology }
          : {}),
        ...(nextSheetFormatId !== undefined
          ? {
              sheetFormatId: nextSheetFormatId,
              materialId: nextMaterialId ?? null,
            }
          : {}),
        ...(existing.kind === "sheet" &&
        parsed.data.machineProfileId !== undefined &&
        parsed.data.machineProfileId !== null
          ? { machineProfileId: parsed.data.machineProfileId }
          : {}),
      },
      select: {
        id: true,
        name: true,
        contractNumber: true,
        technology: true,
        sheetFormatId: true,
        materialId: true,
        machineProfileId: true,
      },
    });

    if (materialChanged) {
      await prisma.part.updateMany({
        where: { projectId: project.id },
        data: {
          sheetFormatId: project.sheetFormatId,
          materialId: project.materialId,
        },
      });
    }

    let recalculated = false;
    if (shouldRecalculate) {
      const { calculateProject } = await import("@/features/cut-plans/service");
      await calculateProject(project.id);
      recalculated = true;
    }

    revalidatePath("/");
    revalidatePath("/operator");
    revalidatePath(`/projects/${project.id}`);
    return {
      ok: true as const,
      name: project.name,
      contractNumber: project.contractNumber,
      technology: project.technology,
      sheetFormatId: project.sheetFormatId,
      materialId: project.materialId,
      machineProfileId: project.machineProfileId,
      recalculated,
    };
  } catch (error) {
    console.error("updateProjectAction failed", error);
    return { ok: false as const, error: "Не удалось сохранить расчёт" };
  }
}

/** Смена материала и/или станка с автопересчётом, если раскрой уже есть. */
export async function updateProjectCuttingSetupAction(input: {
  projectId: string;
  sheetFormatId?: string | null;
  machineProfileId?: string | null;
}) {
  const parsed = z
    .object({
      projectId: entityIdSchema,
      sheetFormatId: entityIdSchema.optional().nullable(),
      machineProfileId: entityIdSchema.optional().nullable(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
    };
  }

  try {
    const existing = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: {
        kind: true,
        name: true,
        contractNumber: true,
        technology: true,
        sheetFormatId: true,
        machineProfileId: true,
        panels: {
          select: { cutPlans: { take: 1, select: { id: true } } },
        },
      },
    });

    if (!existing) {
      return { ok: false as const, error: "Проект не найден" };
    }
    if (existing.kind !== "sheet") {
      return { ok: false as const, error: "Доступно только для плитного раскроя" };
    }
    if (!existing.contractNumber) {
      return { ok: false as const, error: "Укажите номер договора в настройках расчёта" };
    }
    if (!existing.technology) {
      return { ok: false as const, error: "Укажите технологию в настройках расчёта" };
    }

    return updateProjectAction({
      projectId: parsed.data.projectId,
      name: existing.name,
      contractNumber: existing.contractNumber,
      technology: existing.technology,
      sheetFormatId: parsed.data.sheetFormatId,
      machineProfileId: parsed.data.machineProfileId,
    });
  } catch (error) {
    console.error("updateProjectCuttingSetupAction failed", error);
    return { ok: false as const, error: "Не удалось сохранить настройки раскроя" };
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
