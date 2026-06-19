"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { entityIdSchema, generateEntityId } from "@/lib/id";

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
    allowRotation: formData.get("allowRotation") === "on",
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
      allowRotation: parsed.data.allowRotation ?? true,
      shapeType: "rectangle",
    },
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
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
