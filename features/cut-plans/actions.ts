"use server";

import { revalidatePath } from "next/cache";
import { calculatePanel, calculateProject } from "@/features/cut-plans/service";

export async function calculatePanelAction(projectId: string, panelId: string) {
  const cutPlanId = await calculatePanel(panelId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/operator/projects/${projectId}`);
  revalidatePath("/operator");
  return cutPlanId;
}

export async function calculateProjectAction(projectId: string) {
  const cutPlanId = await calculateProject(projectId);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/operator/projects/${projectId}`);
  revalidatePath("/operator");
  return cutPlanId;
}
