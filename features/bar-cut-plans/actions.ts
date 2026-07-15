"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { calculateBarProject } from "@/features/bar-cut-plans/service";
import prisma from "@/lib/db/prisma";
import { entityIdSchema, generateEntityId } from "@/lib/id";

const projectIdSchema = z.object({ projectId: entityIdSchema });

const segmentInputSchema = z.object({
  id: entityIdSchema.optional(),
  label: z.string(),
  outerMm: z.number().int().positive(),
  innerMm: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().positive(),
  colorIndex: z.number().int().min(0).optional(),
  material: z.string().nullable().optional(),
});

const stockInputSchema = z.object({
  id: entityIdSchema.optional(),
  lengthMm: z.number().int().positive(),
  quantity: z.number().int().positive().nullable(),
  name: z.string().nullable().optional(),
  priority: z.number().int().optional(),
  material: z.string().nullable().optional(),
  cost: z.number().nullable().optional(),
});

const saveWorkspaceSchema = z.object({
  projectId: entityIdSchema,
  kerfMm: z.number().min(0),
  applyMiter: z.boolean(),
  segments: z.array(segmentInputSchema),
  stocks: z.array(stockInputSchema).min(1),
});

export async function saveBarWorkspaceAction(input: unknown) {
  const parsed = saveWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Некорректные данные",
    };
  }

  const { projectId, kerfMm, applyMiter, segments, stocks } = parsed.data;

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.kind !== "bar") {
    return { ok: false as const, error: "Проект погонажа не найден" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.barSegment.deleteMany({ where: { projectId } });
      await tx.barStock.deleteMany({ where: { projectId } });
      await tx.barCutPlan.deleteMany({ where: { projectId } });

      if (segments.length > 0) {
        await tx.barSegment.createMany({
          data: segments.map((s, index) => ({
            id: s.id ?? generateEntityId(),
            projectId,
            label: s.label,
            outerMm: s.outerMm,
            innerMm: s.innerMm ?? null,
            quantity: s.quantity,
            colorIndex: s.colorIndex ?? index % 8,
            material: s.material ?? null,
            sortOrder: index,
          })),
        });
      }

      await tx.barStock.createMany({
        data: stocks.map((s, index) => ({
          id: s.id ?? generateEntityId(),
          projectId,
          lengthMm: s.lengthMm,
          quantity: s.quantity,
          name: s.name ?? null,
          priority: s.priority ?? 0,
          material: s.material ?? null,
          cost: s.cost ?? null,
          sortOrder: index,
        })),
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          barKerfMm: kerfMm,
          barApplyMiter: applyMiter,
          status: "draft",
        },
      });
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/");
    return { ok: true as const };
  } catch (error) {
    console.error("saveBarWorkspaceAction failed", error);
    return { ok: false as const, error: "Не удалось сохранить данные" };
  }
}

export async function calculateBarProjectAction(projectId: string) {
  const parsed = projectIdSchema.safeParse({ projectId });
  if (!parsed.success) {
    return { ok: false as const, error: "Некорректный проект" };
  }

  const result = await calculateBarProject(parsed.data.projectId);
  if (!result.ok) {
    return result;
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/");
  return {
    ok: true as const,
    result: result.result,
    cutPlanId: result.cutPlanId,
  };
}

export async function saveAndCalculateBarProjectAction(input: unknown) {
  const saved = await saveBarWorkspaceAction(input);
  if (!saved.ok) return saved;

  const projectId =
    typeof input === "object" && input && "projectId" in input
      ? String((input as { projectId: string }).projectId)
      : "";

  return calculateBarProjectAction(projectId);
}
