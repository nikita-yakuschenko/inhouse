import type { ProjectStatus } from "@/app/generated/prisma/client";
import { countUniqueWallMarks } from "@/lib/parts/part-marking";
import type { ProjectTechnologyValue } from "@/lib/projects/technology";

export type ProjectListRow = {
  id: string;
  name: string;
  contractNumber: string | null;
  technology: ProjectTechnologyValue | null;
  status: ProjectStatus;
  panelsCount: number;
  partsCount: number;
  partsQuantity: number;
  updatedAt: string;
};

type ProjectForList = {
  id: string;
  name: string;
  contractNumber: string | null;
  technology: ProjectTechnologyValue | null;
  status: ProjectStatus;
  updatedAt: Date;
  panels: {
    parts: { name: string; code: string | null; quantity: number }[];
  }[];
};

export function serializeProjectListRows(projects: ProjectForList[]): ProjectListRow[] {
  return projects.map((project) => {
    const parts = project.panels.flatMap((panel) => panel.parts);

    return {
      id: project.id,
      name: project.name,
      contractNumber: project.contractNumber,
      technology: project.technology,
      status: project.status,
      // Уникальные марки стен из кодов деталей, не число DB-панелей (их теперь 1).
      panelsCount: countUniqueWallMarks(parts),
      partsCount: parts.length,
      partsQuantity: parts.reduce((sum, part) => sum + part.quantity, 0),
      updatedAt: project.updatedAt.toISOString(),
    };
  });
}

export function formatProjectUpdatedAt(isoDate: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(isoDate));
}
