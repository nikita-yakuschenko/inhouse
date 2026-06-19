"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { entityIdSchema, generateEntityId } from "@/lib/id";
import { SEED_IDS } from "@/lib/seed-ids";

const createProjectSchema = z.object({
  name: z.string().min(1, "Укажите название проекта"),
  description: z.string().optional(),
  customerName: z.string().optional(),
  materialId: entityIdSchema,
  sheetFormatId: entityIdSchema,
  machineProfileId: entityIdSchema,
});

export async function createProjectAction(formData: FormData) {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    customerName: formData.get("customerName") || undefined,
    materialId: formData.get("materialId"),
    sheetFormatId: formData.get("sheetFormatId"),
    machineProfileId: formData.get("machineProfileId"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Некорректные данные проекта");
  }

  const projectId = generateEntityId();
  const panelId = generateEntityId();

  const project = await prisma.project.create({
    data: {
      id: projectId,
      organizationId: SEED_IDS.organization,
      name: parsed.data.name,
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
  redirect(`/projects/${project.id}`);
}

export async function deleteProjectAction(projectId: string) {
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/");
  redirect("/");
}
