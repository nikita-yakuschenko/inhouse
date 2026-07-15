export const PROJECT_TECHNOLOGY_VALUES = ["pkd", "md"] as const;

export type ProjectTechnologyValue = (typeof PROJECT_TECHNOLOGY_VALUES)[number];

export const PROJECT_TECHNOLOGY_OPTIONS: {
  value: ProjectTechnologyValue;
  label: string;
}[] = [
  { value: "pkd", label: "ПКД (панельно-каркасная)" },
  { value: "md", label: "МД (модульная)" },
];

export function projectTechnologyLabel(
  technology: string | null | undefined,
): string {
  if (!technology) return "—";
  return (
    PROJECT_TECHNOLOGY_OPTIONS.find((option) => option.value === technology)
      ?.label ?? technology
  );
}
