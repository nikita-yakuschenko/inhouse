import type { AppRole } from "@/lib/auth/roles";

export type WorkspaceLabels = {
  /** Пункт сайдбара и заголовок раздела */
  section: string;
  sectionAll: string;
  recent: string;
  newItem: string;
  createSubmit: string;
  emptyList: string;
  openAction: string;
  tableTitle: string;
  tableDescription: string;
};

const estimatorLabels: WorkspaceLabels = {
  section: "Расчёты",
  sectionAll: "Все расчёты",
  recent: "Недавние расчёты",
  newItem: "Новый расчёт",
  createSubmit: "Создать расчёт",
  emptyList: "Расчётов пока нет. Создайте первый — укажите проект, материал и станок.",
  openAction: "Открыть",
  tableTitle: "Расчёты раскроя",
  tableDescription:
    "Проекты компании с расчётом заготовки и картами раскроя. Технически это проекты, для сметчика — расчёты.",
};

const operatorLabels: WorkspaceLabels = {
  section: "Задания",
  sectionAll: "Все задания",
  recent: "Недавние задания",
  newItem: "Новое задание",
  createSubmit: "Создать задание",
  emptyList: "Нет готовых заданий. Сметчик должен выполнить расчёт раскроя.",
  openAction: "Открыть",
  tableTitle: "Задания на смену",
  tableDescription: "Панели с готовым расчётом — выполняйте операции по порядку.",
};

export function getWorkspaceLabels(role: AppRole): WorkspaceLabels {
  return role === "operator" ? operatorLabels : estimatorLabels;
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  calculated: "Рассчитан",
  approved: "Утверждён",
  in_production: "В производстве",
  completed: "Завершён",
  archived: "Архив",
};
