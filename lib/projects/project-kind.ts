export const PROJECT_KIND_VALUES = ["sheet", "bar"] as const;

export type ProjectKindValue = (typeof PROJECT_KIND_VALUES)[number];

/** Подпись для бейджа в списке (рядом с «Погонаж»). */
export function projectKindShortLabel(kind: ProjectKindValue): string {
  return kind === "bar" ? "Погонаж" : "Плитная обшивка";
}

/** Полная подпись для селекта «Вид раскроя». */
export function projectKindSelectLabel(kind: ProjectKindValue): string {
  return kind === "bar"
    ? "Погонаж (заготовки и отрезки)"
    : "Плитный материал (листовой раскрой)";
}
