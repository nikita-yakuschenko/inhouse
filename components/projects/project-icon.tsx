import type { ComponentType } from "react";
import {
  IconFreezeColumn,
  IconFreezeRow,
  IconFreezeRowColumn,
  type IconProps,
} from "@tabler/icons-react";

import { cn } from "@/lib/utils";

const PROJECT_ICON_COMPONENTS = [
  IconFreezeRowColumn,
  IconFreezeColumn,
  IconFreezeRow,
] as const;

/** Мягкий пул цветов — спокойные, различимые, без «AI-purple». */
const PROJECT_ICON_COLORS = [
  "text-teal-600 dark:text-teal-400",
  "text-sky-600 dark:text-sky-400",
  "text-emerald-600 dark:text-emerald-400",
  "text-cyan-600 dark:text-cyan-400",
  "text-blue-600 dark:text-blue-400",
  "text-amber-600 dark:text-amber-400",
  "text-orange-600 dark:text-orange-400",
  "text-rose-600 dark:text-rose-400",
  "text-lime-600 dark:text-lime-400",
  "text-indigo-600 dark:text-indigo-400",
] as const;

function hashProjectId(projectId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < projectId.length; i++) {
    hash ^= projectId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getProjectIconVisual(projectId: string): {
  Icon: ComponentType<IconProps>;
  colorClassName: string;
} {
  const hash = hashProjectId(projectId);
  return {
    Icon: PROJECT_ICON_COMPONENTS[hash % PROJECT_ICON_COMPONENTS.length],
    colorClassName:
      PROJECT_ICON_COLORS[(hash >>> 8) % PROJECT_ICON_COLORS.length],
  };
}

export function ProjectIcon({
  projectId,
  className,
  stroke = 1.75,
}: {
  projectId: string;
  className?: string;
  stroke?: number;
}) {
  const { Icon, colorClassName } = getProjectIconVisual(projectId);
  return <Icon className={cn(colorClassName, className)} stroke={stroke} />;
}
