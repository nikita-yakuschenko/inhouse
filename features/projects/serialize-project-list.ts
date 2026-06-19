import type { ProjectStatus } from "@/app/generated/prisma/client";

export type ProjectListRow = {
  id: string;
  name: string;
  status: ProjectStatus;
  panelsCount: number;
  partsCount: number;
  partsQuantity: number;
  updatedAt: string;
};

type ProjectForList = {
  id: string;
  name: string;
  status: ProjectStatus;
  updatedAt: Date;
  panels: {
    parts: { quantity: number }[];
  }[];
};

export function serializeProjectListRows(projects: ProjectForList[]): ProjectListRow[] {
  return projects.map((project) => {
    const parts = project.panels.flatMap((panel) => panel.parts);

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      panelsCount: project.panels.length,
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
